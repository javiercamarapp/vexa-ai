// El helper único de formato por idioma: es-MX en español y en-US en inglés; el valor no cambia, solo la presentación.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../src/lib/formato/idioma.mjs';
import {formatosDe} from '../src/lib/i18n/formatos';

test('localeDe: es-MX y en-US, y lo desconocido cae en español', () => {
  assert.equal(F.localeDe('es'), 'es-MX'); assert.equal(F.localeDe('en'), 'en-US'); assert.equal(F.localeDe(undefined), 'es-MX');
});
test('números, compactos y porcentajes por idioma', () => {
  assert.equal(F.numero(1234567.5, 'en'), '1,234,567.5'); assert.equal(F.numero(1234567.5, 'es'), '1,234,567.5');
  assert.equal(F.numero(null, 'en'), '—'); assert.equal(F.numero(Number.NaN, 'es'), '—');
  assert.equal(F.compacto(1200000, 'en'), '1.2M'); assert.match(F.compacto(1200000, 'es'), /^1\.2\s?M$/);
  assert.equal(F.porcentaje(12.34, 'en'), '12.3%'); assert.equal(F.porcentaje(12.34, 'es'), '12.3 %');
  assert.equal(F.porcentaje(-5, 'en', {conSigno: true}), '−5.0%'); assert.equal(F.porcentaje(5, 'es', {conSigno: true}), '+5.0 %');
});
test('enteros y decimales sin símbolo son idénticos en es-MX y en-US (por eso formatoNum no necesita idioma)', () => {
  for (const n of [0, 7, 1234, 1234567.891, -98765.4321, 0.5]) for (const o of [undefined, {maximumFractionDigits: 1}, {minimumFractionDigits: 2, maximumFractionDigits: 2}] as const)
    assert.equal(F.numero(n, 'es', o), F.numero(n, 'en', o));
  assert.equal(F.nf.format(1234567), '1,234,567'); assert.equal(F.formatoNum({maximumFractionDigits: 1}).format(12.345), '12.3');
});
test('moneda conserva el código de la moneda en los dos idiomas', () => {
  assert.match(F.moneda(1200, 'USD', 'en'), /^\$1,200\.00$/); assert.match(F.moneda(1200, 'USD', 'es'), /1,200\.00/);
  assert.match(F.moneda(1200, 'EUR', 'en'), /€1,200\.00/); assert.match(F.moneda(1200, 'MXN', 'en'), /MX\$1,200\.00/);
  assert.equal(F.moneda(undefined, 'USD', 'en'), '—');
});
test('meses y fechas en UTC por idioma, sin saltos por zona horaria y sin puntos de abreviatura', () => {
  assert.equal(F.mesLargo('2026-09', 'en'), 'September 2026'); assert.equal(F.mesLargo('2026-09', 'es'), 'septiembre de 2026');
  assert.equal(F.mesCorto('2026-09', 'en'), 'Sep'); assert.equal(F.mesCorto('2026-09', 'es'), 'sep');
  assert.equal(F.mesCorto('2026-09', 'en', {anio: true}), 'Sep 2026');
  assert.equal(F.mesLargo('no-es-mes', 'en'), null); assert.equal(F.mesLargo(null, 'es'), null);
  assert.equal(F.fechaCorta('2026-09-18', 'en'), 'Sep 18, 2026'); assert.equal(F.fechaCorta('2026-09-18', 'es'), '18 sep 2026');
  assert.equal(F.fechaCorta('2026-01-01T00:30:00Z', 'en'), 'Jan 1, 2026');
  assert.equal(F.diaMes('2026-09-18', 'en'), 'September 18'); assert.equal(F.diaMes('2026-09-18', 'es'), '18 de septiembre');
  assert.equal(F.diaMes('2026-09-18', 'en', {largo: false}), 'Sep 18');
  assert.match(String(F.fechaHora('2026-09-18T20:05:00Z', 'en')), /^Sep 18, 2026,? 0?8:05 PM$/); assert.match(String(F.fechaHora('2026-09-18T20:05:00Z', 'es')), /^18 sep 2026,? 20:05$/);
  assert.equal(F.fechaCorta('basura', 'en'), null);
});
test('duración de procesos', () => { assert.equal(F.duracionMs(850, 'en'), '850 ms'); assert.equal(F.duracionMs(2400, 'en'), '2.4 s'); assert.equal(F.duracionMs(null, 'es'), ''); });
test('formatosDe liga el idioma una sola vez', () => {
  const en = formatosDe('en'), es = formatosDe('es');
  assert.equal(en.mesLargo('2026-09'), 'September 2026'); assert.equal(es.mesLargo('2026-09'), 'septiembre de 2026');
  assert.equal(en.locale, 'en-US'); assert.equal(es.locale, 'es-MX');
});
test('ningún componente ni módulo de pantallas fija la locale es-MX: usa el helper por idioma (excepciones justificadas abajo)', () => {
  const raiz = new URL('../src', import.meta.url).pathname;
  const hallazgos: string[] = [];
  const recorrer = (dir: string) => { for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) { if (!/\/(sitio|landing)$/.test(p) && !p.includes('/content/')) recorrer(p); continue; }
    if (!/\.(tsx?|mjs)$/.test(e.name) || /\.test\./.test(e.name)) continue;
    const rel = p.slice(raiz.length + 1);
    if (EXCEPCIONES.some((x) => rel.startsWith(x))) continue;
    const limpio = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    if (/['"`]es-MX['"`]/.test(limpio)) hallazgos.push(rel);
  } };
  recorrer(raiz);
  assert.deepEqual(hallazgos, [], 'archivos con locale es-MX fija; usa lib/formato/idioma.mjs o useFormato()');
});
/** Excepciones justificadas: el helper mismo; formato canónico es-mx (aún con parámetro de idioma); metadatos SEO/sitio (inLanguage, hreflang); sitio público. */
const EXCEPCIONES = ['lib/formato/', 'lib/i18n/', 'lib/site.mjs', 'app/sitemap.ts', 'app/(app)/(sitio)', 'components/sitio', 'content/', 'components/platform/eventos-seguridad.tsx' /* pendiente: vista nueva del agente de seguridad */];
