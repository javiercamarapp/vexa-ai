// Logos de integraciones (BrandMark): mapa nombre -> marca con los nombres REALES que muestran las pantallas, higiene de los SVG,
// tamaño fijo del componente y contraste en claro/oscuro. Los colores de marca viven solo en los SVG, nunca en tokens de interfaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement as h} from 'react';
import {MARCAS, marcaDe, contraste, monoEnOscuro, SUPERFICIE} from '../src/components/ui/brand-marks.data.ts';
import {NOMBRES as NOMBRES_FUENTES} from '../src/lib/legibilidad/fuentes.mjs';
import {FUENTES as FUENTES_SYNC} from '../src/lib/legibilidad/sincronizacion.mjs';
import {nombreFuente} from '../src/lib/connections/estado.mjs';
import {NOMBRE as NOMBRE_FUGA} from '../src/components/refunds/fuga-modelo.mjs';
import {NOMBRE_CANAL as NOMBRE_BRECHAS} from '../../../packages/workspace-service/brechas.mjs';
import {NOMBRE_RETAILER} from '../../../packages/workspace-service/mapa-problemas.mjs';

const src = join(import.meta.dirname, '../src');
const leer = (f) => readFileSync(join(src, f), 'utf8');

test('marcaDe: claves y nombres reales de fuentes, canales y retailers', () => {
  const casos = {
    hubspot: 'hubspot', HubSpot: 'hubspot', 'HubSpot (tickets)': 'hubspot', 'HubSpot API': 'hubspot', 'HubSpot (conversaciones, contactos)': 'hubspot',
    zendesk: 'zendesk', Zendesk: 'zendesk', shopify: 'shopify', Shopify: 'shopify',
    amazon: 'amazon', Amazon: 'amazon', walmart: 'walmart', Walmart: 'walmart',
    bestbuy: 'bestbuy', 'Best Buy': 'bestbuy', 'Best Buy US (Mirakl)': 'bestbuy', mirakl: 'bestbuy',
    csv: 'csv', CSV: 'csv', csv_conversations: 'csv', 'Archivos CSV': 'csv', 'Archivos CSV (importaciones)': 'csv',
    excel: 'excel', Excel: 'excel', xlsx: 'excel', tracker: 'excel', 'Tracker (Excel)': 'excel', 'Excel (Tracker)': 'excel', 'Tracker de Excel': 'excel', 'Tracker de Excel (carga manual)': 'excel',
    OpenRouter: 'openrouter', gmail: 'gmail', 'Google Sheets': 'google-sheets', Google: 'google',
  };
  for (const [texto, esperada] of Object.entries(casos)) assert.equal(marcaDe(texto), esperada, texto);
});

test('marcaDe: textos agregados, ambiguos o sin integración devuelven null (no se adivina)', () => {
  for (const t of ['ledger', 'attachments', 'associations', 'Libro de pedidos y reembolsos', 'Libro económico', 'Libro de reembolsos (Amazon, Walmart, Shopify)',
    'Marketplaces y Shopify (libro de registros)', 'Adjuntos', 'Adjuntos (archivos)', 'Asociaciones ticket–contacto', 'Asociaciones ticket–contacto (HubSpot)',
    'Conversaciones por archivo', 'Tienda CLIENTEX', 'Sin retailer', 'otro', 'Otro', 'Desconocido', '', '   ', 'Amazon y Walmart', 'HubSpot + Zendesk'])
    assert.equal(marcaDe(t), null, JSON.stringify(t));
  for (const v of [null, undefined, 0, {}, [], 'constructor', '__proto__', 'toString']) assert.equal(marcaDe(v), null);
});

test('marcaDe cubre todos los nombres de fuente/canal que muestran las pantallas', () => {
  const con = (obj) => Object.entries(obj);
  // Fuentes de «Datos y fuentes» (clave y nombre mostrado)
  for (const [k, n] of con(NOMBRES_FUENTES)) { const a = marcaDe(k), b = marcaDe(n); assert.ok(a === b || a === null || b === null, `${k}/${n}: ${a}/${b}`); }
  assert.equal(marcaDe('hubspot'), 'hubspot'); assert.equal(marcaDe('excel'), 'excel'); assert.equal(marcaDe('csv'), 'csv'); assert.equal(marcaDe('zendesk'), 'zendesk');
  assert.equal(marcaDe('ledger'), null); assert.equal(marcaDe('attachments'), null); assert.equal(marcaDe('associations'), null);
  // Estado de sincronización (clave y nombre)
  const sync = {hubspot: 'hubspot', zendesk: 'zendesk', csv_conversations: 'csv', ledger: null, tracker: 'excel', amazon: 'amazon', walmart: 'walmart', bestbuy: 'bestbuy', shopify: 'shopify'};
  for (const [k, esperada] of con(sync)) { assert.ok(k in FUENTES_SYNC, k); assert.equal(marcaDe(k), esperada, k); const n = marcaDe(FUENTES_SYNC[k]); assert.ok(n === esperada || (k === 'csv_conversations' && n === null), `${FUENTES_SYNC[k]} -> ${n}`); }
  // Conexiones
  for (const s of ['csv', 'xlsx', 'excel', 'hubspot', 'zendesk']) assert.ok(marcaDe(s), s), assert.equal(marcaDe(nombreFuente(s)), marcaDe(s));
  // Canales y retailers
  for (const m of [NOMBRE_FUGA, NOMBRE_BRECHAS, NOMBRE_RETAILER]) for (const [k, n] of con(m)) { const e = ['amazon', 'walmart', 'shopify', 'bestbuy'].includes(k) ? k : null; assert.equal(marcaDe(k), e, k); assert.equal(marcaDe(n), e, n); }
  // Nombres de las fuentes esperadas (packages/workspace-service/provenance.mjs)
  const prov = readFileSync(join(import.meta.dirname, '../../../packages/workspace-service/provenance.mjs'), 'utf8');
  const etiquetas = Object.fromEntries([...prov.matchAll(/\{key:'(\w+)',label:'([^']+)'\}/g)].map((m) => [m[1], m[2]]));
  assert.ok(Object.keys(etiquetas).length >= 7);
  assert.deepEqual({hubspot: marcaDe(etiquetas.hubspot), associations: marcaDe(etiquetas.associations), csv: marcaDe(etiquetas.csv), ledger: marcaDe(etiquetas.ledger), excel: marcaDe(etiquetas.excel), attachments: marcaDe(etiquetas.attachments), zendesk: marcaDe(etiquetas.zendesk)},
    {hubspot: 'hubspot', associations: null, csv: 'csv', ledger: null, excel: 'excel', attachments: null, zendesk: 'zendesk'});
});

test('datos: cada logo es un único <path> sin scripts, estilos ni referencias; color hex; sin logos inventados', () => {
  const datos = leer('components/ui/brand-marks.data.ts');
  assert.match(datos, /simple-icons/); assert.match(datos, /CC0/); assert.match(datos, /pertenecen a sus/i);
  assert.ok(!/<script|javascript:|onload|onerror|<style|href=|url\(/i.test(datos));
  for (const [clave, m] of Object.entries(MARCAS)) {
    if (m.tipo === 'logo') { assert.match(m.color, /^#[0-9A-F]{6}$/i, clave); assert.match(m.path, /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/, clave); assert.ok(m.path.length > 20, clave); }
    if (m.tipo === 'monograma') assert.match(m.letras, /^[A-Z]{1,2}$/, clave);
  }
  // Sin logo oficial disponible: monograma neutro / icono genérico, nunca un path inventado
  for (const k of ['amazon', 'walmart', 'bestbuy']) assert.equal(MARCAS[k].tipo, 'monograma', k);
  for (const k of ['excel', 'csv']) assert.equal(MARCAS[k].tipo, 'archivo', k);
  for (const k of ['hubspot', 'shopify', 'zendesk']) assert.equal(MARCAS[k].tipo, 'logo', k);
});

// Compila brand-mark.tsx a un módulo temporal para renderizarlo de verdad.
async function cargarComponente() {
  const dir = mkdtempSync(join(tmpdir(), 'bm-'));
  const opts = {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}};
  writeFileSync(join(dir, 'brand-marks.data.mjs'), ts.transpileModule(leer('components/ui/brand-marks.data.ts'), opts).outputText);
  const comp = ts.transpileModule(leer('components/ui/brand-mark.tsx'), opts).outputText.replace("'./brand-marks.data'", "'./brand-marks.data.mjs'").replace('"./brand-marks.data"', '"./brand-marks.data.mjs"');
  writeFileSync(join(dir, 'brand-mark.mjs'), comp);
  // react/jsx-runtime se resuelve desde el árbol del repositorio
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const reactRuntime = pathToFileURL(join(import.meta.dirname, '../../../node_modules/react/jsx-runtime.js')).href;
  writeFileSync(join(dir, 'brand-mark.mjs'), comp.replace(/from ["']react\/jsx-runtime["']/, `from "${reactRuntime}"`));
  return import(pathToFileURL(join(dir, 'brand-mark.mjs')).href);
}

test('componente: tamaño fijo (width=height=tamaño, viewBox 24), accesible, sin scripts', async () => {
  const {BrandMark, BrandBadge, ConMarca} = await cargarComponente();
  for (const clave of Object.keys(MARCAS)) for (const t of [16, 20, 24]) {
    const html = renderToStaticMarkup(h(BrandMark, {marca: clave, 'tamaño': t}));
    assert.match(html, new RegExp(`width="${t}"`)); assert.match(html, new RegExp(`height="${t}"`)); assert.match(html, /viewBox="0 0 24 24"/);
    assert.match(html, /aria-hidden="true"/); assert.ok(!/<script|on\w+=|href=|<style/i.test(html), clave);
    const titulado = renderToStaticMarkup(h(BrandMark, {marca: clave, 'tamaño': t, titulo: 'Origen: ' + clave}));
    assert.match(titulado, /role="img"/); assert.match(titulado, /aria-label="Origen: /); assert.ok(!/aria-hidden/.test(titulado));
  }
  // acepta nombres de fuente; lo desconocido no pinta nada
  assert.match(renderToStaticMarkup(h(BrandMark, {marca: 'Tracker (Excel)'})), /data-marca="excel"/);
  assert.equal(renderToStaticMarkup(h(BrandMark, {marca: 'Libro de pedidos'})), '');
  assert.equal(renderToStaticMarkup(h(BrandMark, {marca: 'constructor'})), '');
  assert.equal(renderToStaticMarkup(h(BrandBadge, {marca: 'ledger'})), '');
  assert.equal(renderToStaticMarkup(h(ConMarca, {marca: 'ledger'}, 'Libro')), 'Libro');
  assert.match(renderToStaticMarkup(h(ConMarca, {marca: 'hubspot'}, 'HubSpot')), /bm-linea.*data-marca="hubspot".*HubSpot/s);
  assert.match(renderToStaticMarkup(h(BrandBadge, {marca: 'shopify'})), /class="bm-badge"/);
});

test('CSS: contenedor 28×28 con borde 1 px y radio 8; el color de marca no entra en tokens ni en CSS', () => {
  const css = leer('components/ui/ui.css');
  const badge = /\.bm-badge\{([^}]*)\}/.exec(css)[1];
  assert.match(badge, /width:28px/); assert.match(badge, /height:28px/); assert.match(badge, /border:1px solid var\(--ui-border\)/); assert.match(badge, /border-radius:8px/);
  const bm = css.slice(css.indexOf('/* BrandMark')); // todo lo que añade BrandMark a ui.css
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(bm), 'colores literales en el CSS de BrandMark');
  for (const m of Object.values(MARCAS)) if (m.tipo === 'logo' && !/^#(.)\1(.)\2(.)\3$/.test(m.color)) for (const f of ['app/globals.css', 'app/ui.css', 'components/ui/ui.css']) assert.ok(!leer(f).toLowerCase().includes(m.color.toLowerCase()), `${m.color} (${m.nombre}) en ${f}`);
});

test('contraste: monocromo en oscuro cuando el color de marca no llega a 3:1; neutros legibles; claro documentado', () => {
  const tinta = '#f4f4f5', secundarioClaro = '#3a3a40', secundarioOscuro = '#d4d4d8';
  for (const [clave, m] of Object.entries(MARCAS)) {
    if (m.tipo !== 'logo') continue;
    const oscuro = contraste(m.color, SUPERFICIE.oscuro);
    assert.equal(monoEnOscuro(m), oscuro < 3, clave);
    assert.ok(contraste(monoEnOscuro(m) ? tinta : m.color, SUPERFICIE.oscuro) >= 3, `${clave} en oscuro`);
  }
  assert.equal(monoEnOscuro(MARCAS.zendesk), true); assert.equal(monoEnOscuro(MARCAS.hubspot), false); assert.equal(monoEnOscuro(MARCAS.shopify), false);
  assert.ok(contraste(secundarioClaro, SUPERFICIE.claro) >= 4.5 && contraste(secundarioOscuro, SUPERFICIE.oscuro) >= 4.5, 'monogramas e iconos de archivo');
  // En claro el logo conserva su color original (un logotipo está exento del contraste mínimo y siempre lleva el nombre al lado):
  // se fija qué marcas quedan por debajo de 3:1 para que un cambio sea consciente.
  const bajos = Object.entries(MARCAS).filter(([, m]) => m.tipo === 'logo' && contraste(m.color, SUPERFICIE.claro) < 3).map(([k]) => k).sort();
  assert.deepEqual(bajos, ['hubspot', 'openrouter', 'shopify', 'supabase', 'whatsapp']);
  for (const [k, m] of Object.entries(MARCAS)) if (m.tipo === 'logo') assert.ok(contraste(m.color, SUPERFICIE.claro) >= 1.9, k);
  assert.match(leer('components/ui/ui.css'), /:root\[data-theme=dark\] \.bm\[data-mono-oscuro\] path\{fill:var\(--ink\)\}/);
});

test('uso: las pantallas con logo importan el componente y los archivos de cliente conservan «use client» en la primera línea', () => {
  const usan = ['connection-health.tsx', 'connection-settings.tsx', 'datos/fuentes-datos.tsx', 'datos/estado-sincronizacion.tsx', 'datos/cobertura-conexiones.tsx', 'datos/economia-resumen.tsx',
    'confianza/confianza-pantalla.tsx', 'confianza/como-se-calculo.tsx', 'gaps/gaps-pantalla.tsx', 'refunds/fuga-partes.tsx', 'refunds/fuga-bloques.tsx', 'refunds/fuga-intensidad.tsx',
    'dinero/partes.tsx', 'workload/carga-pantalla.tsx', 'workspace/shared-filters.tsx', 'map/mapa-pantalla.tsx', 'agente/answer-view.tsx', 'platform/primitives.tsx', 'ui/citation.tsx', 'ui/insight-list.tsx'];
  for (const f of usan) {
    const t = leer('components/' + f);
    assert.match(t, /brand-mark'/, f);
    if (!['ui/insight-list.tsx'].includes(f)) assert.match(t.split('\n')[0], /^(['"])use client\1;?$/, f);
  }
});
