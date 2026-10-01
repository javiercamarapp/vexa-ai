import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
// An independent control-plane review chooses individual historical assertions, never an aggregate FAIL→PASS rewrite.
// This supplements executable causal tests; it is not a substitute for them.
export function validateInheritance({candidate,root,ledger,bindings}){
 assert.ok(Array.isArray(ledger)&&ledger.length>=32,'ROUTE_LEDGER_INCOMPLETE');
 assert.equal(new Set(ledger.map(x=>x.route)).size,ledger.length,'DUPLICATE_ROUTE');
 for(const required of ['/overview','/problems','/problems/[id]','/customers/[id]','/recommendations','/explorer','/interventions','/briefs/[id]','/login','/notifications','/settings/notifications'])assert.ok(ledger.some(r=>r.route===required&&r.requiredByF0607===true),'MANDATORY_ROUTE_MISSING:'+required);
 for(const row of ledger.filter(r=>r.requiredByF0607))for(const state of ['loading','error','empty','partial','stale','ready']){
  const item=row.states[state];assert.ok(item,'STATE_OMITTED:'+row.route+':'+state);
  if(item.resolution==='not_applicable'){assert.ok(item.reason&&item.contractSource,'APPLICABILITY_NEEDS_CONTRACT');continue;}
  if(item.resolution==='current_run'){assert.ok(item.scenario,'CURRENT_STATE_NEEDS_SCENARIO');continue;}
  assert.equal(item.resolution,'inherited','UNADJUDICATED_STATE:'+row.route+':'+state);
  assert.ok(item.assertion&&item.receiptPath&&item.reviewer,'INHERITED_ASSERTION_NEEDS_INDEPENDENT_ADJUDICATION');
  const hash=bindings.files[item.receiptPath];assert.ok(hash,'UNPINNED_STATE_RECEIPT');assert.equal(sha(fs.readFileSync(path.join(root,item.receiptPath))),hash,'STATE_RECEIPT_CHANGED');
  assert.ok(row.sources.length,'INHERITED_SOURCE_BINDING_MISSING');
  for(const source of row.sources)assert.equal(sha(fs.readFileSync(path.join(candidate,source.path))),source.sha256,'INHERITED_SOURCE_CHANGED:'+source.path);
 }
}
