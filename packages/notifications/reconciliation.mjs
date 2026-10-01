import {createHash} from 'node:crypto';
import {check,uuid} from './contracts.mjs';
/** Private server port. Dedicated login may SET ROLE verifier only, never the API/worker login.
 * verify independently queries provider evidence; no browser boolean or guessed delivery state. */
export function createReconciliationVerifier({pool,verify}){
 check(pool&&typeof pool.connect==='function'&&typeof verify==='function','notification_verifier_missing',503);
 return async({outbox,decision,evidenceId},{signal}={})=>{
  const deadline=new AbortController();const timer=setTimeout(()=>deadline.abort(),10000);
  const active=signal?AbortSignal.any([signal,deadline.signal]):deadline.signal;
  const current=()=>check(!active.aborted,'notification_verification_cancelled',503);
  const wait=async task=>{current();let listener;try{return await Promise.race([Promise.resolve(task),new Promise((_,reject)=>{listener=()=>{try{current();}catch(e){reject(e);}};active.addEventListener('abort',listener,{once:true});if(active.aborted)listener();})]);}finally{active.removeEventListener('abort',listener);}};
  let c,open=false,destroy=false,released=false;
  const release=(client,discard)=>{if(!released){released=true;client.release(discard);}};
  try{
  current();
  const fixed=structuredClone({outbox,decision,evidenceId});check(uuid(fixed.evidenceId)&&['accepted','not_sent'].includes(fixed.decision));
  const raw=structuredClone(await wait(verify({outbox:structuredClone(fixed.outbox),decision:fixed.decision},{signal:active})));current();
  check(raw&&raw.verified===true&&raw.idempotencyKey===fixed.outbox.idempotencyKey&&raw.decision===fixed.decision&&typeof raw.evidence==='string'&&raw.evidence.length>0&&raw.evidence.length<=65536,'notification_evidence_not_verified',409);
  const providerId=raw.providerId??null;check(fixed.decision==='accepted'?typeof providerId==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(providerId):providerId===null,'notification_evidence_invalid');
  current();const connection=pool.connect();
  connection.then(client=>{if(active.aborted&&!c)release(client,true);},()=>{});
  c=await wait(connection);current();
  const query=async(sql,args)=>{current();const result=await wait(c.query(sql,args));current();return result;};
  try{
   await query('BEGIN');open=true;await query("SET LOCAL statement_timeout = '10s'");await query("SET LOCAL idle_in_transaction_session_timeout = '10s'");await query('SET LOCAL ROLE vexa_notification_verifier');
   const proofHash=createHash('sha256').update(raw.evidence).digest('hex');
   const prior=(await query('SELECT job_id,fence::text,decision,idempotency_key,provider_id,proof_hash FROM public.notification_reconciliation_evidence WHERE tenant_id=$1 AND id=$2',[fixed.outbox.tenantId,fixed.evidenceId])).rows[0];
   if(prior)check(prior.job_id===fixed.outbox.id&&prior.fence===fixed.outbox.fence&&prior.decision===fixed.decision&&prior.idempotency_key===fixed.outbox.idempotencyKey&&prior.provider_id===providerId&&prior.proof_hash===proofHash,'notification_evidence_conflict',409);
   else await query('INSERT INTO public.notification_reconciliation_evidence(tenant_id,id,job_id,fence,decision,idempotency_key,provider_id,proof_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[fixed.outbox.tenantId,fixed.evidenceId,fixed.outbox.id,fixed.outbox.fence,fixed.decision,fixed.outbox.idempotencyKey,providerId,proofHash]);
   await query('COMMIT');open=false;
  }catch(e){destroy=true;if(open&&!active.aborted){try{await query('ROLLBACK');open=false;}catch{}}throw e;}
  return {outboxId:fixed.outbox.id,decision:fixed.decision,evidenceId:fixed.evidenceId,idempotencyKey:fixed.outbox.idempotencyKey,providerId};
  }catch(e){destroy=true;throw e;}finally{clearTimeout(timer);if(c)release(c,destroy||active.aborted);}
 };
}
