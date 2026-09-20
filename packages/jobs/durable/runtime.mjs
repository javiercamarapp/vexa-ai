import {createRequire} from 'node:module';
import {workerCredentials} from './credentials.mjs';
import {createJobRepository} from './repository.mjs';
export async function createRuntime(env=process.env,{createDatabase,pool:providedPool,deadlineAt}={}){
 for(const key of ['VEXA_DATABASE_URL','VEXA_SUPABASE_URL','VEXA_SUPABASE_ANON_KEY','VEXA_WORKER_EMAIL','VEXA_WORKER_PASSWORD','VEXA_WORKER_USER_ID'])if(!env[key])throw Error('CONFIGURATION_REQUIRED');
 if(!createDatabase)({createDatabase}=await import(/* webpackIgnore: true */ '../../platform/db.mjs'));
 const dispatcher=env.VEXA_WORKER_DISPATCHER==='enabled';
 if(!dispatcher&&!env.VEXA_WORKER_TENANT)throw Error('CONFIGURATION_REQUIRED');
 const credentials=workerCredentials(env);
 const require=createRequire(import.meta.url),{Pool}=require('pg');const driver=new Pool({connectionString:env.VEXA_DATABASE_URL,max:3});
 const pool=providedPool??{async connect(){const c=await driver.connect();try{const r=await c.query("SELECT rolsuper,rolbypassrls,EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns FROM pg_roles WHERE rolname=current_user");if(!r.rows[0]||r.rows[0].rolsuper||r.rows[0].rolbypassrls||r.rows[0].owns)throw Error('UNSAFE_DATABASE_ROLE');return c;}catch(e){c.release();throw e;}}};

 async function get(route,{signal}={}){const r=await fetch(env.VEXA_SUPABASE_URL+route,{headers:{apikey:env.VEXA_SUPABASE_ANON_KEY,Authorization:'Bearer '+await credentials.token()},signal:signal??AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw Object.assign(Error('REMOTE_REJECTED'),{status:r.status,retryAfter:r.headers.get('retry-after')});return r;}
 const identity={getUser:async()=>{return (await get('/auth/v1/user')).json();},memberships:async()=>{return (await get('/rest/v1/memberships?select=*')).json();}};
 let tenant=env.VEXA_WORKER_TENANT;
 if(dispatcher){
  try{const user=await identity.getUser();if(user.id!==env.VEXA_WORKER_USER_ID)throw Error('WORKER_IDENTITY_MISMATCH');
   const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE vexa_backend');
    await c.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('vexa.action','worker_dispatch',true),set_config('statement_timeout','5000',true)",[user.id]);
    tenant=(await c.query('SELECT public.reserve_worker_scope() AS tenant')).rows[0]?.tenant;
    await c.query('COMMIT');
   }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }catch(e){await driver.end();throw e;}
  if(!tenant)return {idle:true,close:()=>driver.end()};
 }
 const canonical=createDatabase({identity,pool,selectedTenant:tenant});
 const database=deadlineAt?{transaction:async(action,work)=>{if(Date.now()>=deadlineAt)throw Error('CHUNK_TIMEOUT');return canonical.transaction(action,async s=>{const remaining=Math.floor(deadlineAt-Date.now());if(remaining<1)throw Error('CHUNK_TIMEOUT');await s.query("SELECT set_config('transaction_timeout',$1,true),set_config('statement_timeout',$1,true)",[String(remaining)]);return work(s);});}}:canonical;
 const storage={async read(scope,row,options){if(scope.tenantId!==row.tenant_id||row.tenant_id!==tenant||!row.object_path.startsWith(scope.tenantId+'/imports/'+row.id+'/'))throw Error('STORAGE_SCOPE');const r=await get('/storage/v1/object/authenticated/vexa-private/'+row.object_path.split('/').map(encodeURIComponent).join('/'),options);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>20971520)throw Error('STORAGE_LIMIT');return bytes;}};
 return {chunkSize:Number(env.VEXA_WORKER_CHUNK_SIZE??100),repository:createJobRepository({database,worker:true}),storage,close:()=>driver.end()};
}
