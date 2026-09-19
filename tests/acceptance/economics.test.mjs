import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const candidate = process.env.VEXA_CANDIDATE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { aggregateMoney, exposureForProblems, netRefunds, revenueRiskScenario } = await import(pathToFileURL(path.join(candidate, 'packages/economics/index.mjs')));

const order = (id, amountMinor, currency='USD') => ({ id, amountMinor, currency });
test('known zero differs from missing, totals are exact decimal strings', () => {
 assert.deepEqual(aggregateMoney([order('a','100'),order('b','0')]).USD,
 {amountMinor:'100',knownSubtotalMinor:'100',knownCount:2,totalCount:2,status:'complete'});
 assert.deepEqual(aggregateMoney([order('a','100'),order('b',null)]).USD,
 {amountMinor:null,knownSubtotalMinor:'100',knownCount:1,totalCount:2,status:'partial'});
});
test('currency buckets are not summed and empty data does not assert zero', () => {
 assert.deepEqual(aggregateMoney([]),{});
 const result=aggregateMoney([order('a','100','USD'),order('b','200','MXN')]);
 assert.equal(result.USD.amountMinor,'100'); assert.equal(result.MXN.amountMinor,'200');
 assert.equal(result.amountMinor,undefined);
});
test('exact replay is idempotent, conflicting repeated identity rejects', () => {
 assert.equal(aggregateMoney([order('a','100'),order('a','100')]).USD.amountMinor,'100');
 assert.throws(()=>aggregateMoney([order('a','100'),order('a','200')]),/conflict/i);
 assert.throws(()=>aggregateMoney([order('a','100'),order('a','100','MXN')]),/conflict/i);
});
test('invalid money never silently normalizes', () => {
 for(const amount of ['NaN','1.20','1e3',Infinity,100,'-1','01',''])
  assert.throws(()=>aggregateMoney([order('a',amount)]));
 assert.throws(()=>aggregateMoney([order('','100')]));
 assert.throws(()=>aggregateMoney([order('a','100','usd')]));
});
test('arbitrary precision and permutation invariance', () => {
 const rows=[order('c','9007199254740993'),order('a','7'),order('b','100')];
 assert.equal(aggregateMoney(rows).USD.amountMinor,'9007199254741100');
 assert.deepEqual(aggregateMoney(rows),aggregateMoney([...rows].reverse()));
});
test('problem overlap does not inflate global exposure; unknown link is an error', () => {
 const orders=[order('o1','10000'),order('o2','20000')];
 const links=[{problemId:'p1',orderId:'o1'},{problemId:'p1',orderId:'o2'},{problemId:'p2',orderId:'o1'}];
 const result=exposureForProblems(orders,links);
 assert.equal(result.global.USD.amountMinor,'30000');
 assert.equal(result.byProblem.p1.USD.amountMinor,'30000');
 assert.equal(result.byProblem.p2.USD.amountMinor,'10000');
 assert.throws(()=>exposureForProblems(orders,[{problemId:'p',orderId:'missing'}]),/missing/i);
});
const refund=(id,kind,amountMinor,extra={})=>({id,kind,amountMinor,currency:'USD',status:'settled',...extra});
test('refund minus reversal deduplicates and accepts reverse arrival order', () => {
 const rows=[refund('r','refund','2000'),refund('v','reversal','500',{reversalOf:'r'}),refund('r','refund','2000')];
 assert.equal(netRefunds(rows).USD.amountMinor,'1500');
 assert.deepEqual(netRefunds(rows),netRefunds([...rows].reverse()));
});
test('pending refund is not paid; unknown refund stays unknown', () => {
 assert.deepEqual(netRefunds([refund('r','refund','2000',{status:'pending'})]),{});
 assert.equal(netRefunds([refund('r','refund',null)]).USD.amountMinor,null);
});
test('orphan, excessive and cross-currency reversals reject, not silently clip', () => {
 assert.throws(()=>netRefunds([refund('v','reversal','500',{reversalOf:'r'})]),/original/i);
 assert.throws(()=>netRefunds([refund('r','refund','200'),refund('v','reversal','500',{reversalOf:'r'})]),/exceed/i);
 assert.throws(()=>netRefunds([refund('r','refund','200'),refund('v','reversal','50',{reversalOf:'r',currency:'MXN'})]),/currency/i);
});
test('event replay with conflicting state cannot mask uncertainty', () => {
 assert.throws(()=>netRefunds([refund('r','refund','100'),refund('r','refund','100',{status:'pending'})]),/conflict/i);
});
test('scenario is named scenario with horizon; integer arithmetic rounding once', () => {
 const base={affectedCustomers:500,relevantRevenueMinor:'24000',probabilityBps:2500,currency:'USD',horizonDays:365,assumptionId:'synthetic-v1'};
 const r=revenueRiskScenario(base);
 assert.equal(r.amountMinor,'3000000'); assert.equal(r.kind,'scenario'); assert.equal(r.horizonDays,365);
 assert.equal(revenueRiskScenario({...base,probabilityBps:null}).amountMinor,null);
 assert.throws(()=>revenueRiskScenario({...base,probabilityBps:10001}));
 assert.throws(()=>revenueRiskScenario({...base,horizonDays:0}));
 assert.throws(()=>revenueRiskScenario({...base,assumptionId:''}));
});
test('seeded replay property: duplicate/permutation never changes sums', () => {
 let seed=42; const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let n=1;n<=150;n++){
  const rows=Array.from({length:n},(_,i)=>order(String(i),String(rand()%100000)));
  const expected=rows.reduce((s,r)=>s+BigInt(r.amountMinor),0n).toString();
  assert.equal(aggregateMoney([...rows,...rows].reverse()).USD.amountMinor,expected);
 }
});
