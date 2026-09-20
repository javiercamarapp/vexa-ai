import {AccessError} from '../platform/src/session.ts';
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
const VERSION='f02-durable-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=x=>createHash('sha256').update(x).digest('hex');
const fail=(status,code)=>{throw new AccessError(status,code);};
const pick=(x,keys)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))fail(400,'invalid_input');};
async function body(request){if(Number(request.headers.get('content-length'))>8192)fail(413,'metadata_too_large');const reader=request.body?.getReader();if(!reader)fail(400,'invalid_json');let n=0,parts=[];while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>8192){await reader.cancel();fail(413,'metadata_too_large');}parts.push(r.value);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail(400,'invalid_json');}}
/** Trusted server ports: database=createDatabase(identity,SqlPool,selectedTenant).
 * storage uses the SAME authenticated session; no administrative SQL or token input.
 */
export function createImportHandler({database,storage,confirmationSecret}={}) {
 const token=r=>createHmac('sha256',confirmationSecret).update([r.tenant_id,r.import_id,r.user_id,r.request_hash,new Date(r.expires_at).toISOString()].join('\n')).digest('base64url');
 const connection=async(s,id)=>{const r=await s.query("SELECT id FROM public.connections WHERE tenant_id=$1 AND id=$2 AND status='active' AND source IN ('csv','xlsx')",[s.tenantId,id]);if(!r.rows.length)fail(404,'connection_not_found');};
 const get=async(s,id)=>{const r=await s.query('SELECT i.*,u.import_id,u.user_id,u.size,u.content_type,u.request_hash,u.expires_at,u.job_id FROM public.imports i JOIN public.import_uploads u ON u.import_id=i.id AND u.tenant_id=i.tenant_id WHERE i.tenant_id=$1 AND i.id=$2',[s.tenantId,id]);if(!r.rows.length)fail(404,'import_not_found');return r.rows[0];};
 return async request=>{
  const trace_id=randomUUID();
  const response=(status,data)=>Response.json({contract_version:VERSION,data,meta:{trace_id,state:data.state??data.import?.state}},{status,headers:{'Cache-Control':'private, no-store'}});
  try{
   if(!database?.transaction||!storage?.createUpload||!storage?.read||typeof confirmationSecret!=='string'||confirmationSecret.length<32)fail(503,'imports_configuration_required');
   const url=new URL(request.url),match=url.pathname.match(/^\/api\/imports(?:\/([0-9a-f-]+)(\/confirm)?)?$/i);
   if(!match||match[1]&&!uuid.test(match[1])||url.search)fail(404,'route_not_found');
   if(request.method==='GET'&&match[1]&&!match[2])return await database.transaction('read',async s=>{const r=await get(s,match[1]);return response(200,{import:{id:r.id,state:r.state,total:r.total,accepted:r.accepted,rejected:r.rejected,duplicates:r.duplicates,pending:r.pending,job_id:r.job_id}});});
   if(request.method!=='POST')fail(405,'method_not_allowed');
   const input=await body(request);
   if(!match[1]){
    pick(input,['connection_id','mapping_version','content_type','size','sha256']);
    const key=request.headers.get('idempotency-key');
    if(!uuid.test(input.connection_id)||typeof input.mapping_version!=='string'||!input.mapping_version.length||input.mapping_version.length>128||!['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(input.content_type)||!Number.isSafeInteger(input.size)||input.size<1||input.size>20971520||!/^([0-9a-f]{64})$/.test(input.sha256)||!key||key.length>200)fail(400,'invalid_metadata');
    const fingerprint=hash(JSON.stringify([input.connection_id,input.mapping_version,input.content_type,input.size,input.sha256]));
    // Unique insert and row lock serialize concurrent reservations. No Storage side effect until commit.
    const r=await database.transaction('import',async s=>{
     await connection(s,input.connection_id);
     const id=randomUUID(),path=`${s.tenantId}/imports/${id}/original`;
     await s.query("INSERT INTO public.imports(id,tenant_id,connection_id,file_hash,mapping_version,idempotency_key,object_path) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING",[id,s.tenantId,input.connection_id,input.sha256,input.mapping_version,key,path]);
     const existing=(await s.query('SELECT id FROM public.imports WHERE tenant_id=$1 AND idempotency_key=$2 FOR UPDATE',[s.tenantId,key])).rows[0];
     if(existing.id===id)await s.query('INSERT INTO public.import_uploads(tenant_id,import_id,user_id,size,content_type,request_hash) VALUES($1,$2,$3,$4,$5,$6)',[s.tenantId,id,s.userId,input.size,input.content_type,fingerprint]);
     const row=await get(s,existing.id);
     if(row.user_id!==s.userId||row.request_hash!==fingerprint)fail(409,'idempotency_conflict');
     return row;
    });
    // Revalidate after reservation commit, including failures/retries in Storage signing.
    return await database.transaction('import',async s=>{
     const current=await get(s,r.id);await connection(s,current.connection_id);
     if(current.user_id!==s.userId)fail(404,'import_not_found');
     if(current.job_id)return response(200,{import_id:current.id,job_id:current.job_id,state:current.state});
     if(new Date(current.expires_at)<=new Date())fail(409,'reservation_expired');
     const capability=await storage.createUpload(s,current);
     return response(201,{import_id:current.id,state:current.state,object_path:current.object_path,upload_url:capability.url,upload_token:token(current),expires_at:new Date(current.expires_at).toISOString()});
    });
   }
   if(!match[2])fail(404,'route_not_found');
   pick(input,['upload_token','sha256','mapping_version']);
   const prepared=await database.transaction('import',async s=>{
    const r=await get(s,match[1]);if(r.user_id!==s.userId)fail(404,'import_not_found');await connection(s,r.connection_id);
    if(typeof input.upload_token!=='string'||input.upload_token.length!==43||!timingSafeEqual(Buffer.from(input.upload_token),Buffer.from(token(r))))fail(403,'upload_capability_invalid');
    if(input.sha256!==r.file_hash||input.mapping_version!==r.mapping_version)fail(409,'confirmation_conflict');
    if(r.job_id)return {row:r,replay:true};
    if(new Date(r.expires_at)<=new Date())fail(409,'reservation_expired');
    const owner=(await s.query("SELECT owner_id FROM storage.objects WHERE bucket_id='vexa-private' AND name=$1",[r.object_path])).rows[0];
    if(!owner||owner.owner_id!==s.userId)fail(422,'object_owner_invalid');
    return {row:r,scope:{tenantId:s.tenantId,userId:s.userId}};
   });
   if(!prepared.replay){
    const bytes=await storage.read(prepared.scope,prepared.row);
    if(!(bytes instanceof Uint8Array)||bytes.byteLength!==Number(prepared.row.size)||hash(bytes)!==prepared.row.file_hash)fail(422,'object_bytes_invalid');
   }
   // Auth/session/membership/connection revalidated after download. RPC locks and commits all three effects.
   return await database.transaction('import',async s=>{
    const r=await get(s,match[1]);if(r.user_id!==s.userId)fail(404,'import_not_found');await connection(s,r.connection_id);
    const result=await s.query('SELECT * FROM public.confirm_import($1,$2,$3,$4)',[r.id,input.sha256,Number(r.size),input.mapping_version]);
    return response(202,result.rows[0]);
   });
  }catch(error){
   const status=[400,401,403,404,405,409,413,422,503].includes(error?.status)?error.status:503;
   const code=status===503?'imports_unavailable':error.code??'imports_rejected';
   return Response.json({contract_version:VERSION,error:{code,message:status===503?'Configurar y comprobar PostgreSQL, Storage y el secreto de confirmación en el servidor.':'No se pudo completar la importación.',retryable:status===503},meta:{trace_id}},{status,headers:{'Cache-Control':'private, no-store'}});
  }
 };
}
