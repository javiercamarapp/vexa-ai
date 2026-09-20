import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';import {createServer} from 'node:http';import {createServer as netServer} from 'node:net';import {once} from 'node:events';import {randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {resourceBroker} from '../ci/resources.mjs';
import {copyBuildInputs,buildEnvironment} from '../../scaffold-copy.mjs';
import {completionExam} from './completion.mjs';
import {uiStates} from './ui-states.mjs';
import {browserExam} from './browser.mjs';import {clientBoundary} from './client-boundary.mjs';import {csv,mapping} from './fixtures.mjs';import {status} from './oracles.mjs';
export async function ssrExam(candidate){
 const {runtime,snapshot,q,hash}=await import(pathToFileURL(path.join(process.env.F02_PREVIEW_HARNESS,'runtime.mjs')));
 const ports=JSON.parse(process.env.F02_PREVIEW_PORTS),art=process.env.F02_PREVIEW_ARTIFACTS;
 const tmp=process.env.F02_PREVIEW_NEXT_DIR,sockets=process.env.F02_PREVIEW_PG_DIR;
 assert.ok(tmp&&sockets,'LAUNCHER_OWNED_SCRATCH_REQUIRED');
 assert.ok(fs.statSync(tmp).isDirectory()&&fs.statSync(sockets).isDirectory(),'LAUNCHER_SCRATCH_PRESENT');
 const broker=resourceBroker(),browserName='vexa-f01-04-'+randomUUID()+'-browser';let browserOwned=false;let h,child,proxy,tunnel,browser;const transports=new Set(),bodies=[];let storageFault=false,dbFault=false;const dbSockets=new Set();
 const base='http://127.0.0.1:'+ports[4],publicBase='http://127.0.0.1:'+ports[5],canary=randomUUID()+randomUUID();
 const stop=async()=>{if(child){const c=child;child=null;const done=once(c,'exit');c.kill('SIGKILL');await done;}};
 try{
 copyBuildInputs(candidate,tmp);const env={...buildEnvironment(process.env,tmp),VEXA_IMPORT_CONFIRMATION_SECRET:canary};
 for(const args of [['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],['run','build','--workspace','@vexa/web']]){
 const r=spawnSync('npm',args,{cwd:tmp,env,encoding:'utf8',timeout:120000,maxBuffer:8e6});fs.writeFileSync(path.join(art,args[0]+'.log'),r.stdout+r.stderr);assert.equal(r.status,0,'SETUP_BUILD_'+args[0]);console.log('PASS BUILD',args[0]);}
 h=await runtime(candidate);const db=h.processConfig.container.replace(/-storage$/,'-db');
 tunnel=netServer(socket=>{if(dbFault){socket.destroy();return;}dbSockets.add(socket);socket.on('close',()=>dbSockets.delete(socket));const c=spawn('docker',['exec','-i',db,'nc','127.0.0.1','5432'],{stdio:['pipe','pipe','ignore']});transports.add(c);socket.pipe(c.stdin);c.stdout.pipe(socket);socket.on('error',()=>{});c.stdin.on('error',()=>{});socket.on('close',()=>c.kill());c.on('exit',()=>{transports.delete(c);socket.destroy();});});tunnel.listen(sockets+'/.s.PGSQL.5432');await once(tunnel,'listening');
 proxy=createServer(async(req,res)=>{try{
 const kind=req.url.startsWith('/auth/v1/')?0:req.url.startsWith('/storage/v1/')?1:2;
 // Local API gateway CORS policy: exact application origin, no wildcard, real Storage bytes.
 if(kind===1&&req.headers.origin){
  if(req.headers.origin!==base){res.writeHead(403);res.end();return;}
  res.setHeader('Access-Control-Allow-Origin',base);res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){
   const requested=(req.headers['access-control-request-headers']??'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
   if(!['PUT','GET','POST'].includes(req.headers['access-control-request-method'])||requested.some(x=>!['content-type','authorization','apikey','x-client-info','x-upsert'].includes(x))){res.writeHead(403);res.end();return;}
   res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT');res.setHeader('Access-Control-Allow-Headers',requested.join(', '));res.writeHead(204);res.end();return;
  }
 }
 if(storageFault&&kind===1){res.writeHead(503);res.end();return;}
 const suffix=req.url.slice(kind===1?11:8),chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers};delete headers.host;delete headers['content-length'];
 const r=await fetch('http://127.0.0.1:'+ports[kind]+suffix,{method:req.method,headers,redirect:'manual',...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
 // fetch decompresses payloads; forwarding the original encoding/length corrupts browser transport.
 const outgoing=Object.fromEntries(r.headers);delete outgoing['content-encoding'];delete outgoing['content-length'];delete outgoing['transfer-encoding'];
 if(kind===1&&['OPTIONS','PUT'].includes(req.method))console.log('STORAGE_TRANSPORT',JSON.stringify({method:req.method,status:r.status,origin:req.headers.origin??null,allowOrigin:outgoing['access-control-allow-origin'],allowMethods:outgoing['access-control-allow-methods'],allowHeaders:outgoing['access-control-allow-headers']}));
 res.writeHead(r.status,outgoing);res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(502);res.end();}});proxy.listen(ports[5],'0.0.0.0');await once(proxy,'listening');
 const connection=h.processConfig.connection;
 const start=async(overrides={})=>{child=spawn(process.execPath,[path.join(tmp,'node_modules/next/dist/bin/next'),'start',path.join(tmp,'apps/web'),'--hostname','0.0.0.0','--port',String(ports[4])],{cwd:tmp,env:{...env,NEXT_PUBLIC_SUPABASE_URL:publicBase,NEXT_PUBLIC_SUPABASE_ANON_KEY:h.processConfig.anon,NEXT_PUBLIC_SITE_URL:base,VEXA_DATABASE_URL:`postgresql://${connection.user}:${connection.password}@localhost/postgres?host=${encodeURIComponent(sockets)}`,...overrides},stdio:['ignore','pipe','pipe']});child.stdout.resume();child.stderr.resume();for(let n=0;n<150;n++){try{if((await fetch(base+'/api/health/version')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}assert.fail('SETUP_NEXT_START');};
 const cookie=a=>'sb-127-auth-token=base64-'+Buffer.from(JSON.stringify(a.session)).toString('base64url')+'; vexa_active_org='+a.tenant;
 const request=async(a,route,body,extra={})=>{const r=await fetch(base+'/api/imports'+route,{method:body===undefined?'GET':'POST',headers:Object.fromEntries(Object.entries({cookie:cookie(a),origin:base,'content-type':'application/json','idempotency-key':randomUUID(),Connection:'close',...extra}).filter(([,v])=>v!==undefined)),body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();bodies.push(text);let data;try{data=JSON.parse(text);}catch{}return{status:r.status,data,text};};
 await start();assert.equal((await fetch(publicBase+'/storage/v1/object/test',{method:'OPTIONS',headers:{Origin:'https://foreign.invalid','Access-Control-Request-Method':'PUT'}})).status,403,'GATEWAY_FOREIGN_ORIGIN');status(await request(h.A,''),200,'SSR_AUTH_POSITIVE');console.log('PASS SSR AUTH');
 const bytes=csv(),meta={connection_id:h.A.connection,mapping_version:'interactive-unmapped-v1',content_type:'text/csv',size:bytes.length,sha256:hash(bytes)};
 status(await request(h.A,'',meta,{origin:'https://foreign.invalid'}),403,'SSR_ORIGIN');status(await request(h.A,'',meta,{origin:'null'}),403,'SSR_NULL_ORIGIN');
 const r=status(await request(h.A,'',meta),201,'SSR_RESERVE'),id='/'+r.import_id;
 assert.equal(new URL(r.upload_url).origin,publicBase);assert.equal((await fetch(r.upload_url,{method:'PUT',headers:{'content-type':'text/csv'},body:bytes})).status,200,'SSR_UPLOAD');
 status(await request(h.A,id+'/preview',{mapping}),200,'SSR_PREVIEW');status(await request(h.B,id),404,'SSR_B_DENIED');
 const variants=[mapping,{...mapping,timezone:'America/New_York'}];const races=await Promise.all(variants.map(mapping=>request(h.A,id+'/mapping',{mapping,expected_version:meta.mapping_version})));
 assert.deepEqual(races.map(r=>r.status).sort(),[200,409],'CAS_CONCURRENT_ONE_WINNER');const winner=races.find(r=>r.status===200).data.data;
 const second=status(await request(h.A,id+'/mapping',{mapping:{...mapping,timezone:'America/Mexico_City'},expected_version:winner.mapping_version}),200,'HISTORY_SECOND');
 const before=snapshot(h,r.import_id);assert.equal(before.imports[0].provenance.mapping_history.length,2,'HISTORY_TWO');
 await stop();await start();status(await request(h.A,id),200,'NEXT_RESTART');assert.deepEqual(snapshot(h,r.import_id),before,'RESTART_DURABLE');console.log('PASS SSR ORIGIN CAS HISTORY RESTART');
 storageFault=true;try{status(await request(h.A,id+'/preview',{mapping}),503,'STORAGE_FAILURE_NOT_EMPTY');}finally{storageFault=false;}status(await request(h.A,id+'/preview',{mapping}),200,'STORAGE_RECOVERY');
 dbFault=true;for(const socket of dbSockets)socket.destroy();try{status(await request(h.A,id),503,'DB_FAILURE_NOT_EMPTY');}finally{dbFault=false;}status(await request(h.A,id),200,'DB_RECOVERY');console.log('PASS SSR DB STORAGE RECOVERY');
 const {chromium}=await import(pathToFileURL(process.env.F02_PLAYWRIGHT_MODULE??'/tmp/vexa-ui-review-llPAzp/node_modules/playwright-core/index.mjs'));
 const labels=broker.reserve('container',browserName);browserOwned=true;
 const launched=spawnSync('docker',['run','--pull','never','-d','--name',browserName,...labels,'--mount',`type=bind,source=${art},target=${art}`,'--add-host','host.docker.internal:host-gateway','-p',`127.0.0.1:${ports[3]}:9223`,'--entrypoint','sleep','mcp/playwright@sha256:8771dc4666e7c11440bfc6a0c6b00480e9a15b8891b45f29a52d7d995f8d1492','600'],{encoding:'utf8'});assert.equal(launched.status,0,'SETUP_BROWSER_CONTAINER');
 const script=`const net=require('node:net');function bridge(local,remote,host,bind){net.createServer(s=>{const u=net.connect(remote,host);s.on('error',()=>u.destroy());u.on('error',()=>s.destroy());s.pipe(u);u.pipe(s);}).listen(local,bind);}bridge(${ports[4]},${ports[4]},'host.docker.internal','127.0.0.1');bridge(${ports[5]},${ports[5]},'host.docker.internal','127.0.0.1');bridge(9223,9222,'127.0.0.1','0.0.0.0');require('/app/node_modules/playwright-core').chromium.launch({executablePath:'/ms-playwright/chromium-1226/chrome-linux/chrome',headless:true,args:['--no-sandbox','--remote-debugging-port=9222']}).then(()=>setInterval(()=>{},1000));`;
 assert.equal(spawnSync('docker',['exec','-d',browserName,'node','-e',script]).status,0,'SETUP_BROWSER_LAUNCH');
 let endpoint;for(let n=0;n<100;n++){try{const data=await (await fetch('http://127.0.0.1:'+ports[3]+'/json/version')).json();endpoint=data.webSocketDebuggerUrl.replace('127.0.0.1:9222','127.0.0.1:'+ports[3]).replace('localhost:9222','127.0.0.1:'+ports[3]);break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(endpoint,'SETUP_CDP');browser=await chromium.connectOverCDP(endpoint);
 const context=await browser.newContext();await context.addCookies(cookie(h.A).split('; ').map(c=>({name:c.slice(0,c.indexOf('=')),value:c.slice(c.indexOf('=')+1),url:base,httpOnly:true,sameSite:'Lax'})));
 const page=await context.newPage();const downloads=path.join(art,'downloads');fs.mkdirSync(downloads);const cdp=await context.newCDPSession(page);const {targetInfo}=await cdp.send('Target.getTargetInfo');await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',browserContextId:targetInfo.browserContextId,downloadPath:downloads,eventsEnabled:true});page.setDefaultTimeout(12000);page.on('response',async r=>{if(r.url().startsWith(base)&&!r.url().includes('/_next/'))try{bodies.push(await r.text());}catch{}});
 page.on('console',m=>{if(m.type()==='error')console.log('BROWSER_ERROR',m.text().replace(/https?:\/\/[^\s'"]+/g,u=>{try{return new URL(u).origin+new URL(u).pathname;}catch{return '[url]';}}));});
 page.on('requestfailed',r=>console.log('BROWSER_TRANSPORT',r.method(),new URL(r.url()).pathname,r.failure()?.errorText));
 const m10=clientBoundary(tmp,bodies,canary);console.log('PASS M10',JSON.stringify(m10));
 const html=await (await fetch(base+'/imports',{headers:{cookie:cookie(h.A)}})).text();assert.ok(!html.includes(h.A.token),'M10_AUTH_JWT_NOT_IN_SSR');bodies.push(html);
 const uiFailures=[];try{await browserExam(page,{base,storageOrigin:publicBase,connectionId:h.A.connection});console.log('PASS BROWSER POSITIVE');}catch(error){uiFailures.push(error);console.log('UI_POSITIVE_FAILURE',error.code??error.name,error.message.split('\n')[0]);}
 try{await uiStates(page,{downloadBytes:()=>{const files=fs.readdirSync(downloads).filter(n=>!n.endsWith('.crdownload')).map(n=>path.join(downloads,n)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);assert.ok(files.length,'DOWNLOAD_BYTES_PRESENT');return fs.readFileSync(files[0]);},base,connectionId:h.A.connection,revoke:()=>h.sql(`UPDATE memberships SET status='revoked',permissions_version=permissions_version+1 WHERE user_id=${q(h.A.id)}`),restore:()=>h.sql(`UPDATE memberships SET status='active',permissions_version=permissions_version+1 WHERE user_id=${q(h.A.id)}`),empty:()=>h.sql(`UPDATE connections SET status='disabled' WHERE id=${q(h.A.connection)}`),unempty:()=>h.sql(`UPDATE connections SET status='active' WHERE id=${q(h.A.connection)}`)});}catch(error){uiFailures.push(error);console.log('UI_STATES_FAILURE',error.code??error.name,error.message.split('\n')[0]);}
 await completionExam(page,{base,h,request,status,q,hash,snapshot,stop,start});
 console.log('PASS M10 FINAL',JSON.stringify(clientBoundary(tmp,bodies,canary)));if(uiFailures.length)throw new AggregateError(uiFailures,'UI_INCOMPLETE');
 }finally{
 const cleanupErrors=[];const clean=async fn=>{try{await fn();}catch(e){cleanupErrors.push(e);}};
 await clean(async()=>{if(browser)await browser.close();});await clean(()=>{if(browserOwned)broker.remove('container',browserName);});await clean(stop);
 for(const c of transports)c.kill();for(const socket of dbSockets)socket.destroy();
 await clean(async()=>{if(tunnel)await new Promise(r=>tunnel.close(r));});await clean(async()=>{if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}});
 await clean(()=>{if(h)h.close();}); // The launcher alone removes its own scratch allocations.
 assert.equal(cleanupErrors.length,0,'SSR_CLEANUP_ALL_STAGES');console.log('SSR_LOCAL_CLEANUP');
 }
}
if(process.argv[1]===new URL(import.meta.url).pathname)await ssrExam(process.env.VEXA_CANDIDATE);
