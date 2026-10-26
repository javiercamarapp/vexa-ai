import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildScopes, parseProbeOutput} from './lib.mjs';
// Catalog metadata only, observed 26-Oct: 153 tables; FKs retained only for tables without tenant_id.
const catalog=JSON.parse(fs.readFileSync(new URL('./catalog-20261026.fixture.json',import.meta.url),'utf8'));
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
test('current catalog preserves every tenant table and scopes receipts via their messages',()=>{
 const scopes=buildScopes(catalog.tables,catalog.fks,A);
 assert.equal(catalog.tables.length,153);
 assert.equal(scopes.size,151);
 assert.deepEqual(catalog.tables.filter(t=>!scopes.has(t.name)).map(t=>t.name),['vexa_platform.administrators','vexa_platform.settings']);
 for(const t of catalog.tables.filter(t=>t.hasTenant))assert.ok(scopes.has(t.name),`${t.name} cannot disappear`);
 assert.match(scopes.get('public.notification_email_receipts'),/notification_email_messages/);
 assert.ok(scopes.get('public.notification_email_receipts').includes(A));
 assert.ok(!scopes.get('public.notification_email_receipts').includes(B));
});
test('unknown global tables remain fail-closed',()=>{
 assert.throws(()=>buildScopes([...catalog.tables,{name:'vexa_platform.unknown_global',hasTenant:false}],catalog.fks,A),/unknown_global/);
});
test('global allowlist cannot silently discard a table that acquired tenant scope',()=>{
 for(const name of ['vexa_platform.settings','vexa_platform.administrators']){
  const tables=catalog.tables.map(t=>t.name===name?{...t,hasTenant:true}:t);
  assert.throws(()=>buildScopes(tables,catalog.fks,A),/global.*tenant/i);
 }
});

test('a failed granted SELECT cannot masquerade as an empty RLS result',()=>{
 assert.throws(()=>parseProbeOutput('public.memberships|1\n',['public.memberships','public.messages']),/public.messages/);
 assert.equal(parseProbeOutput('public.messages|0\n',['public.messages']).get('public.messages'),0);
 assert.equal(parseProbeOutput('',[]).size,0,'absence allowed when role has no SELECT grant');
});
