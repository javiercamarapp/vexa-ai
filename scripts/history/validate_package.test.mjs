import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validatePackage} from './validate_package.mjs';
import {normalizeCSV,parseCSV} from '../../packages/ingestion/index.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
async function fixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'history464-SYN-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const csv='source,gorgias_ticket_id,hubspot_ticket_id,message_id,message_created_at,body_text,direction,author_role,is_automation,sku,order_id\n'+
 'hubspot,,SYN-T1,SYN-M1,2026-09-01T00:00:00.123Z,"SYNTHETIC first\nsecond",customer,customer,false,,\n'+
 'gorgias,SYN-T1,,SYN-M2,2026-09-01T00:00:00.123456Z,SYNTHETIC time,agent,agent,false,,\n';
 const input=path.join(root,'synthetic.csv');await writeFile(input,csv);
 const manifest=path.join(root,'input.json');await writeFile(manifest,JSON.stringify({sources:[{category:'conversations',source:input,sha256:createHash('sha256').update(csv).digest('hex'),bytes:Buffer.byteLength(csv),rows:2}]}));
 const output=path.join(root,'package');execFileSync('python3',[path.join(here,'prepare_history.py'),'--manifest',manifest,'--output',output],{stdio:'pipe'});return output;
}
test('SYNTHETIC package validates every candidate via untouched product normalizer and adapter',async t=>{
 const output=await fixture(t);const result=await validatePackage(output);assert.equal(result.total,2);assert.equal(result.candidate,1);assert.equal(result.review,1);
});
test('SYNTHETIC package refuses altered original even with unchanged projection',async t=>{
 const output=await fixture(t);const original=path.join(output,'originals/01.csv');execFileSync('chmod',['600',original]);await writeFile(original,'SYNTHETIC altered');await assert.rejects(()=>validatePackage(output),/PROVENANCE_RECONCILIATION_FAILED/);
});
test('SYNTHETIC package refuses changed projection before import',async t=>{
 const output=await fixture(t);const batch=path.join(output,'candidates/hubspot-0001.csv');await writeFile(batch,(await readFile(batch,'utf8')).replace('SYN-M1','SYN-M9'));await assert.rejects(()=>validatePackage(output),/PROVENANCE_RECONCILIATION_FAILED/);
});
test('unchanged product proves current long-message and microsecond blockers',()=>{
 const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'csv',source_account_id:'SYNTHETIC'};
 const csv='external_id,source_revision,occurred_at,text,role,conversation_id\n'+`SYN-1,,2026-09-01T00:00:00Z,${'x'.repeat(2001)},customer,SYN-T1\nSYN-2,,2026-09-01T00:00:00.123456Z,SYNTHETIC,customer,SYN-T2\n`;
 const r=normalizeCSV(csv,{context,observed_at:'2026-10-02T00:00:00Z',mappingVersion:'SYN'});assert.deepEqual(r.errors.map(e=>e.code),['CSV_LIMIT_MESSAGE','INVALID_TIMESTAMP']);assert.equal(r.records.length,0);
});
const digest=b=>createHash('sha256').update(b).digest('hex');
async function updateManifest(root,mutate){const p=path.join(root,'manifest.json'),m=JSON.parse(await readFile(p,'utf8'));await mutate(m);await writeFile(p,JSON.stringify(m));}
test('R468-03 rejects changed candidate body even when derived batch hash and bytes are recomputed',async t=>{
 const root=await fixture(t);await updateManifest(root,async m=>{const b=m.batches[0],p=path.join(root,b.path);const data=(await readFile(p,'utf8')).replace('SYNTHETIC first','SYNTHETIC forged');await writeFile(p,data);b.sha256=digest(data);b.bytes=Buffer.byteLength(data);});
 await assert.rejects(()=>validatePackage(root),/PROVENANCE_RECONCILIATION_FAILED/);
});
test('R468-03 rejects omitted review entry even with recalculated ledger hash and reduced summary',async t=>{
 const root=await fixture(t);await updateManifest(root,async m=>{const p=path.join(root,'rows.jsonl'),entries=(await readFile(p,'utf8')).trim().split('\n').map(JSON.parse),kept=entries.filter(r=>r.route==='candidate');const data=kept.map(JSON.stringify).join('\n')+'\n';await writeFile(p,data);m.rows_sha256=digest(data);m.summary.total--;m.summary.review--;delete m.summary.by_source.gorgias;delete m.summary.reasons.TIMESTAMP_PRECISION_CONTRACT;});
 await assert.rejects(()=>validatePackage(root),/PROVENANCE_RECONCILIATION_FAILED/);
});
test('R468-03 recalculates original row and body hashes, source, routes, and reasons',async t=>{
 for(const [field,value] of [['row_sha256','0'.repeat(64)],['body_sha256','0'.repeat(64)],['source','gorgias'],['route','review'],['reasons',['SYNTHETIC_FALSE_REASON']]]){
  await t.test(field,async child=>{const root=await fixture(child);await updateManifest(root,async m=>{const p=path.join(root,'rows.jsonl'),entries=(await readFile(p,'utf8')).trim().split('\n').map(JSON.parse);entries[0][field]=value;const data=entries.map(JSON.stringify).join('\n')+'\n';await writeFile(p,data);m.rows_sha256=digest(data);});await assert.rejects(()=>validatePackage(root),/PROVENANCE_RECONCILIATION_FAILED/);});
 }
});
test('R468-03 checks candidate logical and physical references against parsed batch',async t=>{
 for(const field of ['record_number','physical_line'])await t.test(field,async child=>{const root=await fixture(child);await updateManifest(root,async m=>{const p=path.join(root,'rows.jsonl'),entries=(await readFile(p,'utf8')).trim().split('\n').map(JSON.parse);entries[0].candidate[field]++;const data=entries.map(JSON.stringify).join('\n')+'\n';await writeFile(p,data);m.rows_sha256=digest(data);});await assert.rejects(()=>validatePackage(root),/PROVENANCE_RECONCILIATION_FAILED/);});
});

test('R468-03 compares every projected field with its original transformation',async t=>{
 const fields=['external_id','source_revision','occurred_at','text','role','conversation_id','sku','order_id','origin_source','origin_file_sha256','origin_record_number','origin_row_sha256','origin_timestamp','origin_direction','origin_author_role','origin_is_automation'];
 for(const field of fields)await t.test(field,async child=>{
  const root=await fixture(child);await updateManifest(root,async m=>{
   const batch=m.batches[0],p=path.join(root,batch.path),parsed=parseCSV(await readFile(p));
   const table=parsed.rows.map(row=>row.values),column=table[0].indexOf(field);table[1][column]='SYNTHETIC_MUTATION';
   const data=table.map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
   await writeFile(p,data);batch.sha256=digest(data);batch.bytes=Buffer.byteLength(data);
  });await assert.rejects(()=>validatePackage(root),/PROVENANCE_RECONCILIATION_FAILED/);
 });
});
