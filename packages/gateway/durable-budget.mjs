import {randomUUID} from 'node:crypto';
import {minor} from './budget.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const purposes=['extraction','explorer','embedding','brief'];
const fail=code=>{throw Object.assign(Error(code),{code:'23514'});};
const text=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const money=v=>{try{return minor(v);}catch{fail('BUDGET_MINOR_INVALID');}};
const view=r=>({id:r.id,jobId:r.job_id,purpose:r.purpose,window:r.window_key,taskKey:r.task_key,state:r.state,heldMinor:String(r.held_minor),actualMinor:r.actual_minor==null?null:String(r.actual_minor),reportedMinor:String(r.reported_minor),version:r.version});
/** Authenticated server-owned scope. No in-memory quota, TTL release, provider call or token logging. */
export function createDurableBudgetRepository({database,purpose,jobId,ownerToken=randomUUID()}={}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function'||!purposes.includes(purpose)||!uuid(jobId)||!uuid(ownerToken))fail('BUDGET_SCOPE_INVALID');
 const load=async(s,id,lock=true)=>{
  if(!uuid(id))fail('BUDGET_ID_INVALID');
  const r=(await s.query('SELECT * FROM public.ai_budget_reservations WHERE tenant_id=$1 AND id=$2 AND job_id=$3 AND purpose=$4'+(lock?' FOR UPDATE':''),[s.tenantId,id,jobId,purpose])).rows[0];if(!r)fail('BUDGET_RESERVATION_MISSING');return r;
 };
 return Object.freeze({
  async configure({window,limitMinor,purpose:limitPurpose,expectedVersion}={}){
   if(!text(window,100)||!['all',...purposes].includes(limitPurpose))fail('BUDGET_LIMIT_INVALID');money(limitMinor);
   return database.transaction('configure',async s=>{
    let result;
    if(expectedVersion===undefined)result=await s.query('INSERT INTO public.ai_budget_limits(tenant_id,purpose,window_key,limit_minor) VALUES($1,$2,$3,$4) RETURNING *',[s.tenantId,limitPurpose,window,limitMinor]);
    else{if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('BUDGET_VERSION_INVALID');result=await s.query('UPDATE public.ai_budget_limits SET limit_minor=$4,version=version+1 WHERE tenant_id=$1 AND purpose=$2 AND window_key=$3 AND version=$5 RETURNING *',[s.tenantId,limitPurpose,window,limitMinor,expectedVersion]);}
    if(result.rows.length!==1)fail('BUDGET_LIMIT_STALE');const r=result.rows[0];return {id:r.id,version:r.version,purpose:r.purpose,window:r.window_key,limitMinor:String(r.limit_minor)};
   });
  },
  async reserve(request){
   const q=structuredClone(request);if(!q||!text(q.taskKey,200)||!text(q.window,100)||!digest(q.fingerprint)||q.currency!=='USD'||q.exponent!==6)fail('BUDGET_RESERVATION_INVALID');const amount=money(q.amountMinor),requested=money(q.tenantLimitMinor);if(amount<=0n)fail('BUDGET_RESERVATION_INVALID');
   return database.transaction('import',async s=>{
    await s.query("SELECT set_config('vexa.budget_owner_token',$1,true)",[ownerToken]);
    if(q.tenantId!==s.tenantId)fail('BUDGET_TENANT_MISMATCH');
    // A single ordered lock covers both the tenant-wide and purpose quota.
    const limits=(await s.query("SELECT * FROM public.ai_budget_limits WHERE tenant_id=$1 AND window_key=$2 AND purpose IN ('all',$3) ORDER BY purpose FOR UPDATE",[s.tenantId,q.window,purpose])).rows;
    const existing=(await s.query('SELECT fingerprint,job_id,window_key,held_minor FROM public.ai_budget_reservations WHERE tenant_id=$1 AND purpose=$2 AND task_key=$3',[s.tenantId,purpose,q.taskKey])).rows[0];
    if(existing)return {acquired:false,reason:existing.fingerprint===q.fingerprint&&existing.job_id===jobId&&existing.window_key===q.window&&BigInt(existing.held_minor)===amount?'duplicate_task':'idempotency_conflict'};
    if(limits.length!==2)return {acquired:false,reason:'budget_exceeded'};
    for(const limit of limits){const row=(await s.query("SELECT coalesce(sum(CASE WHEN state IN ('settled','released') THEN actual_minor ELSE greatest(held_minor,reported_minor,coalesce((SELECT sum(a.reported_minor) FROM public.ai_budget_attempts a WHERE a.tenant_id=r.tenant_id AND a.reservation_id=r.id AND a.state='received'),0)) END),0)::text AS used FROM public.ai_budget_reservations r WHERE tenant_id=$1 AND window_key=$2 AND ($3='all' OR purpose=$3)",[s.tenantId,q.window,limit.purpose])).rows[0];const used=BigInt(row.used);if(used+amount>BigInt(limit.limit_minor)||(limit.purpose==='all'&&used+amount>requested))return {acquired:false,reason:'budget_exceeded'};}
    const result=await s.query('INSERT INTO public.ai_budget_reservations(tenant_id,job_id,purpose,window_key,task_key,fingerprint,actor_id,owner_token,held_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[s.tenantId,jobId,purpose,q.window,q.taskKey,q.fingerprint,s.userId,ownerToken,q.amountMinor]);return {acquired:true,reservationId:result.rows[0].id};
   });
  },
  async recordAttempt(id,input){
   const a=structuredClone(input);if(!Number.isSafeInteger(a?.index)||a.index<0||a.index>2||!['started','received','not_sent'].includes(a.state))fail('BUDGET_ATTEMPT_INVALID');
   if(a.state==='started'&&(!text(a.model,200)||!text(a.provider,200)||!text(a.pricingVersion,200)||money(a.ceilingMinor)<=0n))fail('BUDGET_ATTEMPT_INVALID');
   if(a.state==='received'&&(!Number.isInteger(a.httpStatus)||a.httpStatus<100||a.httpStatus>599||a.remoteIdHash!=null&&!digest(a.remoteIdHash)))fail('BUDGET_ATTEMPT_INVALID');
   if(a.state==='started')a.ceilingMinor=money(a.ceilingMinor).toString();
   if(a.state==='received'&&a.reportedMinor!=null)a.reportedMinor=money(a.reportedMinor).toString();
   const usage=a.state==='received'?(a.usage??{}):{};if(!usage||Array.isArray(usage)||typeof usage!=='object'||Object.entries(usage).some(([k,v])=>!['prompt_tokens','completion_tokens','total_tokens'].includes(k)||!Number.isSafeInteger(v)||v<0||v>100000000))fail('BUDGET_USAGE_INVALID');
   return database.transaction('import',async s=>{
    await s.query("SELECT set_config('vexa.budget_owner_token',$1,true)",[ownerToken]);
    const r=await load(s,id);if(r.owner_token!==ownerToken||r.actor_id!==s.userId||r.state!=='reserved')fail('BUDGET_FENCE_LOST');
    const value={index:a.index,state:a.state,model:a.state==='started'?a.model:null,provider:a.state==='started'?a.provider:null,pricingVersion:a.state==='started'?a.pricingVersion:null,ceilingMinor:a.state==='started'?a.ceilingMinor:null,httpStatus:a.state==='received'?a.httpStatus:null,remoteIdHash:a.remoteIdHash??null,reportedMinor:a.reportedMinor??null,usage};
    const prior=(await s.query('SELECT * FROM public.ai_budget_attempts WHERE tenant_id=$1 AND reservation_id=$2 AND attempt_index=$3 AND state=$4',[s.tenantId,id,a.index,a.state])).rows[0];
    if(prior){const same=prior.model===value.model&&prior.provider===value.provider&&prior.pricing_version===value.pricingVersion&&(prior.ceiling_minor==null?null:String(prior.ceiling_minor))===value.ceilingMinor&&prior.http_status===value.httpStatus&&prior.remote_id_hash===value.remoteIdHash&&(prior.reported_minor==null?null:String(prior.reported_minor))===value.reportedMinor&&JSON.stringify(Object.entries(prior.usage).sort())===JSON.stringify(Object.entries(value.usage).sort());if(!same)fail('BUDGET_ATTEMPT_CONFLICT');return;}
    await s.query('INSERT INTO public.ai_budget_attempts(tenant_id,reservation_id,owner_token,attempt_index,state,model,provider,pricing_version,ceiling_minor,http_status,remote_id_hash,reported_minor,usage) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[s.tenantId,id,ownerToken,a.index,a.state,value.model,value.provider,value.pricingVersion,value.ceilingMinor,value.httpStatus,value.remoteIdHash,value.reportedMinor,JSON.stringify(usage)]);
   });
  },
  async finalize(id,{state,actualMinor,reportedMinor}){
   if(!['settled','uncertain'].includes(state))fail('BUDGET_STATE_INVALID');const reported=money(reportedMinor);if(state==='settled'&&money(actualMinor)!==reported||state==='uncertain'&&actualMinor!==null)fail('BUDGET_SETTLEMENT_INVALID');
   reportedMinor=reported.toString();if(actualMinor!==null)actualMinor=money(actualMinor).toString();
   return database.transaction('import',async s=>{
    await s.query("SELECT set_config('vexa.budget_owner_token',$1,true)",[ownerToken]);
    const r=await load(s,id);if(r.owner_token!==ownerToken||r.actor_id!==s.userId)fail('BUDGET_FENCE_LOST');
    if(r.state!=='reserved'){if(r.state===state&&(r.actual_minor==null?null:String(r.actual_minor))===actualMinor&&String(r.reported_minor)===reportedMinor)return;fail('BUDGET_TERMINAL_IMMUTABLE');}
    await s.query('UPDATE public.ai_budget_reservations SET state=$3,actual_minor=$4,reported_minor=$5,version=version+1 WHERE tenant_id=$1 AND id=$2',[s.tenantId,id,state,actualMinor,reportedMinor]);
   });
  },
  async list({window}={}){
   if(!text(window,100))fail('BUDGET_WINDOW_INVALID');return database.transaction('read',async s=>(await s.query('SELECT id,job_id,purpose,window_key,task_key,state,held_minor,actual_minor,reported_minor,version FROM public.ai_budget_reservations WHERE tenant_id=$1 AND window_key=$2 AND purpose=$3 ORDER BY created_at,id',[s.tenantId,window,purpose])).rows.map(view));
  },
  async reconcile({reservationId,expectedVersion,actualMinor,evidenceHash,confirmedProviderEvidence}={}){
   if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1||!digest(evidenceHash)||confirmedProviderEvidence!==true)fail('BUDGET_PROVIDER_EVIDENCE_REQUIRED');actualMinor=money(actualMinor).toString();
   return database.transaction('configure',async s=>{
    const r=await load(s,reservationId);const prior=(await s.query('SELECT expected_version,actual_minor,evidence_hash FROM public.ai_budget_reconciliations WHERE tenant_id=$1 AND reservation_id=$2',[s.tenantId,reservationId])).rows[0];
    if(prior){if(prior.expected_version===expectedVersion&&String(prior.actual_minor)===actualMinor&&prior.evidence_hash===evidenceHash&&r.state==='settled')return view(r);fail('BUDGET_RECONCILIATION_CONFLICT');}
    if(!['reserved','uncertain'].includes(r.state)||r.version!==expectedVersion)fail('BUDGET_RECONCILIATION_STALE');
    await s.query('INSERT INTO public.ai_budget_reconciliations(tenant_id,reservation_id,actor_id,expected_version,actual_minor,evidence_hash,confirmed_provider_evidence) VALUES($1,$2,$3,$4,$5,$6,true)',[s.tenantId,reservationId,s.userId,expectedVersion,actualMinor,evidenceHash]);
    const updated=(await s.query("UPDATE public.ai_budget_reservations SET state='settled',actual_minor=$3,reported_minor=$3,version=version+1 WHERE tenant_id=$1 AND id=$2 RETURNING *",[s.tenantId,reservationId,actualMinor])).rows[0];return view(updated);
   });
  }
 });
}
