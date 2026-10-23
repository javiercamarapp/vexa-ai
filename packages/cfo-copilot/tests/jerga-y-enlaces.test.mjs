import test from 'node:test';import assert from 'node:assert/strict';
import {buildCfoReport,serializeReport,economicsHref} from '../src/cfo-model.mjs';
import {ledgerMonthlyFixture,FIXTURE_WATERMARK} from '../src/fixtures.mjs';
const report=buildCfoReport(ledgerMonthlyFixture(),{watermark:FIXTURE_WATERMARK});
test('el informe de /cfo no expone jerga interna',()=>{
 const s=JSON.stringify(serializeReport?serializeReport(report):report,(k,v)=>typeof v==='bigint'?v.toString():v);
 assert.doesNotMatch(s,/economic_fx_versions|\bledger\b|asientos/i);
});
test('tarjetas «sin importe» con cero dicen «Ninguno (0)» con su base, no una leyenda sin cifra',()=>{
 const f=report.quality.figs;
 for(const x of [f.ordersNoAmount,f.refundsNoAmount]){assert.ok(x.display.length>0);if(x.value===0)assert.match(x.display,/Ninguno \(0\)/);}
});
test('el enlace a /economics lleva moneda y rango, no la página vacía',()=>{
 const h=economicsHref('USD','2025-10','2026-09');
 assert.equal(h,'/economics?currency=USD&date_start=2025-10-01&date_end=2026-10-01');
 for(const a of report.alerts??[])if(a.cta?.href?.startsWith('/economics'))assert.match(a.cta.href,/date_start=/);
});
