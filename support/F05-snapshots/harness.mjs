import {createDownloadProxy} from './transport.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';import {fork} from 'node:child_process';import {once} from 'node:events';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export async function setup(candidate,evidence){
 for(const f of ['packages/metrics/snapshots.mjs','supabase/migrations/0021_economic_snapshots.sql','apps/web/src/components/economic-snapshot-panel.tsx'])assert.ok(candidate&&fs.existsSync(path.join(candidate,f)),'IMPLEMENTATION_MISSING:'+f);
 const driver=fs.mkdtempSync(path.join(os.tmpdir(),'f03-runtime-driver-'));let h;const pools=[];
 try{let code=fs.readFileSync(new URL('../../tests/acceptance/support/F02-durable-final/harness.mjs',import.meta.url),'utf8');
 const base=new URL('../../tests/acceptance/support/F02-durable-final/harness.mjs',import.meta.url);
 code=code.replace(/from '([^']+)'/g,(original,relative)=>relative.startsWith('.')?'from '+JSON.stringify(new URL(relative,base).href):original);
 code=code.replace(/new URL\('([^']+)',import.meta.url\)/g,(_,relative)=>'new URL('+JSON.stringify(new URL(relative,base).href)+')');
 code=code.replace("['run','build','--workspace','@vexa/web']", "['run','lint','--workspace','@vexa/web'],['run','build','--workspace','@vexa/web']");
 code=code.replace('h.browserDownload=async(page,click)=>{','h.browserDownload=async(page,click,observe=()=>{})=>{').replace("session.on('Browser.downloadProgress',event=>{if(event.state===","session.on('Browser.downloadWillBegin',event=>observe({...event,state:'begin'}));session.on('Browser.downloadProgress',event=>{observe(event);if(event.state===").replace("reject(Error('BROWSER_DOWNLOAD_TIMEOUT')),15000)","reject(Error('BROWSER_DOWNLOAD_TIMEOUT')),45000)").replace('await click();const guid=await complete;', 'complete.catch(()=>{});await click();const guid=await complete;');
 for(let n=0;n<6;n++)code=code.replaceAll(String(58160+n),String(60120+n));
 code=code.replace("bridge(60124,60124,'host.docker.internal'","bridge(60124,${h.downloadProxyPort},'host.docker.internal'");
 code=code.replace("'packages/jobs','packages/ingestion'","'packages/metrics','packages/economics','packages/problems','packages/gateway','packages/intelligence','packages/connectors','packages/jobs','packages/ingestion'");
 code=code.replace('h.built=built;h.common=common;','h.built=built;h.common=common;fs.cpSync(path.join(tmp,\'packages/connectors\'),path.join(built,\'packages/connectors\'),{recursive:true});for(const module of [\'metrics\',\'economics\',\'problems\',\'gateway\',\'intelligence\'])fs.cpSync(path.join(tmp,\'packages/\'+module),path.join(built,\'packages/\'+module),{recursive:true});');
 fs.writeFileSync(path.join(driver,'harness.mjs'),code);const mod=await import(pathToFileURL(path.join(driver,'harness.mjs')));h=await mod.setup(candidate,evidence);const close=h.close.bind(h);h.close=async()=>{for(const p of pools)await p.end();await close();fs.rmSync(driver,{recursive:true,force:true});};
 const{default:pg}=await import(pathToFileURL(path.join(h.tmp,'node_modules/pg/lib/index.js')));const{createDatabase}=await import(pathToFileURL(path.join(h.built,'packages/platform/db.mjs')));h.sync=await import(pathToFileURL(path.join(h.built,'packages/connectors/sync.mjs')));h.health=await import(pathToFileURL(path.join(h.built,'packages/connectors/health.mjs')));h.ingestion=await import(pathToFileURL(path.join(h.built,'packages/ingestion/index.mjs')));
 for(const a of [h.A,h.B]){a.role='owner';a.source='zendesk';a.account='SYN-account-'+randomUUID();h.sql(`UPDATE connections SET source='zendesk',account_id=${q(a.account)},credential_ref='SYN-SECRET-REFERENCE' WHERE id=${q(a.connection)}`);}
 h.repository=a=>{const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:2});pools.push(pool);const identity={async getUser(){return{id:a.id};},async memberships(){return[{tenant_id:a.tenant,user_id:a.id,role:a.role??'owner',status:'active',permissions_version:1}];}};const database=createDatabase({identity,pool,selectedTenant:a.tenant});return {database,repository:h.sync.createSyncRepository({database}),health:h.health.createHealthRepository({database})};};


 h.authenticatedDatabase=a=>{const pool=new pg.Pool({connectionString:h.common.VEXA_DATABASE_URL,max:2});pools.push(pool);const headers={apikey:h.common.VEXA_SUPABASE_ANON_KEY,Authorization:'Bearer '+a.token};const read=async suffix=>{const r=await fetch(h.common.VEXA_SUPABASE_URL+suffix,{headers});assert.equal(r.status,200,'REAL_SNAPSHOT_AUTH_TRANSPORT');return r.json();};return createDatabase({identity:{getUser:()=>read('/auth/v1/user'),memberships:id=>read('/rest/v1/memberships?select=tenant_id,user_id,role,status,permissions_version&user_id=eq.'+encodeURIComponent(id))},pool,selectedTenant:a.tenant});};
 h.downloadProxy=await createDownloadProxy(h.base);h.downloadProxyPort=h.downloadProxy.port;
 const crashChildren=new Set(),oldClose=h.close.bind(h);h.close=async()=>{await h.downloadProxy.close();for(const child of crashChildren){if(child.exitCode===null&&child.signalCode===null){const ended=once(child,'exit');child.kill('SIGKILL');await ended;}}return oldClose();};
 h.crashStage=async(mode,scope,actor=h.A)=>{
  const file=path.join(h.tmp,'snapshot-crash-child.mjs');fs.writeFileSync(file,`import {createClient} from '@supabase/supabase-js';import pg from 'pg';import {pathToFileURL} from 'node:url';
const {createDatabase}=await import(pathToFileURL(process.env.F02_BUILT+'/packages/platform/db.mjs'));const {createSnapshotRepository}=await import(pathToFileURL(process.env.F02_BUILT+'/packages/metrics/snapshots.mjs'));
const client=createClient(process.env.VEXA_SUPABASE_URL,process.env.VEXA_SUPABASE_ANON_KEY,{global:{headers:{Authorization:'Bearer '+process.env.SYN_ACCESS_TOKEN}},auth:{persistSession:false,autoRefreshToken:false}}),pool=new pg.Pool({connectionString:process.env.VEXA_DATABASE_URL,max:1});
const identity={async getUser(){const r=await client.auth.getUser(process.env.SYN_ACCESS_TOKEN);if(r.error)throw r.error;return r.data.user;},async memberships(id){const r=await client.from('memberships').select('tenant_id,user_id,role,status,permissions_version').eq('user_id',id);if(r.error)throw r.error;return r.data;}};
const database=createDatabase({identity,pool,selectedTenant:process.env.SYN_TENANT}),mode=process.env.SYN_CRASH_HOOK;const pause=async value=>{process.send({barrier:true,mode,snapshotId:value?.id??value?.snapshotId??null,index:value?.index??null});await new Promise(()=>{});};
const hooks={afterComponent:async value=>{if(mode==='afterComponent'&&value.index===0)await pause(value);},afterStage:async value=>{if(mode==='afterStage')await pause(value);}};
try{await createSnapshotRepository({database,hooks}).stage({scope:JSON.parse(process.env.SYN_SCOPE)});process.send({unexpectedCompletion:true});}catch(e){process.send({error:{name:e.name,code:e.code,message:e.message}});}finally{await pool.end();}
`);
  const child=fork(file,[],{execPath:process.execPath,execArgv:[],env:{...h.common,SYN_ACCESS_TOKEN:actor.token,SYN_TENANT:actor.tenant,SYN_SCOPE:JSON.stringify(scope),SYN_CRASH_HOOK:mode},stdio:['ignore','ignore','ignore','ipc']});crashChildren.add(child);
  const observed=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{reject(Error('SNAPSHOT_CRASH_BARRIER_TIMEOUT'));},20000);child.once('message',m=>{clearTimeout(timer);m.barrier?resolve(m):reject(Error('SNAPSHOT_CRASH_PREREQUISITE:'+JSON.stringify(m)));});child.once('exit',(code,signal)=>{clearTimeout(timer);reject(Error('SNAPSHOT_CHILD_EARLY_EXIT:'+code+':'+signal));});});
  const ended=once(child,'exit');child.kill('SIGKILL');const [code,signal]=await ended;crashChildren.delete(child);assert.equal(signal,'SIGKILL','REAL_SNAPSHOT_PROCESS_CRASH');fs.writeFileSync(path.join(evidence,'crash-'+mode+'.json'),JSON.stringify({...observed,code,signal}));return observed;
 };
 return h;
 }catch(e){if(h)await h.close();fs.rmSync(driver,{recursive:true,force:true});throw e;}
}
