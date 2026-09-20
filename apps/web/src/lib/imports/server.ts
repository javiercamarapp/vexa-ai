import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {createDatabase,type SqlPool} from '@vexa/platform/db';
import {createJobRepository} from '../../../../../packages/jobs/durable/repository.mjs';
import {createImportHandler} from '../../../../../packages/jobs/index.mjs';
import {ACTIVE_ORG,AccessError,assertOrigin,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
let pool:SqlPool|undefined;
export function serverPool():SqlPool {
 if(pool)return pool;
 const connectionString=process.env.VEXA_DATABASE_URL;
 if(!connectionString)throw new AccessError(503,'database_not_configured');
 const driver=new Pool({connectionString,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
 // Defense in depth: reject privileged/misprovisioned login before domain work.
 pool={async connect(){const c=await driver.connect();try{
  const r=await c.query("SELECT rolsuper,rolbypassrls,EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns FROM pg_roles WHERE rolname=current_user");
  if(!r.rows[0]||r.rows[0].rolsuper||r.rows[0].rolbypassrls||r.rows[0].owns)throw new AccessError(503,'database_role_unsafe');
  return {query:async<Row>(text:string,values?:readonly (string|number|bigint|boolean|null|readonly string[])[])=>{const result=await c.query(text,values?[...values]:undefined);return {rows:result.rows as Row[],rowCount:result.rowCount};},release:()=>c.release()};
 }catch(error){c.release();throw error;}}};return pool;
}
export async function imports(request:NextRequest) {
 let finish=(r:NextResponse)=>r;
 try{
  const c=config();if(!c)throw new AccessError(503,'auth_not_configured');
  if(request.method!=='GET')assertOrigin(request.headers.get('origin'),c.origin);
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const bucket=auth.client.storage.from('vexa-private');
  const handler=createImportHandler({database,admission:process.env.VEXA_DURABLE_CONSUMER==='enabled'?()=>createJobRepository({database}).health():undefined,confirmationSecret:process.env.VEXA_IMPORT_CONFIRMATION_SECRET,storage:{
   async createUpload(_scope,row){const {data,error}=await bucket.createSignedUploadUrl(row.object_path,{upsert:false});if(error||!data?.signedUrl)throw new AccessError(503,'storage_sign_unavailable');return {url:data.signedUrl};},
   async read(_scope,row){const {data,error}=await bucket.download(row.object_path);if(error||!data)throw new AccessError(503,'storage_read_unavailable');if(data.size>20971520)throw new AccessError(422,'object_too_large');return new Uint8Array(await data.arrayBuffer());}
  }});
  const result=await handler(request);return finish(new NextResponse(result.body,{status:result.status,headers:result.headers}));
 }catch(error){const e=error instanceof AccessError?error:new AccessError(503,'imports_unavailable');return finish(NextResponse.json({contract_version:'f02-durable-v1',error:{code:e.code,message:e.status===503?'Configurar PostgreSQL, Auth, Storage y VEXA_IMPORT_CONFIRMATION_SECRET en el servidor.':'Acceso rechazado.',retryable:e.status===503},meta:{trace_id:randomUUID()}},{status:e.status,headers:PRIVATE_HEADERS}));}
}
