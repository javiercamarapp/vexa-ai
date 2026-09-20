import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {spawn,spawnSync,fork} from 'node:child_process';
import {createServer} from 'node:http';import {createServer as netServer} from 'node:net';
import {once} from 'node:events';import {randomUUID,createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {resourceBroker} from '../ci/resources.mjs';
import {copyBuildInputs,buildEnvironment} from '../../scaffold-copy.mjs';
export const q=v=>"'"+String(v).replaceAll("'","''")+"'";
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function setup(candidate,evidence){
 assert.ok(['22','26'].includes(process.versions.node.split('.')[0]),'NODE22_OR_26_REQUIRED');
 assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
 for(const f of ['packages/jobs/durable/build.mjs','packages/jobs/durable/runtime.mjs','apps/web/src/components/job-progress.tsx'])assert.ok(fs.existsSync(path.join(candidate,f)),'IMPLEMENTATION_MISSING:'+f);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'f020506-')),sockets=fs.mkdtempSync('/tmp/f020506-sql-');
 const inheritedJournal=process.env.VEXA_CI_JOURNAL,inheritedBroker=process.env.VEXA_CI_BROKER;
 assert.equal(Boolean(inheritedJournal),Boolean(inheritedBroker),'RESOURCE_BROKER_CONFIG');
 const journal=inheritedJournal??path.join(evidence,'resources.jsonl');
 const journalOffset=inheritedJournal?fs.readFileSync(journal,'utf8').split('\n').filter(Boolean).length:0;
 const children=new Set(),workers=new Set();let infra,tunnel,proxy,web,browser,browserBroker,browserName;
 const env=buildEnvironment(process.env,tmp);env.PATH=path.dirname(process.execPath)+':'+env.PATH;
 fs.writeFileSync(path.join(evidence,'owned-paths.json'),JSON.stringify({tmp,sockets}));
 let closing;const stop=()=>{void h.close().finally(()=>process.exit(1));};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
 const h={tmp,evidence,close(){return closing??=this.cleanup();},async cleanup(){
  const resources=fs.existsSync(journal)?fs.readFileSync(journal,'utf8').trim().split('\n').filter(Boolean).slice(journalOffset).map(JSON.parse):[];
  if(inheritedJournal)fs.writeFileSync(path.join(evidence,'resources.jsonl'),resources.map(r=>JSON.stringify(r)+'\n').join(''),{mode:0o600});
  for(const r of resources){const v=spawnSync('docker',[r.kind,'inspect',r.name,'--format','{{.Id}}'],{encoding:'utf8',timeout:15000});r.id=v.status===0?v.stdout.trim():null;}
  if(browser)await browser.close();
  if(browserName)browserBroker.remove('container',browserName);
  for(const c of [...workers,...children]){if(c.exitCode===null&&c.signalCode===null){const end=once(c,'exit').catch(()=>{});c.kill('SIGKILL');await end;}}
  if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}
  if(tunnel)await new Promise(r=>tunnel.close(r));
  if(infra)infra.close();
  for(const r of resources){const v=spawnSync('docker',[r.kind,'inspect',r.id??r.name],{encoding:'utf8',timeout:15000});r.absent=v.status!==0&&!v.error&&/No such (?:object|container|network)|not found/i.test(v.stderr);assert.equal(r.absent,true,'RESOURCE_STILL_EXISTS:'+r.name);}
  fs.rmSync(sockets,{recursive:true,force:true});fs.rmSync(tmp,{recursive:true,force:true});
  fs.writeFileSync(path.join(evidence,'cleanup.json'),JSON.stringify({ownResourcesRemoved:true,resources,temporaryPathsRemoved:!fs.existsSync(tmp)&&!fs.existsSync(sockets)},null,2));process.off('SIGTERM',stop);process.off('SIGINT',stop);
  if(!inheritedJournal){delete process.env.VEXA_CI_BROKER;delete process.env.VEXA_CI_JOURNAL;}
 }};
 try{
  copyBuildInputs(candidate,tmp);
  const inputs={};for(const dir of ['packages/jobs','packages/ingestion','packages/platform','apps/web/src','supabase/migrations']){
   const walk=p=>{for(const d of fs.readdirSync(p,{withFileTypes:true})){if(d.name==='test')continue;const f=path.join(p,d.name);if(d.isDirectory())walk(f);else if(d.isFile())inputs[path.relative(candidate,f)]={sha256:hash(fs.readFileSync(f)),mode:fs.statSync(f).mode&0o777};}};walk(path.join(candidate,dir));
  }fs.writeFileSync(path.join(evidence,'source-hashes.json'),JSON.stringify(inputs,null,2));
  h.verifySources=()=>{for(const [f,digest]of Object.entries(inputs)){assert.equal(hash(fs.readFileSync(path.join(candidate,f))),digest.sha256,'SOURCE_CHANGED:'+f);assert.equal(fs.statSync(path.join(candidate,f)).mode&0o777,digest.mode,'SOURCE_MODE_CHANGED:'+f);}};
  for(const args of [['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],['run','build','--workspace','@vexa/web']]){
   const r=spawnSync('npm',args,{cwd:tmp,env,encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});fs.writeFileSync(path.join(evidence,args[0]+'.log'),r.stdout+r.stderr);assert.equal(r.status,0,'BUILD_'+args[0]);
  }
  const built=path.join(tmp,'built');const build=spawnSync(process.execPath,[path.join(tmp,'packages/jobs/durable/build.mjs'),built],{cwd:tmp,env,encoding:'utf8'});
  fs.writeFileSync(path.join(evidence,'cli-build.log'),build.stdout+build.stderr);assert.equal(build.status,0,'REAL_CLI_BUILD');
  // Read-only reuse of accepted infrastructure, adapted ONLY in TMP to isolated ports.
  const parent=new URL('../F02-durable/isolated-infra.mjs',import.meta.url);
  let code=fs.readFileSync(parent,'utf8').replace("'../ci/resources.mjs'",JSON.stringify(new URL('../ci/resources.mjs',import.meta.url).href)).replace("'../F01-03/matrix.mjs'",JSON.stringify(new URL('../F01-03/matrix.mjs',import.meta.url).href));
  for(const [a,b]of [['56327','58160'],['56328','58161'],['56329','58162']])code=code.replaceAll(a,b);
  code=code.replaceAll("'--label','com.supabase.cli.project=vexa-local'","'--label','vexa.exam=f020506'").replace('FILE_SIZE_LIMIT:1048576','FILE_SIZE_LIMIT:20971520');
  code=code.replace('return {id:r.data.user.id,token:r.data.access_token}', 'return {id:r.data.user.id,token:r.data.access_token,refresh:r.data.refresh_token,...body}');
  fs.writeFileSync(path.join(tmp,'infra.mjs'),code);
  if(!inheritedJournal){process.env.VEXA_CI_BROKER=randomUUID();process.env.VEXA_CI_JOURNAL=journal;fs.writeFileSync(journal,'',{mode:0o600,flag:'wx'});}
  const {launch,candidateInputs}=await import(pathToFileURL(path.join(tmp,'infra.mjs')));infra=await launch({services:true});
  for(const ddl of candidateInputs(candidate))infra.sql(ddl);
  h.sql=infra.sql;h.json=infra.json;h.probe=infra.probe;
  h.A=await infra.user();h.B=await infra.user();
  for(const a of [h.A,h.B]){a.tenant=randomUUID();a.connection=randomUUID();infra.sql(`INSERT INTO organizations(id,name) VALUES(${q(a.tenant)},'SYNTHETIC EXTERNAL05/06'); INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(a.tenant)},${q(a.id)},'owner','active'); INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(a.connection)},${q(a.tenant)},'csv',${q(randomUUID())});`);}
  h.bot=await infra.user();for(const a of [h.A,h.B])infra.sql(`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(a.tenant)},${q(h.bot.id)},'analyst','active'); INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(a.tenant)},${q(h.bot.id)},true)`);
  const pc=infra.productConfiguration(),db=pc.container.replace(/-storage$/,'-db');
  tunnel=netServer(socket=>{const c=spawn('docker',['exec','-i',db,'nc','127.0.0.1','5432'],{stdio:['pipe','pipe','ignore']});children.add(c);socket.pipe(c.stdin);c.stdout.pipe(socket);socket.on('error',()=>{});c.stdin.on('error',()=>{});socket.on('close',()=>c.kill());c.on('exit',()=>{children.delete(c);socket.destroy();});});tunnel.listen(sockets+'/.s.PGSQL.5432');await once(tunnel,'listening');
  h.fault=null;h.canary=0;h.authGrants=[];h.authRotations=[];
  h.auth=infra.http;
  proxy=createServer(async(req,res)=>{try{
   const kind=req.url.startsWith('/auth/v1/')?'auth':req.url.startsWith('/storage/v1/')?'storage':'rest';
   if(h.fault&&kind==='storage'&&req.url.includes('/object/authenticated/')){h.canary++;res.writeHead(h.fault.status,{'retry-after':String(h.fault.retryAfter??0)});res.end('SYNTHETIC fault');return;}
   if(kind==='auth'&&req.url.includes('/token?'))h.authGrants.push(new URL(req.url,'http://local').searchParams.get('grant_type'));
   const suffix=req.url.slice(kind==='storage'?11:8),chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers};delete headers.host;delete headers['content-length'];headers.connection='close';
   const r=await fetch('http://127.0.0.1:'+({auth:58160,storage:58161,rest:58162}[kind])+suffix,{method:req.method,headers,redirect:'manual',...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
   const out={...Object.fromEntries(r.headers)};delete out['transfer-encoding'];delete out['content-encoding'];delete out['content-length'];const responseBytes=Buffer.from(await r.arrayBuffer());if(kind==='auth'&&req.url.includes('grant_type=refresh_token')&&r.ok){const input=JSON.parse(Buffer.concat(chunks).toString()),output=JSON.parse(responseBytes.toString());h.authRotations.push({rotated:typeof output.refresh_token==='string'&&output.refresh_token!==input.refresh_token,status:r.status});}res.writeHead(r.status,out);res.end(responseBytes);
  }catch{res.writeHead(502);res.end();}});proxy.listen(58163,'127.0.0.1');await once(proxy,'listening');
  h.base='http://127.0.0.1:58164';const publicBase='http://127.0.0.1:58163';
  delete env.NODE_TEST_CONTEXT;
  const common={...env,VEXA_DATABASE_URL:`postgresql://${pc.connection.user}:${pc.connection.password}@localhost/postgres?host=${encodeURIComponent(sockets)}`,VEXA_SUPABASE_URL:publicBase,VEXA_SUPABASE_ANON_KEY:pc.anon,F02_BUILT:built};
  h.worker=async(actor=h.A,identity=h.bot,options={})=>{
   const c=fork(new URL('./worker.mjs',import.meta.url),[],{execPath:process.execPath,execArgv:[],env:{...common,VEXA_WORKER_EMAIL:identity.email,VEXA_WORKER_PASSWORD:identity.password,VEXA_WORKER_USER_ID:identity.id,VEXA_WORKER_TENANT:actor.tenant,...options},stdio:['ignore','ignore','ignore','ipc']});workers.add(c);
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clear();reject(Error('WORKER_START_TIMEOUT'));},10000);const clear=()=>{clearTimeout(timer);c.off('message',ready);c.off('exit',ended);c.off('error',failed);};const ready=m=>{clear();if(m.ready!==true)reject(Error('WORKER_READY_REQUIRED'));else resolve();};const ended=code=>{clear();reject(Error('WORKER_START_EXIT:'+code));};const failed=()=>{clear();reject(Error('WORKER_START_ERROR'));};c.once('message',ready);c.once('exit',ended);c.once('error',failed);});
   return {c,call(op,...args){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{c.off('message',receive);reject(Error('WORKER_TIMEOUT:'+op));},300000);function receive(m){clearTimeout(timer);resolve(m);}c.once('message',receive);c.send({op,args,barrier:op==='consumeBarrier'});});},
    barrier(final=false){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('BARRIER_TIMEOUT')),300000);c.once('message',m=>{clearTimeout(timer);resolve(m);});c.send({op:'consume',barrier:final?'final':true});});},
    async kill(){if(c.exitCode===null&&c.signalCode===null){const end=once(c,'exit');c.kill('SIGKILL');await end;}workers.delete(c);}};
  };
  h.triggerSecret=randomUUID()+randomUUID();
  h.startWeb=async(missing=false,options={})=>{
   web=spawn(process.execPath,[path.join(tmp,'node_modules/next/dist/bin/next'),'start',path.join(tmp,'apps/web'),'--hostname','127.0.0.1','--port','58164'],{cwd:tmp,env:{...common,NEXT_PUBLIC_SUPABASE_URL:publicBase,NEXT_PUBLIC_SUPABASE_ANON_KEY:pc.anon,NEXT_PUBLIC_SITE_URL:h.base,VEXA_IMPORT_CONFIRMATION_SECRET:randomUUID(),VEXA_DURABLE_CONSUMER:'enabled',VEXA_WORKER_TRIGGER_SECRET:h.triggerSecret,VEXA_WORKER_PLATFORM_TIMEOUT_MS:'60000',VEXA_WORKER_DISPATCHER:'enabled',VEXA_WORKER_EMAIL:h.bot.email,VEXA_WORKER_PASSWORD:h.bot.password,VEXA_WORKER_USER_ID:h.bot.id,...options,...(missing?{VEXA_DATABASE_URL:''}:{})},stdio:['ignore','ignore','ignore']});children.add(web);
   for(let i=0;i<150;i++){try{if((await fetch(h.base+'/api/health/version')).ok)return;}catch{}await delay(100);}throw Error('NEXT_START_TIMEOUT');
  };
  h.stopWeb=async()=>{if(web){const end=once(web,'exit');web.kill('SIGKILL');await end;children.delete(web);web=null;}};
  h.cookie=a=>'sb-127-auth-token=base64-'+Buffer.from(JSON.stringify({access_token:a.token,refresh_token:a.refresh,expires_at:Math.floor(Date.now()/1000)+1800,user:{id:a.id}})).toString('base64url')+'; vexa_active_org='+a.tenant;
  h.request=async(a,route,body,headers={})=>{const r=await fetch(h.base+route,{method:body===undefined?'GET':'POST',headers:{...(a?{cookie:h.cookie(a)}:{}),origin:h.base,'content-type':'application/json','idempotency-key':randomUUID(),Connection:'close',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});return {status:r.status,data:await r.json()};};
  h.browser=async()=>{if(!browser){
   browserBroker=resourceBroker();browserName='vexa-f01-04-'+randomUUID()+'-browser';
   const labels=browserBroker.reserve('container',browserName);
   assert.equal(spawnSync('docker',['run','--pull','never','-d','--name',browserName,...labels,'--add-host','host.docker.internal:host-gateway','-p','127.0.0.1:58165:9223','--entrypoint','sleep','mcp/playwright@sha256:8771dc4666e7c11440bfc6a0c6b00480e9a15b8891b45f29a52d7d995f8d1492','900'],{encoding:'utf8'}).status,0,'BROWSER_CONTAINER');
   const client=path.join(tmp,'browser-client');fs.mkdirSync(client);
   assert.equal(spawnSync('docker',['cp',browserName+':/app/node_modules/playwright-core',client],{encoding:'utf8',timeout:30000}).status,0,'BROWSER_CLIENT_COPY');
   const {chromium}=await import(pathToFileURL(path.join(client,'playwright-core/index.mjs')));
   const script=`const net=require('node:net');function bridge(local,remote,host,bind){net.createServer(s=>{const u=net.connect(remote,host);s.on('error',()=>u.destroy());u.on('error',()=>s.destroy());s.pipe(u);u.pipe(s);}).listen(local,bind);}bridge(58164,58164,'host.docker.internal','127.0.0.1');bridge(58163,58163,'host.docker.internal','127.0.0.1');bridge(9223,9222,'127.0.0.1','0.0.0.0');require('/app/node_modules/playwright-core').chromium.launch({executablePath:'/ms-playwright/chromium-1226/chrome-linux/chrome',headless:true,args:['--no-sandbox','--remote-debugging-port=9222']}).then(()=>setInterval(()=>{},1000));`;
   assert.equal(spawnSync('docker',['exec','-d',browserName,'node','-e',script]).status,0,'BROWSER_LAUNCH');
   let endpoint;for(let n=0;n<100;n++){try{const d=await(await fetch('http://127.0.0.1:58165/json/version')).json();endpoint=d.webSocketDebuggerUrl.replace('127.0.0.1:9222','127.0.0.1:58165').replace('localhost:9222','127.0.0.1:58165');break;}catch{}await delay(100);}assert.ok(endpoint,'CDP_READY');browser=await chromium.connectOverCDP(endpoint);
  }return browser;};
  h.browserDownload=async(page,click)=>{
   const session=await browser.newBrowserCDPSession(),target=await page.context().newCDPSession(page);
   const {targetInfo}=await target.send('Target.getTargetInfo');const destination='/tmp/f02-download-'+randomUUID();
   assert.equal(spawnSync('docker',['exec',browserName,'mkdir','-p',destination]).status,0,'DOWNLOAD_DIRECTORY');
   await session.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:destination,browserContextId:targetInfo.browserContextId,eventsEnabled:true});
   let timer;try{
    const complete=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('BROWSER_DOWNLOAD_TIMEOUT')),15000);session.on('Browser.downloadProgress',event=>{if(event.state==='completed')resolve(event.guid);if(event.state==='canceled')reject(Error('BROWSER_DOWNLOAD_CANCELLED'));});});
    await click();const guid=await complete;assert.match(guid,/^[0-9a-f-]{36}$/);
    const bytes=spawnSync('docker',['exec',browserName,'cat',destination+'/'+guid],{timeout:10000,maxBuffer:1024*1024});assert.equal(bytes.status,0,'BROWSER_DOWNLOAD_READ');return bytes.stdout;
   }finally{clearTimeout(timer);await target.detach();await session.detach();}
  };
  h.built=built;h.common=common;
  await h.startWeb();return h;
 }catch(e){await h.close();throw e;}
}
