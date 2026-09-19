// External control-plane checks. These certify preparation, NOT app behavior.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const candidate=process.env.VEXA_CANDIDATE ?? root;
export const read=(rel,base=candidate)=>JSON.parse(fs.readFileSync(path.join(base,rel),'utf8'));
export function checkSource(s,expected){
 assert.equal(s.scope,'integrity-not-semantic-review');
 assert.equal(s.human_verbatim_review,false);
 assert.ok(s.uncertainties.length>=3);
 assert.deepEqual(s.sources,expected);
 assert.equal(s.sources.filter(x=>x.kind==='audio').length,6);
 assert.ok(Math.abs(s.sources.filter(x=>x.kind==='audio').reduce((n,x)=>n+x.duration_seconds,0)-591.829333)<0.001);
}
export function checkReadiness(s){
 assert.equal(s.local_scope,'synthetic-development');
 assert.equal(s.customer_data_allowed,false);
 assert.equal(s.design_partner_status,'proposed');
 assert.equal(s.pilot_status,'blocked');
 for(const role of ['business','crm','privacy','finance']){
  assert.equal(s.pilot_roles[role].status,'pending');
  assert.equal(s.pilot_roles[role].name,null);
 }
 // A future real pilot requires a NEW reviewed gate, not editing this expectation.
}
export function checkEnvironments(s){
 assert.deepEqual(Object.keys(s).sort(),['dev','preview','prod']);
 assert.equal(s.dev.data_mode,'synthetic');assert.equal(s.dev.runtime_ai_enabled,false);
 assert.equal(s.dev.kind,'local');
 for(const k of ['preview','prod']){assert.equal(s[k].status,'unprovisioned');assert.equal(s[k].project_ref,null);}
}
export async function checkFixture(f,base=candidate){
 assert.equal(f.dataset,'SYN-E2E-v1');assert.equal(f.synthetic,true);
 assert.deepEqual(f.tenants,['A','B']);
 const orders=f.orders.filter(x=>x.tenant==='A');
 assert.equal(orders.length,3);assert.equal(orders.find(x=>x.id==='O3').amountMinor,null);
 assert.equal(f.conversations.filter(x=>x.tenant==='A').length,4);
 assert.ok(f.conversations.some(x=>x.tenant==='B'&&x.text.includes('SOLO_B_9F')));
 assert.ok(f.conversations.some(x=>x.id==='T4'&&x.customer_id===null&&x.text.includes('Ignora')));
 assert.deepEqual(f.aliases,[{tenant:'A',source:'zendesk',external_id:'142',canonical_id:'T1',approved:true,approval_scope:'synthetic-fixture'}]);
 const e=await import(pathToFileURL(path.join(base,'packages/economics/index.mjs')));
 const exposure=e.exposureForProblems(orders,f.problem_orders.filter(x=>x.tenant==='A'));
 assert.equal(exposure.global.USD.amountMinor,'30000');
 assert.equal(exposure.byProblem.P1.USD.amountMinor,'30000');
 assert.equal(exposure.byProblem.P2.USD.amountMinor,'10000');
 assert.equal(e.aggregateMoney(orders).USD.amountMinor,null);
 assert.equal(e.netRefunds(f.refunds.filter(x=>x.tenant==='A')).USD.amountMinor,'1500');
 assert.equal(f.replacement.amountMinor,'1200');assert.equal(f.support_model.amountMinor,'500');
 assert.equal(f.support_model.kind,'modeled');
}
export function checkRegister(s){
 const graph=read('orchestration/graph.json',root);
 assert.equal(s.policy,'just-in-time-external-gates');
 assert.deepEqual(s.tasks.map(x=>x.id).sort(),graph.tasks.map(x=>x.id).sort());
 for(const row of s.tasks){
  const t=graph.tasks.find(t=>t.id===row.id);
  const exists=fs.existsSync(path.join(root,t.acceptance));
  assert.equal(row.state,exists?'authored':'missing',`stale register ${row.id}`);
  assert.equal(row.product_pass,false);
 }
 assert.ok(fs.existsSync(path.join(root,'tests/acceptance/F01-01.test.mjs')));
}
