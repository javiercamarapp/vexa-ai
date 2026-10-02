import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeCSV,adaptCSVRaw,contentHash} from '../../packages/ingestion/index.mjs';
import {previewImport,mappingVersion} from '../../packages/ingestion/mapping.mjs';
import {recordsFromBytes} from '../../packages/jobs/durable/records.mjs';
const mapping={columns:{id:'external_id',text:'text',date:'occurred_at',role:'role',conversation:'conversation_id',sku:'sku',order:'order_id'},timezone:'UTC',dateFormat:'iso'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const ensure=(ok,code)=>{if(!ok)throw new Error(code);};
export async function validatePackage(root){
 const manifestBytes=await readFile(path.join(root,'manifest.json'));
 const manifest=JSON.parse(manifestBytes);
 const proof=spawnSync('python3',[fileURLToPath(new URL('./validate_provenance.py',import.meta.url)),root],{input:manifestBytes,encoding:'utf8',maxBuffer:1024*1024});
 ensure(proof.status===0,'PROVENANCE_RECONCILIATION_FAILED');
 const provenance=JSON.parse(proof.stdout);
 ensure(provenance.status==='original-population-and-projection-reconciled','PROVENANCE_RECONCILIATION_FAILED');
 const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'csv',source_account_id:'SYNTHETIC-COMPATIBILITY-ONLY'};
 let records=0;const groups={};const ledger=await readFile(path.join(root,'rows.jsonl'));ensure(hash(ledger)===manifest.rows_sha256,'LEDGER_HASH');
 let total=0,candidates=0,review=0;const refs=new Map();
 for(const line of ledger.toString('utf8').trimEnd().split('\n')){
  const row=JSON.parse(line);total++;
  if(row.route==='candidate') {candidates++;const k=`${row.candidate.path}:${row.candidate.physical_line}`;ensure(!refs.has(k),'REPEATED_PROJECTION_REF');refs.set(k,row);}
  else {ensure(row.route==='review'&&row.reasons.length>0,'ROUTE');review++;}
 }
 for(const original of manifest.originals) ensure(hash(await readFile(path.join(root,original.path)))===original.sha256,'ORIGINAL_HASH');
 const identities=new Set();const batches=[];
 for(const batch of manifest.batches){
  const bytes=await readFile(path.join(root,batch.path));ensure(hash(bytes)===batch.sha256&&bytes.length===batch.bytes,'BATCH_HASH');
  const preview=previewImport(bytes,{contentType:'text/csv',mapping,context,observedAt:'2026-10-02T00:00:00Z'});
  ensure(preview.coverage.rejected===0&&preview.coverage.accepted===batch.rows,'PREVIEW_REJECTED');
  const runtimeRecords=await recordsFromBytes(bytes,{size:bytes.length,file_hash:batch.sha256,content_type:'text/csv',provenance:{mapping},...context,account_id:context.source_account_id,created_at:'2026-10-02T00:00:00Z',mapping_version:mappingVersion(mapping)});
  ensure(runtimeRecords.length===batch.rows,'RUNTIME_COUNT');
  for(const record of runtimeRecords){ensure(!record.validation_error,'RUNTIME_REJECTED');adaptCSVRaw(record.envelope,record.raw_payload);}
  const result=normalizeCSV(bytes,{context,observed_at:'2026-10-02T00:00:00Z',mappingVersion:manifest.version});
  ensure(result.errors.length===0&&result.records.length===batch.rows,'NORMALIZE_REJECTED');
  for(const r of result.records){
   ensure(r.envelope.external_id===r.raw_payload.external_id&&r.envelope.external_id.length>0,'IDENTITY_FALLBACK');
   ensure(!Object.hasOwn(r,'money')&&!Object.hasOwn(r.raw_payload,'amount')&&!Object.hasOwn(r.raw_payload,'currency'),'FINANCIAL_PROJECTION');
   ensure(r.raw_payload.origin_source===batch.source,'SOURCE_SCOPE');
   const key=JSON.stringify([batch.source,r.envelope.external_id]);ensure(!identities.has(key),'REPEATED_IDENTITY');identities.add(key);
   const refKey=`${batch.path}:${r.row_ref}`, ref=refs.get(refKey);ensure(ref,'PROJECTION_REF');
   ensure(ref.row_sha256===r.raw_payload.origin_row_sha256&&ref.file_sha256===r.raw_payload.origin_file_sha256&&String(ref.record_number)===r.raw_payload.origin_record_number,'ORIGINAL_REF');refs.delete(refKey);
   ensure(r.raw_payload.origin_timestamp===r.raw_payload.occurred_at,'TIME_ALTERED');
   ensure(r.envelope.content_hash===contentHash(r.raw_payload),'RAW_HASH');
   const adapted=adaptCSVRaw(r.envelope,r.raw_payload);ensure(JSON.stringify(adapted)===JSON.stringify(r.message),'ADAPTER_MISMATCH');
   records++;groups[batch.source]=(groups[batch.source]??0)+1;
  }
  batches.push({path:batch.path,rows:batch.rows,bytes:batch.bytes,sha256:batch.sha256});
 }
 ensure(refs.size===0&&total===manifest.summary.total&&candidates===manifest.summary.candidate&&review===manifest.summary.review&&records===candidates,'ACCOUNTING');
 return {status:'current-preview-durable-parser-and-adapter-compatible',total,candidate:records,review,by_source:groups,batches,provenance,limits:'Default product limits unchanged',mapping,scope:'No upload, database, runtime import, AI or acceptance; synthetic context only'};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try {const result=await validatePackage(process.argv[2]);if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,batches:result.batches.length}));}
 catch{console.error(JSON.stringify({status:'failed',code:'PACKAGE_VALIDATION_FAILED'}));process.exitCode=1;}
}
