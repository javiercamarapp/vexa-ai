// SYNTHETIC only. Reuses bank HTTP proxy/cookie pattern and owned F01 service lifecycle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createServer as httpServer} from 'node:http';
import {createServer as netServer} from 'node:net';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {launch,candidateInputs} from './infra.mjs';
const root=process.cwd(),tmp=process.env.F02_PRODUCT_TMP;const dbPassword=randomUUID();
assert.ok(tmp,'F02_PRODUCT_TMP required');
let h,proxy,tunnel,child;const transports=new Set();
const listen=async s=>{s.listen(0,'127.0.0.1');await once(s,'listening');return `http://127.0.0.1:${s.address().port}`;};
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
 proxy=httpServer(async(req,res)=>{try{const kind=req.url.startsWith('/auth/v1/')?'auth':req.url.startsWith('/storage/v1/')?'storage':'rest';const suffix=req.url.slice(kind==='storage'?11:8);const chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers};delete headers.host;delete headers['content-length'];const r=await fetch(`http://127.0.0.1:${h.bases[kind]}${suffix}`,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)}),redirect:'manual'});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(502);res.end();}});
 const publicBase=await listen(proxy);const reserve=httpServer();const base=await listen(reserve);await new Promise(r=>reserve.close(r));
 const cookie=actor=>'sb-127-auth-token=base64-'+Buffer.from(JSON.stringify({access_token:actor.token,refresh_token:'SYNTHETIC-unused',expires_at:Math.floor(Date.now()/1000)+1800,user:{id:actor.id}})).toString('base64url')+'; vexa_active_org='+(actor===a?A:B);
 const start=async(configured=true)=>{child=spawn(process.execPath,[path.join(tmp,'node_modules/next/dist/bin/next'),'start',path.join(tmp,'apps/web'),'--hostname','127.0.0.1','--port',new URL(base).port],{cwd:tmp,env:{PATH:process.env.PATH,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:publicBase,NEXT_PUBLIC_SUPABASE_ANON_KEY:h.anon,NEXT_PUBLIC_SITE_URL:base,...(configured?{VEXA_DATABASE_URL:`postgresql://f02_login:${dbPassword}@localhost/postgres?host=${encodeURIComponent(socketDir)}`,VEXA_IMPORT_CONFIRMATION_SECRET:'SYNTHETIC-'+randomUUID()}:{}),...secretEnv},stdio:['ignore','pipe','pipe']});child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health/version')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('NEXT_SETUP_FAILED');};
 const secretEnv={VEXA_IMPORT_CONFIRMATION_SECRET:'SYNTHETIC-'+randomUUID()};
 await start();console.log('SETUP Next ready');
 const csv=Buffer.from('text\nSYNTHETIC feedback\n'),sha=createHash('sha256').update(csv).digest('hex');
 const metadata={connection_id:C,mapping_version:'synthetic-v1',content_type:'text/csv',size:csv.length,sha256:sha};
 const req=async(route,{method='POST',body=metadata,actor=a,key=randomUUID(),origin=base}={})=>{const r=await fetch(base+route,{method,headers:{cookie:actor?cookie(actor):'',origin,'content-type':'application/json','idempotency-key':key},...(method==='GET'?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};};
 const ok=(r,status)=>{assert.equal(r.status,status,JSON.stringify(r));return r.data.data;};
 ok(await req('/api/imports',{actor:null}),401);ok(await req('/api/imports',{origin:'https://foreign.invalid'}),403);ok(await req('/api/imports',{origin:'null'}),403);console.log('PASS SSR anonymous/CSRF');
 const key=randomUUID();const all=await Promise.all(Array.from({length:4},()=>req('/api/imports',{key})));if(all[0].status!==201)console.log(spawnSync('docker',['logs',h.databaseName],{encoding:'utf8'}).stderr.split('\n').filter(x=>x.includes('SYNTHETIC_GUARD')).join('\n'));if(all[0].status!==201)console.log('DIAG imports persisted',h.sql('SELECT count(*) FROM public.imports'),'uploads',h.sql('SELECT count(*) FROM public.import_uploads'));const upload=ok(all[0],201);for(const r of all)assert.equal(ok(r,201).import_id,upload.import_id);assert.equal(h.sql('SELECT count(*) FROM public.imports'),'1');
 ok(await req('/api/imports',{key,body:{...metadata,size:metadata.size+1}}),409);console.log('PASS concurrent reservation/replay/conflict');
 ok(await req('/api/imports',{body:{...metadata,size:20971521}}),400);
 const send=async(u,bytes=csv)=>{const r=await fetch(u.upload_url,{method:'PUT',headers:{'content-type':'text/csv'},body:bytes});const text=await r.text();return {status:r.status,text};};
 let uploaded=await send(upload);assert.equal(uploaded.status,200,JSON.stringify(uploaded));
 const confirm=(u,options={})=>req('/api/imports/'+u.import_id+'/confirm',{body:{upload_token:u.upload_token,sha256:sha,mapping_version:metadata.mapping_version},...options});
 ok(await confirm(upload,{actor:b}),404);ok(await req('/api/imports/'+upload.import_id,{method:'GET',actor:b}),404);
 ok(await confirm({...upload,upload_token:'a'.repeat(43)}),403);console.log('PASS direct real Storage/foreign scope/capability');
 const confirmations=await Promise.all(Array.from({length:4},()=>confirm(upload)));for(const r of confirmations)assert.equal(ok(r,202).state,'queued');assert.equal(h.sql('SELECT count(*) FROM public.jobs'),'1');assert.equal(h.sql('SELECT count(*) FROM public.outbox'),'1');
 assert.equal(ok(await req('/api/imports/'+upload.import_id,{method:'GET'}),200).import.state,'queued');console.log('PASS concurrent confirmation -> one job/outbox; GET queued');
 await stop();await start();ok(await confirm(upload),202);assert.equal(h.sql('SELECT count(*) FROM public.jobs'),'1');console.log('PASS Next restart/replay durable');
 const bad=ok(await req('/api/imports'),201);assert.equal((await send(bad,Buffer.from('X'.repeat(csv.length)))).status,200);ok(await confirm(bad),422);assert.equal(h.sql(`SELECT state FROM public.imports WHERE id='${bad.import_id}'`),'reserved');console.log('PASS wrong real bytes rejected');
 const sized=ok(await req('/api/imports'),201);assert.notEqual((await send(sized,Buffer.from('x'))).status,200,'direct Storage size mismatch');assert.equal((await send(sized)).status,200);ok(await confirm(sized),202);console.log('PASS real Storage size mismatch denied; correct retry');
 const foreign=await fetch(`http://127.0.0.1:${h.bases.storage}/object/vexa-private/${upload.object_path}`,{method:'POST',headers:{Authorization:'Bearer '+b.token,apikey:h.anon,'content-type':'text/csv'},body:csv});assert.notEqual(foreign.status,200);assert.equal((await h.http('rest','/import_uploads?select=import_id',b.token)).data.length,0);console.log('PASS direct Storage and reservation RLS deny foreign tenant');
 const expire=ok(await req('/api/imports'),201);h.sql(`UPDATE public.import_uploads SET expires_at=now()-interval '1 second' WHERE import_id='${expire.import_id}'`);ok(await confirm(expire),403);const expUpload=await send(expire);assert.notEqual(expUpload.status,200,'expired Storage capability must not accept bytes');console.log('PASS expired reservation Storage deny');
 const crash=ok(await req('/api/imports'),201);assert.equal((await send(crash)).status,200);
 h.sql("CREATE FUNCTION public.synthetic_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC outbox interruption';END $$; CREATE TRIGGER synthetic_fail BEFORE INSERT ON public.outbox FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_outbox();");
 ok(await confirm(crash),503);assert.equal(h.sql(`SELECT state FROM public.imports WHERE id='${crash.import_id}'`),'reserved');assert.equal(h.sql(`SELECT count(*) FROM public.jobs WHERE import_id='${crash.import_id}'`),'0');h.sql('DROP TRIGGER synthetic_fail ON public.outbox;DROP FUNCTION public.synthetic_fail_outbox();');ok(await confirm(crash),202);console.log('PASS outbox failure rolls back job+transition, retry recovers');
 const interrupted=ok(await req('/api/imports'),201);assert.equal((await send(interrupted)).status,200);
 h.sql("CREATE FUNCTION public.synthetic_pause_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(15);RETURN NEW;END $$;CREATE TRIGGER synthetic_pause BEFORE INSERT ON public.outbox FOR EACH ROW EXECUTE FUNCTION public.synthetic_pause_outbox();");
 const pending=confirm(interrupted).catch(()=>null);
 let paused=false;for(let n=0;n<30;n++){await new Promise(r=>setTimeout(r,100));if(h.sql("SELECT count(*) FROM pg_stat_activity WHERE usename='f02_login' AND wait_event='PgSleep'")!=='0'){paused=true;break;}}
 assert.ok(paused,'fault must reach outbox write');await stop();await pending;await new Promise(r=>setTimeout(r,300));
 assert.equal(h.sql(`SELECT count(*) FROM public.jobs WHERE import_id='${interrupted.import_id}'`),'0');assert.equal(h.sql(`SELECT state FROM public.imports WHERE id='${interrupted.import_id}'`),'reserved');
 h.sql('DROP TRIGGER synthetic_pause ON public.outbox;DROP FUNCTION public.synthetic_pause_outbox();');await start();ok(await confirm(interrupted),202);console.log('PASS actual Next process crash during outbox write rolls back; restart recovers');
 assert.equal(h.sql("SELECT (NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)::text FROM pg_roles WHERE rolname='vexa_backend'"),'true');
 h.sql('ALTER ROLE f02_login SUPERUSER');ok(await req('/api/imports'),503);h.sql('ALTER ROLE f02_login NOSUPERUSER');console.log('PASS backend NOLOGIN/NOSUPERUSER/NOBYPASSRLS; unsafe login denied');
 h.sql(`UPDATE public.memberships SET role='viewer' WHERE tenant_id='${A}'`);ok(await req('/api/imports'),403);h.sql(`UPDATE public.memberships SET role='owner',status='revoked' WHERE tenant_id='${A}'`);ok(await req('/api/imports/'+upload.import_id,{method:'GET'}),403);h.sql(`UPDATE public.memberships SET status='active' WHERE tenant_id='${A}'`);console.log('PASS role/revocation revalidation');
 await stop();await start(false);ok(await req('/api/imports'),503);console.log('PASS absent Pg config 503');
 console.log('PRODUCT_HTTP_COMPLETE');
}catch(error){console.error(error);throw error;}finally{await stop();for(const c of transports)c.kill();if(tunnel)await new Promise(r=>tunnel.close(r));if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}if(h)h.close();}
