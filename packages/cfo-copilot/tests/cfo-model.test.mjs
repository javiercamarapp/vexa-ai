import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCfoReport, reportRows, serializeReport, monthMetrics} from '../src/cfo-model.mjs';
import {ledgerMonthlyFixture, exposureFixture, FIXTURE_WATERMARK, FIXTURE_TOTAL, BASIS} from '../src/fixtures.mjs';
import {toCsv, toPdf, pdfText, csvCell, forPdf} from '../src/cfo-export.mjs';
import {divRound, changeBps, ratioBps, money} from '../src/format.mjs';

const rows = ledgerMonthlyFixture();
const report = buildCfoReport(rows, {watermark: FIXTURE_WATERMARK});

test('fixture coherente con los datos reales', () => {
  assert.equal(rows.reduce((a, r) => a + r.n, 0), FIXTURE_TOTAL);
  assert.equal(report.quality.totalRows, 85361);
  assert.equal(report.quality.figs.refundsNoAmount.value, 760);
  assert.equal(report.quality.figs.noCurrency.value, 4192);
  assert.deepEqual(report.currencies.sort(), ['CAD', 'MXN', 'USD']);
});

test('USD/CAD/MXN nunca se suman: cada total sale solo de filas de su moneda', () => {
  for (const pc of report.perCurrency) {
    const manual = rows.filter(r => r.currency === pc.currency && r.kind === 'order' && r.status === 'recorded' && r.basis === BASIS.line).reduce((a, r) => a + BigInt(r.amountMinor), 0n);
    const line = pc.orderBases.find(b => b.base === BASIS.line);
    assert.equal(line.total.amount, manual, pc.currency);
  }
  for (const k of report.kpis) for (const m of k.metrics) {
    const codes = (m.display.match(/\b(USD|CAD|MXN)\b/g) ?? []);
    assert.ok(codes.length <= 1 && codes.every(c => c === k.currency), m.label + ' ' + m.display);
  }
  assert.match(report.rule, /no se suman ni se convierten/);
});

test('las filas sin moneda (XXX) no entran a ningún importe', () => {
  const noCur = rows.filter(r => r.currency === 'XXX').reduce((a, r) => a + BigInt(r.amountMinor), 0n);
  assert.equal(noCur, 0n);
  const counted = report.perCurrency.reduce((a, pc) => a + pc.orderBases.reduce((x, b) => x + b.total.n, 0), 0);
  const recordedWithCurrency = rows.filter(r => r.kind === 'order' && r.status === 'recorded' && r.currency !== 'XXX').reduce((a, r) => a + r.n, 0);
  assert.equal(counted, recordedWithCurrency);
});

test('las bases no se mezclan: Shopify (bruto) va en su propia base y el reembolso no se resta del ingreso', () => {
  const usd = report.perCurrency.find(c => c.currency === 'USD');
  assert.ok(usd.orderBases.length >= 2);
  const line = usd.orderBases.find(b => b.base === BASIS.line), shop = usd.orderBases.find(b => b.base === BASIS.shopify);
  assert.ok(!line.channels.some(c => c.channel === 'shopify'));
  assert.ok(shop.channels.every(c => c.channel === 'shopify'));
  assert.equal(usd.refunds.base, BASIS.refund);
  assert.ok(!JSON.stringify(serializeReport(report)).toLowerCase().includes('neto'), 'no hay ingreso neto');
  assert.ok(report.glossary.some(g => g.term === 'Base económica'));
});

test('un importe desconocido es «No disponible», nunca 0', () => {
  const r = buildCfoReport([{month: '2026-01', channel: 'amazon', kind: 'order', status: 'recorded', currency: 'USD', exponent: 2, basis: BASIS.line, n: 10, known: 0, amountMinor: '0'}], {watermark: '2026-03-01T00:00:00Z'});
  const usd = r.perCurrency[0].orderBases[0].series[0];
  assert.equal(usd.amountDisplay, 'No disponible');
  assert.equal(usd.ticketDisplay, 'No disponible');
});

test('mes incompleto: las comparativas usan el último mes COMPLETO y octubre se marca parcial', () => {
  assert.deepEqual(report.partialMonths, ['2026-10']);
  assert.equal(report.lastComplete, '2026-09');
  assert.equal(report.prevComplete, '2026-08');
  const alert = report.alerts.find(a => a.id === 'period:partial');
  assert.ok(alert && /sep 2026/.test(alert.detail));
  assert.equal(monthMetrics(report, 'USD', '2026-10').partial, true);
});

test('cada cifra lleva clase, cobertura/método y «cómo se calculó»', () => {
  const all = reportRows(report);
  assert.ok(all.length > 60);
  for (const r of all) { assert.ok(['observed', 'estimated', 'inferred'].includes(r.kind), r.id); assert.ok(r.how && r.how.length > 10, r.id); assert.ok(r.value !== undefined && r.value !== '', r.id); }
  assert.ok(report.kpis[0].metrics.filter(m => m.coverage.eligible !== null).every(m => m.coverage.label.includes(' de ')));
});

test('proyecciones: siempre Estimado con método explícito, no observado', () => {
  assert.ok(report.projections.length >= 4);
  for (const p of report.projections) { assert.equal(p.kind, 'estimated'); assert.match(p.method, /mínimos cuadrados/); assert.match(p.method, /No es un pronóstico calibrado/); assert.ok(p.points.every(pt => pt.midDisplay.startsWith('≈ '))); }
  const proj = reportRows(report).filter(r => r.section.startsWith('Proyecciones'));
  assert.ok(proj.every(r => r.kind === 'estimated'));
  assert.equal(buildCfoReport(rows.filter(r => r.month >= '2026-07'), {watermark: FIXTURE_WATERMARK}).projections.length, 0, 'con menos de 4 meses completos no se proyecta');
});

test('costo de la mala calidad: Estimado, por canal y moneda; sin moneda no se estima', () => {
  const u = report.quality.unaccounted.find(x => x.currency === 'USD');
  assert.equal(u.orderFig.kind, 'estimated');
  assert.ok(u.orderFig.display.startsWith('≈ '));
  assert.match(report.quality.notEstimable.reason, /no se puede asignar/);
  const manual = ['amazon', 'mirakl_bestbuy_us', 'walmart'].reduce((a, ch) => {
    const rs = rows.filter(r => r.channel === ch && r.currency === 'USD' && r.kind === 'order' && r.status === 'recorded' && r.basis === BASIS.line);
    const known = rs.reduce((x, r) => x + r.known, 0), amt = rs.reduce((x, r) => x + BigInt(r.amountMinor), 0n), miss = rs.reduce((x, r) => x + r.n - r.known, 0);
    return a + BigInt(miss) * divRound(amt, known);
  }, 0n);
  assert.equal(BigInt(u.orderMinor), manual);
});

test('exposición: «sin atestar» sin vínculos; con vínculos es Inferido y no aditiva', () => {
  assert.equal(report.exposure.state, 'sin_atestar');
  assert.equal(report.exposure.cta.href, '/problems');
  assert.equal(report.exposure.rows.length, 0);
  const withLinks = buildCfoReport(rows, {watermark: FIXTURE_WATERMARK, exposure: exposureFixture({attested: true})});
  assert.equal(withLinks.exposure.state, 'ok');
  assert.equal(withLinks.exposure.additive, false);
  assert.ok(withLinks.exposure.rows.every(r => r.kind === 'inferred'));
  assert.match(withLinks.exposure.note, /NO se suman/);
});

test('alertas deterministas: reembolsos anómalos y caída de pedidos', () => {
  const ids = report.alerts.map(a => a.id);
  assert.ok(ids.includes('refund-anomaly:walmart:USD'));
  assert.ok(ids.includes('orders-drop:CAD'));
  assert.ok(ids.includes('quality:no-currency'));
  assert.ok(report.alerts.every(a => a.how.length > 20));
  const calm = buildCfoReport(rows.map(r => ({...r})).filter(r => r.channel === 'shopify'), {watermark: FIXTURE_WATERMARK});
  assert.ok(!calm.alerts.some(a => a.id.startsWith('refund-anomaly')));
});

test('tasa de reembolso por conteo solo con canales con fuente de devoluciones', () => {
  const usd = report.perCurrency.find(c => c.currency === 'USD');
  assert.ok(!usd.rate.channels.includes('Shopify'));
  assert.ok(usd.rate.excluded.includes('Shopify'));
  const mxn = report.perCurrency.find(c => c.currency === 'MXN');
  assert.equal(mxn.rate.total.bps, null, 'sin reembolsos en la moneda no hay tasa 0 %');
});

test('CSV y PDF tienen exactamente las mismas cifras que la pantalla', () => {
  const csv = toCsv(report, {synthetic: true}), pdf = pdfText(toPdf(report, {synthetic: true}));
  const norm = s => forPdf(String(s).replace(/\s+/g, ' '));
  const pdfFlat = norm(pdf);
  for (const r of reportRows(report)) {
    assert.ok(csv.includes(csvCell(r.value).replace(/^'/, '')) || csv.includes(r.value), 'CSV ' + r.id);
    assert.ok(pdfFlat.includes(norm(r.value).slice(0, 60)) || pdfFlat.replace(/ /g, '').includes(norm(r.value).replace(/ /g, '').slice(0, 40)), 'PDF ' + r.id + ' ' + r.value);
  }
  for (const k of report.kpis) for (const m of k.metrics) { assert.ok(csv.includes(m.display)); assert.ok(pdfFlat.includes(norm(m.display))); }
  assert.match(csv, /DATOS SINTÉTICOS/);
  assert.match(toPdf(report).subarray(0, 8).toString(), /%PDF-1\.4/);
});

test('CSV neutraliza fórmulas pero conserva cifras', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+2.6 %'), '+2.6 %');
  assert.equal(csvCell('-0.05 USD'), '-0.05 USD');
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('hola, "mundo"'), '"hola, ""mundo"""');
});

test('aritmética exacta con BigInt', () => {
  assert.equal(divRound(10n, 4n), 3n);
  assert.equal(divRound('99999999999999999999', 2), 50000000000000000000n);
  assert.equal(changeBps(110n, 100n), 1000);
  assert.equal(changeBps(5n, 0n), null);
  assert.equal(ratioBps(1, 3), 3333);
  assert.equal(money('18452300', 'USD', 2), '184,523.00 USD');
  const big = serializeReport(report);
  assert.equal(typeof big.perCurrency[0].orderBases[0].total.amount, 'string');
  assert.ok(!('m$' in big.perCurrency[0]));
});
