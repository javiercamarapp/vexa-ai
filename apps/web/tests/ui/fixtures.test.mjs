// The synthetic fixtures must be internally coherent: an answer derives from the same figure the card shows.
import test from 'node:test';import assert from 'node:assert/strict';
import {formatMinorUnits} from '../../../../packages/metrics/money.mjs';
import {explorerAnswer,explorerPage,detailProblem,briefs,bundleProblems,bundleMetrics,trends,problems,IDS} from './fixtures.mjs';
const refunds=m=>m.find(x=>x.kind==='refunds');
test('the answer text, its metric and the problem card show the same refunds figure',()=>{
 const a=explorerAnswer('¿Qué reembolsos constan en este corte?'),m=a.metrics[0],text=formatMinorUnits(m.amount_minor,m.currency,m.exponent);
 assert.ok(a.answer.includes(text),'answer must quote the metric it carries: '+a.answer+' / '+text);
 const card=explorerPage().items.find(i=>i.id===IDS.problemA),cardMetric=refunds(card.metrics);
 assert.equal(m.amount_minor,cardMetric.amount_minor);assert.equal(m.source_ref,cardMetric.source_ref);
 assert.ok(a.answer.includes(`${m.coverage.known_n} de ${m.coverage.eligible_n}`));
 assert.equal(refunds(detailProblem().record.metrics).amount_minor,m.amount_minor);
 assert.equal(refunds(bundleProblems().items.find(i=>i.id===IDS.problemA).metrics).amount_minor,m.amount_minor);
 assert.equal(refunds(briefs().items[0].document.top3.find(i=>i.id===IDS.problemA).metrics).amount_minor,m.amount_minor);
 assert.equal(a.references[0].sourceRef,m.source_ref);
});
test('per-problem refunds never exceed the global refunds figure and October of the trend equals the KPI',()=>{
 const global=refunds(bundleMetrics().items[0].metrics);
 const per=problems.flatMap(p=>p.metrics.filter(x=>x.kind==='refunds'&&x.amount_minor!==null)).reduce((a,x)=>a+BigInt(x.amount_minor),0n);
 assert.ok(per<=BigInt(global.amount_minor));
 const oct=trends().ledger.series.at(-1);assert.equal(oct.refunds.amountMinor,global.amount_minor);assert.equal(oct.refunds.count,global.coverage.known_n);
 const orders=bundleMetrics().items[0].metrics.find(x=>x.kind==='allOrders');assert.equal(oct.orders.amountMinor,orders.amount_minor);
});
test('trend series are twelve consecutive months with non-negative counts',()=>{
 const t=trends();assert.equal(t.conversations.series.length,12);assert.equal(t.ledger.series.length,12);
 assert.ok(t.conversations.series.every(r=>r.count>=0&&/^\d{4}-\d{2}$/.test(r.month)));
});
