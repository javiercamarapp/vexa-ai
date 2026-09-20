// Independent acceptance assertions. Infra transport/cookie pattern from product test/http.mjs only.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';import {createServer as httpServer} from 'node:http';import {createServer as netServer} from 'node:net';import {once} from 'node:events';import {randomUUID} from 'node:crypto';
import {copyBuildInputs,buildEnvironment} from '../../scaffold-copy.mjs';
import {runtime,snapshot,injection,hash,q} from './runtime.mjs';
export async function ssrExam(candidate){
 assert.ok(fs.existsSync(path.join(candidate,'packages/jobs/index.mjs')),'IMPLEMENTATION_MISSING');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'f02-independent-ssr-')),sockets=fs.mkdtempSync('/tmp/f02-exam-pg-');
 const transports=new Set();let h,child,proxy,tunnel;let output='';
 const listen=async s=>{s.listen(0,'127.0.0.1');await once(s,'listening');return 'http://127.0.0.1:'+s.address().port;};
 const stop=async()=>{if(!child)return;const c=child;child=null;const done=once(c,'exit');c.kill('SIGKILL');await done;};
 try{
  copyBuildInputs(candidate,tmp);
  if(process.env.F02_SSR_MUTANT==='origin'){
   const target=path.join(tmp,'apps/web/src/lib/imports/server.ts'),source=fs.readFileSync(target,'utf8'),anchor="if(request.method!=='GET')assertOrigin(request.headers.get('origin'),c.origin);";
   assert.equal(source.split(anchor).length,2,'MUTATION_ANCHOR');fs.writeFileSync(target,source.replace(anchor,'/* SYNTHETIC MUTANT: omitted Origin validation */'));
  }
  const env=buildEnvironment(process.env,tmp);
  for(const args of [['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],['run','build','--workspace','@vexa/web']]){
   const r=spawnSync('npm',args,{cwd:tmp,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});console.log('COMMAND',JSON.stringify(['npm',...args]),'EXIT',r.status);if(r.status!==0)console.log(r.stdout,r.stderr);assert.equal(r.status,0,'SSR_BUILD_INFRA');
  }
  h=await runtime(candidate);
  const db=h.processConfig.container.replace(/-storage$/,'-db');
  tunnel=netServer(socket=>{const c=spawn('docker',['exec','-i',db,'nc','127.0.0.1','5432'],{stdio:['pipe','pipe','ignore']});transports.add(c);socket.pipe(c.stdin);c.stdout.pipe(socket);socket.on('error',()=>{});c.stdin.on('error',()=>{});socket.on('close',()=>c.kill());c.on('exit',()=>{transports.delete(c);socket.destroy();});});
  tunnel.listen(sockets+'/.s.PGSQL.5432');await once(tunnel,'listening');
  proxy=httpServer(async(req,res)=>{try{const kind=req.url.startsWith('/auth/v1/')?'auth':req.url.startsWith('/storage/v1/')?'storage':'rest';const suffix=req.url.slice(kind==='storage'?11:8),chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers};delete headers.host;delete headers['content-length'];const r=await fetch('http://127.0.0.1:'+({auth:56327,storage:56328,rest:56329}[kind])+suffix,{method:req.method,headers,redirect:'manual',...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(502);res.end();}});
  const publicBase=await listen(proxy),reservePort=httpServer(),base=await listen(reservePort);await new Promise(r=>reservePort.close(r));
  const connection=h.processConfig.connection,secret=randomUUID();
  const start=async()=>{child=spawn(process.execPath,[path.join(tmp,'node_modules/next/dist/bin/next'),'start',path.join(tmp,'apps/web'),'--hostname','127.0.0.1','--port',new URL(base).port],{cwd:tmp,env:{...env,NEXT_PUBLIC_SUPABASE_URL:publicBase,NEXT_PUBLIC_SUPABASE_ANON_KEY:h.processConfig.anon,NEXT_PUBLIC_SITE_URL:base,VEXA_DATABASE_URL:`postgresql://${connection.user}:${connection.password}@localhost/postgres?host=${encodeURIComponent(sockets)}`,VEXA_IMPORT_CONFIRMATION_SECRET:secret},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health/version')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}assert.fail('SSR_START_INFRA');};
  const cookie=a=>'sb-127-auth-token=base64-'+Buffer.from(JSON.stringify({access_token:a.token,refresh_token:'SYNTHETIC-unused',expires_at:Math.floor(Date.now()/1000)+1800,user:{id:a.id}})).toString('base64url')+'; vexa_active_org='+a.tenant;
  const request=async(a,route,body,options={})=>{const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{...(a?{cookie:cookie(a)}:{}),origin:base,'idempotency-key':randomUUID(),'content-type':'application/json',Connection:'close',...options},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await r.json();assert.ok(data.meta?.trace_id,'SSR_TRACE_ID');return {status:r.status,data};};
  const status=(r,n,label)=>{assert.equal(r.status,n,label+': '+JSON.stringify(r));return r.data.data;};
  const bytes=Buffer.from('id,text\nexam,SYNTHETIC independent gate\n');console.log('FIXTURE',JSON.stringify({label:'SYNTHETIC',license:'CC0-1.0',base64:bytes.toString('base64'),sha256:hash(bytes)}));
  const metadata={connection_id:h.A.connection,mapping_version:'csv-message-v1',content_type:'text/csv',size:bytes.length,sha256:hash(bytes)};
  const reserve=async(extra={},key=randomUUID())=>status(await request(h.A,'/api/imports',{...metadata,...extra},{'idempotency-key':key}),201,'SSR_RESERVE');
  const confirm=(v,a=h.A,extra={})=>request(a,'/api/imports/'+v.import_id+'/confirm',{upload_token:v.upload_token,sha256:metadata.sha256,mapping_version:metadata.mapping_version},extra);
  const send=async(v,b=bytes)=>{const u=new URL(v.upload_url);assert.equal(u.origin,publicBase,'LOCAL_STORAGE_ONLY');const r=await fetch(u,{method:'PUT',headers:{'content-type':'text/csv',Connection:'close'},body:b});const text=await r.text();return {status:r.status,text};};
  const read=async(v,a=h.A)=>{const r=await fetch('http://127.0.0.1:56328/object/authenticated/vexa-private/'+v.object_path,{headers:{apikey:h.processConfig.anon,Authorization:'Bearer '+a.token,Connection:'close'}});return {status:r.status,bytes:Buffer.from(await r.arrayBuffer())};};
  const noJobs=v=>{const s=snapshot(h,v.import_id);assert.equal(s.jobs.length,0,'NO_JOB');assert.equal(s.outbox.length,0,'NO_OUTBOX');return s;};
  const accepted=r=>{const d=status(r,202,'SSR_CONFIRM');assert.equal(d.state,'queued','QUEUED_NOT_COMPLETED');return d;};
  await start();status(await request(null,'/api/imports',metadata),401,'SSR_ANONYMOUS');
  // Positive proves authenticated setup before the mutant's target assertion.
  const key=randomUUID(),v=await reserve({},key);noJobs(v);console.log('SSR_AUTHENTICATED_POSITIVE_REACHED');
  status(await request(h.A,'/api/imports',metadata,{origin:'https://foreign.invalid','idempotency-key':randomUUID()}),403,'SSR_ORIGIN_REJECT');
  status(await request(h.A,'/api/imports',metadata,{origin:'null','idempotency-key':randomUUID()}),403,'SSR_NULL_ORIGIN');
  for(const r of await Promise.all([reserve({},key),reserve({},key)]))assert.equal(r.import_id,v.import_id,'SSR_RESERVE_DEDUP');
  status(await request(h.A,'/api/imports',{...metadata,mapping_version:'conflict'},{'idempotency-key':key}),409,'SSR_MAPPING_CONFLICT');
  assert.equal((await send(v)).status,200,'DIRECT_STORAGE');const observed=await read(v);assert.equal(observed.status,200);assert.equal(observed.bytes.length,bytes.length);assert.equal(hash(observed.bytes),metadata.sha256);assert.deepEqual(observed.bytes,bytes);
  status(await confirm(v,h.B),404,'SSR_TENANT_CONFIRM');status(await request(h.B,'/api/imports/'+v.import_id),404,'SSR_TENANT_GET');
  status(await request({...h.A,tenant:h.B.tenant},'/api/imports/'+v.import_id),403,'SSR_SELECTOR');
  assert.ok([400,401,403,404].includes((await read(v,h.B)).status),'TENANT_STORAGE');
  status(await confirm(v,h.A,{origin:'https://foreign.invalid'}),403,'SSR_CONFIRM_ORIGIN');
  for(const r of await Promise.all([confirm(v),confirm(v)]))accepted(r);
  const unique=snapshot(h,v.import_id);assert.equal(unique.jobs.length,1);assert.equal(unique.outbox.length,1);assert.equal(unique.outbox[0].job_id,unique.jobs[0].id);
  assert.equal(status(await request(h.A,'/api/imports/'+v.import_id),200,'SSR_GET').import.state,'queued');
  await stop();await start();accepted(await confirm(v));assert.deepEqual(snapshot(h,v.import_id),unique,'SSR_RESTART_SAME_ROWS');console.log('PASS SSR flow concurrency tenant origin restart');
  const sized=await reserve(),before=noJobs(sized);const invalid=await send(sized,Buffer.from('x'));console.log('SIZE_REJECTION',JSON.stringify(invalid));assert.equal(invalid.status,500,'SIZE_UPLOAD_REJECT');assert.equal(JSON.parse(invalid.text).code,'DatabaseError','SIZE_STORAGE_DB_REJECT');assert.match(JSON.parse(invalid.text).message,/code: 23514/,'SIZE_CHECK_VIOLATION_NOT_INFRA');
  assert.equal(h.sql(`SELECT count(*) FROM storage.objects WHERE name=${q(sized.object_path)}`),'0','SIZE_NO_DURABLE_OBJECT');assert.notEqual((await read(sized)).status,200,'SIZE_NO_READABLE_BYTES');assert.deepEqual(noJobs(sized),before,'SIZE_NO_TRANSITION');
  assert.equal((await send(sized)).status,200,'SIZE_SAME_CAPABILITY_RETRY');const sizedRead=await read(sized);assert.equal(sizedRead.status,200);assert.deepEqual(sizedRead.bytes,bytes);assert.equal(sizedRead.bytes.length,metadata.size);assert.equal(hash(sizedRead.bytes),metadata.sha256);accepted(await confirm(sized));console.log('PASS SIZE early reject exact reservation/capability recovery independent reader');
  const bad=await reserve();assert.equal((await send(bad,Buffer.from('X'.repeat(bytes.length)))).status,200,'HASH_CORRECT_SIZE_UPLOAD');const badBefore=noJobs(bad);status(await confirm(bad),422,'PRODUCT_HASH_MISMATCH');assert.deepEqual(noJobs(bad),badBefore,'HASH_NO_EFFECT');console.log('PASS HASH same size confirm422');
  const revoked=await reserve();assert.equal((await send(revoked)).status,200);
  h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
  try{status(await confirm(revoked),403,'SSR_REVOKED_CONFIRM');status(await request(h.A,'/api/imports/'+revoked.import_id),403,'SSR_REVOKED_GET');assert.ok([400,401,403,404].includes((await read(revoked)).status),'REVOKED_STORAGE');noJobs(revoked);}finally{h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);}
  accepted(await confirm(revoked));console.log('PASS SSR revocation same cookie then recovery');
  for(const table of ['jobs','outbox']){const crash=await reserve();assert.equal((await send(crash)).status,200);const before=snapshot(h,crash.import_id);injection(h,table,true);try{status(await confirm(crash),503,'SSR_SQL_FAILURE');assert.equal(h.sql('SELECT is_called FROM f02_fault_reached'),'t','SSR_FAULT_REACHED');}finally{injection(h,table,false);}assert.deepEqual(snapshot(h,crash.import_id),before,'SSR_ATOMIC_ROLLBACK');await stop();await start();accepted(await confirm(crash));accepted(await confirm(crash));const after=snapshot(h,crash.import_id);assert.equal(after.imports[0].id,crash.import_id);assert.equal(after.jobs.length,1);assert.equal(after.outbox.length,1);assert.equal(after.outbox[0].job_id,after.jobs[0].id);}
  console.log('SSR_INDEPENDENT_TOTAL_PASS');
 }finally{
  await stop();for(const c of transports)c.kill();if(tunnel)await new Promise(r=>tunnel.close(r));if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}if(h)h.close();fs.rmSync(tmp,{recursive:true,force:true});fs.rmSync(sockets,{recursive:true,force:true});
 }
}
if(process.argv[1]===new URL(import.meta.url).pathname)await ssrExam(process.env.VEXA_CANDIDATE);
