// Diagnostic instrumentation only. Canonical load/product sources are never edited.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {setup,basePort} from '../../packages/jobs/load/harness.mjs';
import {createQueryProfile} from './capacity-query-profile.mjs';
export {basePort};
const hash=b=>createHash('sha256').update(b).digest('hex');
const own=fileURLToPath(import.meta.url), control=path.resolve(path.dirname(own),'../..');
const PERSISTENCE='3b2fe5b364dcbbd2dd19029b8f2b2b9514132cf4743b31ab6d854cb7bd9b5869';
// Static public SQL forms from the adopted implementation. Never parameter values.
export const SHAPES=[
  {
    "querySha256": "0ad6988e32506f94bbb63ff1a14ee9272a68ac5ef5f190c5611580c3258a8c6f",
    "sql": "WITH import_row_write AS (INSERT INTO public.import_rows (id,tenant_id,import_id,row_ref,row_hash,state,error_code,payload_ref,provenance) VALUES ($3,$4,$5,$6,$7,$8,$9,$10,$11)) UPDATE public.imports SET accepted=accepted+1,total=total+CASE WHEN pending>0 THEN 0 ELSE 1 END,pending=greatest(0,pending-1),updated_at=now() WHERE tenant_id=$1 AND id=$2",
    "expectedCalls": 9800
  },
  {
    "querySha256": "6bde39e2fb3e462b689edd319387d89f9967dca9ff240c90d0eefa84bae9a24f",
    "sql": "WITH revision_write AS (INSERT INTO public.source_revisions (id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,canonical_id,conversation_id,provenance,snapshot,related_customer_id,related_product_id,related_order_id,related_conversation_id,message_revision_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)) INSERT INTO public.conversations (id,tenant_id,connection_id,external_id,source_revision,provenance,source,started_at,customer_id,order_id) VALUES ($19,$20,$21,$22,$23,$24,$25,$26,$27,$28) ON CONFLICT (id) DO UPDATE SET connection_id=EXCLUDED.connection_id,external_id=EXCLUDED.external_id,source_revision=EXCLUDED.source_revision,provenance=EXCLUDED.provenance,source=EXCLUDED.source,started_at=EXCLUDED.started_at,customer_id=EXCLUDED.customer_id,order_id=EXCLUDED.order_id",
    "expectedCalls": 9800
  },
  {
    "querySha256": "ae54cf7566ab9692183a0b1719ac039db24ad08006e3d51a8606ee764988591c",
    "sql": "WITH head_write AS (INSERT INTO public.source_heads (id,tenant_id,connection_id,entity_type,external_id,selected_revision_id,version,state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)) INSERT INTO public.message_revisions (id,tenant_id,message_id,revision,text_ref,hash,occurred_at,provenance) VALUES ($9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING",
    "expectedCalls": 9800
  },
  {
    "querySha256": "3e13039c6ef5fa65f9a8cc8c056e13815b6f472c78a1f5b46b4077b207664371",
    "sql": "WITH revision_write AS (INSERT INTO public.source_revisions (id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,canonical_id,message_id,provenance,snapshot,related_customer_id,related_product_id,related_order_id,related_conversation_id,message_revision_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)) INSERT INTO public.messages (id,tenant_id,connection_id,external_id,source_revision,provenance,conversation_id,role,occurred_at) VALUES ($19,$20,$21,$22,$23,$24,$25,$26,$27) ON CONFLICT (id) DO UPDATE SET connection_id=EXCLUDED.connection_id,external_id=EXCLUDED.external_id,source_revision=EXCLUDED.source_revision,provenance=EXCLUDED.provenance,conversation_id=EXCLUDED.conversation_id,role=EXCLUDED.role,occurred_at=EXCLUDED.occurred_at",
    "expectedCalls": 9800
  },
  {
    "querySha256": "34368b5907a00988f5b79e61048cfa66da1332cc1efdf5a9163af93af2477677",
    "sql": "INSERT INTO public.source_heads (id,tenant_id,connection_id,entity_type,external_id,selected_revision_id,version,state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    "expectedCalls": 9800
  },
  {
    "querySha256": "6d9a38813d08a981985ddf9c9eff5730e4b45480dd2ad64486591b00f9f4b66d",
    "sql": "WITH import_row_write AS (INSERT INTO public.import_rows (id,tenant_id,import_id,row_ref,row_hash,state,error_code,payload_ref,provenance) VALUES ($3,$4,$5,$6,$7,$8,$9,$10,$11)) UPDATE public.imports SET duplicates=duplicates+1,total=total+CASE WHEN pending>0 THEN 0 ELSE 1 END,pending=greatest(0,pending-1),updated_at=now() WHERE tenant_id=$1 AND id=$2",
    "expectedCalls": 100
  }
];
export const METRICS=['plans','total_plan_time','calls','total_exec_time','rows','shared_blks_hit','shared_blks_read','shared_blks_dirtied','shared_blks_written','local_blks_hit','local_blks_read','local_blks_dirtied','local_blks_written','temp_blks_read','temp_blks_written','wal_records','wal_fpi','wal_bytes'];
const counters=new Set(METRICS.filter(k=>!k.endsWith('_time')));
const identifier=v=>{assert.match(v,/^[a-z_][a-z_0-9]*$/,'PROFILE_IDENTIFIER');return '"'+v+'"';};
const keys=row=>[row.userid,row.dbid,row.toplevel,row.queryid].join(':');
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const decimal=s=>typeof s==='string'&&/^-?[0-9]+$/.test(s);
export function once(source,before,after){assert.equal(source.split(before).length-1,1,'PROFILE_ADAPTER_DRIFT');return source.replace(before,()=>after);}
// Preserve every original $n binding. Only known integer literal token locations
// may become new server-generated parameters above the original maximum $n.
export function serverMatches(sql,server){
 assert.equal(typeof server,'string');
 const tokenize=s=>s.match(/\$[0-9]+|[a-zA-Z_][a-zA-Z_0-9]*|[0-9]+|[^\s]/g)??[];
 const a=tokenize(sql),b=tokenize(server);if(a.length!==b.length)return false;
 const max=Math.max(0,...(sql.match(/\$[0-9]+/g)??[]).map(s=>Number(s.slice(1))));
 const generated=new Set();
 return a.every((token,i)=>{
  if(token===b[i])return true;
  if(/^[0-9]+$/.test(token)&&/^\$[0-9]+$/.test(b[i])&&Number(b[i].slice(1))>max&&!generated.has(b[i])){generated.add(b[i]);return true;}
  return false;
 });
}
function shapeFor(sql){const found=SHAPES.filter(s=>serverMatches(s.sql,sql));assert.ok(found.length<=1,'PROFILE_SQL_AMBIGUOUS');return found[0]?.querySha256??null;}
export function checkSettings(value){
 assert.ok(value&&Number.isSafeInteger(value.serverVersionNum)&&value.serverVersionNum>=170000&&value.serverVersionNum<180000,'PROFILE_PG17_REQUIRED');
 assert.ok(typeof value.preload==='string'&&value.preload.split(',').map(v=>v.trim()).includes('pg_stat_statements'),'PROFILE_PRELOAD_REQUIRED');
 assert.equal(value.track,'all','PROFILE_TRACK_ALL_REQUIRED');assert.equal(value.trackPlanning,'on','PROFILE_PLANNING_REQUIRED');assert.equal(value.computeQueryId,'on','PROFILE_QUERY_ID_REQUIRED');
 assert.ok(integer(value.userid)&&value.userid>0&&integer(value.dbid)&&value.dbid>0,'PROFILE_SCOPE_IDS');return value;
}
const SETTINGS_SQL="SELECT jsonb_build_object('serverVersionNum',current_setting('server_version_num')::int,'preload',current_setting('shared_preload_libraries'),'track',current_setting('pg_stat_statements.track'),'trackPlanning',current_setting('pg_stat_statements.track_planning'),'computeQueryId',current_setting('compute_query_id'),'userid',(SELECT oid::bigint FROM pg_roles WHERE rolname='vexa_backend'),'dbid',(SELECT oid::bigint FROM pg_database WHERE datname=current_database())) AS settings";
export function validateSnapshot(raw,scope){
 assert.ok(raw&&typeof raw.statsReset==='string'&&Number.isFinite(Date.parse(raw.statsReset))&&integer(raw.dealloc),'PROFILE_INFO_INVALID');
 assert.ok(Array.isArray(raw.entries)&&raw.entries.length<=256,'PROFILE_ENTRY_BOUND');
 const seen=new Set();
 const entries=raw.entries.map(row=>{
  assert.equal(row.userid,scope.userid,'PROFILE_USER_MISMATCH');assert.equal(row.dbid,scope.dbid,'PROFILE_DB_MISMATCH');assert.equal(typeof row.toplevel,'boolean');assert.ok(decimal(row.queryid)&&row.queryid!=='0','PROFILE_QUERY_ID_INVALID');
  assert.ok(typeof row.query==='string'&&row.query.length>0&&row.query.length<=32768,'PROFILE_QUERY_TEXT_INVALID');
  const key=keys(row);assert.ok(!seen.has(key),'PROFILE_DUPLICATE_KEY');seen.add(key);
  const values={};for(const k of METRICS){const n=row[k];assert.ok(finite(n)&&(!counters.has(k)||integer(n)),'PROFILE_METRIC_INVALID:'+k);values[k]=n;}
  // Raw server query text is consumed only in memory and never written/exported.
  return {userid:row.userid,dbid:row.dbid,toplevel:row.toplevel,queryid:row.queryid,serverQuerySha256:hash(row.query),querySha256:shapeFor(row.query),...values};
 });
 return {statsReset:raw.statsReset,dealloc:raw.dealloc,entries};
}
export function serverDelta(before,after,client){
 assert.equal(before.statsReset,after.statsReset,'PROFILE_STATS_RESET');assert.equal(before.dealloc,after.dealloc,'PROFILE_STATS_EVICTION');
 const old=new Map(before.entries.map(row=>[keys(row),row])),result=[];
 for(const row of after.entries){
  const previous=old.get(keys(row));if(previous){assert.equal(previous.serverQuerySha256,row.serverQuerySha256,'PROFILE_QUERY_TEXT_CHANGED');assert.equal(previous.querySha256,row.querySha256);old.delete(keys(row));}
  const delta={};for(const k of METRICS){delta[k]=row[k]-(previous?.[k]??0);assert.ok(finite(delta[k])&&(!counters.has(k)||integer(delta[k])),'PROFILE_COUNTER_RESET:'+k);}
  if(delta.calls||delta.plans)result.push({userid:row.userid,dbid:row.dbid,toplevel:row.toplevel,queryid:row.queryid,querySha256:row.querySha256,serverQuerySha256:row.serverQuerySha256,beforePresent:!!previous,...delta});
 }
 assert.equal(old.size,0,'PROFILE_ENTRY_DISAPPEARED');
 const mapped=result.filter(r=>r.toplevel&&r.querySha256),nested=result.filter(r=>!r.toplevel),unmapped=result.filter(r=>r.toplevel&&!r.querySha256);
 assert.equal(mapped.length,SHAPES.length,'PROFILE_PRIMARY_AND_DUPLICATE_SHAPES_REQUIRED');
 for(const shape of SHAPES){const rows=mapped.filter(r=>r.querySha256===shape.querySha256),groups=client.groups.filter(g=>g.querySha256===shape.querySha256);assert.equal(rows.length,1,'PROFILE_MAPPING_AMBIGUOUS');assert.equal(groups.length,1,'PROFILE_CLIENT_MAPPING_REQUIRED');assert.equal(rows[0].calls,shape.expectedCalls,'PROFILE_EXPECTED_CALLS');assert.equal(groups[0].count,rows[0].calls,'PROFILE_CLIENT_SERVER_CALLS');assert.equal(groups[0].failed,0);assert.ok(rows[0].plans>0,'PROFILE_NO_RECORDED_PLANS');}
 return {mapped,unmappedTopLevel:unmapped,nested,aggregation:'Separate partitions; never sum nested and top-level durations'};
}
let state=null;
function save(){if(state)fs.writeFileSync(path.join(state.out,'server-profile.json'),JSON.stringify(state.report,null,2),{mode:0o600});}
function snapshot(){
 const schema=identifier(state.report.extension.schema);
 const fields=METRICS.map(k=>"'"+k+"',"+k).join(',');
 const raw=state.h.json(`SELECT jsonb_build_object('statsReset',i.stats_reset,'dealloc',i.dealloc,'entries',(SELECT coalesce(jsonb_agg(jsonb_build_object('userid',userid::bigint,'dbid',dbid::bigint,'toplevel',toplevel,'queryid',queryid::text,'query',query,${fields})),'[]') FROM ${schema}.pg_stat_statements WHERE userid=${state.report.settings.userid} AND dbid=${state.report.settings.dbid})) FROM ${schema}.pg_stat_statements_info i`);
 return validateSnapshot(raw,state.report.settings);
}
export async function profileSetup(candidate,out){
 const report={schema:'vexa-server-profile-v1',synthetic:true,acceptance:false,production:false,status:'initializing',candidate,persistenceSha256:hash(fs.readFileSync(path.join(candidate,'packages/ingestion/persistence/index.mjs'))),instrumentation:Object.fromEntries(['capacity-server-profile.mjs','capacity-server-profile-run.mjs','capacity-query-profile.mjs'].map(n=>[n,hash(fs.readFileSync(path.join(control,'.github/scripts',n)))])),window:null,cleanupErrors:[],limitations:['One instrumented10K; not a capacity or optimization measurement.','Planning tracking adds overhead, not measured independently.','Client residual does not identify CPU, network or wait time.','Nested and top-level durations are separate; do not sum them.','No raw SQL, bindings, credentials or user payloads exported.']};
 assert.equal(report.persistenceSha256,PERSISTENCE,'PROFILE_PERSISTENCE_DRIFT');state={report,out,h:null};save();
 let h;
 try{
  h=await setup(candidate,out);state.h=h;
  const probe=h.json("SELECT jsonb_build_object('serverVersionNum',current_setting('server_version_num')::int,'preload',current_setting('shared_preload_libraries'),'extension',(SELECT jsonb_build_object('version',e.extversion,'schema',n.nspname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_stat_statements'))");report.probe=probe;save();
  assert.ok(probe.serverVersionNum>=170000&&probe.serverVersionNum<180000,'PROFILE_PG17_REQUIRED');assert.ok(typeof probe.preload==='string'&&probe.preload.split(',').map(v=>v.trim()).includes('pg_stat_statements'),'PROFILE_PRELOAD_REQUIRED');assert.ok(probe.extension&&typeof probe.extension.version==='string','PROFILE_EXTENSION_REQUIRED');identifier(probe.extension.schema);report.extension=probe.extension;
  // Only this disposable database. No ALTER SYSTEM, reload, restart or harness change.
  h.sql("ALTER DATABASE postgres SET pg_stat_statements.track_planning='on'; ALTER DATABASE postgres SET pg_stat_statements.track='all'; ALTER DATABASE postgres SET compute_query_id='on'");
  report.settings=checkSettings(h.json(SETTINGS_SQL));snapshot();report.status='ready';save();
  h.common={...h.common,VEXA_SERVER_PROFILE_EVIDENCE:out};
  const close=h.close.bind(h);h.close=async()=>{try{await close();}catch{report.cleanupErrors.push('HARNESS_CLOSE_FAILED');throw Error('PROFILE_CLEANUP_FAILED');}finally{save();}};
  return h;
 }catch(error){report.status='failed';report.error=error.code??'PROFILE_SETUP_FAILED';save();if(h)try{await h.close();}catch{report.cleanupErrors.push('HARNESS_CLOSE_FAILED');save();}throw error;}
}
export async function profileConsume(consume,file){
 assert.ok(state&&state.report.status==='ready'&&!state.report.window,'PROFILE_SINGLE_WINDOW');
 for(const key of ['jobId','importId'])assert.match(file[key],/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/,'PROFILE_FILE_ID');assert.match(file.sha256,/^[0-9a-f]{64}$/,'PROFILE_FILE_HASH');
 const w={startedAt:new Date().toISOString(),status:'running',before:snapshot()};state.report.window=w;save();
 try{
  await consume();
  w.after=snapshot();
  w.checkpoint=state.h.json(`SELECT jsonb_build_object('jobId',j.id,'importId',j.import_id,'offset',c.checkpoint->'offset','done',c.checkpoint->'done','fileHash',i.file_hash) FROM public.jobs j JOIN public.imports i ON i.tenant_id=j.tenant_id AND i.id=j.import_id JOIN public.checkpoints c ON c.tenant_id=j.tenant_id AND c.job_id=j.id AND c.stage='ingestion' WHERE j.id='${file.jobId}' AND i.id='${file.importId}'`);
  assert.deepEqual(w.checkpoint,{jobId:file.jobId,importId:file.importId,offset:10000,done:true,fileHash:file.sha256},'PROFILE_SQL_CHECKPOINT');
  const clientFile=path.join(state.out,'client-profile.json');assert.ok(!fs.lstatSync(clientFile).isSymbolicLink(),'PROFILE_CLIENT_SYMLINK');
  w.client=JSON.parse(fs.readFileSync(clientFile));assert.equal(w.client.schema,'vexa-server-client-profile-v1');assert.equal(w.client.settingsVerified,true);assert.ok(integer(w.client.connections)&&w.client.connections>0);assert.equal(w.client.profile.complete,true);assert.equal(w.client.profile.failed,0);w.delta=serverDelta(w.before,w.after,w.client.profile);
  w.status='completed';state.report.status='profiled';
 }catch(error){w.status='failed';state.report.status='failed';w.error=error.code??'PROFILE_WINDOW_FAILED';try{w.after??=snapshot();}catch{w.snapshotFailed=true;}throw error;}
 finally{w.finishedAt=new Date().toISOString();save();}
}
let clientProfile=null,connectionChecks=[],clientOut;
export async function profileDatabase(root){
 const {createDatabase}=await import(pathToFileURL(path.join(root,'packages/platform/db.mjs')));clientProfile=createQueryProfile();clientOut=process.env.VEXA_SERVER_PROFILE_EVIDENCE;
 assert.ok(clientOut&&path.isAbsolute(clientOut),'PROFILE_OUTPUT_REQUIRED');
 return options=>createDatabase({...options,pool:{async connect(){const c=await options.pool.connect();try{
  connectionChecks.push(checkSettings((await c.query(SETTINGS_SQL)).rows[0].settings));
  return {query(sql,values){return clientProfile.run(sql,()=>c.query(sql,values));},release(){c.release();}};
 }catch(error){c.release();throw error;}}}});
}
export async function clientConsume(consume){
 assert.ok(clientProfile);clientProfile.reset();let success=false;
 try{await consume();success=true;}finally{fs.writeFileSync(path.join(clientOut,'client-profile.json'),JSON.stringify({schema:'vexa-server-client-profile-v1',settingsVerified:connectionChecks.length>0,connections:connectionChecks.length,effectiveSettings:connectionChecks,success,profile:clientProfile.snapshot()},null,2),{mode:0o600});}
}
function absoluteImports(code,original){return code.replace(/from '([^']+)'/g,(match,value)=>value.startsWith('.')?'from '+JSON.stringify(new URL(value,original).href):match).replace(/new URL\('([^']+)',import.meta.url\)/g,(_,value)=>'new URL('+JSON.stringify(new URL(value,original).href)+')').replaceAll('import.meta.url',JSON.stringify(original.href));}
export function adaptSources(runSource,workerSource,workerUrl){
 const load=new URL('../../packages/jobs/load/',import.meta.url);
 let run=absoluteImports(runSource,new URL('run.mjs',load)),worker=workerSource;
 run=once(run,'import {setup,basePort} from '+JSON.stringify(new URL('harness.mjs',load).href)+';',`import {profileSetup as setup,basePort,profileConsume} from ${JSON.stringify(import.meta.url)};`);
 run=once(run,'new URL('+JSON.stringify(new URL('worker.mjs',load).href)+')','new URL('+JSON.stringify(workerUrl)+')');
 run=once(run,"await w.call('consume')","await profileConsume(()=>w.call('consume'),scale.files[0])");
 worker=once(worker,"const runtime=await createRuntime(process.env);let active=false;",`import {profileDatabase,clientConsume} from ${JSON.stringify(import.meta.url)};\nconst runtime=await createRuntime(process.env,{createDatabase:await profileDatabase(root)});let active=false;`);
 worker=once(worker,"await runDaemon({...runtime,repository,close:async()=>{}},{once:true})","await clientConsume(()=>runDaemon({...runtime,repository,close:async()=>{}},{once:true}))");
 return {run,worker};
}
export async function runProfile(){
 assert.equal(os.platform(),'linux');assert.equal(os.arch(),'arm64');assert.ok(process.version.startsWith('v22.'));assert.equal(os.cpus().length,4);assert.ok(os.totalmem()>=14*1024**3&&os.totalmem()<=18*1024**3);
 assert.equal(process.env.VEXA_LOAD_SCALES,'10000','PROFILE_ONLY_10K');assert.equal(process.argv.length,2,'PROFILE_NO_ARGUMENTS');
 for(const s of SHAPES)assert.equal(hash(s.sql),s.querySha256,'PROFILE_STATIC_SQL_HASH');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-server-profile-adapter-'));fs.chmodSync(directory,0o700);
 const cleanup=()=>fs.rmSync(directory,{recursive:true,force:true});
 // Also remove our adapter if an unsettled top-level await ends Node with exit13.
 process.once('exit',cleanup);
 try{const load=path.join(control,'packages/jobs/load');const runFile=path.join(directory,'run.mjs'),workerFile=path.join(directory,'worker.mjs');const adapted=adaptSources(fs.readFileSync(path.join(load,'run.mjs'),'utf8'),fs.readFileSync(path.join(load,'worker.mjs'),'utf8'),pathToFileURL(workerFile).href);fs.writeFileSync(runFile,adapted.run);fs.writeFileSync(workerFile,adapted.worker);await import(pathToFileURL(runFile));}
 finally{process.removeListener('exit',cleanup);cleanup();}
}
