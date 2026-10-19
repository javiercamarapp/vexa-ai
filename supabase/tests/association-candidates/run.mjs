// Equivalence + performance probe for migration 0054 (association_candidates message pre-dedup).
// Local, ephemeral PostgreSQL 17 on a unix socket only (no network, no Supabase). Synthetic data only.
//   node supabase/tests/association-candidates/run.mjs
// Env: PG_BIN (default: pg_config --bindir or /opt/homebrew/opt/postgresql@17/bin), PGPORT_TEST (59465),
//      PGSOCK_TEST (/tmp/vxf), NOISE (unreferenced conversations for the timing tenant, default 60000).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../../..'),mig=path.join(root,'supabase/migrations');
const bin=process.env.PG_BIN??(()=>{const r=spawnSync('pg_config',['--bindir'],{encoding:'utf8'});return r.status===0?r.stdout.trim():'/opt/homebrew/opt/postgresql@17/bin';})();
const port=process.env.PGPORT_TEST??'59465',sock=process.env.PGSOCK_TEST??'/tmp/vxf',noise=process.env.NOISE??'60000';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-assoc-cand-')),data=path.join(dir,'data');
fs.mkdirSync(sock,{recursive:true});
const run=(cmd,args,opt={})=>{const r=spawnSync(path.join(bin,cmd),args,{encoding:'utf8',...opt});if(r.status!==0&&!opt.allowFail)throw new Error(cmd+' failed: '+(r.stderr||r.stdout).slice(0,2000));return r;};
const psql=(args,opt={})=>run('psql',['-h',sock,'-p',port,'-d','postgres','-X','-q','-v','ON_ERROR_STOP=1',...args],opt);
const sql=(text,opt={})=>psql(['-At','-c',text],opt).stdout.trim();
const file=(f,vars=[])=>psql([...vars.flatMap(([k,v])=>['-v',`${k}=${v}`]),'-f',f]).stdout;
const results=[];const check=(name,pass,detail='')=>{results.push({name,pass});console.log((pass?'PASS ':'FAIL ')+name+(detail?' '+detail:''));};
let started=false;
try{
 run('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',data,'-l',path.join(dir,'pg.log'),'-o',`-k ${sock} -p ${port} -c listen_addresses='' -c shared_buffers=256MB -c max_locks_per_transaction=256`,'-w','start']);started=true;
 file(path.join(here,'stubs.sql'));
 // Migrations up to 0049 (the stubbed pgvector extension line is the only edit).
 const upTo49=fs.readdirSync(mig).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&n<'0050').sort();
 for(const n of upTo49){const f=path.join(dir,n);fs.writeFileSync(f,fs.readFileSync(path.join(mig,n),'utf8').replace(/^create extension if not exists vector.*$/m,''));file(f);}
 // Keep the 0049 function under another name as the reference implementation.
 const m49=fs.readFileSync(path.join(mig,'0049_association_candidates_exact_keys.sql'),'utf8');
 const def=m49.match(/create or replace function public\.association_candidates\([\s\S]*?\n\$\$;/)[0].replace('function public.association_candidates(','function public.association_candidates_old(');
 fs.writeFileSync(path.join(dir,'old.sql'),def);file(path.join(dir,'old.sql'));
 const attrs=()=>sql(`select md5(concat_ws('|',pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),p.prosecdef,p.provolatile,p.prokind,p.proleakproof,p.proparallel,coalesce(p.proconfig::text,''),coalesce(p.proacl::text,''),pg_get_userbyid(p.proowner),l.lanname)) from pg_proc p join pg_language l on l.oid=p.prolang where p.oid='public.association_candidates(uuid,uuid[],boolean)'::regprocedure`);
 const before=attrs(),bodyBefore=sql(`select md5(prosrc) from pg_proc where oid='public.association_candidates(uuid,uuid[],boolean)'::regprocedure`);
 const m54=fs.readdirSync(mig).find(n=>/^0054_.*\.sql$/.test(n));assert.ok(m54,'0054 migration present');
 file(path.join(mig,m54));
 check('0054 keeps signature, security definer, volatility, search_path, owner and grants of 0049',attrs()===before);
 check('0054 changes the function body',sql(`select md5(prosrc) from pg_proc where oid='public.association_candidates(uuid,uuid[],boolean)'::regprocedure`)!==bodyBefore);
 // Only the message branch may differ: removing the 0054 pre-dedup block and the 0049 message join must leave the same text.
 const m54text=fs.readFileSync(path.join(mig,m54),'utf8');
 const strip=s=>s.replace(/\n select s\.fact_id,'conversation'[\s\S]*?\n \), dedup/,'\n <MESSAGE_BRANCH>\n ), dedup');
 const body=t=>t.match(/as \$\$([\s\S]*?)\n\$\$;/)[1];
 check('only the conversation-message branch differs from 0049',strip(body(m49))===strip(body(m54text))&&body(m49)!==body(m54text));
 // Functional equivalence tenant: filtering predicates, duplicates, no-message conversations, orphan messages, owner_choice.
 file(path.join(here,'fixture.sql'),[['tag','fn'],['nfacts','400'],['nvalid','330'],['msgs','36'],['nimpt','12'],['noise','0']]);
 const tfn=sql(`select tenant_id from public.native_customer_associations limit 1`);
 const out=file(path.join(here,'compare.sql'),[['t',tfn]]);console.log(out.trim());
 const kv=Object.fromEntries(out.trim().split(/\s+/).filter(x=>x.includes('=')).map(x=>x.split('=')));
 check('functional: 0049 and 0054 return identical rows in both directions (EXCEPT = 0)',kv.only_old==='0'&&kv.only_new==='0'&&kv.rows_old===kv.rows_new);
 check('functional: result is not vacuous',Number(kv.all_false)>100&&Number(kv.all_true)>Number(kv.all_false)&&Number(kv.approvals)>=2,`all_false=${kv.all_false} all_true=${kv.all_true} approvals=${kv.approvals}`);
 check('functional: empty/unknown/retained ids return no rows',kv.empty_cases==='0');
 check('functional: one candidate per (fact,kind,id)',kv.dup_keys==='0');
 // Timing tenant: 250-fact batch, >=225 valid, conversations with 36 messages, plus unreferenced conversations.
 file(path.join(here,'fixture.sql'),[['tag','tm'],['nfacts','250'],['nvalid','235'],['msgs','36'],['nimpt','12'],['noise',noise]]);
 const ttm=sql(`select tenant_id from public.native_customer_associations where tenant_id<>'${tfn}' limit 1`);
 const ids=`(select array_agg(id) from public.native_customer_associations where tenant_id='${ttm}')`;
 const valid=Number(sql(`select count(*) from public.native_customer_associations where tenant_id='${ttm}' and immutable_evidence->'bridge'->'property'->>'status'='valid'`));
 check('timing: batch of 250 facts with >=225 valid',Number(sql(`select count(*) from public.native_customer_associations where tenant_id='${ttm}'`))===250&&valid>=225,`valid=${valid}`);
 const time=fn=>{const t0=process.hrtime.bigint();const n=sql(`set statement_timeout='60s'; select count(*) from public.${fn}('${ttm}'::uuid,${ids},false)`).split('\n').pop();return {ms:Number(process.hrtime.bigint()-t0)/1e6,n:Number(n)};};
 time('association_candidates');const nw=time('association_candidates'),od=time('association_candidates_old');
 console.log(`timing new=${nw.ms.toFixed(0)}ms old(0049)=${od.ms.toFixed(0)}ms rows new=${nw.n} old=${od.n}`);
 check('timing: 0054 finishes the 250-fact batch in < 3 s',nw.ms<3000,`${nw.ms.toFixed(0)}ms`);
 check('timing: same row count as 0049 on the batch',nw.n===od.n&&nw.n>0,`${nw.n}`);
 const eq=sql(`create temp table a as select * from public.association_candidates('${ttm}'::uuid,${ids},false); create temp table b as select * from public.association_candidates_old('${ttm}'::uuid,${ids},false); select (select count(*) from (select * from a except select * from b) x)||':'||(select count(*) from (select * from b except select * from a) x)`).split('\n').pop();
 check('timing: identical rows on the heavy batch (EXCEPT both ways = 0)',eq==='0:0',eq);
}catch(e){console.error(e);results.push({name:'infra',pass:false});}
finally{
 if(started)spawnSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop']);
 fs.rmSync(dir,{recursive:true,force:true});
}
const ok=results.length>0&&results.every(r=>r.pass);console.log(ok?'ALL PASS':'FAILED');process.exitCode=ok?0:1;
