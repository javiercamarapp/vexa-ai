// The synthetic fixtures must be internally coherent: an answer derives from the same figure the card shows.
import test from 'node:test';import assert from 'node:assert/strict';
import {formatMinorUnits} from '../../../../packages/metrics/money.mjs';
import {incidenceCategories,incidenceMonthly,coverage,explorerAnswer,explorerPage,detailProblem,briefs,bundleProblems,bundleMetrics,trends,trendsOctubreParcial,trendsSinReembolsos,problems,IDS} from './fixtures.mjs';
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
test('conversation volume is dated by first message and a sample is labelled as an estimate',()=>{
 const c=trends().conversations;assert.equal(c.definition,'started_at_or_first_message');assert.equal(c.sampled,true);assert.equal(c.class,'estimated');assert.match(c.sampleNote,/muestra del 3 %/);
 assert.ok(c.series.filter(r=>r.count>0).length>=10,'a real series is not a single bar');
});

test('coverage fixtures add up: ledger lines sum to the total, association states sum to the facts, tracker rows are the ruling version',()=>{
 const S=Object.fromEntries(coverage().sources.map(s=>[s.key,s])),num=x=>Number(x.replace(/,/g,''));
 const ledger=S.ledger.detail.filter(l=>/pedidos/.test(l)).reduce((a,l)=>{const m=/: ([\d,]+) pedidos · ([\d,]+) reembolsos/.exec(l);return a+num(m[1])+num(m[2]);},0);
 assert.equal(ledger,S.ledger.total);
 const st=/resueltos ([\d,]+) · pendientes ([\d,]+) · por revisar ([\d,]+) · retenidos ([\d,]+)/.exec(S.associations.detail[0]);
 assert.equal(st.slice(1).reduce((a,x)=>a+num(x),0),S.associations.total);
 assert.equal(S.excel.incorporated+S.excel.rejected,S.excel.total);assert.match(S.excel.detail[0],/v07b · ab12cd34/);
 for(const s of Object.values(S))if(s.class==='estimated')assert.ok(s.detail.some(l=>/muestra del 10 %/.test(l)),s.key+' estimated must say so');
});
test('incidence fixtures follow the repository shape (ok / empty / timeout) with ~47 % noise',()=>{
 const c=incidenceCategories(),noise=c.rows.find(r=>r.category.startsWith('Other: Retailer'));
 assert.equal(c.status,'ok');assert.ok(noise.count/c.totals.incidences>0.44&&noise.count/c.totals.incidences<0.5);
 assert.equal(incidenceCategories('timeout').status,'timeout');assert.equal(incidenceCategories('empty').totals.incidences,0);
 const m=incidenceMonthly('ok',IDS.problemA);assert.equal(m.series.length,12);assert.equal(m.total,m.series.reduce((a,p)=>a+p.count,0));
 assert.deepEqual(incidenceMonthly('timeout').series,[]);assert.equal(incidenceMonthly('empty').total,0);
});

test('variantes de tendencias: octubre parcial (5 días) y reembolsos sin registros elegibles',()=>{
 const p=trendsOctubreParcial(),oct=p.ledger.series.at(-1);
 assert.equal(oct.month,'2026-10');assert.equal(oct.orders.count,220);assert.equal(p.ledger.completeness.dataThrough,'2026-10-05');assert.deepEqual(p.ledger.completeness.partialMonths,['2026-10']);
 const s=trendsSinReembolsos();assert.ok(s.ledger.series.every(r=>r.refunds.count===0&&r.refunds.unknownAmounts===0));assert.ok(s.ledger.series.some(r=>r.orders.count>0));
});
