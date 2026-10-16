import {resourceBroker} from '../../../tests/acceptance/support/ci/resources.mjs';
// SYNTHETIC only. Reuses bank HTTP proxy/cookie pattern and owned F01 service lifecycle.
import assert from 'node:assert/strict';
import {archive,parts} from '../../ingestion/mapping-fixtures.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createServer as httpServer} from 'node:http';
import {createServer as netServer} from 'node:net';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {launch,candidateInputs} from './mapping-infra.mjs';
const root=process.cwd(),tmp=process.env.F02_PRODUCT_TMP;const dbPassword=randomUUID();
assert.ok(tmp,'F02_PRODUCT_TMP required');
let h,proxy,tunnel,child;const transports=new Set();
let nextPort=57910; const listen=async s=>{for(;nextPort<=57949;nextPort++){try{s.listen(nextPort,'127.0.0.1');await once(s,'listening');nextPort++;return `http://127.0.0.1:${s.address().port}`;}catch{}}throw Error('NO_FREE_PORT');};
const stop=async()=>{if(child){const c=child;child=null;c.kill('SIGTERM');const kill=setTimeout(()=>c.kill('SIGKILL'),2000);await once(c,'exit');clearTimeout(kill);}};
try {
 h=await launch({services:true});for(const sql of candidateInputs(root))h.sql(sql);console.log('SETUP real services and migrations ready');
 const a=await h.user(),b=await h.user(),A=randomUUID(),B=randomUUID(),C=randomUUID();
 h.sql(`INSERT INTO public.organizations(id,name) VALUES('${A}','SYNTHETIC A'),('${B}','SYNTHETIC B'); INSERT INTO public.memberships(tenant_id,user_id,role,status) VALUES('${A}','${a.id}','owner','active'),('${B}','${b.id}','owner','active');INSERT INTO public.connections(id,tenant_id,source,account_id) VALUES('${C}','${A}','csv','SYNTHETIC');CREATE ROLE f02_login LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${dbPassword}';GRANT vexa_backend TO f02_login;`);
 // PostgreSQL protocol carried over own Unix socket + docker exec; no published DB port.
 const socketDir=fs.mkdtempSync('/tmp/vexa-f02-socket-');
 tunnel=netServer(socket=>{const c=spawn('docker',['exec','-i',h.databaseName,'nc','127.0.0.1','5432'],{stdio:['pipe','pipe','ignore']});transports.add(c);socket.pipe(c.stdin);c.stdout.pipe(socket);socket.on('error',()=>{});c.stdin.on('error',()=>{});socket.on('close',()=>c.kill());c.on('exit',()=>{transports.delete(c);socket.destroy();});});
 tunnel.listen(socketDir+'/.s.PGSQL.5432');await once(tunnel,'listening');
 const {Pool}=createRequire(path.join(tmp,'package.json'))('pg');const diagnostic=new Pool({host:socketDir,user:'f02_login',password:dbPassword,database:'postgres',connectionTimeoutMillis:3000});
 try{const d=await diagnostic.query('SELECT current_user');console.log('SETUP real pg driver',d.rows); }finally{await diagnostic.end();}
 proxy=httpServer(async(req,res)=>{try{
 // Test gateway: explicit CORS policy, bytes still reach real Storage unchanged.
 // Bare storage-api image has no public Supabase gateway in this isolated stack.
 const allowed=req.headers.origin===base&&req.url.startsWith('/storage/v1/');
 if(allowed&&!process.env.F02_RAW_GATEWAY){res.setHeader('Access-Control-Allow-Origin',base);res.setHeader('Vary','Origin');if(req.method==='OPTIONS'){const valid=req.headers['access-control-request-method']==='PUT'&&req.headers['access-control-request-headers']==='content-type';res.setHeader('Access-Control-Allow-Methods','PUT');res.setHeader('Access-Control-Allow-Headers','content-type');console.log('GATEWAY_PREFLIGHT',valid?204:403,'origin matched; PUT/content-type');res.writeHead(valid?204:403);res.end();return;}}
 const kind=req.url.startsWith('/auth/v1/')?'auth':req.url.startsWith('/storage/v1/')?'storage':'rest';const suffix=req.url.slice(kind==='storage'?11:8);const chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers};delete headers.host;delete headers['content-length'];const r=await fetch(`http://127.0.0.1:${h.bases[kind]}${suffix}`,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)}),redirect:'manual'});if(kind==='storage')console.log('PROXY_STORAGE',req.method,r.status,JSON.stringify({origin:req.headers.origin??null,requestMethod:req.headers['access-control-request-method']??null,requestHeaders:req.headers['access-control-request-headers']??null,allowOrigin:r.headers.get('access-control-allow-origin'),allowMethods:r.headers.get('access-control-allow-methods'),allowHeaders:r.headers.get('access-control-allow-headers')}));const responseHeaders=new Headers(r.headers);responseHeaders.delete('content-encoding');responseHeaders.delete('content-length');res.writeHead(r.status,Object.fromEntries(responseHeaders));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){console.log('PROXY_ERROR',req.method,e.code??e.cause?.code??e.name);res.writeHead(502);res.end();}});
 const publicBase=await listen(proxy);const reserve=httpServer();const base=await listen(reserve);await new Promise(r=>reserve.close(r));
 const cookie=actor=>'sb-127-auth-token=base64-'+Buffer.from(JSON.stringify({access_token:actor.token,refresh_token:'SYNTHETIC-unused',expires_at:Math.floor(Date.now()/1000)+1800,user:{id:actor.id}})).toString('base64url')+'; vexa_active_org='+(actor===a?A:B);
 const start=async(configured=true)=>{child=spawn(process.execPath,[path.join(tmp,'node_modules/next/dist/bin/next'),'start',path.join(tmp,'apps/web'),'--hostname','127.0.0.1','--port',new URL(base).port],{cwd:tmp,env:{PATH:process.env.PATH,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:publicBase,NEXT_PUBLIC_SUPABASE_ANON_KEY:h.anon,NEXT_PUBLIC_SITE_URL:base,...(configured?{VEXA_DATABASE_URL:`postgresql://f02_login:${dbPassword}@localhost/postgres?host=${encodeURIComponent(socketDir)}`,VEXA_IMPORT_CONFIRMATION_SECRET:'SYNTHETIC-'+randomUUID()}:{}),...secretEnv},stdio:['ignore','pipe','pipe']});child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health/version')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('NEXT_SETUP_FAILED');};
 const secretEnv={VEXA_IMPORT_CONFIRMATION_SECRET:'SYNTHETIC-'+randomUUID()};
 await start();console.log('SETUP Next ready');
 const csv=Buffer.from('id,text,date,amount\na,SYNTHETIC,01/02/2026,10.01\nb,SYNTHETIC,31/02/2026,1\n'),sha=createHash('sha256').update(csv).digest('hex');
 const metadata={connection_id:C,mapping_version:'synthetic-v1',content_type:'text/csv',size:csv.length,sha256:sha};
 const req=async(route,{method='POST',body=metadata,actor=a,key=randomUUID(),origin=base}={})=>{const r=await fetch(base+route,{method,headers:{cookie:actor?cookie(actor):'',origin,'content-type':'application/json','idempotency-key':key},...(method==='GET'?{}:{body:JSON.stringify(body)})});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={error:{code:'non_json_response'}};}return {status:r.status,data};};
 const ok=(r,status)=>{assert.equal(r.status,status,JSON.stringify(r));return r.data.data;};

 const upload=ok(await req('/api/imports'),201);
 assert.equal((await fetch(upload.upload_url,{method:'PUT',headers:{'content-type':'text/csv'},body:csv})).status,200);
 const mapping={columns:{id:'id',text:'text',date:'date',amount:'amount'},timezone:'America/New_York',dateFormat:'dmy',currency:'USD'};
 const saved=ok(await req('/api/imports/'+upload.import_id+'/mapping',{body:{mapping,expected_version:metadata.mapping_version}}),200);
 const renewalBody={sha256:sha,mapping_version:saved.mapping_version};
 const renew=(options={})=>req('/api/imports/'+upload.import_id+'/renew',{body:renewalBody,...options});
 const baseline=ok(await renew(),200);assert.equal(baseline.import_id,upload.import_id);assert.equal(baseline.renewed,false);assert.equal(baseline.upload_token,saved.upload_token);
 console.log('PASS active reservation renewal is idempotent');
 for(const [options,status] of [[{actor:null},401],[{actor:b},404],[{origin:'https://foreign.invalid'},403],[{body:{...renewalBody,sha256:'0'.repeat(64)}},409],[{body:{...renewalBody,mapping_version:'wrong'}},409],[{body:{...renewalBody,tenant_id:B}},400]])ok(await renew(options),status);
 for(const role of ['operator','viewer']){h.sql(`UPDATE public.memberships SET role='${role}' WHERE tenant_id='${A}' AND user_id='${a.id}'`);ok(await renew(),403);}
 h.sql(`UPDATE public.memberships SET role='analyst' WHERE tenant_id='${A}' AND user_id='${a.id}'`);
 h.sql(`UPDATE public.import_uploads SET expires_at=now()-interval '1 second' WHERE tenant_id='${A}' AND import_id='${upload.import_id}'`);
 const expired={upload_token:saved.upload_token};
 const priorExpiry=h.sql(`SELECT expires_at::text FROM public.import_uploads WHERE import_id='${upload.import_id}'`);
 h.sql(`UPDATE public.connections SET status='disabled' WHERE tenant_id='${A}' AND id='${C}'`);ok(await renew(),404);
 assert.equal(h.sql(`SELECT expires_at::text FROM public.import_uploads WHERE import_id='${upload.import_id}'`),priorExpiry);
 h.sql(`UPDATE public.connections SET status='active' WHERE tenant_id='${A}' AND id='${C}'`);
 const renewals=await Promise.all(Array.from({length:4},()=>renew()));const values=renewals.map(r=>ok(r,200));
 assert.equal(values.filter(v=>v.renewed).length,1);assert.equal(new Set(values.map(v=>v.upload_token)).size,1);assert.equal(new Set(values.map(v=>v.expires_at)).size,1);assert(values.every(v=>v.import_id===upload.import_id));
 assert.notEqual(values[0].upload_token,expired.upload_token);assert.equal(h.sql(`SELECT count(*) FROM public.imports WHERE tenant_id='${A}'`),'1');assert.equal(h.sql(`SELECT count(*) FROM public.jobs WHERE tenant_id='${A}'`),'0');
 assert.equal(h.sql(`SELECT (expires_at>clock_timestamp() AND expires_at<=clock_timestamp()+interval '15 minutes')::text FROM public.import_uploads WHERE import_id='${upload.import_id}'`),'true');
 console.log('PASS expired renewal: four requests, one expiry change, same import, no job');
 const fresh=ok(await req('/api/imports/'+upload.import_id,{method:'GET'}),200);assert.equal(fresh.mapping_history.length,1);assert.equal(fresh.import.file_hash,sha);assert.deepEqual(fresh.mapping,saved.mapping);
 const confirmToken=t=>req('/api/imports/'+upload.import_id+'/confirm',{body:{upload_token:t,sha256:sha,mapping_version:saved.mapping_version}});
 ok(await confirmToken(expired.upload_token),403);ok(await confirmToken(saved.upload_token),403);
 const job=ok(await confirmToken(values[0].upload_token),202);const replay=ok(await confirmToken(values[0].upload_token),202);assert.equal(replay.job_id,job.job_id);
 ok(await renew(),409);assert.equal(h.sql(`SELECT count(*) FROM public.jobs WHERE import_id='${upload.import_id}'`),'1');assert.equal(h.sql(`SELECT count(*) FROM public.outbox WHERE job_id='${job.job_id}'`),'1');
 console.log('PASS same stored bytes/mapping; old capabilities rejected; one confirmed job; queued renewal denied');
 console.log('RESERVATION_RENEWAL_HTTP_COMPLETE');
}catch(error){console.error(error);throw error;}finally{await stop();for(const c of transports)c.kill();if(tunnel)await new Promise(r=>tunnel.close(r));if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}if(h)h.close();}
