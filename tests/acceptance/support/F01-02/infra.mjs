import {resourceBroker} from '../ci/resources.mjs';
// Control-plane infrastructure only. No shared Supabase fallback.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawnSync} from 'node:child_process';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
export const descriptor=Object.freeze({appPort:57570,apiPort:57571,mailPort:57572,browserPort:57573,origin:'http://127.0.0.1:57570',authURL:'http://127.0.0.1:57571',mailURL:'http://127.0.0.1:57572'});
const images={storage:'public.ecr.aws/supabase/storage-api@sha256:97ed68d33417d253a45fe0a70f84324d92250a3e239bf18aa6cf87269dbf6727',db:'public.ecr.aws/supabase/postgres@sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f',auth:'public.ecr.aws/supabase/gotrue@sha256:362659ca70eaa75ba05bbaf963caa84c1c5afe5e8fbf0777e17b830dd5f0f60a',rest:'public.ecr.aws/supabase/postgrest@sha256:5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d',mail:'public.ecr.aws/supabase/mailpit@sha256:37a38e48e9338cd7e89dfeb487f37b02ebfcd9cb23111bed2d345e79d37d6dd6',node:'mcp/playwright@sha256:8771dc4666e7c11440bfc6a0c6b00480e9a15b8891b45f29a52d7d995f8d1492'};
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});assert.ok(!r.error&&r.status===0,`INFRA_AUTH: docker ${args[0]} failed (${r.status??r.error?.code}); details suppressed`);return r.stdout.trim();}
export async function checkPorts(){for(const port of [57570,57571,57572,57573])await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(new Error(`INFRA_AUTH: port ${port} occupied; owner untouched`)));s.listen(port,'0.0.0.0',()=>s.close(resolve));});}
export async function launch(candidate,tmp){
 await checkPorts();
 for(const image of Object.values(images))assert.equal(docker(['image','inspect',image,'--format','{{.Os}}/{{.Architecture}}']),'linux/arm64','INFRA_AUTH: expected linux/arm64');
 const resources=resourceBroker();
 const owner='vexa-f01-02-'+randomUUID(),owned=[];let network=false,closed=false;
 const artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'f0105-auth-evidence-'));
 const signals=new Map();
 const password='SYN-'+randomBytes(24).toString('hex'),secret=randomBytes(32).toString('hex');
 const envFiles=[];
 const run=(kind,image,env={},ports=[],extra=[])=>{
  const name=owner+'-'+kind,envFile=path.join(tmp,kind+'.env');
  fs.writeFileSync(envFile,Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n'),{mode:0o600});envFiles.push(envFile);
  // Reserve unique name before run, including partial creation on bind failure.
  owned.push(name);
  docker(['run','--pull','never','-d','--name',name,...resources.reserve('container',name),'--label',`vexa.auth.owner=${owner}`,'--network',owner,'--env-file',envFile,...ports.flatMap(([host,inside])=>['-p',`127.0.0.1:${host}:${inside}`]),...extra,image]);return name;
 };
 const h={owner,secret,artifacts,sql(query){return docker(['exec','-i',owner+'-db','psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],query);},
 close(){if(closed)return;for(const [signal,handler] of signals)process.removeListener(signal,handler);h.stopAppSync?.();const failures=[];for(const name of [...owned].reverse()){
  const r=spawnSync('docker',['inspect',name,'--format','{{ index .Config.Labels "vexa.auth.owner" }}'],{encoding:'utf8'});
  if(r.status!==0){if(/No such object/.test(r.stderr))continue;failures.push(name);continue;}
  if(r.stdout.trim()!==owner){failures.push(name);continue;}
  const logs=spawnSync('docker',['logs','--tail','30',name],{encoding:'utf8'});
  const safe=(logs.stdout+logs.stderr).replaceAll(password,'[PASSWORD]').replaceAll(secret,'[SIGNER]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[JWT]').replace(/https?:\/\/[^\s"<>]+/g,'[URL]').replace(/[A-Za-z0-9_.+-]+@example\.test/g,'[EMAIL]');
  fs.writeFileSync(path.join(artifacts,name+'.log'),safe,{mode:0o600});
  try{resources.remove('container',name);}catch{failures.push(name);}
 }if(network){try{assert.equal(docker(['network','inspect',owner,'--format','{{ index .Labels "vexa.auth.owner" }}']),owner);resources.remove('network',owner);}catch{failures.push(owner);}}
 for(const f of envFiles)fs.rmSync(f,{force:true});closed=failures.length===0;assert.deepEqual(failures,[],'TEARDOWN_AUTH: owned resources remain');
 fs.writeFileSync(path.join(artifacts,'cleanup.json'),JSON.stringify({owner,removed:owned,networkRemoved:network}));
 console.log('AUTH_INFRA_CLEANUP '+JSON.stringify({owner,artifacts,remaining:failures}));},
 };
 for(const [signal,code] of [['SIGINT',130],['SIGTERM',143]]){const handler=()=>{try{h.close();}finally{process.exit(code);}};signals.set(signal,handler);process.once(signal,handler);}
 try{
  network=true;docker(['network','create',...resources.reserve('network',owner),'--label',`vexa.auth.owner=${owner}`,owner]);
  run('db',images.db,{POSTGRES_PASSWORD:password});
  let ready=false;for(let i=0;i<100;i++){try{docker(['exec',owner+'-db','pg_isready','-h','127.0.0.1']);ready=h.sql("SELECT count(*) FROM pg_roles WHERE rolname IN ('authenticator','supabase_auth_admin')")==='2';if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'INFRA_AUTH: DB not ready');
  assert.equal(docker(['inspect',owner+'-db','--format','{{json .HostConfig.PortBindings}}']),'{}','INFRA_AUTH: DB published');
  h.sql(`ALTER ROLE authenticator PASSWORD '${password}'; ALTER ROLE supabase_auth_admin PASSWORD '${password}'; ALTER ROLE supabase_storage_admin PASSWORD '${password}';`);
  run('mail',images.mail,{},[[57572,8025]]);
  run('auth',images.auth,{GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:9999,API_EXTERNAL_URL:descriptor.authURL,GOTRUE_SITE_URL:descriptor.origin,GOTRUE_URI_ALLOW_LIST:descriptor.origin+'/**',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${password}@${owner}-db:5432/postgres`,GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_DISABLE_SIGNUP:false,GOTRUE_MAILER_AUTOCONFIRM:false,GOTRUE_SMTP_HOST:owner+'-mail',GOTRUE_SMTP_PORT:1025,GOTRUE_SMTP_ADMIN_EMAIL:'auth@example.test',GOTRUE_SMTP_SENDER_NAME:'Synthetic Auth',GOTRUE_SMTP_MAX_FREQUENCY:'0s',GOTRUE_RATE_LIMIT_EMAIL_SENT:1000,GOTRUE_MAILER_URLPATHS_CONFIRMATION:'/auth/v1/verify',GOTRUE_MAILER_URLPATHS_MAGICLINK:'/auth/v1/verify',GOTRUE_MAILER_URLPATHS_RECOVERY:'/auth/v1/verify'});
  const nodeContainer=(kind,code,ports=[],extra=[])=>{
   const file=path.join(tmp,kind+'.cjs');fs.writeFileSync(file,code);
   const name=owner+'-'+kind;owned.push(name);
   docker(['run','--pull','never','-d','--name',name,...resources.reserve('container',name),'--label',`vexa.auth.owner=${owner}`,'--network',owner,...ports.flatMap(([a,b])=>['-p',`127.0.0.1:${a}:${b}`]),'--mount',`type=bind,src=${file},dst=/tmp/run.cjs,readonly`,...extra,'--entrypoint','node',images.node,'/tmp/run.cjs']);
  };
  nodeContainer('gateway',`const http=require('node:http');http.createServer((req,res)=>{const auth=req.url.startsWith('/auth/v1/'),rest=req.url.startsWith('/rest/v1/');if(!auth&&!rest){res.writeHead(404).end();return;}const p=http.request({hostname:'${owner}-'+(auth?'auth':'rest'),port:auth?9999:3000,path:req.url.replace(auth?'/auth/v1':'/rest/v1','')||'/',method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});p.on('error',()=>res.writeHead(502).end());req.pipe(p)}).listen(57571,'0.0.0.0');`,[[57571,57571]]);
  for(let i=0;i<100;i++){try{if((await fetch(descriptor.authURL+'/auth/v1/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}ready=false;await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'INFRA_AUTH: Auth not ready');
  run('rest',images.rest,{PGRST_DB_URI:`postgres://authenticator:${password}@${owner}-db:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret});
  const sign=role=>{const data=[{alg:'HS256',typ:'JWT'},{role,iss:'supabase',exp:Math.floor(Date.now()/1000)+1800}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');};
  // Full baseline SQL contains storage policies; use the real isolated migrator.
  run('storage',images.storage,{DATABASE_URL:`postgres://supabase_storage_admin:${password}@${owner}-db:5432/postgres`,POSTGREST_URL:`http://${owner}-rest:3000`,PGRST_JWT_SECRET:secret,AUTH_JWT_SECRET:secret,ANON_KEY:sign('anon'),SERVICE_KEY:sign('service_role'),STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/tmp/storage',TENANT_ID:owner,REGION:'local',GLOBAL_S3_BUCKET:owner});
  ready=false;for(let i=0;i<100;i++){try{ready=h.sql("SELECT to_regclass('storage.objects') IS NOT NULL AND to_regclass('storage.buckets') IS NOT NULL")==='t';if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'INFRA_AUTH: storage migration prerequisite unavailable');
  for(const file of fs.readdirSync(path.join(candidate,'supabase/migrations')).filter(f=>/^\d.*\.sql$/.test(f)).sort()){const p=path.join(candidate,'supabase/migrations',file);assert.ok(!fs.lstatSync(p).isSymbolicLink());h.sql(fs.readFileSync(p,'utf8'));}
  h.sql("NOTIFY pgrst, 'reload schema';");
  h.browser=async chromium=>{
   nodeContainer('browser',`const net=require('node:net');for(const [port,host,target] of [[57570,'host.docker.internal',57570],[57571,'${owner}-gateway',57571],[57573,'127.0.0.1',57574]])net.createServer(s=>{const u=net.connect(target,host);s.on('error',()=>u.destroy());u.on('error',()=>s.destroy());s.pipe(u);u.pipe(s)}).listen(port,port===57573?'0.0.0.0':'127.0.0.1');require('/app/node_modules/playwright-core').chromium.launch({headless:true,executablePath:'/ms-playwright/chromium-1226/chrome-linux/chrome',args:['--remote-debugging-port=57574']}).catch(()=>process.exit(1));`,[[57573,57573]],['--add-host=host.docker.internal:host-gateway']);
   for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:57573/json/version',{signal:AbortSignal.timeout(500)});const v=await r.json();return await chromium.connectOverCDP(v.webSocketDebuggerUrl.replace(':57574/',':57573/'));}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('INFRA_AUTH: Docker Chromium CDP unavailable');
  };
  fs.writeFileSync(path.join(artifacts,'infra.json'),JSON.stringify({owner,descriptor,images,dbPublished:false,profile:'ubuntu-24.04-arm',actual:'Docker linux/arm64; host not Ubuntu CI'},null,2));
  return h;
 }catch(e){try{h.close();}catch(cleanup){throw new AggregateError([e,cleanup],'INFRA_AUTH and cleanup failed');}throw e;}
}
