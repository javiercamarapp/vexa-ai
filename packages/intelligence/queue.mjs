import {randomUUID} from 'node:crypto';
import {sha256} from './index.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code:status===403?'42501':status===400?'22P02':'23514',status});};
const one=async(s,sql,args)=>(await s.query(sql,args)).rows[0];
const safeReasons=new Set(['reconciliation_required','configuration_changed','configuration_required','actor_revoked','source_unavailable','deadline','execution_failed','runtime_disabled','missing_key','policy_blocked','invalid_output','source_changed','ambiguous','insufficient_evidence','budget_exceeded','budget_unavailable','timeout','transport_error','provider_error','cost_overrun','retry_deferred','extraction_failed']);
/** Scoped durable queue. Import jobs and their replay semantics remain separate. */
export function createExtractionQueue({database,leaseMs=45000}={}){
 if(typeof database?.transaction!=='function'||!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>60000)fail('configuration_required',503);
 const tx=work=>database.transaction('import',work);
 const projection=j=>({id:j.id,conversationId:j.conversation_id,state:j.state,runId:j.run_id??null,runStatus:j.run_status??null,reason:safeReasons.has(j.provenance?.reason)?j.provenance.reason:null,createdAt:j.created_at});
 async function request(s,id,lock=false){
  const j=await one(s,`SELECT j.*,r.actor_id,r.conversation_id,r.config_hash FROM public.jobs j JOIN public.extraction_requests r ON r.tenant_id=j.tenant_id AND r.job_id=j.id WHERE j.tenant_id=$1 AND j.id=$2 ${lock?'FOR UPDATE OF j':''}`,[s.tenantId,id]);
  if(!j)fail('extraction_not_found',404);return j;
 }
 async function accessible(s,j){if(s.role!=='owner'&&j.actor_id!==s.userId)fail('extraction_not_found',404);}
 async function delegated(s){const d=await one(s,'SELECT enabled FROM public.worker_delegations WHERE tenant_id=$1 AND user_id=$2',[s.tenantId,s.userId]);if(s.role!=='analyst'||!d?.enabled)fail('worker_disabled',403);}
 async function fence(s,claim){
  const j=await request(s,claim.id,true);await delegated(s);
  if(j.state!=='running'||j.cancel_requested_at||String(j.fencing_token)!==String(claim.fencing_token)||j.lease_owner!==claim.lease_owner)fail('stale_fence');
  const valid=await one(s,'SELECT $1::timestamptz>clock_timestamp() AS live,public.extraction_actor_authorized($2) AS authorized',[j.lease_until,j.id]);
  if(!valid?.live)fail('stale_fence');if(!valid.authorized)fail('actor_revoked',403);return j;
 }
 async function finish(s,j,state,reason){
  await s.query('UPDATE public.jobs SET state=$3,lease_until=NULL,provenance=$4,updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2',[s.tenantId,j.id,state,JSON.stringify({reason:safeReasons.has(reason)?reason:reason==null?null:'execution_failed'})]);
  await s.query('UPDATE public.attempts SET state=$4,finished_at=clock_timestamp(),error_code=$5 WHERE tenant_id=$1 AND job_id=$2 AND fencing_token=$3 AND state=\'running\'',[s.tenantId,j.id,j.fencing_token,state==='succeeded'?'succeeded':reason==='reconciliation_required'?'uncertain':'failed',reason??null]);
 }
 return Object.freeze({
  async submit({conversationId,requestKey,configHash}){
   if(!uuid(conversationId)||!uuid(requestKey)||typeof configHash!=='string'||! /^[a-f0-9]{64}$/.test(configHash))fail('extraction_input_invalid',400);
   return tx(async s=>{
    await s.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenantId+':extract-submit:'+s.userId+':'+requestKey]);
    const prior=await one(s,'SELECT job_id,conversation_id,config_hash FROM public.extraction_requests WHERE tenant_id=$1 AND actor_id=$2 AND request_key=$3',[s.tenantId,s.userId,requestKey]);
    if(prior){if(prior.conversation_id!==conversationId||prior.config_hash!==configHash)fail('request_conflict');return projection(await request(s,prior.job_id));}
    const source=await one(s,`SELECT c.id FROM public.conversations c JOIN public.connections n ON n.tenant_id=c.tenant_id AND n.id=c.connection_id JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id WHERE c.tenant_id=$1 AND c.id=$2 AND c.deleted_at IS NULL AND n.status='active' AND h.state IN ('unique','selected')`,[s.tenantId,conversationId]);
    if(!source)fail('source_unavailable',404);
    const id=randomUUID();await s.query("INSERT INTO public.jobs(id,tenant_id,type,input_ref,input_hash,version,max_attempts) VALUES($1,$2,'extraction',$3,$4,'extraction-queue-v1',1)",[id,s.tenantId,'conversation:'+conversationId,sha256(JSON.stringify({actor:s.userId,requestKey,conversationId,configHash}))]);
    await s.query('INSERT INTO public.extraction_requests(tenant_id,job_id,conversation_id,actor_id,request_key,config_hash) VALUES($1,$2,$3,$4,$5,$6)',[s.tenantId,id,conversationId,s.userId,requestKey,configHash]);
    return projection(await request(s,id));
   });
  },
  async list(){return database.transaction('read',async s=>(await s.query(`SELECT j.id,j.state,j.provenance,j.created_at,r.conversation_id,e.id AS run_id,e.status AS run_status FROM public.extraction_requests r JOIN public.jobs j ON j.tenant_id=r.tenant_id AND j.id=r.job_id LEFT JOIN public.extraction_runs e ON e.tenant_id=j.tenant_id AND e.job_id=j.id WHERE r.tenant_id=$1 AND (r.actor_id=$2 OR $3::boolean) ORDER BY j.created_at DESC,j.id LIMIT 100`,[s.tenantId,s.userId,s.role==='owner'])).rows.map(projection));},
  async conversations(){return database.transaction('read',async s=>(await s.query(`SELECT c.id,c.source,c.created_at FROM public.conversations c JOIN public.connections n ON n.tenant_id=c.tenant_id AND n.id=c.connection_id JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id WHERE c.tenant_id=$1 AND c.deleted_at IS NULL AND n.status='active' AND h.state IN ('unique','selected') ORDER BY c.created_at DESC,c.id LIMIT 100`,[s.tenantId])).rows);},
  async cancel(id){if(!uuid(id))fail('extraction_input_invalid',400);return tx(async s=>{const j=await request(s,id,true);await accessible(s,j);if(!['queued','running'].includes(j.state))return projection(j);await s.query("UPDATE public.jobs SET state='cancelled',cancel_requested_at=clock_timestamp(),fencing_token=fencing_token+1,lease_until=NULL WHERE tenant_id=$1 AND id=$2",[s.tenantId,id]);await s.query("UPDATE public.attempts SET state='cancelled',finished_at=clock_timestamp() WHERE tenant_id=$1 AND job_id=$2 AND state='running'",[s.tenantId,id]);return {...projection(j),state:'cancelled'};});},
  async claim(){return tx(async s=>{
   await delegated(s);
   const j=await one(s,`SELECT j.*,r.actor_id,r.conversation_id,r.config_hash FROM public.jobs j JOIN public.extraction_requests r ON r.tenant_id=j.tenant_id AND r.job_id=j.id WHERE j.tenant_id=$1 AND j.type='extraction' AND j.cancel_requested_at IS NULL AND (j.state='queued' OR j.state='running' AND j.lease_until<=clock_timestamp()) ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,[s.tenantId]);
   if(!j)return null;
   const prior=await one(s,'SELECT id,status,provenance FROM public.extraction_runs WHERE tenant_id=$1 AND job_id=$2',[s.tenantId,j.id]);
   if(prior){const ok=['succeeded','abstained'].includes(prior.status);await finish(s,j,ok?'succeeded':'failed',prior.status==='running'?'reconciliation_required':prior.provenance?.reason);return {recovered:true,id:j.id,state:ok?'succeeded':'failed'};}
   if(!(await one(s,'SELECT public.extraction_actor_authorized($1) AS ok',[j.id]))?.ok){await finish(s,j,'failed','actor_revoked');return {recovered:true,id:j.id,state:'failed'};}
   if(Number(j.fencing_token)>=4){await finish(s,j,'failed','execution_failed');return {recovered:true,id:j.id,state:'failed'};}
   const c=await one(s,"UPDATE public.jobs SET state='running',fencing_token=fencing_token+1,lease_owner=$3,lease_until=clock_timestamp()+$4*interval '1 millisecond',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2 RETURNING *",[s.tenantId,j.id,randomUUID(),leaseMs]);
   await s.query("UPDATE public.attempts SET state='uncertain',finished_at=clock_timestamp(),error_code='LEASE_EXPIRED' WHERE tenant_id=$1 AND job_id=$2 AND state='running'",[s.tenantId,j.id]);
   await s.query("INSERT INTO public.attempts(tenant_id,job_id,state,attempt_number,fencing_token) VALUES($1,$2,'running',$3::integer,$3::bigint)",[s.tenantId,j.id,c.fencing_token]);
   return {...c,conversationId:j.conversation_id,configHash:j.config_hash};
  });},
  scopedDatabase(claim){return Object.freeze({transaction:(action,work)=>{if(action!=='import')fail('worker_action_invalid',403);return tx(async s=>{await fence(s,claim);await s.query("SELECT set_config('vexa.extraction_job_fence',$1,true),set_config('vexa.extraction_lease_owner',$2,true)",[String(claim.fencing_token),claim.lease_owner]);const result=await work(s);await fence(s,claim);return result;});}});},
  async complete(claim,result){return tx(async s=>{const j=await fence(s,claim),run=await one(s,'SELECT status,provenance FROM public.extraction_runs WHERE tenant_id=$1 AND job_id=$2',[s.tenantId,j.id]);if(!run||run.status==='running')fail('reconciliation_required');const state=['succeeded','abstained'].includes(run.status)?'succeeded':'failed';await finish(s,j,state,run.provenance?.reason??result?.reason);return {id:j.id,state,runStatus:run.status};});},
  async reject(claim,reason){return tx(async s=>{const j=await fence(s,claim);const run=await one(s,'SELECT status FROM public.extraction_runs WHERE tenant_id=$1 AND job_id=$2',[s.tenantId,j.id]);if(run?.status==='running')reason='reconciliation_required';await finish(s,j,'failed',reason);return {id:j.id,state:'failed',reason:safeReasons.has(reason)?reason:'execution_failed'};});}
 });
}
