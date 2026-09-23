import {resourceBroker} from '../ci/resources.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {q} from './matrix.mjs';

const images={db:'public.ecr.aws/supabase/postgres:17.6.1.159',auth:'public.ecr.aws/supabase/gotrue:v2.195.0',storage:'public.ecr.aws/supabase/storage-api:v1.69.11',rest:'public.ecr.aws/supabase/postgrest:v16.1'};
function docker(args,input) {
  const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,
    env:{PATH:process.env.PATH,HOME:process.env.HOME}});
  assert.ok(!r.error && r.status===0,`INFRA_F01_03: docker ${args[0]} failed (${r.status??r.error?.code}); no authorization verdict; ${r.stderr?.match(/(?:permission denied|must be|does not exist)[^\n]*/)?.[0]??'details suppressed'}`);
  return (args[0]==='logs'?r.stdout+r.stderr:r.stdout).trim();
}
export function candidateInputs(candidate) {
  assert.ok(candidate,'VEXA_CANDIDATE obligatorio');
  assert.match(fs.readFileSync(path.join(candidate,'supabase/config.toml'),'utf8'),/^project_id\s*=\s*"vexa-local"\s*$/m);
  const dir=path.join(candidate,'supabase/migrations');
  const files=fs.readdirSync(dir).filter(x=>/^\d.*\.sql$/.test(x)).sort();
  assert.ok(files.length>1,'IMPLEMENTATION_MISSING: sólo identidad; faltan migraciones F01-03');
  assert.ok(fs.existsSync(path.join(candidate,'packages/platform/src/db.ts')),'IMPLEMENTATION_MISSING: db.ts');
  const migrations=files.map(f=>{const p=path.join(dir,f);assert.ok(!fs.lstatSync(p).isSymbolicLink(),'SYMLINK migration');return fs.readFileSync(p,'utf8');});
  migrations.workerDelegationsRequired=files.includes('0007_job_leases.sql');
  migrations.syncRequired=files.includes('0008_sync_cursors.sql');
  migrations.aliasesRequired=files.includes('0009_aliases.sql');
  migrations.budgetRequired=files.includes('0011_ai_budget.sql');
  migrations.healthRequired=files.includes('0010_connection_health.sql');
  migrations.extractionRequired=files.includes('0012_extraction_redaction.sql');
  migrations.crmRequired=files.includes('0013_crm_runtime.sql');
  migrations.problemsRequired=files.some(f=>/^0016_/.test(f));
  migrations.causalityRequired=files.some(f=>/^0017_/.test(f));
  migrations.economicRequired=files.some(f=>/^0018_/.test(f));
  migrations.exposureRequired=files.some(f=>/^0019_/.test(f));
  migrations.moneyRequired=files.some(f=>/^0020_/.test(f));
  migrations.briefsRequired=files.some(f=>/^0027_/.test(f));
  migrations.notificationsRequired=files.some(f=>/^0028_/.test(f));
  migrations.interventionsRequired=files.some(f=>/^0026_/.test(f));
  migrations.recommendationsRequired=files.some(f=>/^0025_/.test(f));
  migrations.detailRequired=files.some(f=>/^0024_/.test(f));
  migrations.workspaceRequired=files.some(f=>/^0023_/.test(f));
  migrations.priorityRequired=files.some(f=>/^0022_/.test(f));
  migrations.snapshotsRequired=files.some(f=>/^0021_/.test(f));
  return migrations;
}
export async function launch({services=false}={}) {
  const resources=resourceBroker();
  const portBase=Number(process.env.VEXA_F01_03_PORT_BASE??56327);
  assert.ok(Number.isInteger(portBase)&&portBase>1024&&portBase<65533,'INVALID_PORT_BASE');
  const ports={auth:portBase,storage:portBase+1,rest:portBase+2};
  const prefix='vexa-f01-03-'+randomUUID(), owned=[];
  const credentials=new Map();
  const resourceIds=[];
  let network=false;
  const password='SYN-'+randomBytes(24).toString('hex'),secret=randomBytes(32).toString('hex');
  const sign=role=>{const b=[{alg:'HS256',typ:'JWT'},{role,iss:'supabase',exp:Math.floor(Date.now()/1000)+1800}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return b+'.'+createHmac('sha256',secret).update(b).digest('base64url');};
  const anon=sign('anon'),service=sign('service_role');
  const h={
    sql(statement){return docker(['exec','-i','-e',`PGPASSWORD=${password}`,prefix+'-db','psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],`SET statement_timeout='10s';\n${statement}`);},
    json(statement){return JSON.parse(h.sql(statement));},
    probe(statement,actor='backend') {
      const role=actor==='backend'?'supabase_admin':actor?'authenticated':'anon';
      const claims=actor&&actor!=='backend'?{sub:actor.id,role,...actor.claims}:{role};
      return h.json(`BEGIN; CREATE TEMP TABLE exam_result(value jsonb); GRANT ALL ON exam_result TO ${role};
        SET LOCAL ROLE ${role}; DO $exam$ DECLARE result jsonb; affected bigint; violated text; message text; detail text; context text; BEGIN
        PERFORM set_config('request.jwt.claims',${q(JSON.stringify(claims))},true);
        PERFORM set_config('request.jwt.claim.sub',${q(claims.sub??'')},true);
        BEGIN ${statement}
        INSERT INTO exam_result VALUES(jsonb_build_object('code','00000','rows',coalesce(result,'[]'::jsonb)));
        EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME, message = MESSAGE_TEXT, detail = PG_EXCEPTION_DETAIL, context = PG_EXCEPTION_CONTEXT; INSERT INTO exam_result VALUES(jsonb_build_object('code',SQLSTATE,'constraint',violated,'message',message,'detail',detail,'context',context)); END;
        END $exam$; RESET ROLE; SELECT value FROM exam_result; ROLLBACK;`);
    },
    async http(kind,route,token,{method='GET',body,headers={}}={}) {
      const base=`http://127.0.0.1:${ports[kind]}`;
      const url=new URL(route,base);assert.equal(url.origin,base,'NETWORK: own local service only');
      // SQL probes block the event loop beyond the server keepalive lifetime.
      // Close each connection (including health checks); never replay a write.
      const r=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(5000),headers:{Connection:'close',apikey:anon,Authorization:`Bearer ${token??anon}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
      const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=null;}return {status:r.status,text,data};
    },
    async user(){
      const body={email:`syn-${randomUUID()}@example.test`,password:'SYN-'+randomUUID()};
      const r=await h.http('auth','/signup',null,{method:'POST',body});
      assert.equal(r.status,200,'INFRA: real local Auth signup');assert.ok(r.data?.access_token&&r.data.user?.id,'INFRA: real Auth session absent');
      credentials.set(r.data.user.id,body);return {id:r.data.user.id,token:r.data.access_token};
    },
    async login(actor){
      assert.ok(credentials.has(actor.id),'INFRA: synthetic credentials absent');
      const r=await h.http('auth','/token?grant_type=password',null,{method:'POST',body:credentials.get(actor.id)});
      assert.equal(r.status,200,'AUTH_NEW_LOGIN');assert.equal(r.data?.user?.id,actor.id,'AUTH_SAME_USER');
      assert.ok(r.data?.access_token && r.data.access_token!==actor.token,'AUTH_NEW_TOKEN');
      const claims=token=>JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
      assert.ok(claims(r.data.access_token).session_id!==claims(actor.token).session_id,'AUTH_NEW_SESSION');
      return {id:actor.id,token:r.data.access_token};
    },
    close(){credentials.clear();const failures=[];for(const name of [...owned].reverse()){try{resources.remove('container',name);}catch{failures.push(name);}}if(network){try{resources.remove('network',prefix);}catch{failures.push(prefix);}}assert.deepEqual(failures,[],'TEARDOWN: own resources not removed');
      for(const resource of resourceIds){const r=spawnSync('docker',[resource.kind,'inspect',resource.id],{encoding:'utf8',timeout:15000});assert.ok(!r.error&&r.status!==0&&/No such|not found/.test(r.stderr),'TEARDOWN_ID_STILL_PRESENT');resource.absent=true;}
      if(process.env.VEXA_F01_03_CLEANUP)fs.writeFileSync(process.env.VEXA_F01_03_CLEANUP,JSON.stringify(resourceIds,null,2),{mode:0o600});},
  };
  const run=(kind,env={},port)=>{
    const name=prefix+'-'+kind;
    // Reserve ownership before run: a failed port bind can leave a container.
    owned.push(name);
    docker(['run','--pull','never','-d','--name',name,...resources.reserve('container',name),'--network',prefix,
      '--label','com.supabase.cli.project=vexa-local',...(port?['-p',`127.0.0.1:${port}:${kind==='storage'?5000:kind==='auth'?9999:3000}`]:[]),
      ...Object.entries(env).flatMap(([k,v])=>['-e',`${k}=${v}`]),images[kind]]);
    resourceIds.push({kind:'container',id:docker(['container','inspect',name,'--format','{{.Id}}'])});
  };
  try {
    for(const kind of services?Object.keys(images):['db'])docker(['image','inspect',images[kind],'--format','{{.Id}}']);
    network=true;resourceIds.push({kind:'network',id:docker(['network','create',...resources.reserve('network',prefix),prefix])});
    run('db',{POSTGRES_PASSWORD:password});
    let ready=false;
    for(let i=0;i<80;i++){try{docker(['exec',prefix+'-db','pg_isready','-h','127.0.0.1']);ready=h.sql("SELECT count(*) FROM pg_roles WHERE rolname IN ('authenticator','supabase_auth_admin','supabase_storage_admin')")==='3';if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,'INFRA: disposable PostgreSQL did not start');
    h.sql(`ALTER ROLE authenticator PASSWORD ${q(password)}; ALTER ROLE supabase_auth_admin PASSWORD ${q(password)}; ALTER ROLE supabase_storage_admin PASSWORD ${q(password)};`);
    if(services){
      run('auth',{GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:9999,API_EXTERNAL_URL:`http://127.0.0.1:${ports.auth}`,GOTRUE_SITE_URL:`http://127.0.0.1:${ports.auth}`,GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${password}@${prefix}-db:5432/postgres`,GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_DISABLE_SIGNUP:false,GOTRUE_MAILER_AUTOCONFIRM:true},ports.auth);
      run('rest',{PGRST_DB_URI:`postgres://authenticator:${password}@${prefix}-db:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret},ports.rest);
      run('storage',{DATABASE_URL:`postgres://supabase_storage_admin:${password}@${prefix}-db:5432/postgres`,POSTGREST_URL:`http://${prefix}-rest:3000`,PGRST_JWT_SECRET:secret,AUTH_JWT_SECRET:secret,ANON_KEY:anon,SERVICE_KEY:service,STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/tmp/vexa-storage',TENANT_ID:'vexa-local',REGION:'local',GLOBAL_S3_BUCKET:'vexa-local',FILE_SIZE_LIMIT:1048576},ports.storage);
      for(const [kind,route] of [['auth','/health'],['rest','/'],['storage','/status']]){
        let ok=false;for(let i=0;i<100;i++){try{ok=(await h.http(kind,route)).status===200;if(ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
        let detail='';if(!ok){try{detail=docker(['logs','--tail','5',prefix+'-'+kind]).replaceAll(password,'[synthetic-redacted]').replaceAll(secret,'[synthetic-redacted]').replaceAll(anon,'[synthetic-redacted]').replaceAll(service,'[synthetic-redacted]');}catch{}}assert.ok(ok,`INFRA: disposable ${kind} unavailable; no mock fallback ${detail}`);
      }
    }
    return h;
  }catch(e){h.close();throw e;}
}
export function denied(r,label='DENY') {assert.ok(r.code==='42501'||(r.code==='00000'&&r.rows.length===0),`${label}: expected permission/zero rows, got ${r.code}/${r.rows?.length}`);}
export function rows(r,ids,label='POSITIVE') {assert.equal(r.code,'00000',label);if(r.rows.some(x=>'affected' in x))assert.equal(r.rows[0].affected,ids.length,label);else assert.deepEqual(r.rows.map(x=>x.id).sort(),[...ids].sort(),label);}
export const read=(table)=>`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO result FROM public."${table}" r;`;
export const write=(statement)=>`${statement}; GET DIAGNOSTICS affected = ROW_COUNT; result:=CASE WHEN affected=0 THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('affected',affected)) END;`;
