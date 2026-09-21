import {randomUUID} from 'node:crypto';
import {createSyncRepository,createCRMAdapterFactory,runSync} from './sync.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fail=code=>{throw Object.assign(Error(code),{code});};
const one=async(s,sql,args)=>(await s.query(sql,args)).rows[0];
const view=r=>({connectionId:r.connection_id,source:r.source,accountId:r.account_id,credentialRef:r.credential_ref,enabled:r.enabled,historyFrom:new Date(r.history_from).toISOString(),backfillTo:new Date(r.backfill_to).toISOString(),overlapSeconds:r.overlap_seconds,pollSeconds:r.poll_seconds,version:r.version,failureCount:r.failure_count,errorCode:r.error_code,nextAttemptAt:new Date(r.next_attempt_at).toISOString()});
export function createCRMRuntime({database,resolveCredentials,fetch:transport,clock=Date.now}={}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function'||typeof resolveCredentials!=='function')fail('CRM_CONFIGURATION_REQUIRED');
 return Object.freeze({
  async list(){return database.transaction('read',async s=>({canConfigure:s.role==='owner',settings:(await s.query(`SELECT c.source,c.account_id,c.credential_ref,s.* FROM public.crm_sync_settings s JOIN public.connections c ON c.tenant_id=s.tenant_id AND c.id=s.connection_id WHERE s.tenant_id=$1 ORDER BY c.source,c.account_id`,[s.tenantId])).rows.map(view)}));},
  async configure(input){
   const x=structuredClone(input),now=clock();
   if(!x||x.connectionId!==undefined&&!uuid(x.connectionId)||!['hubspot','zendesk'].includes(x.source)||typeof x.accountId!=='string'||!x.accountId.trim()||x.accountId.length>200||typeof x.credentialRef!=='string'||!/^[a-zA-Z0-9_.:-]{1,120}$/.test(x.credentialRef)||typeof x.enabled!=='boolean'||!Number.isInteger(x.overlapSeconds)||x.overlapSeconds<0||x.overlapSeconds>86400||!Number.isInteger(x.pollSeconds)||x.pollSeconds<60||x.pollSeconds>86400||!Number.isFinite(Date.parse(x.historyFrom))||Date.parse(x.historyFrom)>=now)fail('23514');
   return database.transaction('configure',async s=>{
    let connectionId=x.connectionId;
    if(connectionId){const c=await one(s,'SELECT source,account_id FROM public.connections WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[s.tenantId,connectionId]);if(!c||c.source!==x.source||c.account_id!==x.accountId||!Number.isSafeInteger(x.expectedVersion)||x.expectedVersion<1)fail('23514');await s.query('UPDATE public.connections SET credential_ref=$3 WHERE tenant_id=$1 AND id=$2',[s.tenantId,connectionId,x.credentialRef]);}
    else{connectionId=randomUUID();await s.query('INSERT INTO public.connections(id,tenant_id,source,account_id,credential_ref) VALUES($1,$2,$3,$4,$5)',[connectionId,s.tenantId,x.source,x.accountId,x.credentialRef]);}
    // Saving an account does not attest credentials or scopes. The worker verifies them.
    const values=[s.tenantId,connectionId,s.userId,x.enabled,new Date(x.historyFrom).toISOString(),new Date(now).toISOString(),x.overlapSeconds,x.pollSeconds];
    const result=x.connectionId?await s.query(`UPDATE public.crm_sync_settings SET actor_id=$3,enabled=$4,generation=CASE WHEN history_from<>$5::timestamptz THEN generation+1 ELSE generation END,backfill_to=CASE WHEN history_from<>$5::timestamptz THEN $6::timestamptz ELSE backfill_to END,history_from=$5,overlap_seconds=$7,poll_seconds=$8,version=version+1,failure_count=0,error_code=null,next_attempt_at=now(),updated_at=now() WHERE tenant_id=$1 AND connection_id=$2 AND version=$9 RETURNING *`,[...values,x.expectedVersion]):await s.query('INSERT INTO public.crm_sync_settings(tenant_id,connection_id,actor_id,enabled,history_from,backfill_to,overlap_seconds,poll_seconds) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',values);
    if(result.rows.length!==1)fail('23514');return view({...result.rows[0],source:x.source,account_id:x.accountId,credential_ref:x.credentialRef});
   });
  },
  async tick({deadlineMs=15000,maxPages=1}={}){
   if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>20000||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>5)fail('CRM_RUNTIME_LIMIT');
   const chosen=await database.transaction('import',async s=>{
    const row=await one(s,`SELECT c.source,c.account_id,c.credential_ref,r.* FROM public.crm_sync_settings r
     JOIN public.connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
     LEFT JOIN public.connection_health h ON h.tenant_id=r.tenant_id AND h.connection_id=r.connection_id
     WHERE r.tenant_id=$1 AND r.enabled AND r.failure_count<4 AND r.next_attempt_at<=clock_timestamp()
     AND public.crm_actor_authorized(r.connection_id) AND coalesce(h.state,'unknown')<>'reconnect_required'
     ORDER BY r.last_dispatched_at NULLS FIRST,r.id LIMIT 1 FOR UPDATE OF r SKIP LOCKED`,[s.tenantId]);
    if(!row)return null;
    await s.query('UPDATE public.crm_sync_settings SET last_dispatched_at=clock_timestamp(),next_attempt_at=clock_timestamp()+interval \'30 seconds\',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2',[s.tenantId,row.id]);
    const generation='crm-runtime-v1:'+row.generation;
    const prior=await one(s,'SELECT mode,window_spec,done FROM public.sync_cursors WHERE tenant_id=$1 AND connection_id=$2 AND window_spec->>\'version\'=$3 ORDER BY done ASC,(window_spec->>\'to\')::timestamptz DESC,id LIMIT 1',[s.tenantId,row.connection_id,generation]);
    let mode,window;
    if(prior&&!prior.done){mode=prior.mode;const{fetchFrom,...original}=prior.window_spec;window=original;}
    else if(!prior){mode='backfill';window={from:new Date(row.history_from).toISOString(),to:new Date(row.backfill_to).toISOString(),overlapSeconds:row.overlap_seconds,version:generation};}
    else{mode='live';const from=Math.max(Date.parse(prior.window_spec.to),new Date(row.history_from).getTime()),to=clock();if(to<=from)return null;window={from:new Date(from).toISOString(),to:new Date(to).toISOString(),overlapSeconds:row.overlap_seconds,version:generation};}
    return {row,mode,window,tenantId:s.tenantId};
   });
   if(!chosen)return {state:'idle'};
   const {row,mode,window,tenantId}=chosen;
   const guarded={transaction(action,work){return database.transaction(action,async s=>{if(s.tenantId!==tenantId||!(await one(s,'SELECT public.crm_actor_authorized($1) AS ok',[row.connection_id]))?.ok)fail('CRM_AUTHORIZATION_REVOKED');return work(s);});}};
   try{
    const credentials=resolveCredentials({tenantId,source:row.source,accountId:row.account_id,credentialRef:row.credential_ref});
    const repository=createSyncRepository({database:guarded}),adapterFactory=createCRMAdapterFactory({...credentials,...(transport?{fetch:transport}:{}),clock:()=>new Date(clock()),timeoutMs:Math.min(10000,deadlineMs),maxRetries:0});
    const result=await runSync({repository,connectionId:row.connection_id,mode,window,adapterFactory,deadlineMs,maxPages,leaseMs:30000,clock});
    await guarded.transaction('import',s=>s.query('UPDATE public.crm_sync_settings SET failure_count=0,error_code=null,next_attempt_at=clock_timestamp()+$3*interval \'1 second\',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2',[s.tenantId,row.id,result.state==='done'?row.poll_seconds:30]));
    return {state:result.state,connectionId:row.connection_id,pages:result.pages};
   }catch(error){
    const code=error?.code==='CRM_CREDENTIAL_CONFIGURATION_REQUIRED'?error.code:error?.code==='RECONNECT_REQUIRED'?'RECONNECT_REQUIRED':'SYNC_FAILED';
    await guarded.transaction('import',s=>s.query('UPDATE public.crm_sync_settings SET failure_count=least(4,failure_count+1),error_code=$3,next_attempt_at=clock_timestamp()+least(900,30*power(2,failure_count))*interval \'1 second\',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2',[s.tenantId,row.id,code]));
    return {state:'blocked',connectionId:row.connection_id,code};
   }
  }
 });
}
