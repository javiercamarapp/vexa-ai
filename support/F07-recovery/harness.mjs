import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';import {createRequire,stripTypeScriptTypes} from 'node:module';import {pathToFileURL} from 'node:url';import net from 'node:net';
// Offline recovery fixture: keep the pinned image libraries except pg_net.
// Its background HTTP worker reconnects despite CONNECTION LIMIT 0; production guards stay intact.
const recoveryPreloads='pg_stat_statements,pgaudit,plpgsql,plpgsql_check,pg_cron,pgsodium,auto_explain,pg_tle,plan_filter,supabase_vault';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
import {copyBuildInputs,buildEnvironment} from '../../tests/acceptance/scaffold-copy.mjs';
// Exact Storage v1.69.11 helper migrations from image sha256:97ed68d33417d253a45fe0a70f84324d92250a3e239bf18aa6cf87269dbf6727.
// The SQL-only restore fixture needs the same operation-aware policy prerequisite as real Storage.
export const storageOperationBootstrapSQL = [
`CREATE OR REPLACE FUNCTION storage.operation()
    RETURNS text AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$ LANGUAGE plpgsql STABLE;`,
`-- Ergonomic helpers for operation-aware RLS policies.
-- These helpers read the existing transaction-local storage.operation GUC (Grand Unified Configuration).

CREATE OR REPLACE FUNCTION storage.allow_only_operation(expected_operation text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;

CREATE OR REPLACE FUNCTION storage.allow_any_operation(expected_operations text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;
`
];
export async function setup(candidate,evidence){
 assert.ok(evidence&&path.isAbsolute(evidence));fs.mkdirSync(evidence,{recursive:true,mode:0o700});const journal=path.join(evidence,'resources.jsonl');fs.writeFileSync(journal,'',{flag:'wx',mode:0o600});const broker=randomUUID(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-recovery312-')),resources=[],pools=[],clients=[];
 const run=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});assert.ok(!r.error&&r.signal===null&&r.status===0,r.stderr);return r.stdout.trim();};
 const sql=(container,query)=>run(['exec','-i',container,'psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],query);
 const register=(kind,name,id)=>{const item={kind,name,id,broker};resources.push(item);fs.appendFileSync(journal,JSON.stringify(item)+'\n');};
 let closing;const h={tmp,evidence,run,sql,resources,clients,close(){return closing??=this.cleanup();},async cleanup(){for(const c of clients)c.release();for(const p of pools)await p.end();for(const r of resources.toReversed()){if(r.kind==='container'){const label=run(['inspect',r.id,'--format','{{index .Config.Labels "vexa.review.broker"}}']);assert.equal(label,broker);}else{const data=JSON.parse(run(['network','inspect',r.id]));assert.equal(data[0].Labels['vexa.review.broker'],broker);}run(r.kind==='container'?['rm','-f',r.id]:['network','rm',r.id]);const check=spawnSync('docker',['inspect',r.id],{encoding:'utf8'});assert.notEqual(check.status,0);r.absent=true;}fs.rmSync(tmp,{recursive:true,force:true});fs.writeFileSync(path.join(evidence,'cleanup.json'),JSON.stringify({resources,temporaryRemoved:!fs.existsSync(tmp)},null,2));process.off('SIGTERM',stop);process.off('SIGINT',stop);}};
 const stop=()=>{void h.close().then(()=>process.exit(1),error=>{fs.writeFileSync(path.join(evidence,'cleanup-error.json'),JSON.stringify({message:error.message}),{mode:0o600});process.exit(1);});};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 try{
  for(const port of [61820,61821])await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve));});
  const network='vexa-recovery-312-'+broker;register('network',network,run(['network','create','--label','vexa.review.broker='+broker,network]));
  for(const [key,port]of [['source',61820],['target',61821]]){const name='vexa-recovery-312-'+broker+'-'+key;register('container',name,run(['run','--pull','never','--network',network,'--label','vexa.review.broker='+broker,'--label','vexa.recovery=synthetic','--name',name,'-d','-e','POSTGRES_HOST_AUTH_METHOD=trust','-p',`127.0.0.1:${port}:5432`,'public.ecr.aws/supabase/postgres:17.6.1.166','postgres','-D','/etc/postgresql','-c','shared_preload_libraries='+recoveryPreloads]));h[key]={name,port};
   for(let i=0;i<200;i++){const ready=spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1'],{stdio:'ignore'});if(ready.status===0)break;assert.ok(i<199,'DB_READY_TIMEOUT');await new Promise(r=>setTimeout(r,100));}
   const preloads=sql(name,'SHOW shared_preload_libraries');assert.equal(preloads,recoveryPreloads,'OFFLINE_RECOVERY_PRELOADS_REQUIRED');fs.writeFileSync(path.join(evidence,key+'-preloads.json'),JSON.stringify({image:'public.ecr.aws/supabase/postgres:17.6.1.166',sharedPreloadLibraries:preloads,scope:'offline synthetic recovery; pg_net worker disabled at startup'},null,2));
   sql(name,"create schema if not exists storage;create table if not exists storage.buckets(id text primary key,name text,public boolean);create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;create table if not exists auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);alter role supabase_admin password 'synthetic-recovery-local-only';");
   sql(name,storageOperationBootstrapSQL.join('\n'));
   sql(name,fs.readdirSync(path.join(candidate,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort().map(file=>fs.readFileSync(path.join(candidate,'supabase/migrations',file),'utf8')).join('\n'));
   sql(name,"ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until timestamptz;CREATE ROLE recovery_fixture LOGIN NOINHERIT PASSWORD 'SYN-312';GRANT vexa_backend TO recovery_fixture;");
  }
  copyBuildInputs(candidate,tmp);const install=spawnSync('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:tmp,env:{...buildEnvironment(process.env,tmp),PATH:path.dirname(process.execPath)+':'+process.env.PATH},encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});fs.writeFileSync(path.join(evidence,'install.log'),(install.stdout??'')+(install.stderr??''));assert.ok(!install.error&&install.signal===null&&install.status===0,'LOCKED_DEPENDENCIES_REQUIRED');fs.mkdirSync(path.join(tmp,'packages/platform'),{recursive:true});
  for(const name of ['db','session'])fs.writeFileSync(path.join(tmp,'packages/platform',name+'.mjs'),stripTypeScriptTypes(fs.readFileSync(path.join(candidate,'packages/platform/src',name+'.ts'),'utf8')).replaceAll("'@vexa/platform/session'","'./session.mjs'"));
  const {Pool}=createRequire(path.join(tmp,'loader.cjs'))('pg');h.pool=(target='source',app=false)=>{const p=new Pool({host:'127.0.0.1',port:h[target].port,user:app?'recovery_fixture':'supabase_admin',password:app?'SYN-312':'synthetic-recovery-local-only',database:'postgres',max:2,connectionTimeoutMillis:3000});p.on('error',()=>{});pools.push(p);return p;};
  h.owner=h.pool();h.targetOwner=h.pool('target');const {createDatabase}=await import(pathToFileURL(path.join(tmp,'packages/platform/db.mjs')));
  h.database=(pool,actor,tenant,role='owner')=>createDatabase({pool,selectedTenant:tenant,identity:{async getUser(){return{id:actor};},async memberships(){return[{user_id:actor,tenant_id:tenant,role,status:'active',permissions_version:1}];}}});
  h.recovery=await import(pathToFileURL(path.join(tmp,'packages/recovery/index.mjs')));h.local=await import(pathToFileURL(path.join(tmp,'packages/recovery/local.mjs')));
  h.storage=async name=>{const dir=path.join(tmp,name);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'.vexa-recovery-owned'),'synthetic-vexa-recovery-v1',{mode:0o600});return h.local.createLocalStorage(dir);};return h;
 }catch(error){await h.close();throw error;}
}
