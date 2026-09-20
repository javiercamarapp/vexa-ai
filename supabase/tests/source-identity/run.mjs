import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {persistCanonical,readCanonicalHistory,selectCanonicalRevision,persistNormalizationRejection} from '../../../packages/ingestion/persistence/index.mjs';
import {createEnvelope,normalizeCSV} from '../../../packages/ingestion/index.mjs';
import {sqlPool} from '../../../tests/acceptance/support/F02-durable/sql-pool.mjs';
const root=process.cwd(), tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-source-identity-'));
const evidence=path.join(root,'supabase/tests/source-identity/evidence',randomUUID());fs.mkdirSync(evidence,{recursive:true});
fs.writeFileSync(path.join(evidence,'sources.json'),JSON.stringify(Object.fromEntries(['packages/ingestion/persistence/index.mjs','packages/ingestion/persistence/index.d.ts','supabase/migrations/0006_source_identity.sql','supabase/tests/source-identity/run.mjs'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),null,2));
process.env.VEXA_CI_BROKER=randomUUID();process.env.VEXA_CI_JOURNAL=path.join(evidence,'resources.jsonl');fs.writeFileSync(process.env.VEXA_CI_JOURNAL,'',{mode:0o600});
const support=path.join(root,'tests/acceptance/support');
let infra=fs.readFileSync(path.join(support,'F02-durable/isolated-infra.mjs'),'utf8');
infra=infra.replace("'../ci/resources.mjs'",JSON.stringify(pathToFileURL(path.join(support,'ci/resources.mjs')).href)).replace("'../F01-03/matrix.mjs'",JSON.stringify(pathToFileURL(path.join(support,'F01-03/matrix.mjs')).href));
const testPort=Number(process.env.SOURCE_TEST_PORT??58010);
for(const [a,b] of [['56327',String(testPort)],['56328',String(testPort+1)],['56329',String(testPort+2)]])infra=infra.replaceAll(a,b);
fs.writeFileSync(path.join(tmp,'infra.mjs'),infra);
const {launch}=await import(pathToFileURL(path.join(tmp,'infra.mjs')));
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
let h,pool;const checks=[];let phase='infra';
const check=async(name,work)=>{await work();checks.push(name);console.log('PASS '+name);};
try{
 h=await launch({services:true});
 for(const file of fs.readdirSync('supabase/migrations').filter(x=>/^000[1-6].*sql$/.test(x)).sort())h.sql(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 for(const name of ['session','db'])fs.writeFileSync(path.join(tmp,name+'.mjs'),stripTypeScriptTypes(fs.readFileSync('packages/platform/src/'+name+'.ts','utf8')).replaceAll("'@vexa/platform/session'","'./session.mjs'"));
 const {createDatabase}=await import(pathToFileURL(path.join(tmp,'db.mjs')));
 const config=h.productConfiguration();pool=sqlPool(config.container,config.connection);
 const actors=[];
 for(let i=0;i<2;i++){
  const a=await h.user();Object.assign(a,{tenant:randomUUID(),connection:randomUUID(),account:randomUUID()});
  h.sql(`INSERT INTO organizations(id,name) VALUES(${q(a.tenant)},'SYNTHETIC'); INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(a.tenant)},${q(a.id)},'owner','active'); INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(a.connection)},${q(a.tenant)},'csv',${q(a.account)});`);
  actors.push(a);
 }
 const [a,b]=actors;
 const db=actor=>createDatabase({pool,selectedTenant:actor.tenant,identity:{getUser:async()=>{const r=await h.http('auth','/user',actor.token);assert.equal(r.status,200);return r.data;},memberships:async()=>{const r=await h.http('rest','/memberships?select=*',actor.token);assert.equal(r.status,200);return r.data;}}});
 const imp=(actor,file='fixture')=>{const id=randomUUID();h.sql(`INSERT INTO imports(id,tenant_id,connection_id,file_hash,mapping_version,state,idempotency_key) VALUES(${q(id)},${q(actor.tenant)},${q(actor.connection)},${q(file)},'v1','queued',${q(id)});`);return id;};
 const record=(actor,type,external,payload={},revision='1',row=external)=>({envelope:createEnvelope({tenant_id:actor.tenant,connection_id:actor.connection,source:'csv',source_account_id:actor.account},{entity_type:type,external_id:external,source_revision:revision,occurred_at:'2026-09-20T00:00:00Z',observed_at:'2026-09-20T00:00:00Z',payload_ref:'fixture:'+external},payload),payload,row_ref:row,mapping_version:'v1'});
 const run=(actor,importId,r)=>db(actor).transaction('import',s=>persistCanonical(s,{importId,record:r}));
 phase='product';
 await check('runtime role has no bypass or ownership',async()=>{const r=await db(actors[0]).transaction('read',s=>s.query("select rolname,rolsuper,rolbypassrls from pg_roles where rolname=current_user"));assert.deepEqual(r.rows,[{rolname:'vexa_backend',rolsuper:false,rolbypassrls:false}]);});
 let customer,conversation;
 await check('five entities, exact money, no raw text',async()=>{
  const i=imp(a);
  customer=await run(a,i,record(a,'customer','c'));assert.equal(customer.status,'inserted');
  assert.equal((await run(a,i,record(a,'product','p',{sku:'SYN'}))).status,'inserted');
  assert.equal((await run(a,i,record(a,'order','o',{amount_minor:'9007199254740993',currency:'USD',exponent:2,amount_basis:'gross',customer_external_id:'c',product_external_id:'p'}))).status,'inserted');
  conversation=await run(a,i,record(a,'conversation','conv',{order_external_id:'o'}));assert.equal(conversation.status,'inserted');
  assert.equal((await run(a,i,record(a,'message','msg',{role:'customer',text:'SYNTHETIC RAW',conversation_external_id:'conv'}))).status,'inserted');
  assert.equal(h.sql('select amount_minor from orders'),'9007199254740993');assert.equal(h.sql('select count(*) from message_revisions where redacted_text is not null'),'0');
 });
 await check('repeat/reorder stable IDs and counters',async()=>{
  const i=imp(a),r=record(a,'customer','c');
  assert.deepEqual(await run(a,i,r),{status:'duplicate',code:'DUPLICATE',canonical_id:customer.canonical_id});
  assert.equal((await run(a,i,r)).status,'duplicate');
  const j=imp(a);for(const x of ['x2','x1'])await run(a,j,record(a,'customer',x));
  const before=h.sql('select string_agg(id::text,\',\' order by id) from source_revisions');
  for(const x of ['x1','x2'])assert.equal((await run(a,imp(a),record(a,'customer',x))).status,'duplicate');
  assert.equal(h.sql('select string_agg(id::text,\',\' order by id) from source_revisions'),before);
  assert.equal(h.sql(`select total||':'||duplicates from imports where id=${q(i)}`),'1:1');
 });
 await check('versions remain history, conflict durable original',async()=>{
  assert.equal((await run(a,imp(a),record(a,'customer','c',{},'z'))).code,'REVISION_AMBIGUOUS');
  assert.equal((await run(a,imp(a),record(a,'customer','c',{},'a'))).code,'REVISION_AMBIGUOUS');
  const r=await run(a,imp(a),record(a,'customer','c',{changed:true}));assert.equal(r.status,'conflict');assert.equal(r.canonical_id,customer.canonical_id);
  assert.equal(h.sql(`select count(*) from source_quarantine where original_revision_id in (select id from source_revisions where canonical_id=${q(customer.canonical_id)} ) and code='REVISION_CONFLICT'`),'1');
  const r2=await run(a,imp(a),record(a,'order','ambiguous',{amount_minor:null,currency:'USD',exponent:2,amount_basis:'gross',customer_external_id:'c'}));assert.equal(r2.code,'REFERENCE_AMBIGUOUS');
 });
 await check('tenant/hash/role/date/mapping quarantine',async()=>{
  const i=imp(a);
  assert.equal((await run(a,i,record(b,'customer','wrong'))).code,'SOURCE_SCOPE_MISMATCH');
  const bad=record(a,'customer','hash');bad.payload={changed:true};assert.equal((await run(a,i,bad)).code,'CONTENT_HASH_MISMATCH');
  assert.equal((await run(a,i,record(a,'message','unknown',{role:'unknown',text:'SYN',conversation_external_id:'conv'}))).code,'ROLE_AMBIGUOUS');
  const date=record(a,'message','date',{role:'agent',text:'SYN',conversation_external_id:'conv'});date.envelope={...date.envelope,occurred_at:null};assert.equal((await run(a,i,date)).status,'inserted');
  const mapping=record(a,'customer','mapping');mapping.mapping_version='v2';assert.equal((await run(a,i,mapping)).code,'MAPPING_VERSION_MISMATCH');
  const foreign=await run(b,imp(b),record(b,'customer','c'));assert.notEqual(foreign.canonical_id,customer.canonical_id);
  const visible=await db(a).transaction('read',s=>s.query('select distinct tenant_id from source_revisions'));assert.deepEqual(visible.rows,[{tenant_id:a.tenant}]);
 });
 await check('CSV real parser, structural conversation, money not inferred',async()=>{
  const parsed=normalizeCSV('external_id,source_revision,occurred_at,text,role,conversation_id,amount,currency\nm1,1,2026-09-20T00:00:00Z,SYN,customer,thread,10.00,USD\nm2,1,2026-09-20T00:00:00Z,SYN,agent,thread,20.00,USD',{context:{tenant_id:a.tenant,connection_id:a.connection,source:'csv',source_account_id:a.account},observed_at:'2026-09-20T00:00:00Z',mappingVersion:'v1'});
  assert.equal(parsed.records.length,2);const i=imp(a,parsed.batch_hash);for(const r of parsed.records)assert.equal((await run(a,i,r)).status,'inserted');
  assert.equal(h.sql('select count(*) from orders'),'1');
 });
 await check('rollback is not rejection; all effects atomic',async()=>{
  const i=imp(a);await assert.rejects(db(a).transaction('import',async s=>{await persistCanonical(s,{importId:i,record:record(a,'customer','rollback')});throw Error('SYN_FAULT');}));
  assert.equal(h.sql(`select count(*) from import_rows where import_id=${q(i)}`),'0');assert.equal(h.sql("select count(*) from source_revisions where external_id='rollback'"),'0');
  await assert.rejects(db(a).transaction('import',async s=>{await s.query('SELECT missing_column FROM imports');await persistCanonical(s,{importId:i,record:record(a,'customer','db-error')});}));
 });
 await check('viewer/operator denied, revocation during transaction',async()=>{
  for(const role of ['viewer','operator']){h.sql(`update memberships set role=${q(role)} where user_id=${q(b.id)}`);await assert.rejects(run(b,imp(b),record(b,'customer','denied')),e=>e.status===403);}
  h.sql(`update memberships set role='owner' where user_id=${q(b.id)}`);
  const i=imp(b);await assert.rejects(db(b).transaction('import',async s=>{h.sql(`update memberships set status='revoked' where user_id=${q(b.id)}`);await persistCanonical(s,{importId:i,record:record(b,'customer','revoked')});}));
  h.sql(`update memberships set status='active' where user_id=${q(b.id)}`);
 });
 await check('new tables deny browser DML, immutable revision, row conflict',async()=>{
  const i=imp(a),r=record(a,'customer','row-conflict');const first=await run(a,i,r);
  assert.equal((await run(a,i,{...r,payload:{changed:true}})).code,'IMPORT_ROW_CONFLICT');
  assert.equal(h.sql(`select total from imports where id=${q(i)}`),'1');
  await assert.rejects(db(a).transaction('import',s=>s.query('UPDATE source_revisions SET fingerprint=$1 WHERE id=$2',['0'.repeat(64),first.canonical_id])),e=>e.status===403);
  for(const table of ['source_revisions','source_quarantine']){
   const probe=h.probe(`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO result FROM public.${table} r;`,{id:a.id});assert.equal(probe.code,'42501');
  }
 });
 await check('failure after domain insertion rolls back instead of quarantine',async()=>{
  const i=imp(a);h.sql(`CREATE FUNCTION source_test_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC' USING ERRCODE='P0001'; END $$; CREATE TRIGGER source_test_fault BEFORE INSERT ON import_rows FOR EACH ROW EXECUTE FUNCTION source_test_fault();`);
  try{await assert.rejects(run(a,i,record(a,'customer','sql-rollback')),e=>e.status===503);}finally{h.sql('DROP TRIGGER source_test_fault ON import_rows; DROP FUNCTION source_test_fault()');}
  assert.equal(h.sql("select count(*) from source_revisions where external_id='sql-rollback'"),'0');assert.equal(h.sql(`select total from imports where id=${q(i)}`),'0');
 });
 await check('two OS processes, independent imports, unique DB winner',async()=>{
  const childFile=path.join(tmp,'child.mjs');
  fs.writeFileSync(childFile,`import fs from 'node:fs';import {createDatabase} from './db.mjs';import {sqlPool} from ${JSON.stringify(pathToFileURL(path.join(support,'F02-durable/sql-pool.mjs')).href)};import {persistCanonical,readCanonicalHistory,selectCanonicalRevision,persistNormalizationRejection} from ${JSON.stringify(pathToFileURL(path.join(root,'packages/ingestion/persistence/index.mjs')).href)};const c=JSON.parse(fs.readFileSync(process.argv[2]));const rawPool=sqlPool(c.container,c.connection);const pool={close:()=>rawPool.close(),connect:async()=>{const conn=await rawPool.connect();return {release:()=>conn.release(),query:async(text,values)=>{try{return await conn.query(text,values);}catch(e){console.error('SQLSTATE '+e.code+' '+text.slice(0,65));throw e;}}};}};const identity={getUser:async()=>c.user,memberships:async()=>[c.membership]};try{const d=createDatabase({pool,identity,selectedTenant:c.membership.tenant_id});const r=await d.transaction('import',async s=>{await s.query('SELECT pg_sleep(0.2)');const result=await persistCanonical(s,c.input);await s.query('SELECT pg_sleep(0.5)');return result;});console.log(JSON.stringify(r));}finally{pool.close();}`);
  const children=[imp(a),imp(a)].map(importId=>{const file=path.join(tmp,randomUUID()+'.json');fs.writeFileSync(file,JSON.stringify({...config,user:{id:a.id},membership:{tenant_id:a.tenant,user_id:a.id,role:'owner',status:'active',permissions_version:1},input:{importId,record:record(a,'customer','race')}}),{mode:0o600});return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[childFile,file],{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('exit',code=>code===0?resolve(JSON.parse(out)):reject(Error('CHILD_FAILED '+err)));});});
  const results=await Promise.all(children);assert.deepEqual(results.map(x=>x.status).sort(),['duplicate','inserted']);assert.equal(results[0].canonical_id,results[1].canonical_id);
 });
 await check('stable order history, ambiguity clears money, explicit CAS restores exact snapshot',async()=>{
  const make=(rev,amount)=>record(a,'order','selection-order',{amount_minor:amount,currency:'USD',exponent:2,amount_basis:'gross'},rev);
  const r=await run(a,imp(a),make('z','9007199254740993'));
  const next=await run(a,imp(a),make('a','9007199254740994'));
  assert.equal(next.canonical_id,r.canonical_id);assert.equal(next.code,'REVISION_AMBIGUOUS');
  assert.equal(h.sql(`select count(*) from orders where id=${q(r.canonical_id)}`),'1');
  assert.equal(h.sql(`select amount_minor is null from orders where id=${q(r.canonical_id)}`),'t');
  const history=await db(a).transaction('read',s=>readCanonicalHistory(s,{canonicalId:r.canonical_id}));
  assert.equal(history.head.version,2);assert.equal(history.revisions.length,2);
  assert.deepEqual(history.revisions.map(x=>x.snapshot[0].row.amount_minor).sort(),['9007199254740993','9007199254740994']);
  assert.ok(history.revisions.every(x=>x.id!==r.canonical_id));
  const target=history.revisions.find(x=>x.source_revision==='a');
  const select=s=>selectCanonicalRevision(s,{canonicalId:r.canonical_id,revisionId:target.id,expectedVersion:2,reason:'synthetic reviewed source'});
  await assert.rejects(db(a).transaction('read',select));
  h.sql(`update memberships set role='analyst' where user_id=${q(a.id)}`);
  await assert.rejects(db(a).transaction('import',select));
  h.sql(`update memberships set role='owner' where user_id=${q(a.id)}`);
  const choices=await Promise.all([db(a).transaction('import',select),db(a).transaction('import',select)]);
  assert.deepEqual(choices.map(x=>x.status).sort(),['conflict','selected']);
  assert.equal(h.sql(`select amount_minor from orders where id=${q(r.canonical_id)}`),'9007199254740994');
  assert.equal(h.sql(`select count(*) from audit_events where resource=${q(r.canonical_id)} and actor=${q(a.id)}`),'1');
  const after=await db(a).transaction('read',s=>readCanonicalHistory(s,{canonicalId:r.canonical_id}));assert.deepEqual(after.revisions,history.revisions);
  assert.equal((await run(a,imp(a),make('a','9007199254740994'))).status,'duplicate');
  assert.equal((await run(a,imp(a),make('a','11'))).code,'REVISION_CONFLICT');
  assert.equal((await run(a,imp(a),make('third','12'))).code,'REVISION_AMBIGUOUS');
  assert.equal(h.sql(`select amount_minor is null from orders where id=${q(r.canonical_id)}`),'t');
 });
 await check('four other entities preserve revisions and relationships; dates nullable',async()=>{
  const c=record(a,'customer','hist-c',{display_name:'SYN-ONE'});c.envelope={...c.envelope,occurred_at:null};
  const cr=await run(a,imp(a),c);assert.equal(cr.status,'inserted');
  const p=record(a,'product','hist-p',{sku:'HIST'});p.envelope={...p.envelope,occurred_at:null};
  const pr=await run(a,imp(a),p);assert.equal(pr.status,'inserted');
  const cv=await run(a,imp(a),record(a,'conversation','hist-cv',{customer_external_id:'hist-c'}));
  const mr=await run(a,imp(a),record(a,'message','hist-m',{role:'customer',text:'old',conversation_external_id:'hist-cv'}));
  for(const [type,external,payload,first] of [['message','hist-m',{role:'agent',text:'new',conversation_external_id:'hist-cv'},mr],['conversation','hist-cv',{},cv],['product','hist-p',{sku:'HIST2'},pr],['customer','hist-c',{display_name:'SYN-TWO'},cr]]){
   const r=await run(a,imp(a),record(a,type,external,payload,'new'));assert.equal(r.canonical_id,first.canonical_id);assert.equal(r.code,'REVISION_AMBIGUOUS');
   const history=await db(a).transaction('read',s=>readCanonicalHistory(s,{canonicalId:r.canonical_id}));assert.equal(history.revisions.length,2);
   assert.notDeepEqual(history.revisions[0].snapshot,history.revisions[1].snapshot);
  }
  assert.equal(h.sql(`select count(*) from message_revisions where message_id=${q(mr.canonical_id)}`),'2');
  assert.equal(h.sql(`select count(*) from conversations where id=${q(cv.canonical_id)}`),'1');
 });
 await check('CSV known relations and mismatch quarantine without orders from amount',async()=>{
  await run(a,imp(a),record(a,'customer','csv-known'));
  await run(a,imp(a),record(a,'product','csv-p',{sku:'CSV-KNOWN'}));
  await run(a,imp(a),record(a,'order','csv-order',{amount_minor:'37',currency:'USD',exponent:2,amount_basis:'gross',customer_external_id:'csv-known',product_external_id:'csv-p'}));
  const parse=(customer='csv-known',rev='1')=>normalizeCSV(`external_id,source_revision,occurred_at,text,role,conversation_id,customer_id,order_id,sku,amount,currency\nknown-msg,${rev},2026-09-20T00:00:00Z,SYN,customer,known-thread,${customer},csv-order,CSV-KNOWN,99,USD`,{context:{tenant_id:a.tenant,connection_id:a.connection,source:'csv',source_account_id:a.account},observed_at:'2026-09-20T00:00:00Z',mappingVersion:'v1'});
  const before=h.sql('select count(*) from orders');const parsed=parse();
  const r=await run(a,imp(a,parsed.batch_hash),parsed.records[0]);assert.equal(r.status,'inserted');
  const again=parse('csv-known','2');assert.equal((await run(a,imp(a,again.batch_hash),again.records[0])).code,'REVISION_AMBIGUOUS');
  assert.equal(h.sql("select count(*) from conversations where external_id='known-thread'"),'1');
  assert.equal(h.sql('select count(*) from orders'),before);
  await run(a,imp(a),record(a,'customer','other-csv'));
  const bad=parse('other-csv','3');assert.equal((await run(a,imp(a,bad.batch_hash),bad.records[0])).code,'REFERENCE_MISMATCH');
 });
 await check('normalization rejection keeps safe metadata, replay and counters',async()=>{
  const i=imp(a,'fixture-hash');const input={importId:i,error:{code:'INVALID_TIMESTAMP',field:'occurred_at'},rowRef:23,rawHash:'a'.repeat(64),batchHash:'fixture-hash',mappingVersion:'v1'};
  const r=await db(a).transaction('import',s=>persistNormalizationRejection(s,input));assert.equal(r.code,'INVALID_TIMESTAMP');assert.equal(r.field,'occurred_at');assert.equal(r.raw_hash,input.rawHash);
  assert.deepEqual(await db(a).transaction('import',s=>persistNormalizationRejection(s,input)),r);
  assert.equal(h.sql(`select total||':'||rejected from imports where id=${q(i)}`),'1:1');
 });
 await check('10000 rows accounted, no cap',async()=>{
  const i=imp(a);await db(a).transaction('import',async s=>{for(let n=0;n<10000;n++){const r=await persistCanonical(s,{importId:i,record:record(a,'customer','bulk-'+n)});assert.equal(r.status,'inserted');}});
  assert.equal(h.sql(`select total||':'||accepted||':'||rejected||':'||duplicates||':'||pending from imports where id=${q(i)}`),'10000:10000:0:0:0');
 });
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({status:'pass',checks},null,2));
}catch(e){fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({status:phase==='infra'?'infra_blocked':'product_failed',checks,error:e.message,stack:e.stack},null,2));console.error(e);process.exitCode=1;}
finally{pool?.close();try{h?.close();fs.writeFileSync(path.join(evidence,'cleanup.json'),JSON.stringify({verified:true}));}catch(e){console.error('CLEANUP_FAILED');process.exitCode=1;}fs.rmSync(tmp,{recursive:true,force:true});console.log('EVIDENCE '+evidence);}
