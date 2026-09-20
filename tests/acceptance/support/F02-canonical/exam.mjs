import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {runtime,q} from '../F02-durable/runtime.mjs';
const candidate=process.env.VEXA_CANDIDATE;
const stable=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(stable).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
test('F02-04 independent real persistence effects',{timeout:240000},async t=>{
 assert.ok(candidate&&fs.existsSync(path.join(candidate,'packages/ingestion/persistence/index.mjs')),'IMPLEMENTATION_MISSING:F02-04');
 const {persistCanonical,readCanonicalHistory,selectCanonicalRevision,persistNormalizationRejection}=await import(pathToFileURL(path.join(candidate,'packages/ingestion/persistence/index.mjs')));
 const h=await runtime(candidate);t.after(()=>h.close());
 for(const table of ['source_revisions','source_quarantine'])assert.equal(h.sql(`SELECT to_regclass('public.${table}') IS NOT NULL`),'t','REQUIRED_TABLE:'+table);
 function imported(actor=h.A){const id=randomUUID();h.sql(`INSERT INTO imports(id,tenant_id,connection_id,file_hash,mapping_version,state,idempotency_key,total,pending) VALUES(${q(id)},${q(actor.tenant)},${q(actor.connection)},'fixture','1','queued',${q(id)},0,0)`);return id;}
 function record(actor,type,external,payload={},revision='1',date='2026-09-01T00:00:00Z'){
  const account=h.sql(`SELECT account_id FROM connections WHERE id=${q(actor.connection)}`);
  return {row_ref:randomUUID(),mapping_version:'1',envelope:{tenant_id:actor.tenant,connection_id:actor.connection,source:'csv',source_account_id:account,entity_type:type,external_id:external,source_revision:revision,occurred_at:date,observed_at:'2026-09-02T00:00:00Z',content_hash:hash(payload),payload_ref:'sha256:'+hash(payload)},payload};
 }
 const db=actor=>h.ports.database(new Request('http://fixture.test',{headers:{Authorization:'Bearer '+actor.token,'x-vexa-organization':actor.tenant}}));
 const save=(r,actor=h.A,id=imported(actor))=>db(actor).transaction('import',s=>persistCanonical(s,{importId:id,record:r}));
 const money={amount_minor:'9007199254740993',currency:'USD',exponent:2,amount_basis:'gross'};
 await t.test('five entities and exact bigint known relationships',async()=>{
  for(const [type,payload] of [['customer',{}],['product',{sku:'KNOWN'}],['order',{...money,customer_external_id:'known',product_external_id:'known'}],['conversation',{customer_external_id:'known',order_external_id:'known'}],['message',{conversation_external_id:'known',role:'internal',text:'synthetic'}]])assert.equal((await save(record(h.A,type,'known',payload))).status,'inserted',type);
  assert.equal(h.sql("SELECT amount_minor::text FROM orders WHERE external_id='known'"),money.amount_minor,'BIGINT_EXACT');
  assert.equal(h.sql("SELECT count(*) FROM orders o JOIN customers c ON c.id=o.customer_id JOIN order_lines l ON l.order_id=o.id JOIN products p ON p.id=l.product_id WHERE o.external_id='known' AND c.external_id='known' AND p.sku='KNOWN'"),'1','KNOWN_RELATIONS');
 });
 await t.test('replay and reorder keep IDs and ledger',async()=>{
  const records=['one','two'].map(x=>record(h.A,'order',x,money));
  for(const r of records)assert.equal((await save(r)).status,'inserted');
  const snap=()=>h.sql("SELECT jsonb_agg(jsonb_build_array(id,amount_minor::text) ORDER BY id) FROM orders WHERE external_id IN ('one','two')");const before=snap();
  for(const r of records.reverse())assert.equal((await save(r)).status,'duplicate');assert.equal(snap(),before,'DEDUP_REORDER');
 });
 await t.test('same revision conflicting hash preserves original and quarantines',async()=>{
  const r=record(h.A,'product','conflict',{sku:'OLD'});assert.equal((await save(r)).status,'inserted');
  const before=h.sql("SELECT to_jsonb(p) FROM products p WHERE external_id='conflict'");
  const result=await save(record(h.A,'product','conflict',{sku:'NEW'}));assert.equal(result.status,'conflict','REVISION_CONFLICT');
  assert.equal(h.sql("SELECT to_jsonb(p) FROM products p WHERE external_id='conflict'"),before,'ORIGINAL_IMMUTABLE');
  assert.equal(h.sql("SELECT count(*) FROM source_quarantine WHERE code='REVISION_CONFLICT'"),'1','CONFLICT_QUARANTINE');
 });
 await t.test('two independent Node processes deduplicate concurrent revision',async()=>{
  const r=record(h.A,'product','concurrent',{sku:'RACE'});
  const child=()=>new Promise((resolve,reject)=>{
   const p=spawn(process.execPath,[path.join(import.meta.dirname,'child.mjs')],{stdio:['pipe','pipe','pipe']});let output='';
   p.stdout.on('data',b=>output+=b);p.stderr.resume();p.on('error',reject);p.on('exit',code=>{if(code!==0)return reject(new Error('CHILD_SETUP_OR_PRODUCT_FAILURE:'+code));try{resolve(JSON.parse(output));}catch(e){reject(e);}});
   p.stdin.end(JSON.stringify({config:h.processConfig,candidate,actor:h.A,importId:imported(),record:r}));
  });
  const results=await Promise.all([child(),child()]);assert.deepEqual(results.map(r=>r.status).sort(),['duplicate','inserted'],'CONCURRENT_DEDUP');
  assert.equal(h.sql("SELECT count(*) FROM source_revisions WHERE external_id='concurrent'"),'1','CONCURRENT_DB_ONE');
 });
 await t.test('CSV known customer/order/SKU relationships survive persistence',async()=>{
  const raw={external_id:'csv-linked',source_revision:'1',occurred_at:'2026-09-01T00:00:00Z',text:'synthetic',role:'customer',conversation_id:'csv-conversation',customer_id:'known',order_id:'known',sku:'KNOWN'};
  const r=record(h.A,'message','csv-linked',raw);r.envelope.adapter_version='csv-message-v1';r.raw_payload=raw;r.row_hash=hash(raw);r.batch_hash='fixture';delete r.payload;
  const result=await save(r);assert.equal(result.status,'inserted','CSV_KNOWN_RELATIONS:'+result.code);
  assert.equal(h.sql("SELECT count(*) FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN customers x ON x.id=c.customer_id JOIN orders o ON o.id=c.order_id WHERE m.external_id='csv-linked' AND x.external_id='known' AND o.external_id='known'"),'1','CSV_RELATIONS_PRESERVED');
 });
 await t.test('new revision retains one logical order and does not double money',async()=>{
  await save(record(h.A,'order','revision-money',money));await save(record(h.A,'order','revision-money',{...money,amount_minor:'9007199254740994'},'2'));
  assert.equal(h.sql("SELECT count(*) FROM source_revisions WHERE external_id='revision-money'"),'2','REVISION_HISTORY');
  t.diagnostic('OBSERVED_REVISION_SUM='+h.sql("SELECT sum(amount_minor)::text FROM orders WHERE external_id='revision-money'"));
  assert.equal(h.sql("SELECT count(*) FROM orders WHERE external_id='revision-money'"),'1','LOGICAL_ORDER_SINGLE_PROJECTION');
  assert.equal(h.sql("SELECT amount_minor IS NULL FROM orders WHERE external_id='revision-money'"),'t','AMBIGUOUS_NO_MONEY_AUTHORITY');
  const canonicalId=h.sql("SELECT id FROM orders WHERE external_id='revision-money'");
  const history=await db(h.A).transaction('read',s=>readCanonicalHistory(s,{canonicalId}));
  assert.equal(history.head.state,'ambiguous');assert.equal(history.revisions.length,2);assert.equal(history.head.selected_revision_id,null);
  const revision=history.revisions.find(r=>r.source_revision==='1');
  const args={canonicalId,revisionId:revision.id,expectedVersion:Number(history.head.version),reason:'synthetic explicit owner choice'};
  const results=await Promise.all([1,2].map(()=>db(h.A).transaction('import',s=>selectCanonicalRevision(s,args))));
  assert.deepEqual(results.map(r=>r.status).sort(),['conflict','selected'],'OWNER_CAS_ONE_WINNER');
  assert.equal(h.sql("SELECT amount_minor::text FROM orders WHERE external_id='revision-money'"),money.amount_minor,'SELECTED_EXACT_NOT_LATEST');
  assert.equal(h.sql(`SELECT count(*) FROM audit_events WHERE resource=${q(canonicalId)} AND actor=${q(h.A.id)} AND action='source_revision_selected'`),'1','OWNER_AUDIT');
  for(const role of ['analyst','viewer','operator']){h.sql(`UPDATE memberships SET role=${q(role)} WHERE user_id=${q(h.A.id)}`);try{await assert.rejects(db(h.A).transaction('import',s=>selectCanonicalRevision(s,{...args,expectedVersion:args.expectedVersion+1})));}finally{h.sql(`UPDATE memberships SET role='owner' WHERE user_id=${q(h.A.id)}`);}}
  await assert.rejects(db(h.A).transaction('read',s=>selectCanonicalRevision(s,args)));
  await assert.rejects(db(h.B).transaction('import',s=>selectCanonicalRevision(s,args)));
  await save(record(h.A,'order','revision-money',{...money,amount_minor:'7'},'opaque-earlier'));
  assert.equal(h.sql("SELECT amount_minor IS NULL FROM orders WHERE external_id='revision-money'"),'t','NEW_REV_INVALIDATES_SELECTION');
 });
 for(const [type,p] of [['customer',{}],['product',{sku:'NULL-DATE'}],['conversation',{}],['message',{conversation_external_id:'known',role:'internal',text:'synthetic'}]])await t.test(type+' permits occurred_at null',async()=>{assert.equal((await save(record(h.A,type,'null-date',p,'1',null))).status,'inserted','TIME_OPTIONAL:'+type);});
 await t.test('tenant, source, account, content hash and mapping cannot be forged',async()=>{
  for(const field of ['tenant_id','source','source_account_id','content_hash','mapping_version']){
   const r=record(h.A,'product','forged-'+field,{sku:'BAD'});
   if(field==='mapping_version')r[field]='2';else r.envelope[field]=field==='tenant_id'?h.B.tenant:field==='content_hash'?'0'.repeat(64):'forged';
   assert.equal((await save(r)).status,'rejected','SCOPE_REJECT:'+field);
  }
  const a=await save(record(h.A,'product','two-tenants',{sku:'SAME'}));const b=await save(record(h.B,'product','two-tenants',{sku:'SAME'}),h.B);assert.equal(a.status,'inserted');assert.equal(b.status,'inserted');assert.notEqual(a.canonical_id,b.canonical_id,'TENANT_IDENTITY');
 });
 await t.test('ambiguous reference quarantines, never selects arbitrary customer',async()=>{
  await save(record(h.A,'customer','ambiguous',{},'1'));await save(record(h.A,'customer','ambiguous',{},'2'));
  const r=await save(record(h.A,'order','ambiguous-order',{...money,customer_external_id:'ambiguous'}));assert.equal(r.status,'rejected');assert.equal(r.code,'REFERENCE_AMBIGUOUS');assert.equal(h.sql("SELECT count(*) FROM orders WHERE external_id='ambiguous-order'"),'0');
 });
 await t.test('same import exact replay does not increment counters and changed row quarantines',async()=>{
  const id=imported(),r=record(h.A,'product','same-import',{sku:'FIRST'});const first=await save(r,h.A,id);
  const snapshot=()=>h.sql(`SELECT to_jsonb(i) FROM imports i WHERE id=${q(id)}`);const before=snapshot();
  assert.deepEqual(await save(r,h.A,id),first);assert.equal(snapshot(),before,'SAME_IMPORT_COUNTERS');
  const changed=record(h.A,'product','same-import',{sku:'CHANGED'});changed.row_ref=r.row_ref;
  assert.equal((await save(changed,h.A,id)).code,'IMPORT_ROW_CONFLICT','SAME_IMPORT_CHANGED_ROW');
  assert.equal(h.sql("SELECT sku FROM products WHERE external_id='same-import'"),'FIRST','SAME_IMPORT_ORIGINAL');
 });
 await t.test('unknown amount remains SQL null rather than zero',async()=>{
  assert.equal((await save(record(h.A,'order','unknown-money',{...money,amount_minor:null}))).status,'inserted');
  assert.equal(h.sql("SELECT amount_minor IS NULL FROM orders WHERE external_id='unknown-money'"),'t','UNKNOWN_NOT_ZERO');
 });
 await t.test('SQL failure propagates and entire transaction rolls back',async()=>{
  const id=imported(),r=record(h.A,'product','rollback',{sku:'ROLLBACK'});
  const snapshot=()=>h.sql(`SELECT to_jsonb(i) FROM imports i WHERE id=${q(id)}`);const before=snapshot();
  h.sql("CREATE SEQUENCE public.exam_fault_reached; GRANT USAGE,SELECT ON public.exam_fault_reached TO vexa_backend; CREATE FUNCTION public.exam_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM nextval('public.exam_fault_reached'); RAISE EXCEPTION 'SYNTHETIC_FAILURE' USING ERRCODE='P0001'; END $$; CREATE TRIGGER exam_fault BEFORE INSERT ON public.import_rows FOR EACH ROW EXECUTE FUNCTION public.exam_fault();");
  try{await assert.rejects(db(h.A).transaction('import',s=>persistCanonical(s,{importId:id,record:r})),e=>e.status===503||e.code==='database_unavailable');assert.equal(h.sql('SELECT is_called FROM exam_fault_reached'),'t','FAULT_INSIDE_PERSIST_REACHED');}
  finally{h.sql('DROP TRIGGER exam_fault ON import_rows; DROP FUNCTION exam_fault(); DROP SEQUENCE exam_fault_reached;');}
  assert.equal(snapshot(),before,'ROLLBACK_ACCOUNTING');assert.equal(h.sql("SELECT count(*) FROM products WHERE external_id='rollback'"),'0','ROLLBACK_PROJECTION');
 });
 await t.test('all five entity histories keep snapshots and one projection',async()=>{
  for(const [type,payload] of [['customer',{display_name:'before'}],['product',{sku:'HIST'}],['order',money],['conversation',{}],['message',{conversation_external_id:'known',role:'customer',text:'before'}]]){
   const external='history-'+type;const first=await save(record(h.A,type,external,payload));
   const second=await save(record(h.A,type,external,{...payload,...(type==='message'?{text:'after'}:{})},'opaque-0'));
   assert.equal(second.code,'REVISION_AMBIGUOUS');assert.equal(second.canonical_id,first.canonical_id);
   const result=await db(h.A).transaction('read',s=>readCanonicalHistory(s,{canonicalId:first.canonical_id}));
   assert.equal(result.revisions.length,2);assert.equal(result.head.state,'ambiguous');
   for(const rev of result.revisions){assert.ok(Array.isArray(rev.snapshot)&&rev.snapshot.length);assert.equal(rev.content_hash.length,64);}
   const table={customer:'customers',product:'products',order:'orders',conversation:'conversations',message:'messages'}[type];
   assert.equal(h.sql(`SELECT count(*) FROM ${table} WHERE id=${q(first.canonical_id)}`),'1');
  }
 });
 await t.test('connection and account identity independent across imports',async()=>{
  const other={...h.A,connection:randomUUID()};h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(other.connection)},${q(other.tenant)},'csv',${q(randomUUID())})`);
  const a=await save(record(h.A,'product','account-independent',{sku:'ACC'}));
  const b=await save(record(other,'product','account-independent',{sku:'ACC'}),other);assert.notEqual(a.canonical_id,b.canonical_id);
  assert.equal((await save(record(other,'product','account-independent',{sku:'ACC'}),other)).status,'duplicate');
 });
 await t.test('normalization rejection exact metadata replay counters and SQL errors',async()=>{
  const {createEnvelope}=await import(pathToFileURL(path.join(candidate,'packages/ingestion/index.mjs')));
  let error;try{createEnvelope({}, {}, {});}catch(e){error=e;}assert.ok(error?.code,'REAL_NORMALIZATION_REJECTION');
  error.message='SYNTHETIC_PRIVATE_RAW_MUST_NOT_PERSIST';error.raw='SYNTHETIC_PRIVATE_RAW_MUST_NOT_PERSIST';
  const importId=imported(),args={importId,error,rowRef:73,rawHash:'a'.repeat(64),batchHash:'fixture',mappingVersion:'1'};
  const run=()=>db(h.A).transaction('import',s=>persistNormalizationRejection(s,args));const first=await run();
  assert.deepEqual(first,{status:'rejected',code:error.code,field:error.field??null,row_ref:73,raw_hash:'a'.repeat(64)});
  const snap=()=>h.sql(`SELECT to_jsonb(i) FROM imports i WHERE id=${q(importId)}`);const before=snap();assert.deepEqual(await run(),first);assert.equal(snap(),before);
  const row=h.json(`SELECT to_jsonb(r) FROM import_rows r WHERE import_id=${q(importId)}`);assert.equal(row.row_ref,'73');assert.equal(row.error_code,error.code);assert.equal(row.provenance.result.raw_hash,args.rawHash);assert.ok(!JSON.stringify(row).includes('SYNTHETIC_PRIVATE_RAW_MUST_NOT_PERSIST'),'NORMALIZATION_NO_PII');
  assert.ok(!h.sql(`SELECT to_jsonb(q) FROM source_quarantine q WHERE import_id=${q(importId)}`).includes('SYNTHETIC_PRIVATE_RAW_MUST_NOT_PERSIST'),'QUARANTINE_NO_PII');
  await assert.rejects(db(h.A).transaction('read',async s=>{await s.query('SELECT 1/0');return readCanonicalHistory(s,{canonicalId:randomUUID()});}));
  await assert.rejects(db(h.A).transaction('import',async s=>{await s.query('SELECT 1/0');return persistNormalizationRejection(s,args);}));
 });
 await t.test('membership revocation denies persistence and history',async()=>{
  const id=imported(),r=record(h.A,'product','revoked',{sku:'NO'});h.sql(`UPDATE memberships SET status='revoked' WHERE user_id=${q(h.A.id)}`);
  try{await assert.rejects(save(r,h.A,id));await assert.rejects(db(h.A).transaction('read',s=>readCanonicalHistory(s,{canonicalId:randomUUID()})));}finally{h.sql(`UPDATE memberships SET status='active' WHERE user_id=${q(h.A.id)}`);}
 });
 await t.test('mapping and file hashes remain bound across imports',async()=>{
  const r=record(h.A,'product','mapping-independent',{sku:'MAP'});await save(r);
  const id=imported();h.sql(`UPDATE imports SET mapping_version='2',file_hash='different' WHERE id=${q(id)}`);
  assert.equal((await save(r,h.A,id)).code,'MAPPING_VERSION_MISMATCH');
  const next=record(h.A,'product','mapping-independent',{sku:'MAP'});next.mapping_version='2';
  assert.equal((await save(next,h.A,id)).code,'REVISION_CONFLICT');
 });
 await t.test('SQL faults inside history and normalization never mean missing data',async()=>{
  const canonicalId=h.sql("SELECT id FROM products WHERE external_id='known'");
  await assert.rejects(db(h.A).transaction('read',s=>readCanonicalHistory({...s,query:(sql,args)=>s.query(sql.includes('source_revisions')?'SELECT 1/0':sql,args)},{canonicalId})),e=>e.status===503||e.code==='database_unavailable');
  const {createEnvelope}=await import(pathToFileURL(path.join(candidate,'packages/ingestion/index.mjs')));let error;try{createEnvelope({}, {}, {});}catch(e){error=e;}
  const importId=imported();let reached=false;
  await assert.rejects(db(h.A).transaction('import',s=>persistNormalizationRejection({...s,query:(sql,args)=>{if(sql.startsWith('INSERT INTO public.import_rows')){reached=true;return s.query('SELECT 1/0');}return s.query(sql,args);}},{importId,error,rowRef:91,rawHash:'b'.repeat(64),batchHash:'fixture',mappingVersion:'1'})),e=>e.status===503||e.code==='database_unavailable');
  assert.equal(reached,true);assert.equal(h.sql(`SELECT total FROM imports WHERE id=${q(importId)}`),'0');assert.equal(h.sql(`SELECT count(*) FROM source_quarantine WHERE import_id=${q(importId)}`),'0');
 });
 await t.test('owner selection fence rejects analyst SQL bypass',async()=>{
  const canonicalId=h.sql("SELECT id FROM orders WHERE external_id='revision-money'");
  h.sql(`UPDATE memberships SET role='analyst' WHERE user_id=${q(h.A.id)}`);
  try{await assert.rejects(db(h.A).transaction('import',s=>s.query("UPDATE source_heads SET selected_revision_id=(SELECT id FROM source_revisions WHERE canonical_id=$1 LIMIT 1),state='selected',version=version+1 WHERE id=$1",[canonicalId])),'P1_OWNER_SELECTION_BYPASS_ANALYST_DIRECT_SQL');}
  finally{h.sql(`UPDATE memberships SET role='owner' WHERE user_id=${q(h.A.id)}`);}
 });
 t.diagnostic('F02_04_COMPLETO: all registered concrete cases executed; inspect failures; no skips');
});
