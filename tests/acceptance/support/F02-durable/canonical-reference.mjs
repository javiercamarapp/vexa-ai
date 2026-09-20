// SYNTHETIC ORACLE SERVER. Not product, not an acceptance substitute.
// Actual Auth, Storage bytes and PostgreSQL transactions; no canned passed result.
import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {q,hash} from './runtime.mjs';
export function createImportHandler({database,AccessError,storage,now,signingSecret},{defect=null}={}){
 const secret=defect==='volatile-secret'?randomUUID():signingSecret;
 const sign=p=>{const raw=Buffer.from(JSON.stringify(p)).toString('base64url');return raw+'.'+createHmac('sha256',secret).update(raw).digest('hex');};
 const verify=t=>{const [raw,sig]=String(t).split('.');const expected=createHmac('sha256',secret).update(raw??'').digest('hex');if(sig?.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))throw new AccessError(403,'invalid_upload_token');return JSON.parse(Buffer.from(raw,'base64url'));};

 const reject=(status,code)=>{throw new AccessError(status,code);};
 const reply=(data,status=200)=>Response.json({contract_version:'f02-durable-v1',data,meta:{trace_id:randomUUID(),state:data.state??data.import?.state}},{status});
 return async request=>{try{
  return await database(request).transaction(request.method==='GET'?'read':'import',async scope=>{
  const sql=async statement=>{const r=await scope.query(statement);return r.rows.length?JSON.stringify(Object.values(r.rows[0])[0]):'';};
  const read=async statement=>JSON.parse(await sql(statement));
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  const tenant=scope.tenantId,user={id:scope.userId};
  const url=new URL(request.url),id=url.pathname.match(/^\/api\/imports\/([0-9a-f-]{36})(?:\/confirm)?$/)?.[1];
  if(request.method==='GET'&&id){const rows=await read(`SELECT coalesce(json_agg(i),'[]') FROM imports i WHERE tenant_id=${q(tenant)} AND id=${q(id)}`);if(!rows.length)reject(404,'import_not_found');return reply({import:rows[0]});}
  if(request.method!=='POST')reject(404,'not_found');
  let b;try{b=await request.json();}catch{reject(400,'invalid_body');}if(!b||typeof b!=='object'||Array.isArray(b))reject(400,'invalid_body');
  if(['tenant_id','bucket','object_path','key'].some(k=>k in b))reject(400,'unsupported_field');
  if(url.pathname==='/api/imports'){
   const key=request.headers.get('idempotency-key');if(!key||!Number.isSafeInteger(b.size)||b.size<1||!/^\w{64}$/.test(b.sha256??'')||b.content_type!=='text/csv')reject(400,'invalid_metadata');
   const c=await read(`SELECT coalesce(json_agg(c),'[]') FROM connections c WHERE id::text=${q(b.connection_id)} AND tenant_id=${q(tenant)} AND status='active'`);if(!c.length)reject(404,'connection_not_found');
   const newId=randomUUID(),object=`${tenant}/${newId}.csv`;
   const row=(await read(`WITH inserted AS (INSERT INTO imports(id,tenant_id,connection_id,file_hash,mapping_version,idempotency_key,object_path,provenance) VALUES (${q(newId)},${q(tenant)},${q(b.connection_id)},${q(b.sha256)},${q(b.mapping_version)},${q(key)},${q(object)},${q(JSON.stringify({size:b.size,expires_at:now()+30000,actor_id:user.id}))}::jsonb) ON CONFLICT (tenant_id,idempotency_key) DO UPDATE SET idempotency_key=excluded.idempotency_key RETURNING *) SELECT json_agg(inserted) FROM inserted`))[0];
   if(row.file_hash!==b.sha256||row.provenance.size!==b.size||(defect!=='mapping'&&row.mapping_version!==b.mapping_version)||row.connection_id!==b.connection_id)reject(409,'idempotency_conflict');
   if(row.state!=='reserved')return reply({import_id:row.id,state:row.state},201);
   const signed=await storage('/object/upload/sign/vexa-private/'+row.object_path,token,{method:'POST',body:{}});
   if(signed.status!==200)reject(503,'storage_unavailable');
   const upload=signed.data; // No simulated upload; returned URL is Storage's own signed capability.
   return reply({import_id:row.id,state:row.state,object_path:row.object_path,upload_url:upload.url,upload_token:sign({id:row.id,tenant,exp:row.provenance.expires_at}),expires_at:row.provenance.expires_at},201);
  }
  if(id&&url.pathname.endsWith('/confirm')){
   const rows=await read(`SELECT coalesce(json_agg(i),'[]') FROM imports i WHERE id=${q(id)} AND tenant_id=${q(tenant)}`);if(!rows.length)reject(404,'import_not_found');const row=rows[0];
   if(defect!=='owner'&&row.provenance.actor_id!==user.id)reject(404,'import_not_found');
   if(defect!=='mapping'&&row.mapping_version!==b.mapping_version)reject(409,'mapping_conflict');
   const cap=verify(b.upload_token);if(cap.id!==id||cap.tenant!==tenant)reject(403,'invalid_upload_token');if(defect!=='token-expiry'&&cap.exp<=now())reject(403,'upload_token_expired');
   const object=await storage('/object/authenticated/vexa-private/'+row.object_path,token);
   if(object.status!==200)reject(422,'object_unavailable');
   if(defect!=='hash'&&(hash(Buffer.from(object.text))!==row.file_hash||b.sha256!==row.file_hash))reject(422,'hash_mismatch');
   if(defect!=='size'&&Buffer.byteLength(object.text)!==row.provenance.size)reject(422,'size_mismatch');
   const job=randomUUID();
   const update=`UPDATE imports SET state='queued' WHERE id=${q(id)} AND tenant_id=${q(tenant)}`;
   if(defect==='atomic'){await sql(update);await scope.query('COMMIT');await scope.query('BEGIN');await scope.query('SET LOCAL ROLE vexa_backend');await scope.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('vexa.tenant_id',$2,true),set_config('vexa.action','import',true)",[scope.userId,scope.tenantId]);}
   await sql(`SELECT id FROM imports WHERE id=${q(id)} FOR UPDATE; ${update}; INSERT INTO jobs(id,tenant_id,import_id,type,input_ref,input_hash,version,max_attempts) VALUES (${q(job)},${q(tenant)},${q(id)},'csv',${q(row.object_path)},${q(defect==='duplicate'?randomUUID():hash(Buffer.from(id)))},'f02-durable-v1',4) ON CONFLICT (tenant_id,type,input_hash,version) DO NOTHING; INSERT INTO outbox(tenant_id,job_id,input_ref,idempotency_key) SELECT tenant_id,id,input_ref,${q(row.idempotency_key)} FROM jobs WHERE tenant_id=${q(tenant)} AND import_id=${q(id)} ON CONFLICT (tenant_id,topic,idempotency_key) DO NOTHING;`);
   const jobs=await read(`SELECT json_agg(j) FROM jobs j WHERE tenant_id=${q(tenant)} AND import_id=${q(id)}`);
   return reply({import_id:id,job_id:jobs[0].id,state:'queued'},202);
  }
  reject(404,'not_found');
  });
 }catch(e){return Response.json({error:{code:e.code??'imports_unavailable',message:'Import request failed',retryable:(e.status??503)>=500},meta:{trace_id:randomUUID()}},{status:e.status??503});}};
}

// Explicit SYNTHETIC maintenance oracle; product may bind its own maintenance entry.
export async function reconcileExpired(ports,request,{defect}={}){
 return ports.database(request).transaction('import',async scope=>{
  const r=await scope.query("UPDATE imports SET provenance=provenance || jsonb_build_object('reservation_expired',true), state=$3 WHERE tenant_id=$1 AND state='reserved' AND (provenance->>'expires_at')::bigint<=$2 RETURNING id",[scope.tenantId,ports.now(),defect==='queued'?'queued':'reserved']);
  return r.rows.map(x=>x.id);
 });
}
