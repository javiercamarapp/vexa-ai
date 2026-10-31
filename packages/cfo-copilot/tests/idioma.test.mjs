// El informe CFO y sus exportes salen en el idioma pedido: en inglés no puede quedar español en etiquetas, alcances, métodos, alertas, glosario, CSV ni PDF.
// Las cifras (valores, bps, monedas) son idénticas en ambos idiomas: solo cambia la presentación.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCfoReport, reportRows, monthMetrics, glossaryOf} from '../src/cfo-model.mjs';
import {ledgerMonthlyFixture, exposureFixture, FIXTURE_WATERMARK} from '../src/fixtures.mjs';
import {toCsv, toPdf, pdfText, csvRows} from '../src/cfo-export.mjs';
import {money, axisLabel, monthLabel} from '../src/format.mjs';

const ACENTOS = /[áéíóúñ¿¡«»]/i;
const PALABRAS = /\b(de|del|la|las|los|el|para|por|sin|con|una?|que|se|su|más|hay|datos|meses|mes|pedidos|reembolsos|ingresos|moneda|monedas|cifra|canal|canales|importe|registros|filas|fuente|ver|cómo|base|tasa|promedio|ninguno)\b/gi;
const espanol = t => ACENTOS.test(t) || (t.match(PALABRAS) ?? []).length >= 2;
const rows = ledgerMonthlyFixture();
const opts = {watermark: FIXTURE_WATERMARK, exposure: exposureFixture({attested: true})};
const es = buildCfoReport(rows, opts), en = buildCfoReport(rows, {...opts, idioma: 'en'});
/** Todo texto de una cadena dentro del informe (excluye ids, hrefs, monedas y nombres de canal/problema, que son datos). */
function textos(x, ruta = '', out = []) {
  if (typeof x === 'string') { if (!/(^|\.)(id|href|currency|unit|channel|month|base|kind|generatedAt|watermark|label)$/.test(ruta) || /(^|\.)(alerts|kpis|quality|projections|glossary|mix)\b/.test(ruta)) out.push([ruta, x]); }
  else if (Array.isArray(x)) x.forEach((v, i) => textos(v, ruta + '.' + i, out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) textos(v, ruta ? ruta + '.' + k : k, out);
  return out;
}

test('en inglés el informe no emite español: etiquetas, alcances, cómo se calculó, alertas, glosario y cobertura', () => {
  const malos = textos(en).filter(([ruta, t]) => espanol(t) && !/channels?\.\d+\.label$|exposure\.rows\.\d+\.(title|label)$|byCurrency\.\d+\.items\.\d+\.label$|mix\.orders\.\d+\.label$/.test(ruta));
  assert.deepEqual(malos.slice(0, 8), []);
  assert.ok(en.alerts.length > 0 && en.glossary.length === 11);
  assert.equal(en.kpis[0].metrics[0].label.startsWith('Revenue ·'), true);
  assert.ok(en.glossary.map(g => g.term).includes('Observed') && en.glossary.map(g => g.term).includes('Estimated'));
  assert.equal(en.rule, 'USD, CAD and MXN are not added or converted: each currency is shown separately.');
});
test('el español sigue igual por omisión y las cifras son las mismas en ambos idiomas', () => {
  assert.equal(es.kpis[0].metrics[0].label.startsWith('Ingresos ·'), true);
  assert.equal(glossaryOf('es')[0].term, 'Observado'); assert.equal(es.idioma, 'es'); assert.equal(en.idioma, 'en');
  const v = r => r.kpis.flatMap(k => k.metrics.map(m => [m.id, m.value, m.coverage.known, m.coverage.eligible, m.delta?.bps ?? null]));
  assert.deepEqual(v(en), v(es));
  assert.deepEqual(en.alerts.map(a => [a.id, a.severity]), es.alerts.map(a => [a.id, a.severity]));
  assert.deepEqual(en.perCurrency.map(p => String(p.refunds.total.amount)), es.perCurrency.map(p => String(p.refunds.total.amount)));
});
test('fechas, cifras y moneda salen con el locale del idioma activo', () => {
  assert.equal(monthLabel('2026-09', 'en'), 'Sep 2026'); assert.equal(monthLabel('2026-09', 'es'), 'sep 2026');
  assert.equal(money('123456789', 'USD', 2, 'en'), '1,234,567.89 USD'); assert.equal(money(null, 'USD', 2, 'en'), 'Not available'); assert.equal(money(null, 'USD', 2), 'No disponible');
  assert.match(axisLabel(1250000000, 2, 'en'), /^12M$|^12\.5M$/); assert.ok(en.kpis[0].metrics[2].display.includes('.'));
  const tasa = r => r.kpis.flatMap(k => k.metrics).find(x => x.id.startsWith('rate')).display; assert.match(tasa(en), /\d%$/); assert.match(tasa(es), /\d %$/);
  const m = monthMetrics(en, 'USD', en.lastComplete); assert.ok(m.metrics[0].scope.includes('Sep') || m.metrics[0].scope.includes('Oct') || /[A-Z][a-z]{2} 20\d\d/.test(m.metrics[0].scope));
});
test('el exporte CSV y PDF en inglés no trae español y comparte filas con la pantalla', () => {
  const csv = toCsv(en, {synthetic: true});
  assert.match(csv, /CFO report · Rovaq AI/); assert.match(csv, /Section,Figure,Scope,Value,Class,Coverage,How it was calculated/); assert.match(csv, /SYNTHETIC DEMONSTRATION DATA/);
  const lineas = csvRows(en).flat().filter(t => typeof t === 'string').filter(t => !/Walmart|Amazon|Shopify|Best Buy/.test(t));
  assert.deepEqual(lineas.filter(espanol).slice(0, 5), []);
  assert.equal(csvRows(en).length, reportRows(en).length);
  const pdf = pdfText(toPdf(en, {synthetic: true, org: 'Demo'}));
  assert.match(pdf, /CFO report/); assert.match(pdf, /How it was calculated/); assert.match(pdf, /page 1 of/); assert.doesNotMatch(pdf, /Cómo se calculó|Informe CFO|pagina/);
  const pdfEs = pdfText(toPdf(es, {synthetic: true})); assert.match(pdfEs, /Informe CFO/); assert.match(pdfEs, /Cómo se calculó/.test(pdfEs) ? /Cómo se calculó/ : /C.mo se calcul/);
  assert.match(toCsv(es), /Informe CFO · Rovaq AI/);
});
