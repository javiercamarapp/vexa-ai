import {randomUUID} from 'node:crypto';
import {persistCanonical,persistNormalizationRejection,readCanonicalHistory,selectCanonicalRevision} from '../../ingestion/persistence/index.mjs';
import {contentHash} from '../../ingestion/index.mjs';
import {fail} from './error.mjs';
const one=async(s,q,p=[])=>(await s.query(q,p)).rows[0];
export function retryDelay(failures,error,now=Date.now()){
 if(error.status===401||error.status===403||error.retryable===false||failures>=4)return null;
 const base=1000*2**(failures-1),r=error.retryAfter;
 const delay=r==null?0:/^\d+(\.\d+)?$/.test(String(r))?Number(r)*1000:Date.parse(r)-now;
 return Math.max(base,Number.isFinite(delay)?delay:0);
}
export function createJobRepository({database,leaseMs=30000,deadlineMs=900000,queueMs=120000,heartbeatMs=60000,worker=false,rejectRecord=(scope,{importId,record,error})=>persistNormalizationRejection(scope,{importId,error,rowRef:record.row_ref,rawHash:record.raw_hash,batchHash:record.batch_hash,mappingVersion:record.mapping_version})}={}){
 if(!database?.transaction)fail('JOBS_CONFIGURATION_REQUIRED',503);
 for(const n of [leaseMs,deadlineMs,queueMs,heartbeatMs])if(!Number.isSafeInteger(n)||n<10)fail('INVALID_JOB_CONFIG');
 const tx=fn=>database.transaction('import',fn);
 async function delegated(s){if(!worker)return false;const d=await one(s,"SELECT enabled FROM public.worker_delegations WHERE tenant_id=$1 AND user_id=$2",[s.tenantId,s.userId]);if(!d?.enabled||s.role!=='analyst')fail('WORKER_DISABLED',403);return true;}
 async function actorAllowed(s,j){if(!worker)return true;return !!(await one(s,'SELECT public.worker_actor_authorized($1) AS ok',[j.id]))?.ok;}
 const read=fn=>database.transaction('read',fn);
 async function owned(s,id,lock=false){
  const j=await one(s,`SELECT j.*,u.user_id,c.status AS connection_status FROM public.jobs j JOIN public.import_uploads u ON u.tenant_id=j.tenant_id AND u.job_id=j.id JOIN public.imports i ON i.tenant_id=j.tenant_id AND i.id=j.import_id JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id WHERE j.tenant_id=$1 AND j.id=$2 AND (u.user_id=$3 OR $4::boolean) ${lock?'FOR UPDATE OF j':''}`,[s.tenantId,id,s.userId,s.role==='owner'||await delegated(s)]);
  if(!j)fail('JOB_NOT_FOUND',404);return j;
 }
 async function fence(s,claim,{deadline=true,authorization=true}={}){
  const j=await owned(s,claim.id,true);
  const live=await one(s,'SELECT $1::timestamptz>clock_timestamp() AS lease, $2::timestamptz>clock_timestamp() AS deadline',[j.lease_until,j.deadline]);
  if(j.state!=='running'||j.cancel_requested_at||String(j.fencing_token)!==String(claim.fencing_token)||!live.lease)fail('STALE_FENCE');
  if(deadline&&!live.deadline)fail('DEADLINE');
  if(authorization&&!await actorAllowed(s,j))fail('ACTOR_REVOKED',403);
  if(authorization&&j.connection_status!=='active')fail('CONNECTION_REVOKED',403);
  const auth=await one(s,"SELECT public.vexa_backend_action($1,array['import']) AS ok",[s.tenantId]);if(!auth?.ok)fail('PRINCIPAL_REVOKED',403);
  return j;
 }
 async function terminal(s,j,reason){
  await s.query("UPDATE public.jobs SET state='failed',lease_until=NULL,fencing_token=fencing_token+1,updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2",[s.tenantId,j.id]);
  await s.query("INSERT INTO public.dead_letters(tenant_id,job_id,reason) VALUES($1,$2,$3)",[s.tenantId,j.id,reason]);
  await s.query("UPDATE public.outbox SET state='failed',lease_until=NULL WHERE tenant_id=$1 AND job_id=$2",[s.tenantId,j.id]);
  await s.query("UPDATE public.imports SET state='failed',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2",[s.tenantId,j.import_id]);
 }
 return Object.freeze({
  async claim(){return tx(async s=>{
   const j=await one(s,`SELECT j.* FROM public.jobs j JOIN public.import_uploads u ON u.tenant_id=j.tenant_id AND u.job_id=j.id WHERE j.tenant_id=$1 AND (u.user_id=$2 OR $3::boolean) AND j.type='import' AND j.cancel_requested_at IS NULL AND j.next_attempt_at<=clock_timestamp() AND (j.state='queued' OR j.state='running' AND j.lease_until<=clock_timestamp()) ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,[s.tenantId,s.userId,await delegated(s)]);
   if(!j)return null;
   if(j.deadline&&new Date(j.deadline)<=new Date()){await terminal(s,j,'DEADLINE');return null;}
   if(j.failure_count>=Math.min(j.max_attempts,4)){await terminal(s,j,'ATTEMPTS_EXHAUSTED');return null;}
   if(!await actorAllowed(s,j)){await terminal(s,j,'ACTOR_REVOKED');return null;}
   const owner=await owned(s,j.id);if(owner.connection_status!=='active'){await terminal(s,j,'CONNECTION_REVOKED');return null;}
   const claimed=await one(s,"UPDATE public.jobs SET state='running',fencing_token=fencing_token+1,lease_owner=$3,lease_until=clock_timestamp()+$4*interval '1 millisecond',deadline=coalesce(deadline,clock_timestamp()+$5*interval '1 millisecond'),updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2 RETURNING *",[s.tenantId,j.id,randomUUID(),leaseMs,deadlineMs]);
   await s.query("UPDATE public.attempts SET state='uncertain',finished_at=clock_timestamp(),error_code='LEASE_EXPIRED' WHERE tenant_id=$1 AND job_id=$2 AND state='running'",[s.tenantId,j.id]);
   await s.query("INSERT INTO public.attempts(tenant_id,job_id,state,attempt_number,fencing_token) VALUES($1,$2,'running',$3::integer,$3::bigint)",[s.tenantId,j.id,claimed.fencing_token]);
   await s.query("UPDATE public.outbox SET state='claimed',fencing_token=$3,lease_until=$4 WHERE tenant_id=$1 AND job_id=$2",[s.tenantId,j.id,claimed.fencing_token,claimed.lease_until]);
   await s.query("UPDATE public.imports SET state='running',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2",[s.tenantId,j.import_id]);return claimed;
  });},
  async renew(j){return tx(async s=>{await fence(s,j);await s.query("UPDATE public.jobs SET lease_until=clock_timestamp()+$3*interval '1 millisecond' WHERE tenant_id=$1 AND id=$2",[s.tenantId,j.id,leaseMs]);await s.query("INSERT INTO public.audit_events(tenant_id,actor,action,resource,reason,trace_id) VALUES($1,$2,'consumer_heartbeat','ingestion','alive',$3)",[s.tenantId,s.userId,randomUUID()]);});},
  async source(j){return tx(async s=>{await fence(s,j);return one(s,'SELECT i.*,u.size,u.content_type,u.user_id,c.source,c.account_id FROM public.imports i JOIN public.import_uploads u ON u.tenant_id=i.tenant_id AND u.import_id=i.id JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id WHERE i.tenant_id=$1 AND i.id=$2',[s.tenantId,j.import_id]);});},
  async checkpoint(j){return tx(async s=>{await fence(s,j);return (await one(s,"SELECT checkpoint FROM public.checkpoints WHERE tenant_id=$1 AND job_id=$2 AND stage='ingestion'",[s.tenantId,j.id]))?.checkpoint??null;});},
  async commitChunk(j,{records,checkpoint,done}){return tx(async s=>{
   await fence(s,j);
   const prior=(await one(s,"SELECT checkpoint FROM public.checkpoints WHERE tenant_id=$1 AND job_id=$2 AND stage='ingestion'",[s.tenantId,j.id]))?.checkpoint;
   const chunkHash=contentHash({records,checkpoint,done});
   if(prior?.offset===checkpoint.offset){if(prior.chunkHash!==chunkHash)fail('CHUNK_REPLAY_CONFLICT');return;}
   if(prior?.done||checkpoint.offset!==(prior?.offset??0)+records.length||prior&&prior.scope!==checkpoint.scope)fail('CHECKPOINT_CONFLICT');
   for(const record of records){if(record.validation_error){if(!rejectRecord)fail('REJECTION_PERSISTENCE_REQUIRED',503);await rejectRecord(s,{importId:j.import_id,record,error:{code:record.validation_error,field:record.validation_field??null,line:record.row_ref}});}else await persistCanonical(s,{importId:j.import_id,record});}
   await fence(s,j); // Clock, saved principal, membership and connection checked before publication.
   await s.query("INSERT INTO public.checkpoints(tenant_id,job_id,stage,fencing_token,checkpoint) VALUES($1,$2,'ingestion',$3,$4) ON CONFLICT(tenant_id,job_id,stage) DO UPDATE SET checkpoint=excluded.checkpoint,fencing_token=excluded.fencing_token,updated_at=clock_timestamp()",[s.tenantId,j.id,j.fencing_token,JSON.stringify({...checkpoint,chunkHash,done})]);
   await s.query('UPDATE public.jobs SET last_progress_at=clock_timestamp(),updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2',[s.tenantId,j.id]);
  });},
  async ack(j){return tx(async s=>{await fence(s,j);const cp=await one(s,"SELECT checkpoint FROM public.checkpoints WHERE tenant_id=$1 AND job_id=$2 AND stage='ingestion'",[s.tenantId,j.id]);if(!cp?.checkpoint.done)fail('INCOMPLETE');
   const i=await one(s,'SELECT * FROM public.imports WHERE tenant_id=$1 AND id=$2',[s.tenantId,j.import_id]);if(Number(i.pending)!==0||Number(i.total)!==cp.checkpoint.offset)fail('COUNTER_MISMATCH');
   const state=Number(i.rejected)?'partial':'succeeded';
   await s.query('UPDATE public.imports SET state=$3,updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2',[s.tenantId,j.import_id,state]);
   await s.query('UPDATE public.jobs SET state=$3,lease_until=NULL,updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2',[s.tenantId,j.id,state]);
   await s.query("UPDATE public.attempts SET state='succeeded',finished_at=clock_timestamp() WHERE tenant_id=$1 AND job_id=$2 AND fencing_token=$3",[s.tenantId,j.id,j.fencing_token]);
   await s.query("UPDATE public.outbox SET state='published',lease_until=NULL,published_at=clock_timestamp() WHERE tenant_id=$1 AND job_id=$2",[s.tenantId,j.id]);return {job_id:j.id,state,stage:'ingestion',analysis_complete:false};
  });},
  async fail(j,error){return tx(async s=>{const current=await fence(s,j,{deadline:false,authorization:false});if(!await actorAllowed(s,current)){await terminal(s,current,'ACTOR_REVOKED');return {state:'failed'};}const count=current.failure_count+1;
   await s.query('UPDATE public.jobs SET failure_count=$3 WHERE tenant_id=$1 AND id=$2',[s.tenantId,j.id,count]);
   const delay=retryDelay(count,error),expired=new Date(current.deadline).getTime()<=Date.now()+(delay??0);
   const reason=error.status===401?'AUTHENTICATION_FAILED':error.status===403?'AUTHORIZATION_FAILED':error.code==='DEADLINE'||expired?'DEADLINE':'SOURCE_FAILED';
   await s.query("UPDATE public.attempts SET state='failed',finished_at=clock_timestamp(),error_code=$4 WHERE tenant_id=$1 AND job_id=$2 AND fencing_token=$3",[s.tenantId,j.id,j.fencing_token,reason]);
   if(delay===null||expired){await terminal(s,current,reason);return {state:'failed'};}
   await s.query("UPDATE public.jobs SET state='queued',lease_until=NULL,next_attempt_at=clock_timestamp()+$3*interval '1 millisecond',updated_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2",[s.tenantId,j.id,delay]);
   await s.query("UPDATE public.outbox SET state='pending',lease_until=NULL,next_attempt_at=clock_timestamp()+$3*interval '1 millisecond' WHERE tenant_id=$1 AND job_id=$2",[s.tenantId,j.id,delay]);return {state:'queued',delay};
  });},
  async release(j){return tx(async s=>{await fence(s,j);await s.query("UPDATE public.jobs SET state='queued',lease_until=NULL WHERE tenant_id=$1 AND id=$2",[s.tenantId,j.id]);await s.query("UPDATE public.attempts SET state='succeeded',finished_at=clock_timestamp() WHERE tenant_id=$1 AND job_id=$2 AND fencing_token=$3",[s.tenantId,j.id,j.fencing_token]);return {state:'queued',job_id:j.id};});},
  async setup(userId,enabled){return database.transaction('configure',async s=>{if(!/^[0-9a-f-]{36}$/i.test(userId)||typeof enabled!=='boolean')fail('INVALID_WORKER',400);await s.query('INSERT INTO public.worker_delegations(tenant_id,user_id,enabled) VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id) DO UPDATE SET enabled=excluded.enabled',[s.tenantId,userId,enabled]);return {enabled};});},
  async replay(id){return tx(async s=>{if(s.role!=='owner')fail('OWNER_REQUIRED',403);const j=await owned(s,id,true);if(!['failed','cancelled'].includes(j.state))fail('REPLAY_STATE');await s.query("UPDATE public.jobs SET state='queued',failure_count=0,cancel_requested_at=NULL,deadline=NULL,lease_until=NULL,fencing_token=fencing_token+1,next_attempt_at=clock_timestamp() WHERE tenant_id=$1 AND id=$2",[s.tenantId,id]);await s.query("UPDATE public.outbox SET state='pending',lease_until=NULL,next_attempt_at=clock_timestamp() WHERE tenant_id=$1 AND job_id=$2",[s.tenantId,id]);await s.query("UPDATE public.imports SET state='queued' WHERE tenant_id=$1 AND id=$2",[s.tenantId,j.import_id]);return {id,state:'queued'};});},
  async cancel(id){return tx(async s=>{const j=await owned(s,id,true);if(['succeeded','partial','failed','cancelled'].includes(j.state))return {id,state:j.state};await s.query("UPDATE public.jobs SET state='cancelled',cancel_requested_at=clock_timestamp(),fencing_token=fencing_token+1,lease_until=NULL WHERE tenant_id=$1 AND id=$2",[s.tenantId,id]);await s.query("UPDATE public.imports SET state='cancelled' WHERE tenant_id=$1 AND id=$2",[s.tenantId,j.import_id]);await s.query("UPDATE public.outbox SET state='cancelled',lease_until=NULL WHERE tenant_id=$1 AND job_id=$2",[s.tenantId,id]);await s.query("UPDATE public.attempts SET state='cancelled',finished_at=clock_timestamp() WHERE tenant_id=$1 AND job_id=$2 AND state='running'",[s.tenantId,id]);return {id,state:'cancelled'};});},
  async get(id){return read(async s=>{const j=await owned(s,id);const i=await one(s,'SELECT total,accepted,rejected,duplicates,pending FROM public.imports WHERE tenant_id=$1 AND id=$2',[s.tenantId,j.import_id]);const cp=await one(s,"SELECT checkpoint FROM public.checkpoints WHERE tenant_id=$1 AND job_id=$2 AND stage='ingestion'",[s.tenantId,id]);return {id:j.id,import_id:j.import_id,state:j.state,stage:'ingestion',analysis_complete:false,failure_count:j.failure_count,last_progress_at:j.last_progress_at,checkpoint:cp?.checkpoint.offset??0,counters:i,can_select:s.role==='owner',money:null};});},
  async errors(id){return read(async s=>{const j=await owned(s,id);return (await s.query("SELECT row_ref AS line,error_code AS code,provenance->'result'->>'field' AS field FROM public.import_rows WHERE tenant_id=$1 AND import_id=$2 AND state='rejected' ORDER BY id",[s.tenantId,j.import_id])).rows;});},
  async canonicals(id){return read(async s=>{const j=await owned(s,id);return (await s.query("SELECT DISTINCT h.id,h.state,h.version,h.selected_revision_id FROM public.import_rows r JOIN public.source_heads h ON h.tenant_id=r.tenant_id AND h.id::text=r.provenance->'result'->>'canonical_id' WHERE r.tenant_id=$1 AND r.import_id=$2 ORDER BY h.id LIMIT 500",[s.tenantId,j.import_id])).rows;});},
  async history(id,canonicalId,selection){return database.transaction(selection?'import':'read',async s=>{
   const j=await owned(s,id);if(s.role!=='owner')fail('OWNER_REQUIRED',403);
   const visible=await one(s,"SELECT id FROM public.import_rows WHERE tenant_id=$1 AND import_id=$2 AND provenance->'result'->>'canonical_id'=$3 LIMIT 1",[s.tenantId,j.import_id,canonicalId]);
   if(!visible)fail('CANONICAL_NOT_FOUND',404);
   let selected;if(selection){selected=await selectCanonicalRevision(s,{canonicalId,...selection});if(selected.status==='conflict')return selected;}
   const history=await readCanonicalHistory(s,{canonicalId});if(!history)fail('CANONICAL_NOT_FOUND',404);
   // Safe snapshot projection: no raw cells, text, names, arbitrary provenance or external IDs.
   const allowed=['id','customer_id','product_id','order_id','conversation_id','amount_minor','currency','occurred_at','role'];
   const revisions=history.revisions.map(r=>({id:r.id,hash:r.content_hash,snapshot:r.snapshot.map(x=>({table:x.table,row:Object.fromEntries(Object.entries(x.row).filter(([k])=>allowed.includes(k)))}))}));
   return {head:{id:history.head.id,state:history.head.state,version:Number(history.head.version),selected_revision_id:history.head.selected_revision_id},selected_hash:revisions.find(r=>r.id===history.head.selected_revision_id)?.hash??null,revisions};
  });},
  async heartbeat(){return tx(async s=>{await delegated(s);await s.query("INSERT INTO public.audit_events(tenant_id,actor,action,resource,reason,trace_id) VALUES($1,$2,'consumer_heartbeat','ingestion','alive',$3)",[s.tenantId,s.userId,randomUUID()]);});},
  async health(){return read(async s=>{
   const r=await one(s,`SELECT extract(epoch from (clock_timestamp()-min(j.created_at) FILTER(WHERE j.state='queued')))*1000 AS queue_age, count(*) FILTER(WHERE j.state='running' AND j.lease_until<clock_timestamp())::int AS expired, extract(epoch from (clock_timestamp()-min(coalesce(j.last_progress_at,j.created_at)) FILTER(WHERE j.state='running')))*1000 AS progress_age FROM public.jobs j JOIN public.import_uploads u ON u.tenant_id=j.tenant_id AND u.job_id=j.id WHERE j.tenant_id=$1 AND (u.user_id=$2 OR $3::boolean) AND j.type='import'`,[s.tenantId,s.userId,s.role==='owner']);
   const beat=await one(s,"SELECT extract(epoch from(clock_timestamp()-max(occurred_at)))*1000 AS age FROM public.audit_events WHERE tenant_id=$1 AND action='consumer_heartbeat' AND (actor=$2 OR EXISTS(SELECT 1 FROM public.worker_delegations d WHERE d.tenant_id=$1 AND d.user_id::text=actor AND d.enabled))",[s.tenantId,s.userId]);
   const reasons=[];if(beat.age===null||Number(beat.age)>heartbeatMs)reasons.push('NO_HEARTBEAT');if(Number(r.queue_age)>queueMs)reasons.push('OLDEST_QUEUE');if(r.expired)reasons.push('EXPIRED_LEASE');if(Number(r.progress_age)>queueMs)reasons.push('NO_PROGRESS');return {healthy:!reasons.length,reasons,heartbeat_age_ms:beat.age,oldest_queued_ms:r.queue_age,last_progress_age_ms:r.progress_age,expired_leases:r.expired};
  });}
 });
}
