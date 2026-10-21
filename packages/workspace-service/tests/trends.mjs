// Monthly trends against a real ephemeral PostgreSQL (unix socket, synthetic data, real migrations, real RLS).
//   node packages/workspace-service/tests/trends.mjs     (env: PG_BIN, PGPORT_TEST=59475, PGSOCK_TEST=/tmp/vxtr, CONVS=120000)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../../..'),mig=path.join(root,'supabase/migrations');
const pg=createRequire(path.join(root,'package.json'))('pg');
const {createTrendsRepository,monthWindow,LOCAL_TIMEOUT_MS}=await import('../trends.mjs');
const bin=process.env.PG_BIN??'/opt/homebrew/opt/postgresql@17/bin',port=process.env.PGPORT_TEST??'59475',sock=process.env.PGSOCK_TEST??'/tmp/vxtr',convs=Number(process.env.CONVS??120000);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-trends-')),data=path.join(dir,'data');fs.mkdirSync(sock,{recursive:true});
const run=(cmd,args)=>{const r=spawnSync(path.join(bin,cmd),args,{encoding:'utf8'});if(r.status!==0)throw new Error(cmd+' failed: '+(r.stderr||r.stdout).slice(0,1500));return r.stdout;};
const psql=a=>run('psql',['-h',sock,'-p',port,'-d','postgres','-X','-q','-v','ON_ERROR_STOP=1',...a]);
const results=[];const check=(n,p,d='')=>{results.push(p);console.log((p?'PASS ':'FAIL ')+n+(d?' '+d:''));};
const TA='aaaaaaaa-2000-0000-0000-00000000000a',TB='bbbbbbbb-2000-0000-0000-00000000000b',UA='22222222-0000-0000-0000-00000000000a',UB='22222222-0000-0000-0000-00000000000b';
const CA='cccccccc-2000-0000-0000-00000000000a',CB='cccccccc-2000-0000-0000-00000000000b',SA='dddddddd-2000-0000-0000-00000000000a';
const NOW=new Date('2026-10-19T12:00:00Z');
let started=false,pool;
const dbFor=(user,tenant,wrap)=>({async transaction(action,work){const c=await pool.connect();let open=false;try{await c.query('BEGIN READ ONLY');open=true;await c.query('SET LOCAL ROLE vexa_backend');
 await c.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('vexa.tenant_id',$2,true),set_config('statement_timeout','10000',true),set_config('vexa.action',$3,true)",[user,tenant,action]);
 const q=(t,v)=>c.query(t,v);const r=await work({tenantId:tenant,userId:user,query:wrap?wrap(q):q});await c.query('COMMIT');open=false;return r;}finally{if(open)await c.query('ROLLBACK').catch(()=>{});c.release();}}});
const h=c=>c.repeat(64);
try{
 run('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',data,'-l',path.join(dir,'pg.log'),'-o',`-k ${sock} -p ${port} -c listen_addresses='' -c shared_buffers=256MB`,'-w','start']);started=true;
 psql(['-f',path.join(root,'supabase/tests/association-candidates/stubs.sql')]);
 for(const n of fs.readdirSync(mig).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&(n<'0050'||n.startsWith('0054'))).sort()){const f=path.join(dir,n);fs.writeFileSync(f,fs.readFileSync(path.join(mig,n),'utf8').replace(/^create extension if not exists vector.*$/m,''));psql(['-f',f]);}
 const ent=(n)=>`'e0000000-0000-0000-0000-${String(n).padStart(12,'0')}'`;
 fs.writeFileSync(path.join(dir,'seed.sql'),`
insert into auth.users(id,email) values ('${UA}','a@syn.invalid'),('${UB}','b@syn.invalid');
insert into public.organizations(id,name) values ('${TA}','SYN A'),('${TB}','SYN B');
insert into public.memberships(tenant_id,user_id,role,status) values ('${TA}','${UA}','viewer','active'),('${TB}','${UB}','owner','active');
insert into public.connections(id,tenant_id,source,account_id) values ('${CA}','${TA}','hubspot','a'),('${CB}','${TB}','hubspot','b');
-- tenant A: ${convs} historical conversations with NULL started_at (dated only by their first message, 18-month spread) + 2000 native ones with started_at in Jul-Oct 2026
-- + 500 with neither + 300 deleted; tenant B: 40 historical conversations (exact path)
insert into public.conversations(id,tenant_id,source,external_id,connection_id,started_at)
 select gen_random_uuid(),'${TA}','csv','hist:'||n,'${CA}',null from generate_series(1,${convs}) n;
insert into public.conversations(id,tenant_id,source,external_id,connection_id,started_at)
 select gen_random_uuid(),'${TA}','hubspot','native:'||n,'${CA}',timestamptz '2026-10-19 00:00:00+00'-(n*(interval '100 days')/2000) from generate_series(1,2000) n;
insert into public.conversations(id,tenant_id,source,external_id,connection_id,started_at) select gen_random_uuid(),'${TA}','csv','undated:'||n,'${CA}',null from generate_series(1,500) n;
insert into public.conversations(id,tenant_id,source,external_id,connection_id,started_at,deleted_at) select gen_random_uuid(),'${TA}','csv','deleted:'||n,'${CA}',null,now() from generate_series(1,300) n;
insert into public.conversations(id,tenant_id,source,external_id,connection_id,started_at) select gen_random_uuid(),'${TB}','csv','hist:'||n,'${CB}',null from generate_series(1,40) n;
insert into public.messages(id,tenant_id,external_id,role,conversation_id,connection_id,occurred_at)
 select gen_random_uuid(),c.tenant_id,'m'||k,'customer',c.id,c.connection_id,
  CASE WHEN c.tenant_id='${TA}' THEN timestamptz '2026-10-19 00:00:00+00'-(split_part(c.external_id,':',2)::int*(interval '540 days')/${convs})+(k-1)*interval '1 hour' ELSE timestamptz '2026-09-10 00:00:00+00'+(k-1)*interval '1 hour' END
 FROM public.conversations c CROSS JOIN generate_series(1,2) k WHERE c.external_id LIKE 'hist:%';
alter table public.economic_source_versions disable trigger user;alter table public.economic_ledger_entries disable trigger user;
insert into public.economic_source_versions(tenant_id,source_id,version,actor_id,name,evidence_type,active,complete,window_start,window_end,watermark,report,report_hash,attested) values ('${TA}','${SA}',1,'${UA}','SYN','order_export',true,true,'2026-01-01','2026-12-31','2026-10-18','${'r'.repeat(30)}','${h('9')}',true);
insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested) values
 ('${TA}',${ent(1)},'${SA}',1,1,'${UA}','O-1','order','2026-09-03','USD',2,'net',10000,'recorded','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(2)},'${SA}',1,1,'${UA}','O-2','order','2026-09-20','USD',2,'net',2500,'recorded','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(3)},'${SA}',1,1,'${UA}','O-3','order','2026-10-02','USD',2,'net',7000,'recorded','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(3)},'${SA}',1,2,'${UA}','O-3','order','2026-10-02','USD',2,'net',9000,'recorded','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(4)},'${SA}',1,1,'${UA}','O-4','order','2026-10-05','USD',2,'net',5000,'cancelled','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(5)},'${SA}',1,1,'${UA}','O-5','order','2026-10-06','USD',2,'net',null,'recorded','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(6)},'${SA}',1,1,'${UA}','R-1','refund','2026-10-07','USD',2,'net',1200,'settled','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(7)},'${SA}',1,1,'${UA}','R-2','refund','2026-10-08','USD',2,'net',800,'pending','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(8)},'${SA}',1,1,'${UA}','O-8','order','2026-09-09','MXN',2,'net',55500,'recorded','{}','${'r'.repeat(30)}','${h('9')}',true),
 ('${TA}',${ent(9)},'${SA}',1,1,'${UA}','O-OLD','order','2024-01-09','USD',2,'net',99900,'recorded','{}','${'r'.repeat(30)}','${h('9')}',true);
analyze;`);
 psql(['-f',path.join(dir,'seed.sql')]);
 pool=new pg.Pool({host:sock,port:Number(port),database:'postgres',max:2});
 const repo=createTrendsRepository({database:dbFor(UA,TA),now:()=>NOW,timeoutMs:60000});
 const t0=Date.now();const v=await repo.monthly();const ms=Date.now()-t0;
 const conv=v.conversations,by=Object.fromEntries(conv.series.map(r=>[r.month,r.count]));
 const truth=Number(psql(['-At','-c',`select count(*) from (select coalesce(c.started_at,fm.first_at) d from public.conversations c left join lateral (select min(m.occurred_at) first_at from public.messages m where m.tenant_id=c.tenant_id and m.conversation_id=c.id) fm on c.started_at is null where c.tenant_id='${TA}' and c.deleted_at is null) x where d>='2025-11-01' and d<'2026-11-01'`]).trim());
 const inWindow=conv.series.reduce((a,r)=>a+r.count,0);
 check('window is the last 12 whole months ending in the current month',conv.series.length===12&&conv.series[0].month==='2025-11'&&conv.series.at(-1).month==='2026-10');
 check(`conversations: dated by FIRST MESSAGE when started_at is null (regression: real data had 101,007 of 103,098 null)`,conv.status==='ok'&&conv.definition==='started_at_or_first_message'&&conv.series.filter(r=>r.count>0).length===12,`${ms} ms, ${Object.values(by).join(',')}`);
 check('conversations: a large tenant is a labelled estimate (3 % Bernoulli sample), never presented as observed',conv.class==='estimated'&&conv.sampled===true&&/muestra del 3 %/.test(conv.sampleNote));
 check('conversations: estimated window total within 10 % of the exact value (3 % sample)',Math.abs(inWindow-truth)/truth<0.10,`estimate ${inWindow} vs exact ${truth}`);
 check('conversations: undated conversations (no started_at, no message) are reported apart, deleted ones excluded',conv.undated>=250&&conv.undated<=1000&&conv.total>=(convs+2000+500)*0.9&&conv.total<=(convs+2000+500)*1.1,`undated≈${conv.undated} total≈${conv.total}`);
 const small=(await createTrendsRepository({database:dbFor(UB,TB),now:()=>NOW}).monthly()).conversations;
 check('conversations: a small tenant (<= 3,000) is counted exactly from first messages and stays "observed"',small.class==='observed'&&small.sampled===false&&small.series.find(r=>r.month==='2026-09').count===40&&small.total===40);
 const led=v.ledger,sep=led.series.find(r=>r.month==='2026-09'),oct=led.series.find(r=>r.month==='2026-10');
 check('ledger: primary currency is USD (most rows); MXN reported apart, never summed',led.currency==='USD'&&led.exponent===2&&led.otherCurrencies.join()==='MXN'&&led.currencies.length===2);
 check('ledger: latest revision only (O-3 = 9000), cancelled and pending excluded, null amount counted as unknown',oct.orders.count===2&&oct.orders.amountMinor==='9000'&&oct.orders.unknownAmounts===1&&oct.refunds.count===1&&oct.refunds.amountMinor==='1200',JSON.stringify(oct));
 check('ledger: September orders 12,500 USD (2 rows); MXN row not mixed in',sep.orders.count===2&&sep.orders.amountMinor==='12500');
 check('ledger: rows outside the window are not counted',led.series.every(r=>r.month>='2025-11')&&!JSON.stringify(led).includes('99900'));
 check('classes and note are honest: sampled conversations estimated, ledger observed, first-message definition stated',conv.class==='estimated'&&led.class==='observed'&&/primer mensaje/.test(v.note)&&/No aplican las reglas de publicación/.test(v.note));
 const failSample=q=>(t,v2)=>/BERNOULLI/.test(t)?Promise.reject(Object.assign(new Error('canceling statement due to statement timeout'),{code:'57014'})):q(t,v2);
 const tv=await createTrendsRepository({database:dbFor(UA,TA,failSample),now:()=>NOW}).monthly();
 check('if the sampled pass times out: status "timeout" (no 503, no invented figure) and the ledger still answers',tv.conversations.status==='timeout'&&tv.conversations.series.length===0&&tv.ledger.status==='ok');
 const failProbe=q=>(t,v2)=>/LIMIT 3001/.test(t)?Promise.reject(Object.assign(new Error('canceling statement due to statement timeout'),{code:'57014'})):q(t,v2);
 const pv=await createTrendsRepository({database:dbFor(UA,TA,failProbe),now:()=>NOW}).monthly();
 check('if even the cheap probe times out: status "timeout" and the ledger still answers',pv.conversations.status==='timeout'&&pv.ledger.status==='ok');
 let bad;try{await repo.monthly({months:99});}catch(e){bad=e;}
 check('window larger than 24 months is rejected (400)',bad?.status===400);
 check('monthWindow is pure and ordered',monthWindow(NOW,3).list.join()==='2026-08,2026-09,2026-10');
}catch(e){console.error(e);results.push(false);}
finally{await pool?.end().catch(()=>{});if(process.env.KEEP){console.log('KEEP: psql -h '+sock+' -p '+port+' -d postgres  (data '+dir+')');}else{if(started)spawnSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}}
const ok=results.length>0&&results.every(Boolean);console.log(ok?'ALL PASS':'FAILED');process.exitCode=ok?0:1;
