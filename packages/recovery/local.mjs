import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import {createRequire} from 'node:module';
import {digest,createRecoveryRepository,verifyRecoveryLedger} from './index.mjs';
const marker='.vexa-recovery-owned';
const check=v=>{if(!v)throw Error('SYNTHETIC_RECOVERY_GUARD');};
async function run(cmd,args,{input,limit=128*1024*1024}={}){return new Promise((resolve,reject)=>{const child=spawn(cmd,args,{stdio:['pipe','pipe','pipe']});const out=[],err=[];let size=0;const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('LOCAL_OPERATION_TIMEOUT'));},60000);child.on('error',reject);child.stdout.on('data',b=>{size+=b.length;if(size>limit){child.kill('SIGTERM');reject(Error('LOCAL_OUTPUT_LIMIT'));}out.push(b);});child.stderr.on('data',b=>{if(err.length<100)err.push(b);});child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(Error('LOCAL_COMMAND_FAILED: '+Buffer.concat(err).toString().slice(0,2000)));else resolve(Buffer.concat(out));});child.stdin.end(input);});}
export async function createLocalStorage(root){
 const real=await fs.realpath(root);check((await fs.readFile(path.join(real,marker),'utf8')).trim()==='synthetic-vexa-recovery-v1');
 async function location(key){check(typeof key==='string'&&key.length>0&&!path.isAbsolute(key)&&!key.split('/').some(x=>!x||x==='.'||x==='..')&&!/[\\\u0000-\u001f]/.test(key));const parts=key.split('/');let current=real;for(const part of parts){current=path.join(current,part);try{const st=await fs.lstat(current);check(!st.isSymbolicLink());}catch(e){if(e.code!=='ENOENT')throw e;}}check(current.startsWith(real+path.sep));return current;}
 return {async remove(key){await fs.rm(await location(key),{force:true});},async exists(key){try{return (await fs.stat(await location(key))).isFile();}catch(e){if(e.code==='ENOENT')return false;throw e;}},async read(key){return fs.readFile(await location(key));},async write(key,data){const p=await location(key);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,data,{flag:'wx',mode:0o600});},root:real};
}
async function ownedContainer(name){check(typeof name==='string'&&/^vexa-recovery-[a-z0-9-]+$/.test(name));const rows=JSON.parse((await run('docker',['inspect',name])).toString());const c=rows[0];check(c?.State?.Running&&c.Config?.Labels?.['vexa.recovery']==='synthetic');const ports=c.NetworkSettings?.Ports?.['5432/tcp'];check(ports?.length===1&&ports[0].HostIp==='127.0.0.1'&&Number(ports[0].HostPort)>=61820&&Number(ports[0].HostPort)<=61825);return Number(ports[0].HostPort);}
async function sql(container,query){return (await run('docker',['exec','-i',container,'psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:query})).toString().trim();}
async function schema(container){
 // pg_dump captures constraints, indexes, functions, triggers, policies and defaults.
 // Only random client-side psql restriction tokens are normalized; version headers stay.
 const ddl=(await run('docker',['exec',container,'pg_dump','-U','supabase_admin','-d','postgres','--schema-only','--no-owner','--no-acl','--schema=public','--schema=auth','--schema=storage'])).toString().split('\n').filter(line=>!/^\\(?:un)?restrict /.test(line)).join('\n');
 const versions=await sql(container,"SELECT extname,extversion FROM pg_extension ORDER BY extname");return digest({ddl,versions});
}
async function inventory(root){const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name===marker)continue;check(!e.isSymbolicLink());const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else{check(e.isFile());files.push({key:path.relative(root,p).split(path.sep).join('/'),sha256:digest(await fs.readFile(p)),size:(await fs.stat(p)).size});}}}await walk(root);return files.sort((a,b)=>a.key.localeCompare(b.key));}
export async function backupLocal(plan){
 check(plan?.mode==='synthetic-local');await ownedContainer(plan.sourceContainer);const storage=await createLocalStorage(plan.storageRoot);const started=Date.now();
 const out=path.resolve(plan.archive);await fs.mkdir(out,{recursive:false,mode:0o700});await fs.writeFile(path.join(out,marker),'synthetic-vexa-recovery-v1',{mode:0o600});
 const before=await inventory(storage.root);const dump=await run('docker',['exec',plan.sourceContainer,'pg_dump','-U','supabase_admin','-d','postgres','--format=custom','--data-only','--schema=public','--schema=auth','--schema=storage','--exclude-table-data=storage.buckets','--exclude-table-data=auth.schema_migrations']);await fs.writeFile(path.join(out,'database.dump'),dump,{flag:'wx',mode:0o600});
 for(const file of before){const target=path.join(out,'objects',file.key);await fs.mkdir(path.dirname(target),{recursive:true});const content=await storage.read(file.key);check(digest(content)===file.sha256);await fs.writeFile(target,content,{flag:'wx',mode:0o600});}
 check(JSON.stringify(before)===JSON.stringify(await inventory(storage.root)));
 const manifest={schema:'synthetic-recovery-backup-v1',capturedAt:started,finishedAt:Date.now(),schemaHash:await schema(plan.sourceContainer),bucketsHash:digest(await sql(plan.sourceContainer,"SELECT json_agg(b ORDER BY id) FROM storage.buckets b")),authBootstrapHash:digest(await sql(plan.sourceContainer,"SELECT json_agg(s ORDER BY version) FROM auth.schema_migrations s")),databaseHash:digest(dump),objects:before,tenantIds:JSON.parse(await sql(plan.sourceContainer,"SELECT coalesce(json_agg(id ORDER BY id),'[]') FROM public.organizations")),sourceContainer:plan.sourceContainer,backupOriginal:'immutable-until-explicit-approved-expiry'};
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});return {archive:out,manifestHash:digest(manifest),capturedAt:started,durationMs:Date.now()-started};
}
async function localDatabase(container,actorId,tenantId){
 check(/^[a-f0-9-]{36}$/.test(actorId)&&/^[a-f0-9-]{36}$/.test(tenantId));const port=await ownedContainer(container);const require=createRequire(import.meta.url);const {Pool}=require('pg');const pool=new Pool({host:'127.0.0.1',port,user:'supabase_admin',password:'synthetic-recovery-local-only',connectionTimeoutMillis:5000,database:'postgres',max:2});
 return {close:()=>pool.end(),async transaction(action,work){check(['read','retain'].includes(action));const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE vexa_backend');await c.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('vexa.tenant_id',$2,true),set_config('vexa.action',$3,true),set_config('statement_timeout','10000',true)",[actorId,tenantId,action]);const m=(await c.query("SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND status='active'",[tenantId,actorId])).rows[0];check(m?.role==='owner');const result=await work({tenantId,userId:actorId,role:m.role,query:(...args)=>c.query(...args)});await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
}
async function assertApplicationClosed(container){
 check(await sql(container,"SELECT datconnlimit FROM pg_database WHERE datname=current_database()")==='0');
 check(await sql(container,"SELECT count(*) FROM pg_stat_activity a JOIN pg_roles r ON r.rolname=a.usename WHERE a.datname=current_database() AND a.pid<>pg_backend_pid() AND NOT r.rolsuper")==='0');
}
export async function restoreLocal(plan){
 check(plan?.mode==='synthetic-local'&&plan.confirmEmptyTarget===true&&Number.isSafeInteger(plan.recoveryCutoff));await ownedContainer(plan.targetContainer);check(plan.targetContainer!==plan.sourceContainer);
 const archive=await createLocalStorage(plan.archive),manifest=JSON.parse(await archive.read('manifest.json'));check(manifest.schema==='synthetic-recovery-backup-v1'&&digest(manifest)===plan.expectedManifestHash&&await schema(plan.targetContainer)===manifest.schemaHash);
 check(await sql(plan.targetContainer,'SELECT count(*) FROM public.organizations')==='0');check(digest(await sql(plan.targetContainer,"SELECT json_agg(b ORDER BY id) FROM storage.buckets b"))===manifest.bucketsHash);check(digest(await sql(plan.targetContainer,"SELECT json_agg(s ORDER BY version) FROM auth.schema_migrations s"))===manifest.authBootstrapHash);const storage=await createLocalStorage(plan.storageRoot);check((await inventory(storage.root)).length===0);
 const inputs=plan.ledgers??[{tenantId:plan.tenantId,actorId:plan.actorId,ledgerFile:plan.ledgerFile,ledgerKeyFile:plan.ledgerKeyFile,expectedLedgerHash:plan.expectedLedgerHash,recoveryCutoff:plan.recoveryCutoff}];
 check(Array.isArray(inputs)&&JSON.stringify(inputs.map(x=>x.tenantId).sort())===JSON.stringify(manifest.tenantIds));
 const start=Date.now();const blocked=path.join(storage.root,'RESTORE_BLOCKED');await fs.writeFile(blocked,'Do not serve traffic. Ledger and storage reconciliation required.',{flag:'wx',mode:0o600});
 // CONNECT ACLs do not evict existing sessions. Limit zero also blocks roles with
 // explicit/inherited CONNECT; only the trusted synthetic superuser can reconcile.
 check(await sql(plan.targetContainer,"SELECT rolsuper FROM pg_roles WHERE rolname=current_user")==='t');
 await sql(plan.targetContainer,'ALTER DATABASE postgres CONNECTION LIMIT 0; REVOKE CONNECT ON DATABASE postgres FROM PUBLIC,authenticated,service_role,vexa_backend');
 await sql(plan.targetContainer,"SELECT pg_terminate_backend(a.pid,5000) FROM pg_stat_activity a JOIN pg_roles r ON r.rolname=a.usename WHERE a.datname=current_database() AND a.pid<>pg_backend_pid() AND NOT r.rolsuper");
 await assertApplicationClosed(plan.targetContainer);
 // Authenticate every tenant ledger, including every event, before pg_restore.
 const ledgers=[];for(const input of inputs){check(Number.isSafeInteger(input.recoveryCutoff)&&input.recoveryCutoff>=plan.recoveryCutoff);const key=await fs.readFile(input.ledgerKeyFile,'utf8');const ledger=verifyRecoveryLedger(JSON.parse(await fs.readFile(input.ledgerFile,'utf8')),{ledgerKey:key,expectedHash:input.expectedLedgerHash,tenantId:input.tenantId,notBefore:input.recoveryCutoff});ledgers.push({input,ledger,key});}
 const dump=await archive.read('database.dump');check(digest(dump)===manifest.databaseHash);
 for(const file of manifest.objects)check(digest(await archive.read('objects/'+file.key))===file.sha256);
 await run('docker',['exec','-i',plan.targetContainer,'pg_restore','-U','supabase_admin','-d','postgres','--data-only','--disable-triggers','--single-transaction','--no-owner','--no-acl'],{input:dump});
 for(const file of manifest.objects)await storage.write(file.key,await archive.read('objects/'+file.key));
 const reconciliations=[];
 for(const {input,ledger,key} of ledgers){const database=await localDatabase(plan.targetContainer,input.actorId,input.tenantId);
  try{const repository=createRecoveryRepository({database,storage,ledgerKey:key});const applied=await repository.reapplyLedger(ledger,{expectedHash:input.expectedLedgerHash,notBefore:input.recoveryCutoff});const purged=await repository.purgeArtifacts();check(purged.complete);
   const unresolved=await database.transaction('read',async s=>(await s.query("SELECT count(*)::integer AS n FROM retention_artifacts WHERE tenant_id=$1 AND status='pending'",[s.tenantId])).rows[0].n);check(unresolved===0);reconciliations.push({tenantId:input.tenantId,applied,purged});
  }finally{await database.close();}
 }
 await assertApplicationClosed(plan.targetContainer);await fs.rm(blocked);return {state:'reconciled-synthetic-only',reconciliations,rtoObservedMs:Date.now()-start,recoveryPointAgeObservedMs:start-manifest.capturedAt,backupOriginalHashUnchanged:digest(await archive.read('database.dump'))===manifest.databaseHash,scope:'all-backed-up-tenants-local-fixture-no-SLA',databaseNetworkAccess:'CONNECTION-LIMIT-0-and-PUBLIC-CONNECT-revoked; existing-application-sessions-terminated'};

}
export async function repositoryLocal(plan,ledgerKey){check(plan.mode==='synthetic-local');const database=await localDatabase(plan.sourceContainer,plan.actorId,plan.tenantId);const storage=await createLocalStorage(plan.storageRoot);return {repository:createRecoveryRepository({database,storage,ledgerKey}),close:database.close};}
