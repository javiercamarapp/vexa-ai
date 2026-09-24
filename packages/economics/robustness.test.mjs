import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// This is an author-owned regression suite, not the independent acceptance gate.
const root=process.env.VEXA_CANDIDATE || fileURLToPath(new URL('../../',import.meta.url));
const {adaptLedger}=await import(pathToFileURL(resolve(root,'packages/economics/adapter.mjs')));
const {adaptMoneyMetric}=await import(pathToFileURL(resolve(root,'packages/metrics/money-adapter.mjs')));
const {sumMoney,convertMoney}=await import(pathToFileURL(resolve(root,'packages/metrics/money.mjs')));
const catalog={version:'SYN-catalog-v1',currencies:{USD:2,JPY:0,EUR:2}};
const scope={start:'2026-01-01T00:00:00Z',end:'2026-02-01T00:00:00Z',timezone:'UTC',dateBasis:'occurred_at',currency:'USD',exponent:2,basis:'gross_orders'};
function random(seed=42){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};}
function shuffled(rows,rng){const result=structuredClone(rows);for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function row(id,amountMinor,extra={}){return {id,tenantId:'SYN-A',sourceAccount:'SYN-crm',externalId:id,sourceRevision:'1',evidenceRef:'SYN-evidence:'+id,basis:'gross_orders',provenance:'observed',occurredAt:'2026-01-10T00:00:00Z',recordedAt:'2026-01-11T00:00:00Z',currency:'USD',exponent:2,status:'recorded',amountMinor,...extra};}
function fixture(){
 const rng=random();const orders=Array.from({length:97},(_,i)=>row('SYN-order-'+i,(9007199254740993n+BigInt(Math.floor(rng()*99999))).toString()));
 return {authorization:{tenantId:'SYN-A',permissionsVersion:'v1'},snapshot:{tenantId:'SYN-A',id:'SYN-snapshot',asOf:'2026-02-02T00:00:00Z',sources:[{sourceAccount:'SYN-crm',complete:true,watermark:'SYN-cursor97'}]},scope,orders,events:[row('SYN-refund','999999999999999999999',{status:'settled',kind:'refund'}),row('SYN-reversal','-19',{status:'settled',kind:'reversal',reversalOf:'SYN-refund'})],links:orders.flatMap((o,i)=>[{tenantId:'SYN-A',problemId:'SYN-problem-'+i%3,orderId:o.id,evidenceRef:'SYN-link:'+i,relationVersion:'1'}])};
}
function project(metric){return {amount:metric.amount_minor,subtotal:metric.known_subtotal,coverage:metric.coverage,status:metric.status,currency:metric.currency,exponent:metric.exponent};}
function envelope(ledger,id='SYN-metric',which='allOrders',additive=true){return adaptMoneyMetric(ledger.metrics[which],{tenantId:ledger.tenantId,catalog,scope:ledger.scope,metricId:id,additive,provenance:[{source:'SYN-snapshot',reference:ledger.inputHash,version:'1'}]});}

test('seed42: reorder and replay raw pages preserve metrics and canonical input digest',()=>{
 const input=fixture(),before=structuredClone(input),expected=adaptLedger(input),rng=random();
 for(let i=0;i<16;i++){
  const variant={...input,orders:shuffled([...input.orders,...input.orders.slice(i,i+7)],rng),events:shuffled([...input.events,...input.events],rng),links:shuffled([...input.links,...input.links.slice(0,4)],rng)};
  assert.deepEqual(adaptLedger(variant),expected,'RAW_REPLAY_INVARIANT');
 }
 assert.deepEqual(input,before,'INPUT_MUST_NOT_BE_MUTATED');
});

test('seed42: disjoint batch partitions conserve exact money and coverage across both adapters',()=>{
 const input=fixture();input.events=[];input.links=[];
 const expected=envelope(adaptLedger(input));
 for(const count of [1,2,3,7,17,97]){
  const buckets=Array.from({length:count},()=>[]);shuffled(input.orders,random()).forEach((x,i)=>buckets[i%count].push(x));
  const metrics=buckets.map((orders,i)=>envelope(adaptLedger({...input,orders}),'SYN-part-'+i));
  assert.deepEqual(project(sumMoney(metrics,{catalog})),project(expected),'DISJOINT_PARTITION_CONSERVATION');
  assert.deepEqual(project(sumMoney([...metrics,...metrics],{catalog})),project(expected),'METRIC_REPLAY_MUST_NOT_ADD');
 }
});

test('unknown in one partition stays unknown after replay, merge and explicit FX',()=>{
 const input=fixture();input.orders=[row('SYN-known','9007199254740993123456789'),row('SYN-unknown',null)];input.events=[];input.links=[];
 const metrics=input.orders.map((r,i)=>envelope(adaptLedger({...input,orders:[r]}),'SYN-part-'+i));
 const actual=sumMoney([...metrics,metrics[1]],{catalog});
 assert.equal(actual.amount_minor,null,'UNKNOWN_TOTAL_IS_NOT_ZERO');
 assert.equal(actual.known_subtotal,'9007199254740993123456789','EXACT_KNOWN_SUBTOTAL');
 assert.deepEqual(actual.coverage,{known_n:1,eligible_n:2},'UNKNOWN_REPLAY_COVERAGE');
 assert.equal(actual.status,'partial');
 const fx={approved:true,approval_ref:'SYN-owner',source:'SYN-rate',version:'1',base:'USD',quote:'JPY',date:'2026-01-31',rate:'150',rounding:'half_even'};
 const converted=convertMoney(actual,{catalog,targetCurrency:'JPY',fx});
 assert.equal(converted.converted.amount_minor,null,'FX_MUST_PRESERVE_UNKNOWN');
 assert.equal(converted.converted.known_subtotal,'13510798882111489685185184','FX_BIGINT_EXACT_HALF_EVEN');
 assert.deepEqual(converted.original,actual,'FX_PRESERVES_ORIGINAL');
});

test('canonical identity migration conserves value while invalidating provenance hashes',()=>{
 const input=fixture(),first=adaptLedger(input),migrated=structuredClone(input);
 migrated.snapshot.sources[0].sourceAccount='SYN-new-crm';
 for(const r of [...migrated.orders,...migrated.events]){r.id='migrated:'+r.id;r.externalId='migrated:'+r.externalId;r.sourceAccount='SYN-new-crm';r.sourceRevision='2';r.evidenceRef='migrated:'+r.evidenceRef;if(r.reversalOf)r.reversalOf='migrated:'+r.reversalOf;}
 for(const l of migrated.links){l.orderId='migrated:'+l.orderId;l.evidenceRef='migrated:'+l.evidenceRef;l.relationVersion='2';}
 const second=adaptLedger(migrated);
 assert.deepEqual(project(envelope(second)),project(envelope(first)),'IDENTITY_MIGRATION_VALUE');
 assert.deepEqual(project(envelope(second,'refunds','refunds')),project(envelope(first,'refunds','refunds')),'REVERSAL_MIGRATION_VALUE');
 assert.equal(second.metrics.exposure.global.amountMinor,first.metrics.exposure.global.amountMinor);
 assert.notEqual(second.inputHash,first.inputHash,'PROVENANCE_MIGRATION_INVALIDATES_DIGEST');
 assert.notEqual(second.scopeHash,first.scopeHash,'SOURCE_ACCOUNT_MIGRATION_INVALIDATES_SCOPE');
 // This tests already-resolved canonical records, not CRM alias persistence.
});

test('currency is explicit: unrelated currency does not alter the selected total',()=>{
 const input=fixture(),first=envelope(adaptLedger(input));
 const foreign={...input,orders:[...input.orders,row('SYN-EUR','9999999999999999999999999999',{currency:'EUR'})]};
 assert.deepEqual(project(envelope(adaptLedger(foreign))),project(first),'CURRENCY_FILTER_MUST_ISOLATE_AMOUNT');
 const eur=adaptLedger({...foreign,scope:{...scope,currency:'EUR'}});
 assert.throws(()=>sumMoney([first,envelope(eur,'SYN-eur')],{catalog}),e=>e.code==='INCOMPATIBLE_MONEY_SCOPE','NO_IMPLICIT_CROSS_CURRENCY_SUM');
 const changed={...input,orders:[...input.orders,row('SYN-JPY','9999999999999999999999999999',{currency:'JPY',exponent:0})]};
 const jpy=adaptLedger({...changed,scope:{...scope,currency:'JPY',exponent:0}});
 assert.equal(jpy.metrics.allOrders.amountMinor,'9999999999999999999999999999');
 assert.throws(()=>sumMoney([first,envelope(jpy,'SYN-jpy')],{catalog}),e=>e.code==='INCOMPATIBLE_MONEY_SCOPE','NO_IMPLICIT_CROSS_EXPONENT_SUM');
});

test('authorization boundary checks rows before currency/window/status filtering',()=>{
 for(const extra of [{currency:'EUR'},{occurredAt:'2025-12-01T00:00:00Z'},{status:'cancelled'}]){
  const input=fixture();input.orders.push(row('SYN-foreign','17',{tenantId:'SYN-B',...extra}));
  assert.throws(()=>adaptLedger(input),e=>e.code==='TENANT_MISMATCH','FOREIGN_ROW_MUST_NOT_BE_HIDDEN_BY_FILTER');
 }
 const input=fixture();input.links.push({...input.links[0],tenantId:'SYN-B'});
 assert.throws(()=>adaptLedger(input),e=>e.code==='TENANT_MISMATCH','FOREIGN_LINK_MUST_REJECT');
});

test('contradictory canonical or external identity blocks totals even outside selected scope',()=>{
 for(const change of [{id:'SYN-other-id'},{externalId:'SYN-other-external'}]){
  const input=fixture();input.orders.push({...input.orders[0],...change,currency:'EUR'});
  const result=adaptLedger(input);assert.equal(result.metrics.allOrders.amountMinor,null,'IDENTITY_CONFLICT_BLOCKS_TOTAL');
  assert.equal(result.metrics.allOrders.knownSubtotalMinor,null,'IDENTITY_CONFLICT_BLOCKS_SUBTOTAL');
  assert.ok(result.metrics.allOrders.missingReasons.includes('IDENTITY_CONFLICT'));
 }
});

test('scope and source completeness survive partitions; publication cannot infer observed zero',()=>{
 const input=fixture();input.orders=[];input.events=[];input.links=[];input.snapshot.sources[0].complete=false;
 const incomplete=envelope(adaptLedger(input));assert.equal(incomplete.amount_minor,null,'INCOMPLETE_EMPTY_IS_NOT_ZERO');
 assert.ok(incomplete.missing_reasons.includes('SOURCE_INCOMPLETE'));
 input.snapshot.sources[0].complete=true;input.snapshot.asOf='2026-01-15T00:00:00Z';
 const future=envelope(adaptLedger(input));assert.equal(future.amount_minor,null,'OPEN_WINDOW_IS_NOT_ZERO');
 assert.ok(future.missing_reasons.includes('WINDOW_INCOMPLETE'));
 input.snapshot.asOf='2026-02-02T00:00:00Z';assert.equal(envelope(adaptLedger(input)).amount_minor,'0','OBSERVED_EMPTY_CAN_BE_ZERO');
});

test('overlapping problem exposure is nonadditive; raw replay reassembly uses global union',()=>{
 const input=fixture();input.links.push({...input.links[0],problemId:'SYN-another-problem',evidenceRef:'SYN-other-link'});
 const result=adaptLedger(input);assert.equal(result.metrics.exposure.global.amountMinor,result.metrics.allOrders.amountMinor,'EXPOSURE_GLOBAL_UNION');
 const envelopes=Object.entries(result.metrics.exposure.byProblem).map(([id,m])=>adaptMoneyMetric(m,{tenantId:result.tenantId,catalog,scope,metricId:id,additive:false,provenance:[{source:'SYN',reference:id,version:'1'}]}));
 assert.throws(()=>sumMoney(envelopes,{catalog}),e=>e.code==='NON_ADDITIVE_METRIC','PROBLEM_ROWS_MUST_NOT_SUM');
 const overlappingPages=[input.orders.slice(0,60),input.orders.slice(50)];
 assert.deepEqual(adaptLedger({...input,orders:overlappingPages.flat()}),result,'RAW_PARTITION_REASSEMBLY_DEDUPES');
});
