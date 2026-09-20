import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, normalizeCSV, createEnvelope, identityKey, revisionKey, RevisionLedger } from './index.mjs';
// SYNTHETIC CONTRACT FIXTURES ONLY. No customer/provider data.
const context = { tenant_id: '11111111-1111-4111-8111-111111111111', connection_id: '22222222-2222-4222-8222-222222222222', source: 'csv', source_account_id: 'SYN-account' };
const date = '2026-09-01T12:00:00Z';
const opts = { context, observed_at: date, mappingVersion: 'syn-v1' };
const header = 'external_id,source_revision,occurred_at,text,role,customer_id,sku\n';
const record = { entity_type: 'message', external_id: 'SYN-1', source_revision: 'v1', occurred_at: date, observed_at: date, payload_ref: 'fixture:SYN-1' };
test('CSV BOM, quotes, escaped quotes and multiline with physical row references', () => {
 const result = parseCSV('\uFEFFid,text\r\n1,"a,b\r\nc"\r\n2,"say ""hi"""\r\n');
 assert.deepEqual(result.rows.map(x=>x.values), [['id','text'],['1','a,b\nc'],['2','say "hi"']]);
 assert.deepEqual(result.rows.map(x=>x.line), [1,2,4]);
});
test('CSV syntax, encoding and limits reject explicitly', () => {
 assert.equal(parseCSV('id,text\n1,a"bad\n2,good').errors[0].code, 'CSV_SYNTAX');
 assert.equal(parseCSV('id,text\n1,"never closes').errors[0].line, 2);
 for (const [input, limits] of [['12345',{maxBytes:4}],['a,b',{maxColumns:1}],['abcdef',{maxFieldChars:3}],['a\nb',{maxRows:1}]]) assert.throws(()=>parseCSV(input,limits), /LIMIT/);
 assert.throws(()=>parseCSV(Buffer.from([0xff])), /ENCODING/);
});
test('normalization reports invalid rows; unknown identifiers remain null; markup/formulas inert', () => {
 const result = normalizeCSV(header+'SYN-1,v1,2026-09-01T14:00:00+02:00,"<img onerror=evil()> =1+2",internal,,\nSYN-2,v1,bad,text,customer,,\n',opts);
 assert.equal(result.records.length,1); assert.equal(result.errors.length,1);
 const r = result.records[0];
 assert.equal(r.envelope.occurred_at, date.replace('Z','.000Z'));
 assert.equal(r.message.customer_id,null); assert.equal(r.message.sku,null);
 assert.equal(r.message.role,'internal'); assert.equal(r.message.text,'<img onerror=evil()> =1+2');
 assert.equal(result.errors[0].line,3);
 assert.equal(r.envelope.tenant_id,context.tenant_id);
});
test('timestamps reject impossible calendar days, ambiguous times and missing identity columns', () => {
 for(const time of ['2026-02-30T12:00:00Z','2026-09-01T12:00:00','2026-09-01T25:00:00Z']) assert.equal(normalizeCSV(header+`SYN-1,v1,${time},x,customer,,`,opts).errors.length,1);
 assert.throws(()=>normalizeCSV('text\na',opts), /CSV_HEADER/);
 assert.throws(()=>normalizeCSV('text,text\na,b',opts), /CSV_HEADER/);
});
test('hash stable across property order, revision excludes observation time, tenant/account/source isolate identity', () => {
 const a=createEnvelope(context,record,{text:'x',id:1});
 const b=createEnvelope(context,{...record,observed_at:'2026-09-02T00:00:00Z'},{id:1,text:'x'});
 assert.match(a.content_hash,/^[a-f0-9]{64}$/); assert.equal(a.content_hash,b.content_hash); assert.equal(revisionKey(a),revisionKey(b));
 for(const delta of [{tenant_id:'33333333-3333-4333-8333-333333333333'},{source_account_id:'other'},{source:'hubspot'},{connection_id:'44444444-4444-4444-8444-444444444444'}]) assert.notEqual(identityKey(a),identityKey(createEnvelope({...context,...delta},record,{text:'x'})));
});
test('repeat revision is duplicate, edits are history of one entity, collision rejected, same text never merges', () => {
 const ledger=new RevisionLedger(); const a=createEnvelope(context,record,{text:'x'});
 assert.equal(ledger.apply(a).status,'inserted'); assert.equal(ledger.apply(a).status,'duplicate');
 const b=createEnvelope(context,{...record,source_revision:'v2'},{text:'edit'});
 assert.equal(ledger.apply(b).status,'revision'); assert.equal(ledger.size,1);
 assert.throws(()=>ledger.apply(createEnvelope(context,record,{text:'different'})),/REVISION_CONFLICT/);
 ledger.apply(createEnvelope(context,{...record,external_id:'SYN-2'},{text:'x'})); assert.equal(ledger.size,2);
 assert.equal(ledger.history(a).length,2);
});
test('CSV stable fallback identity is file and mapping scoped; revisions deduplicate independently of row order with explicit ID', () => {
 const csv=header+',,2026-09-01T12:00:00Z,same,unknown,,\n,,2026-09-01T12:00:00Z,same,unknown,,';
 const a=normalizeCSV(csv,opts), b=normalizeCSV(csv,opts);
 assert.equal(a.records.length,2); assert.notEqual(identityKey(a.records[0].envelope),identityKey(a.records[1].envelope));
 assert.equal(revisionKey(a.records[0].envelope),revisionKey(b.records[0].envelope));
 assert.notEqual(identityKey(a.records[0].envelope),identityKey(normalizeCSV(csv,{...opts,mappingVersion:'v2'}).records[0].envelope));
});

test('explicit approved aliases link identities within one tenant only, never text or email', async () => {
 const { ExplicitAliases }=await import('./index.mjs');const aliases=new ExplicitAliases();
 const a=createEnvelope(context,record,{text:'same',email:'same@invalid.test'});
 const b=createEnvelope({...context,source:'zendesk',source_account_id:'SYN-zendesk'},record,{text:'same',email:'same@invalid.test'});
 assert.notEqual(aliases.resolve(a),aliases.resolve(b));
 const approval={tenant_id:context.tenant_id,canonical_id:'55555555-5555-4555-8555-555555555555',evidence_ref:'fixture:SYN-migration-map',approved_by:'fixture:SYN-reviewer',version:'1'};
 aliases.approve([a,b],approval);assert.equal(aliases.resolve(a),aliases.resolve(b));
 const foreign=createEnvelope({...context,tenant_id:'33333333-3333-4333-8333-333333333333'},record,{text:'same'});
 assert.throws(()=>aliases.approve([a,foreign],approval),/ALIAS_TENANT/);
 assert.notEqual(aliases.resolve(foreign),aliases.resolve(a));
 assert.throws(()=>new ExplicitAliases().approve([a,b],{...approval,evidence_ref:''}),/INVALID_STRING/);
 assert.throws(()=>aliases.approve([a],{...approval,canonical_id:'66666666-6666-4666-8666-666666666666'}),/ALIAS_CONFLICT/);
});
test('CSV rejects bad columns without dropping later records; row tenant never overrides server context',()=>{
 const csv=header.trim()+',tenant_id\nSYN-1,v1,2026-09-01T12:00:00Z,x,customer,,,attacker\nbad,columns\nSYN-2,v1,2026-09-01T12:00:00Z,x,agent,,,attacker';
 const r=normalizeCSV(csv,opts);assert.equal(r.records.length,2);assert.equal(r.errors.length,1);assert.equal(r.errors[0].code,'CSV_COLUMN_COUNT');
 assert.ok(r.records.every(x=>x.envelope.tenant_id===context.tenant_id));
});
