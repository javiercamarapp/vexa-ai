import {previewImport,inspectImport,canonicalMapping,exportRowErrors} from '../ingestion/mapping.mjs';
import {AccessError} from '../platform/src/session.ts';
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
const VERSION='f02-durable-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=x=>createHash('sha256').update(x).digest('hex');
const fail=(status,code)=>{throw new AccessError(status,code);};
const domain=fn=>{try{return fn();}catch(e){if(e?.name==='IngestionError')fail(422,e.code);throw e;}};
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
   const url=new URL(request.url),match=url.pathname.match(/^\/api\/imports(?:\/([0-9a-f-]+)(\/(?:confirm|preview|mapping|errors\.csv))?)?$/i);
   if(!match||match[1]&&!uuid.test(match[1])||(url.search&&(request.method!=='GET'||(match[1]?Boolean(match[2])||[...url.searchParams.keys()].some(k=>k!=='sheet'):[...url.searchParams.keys()].some(k=>!['offset','connection_offset'].includes(k))))))fail(404,'route_not_found');
   const owned=async(s,id)=>{const r=await get(s,id);if(r.user_id!==s.userId)fail(404,'import_not_found');return r;};
   const verified=async(s,r)=>{await connection(s,r.connection_id);const owner=(await s.query("SELECT owner_id FROM storage.objects WHERE bucket_id='vexa-private' AND name=$1",[r.object_path])).rows[0];if(!owner||owner.owner_id!==s.userId)fail(422,'object_unavailable');const bytes=await storage.read({tenantId:s.tenantId,userId:s.userId},r);if(!(bytes instanceof Uint8Array)||bytes.byteLength!==Number(r.size)||hash(bytes)!==r.file_hash)fail(422,'object_bytes_invalid');return bytes;};
   const preview=(bytes,r,mapping)=>domain(()=>previewImport(bytes,{contentType:r.content_type,mapping,context:{tenant_id:r.tenant_id,connection_id:r.connection_id,source:'csv',source_account_id:r.connection_id},observedAt:new Date().toISOString()}));
   if(request.method==='GET'&&!match[1])return await database.transaction('read',async s=>{
    const offset=Number(url.searchParams.get('offset')??0),connectionOffset=Number(url.searchParams.get('connection_offset')??0);if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||!Number.isSafeInteger(connectionOffset)||connectionOffset<0||connectionOffset>1000000)fail(400,'invalid_pagination');
    const connections=(await s.query("SELECT id,source,account_id FROM public.connections WHERE tenant_id=$1 AND status='active' AND source IN ('csv','xlsx') ORDER BY id LIMIT 101 OFFSET $2",[s.tenantId,connectionOffset])).rows;
    const reservations=(await s.query('SELECT i.id,i.state,i.mapping_version,i.created_at FROM public.imports i JOIN public.import_uploads u ON u.import_id=i.id AND u.tenant_id=i.tenant_id WHERE i.tenant_id=$1 AND u.user_id=$2 ORDER BY i.created_at DESC,i.id LIMIT 51 OFFSET $3',[s.tenantId,s.userId,offset])).rows;
    return response(200,{connections:connections.slice(0,100),reservations:reservations.slice(0,50),next_offset:reservations.length>50?offset+50:null,next_connection_offset:connections.length>100?connectionOffset+100:null,has_more:reservations.length>50,connections_has_more:connections.length>100});
   });
   if(request.method==='GET'&&match[1])return await database.transaction('read',async s=>{
    const r=await owned(s,match[1]);
    if(match[2]==='/errors.csv'){if(!r.provenance?.mapping)fail(409,'mapping_required');const result=preview(await verified(s,r),r,r.provenance.mapping);return new Response(exportRowErrors(result.errors),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="row-errors.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
    if(match[2])fail(405,'method_not_allowed');
    const data={import:{id:r.id,state:r.state,total:r.total,accepted:r.accepted,rejected:r.rejected,duplicates:r.duplicates,pending:r.pending,job_id:r.job_id,mapping_version:r.mapping_version,file_hash:r.file_hash,expires_at:r.expires_at},mapping:r.provenance?.mapping??null,mapping_history:r.provenance?.mapping_history??[]};
    const object=(await s.query("SELECT owner_id FROM storage.objects WHERE bucket_id='vexa-private' AND name=$1",[r.object_path])).rows[0];
    if(!object)return response(200,{...data,preview_state:'awaiting_upload'});
    const bytes=await verified(s,r);
    if(data.mapping&&!url.searchParams.has('sheet'))return response(200,{...data,preview:preview(bytes,r,data.mapping),preview_state:'ready',upload_token:r.job_id?undefined:token(r)});
    try{const info=inspectImport(bytes,{contentType:r.content_type,sheet:url.searchParams.get('sheet'),discover:true});return response(200,{...data,headers:info.headers,sheets:info.sheets,preview_state:info.headers.length?'mapping_required':'sheet_required'});}catch(e){if(e.code==='SHEET_REQUIRED')return response(200,{...data,preview_state:'sheet_required'});if(e?.name==='IngestionError')fail(422,e.code);throw e;}
   });
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
   if(match[2]==='/preview'||match[2]==='/mapping'){
    const save=match[2]==='/mapping';pick(input,save?['mapping','expected_version']:['mapping']);
    return await database.transaction('import',async s=>{
     await s.query('SELECT id FROM public.imports WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[s.tenantId,match[1]]);
     const r=await owned(s,match[1]);if(r.job_id||r.state!=='reserved')fail(409,'mapping_immutable_new_import_required');if(new Date(r.expires_at)<=new Date())fail(409,'reservation_expired');
     const mapping=domain(()=>canonicalMapping(input.mapping)),result=preview(await verified(s,r),r,mapping);
     if(!save)return response(200,result);
     if(typeof input.expected_version!=='string')fail(400,'expected_version_required');
     const previous=r.provenance??{};
     if(input.expected_version!==r.mapping_version){const last=previous.mapping_history?.at(-1);if(result.mapping_version!==r.mapping_version||last?.previous_version!==input.expected_version)fail(409,'mapping_version_conflict');return response(200,{...result,upload_token:token(r),mapping});}
     if(result.mapping_version!==r.mapping_version||!previous.mapping){
      const history=[...(previous.mapping_history??[]),{mapping_version:result.mapping_version,previous_version:r.mapping_version,mapping,confirmed_by:s.userId,confirmed_at:new Date().toISOString()}];
      if(history.length>100)fail(409,'mapping_history_limit');
      await s.query('UPDATE public.imports SET mapping_version=$3,provenance=$4::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2',[s.tenantId,r.id,result.mapping_version,JSON.stringify({...previous,mapping,mapping_history:history})]);
      const fingerprint=hash(JSON.stringify([r.connection_id,result.mapping_version,r.content_type,Number(r.size),r.file_hash]));
      await s.query('UPDATE public.import_uploads SET request_hash=$3 WHERE tenant_id=$1 AND import_id=$2',[s.tenantId,r.id,fingerprint]);
     }
     const current=await owned(s,r.id);return response(200,{...result,mapping,upload_token:token(current)});
    });
   }
   if(match[2]!=='/confirm')fail(404,'route_not_found');
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
    await s.query('SELECT id FROM public.imports WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[s.tenantId,match[1]]);
    const r=await get(s,match[1]);if(r.user_id!==s.userId)fail(404,'import_not_found');await connection(s,r.connection_id);
    if(input.mapping_version!==r.mapping_version||input.upload_token!==token(r))fail(409,'confirmation_conflict');
    const result=await s.query('SELECT * FROM public.confirm_import($1,$2,$3,$4)',[r.id,input.sha256,Number(r.size),input.mapping_version]);
    return response(202,result.rows[0]);
   });
  }catch(error){
   if(error?.name==='IngestionError'){error.status=422;}
   const status=[400,401,403,404,405,409,413,422,503].includes(error?.status)?error.status:503;
   const code=status===503?'imports_unavailable':error.code??'imports_rejected';
   return Response.json({contract_version:VERSION,error:{code,message:status===503?'Configurar y comprobar PostgreSQL, Storage y el secreto de confirmación en el servidor.':'No se pudo completar la importación.',retryable:status===503},meta:{trace_id}},{status,headers:{'Cache-Control':'private, no-store'}});
  }
 };
}
