import test from 'node:test';
import assert from 'node:assert/strict';
import {root,read,checkSource,checkReadiness,checkEnvironments,checkFixture,checkRegister} from './foundation.mjs';
test('source checksum tampering is rejected',()=>{
 const s=read('docs/blueprint/source-review.json',root);s.sources[0].sha256='0'.repeat(64);
 assert.throws(()=>checkSource(s,read('tests/fixtures/source-manifest.json',root)),{code:'ERR_ASSERTION'});
});
test('invented human transcription certification is rejected',()=>{
 const s=read('docs/blueprint/source-review.json',root);s.human_verbatim_review=true;
 assert.throws(()=>checkSource(s,read('tests/fixtures/source-manifest.json',root)),{code:'ERR_ASSERTION'});
});
test('synthetic readiness cannot authorize real customer data',()=>{
 const s=read('docs/blueprint/pilot-readiness.json',root);s.customer_data_allowed=true;
 assert.throws(()=>checkReadiness(s),{code:'ERR_ASSERTION'});
});
test('unprovisioned production cannot be presented as provisioned',()=>{
 const s=read('docs/blueprint/environments.json',root);s.prod.project_ref='borrowed-from-other-project';
 assert.throws(()=>checkEnvironments(s),{code:'ERR_ASSERTION'});
});
test('fixture financial error rejects, not just JSON shape',async()=>{
 const f=read('tests/fixtures/syn-e2e-v1.json',root);f.orders[0].amountMinor='10001';
 await assert.rejects(checkFixture(f,root),{code:'ERR_ASSERTION'});
});
test('null customer fixture cannot quietly become known zero',async()=>{
 const f=read('tests/fixtures/syn-e2e-v1.json',root);f.orders[2].amountMinor='0';
 await assert.rejects(checkFixture(f,root),{code:'ERR_ASSERTION'});
});
test('gate register cannot claim a product PASS',()=>{
 const s=read('docs/blueprint/gate-register.json',root);s.tasks[0].product_pass=true;
 assert.throws(()=>checkRegister(s),{code:'ERR_ASSERTION'});
});
