import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {normalizeCSV,adaptCSVRaw,contentHash,RevisionLedger} from './index.mjs';
import {historicalTimestamp,HISTORY_PROFILE} from './history-profile.mjs';
import {previewImport,mappingVersion,canonicalMapping} from './mapping.mjs';
import {recordsFromBytes} from '../jobs/durable/records.mjs';
import {persistCanonical} from './persistence/index.mjs';
import {createExtractionSourceReader} from '../intelligence/source-reader.mjs';
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'csv',source_account_id:'SYNTHETIC'};
const baseMapping={columns:{id:'external_id',text:'text',date:'occurred_at',role:'role',conversation:'conversation_id'},timezone:'UTC',dateFormat:'iso'};
const mapping={...baseMapping,profile:HISTORY_PROFILE},observed='2026-10-02T00:00:00Z',importId='33333333-3333-4333-8333-333333333333';
const csv=rows=>Buffer.from(['external_id,source_revision,occurred_at,text,role,conversation_id',...rows.map(r=>[r.id??'SYN-M1',r.revision??'',r.date??'2026-09-01T00:00:00.123456Z',r.text??'SYNTHETIC',r.role??'customer',r.conversation??'SYN-T1'].map(v=>'"'+v.replaceAll('"','""')+'"').join(','))].join('\n')+'\n');
const row=(bytes,m=mapping)=>({...context,account_id:context.source_account_id,file_hash:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,content_type:'text/csv',provenance:{mapping:m},mapping_version:mappingVersion(m),created_at:observed});
const normalized=(bytes,m=mapping)=>normalizeCSV(bytes,{context,observed_at:observed,mappingVersion:mappingVersion(m),...(m.profile?{profile:m.profile}:{})});
const preview=(bytes,m=mapping)=>previewImport(bytes,{contentType:'text/csv',mapping:m,context,observedAt:observed});

test('opt-in enables long text and microseconds; all entry points retain exact text and metadata',async()=>{
 const bytes=csv([{text:'SYNTHETIC '+ 'x'.repeat(3000),revision:'SYN-R1'},{id:'SYN-M2',date:'2026-09-01T00:00:00.123999Z'}]);
 assert.equal(preview(bytes).coverage.accepted,2);const a=normalized(bytes),b=await recordsFromBytes(bytes,row(bytes));assert.equal(a.errors.length,0);assert.equal(b.length,2);
 const ledger=new RevisionLedger();
 for(let i=0;i<2;i++){
  assert.equal(b[i].validation_error,undefined);const am=adaptCSVRaw(a.records[i].envelope,a.records[i].raw_payload),bm=adaptCSVRaw(b[i].envelope,b[i].raw_payload);
  assert.deepEqual(am,bm);assert.deepEqual(a.records[i].message,am);assert.equal(b[i].envelope.ingestion_profile,HISTORY_PROFILE);assert.equal(b[i].raw_payload.source_occurred_at,bm.historical_timestamp.original);
  assert.equal(ledger.apply(b[i].envelope).status,'inserted');
 }
 assert.equal(a.records[0].envelope.source_revision,'SYN-R1');assert.equal(b[0].envelope.occurred_at,b[1].envelope.occurred_at);assert.notEqual(b[0].raw_payload.historical_timestamp.epoch_microseconds,b[1].raw_payload.historical_timestamp.epoch_microseconds);
 assert.equal(preview(bytes,baseMapping).coverage.rejected,2);assert.equal(normalized(bytes,baseMapping).errors.length,2);assert.ok((await recordsFromBytes(bytes,row(bytes,baseMapping))).every(r=>r.validation_error));
});
test('default mapping hash and normalizer are byte-compatible with frozen469',async()=>{
 const bytes=csv([{date:'2026-01-01T00:00:00Z'}]);assert.equal(mappingVersion(baseMapping),'mapping-v1:e39427b574978b2d333a3d4588f19a2be2420560bbbdbd74f7c9ad277ca92469');assert.notEqual(mappingVersion(mapping),mappingVersion(baseMapping));
 assert.equal(contentHash(normalized(bytes,baseMapping)),'0503bafd1077107c7974a6500acd2541e27164a1cc350d1aebaa8f7102ea139e');assert.equal(Object.hasOwn(canonicalMapping(baseMapping),'profile'),false);
});
test('strict microsecond metadata supports offsets, precision1..6, same-ms order and pre1970 floor',()=>{
 for(let n=1;n<=6;n++){const fraction='123456'.slice(0,n),t=historicalTimestamp(`2024-02-29T12:00:00.${fraction}Z`);assert.equal(t.precision_digits,n);assert.equal(t.epoch_microseconds,(BigInt(Date.parse('2024-02-29T12:00:00Z'))*1000n+BigInt(fraction.padEnd(6,'0'))).toString());}
 assert.equal(historicalTimestamp('2024-02-29T13:00:00.123456+01:00').epoch_microseconds,historicalTimestamp('2024-02-29T12:00:00.123456Z').epoch_microseconds);
 const before=historicalTimestamp('1969-12-31T23:59:59.999999Z');assert.equal(before.canonical,'1969-12-31T23:59:59.999Z');assert.equal(before.epoch_microseconds,'-1');assert.equal(before.remainder_microseconds,999);
 for(const bad of ['2023-02-29T00:00:00Z','2026-01-01T00:00:00.1234567Z','2026-01-01T00:00:00+00:99','2026-01-01T00:00:00+24:00','2026-01-01'])assert.throws(()=>historicalTimestamp(bad));
});
test('UTF16 raw and NFC caps align; no split or fallback ID',async()=>{
 for(const text of ['x'.repeat(100000),'😀'.repeat(50000)]){const bytes=csv([{text}]);assert.equal(preview(bytes).coverage.accepted,1);assert.equal(normalized(bytes).records[0].message.text,text);assert.equal((await recordsFromBytes(bytes,row(bytes)))[0].raw_payload.text,text);}
 for(const text of ['😀'.repeat(50001),'\u0344'.repeat(50001)]){const bytes=csv([{text}]);assert.equal(preview(bytes).errors[0].code,'BODY_ANALYSIS_LIMIT');assert.equal(normalized(bytes).errors[0].code,'BODY_ANALYSIS_LIMIT');assert.equal((await recordsFromBytes(bytes,row(bytes)))[0].validation_error,'BODY_ANALYSIS_LIMIT');}
 const noId=csv([{id:''}]);assert.equal(normalized(noId).records.length,0);assert.equal(preview(noId).coverage.accepted,0);assert.ok((await recordsFromBytes(noId,row(noId)))[0].validation_error);
});
test('unknown profile and metadata-only/envelope-only/tampered precision reject',()=>{
 assert.throws(()=>canonicalMapping({...mapping,profile:'SYN-UNKNOWN'}),{code:'INVALID_INGESTION_PROFILE'});
 const r=normalized(csv([{}])).records[0];
 const noEnvelope={...r.envelope};delete noEnvelope.ingestion_profile;assert.throws(()=>adaptCSVRaw(noEnvelope,r.raw_payload),{code:'INGESTION_PROFILE_MISMATCH'});
 const noRaw={...r.raw_payload};delete noRaw.historical_timestamp;assert.throws(()=>adaptCSVRaw({...r.envelope,content_hash:contentHash(noRaw)},noRaw),{code:'INGESTION_PROFILE_MISMATCH'});
 for(const change of [{epoch_microseconds:'1'},{remainder_microseconds:455},{original:'2026-09-01T00:00:00.123999Z'},{normalization:'round'}]){
  const raw={...r.raw_payload,historical_timestamp:{...r.raw_payload.historical_timestamp,...change}};assert.throws(()=>adaptCSVRaw({...r.envelope,content_hash:contentHash(raw)},raw),{code:'HISTORICAL_TIMESTAMP_MISMATCH'});
 }
});
test('source reader replays same profile and returns full original text with hash checked',async()=>{
 const bytes=csv([{text:'SYNTHETIC '+ 'x'.repeat(3000)}]),imported={...row(bytes),id:importId,user_id:'SYN-USER',object_path:`${context.tenant_id}/imports/${importId}/SYN.csv`},[r]=await recordsFromBytes(bytes,imported);
 const scope={tenantId:context.tenant_id,userId:'SYN-USER',query:async()=>({rows:[{...imported,row_ref:String(r.row_ref)}]})};let reads=0;
 const reader=createExtractionSourceReader({storage:{read:async()=>{reads++;return bytes;}}});const value=await reader(scope,{text_ref:'SYN-REF',hash:r.envelope.content_hash,role:'customer'});assert.equal(value,r.raw_payload.text);assert.equal(reads,1);
 await assert.rejects(()=>reader(scope,{text_ref:'SYN-REF',hash:'0'.repeat(64),role:'customer'}));
});
function fakeScope(imported){const writes=[];const query=async(sql,args=[])=>{
 // Record both DML statements while retaining their original parameter bindings.
 const grouped=/^WITH (?:revision_write|head_write|import_row_write) AS \((INSERT.*?)\) ((?:INSERT|UPDATE).*)$/.exec(sql);
 if(grouped){await query(grouped[1],args);return query(grouped[2],args);}
 if(sql.startsWith('WITH retention AS MATERIALIZED'))return {rows:[{deleted:false,previous:null}]};
 if(sql.startsWith('SELECT i.*,c.source'))return {rows:[{...imported,state:'running',connection_status:'active',connection_id:context.connection_id,source:'csv',account_id:'SYNTHETIC'}]};
 if(sql.includes('vexa_backend_action'))return {rows:[{ok:true}]};
 if(sql.startsWith('SELECT DISTINCT canonical_id'))return {rows:[{canonical_id:'44444444-4444-4444-8444-444444444444'}]};
 if(sql.includes('retention_source_deleted'))return {rows:[{deleted:false}]};
 if(sql.startsWith('INSERT INTO public.')){
  const parameters=/VALUES\s*\(([^)]+)\)/.exec(sql);assert.ok(parameters,'recorded INSERT must expose bindings');
  writes.push({sql,args:parameters[1].split(',').map(p=>args[Number(p.slice(1))-1])});
 }
 return {rows:[]};
 };return {tenantId:context.tenant_id,userId:'SYN-USER',writes,query};}
test('persistence reconstructs envelope/profile and records timestamp provenance; unauthorized mapping rejects',async()=>{
 const bytes=csv([{}]),imported=row(bytes),[record]=await recordsFromBytes(bytes,imported);const scope=fakeScope(imported);
 const result=await persistCanonical(scope,{importId,record});assert.equal(result.status,'inserted');
 const revisions=scope.writes.filter(w=>w.sql.startsWith('INSERT INTO public.source_revisions'));
 assert.equal(revisions.length,2);const message=revisions.find(w=>w.args.includes('message'));const provenance=message.args.map(x=>{try{return JSON.parse(x);}catch{return null;}}).find(x=>x?.ingestion_profile);assert.equal(provenance.ingestion_profile,HISTORY_PROFILE);assert.equal(provenance.historical_timestamp.original,'2026-09-01T00:00:00.123456Z');
 const mismatch=await persistCanonical(fakeScope({...imported,provenance:{mapping:baseMapping}}),{importId,record});assert.equal(mismatch.code,'INGESTION_PROFILE_MISMATCH');
});
test('canonical timestamp range cannot pass preview then fail envelope; mapping tamper is rejected',async()=>{
 for(const date of ['1000-01-01T00:00:00.123456+01:00','9999-12-31T23:59:59.123456-01:00']){const bytes=csv([{date}]);assert.equal(preview(bytes).coverage.rejected,1);assert.equal(normalized(bytes).records.length,0);assert.ok((await recordsFromBytes(bytes,row(bytes)))[0].validation_error);}
 const bytes=csv([{}]),imported=row(bytes),[record]=await recordsFromBytes(bytes,imported),tampered={...imported,provenance:{mapping:{...mapping,columns:{...mapping.columns,date:'source_revision'}}}};
 await assert.rejects(()=>recordsFromBytes(bytes,tampered),e=>e.code==='MAPPING_VERSION_MISMATCH');assert.equal((await persistCanonical(fakeScope(tampered),{importId,record})).code,'MAPPING_VERSION_MISMATCH');
});
test('opt-in preserves hard CSV batch bounds and rejects profile limit overrides',async()=>{
 const tooBig=Buffer.alloc(20*1024*1024+1,32);assert.throws(()=>preview(tooBig),{code:'CSV_LIMIT_BYTES'});assert.throws(()=>normalized(tooBig),{code:'CSV_LIMIT_BYTES'});await assert.rejects(()=>recordsFromBytes(tooBig,row(tooBig)),{code:'CSV_LIMIT_BYTES'});
 const bytes=csv([{}]);assert.throws(()=>normalizeCSV(bytes,{context,observed_at:observed,mappingVersion:mappingVersion(mapping),profile:HISTORY_PROFILE,limits:{maxRows:50001}}),{code:'INVALID_LIMIT'});
 const tooMany=csv(Array.from({length:50001},(_,i)=>({id:`SYN-${i}`,text:'SYN',date:'2026-01-01T00:00:00Z'})));assert.throws(()=>preview(tooMany),{code:'CSV_LIMIT_ROWS'});assert.throws(()=>normalized(tooMany),{code:'CSV_LIMIT_ROWS'});await assert.rejects(()=>recordsFromBytes(tooMany,row(tooMany)),{code:'CSV_LIMIT_ROWS'});
});
