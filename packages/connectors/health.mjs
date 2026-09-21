/** Server-only summaries; current SQL membership is checked on every operation. */
import {randomUUID} from 'node:crypto';
import {contentHash} from '../ingestion/index.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function safeHealthError(error){
 if(error?.code==='RECONNECT_REQUIRED'||error?.status===401||error?.status===403)return {state:'reconnect_required',code:'RECONNECT_REQUIRED'};
 return {state:'stale',code:error?.code==='TIMEOUT'?'TIMEOUT':'SYNC_FAILED'};
}
const iso=value=>value==null?null:new Date(value).toISOString();
export function healthView(r,now=Date.now()){
 const revoked=r.health_state==='reconnect_required'||r.status==='reconnect_required';
 const success=iso(r.health_last_success),attempt=iso(r.last_attempt);
 return {id:r.id,source:r.source,accountId:r.account_id,connectionStatus:r.status,state:revoked?'reconnect_required':r.health_state??'unknown',lastAttempt:attempt,lastSuccess:success,
 watermark:r.checkpoint_hash?{kind:'checkpoint_hash',value:r.checkpoint_hash}:null,
 coverage:r.observed_unique==null?null:{observed:Number(r.observed_unique),accepted:Number(r.accepted_unique),rejected:Number(r.rejected_unique)},
 lagSeconds:success===null?null:Math.max(0,Math.floor((now-Date.parse(success))/1000)),lagBasis:'time_since_success',
 permissions:revoked?'revoked':r.provider_permissions??'unknown',errorCode:r.error_code??null,
 reconnect:revoked?{ownerRequired:true,canRequest:r.can_request===true,attemptId:r.attempt_id??null,steps:['El propietario debe rotar las credenciales de la misma cuenta autorizada en la configuración del servidor.','Comprueba los permisos mínimos de lectura de conversaciones, mensajes y autores del conector.','Después, permite un nuevo intento. Los permisos sólo se consideran comprobados cuando responde el proveedor; aquí no se generan ni reciben tokens.']}:null};
}
export function createHealthRepository({database}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function')fail('HEALTH_DATABASE_REQUIRED');
 const api={
  async list(){return database.transaction('read',async scope=>{
   const rows=(await scope.query(`SELECT c.id,c.source,c.account_id,c.status,h.state AS health_state,h.attempt_id,h.last_attempt,h.last_success AS health_last_success,h.checkpoint_hash,h.observed_unique,h.accepted_unique,h.rejected_unique,h.provider_permissions,h.error_code FROM public.connections c LEFT JOIN public.connection_health h ON h.tenant_id=c.tenant_id AND h.connection_id=c.id WHERE c.tenant_id=$1 ORDER BY c.source,c.account_id,c.id`,[scope.tenantId])).rows;
   return rows.map(row=>healthView({...row,can_request:scope.role==='owner'}));
  });},
  async beginAttempt({connectionId,syncId,workerId,fence}){return database.transaction('import',async scope=>{
   const connection=(await scope.query("SELECT id,status FROM public.connections WHERE tenant_id=$1 AND id=$2 FOR SHARE",[scope.tenantId,connectionId])).rows[0];if(!connection||connection.status!=='active')fail('SYNC_CONNECTION_UNAVAILABLE');
   const owned=(await scope.query('SELECT id FROM public.sync_cursors WHERE tenant_id=$1 AND id=$2 AND connection_id=$3 AND worker_id=$4 AND fence=$5 AND lease_until>clock_timestamp()',[scope.tenantId,syncId,connectionId,workerId,fence])).rows[0];if(!owned)fail('SYNC_FENCE_LOST');
   const previous=(await scope.query('SELECT state,last_attempt,sync_id,sync_fence FROM public.connection_health WHERE tenant_id=$1 AND connection_id=$2 FOR UPDATE',[scope.tenantId,connectionId])).rows[0];
   if(previous?.state==='reconnect_required')fail('RECONNECT_REQUIRED');
   if(previous?.state==='running'&&(await scope.query('SELECT id FROM public.sync_cursors WHERE tenant_id=$1 AND id=$2 AND fence=$3 AND worker_id IS NOT NULL AND lease_until>clock_timestamp()',[scope.tenantId,previous.sync_id,previous.sync_fence])).rows.length)fail('SYNC_HEALTH_BUSY');
   const attemptId=randomUUID();
   await scope.query(`INSERT INTO public.connection_health(tenant_id,connection_id,attempt_id,actor_id,sync_id,sync_fence,state) VALUES($1,$2,$3,$4,$5,$6,'running') ON CONFLICT(tenant_id,connection_id) DO UPDATE SET attempt_id=excluded.attempt_id,actor_id=excluded.actor_id,sync_id=excluded.sync_id,sync_fence=excluded.sync_fence,state='running',last_attempt=clock_timestamp(),error_code=null`,[scope.tenantId,connectionId,attemptId,scope.userId,syncId,fence]);
   return {connectionId,attemptId};
  });},
  async recoverCompleted({syncId}){
   const pending=await database.transaction('import',async scope=>(await scope.query("SELECT h.connection_id,h.attempt_id FROM public.connection_health h JOIN public.sync_cursors s ON s.tenant_id=h.tenant_id AND s.id=h.sync_id AND s.fence=h.sync_fence WHERE h.tenant_id=$1 AND s.id=$2 AND s.done AND h.state='running'",[scope.tenantId,syncId])).rows[0]);
   if(pending)await api.finishAttempt({connectionId:pending.connection_id,attemptId:pending.attempt_id,syncId,outcome:'done'});
  },
  async requestRecheck({connectionId,expectedAttemptId,confirmedCredentialRotation}){
   if(confirmedCredentialRotation!==true)fail('23514');
   return database.transaction('configure',async scope=>{
    const result=await scope.query(`UPDATE public.connection_health SET actor_id=$4,state='stale',provider_permissions='unknown',error_code='RECONNECT_REQUESTED' WHERE tenant_id=$1 AND connection_id=$2 AND attempt_id=$3 AND state='reconnect_required'`,[scope.tenantId,connectionId,expectedAttemptId,scope.userId]);
    if(result.rowCount!==1)fail('23514');
    await scope.query(`UPDATE public.crm_sync_settings SET actor_id=$3,version=version+1,failure_count=0,error_code=null,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp() WHERE tenant_id=$1 AND connection_id=$2`,[scope.tenantId,connectionId,scope.userId]);
    return {state:'verification_pending'};
   });
  },
  async finishAttempt({connectionId,attemptId,syncId,outcome,error}){return database.transaction('import',async scope=>{
   const cursor=(await scope.query('SELECT id,import_id,done,checkpoint FROM public.sync_cursors WHERE tenant_id=$1 AND id=$2 AND connection_id=$3',[scope.tenantId,syncId,connectionId])).rows[0];if(!cursor)fail('HEALTH_SYNC_SCOPE');
   // Linked-v1 recovery is another processing attempt of the same raw source row.
   const counts=(await scope.query(`SELECT count(*) AS observed,count(*) FILTER(WHERE r.result->>'status' IN ('inserted','duplicate') OR EXISTS(SELECT 1 FROM public.import_rows i WHERE i.tenant_id=r.tenant_id AND i.import_id=r.import_id AND i.row_ref=r.row_ref||':linked-v1' AND i.state IN ('accepted','duplicate'))) AS accepted FROM public.sync_raw_objects r WHERE r.tenant_id=$1 AND r.sync_id=$2`,[scope.tenantId,syncId])).rows[0];
   const pages=(await scope.query('SELECT count(*) AS committed FROM public.sync_pages WHERE tenant_id=$1 AND sync_id=$2',[scope.tenantId,syncId])).rows[0];
   const observed=Number(counts.observed),accepted=Number(counts.accepted),observedPage=Number(pages.committed)>0;
   const complete=outcome==='done'&&cursor.done&&observed>0&&accepted===observed;
   const detail=error?safeHealthError(error):{state:complete?'healthy':'partial',code:complete?null:observed===0?'EMPTY_RESULT':accepted<observed?'COVERAGE_INCOMPLETE':'CONTINUATION'};
   const permissions=detail.state==='reconnect_required'?'revoked':observedPage?'available':null;
   const result=await scope.query(`UPDATE public.connection_health SET actor_id=$4,state=$5,error_code=$6,last_success=CASE WHEN $5='healthy' THEN last_attempt ELSE last_success END,checkpoint_hash=CASE WHEN $11 THEN $7 ELSE checkpoint_hash END,observed_unique=$8,accepted_unique=$9,rejected_unique=$10,provider_permissions=coalesce($12,provider_permissions) WHERE tenant_id=$1 AND connection_id=$2 AND attempt_id=$3 AND state='running'`,[scope.tenantId,connectionId,attemptId,scope.userId,detail.state,detail.code,cursor.checkpoint==null?null:contentHash(cursor.checkpoint),observedPage?observed:null,observedPage?accepted:null,observedPage?observed-accepted:null,observedPage,permissions]);
   if(result.rowCount!==1)fail('HEALTH_ATTEMPT_STALE');
  });}
 };
 return Object.freeze(api);
}
