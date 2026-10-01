import {check,uuid,strict,NotificationError} from './contracts.mjs';
import {validatePolicy,boundedSend} from './delivery.mjs';
import {catalog} from './catalog.mjs';
const event=input=>{check(strict(input,['eventId','type','resourceId','userId','channel'])&&[input.eventId,input.resourceId,input.userId].every(uuid)&&catalog.some(x=>x.type===input.type)&&input.type!=='membership.invited'&&['inapp','email','push'].includes(input.channel));return structuredClone(input);};
const output=r=>r?{...r,tenantId:r.tenant_id,userId:r.user_id,fence:String(r.fencing_token),leaseUntil:r.lease_until,idempotencyKey:r.idempotency_key,providerId:r.provider_id}:null;
const claimArgs=c=>{check(c&&uuid(c.id)&&/^\d+$/.test(String(c.fencing_token)),'notification_fence_invalid');return[c.id,String(c.fencing_token)];};
/** Uses the canonical DB boundary and canonical jobs; no pool/Auth/lease system is duplicated. */
export function createOutboxRepository({database,leaseMs=30000,verifyReconciliation}={}){
 check(database&&typeof database.transaction==='function','notification_database_missing',503);check(Number.isSafeInteger(leaseMs)&&leaseMs>=100&&leaseMs<=300000);
 const tx=async(action,work)=>{let own;try{return await database.transaction(action,async s=>{try{return await work(s);}catch(e){if(e instanceof NotificationError)own=e;throw e;}});}catch(e){if(own)throw own;throw e;}};
 const call=async(s,name,args=[],casts=[])=>{const r=await s.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)+(casts[i]?'::'+casts[i]:'')).join(',')}) AS result`,args);return r.rows[0]?.result;};
 const repo={leaseMs,
 async configure(input){const p=validatePolicy(input);return tx('configure',s=>call(s,'notification_policy_set',[JSON.stringify(p)],['jsonb']));},
 async enqueue(input){const p=event(input);return tx('import',async s=>{const id=await repo.enqueueIn(s,p);return output(await call(s,'notification_job_view',[s.tenantId,id]));});},
 async enqueueIn(scope,input){const p=event(input);check(scope&&typeof scope.query==='function'&&uuid(scope.tenantId),'notification_transaction_required');return call(scope,'notification_enqueue',[JSON.stringify(p)],['jsonb']);},
 async get(id){check(uuid(id),'notification_outbox_not_found',404);return tx('read',async s=>{const r=await call(s,'notification_job_view',[s.tenantId,id]);check(r,'notification_outbox_not_found',404);return output(r);});},
 async claim(){return tx('import',async s=>output(await call(s,'notification_claim',[leaseMs])));},
 async renew(claim){return tx('import',s=>call(s,'notification_renew',[...claimArgs(claim),leaseMs]));},
 async checkpoint(){return null;},
 async beginSend(claim,configured){check(typeof configured==='boolean');return tx('import',s=>call(s,'notification_begin_send',[...claimArgs(claim),configured]));},
 async commitChunk(claim,{records,done}){check(done===true&&Array.isArray(records)&&records.length===1,'notification_chunk_invalid');return tx('import',async s=>output(await call(s,'notification_finish',[...claimArgs(claim),JSON.stringify(records[0])],['uuid','bigint','jsonb'])));},
 async ack(claim){return repo.get(claim.id);},
 async fail(claim){return tx('import',async s=>output(await call(s,'notification_abort',claimArgs(claim))));},
 async health(){return tx('read',async s=>{check(await call(s,'notification_worker',[s.tenantId]),'notification_worker_required',403);const r=await s.query("SELECT o.state,count(*)::integer AS count,min(o.created_at) AS oldest FROM public.notification_outbox o WHERE o.tenant_id=$1 GROUP BY o.state ORDER BY o.state",[s.tenantId]);const reasons=r.rows.filter(x=>['uncertain','blocked','dead'].includes(x.state)).map(x=>'NOTIFICATION_'+x.state.toUpperCase());return{healthy:reasons.length===0,reasons,states:r.rows};});},
 async reconcile(input){check(strict(input,['id','expectedFence','decision','evidenceId','requestKey'])&&[input.id,input.evidenceId,input.requestKey].every(uuid)&&['accepted','not_sent'].includes(input.decision)&&typeof input.expectedFence==='string'&&/^\d+$/.test(input.expectedFence));check(typeof verifyReconciliation==='function','notification_reconciliation_unconfigured',503);const saved=structuredClone(input);await tx('read',s=>check(s.role==='owner','notification_owner_required',403));const outbox=await repo.get(saved.id);const replay=await tx('read',async s=>(await s.query('SELECT request_key FROM public.notification_reconciliations WHERE tenant_id=$1 AND request_key=$2',[s.tenantId,saved.requestKey])).rows[0]);if(replay)return tx('configure',s=>call(s,'notification_reconcile',[JSON.stringify({...saved,idempotencyKey:outbox.idempotencyKey,providerId:saved.decision==='accepted'?outbox.providerId:null})],['jsonb']));const verified=await boundedSend(async signal=>({value:structuredClone(await verifyReconciliation({outbox:structuredClone(outbox),decision:saved.decision,evidenceId:saved.evidenceId},{signal}))}),10000);check(verified&&Object.hasOwn(verified,'value'),'notification_verification_unavailable',503);const proof=verified.value;check(proof&&proof.outboxId===saved.id&&proof.evidenceId===saved.evidenceId&&proof.decision===saved.decision&&proof.idempotencyKey===outbox.idempotencyKey,'notification_reconciliation_unverified',409);return tx('configure',s=>call(s,'notification_reconcile',[JSON.stringify({...saved,idempotencyKey:outbox.idempotencyKey,providerId:proof.providerId??null})],['jsonb']));},
 };
 return Object.freeze(repo);
}
