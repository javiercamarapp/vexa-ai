import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createLearningRepository} from './index.mjs';
import {hashValue} from '../evaluation/evaluate.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const cutoff='2026-01-10T00:00:00.000Z';
// SYN fixture at the SQL port: exercises the real evidence reader, exporter and
// CLI without a database, credentials, provider or inference. Not an SQL test.
function fixture(event='2026-01-01T00:00:00.000Z',invalidRevision=false){
 const tenant=id(1),connection=id(2),conversation=id(3),customer=id(4),runId=id(5),cohortId=id(6),taxonomy=['delivery'];
 const source=[{id:id(20),original_id:id(30),message_id:id(40),text:'SYN Primero: pedido pendiente.',role:'customer'},
  {id:id(10),original_id:id(31),message_id:id(41),text:'SYN Después: pedido entregado.',role:'agent'},
  {id:id(15),original_id:id(32),message_id:id(42),text:'SYN Finalmente: recepción confirmada.',role:'customer'}];
 const manifest=source.map(r=>({message_revision_id:r.id,original_revision_id:r.original_id,hash:sha(r.text),role:r.role}));
 const policyHash=sha('SYN policy'),inputHash=sha(JSON.stringify({revisions:source.map(r=>({tenant_id:tenant,message_revision_id:r.id,role:r.role,text:r.text})),policyHash,taxonomy}));
 const result={issues:[],sentiment:'unknown',intent:'unknown',urgency:'unknown',entities:[],abstention:{reason:'insufficient_evidence'}};
 const run={id:runId,status:'abstained',conversation_id:conversation,input_hash:inputHash,updated_at:'2026-01-03T00:00:00.000Z',created_at:'2026-01-03T00:00:00.000Z',prompt_hash:sha('prompt'),schema_hash:sha('schema'),model_id:'SYN no inference',provenance:{input_manifest:manifest,result,taxonomy,policy_hash:policyHash},result_hash:hashValue(result),manifest_hash:hashValue(manifest),taxonomy_hash:hashValue(taxonomy)};
 const cohort={id:cohortId,connection_id:connection,cutoff,window_start:'2025-01-01T00:00:00.000Z',taxonomy,taxonomy_hash:run.taxonomy_hash,item_count:1};
 const item={ordinal:1,run_id:runId,conversation_id:conversation,customer_id:customer,input_hash:inputHash,result_hash:run.result_hash,manifest_hash:run.manifest_hash};
 const revisions=source.map(r=>({...r,hash:sha(r.text),redacted_text:r.text,created_at:'2026-01-02T00:00:00.000Z',original_available:'2026-01-02T00:00:00.000Z',occurred_at:event})).sort((a,b)=>a.id.localeCompare(b.id));
 const evidence=source.map(r=>({...r,redacted_text:r.text,hash:sha(r.text),redaction_version:'SYN',original_message_id:r.message_id,canonical_id:r.message_id,connection_id:connection,source_connection:connection,external_id:'SYN-'+r.id,current_revision:r.original_id,head_state:'unique',snapshot:[{table:'messages',row:{id:r.message_id,role:r.role,conversation_id:conversation}}]}));
 if(invalidRevision)evidence[1].redacted_text='SYN altered revision';
 const session={tenantId:tenant,userId:id(7),role:'owner',async query(sql){
  let rows;
  if(sql.includes('public.vexa_member'))rows=[{ok:true}];
  else if(sql.includes('pg_advisory'))rows=[];
  else if(sql.includes('FROM public.learning_cohorts'))rows=[cohort];
  else if(sql.includes('FROM public.learning_items'))rows=[item];
  else if(sql.includes('FROM public.extraction_runs'))rows=[run];
  else if(sql.includes('SELECT c.id,c.external_id'))rows=[{id:conversation,external_id:'SYN conversation',source:'zendesk',connection_id:connection,account_id:'SYN account',status:'active',state:'unique'}];
  else if(sql.includes('SELECT v.customer_id'))rows=[{customer_id:customer,conversation_available:'2026-01-02T00:00:00.000Z',customer_available:'2026-01-02T00:00:00.000Z',connection_id:connection,external_id:'SYN customer',state:'unique'}];
  else if(sql.includes('SELECT r.id,r.message_id'))rows=evidence;
  else if(sql.includes('SELECT v.id,v.hash'))rows=revisions;
  else if(sql.includes('retention_source_deleted'))rows=[{deleted:false}];
  else if(sql.includes('FROM public.tombstones')||sql.includes('FROM public.learning_feedback'))rows=[];
  else if(sql.includes('FROM public.connections'))rows=[{id:connection}];
  else throw Error('Unexpected SQL in SYN fixture: '+sql);
  return {rows};
 }};
 return {repo:createLearningRepository({database:{transaction:async(_,fn)=>fn(session)},clock:()=>Date.parse('2026-02-01T00:00:00Z')}),cohortId,expected:source.map(r=>r.text)};
}

test('development preserves the immutable extraction message sequence despite permuted revision UUIDs',async()=>{
 const f=fixture(),bundle=await f.repo.exportDevelopment(f.cohortId);
 assert.deepEqual(bundle.dataset.cases[0].messages.map(m=>m.text),f.expected);
 assert.deepEqual(bundle.development.cases[0].messages.map(m=>m.text),f.expected);
 const expectedMessages=bundle.dataset.cases[0].messages.toSorted((a,b)=>f.expected.indexOf(a.text)-f.expected.indexOf(b.text));
 assert.equal(bundle.dataset.cases[0].content_hash,hashValue(expectedMessages));
 assert.equal(bundle.development.cases[0].content_hash,hashValue(expectedMessages));
 assert.equal(bundle.protocol.dataset_hash,hashValue(bundle.dataset));
 assert.deepEqual(bundle.counts,{selected:1,exported:1,excluded:0});
 assert.equal(bundle.dataset.kind,'silver_assisted');assert.equal(bundle.dataset.cases[0].split,'dev');assert.equal(bundle.promotionEnabled,false);
 assert.equal(bundle.dataset.cases[0].event_time,'2026-01-01T00:00:00.000Z');
 assert.equal(bundle.dataset.cases[0].available_at,'2026-01-03T00:00:00.000Z');
});

test('altered source revision remains excluded before development export',async()=>{
 const f=fixture(undefined,true),bundle=await f.repo.exportDevelopment(f.cohortId);
 assert.deepEqual(bundle.counts,{selected:1,exported:0,excluded:1});
 assert.equal(bundle.excluded[0].reason,'source_unavailable');assert.deepEqual(bundle.dataset.cases,[]);
});

test('missing, invalid and at-cutoff event dates remain excluded with exact counts',async()=>{
 for(const event of [null,'invalid',cutoff,'2026-01-11T00:00:00.000Z']){
  const f=fixture(event),bundle=await f.repo.exportDevelopment(f.cohortId);
  assert.deepEqual(bundle.counts,{selected:1,exported:0,excluded:1});
  assert.equal(bundle.excluded[0].reason,'temporal_cutoff_excluded');assert.deepEqual(bundle.development.cases,[]);
 }
});

test('unchanged CLI freeze/export-dev roundtrip preserves development cases byte for byte',async()=>{
 const f=fixture(),bundle=await f.repo.exportDevelopment(f.cohortId),directory=await mkdtemp(join(tmpdir(),'vexa-learning-export-syn-'));
 try{
  for(const key of ['dataset','spec'])await writeFile(join(directory,key+'.json'),JSON.stringify(bundle[key]),{mode:0o600});
  const cli=fileURLToPath(new URL('../evaluation/cli.mjs',import.meta.url));
  for(const [command,flags] of [['freeze',['--dataset','dataset','--spec','spec','--out','protocol']],['export-dev',['--protocol','protocol','--dataset','dataset','--out','development']]]){
   const result=spawnSync(process.execPath,[cli,command,...flags.map((x,i)=>i%2?join(directory,x+'.json'):x)],{encoding:'utf8',timeout:10000,killSignal:'SIGKILL'});
   assert.equal(result.status,0,result.stderr);
  }
  const exported=JSON.parse(await readFile(join(directory,'development.json'),'utf8'));
  assert.equal(JSON.stringify(exported.cases),JSON.stringify(bundle.development.cases));
 }finally{await rm(directory,{recursive:true,force:true});}
});
