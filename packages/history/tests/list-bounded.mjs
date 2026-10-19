// Reproduction + regression for the intermittent 503 of the Historial list (/api/history).
// Local ephemeral PostgreSQL on a unix socket, synthetic data only, real migrations, real RLS (SET LOCAL ROLE vexa_backend).
//   node packages/history/tests/list-bounded.mjs      (env: PG_BIN, PGPORT_TEST=59473, PGSOCK_TEST=/tmp/vxhl, ITEMS=250000)
// Before the fix list() counted every item of every batch under per-row RLS: with a full-corpus batch the query
// exceeds statement_timeout (57014), which the database adapter maps to 503 database_unavailable.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../../..'),mig=path.join(root,'supabase/migrations');
const require=createRequire(path.join(root,'package.json')),pg=require('pg');
const {createHistoryRepository,COUNT_CAP}=await import('../repository.mjs');
const bin=process.env.PG_BIN??'/opt/homebrew/opt/postgresql@17/bin',port=process.env.PGPORT_TEST??'59473',sock=process.env.PGSOCK_TEST??'/tmp/vxhl',items=Number(process.env.ITEMS??250000);let TIMEOUT_MS=60000;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-history-list-')),data=path.join(dir,'data');fs.mkdirSync(sock,{recursive:true});
const run=(cmd,args)=>{const r=spawnSync(path.join(bin,cmd),args,{encoding:'utf8'});if(r.status!==0)throw new Error(cmd+' failed: '+(r.stderr||r.stdout).slice(0,1500));return r.stdout;};
const psql=(args)=>run('psql',['-h',sock,'-p',port,'-d','postgres','-X','-q','-v','ON_ERROR_STOP=1',...args]);
const results=[];const check=(n,p,d='')=>{results.push(p);console.log((p?'PASS ':'FAIL ')+n+(d?' '+d:''));};
const T='bbbbbbbb-0000-0000-0000-000000000001',U='aaaaaaaa-0000-0000-0000-000000000001';
let started=false,pool;
// Same boundary as packages/platform/src/db.ts (read action): BEGIN READ ONLY, SET LOCAL ROLE vexa_backend, claims, statement_timeout; errors -> sanitized status.
const database={async transaction(action,work){const c=await pool.connect();let open=false;try{await c.query('BEGIN READ ONLY');open=true;await c.query('SET LOCAL ROLE vexa_backend');
 await c.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('vexa.tenant_id',$2,true),set_config('statement_timeout',$3,true),set_config('vexa.action',$4,true)",[U,T,String(TIMEOUT_MS),action]);
 const r=await work({tenantId:T,userId:U,role:'owner',query:(t,v)=>c.query(t,v)});await c.query('COMMIT');open=false;return r;}catch(e){if(open)await c.query('ROLLBACK').catch(()=>{});throw Object.assign(new Error('database_unavailable'),{status:e.code==='57014'?503:500,pg:e.code});}finally{c.release();}}};
try{
 run('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',data,'-l',path.join(dir,'pg.log'),'-o',`-k ${sock} -p ${port} -c listen_addresses='' -c shared_buffers=256MB`,'-w','start']);started=true;
 psql(['-f',path.join(root,'supabase/tests/association-candidates/stubs.sql')]);
 for(const n of fs.readdirSync(mig).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&(n<'0050'||n.startsWith('0054'))).sort()){const f=path.join(dir,n);fs.writeFileSync(f,fs.readFileSync(path.join(mig,n),'utf8').replace(/^create extension if not exists vector.*$/m,''));psql(['-f',f]);}
 fs.writeFileSync(path.join(dir,'seed.sql'),`
insert into auth.users(id,email) values ('${U}','owner@syn.invalid');
insert into public.organizations(id,name) values ('${T}','SYN Tenant');
insert into public.memberships(tenant_id,user_id,role,status) values ('${T}','${U}','owner','active');
insert into public.connections(id,tenant_id,source,account_id) values ('cccccccc-0000-0000-0000-000000000001','${T}','hubspot','syn-1');
insert into public.conversations(id,tenant_id,source,external_id,connection_id) select gen_random_uuid(),'${T}','hubspot','hubspot:'||n,'cccccccc-0000-0000-0000-000000000001' from generate_series(1,${items}) n;
alter table public.history_batches disable trigger user;alter table public.history_items disable trigger user;
insert into public.history_batches(id,tenant_id,owner_id,connection_id,request_key,extraction_hash,embedding_hash,enumerated) select gen_random_uuid(),'${T}','${U}','cccccccc-0000-0000-0000-000000000001',gen_random_uuid(),repeat('a',64),repeat('b',64),true from generate_series(1,2);
with b as (select id,row_number() over (order by id) rn from public.history_batches), c as (select id,row_number() over (order by id) rn from public.conversations)
insert into public.history_items(tenant_id,batch_id,conversation_id,state) select '${T}',b.id,c.id,case when c.rn%5=0 then 'completed' else 'pending' end from c join b on b.rn=(c.rn%2)+1;
alter table public.history_batches enable trigger user;alter table public.history_items enable trigger user;analyze;`);
 psql(['-f',path.join(dir,'seed.sql')]);
 pool=new pg.Pool({host:sock,port:Number(port),database:'postgres',max:2});
 // 1. Reproduction. Timings vary with machine load, so the budget is derived from the measurement: first time the
 // unbounded statement (U), then use half of U as the statement_timeout. The legacy statement must exceed it (57014 -> 503).
 const legacy="SELECT b.*,coalesce((SELECT jsonb_object_agg(x.state,x.n) FROM (SELECT state,count(*) AS n FROM public.history_items WHERE tenant_id=b.tenant_id AND batch_id=b.id GROUP BY state)x),'{}') AS counts FROM public.history_batches b WHERE b.tenant_id=$1 ORDER BY b.created_at DESC,b.id LIMIT 100";
 const u0=Date.now();await database.transaction('read',s=>s.query(legacy,[T]));const UNB=Date.now()-u0;TIMEOUT_MS=Math.max(300,Math.floor(UNB/2));
 let failure;try{await database.transaction('read',s=>s.query(legacy,[T]));}catch(e){failure=e;}
 check('reproduction: unbounded counting statement exceeds statement_timeout (57014 -> 503)',failure?.pg==='57014'&&failure.status===503,`unbounded ${UNB} ms, budget ${TIMEOUT_MS} ms, code ${failure?.pg}`);
 // 2. Fix: the real repository answers within the same timeout and flags lower-bound counts.
 const repo=createHistoryRepository({database,resolveConfig:async()=>({ready:false,enabled:false})});
 const t0=Date.now();let out,err;try{out=await repo.list();}catch(e){err=e;}const ms=Date.now()-t0;
 check('fix: list() succeeds under the same statement_timeout and is at least 3x faster than the unbounded count',!err&&out?.batches?.length===2&&ms*3<UNB,`${ms} ms vs ${UNB} ms ${err?.pg??''}`);
 check('fix: counts are capped and flagged as lower bounds',out?.batches.every(b=>b.countsCapped===true&&Object.values(b.counts).reduce((a,n)=>a+Number(n),0)===COUNT_CAP+1));
 check('fix: tenant scoping and connections list unchanged',out?.connections?.length===1&&out.configuration.ready===false);
 // 3. A small batch keeps exact counts (not flagged).
 await pool.query(`alter table public.history_batches disable trigger user;alter table public.history_items disable trigger user;insert into public.history_batches(id,tenant_id,owner_id,connection_id,request_key,extraction_hash,embedding_hash,enumerated) values ('dddddddd-0000-0000-0000-000000000001','${T}','${U}','cccccccc-0000-0000-0000-000000000001',gen_random_uuid(),repeat('a',64),repeat('b',64),true);insert into public.history_items(tenant_id,batch_id,conversation_id,state) select '${T}','dddddddd-0000-0000-0000-000000000001',id,'completed' from public.conversations limit 7;alter table public.history_batches enable trigger user;alter table public.history_items enable trigger user;`);
 const small=(await repo.list()).batches.find(b=>b.id==='dddddddd-0000-0000-0000-000000000001');
 check('small batch: exact counts, not flagged',small?.counts.completed==='7'||small?.counts.completed===7);
 check('small batch: not flagged as capped',small?.countsCapped===false);
}catch(e){console.error(e);results.push(false);}
finally{await pool?.end().catch(()=>{});if(started)spawnSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
const ok=results.length>0&&results.every(Boolean);console.log(ok?'ALL PASS':'FAILED');process.exitCode=ok?0:1;
