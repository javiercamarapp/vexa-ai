import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID,createHash} from 'node:crypto';
import {setup,q} from './harness.mjs';
import {csv,xlsx} from '../../tests/acceptance/support/F02-preview/fixtures.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
test('CSV and Excel original Storage objects feed durable private redaction',{timeout:240000},async t=>{
 const candidate=process.env.VEXA_CANDIDATE,evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-extraction-storage-'));let h;
 try{
  h=await setup(candidate,evidence);
  const {recordsFromBytes}=await import(pathToFileURL(path.join(h.built,'packages/jobs/durable/records.mjs')));
  const {persistCanonical}=await import(pathToFileURL(path.join(h.built,'packages/ingestion/persistence/index.mjs')));
  const {createExtractionRepository}=await import(pathToFileURL(path.join(h.built,'packages/intelligence/extraction-repository.mjs')));
  const headers=['id','text','date','role','conversation'],cells=['SYN-1','Ana Pérez ana@example.test: batería rota','2026-09-01T00:00:00Z','customer','SYN-conversation'];
  for(const kind of ['csv','xlsx'])await t.test(kind+' reads and checks the immutable object, denies another tenant, and verifies its content hash',async()=>{
   const a=await h.actor(),other=await h.actor(),connection=randomUUID(),importId=randomUUID(),objectPath=a.tenant+'/imports/'+importId+'/original.'+kind;
   const bytes=kind==='csv'?csv([cells],headers):xlsx([{name:'SYN_DATA',rows:[headers,cells]}]);
   const contentType=kind==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',fileHash=digest(bytes);
   const mapping={columns:{id:'id',text:'text',date:'date',role:'role',conversation:'conversation'},timezone:'UTC',dateFormat:'iso',...(kind==='xlsx'?{sheet:'SYN_DATA'}:{})};
   h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(connection)},${q(a.tenant)},'csv','SYN-file');INSERT INTO imports(id,tenant_id,connection_id,file_hash,mapping_version,idempotency_key,object_path,provenance) VALUES(${q(importId)},${q(a.tenant)},${q(connection)},${q(fileHash)},'csv-message-v1',${q(importId)},${q(objectPath)},${q(JSON.stringify({mapping}))}::jsonb);INSERT INTO import_uploads(tenant_id,import_id,user_id,size,content_type,request_hash) VALUES(${q(a.tenant)},${q(importId)},${q(a.id)},${bytes.length},${q(contentType)},'SYN-request')`);
   const url='http://127.0.0.1:59121/object/vexa-private/'+objectPath;
   const upload=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':contentType},body:bytes,signal:AbortSignal.timeout(10000)});assert.equal(upload.status,200,'REAL_STORAGE_UPLOAD:'+await upload.text());
   const foreign=await fetch(url,{headers:{Authorization:'Bearer '+other.token},signal:AbortSignal.timeout(10000)});assert.notEqual(foreign.status,200,'FOREIGN_ORIGINAL_STORAGE_READ');await foreign.arrayBuffer();
   h.sql(`UPDATE imports SET state='running' WHERE id=${q(importId)}`);
   const row=h.json(`SELECT to_jsonb(i)||jsonb_build_object('size',u.size,'content_type',u.content_type,'user_id',u.user_id,'source',c.source,'account_id',c.account_id) FROM imports i JOIN import_uploads u ON u.import_id=i.id JOIN connections c ON c.id=i.connection_id WHERE i.id=${q(importId)}`);
   const records=await recordsFromBytes(bytes,row);assert.equal(records.length,1);const database=h.database(a);
   await database.transaction('import',async scope=>{const r=await persistCanonical(scope,{importId,record:records[0]});assert.equal(r.status,'inserted','REAL_CANONICAL_FILE_PERSISTENCE');});
   let reads=0;const storage={async read(scope,source,{signal}){assert.equal(scope.tenantId,a.tenant);assert.equal(source.object_path,objectPath);reads++;const response=await fetch('http://127.0.0.1:59121/object/authenticated/vexa-private/'+source.object_path,{headers:{Authorization:'Bearer '+a.token},signal});assert.equal(response.status,200,'REAL_STORAGE_ORIGINAL_READ');return new Uint8Array(await response.arrayBuffer());}};
   const repository=createExtractionRepository({database,storage}),conversationId=h.sql(`SELECT id FROM conversations WHERE tenant_id=${q(a.tenant)}`),jobId=h.job(a),request={conversationId,jobId,taskKey:randomUUID(),taxonomy:['battery'],policy:{version:'SYN-file-v1',emails:true,phones:true,names:['Ana Pérez'],namesMode:'dictionary'}};
   const prepared=await repository.prepare(request);assert.equal(prepared.acquired,true);assert.equal(reads,1);assert.equal(prepared.input.revisions.length,1);assert.match(prepared.input.revisions[0].text,/batería rota/);assert.doesNotMatch(JSON.stringify(prepared.input),/Ana Pérez|ana@example.test/,'PRIVATE_PII_LEFT_SOURCE_BOUNDARY');
   const original=await fetch(url,{headers:{Authorization:'Bearer '+a.token},signal:AbortSignal.timeout(10000)});assert.equal(original.status,200);assert.equal(digest(new Uint8Array(await original.arrayBuffer())),fileHash,'REDACTION_OVERWROTE_ORIGINAL');
   const maps=h.sql(`SELECT count(*) FROM redaction_maps WHERE tenant_id=${q(a.tenant)}`),runs=h.sql(`SELECT count(*) FROM extraction_runs WHERE tenant_id=${q(a.tenant)}`);
   h.sql(`UPDATE imports SET file_hash=${q('f'.repeat(64))} WHERE id=${q(importId)}`);
   await assert.rejects(repository.prepare({...request,taskKey:randomUUID()}));assert.equal(h.sql(`SELECT count(*) FROM redaction_maps WHERE tenant_id=${q(a.tenant)}`),maps,'HASH_FAILURE_CREATED_PRIVATE_MAP');assert.equal(h.sql(`SELECT count(*) FROM extraction_runs WHERE tenant_id=${q(a.tenant)}`),runs,'HASH_FAILURE_CREATED_EXTRACTION');
  });
  h.verifySources();
 }finally{if(h)await h.close();console.log('F04_STORAGE_EVIDENCE:'+evidence);}
});
