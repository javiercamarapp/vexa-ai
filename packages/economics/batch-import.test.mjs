// Local-only proof for supabase/migrations/0051_economic_batch_import.sql.
// Needs a disposable PostgreSQL with migrations 0001..0051 applied as a TEMPLATE
// database (never a shared or production database). Run:
//   VEXA_ECON_PG_SOCKET=/tmp/vxe VEXA_ECON_PG_PORT=59462 VEXA_ECON_PG_TEMPLATE=vexa \
//   VEXA_ECON_PG_MODULE=/path/to/node_modules/pg node --test packages/economics/batch-import.test.mjs
// Without those variables every test is skipped. Data is 100% synthetic.
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {createEconomicRepository,EconomicError} from '../metrics/repository.mjs';

const env=process.env,enabled=Boolean(env.VEXA_ECON_PG_SOCKET&&env.VEXA_ECON_PG_PORT&&env.VEXA_ECON_PG_TEMPLATE&&env.VEXA_ECON_PG_MODULE);
const opts={skip:enabled?false:'set VEXA_ECON_PG_* to run against a disposable local PostgreSQL',timeout:600000};
const pg=enabled?createRequire(import.meta.url)(env.VEXA_ECON_PG_MODULE):null;
const T='00000000-0000-4000-8000-0000000000e1',U='00000000-0000-4000-8000-0000000000e2',U_ANALYST='00000000-0000-4000-8000-0000000000e3',T2='00000000-0000-4000-8000-0000000000f1';
const S_ORD='11111111-1111-4111-8111-111111111111',S_PAY='22222222-2222-4222-8222-222222222222',S_REP='33333333-3333-4333-8333-333333333333',S_OFF='44444444-4444-4444-8444-444444444444';
const REPORT='Synthetic export, no customer data (test fixture).';

// ---- same canonical/stable derivation as packages/metrics/repository.mjs ----
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const stable=x=>{const h=hash(x);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};

const connect=(db)=>new pg.Pool({host:env.VEXA_ECON_PG_SOCKET,port:Number(env.VEXA_ECON_PG_PORT),database:db,max:2});
let admin;const created=[];
async function freshDb(name){admin??=connect('postgres');await admin.query(`DROP DATABASE IF EXISTS ${name}`);await admin.query(`CREATE DATABASE ${name} TEMPLATE ${env.VEXA_ECON_PG_TEMPLATE}`);created.push(name);const pool=connect(name);
 await pool.query(`INSERT INTO auth.users(id) VALUES($1),($2)`,[U,U_ANALYST]);
 await pool.query(`INSERT INTO organizations(id,name) VALUES($1,'SYN'),($2,'SYN2')`,[T,T2]);
 await pool.query(`INSERT INTO memberships(tenant_id,user_id,role,status,permissions_version) VALUES($1,$2,'owner','active',1),($1,$3,'analyst','active',1)`,[T,U,U_ANALYST]);
 return pool;}
const session=(pool,{tenantId=T,userId=U,action='configure',timeout='30000ms'}={})=>async work=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE vexa_backend');await c.query(`SET LOCAL statement_timeout='${timeout}'`);
 await c.query("SELECT set_config('vexa.tenant_id',$1,true),set_config('vexa.action',$2,true),set_config('request.jwt.claim.sub',$3,true)",[tenantId??'',action,userId]);
 const s={tenantId:T,userId,role:'owner',permissionsVersion:1,query:(q,a)=>c.query(q,a)};const r=await work(s,c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}};
const repoFor=pool=>createEconomicRepository({database:{transaction:(action,work)=>session(pool,{action})(work)}});
const batch=(pool,payload,sess={})=>session(pool,sess)(async(_s,c)=>(await c.query('SELECT public.economic_batch_import($1::jsonb) AS r',[JSON.stringify(payload)])).rows[0].r);
async function addSources(repo){
 for(const [id,type] of [[S_ORD,'order_export'],[S_PAY,'payment_ledger'],[S_REP,'replacement_invoice'],[S_OFF,'order_export']])
  await repo.recordSource({sourceId:id,expectedVersion:0,name:'syn '+type,evidenceType:type,active:true,complete:true,windowStart:'2026-01-01T00:00:00.000Z',windowEnd:'2026-09-01T00:00:00.000Z',watermark:'2026-09-01T00:00:00.000Z',report:REPORT,attested:true});
 await repo.recordSource({sourceId:S_OFF,expectedVersion:1,name:'syn off',evidenceType:'order_export',active:false,complete:true,windowStart:'2026-01-01T00:00:00.000Z',windowEnd:'2026-09-01T00:00:00.000Z',watermark:'2026-09-01T00:00:00.000Z',report:REPORT,attested:true});}
const dump=async pool=>{const r=await pool.query(`SELECT jsonb_agg(to_jsonb(x) ORDER BY entity_id,revision) d,count(*)::int n FROM (SELECT entity_id,source_id,source_version,revision,actor_id,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,order_id,reversal_of,details,report,report_hash,attested FROM public.economic_ledger_entries) x`);return {n:r.rows[0].n,digest:createHash('sha256').update(JSON.stringify(r.rows[0].d)).digest('hex')};};
const count=async pool=>(await pool.query('SELECT count(*)::int n FROM public.economic_ledger_entries')).rows[0].n;

// ---- deterministic synthetic data ----
let seed=20261017;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;const pick=a=>a[Math.floor(rnd()*a.length)];
const CUR=[['MXN',2],['USD',2],['JPY',0],['KWD',3],['CLF',4]];
const ids=['ñandú-','emoji-😀-','q"uo\\te-','日本-','plain-'];
const when=()=>{const d=new Date(Date.UTC(2026,0,1)+Math.floor(rnd()*200*86400000));const s=d.toISOString();return pick([s,s.replace('.000Z','Z'),s.replace(/\.(\d)\d\dZ/,'.$1Z')]);};
const entry=(o)=>({expectedRevision:0,externalId:'x',kind:'order',effectiveAt:'2026-03-01T00:00:00.000Z',currency:'MXN',exponent:2,basis:'gross_total',amountMinor:'1000',status:'recorded',orderId:null,reversalOf:null,details:{},report:REPORT,attested:true,...o});
function dataset(){
 const orders=[],refunds=[],reversals=[],repl=[];
 for(let i=0;i<600;i++){const [c,e]=pick(CUR);const st=pick(['recorded','recorded','recorded','pending','cancelled','unknown']);orders.push(entry({externalId:pick(ids)+i,kind:'order',effectiveAt:when(),currency:c,exponent:e,status:st,amountMinor:st==='unknown'&&rnd()<.5?null:String(BigInt(Math.floor(rnd()*1e9))*10n**BigInt(Math.floor(rnd()*26)))}));}
 const oid=o=>stable([T,S_ORD,'order',o.externalId]);
 for(let i=0;i<250;i++){const o=pick(orders);refunds.push(entry({externalId:'rf-'+pick(ids)+i,kind:'refund',effectiveAt:when(),currency:o.currency,exponent:o.exponent,basis:'cash_refund',status:pick(['settled','settled','pending','cancelled','unknown']),amountMinor:String(Math.floor(rnd()*50000)),orderId:oid(o)}));}
 for(let i=0;i<80;i++){const r=pick(refunds);reversals.push(entry({externalId:'rv-'+i,kind:'reversal',effectiveAt:when(),currency:r.currency,exponent:r.exponent,basis:'cash_refund',status:pick(['settled','pending']),amountMinor:rnd()<.1?'0':'-'+String(1+Math.floor(rnd()*500)),reversalOf:stable([T,S_PAY,'refund',r.externalId]),orderId:r.orderId}));}
 for(let i=0;i<40;i++){const [c,e]=pick(CUR);repl.push(entry({externalId:'rp-'+i,kind:'replacement',effectiveAt:when(),currency:c,exponent:e,basis:'invoice',status:pick(['settled','pending']),amountMinor:String(Math.floor(rnd()*9999))}));}
 const rev=(list,n,exp)=>list.slice(0,n).map(x=>({...x,expectedRevision:exp,amountMinor:x.kind==='reversal'?x.amountMinor:String(BigInt(x.amountMinor??0)+7n),report:REPORT+' revision '+(exp+1)}));
 const phases=[];const chunk=(source,kind,list)=>{for(let i=0;i<list.length;i+=250)phases.push({source,entries:list.slice(i,i+250)});};
 chunk(S_ORD,'order',orders);chunk(S_PAY,'refund',refunds);chunk(S_PAY,'reversal',reversals);chunk(S_REP,'replacement',repl);
 const dup=entry({externalId:'dup-1',amountMinor:'99'});
 phases.push({source:S_ORD,entries:orders.slice(0,250)});                          // identical retry: all replayed
 phases.push({source:S_ORD,entries:[...rev(orders,150,1),orders[200],dup,dup]});   // revision 2 + replay of existing + new entry twice in one batch
 phases.push({source:S_ORD,entries:[...rev(orders,150,1),orders[200],dup,dup]});   // retry of the same batch: all replayed
 phases.push({source:S_ORD,entries:rev(orders,30,2).map((x,i)=>({...x,amountMinor:String(i*13)}))}); // revision 3
 return {phases,orders,refunds};
}
const jsEntityId=(source,e)=>stable([T,source,e.kind,e.externalId]);

test('equivalence: batch import produces the same ledger as the per-record importer',{...opts},async()=>{
 const A=await freshDb('econ_eq_a'),B=await freshDb('econ_eq_b');
 try{
  const ra=repoFor(A);await addSources(ra);await addSources(repoFor(B));
  const {phases}=dataset();let replays=0,inserts=0,perRecordRevs=[],batchRevs=[];
  for(const ph of phases){
   for(const e of ph.entries){const r=await ra.record({sourceId:ph.source,sourceVersion:1,...e});perRecordRevs.push([r.id,r.revision]);assert.equal(r.id,jsEntityId(ph.source,e));}
   const out=await batch(B,{sourceId:ph.source,sourceVersion:1,entries:ph.entries});
   assert.equal(out.processed,ph.entries.length);replays+=out.replayed;inserts+=out.inserted;
   out.entries.forEach((o,i)=>{batchRevs.push([o.entityId,o.revision]);assert.equal(o.entityId,jsEntityId(ph.source,ph.entries[i]),'entity id derivation matches JS stable()');});
  }
  assert.deepEqual(batchRevs,perRecordRevs,'same entity id and revision for every call');
  const da=await dump(A),db=await dump(B);
  assert.equal(db.n,da.n);assert.equal(db.digest,da.digest,'full row-level digest identical (all columns except id/recorded_at)');
  assert.ok(replays>=400,'idempotent retries were exercised: '+replays);
  console.log(JSON.stringify({equivalence:{rows:da.n,digest:da.digest.slice(0,16),batchInserted:inserts,batchReplayed:replays,calls:perRecordRevs.length,currencies:CUR.map(c=>c[0])}}));
  // Reads built on the ledger agree too (adapter output over both databases).
  const scope={start:'2026-01-01T00:00:00.000Z',end:'2026-09-01T00:00:00.000Z',timezone:'UTC',dateBasis:'occurred_at',currency:'MXN',exponent:2,basis:'gross_total'};
  const la=await ra.list({scope}),lb=await repoFor(B).list({scope});
  // Row ids are random per database (and so is the order of evidence lists); compare with each id replaced by its (entity, revision) and id lists sorted.
  const norm=async(pool,v)=>{let t=JSON.stringify(v);for(const r of (await pool.query('SELECT id,entity_id,revision FROM public.economic_ledger_entries')).rows)t=t.replaceAll(r.id,`${r.entity_id}@${r.revision}`);return JSON.stringify(JSON.parse(t,(_k,v)=>Array.isArray(v)&&v.length&&v.every(x=>typeof x==='string'&&x.includes('@'))?[...v].sort():v));};
  assert.equal(await norm(B,lb.bundle.metrics),await norm(A,la.bundle.metrics),'adapter metrics identical');
  assert.equal(lb.entries.length,la.entries.length);
 }finally{await A.end();await B.end();}
});

const base=()=>entry({externalId:'err-1'});
const CASES=[ // [name, mutation, per-record code (or sqlstate), batch detail code]
 ['bad currency',{currency:'mxn'},'entry_invalid','entry_invalid'],['exponent 5',{exponent:5},'entry_invalid','entry_invalid'],
 ['impossible date',{effectiveAt:'2026-02-30T00:00:00.000Z'},'entry_invalid','entry_invalid'],['non-UTC date',{effectiveAt:'2026-03-01T00:00:00+02:00'},'entry_invalid','entry_invalid'],
 ['negative order amount',{amountMinor:'-5'},'amount_or_reversal_invalid','amount_or_reversal_invalid'],['numeric amount',{amountMinor:5},'amount_or_reversal_invalid','amount_or_reversal_invalid'],
 ['order with reversalOf',{reversalOf:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},'amount_or_reversal_invalid','amount_or_reversal_invalid'],
 ['reversal without reversalOf',{kind:'reversal',amountMinor:'-1',status:'settled'},'amount_or_reversal_invalid','amount_or_reversal_invalid',S_PAY],
 ['reversal positive',{kind:'reversal',amountMinor:'1',status:'settled',reversalOf:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},'amount_or_reversal_invalid','amount_or_reversal_invalid',S_PAY],
 ['status for kind',{status:'settled'},'status_invalid','status_invalid'],['unattested',{attested:false},'entry_invalid','entry_invalid'],['short report',{report:'too short'},'entry_invalid','entry_invalid'],
 ['blank basis',{basis:'  '},'entry_invalid','entry_invalid'],['long externalId',{externalId:'x'.repeat(201)},'entry_invalid','entry_invalid'],
 ['unknown field',{surprise:1},'unsupported_field','unsupported_field'],['non-empty details',{details:{a:1}},'unsupported_field','unsupported_field'],
 ['stale expectedRevision',{expectedRevision:3},'entry_version_conflict','entry_version_conflict'],
 ['kind/source mismatch',{kind:'refund',status:'settled'},'source_unavailable','source_unavailable'],
 ['inactive source',{},'source_unavailable','source_unavailable',S_OFF],
 ['future effectiveAt',{effectiveAt:'2999-01-01T00:00:00.000Z'},'23514','23514'],
];
test('equivalence: invalid and conflicting entries are rejected with the same cause',{...opts},async()=>{
 const A=await freshDb('econ_err_a'),B=await freshDb('econ_err_b');
 try{
  const ra=repoFor(A);await addSources(ra);await addSources(repoFor(B));
  const codeOf=e=>e instanceof EconomicError?e.code:e.code;
  for(const [name,mut,recCode,batCode,src] of CASES){
   const e={...base(),...mut};const source=src??S_ORD;
   let recErr=null,batErr=null;
   try{await ra.record({sourceId:source,sourceVersion:src===S_OFF?2:1,...e});}catch(x){recErr=x;}
   try{await batch(B,{sourceId:source,sourceVersion:src===S_OFF?2:1,entries:[e]});}catch(x){batErr=x;}
   assert.ok(recErr,`${name}: per-record must reject`);assert.ok(batErr,`${name}: batch must reject`);
   assert.equal(codeOf(recErr),recCode==='23514'?'23514':recCode,`${name}: per-record cause`);
   if(batCode==='23514')assert.equal(batErr.code,'23514',`${name}: batch cause (trigger)`);
   else assert.match(batErr.detail??'',new RegExp(`(^|: )${batCode}$`),`${name}: batch cause`);
  }
  assert.equal(await count(A),0);assert.equal(await count(B),0,'rejections wrote nothing');
  // Narrower on purpose: manual-detail kinds stay on the per-record path.
  await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:1,entries:[{...base(),kind:'support_model',status:'modeled',amountMinor:null}]}),e=>/entry_invalid/.test(e.detail));
  // Stale revision against existing data (conflict), identical replay is accepted.
  const ok=await batch(B,{sourceId:S_ORD,sourceVersion:1,entries:[base()]});assert.equal(ok.inserted,1);
  await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:1,entries:[{...base(),expectedRevision:0,amountMinor:'2'}]}),e=>e.code==='40001'&&/entry_version_conflict/.test(e.detail));
  assert.equal((await batch(B,{sourceId:S_ORD,sourceVersion:1,entries:[base()]})).replayed,1);
  console.log(JSON.stringify({rejectionCases:CASES.length}));
 }finally{await A.end();await B.end();}
});

test('atomicity and authorization: invalid batches leave no partial write',{...opts},async()=>{
 const B=await freshDb('econ_atom');
 try{
  await addSources(repoFor(B));
  const good=n=>Array.from({length:n},(_,i)=>entry({externalId:'ok-'+i,amountMinor:String(i)}));
  const attempts=[
   ['249 valid + stale revision at 250',[...good(249),entry({externalId:'bad',expectedRevision:5})],e=>e.code==='40001'],
   ['249 valid + invalid currency at 250',[...good(249),entry({externalId:'bad',currency:'xx'})],e=>e.code==='23514'&&/entry 250: entry_invalid/.test(e.detail)],
   ['249 valid + future date (trigger fires mid-write)',[...good(249),entry({externalId:'bad',effectiveAt:'2999-01-01T00:00:00.000Z'})],e=>e.code==='23514'],
   ['251 entries',good(251),e=>e.code==='23514'&&/batch_shape_or_size/.test(e.detail)],
   ['0 entries',[],e=>e.code==='23514'],
   ['> 8 MiB payload',Array.from({length:250},(_,i)=>entry({externalId:'big-'+i,report:'r'.repeat(40000)})),e=>e.code==='23514'&&/batch_shape_or_size/.test(e.detail)],
  ];
  for(const [name,entries,pred] of attempts){
   const before=await count(B);
   await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:1,entries}),pred,name);
   assert.equal(await count(B),before,name+': no rows written');
  }
  const before=await count(B);
  await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:1,entries:good(3)},{userId:U_ANALYST}),e=>e.code==='42501','non-owner role');
  await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:1,entries:good(3)},{action:'read'}),e=>e.code==='42501','wrong action');
  await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:1,entries:good(3)},{tenantId:T2}),e=>e.code==='42501','tenant the actor does not belong to');
  await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:1,entries:good(3)},{tenantId:null}),e=>e.code==='42501','no tenant context');
  await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:2,entries:good(3)}),e=>/SOURCE_UNAVAILABLE/.test(e.message),'stale source version');
  await assert.rejects(batch(B,{sourceId:S_ORD,sourceVersion:1,entries:good(3),extra:1}),e=>e.code==='23514','extra top-level field');
  await assert.rejects(batch(B,{sourceId:'55555555-5555-4555-8555-555555555555',sourceVersion:1,entries:good(3)}),e=>/SOURCE_UNAVAILABLE/.test(e.message),'unknown source');
  assert.equal(await count(B),before,'authorization and source rejections wrote nothing');
  // Direct callers other than vexa_backend cannot execute the function or its helpers.
  const c=await B.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await assert.rejects(c.query("SELECT public.economic_batch_import('{}'::jsonb)"),e=>e.code==='42501');}finally{await c.query('ROLLBACK');c.release();}
  console.log(JSON.stringify({atomicity:{attempts:attempts.length+7,rowsAfter:await count(B)}}));
 }finally{await B.end();}
});

test('performance: 250-entry batches against 100k existing entries stay under 3 s',{...opts},async()=>{
 const P=await freshDb('econ_perf');
 try{
  const repo=repoFor(P);await addSources(repo);
  // Seed only: bulk synthetic rows bypass the append triggers via replica role.
  const c=await P.connect();
  try{
   await c.query('SET session_replication_role=replica');
   await c.query(`INSERT INTO public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested)
    SELECT $1,public.economic_batch_entity_id($1,$2,'order','seed-'||n),$2,1,1,$3,'seed-'||n,'order',timestamptz '2026-01-01'+(n||' seconds')::interval,(array['MXN','USD','JPY'])[1+n%3],(array[2,2,0])[1+n%3]::smallint,'gross_total',(n*37%100000)::numeric,'recorded','{}'::jsonb,'${REPORT}',encode(sha256(convert_to('${REPORT}','UTF8')),'hex'),true FROM generate_series(1,100000) n`,[T,S_ORD,U]);
  }finally{await c.query('SET session_replication_role=DEFAULT');c.release();}
  await P.query('ANALYZE public.economic_ledger_entries');
  assert.equal(await count(P),100000);
  const times={new:[],replay:[],revise:[],mixed:[]};const timed=async(k,payload)=>{const t0=performance.now();const out=await batch(P,payload);const ms=performance.now()-t0;times[k].push(ms);return out;};
  const mk=(from,n,extra={})=>Array.from({length:n},(_,i)=>entry({externalId:'new-'+(from+i),amountMinor:String(i),...extra}));
  for(let b=0;b<20;b++){const o=await timed('new',{sourceId:S_ORD,sourceVersion:1,entries:mk(b*250,250)});assert.equal(o.inserted,250);}
  for(let b=0;b<5;b++){const o=await timed('replay',{sourceId:S_ORD,sourceVersion:1,entries:mk(b*250,250)});assert.equal(o.replayed,250);}
  for(let b=0;b<5;b++){const entries=Array.from({length:250},(_,i)=>entry({externalId:'seed-'+(b*250+i+1),expectedRevision:1,amountMinor:String((b*250+i+1)*37%100000),currency:['MXN','USD','JPY'][(b*250+i+1)%3],exponent:[2,2,0][(b*250+i+1)%3],report:REPORT.replace('fixture','fixture r2')}));const o=await timed('revise',{sourceId:S_ORD,sourceVersion:1,entries});assert.equal(o.inserted,250);}
  {const o=await timed('mixed',{sourceId:S_ORD,sourceVersion:1,entries:[...mk(0,100),...mk(9000,150)]});assert.equal(o.replayed,100);assert.equal(o.inserted,150);}
  const stat=a=>{const s=[...a].sort((x,y)=>x-y);return {n:s.length,min:Math.round(s[0]),median:Math.round(s[s.length>>1]),max:Math.round(s[s.length-1])};};
  const summary=Object.fromEntries(Object.entries(times).map(([k,v])=>[k,stat(v)]));
  // Reference: the per-record importer for 250 entries on the same database.
  const t0=performance.now();for(let i=0;i<250;i++)await repo.record({sourceId:S_ORD,sourceVersion:1,...entry({externalId:'pr-'+i})});const perRecordMs=Math.round(performance.now()-t0);
  console.log(JSON.stringify({perf:{priorRows:100000,batchMs:summary,perRecord250Ms:perRecordMs}}));
  for(const [k,v] of Object.entries(times))for(const ms of v)assert.ok(ms<3000,`${k} batch took ${Math.round(ms)} ms`);
  assert.equal(await count(P),100000+20*250+150+5*250+250);
 }finally{await P.end();}
});

test.after(async()=>{if(admin){for(const n of created)await admin.query(`DROP DATABASE IF EXISTS ${n}`).catch(()=>{});await admin.end();}});
