// T46: pruebas de COMPORTAMIENTO del idioma en la capa de presentación. No leen el código: EJECUTAN las funciones de lib/legibilidad, lib/confianza, confianza-modelo, ficha,
// insights, el mapa y los avisos de las notas de tendencias con idioma='en' y fallan si CUALQUIER cadena devuelta lleva español (acentos, palabras comunes, meses en español, claves
// sin resolver); con idioma='es' fallan si aparece inglés o variables sin resolver. Además barren el código: toda función de presentación con traductor/idioma opcional debe recibirlo
// en cada llamada (barrido estático de llamadas, con una lista corta de excepciones justificadas). Las mutaciones que las matan están en ~/vexa-notas-28oct/ingles/T46-NOTAS.md.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {traductor} from '../src/lib/i18n';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {LOCALES} from '../src/lib/formato/idioma.mjs';
import {bloqueFuentes, bloqueFrescura, bloqueVentanas, queNoSabemos, nivelFuente, TXT as TXT_CONF} from '../src/components/confianza/confianza-modelo.mjs';
import {FUENTES, METODOS, CALCULOS, filasSincronizacion, hace, dentroDe, textoError, nombreCalculo, nombreMetodo, nombreFuente} from '../src/lib/legibilidad/sincronizacion.mjs';
import {sello, diaTxt, haceDeIso} from '../src/lib/confianza/sello.mjs';
import {encabezadoFicha} from '../src/lib/legibilidad/ficha.mjs';
import {insightsResumen, insightsProblemas} from '../src/lib/legibilidad/insights.mjs';
import {CATEGORIAS} from '../src/lib/legibilidad/categorias.mjs';
import {fraseCriticosT, avisoCriticosT, avisoDeMeta} from '../src/lib/legibilidad/criticos.mjs';
import {resumenEvidencia, severidadDe} from '../src/lib/legibilidad/hallazgos.mjs';
import {etiquetaBase} from '../src/lib/legibilidad/jerga.mjs';
import {estadoAccion, fraseVigilar} from '../src/lib/legibilidad/brief.mjs';
import {guia, IDS_GUIA, lineaProblemas} from '../src/lib/legibilidad/guias.mjs';
import {textoConversaciones, textoCitas, resumenResultados, avisoTerceros, avisoImporte} from '../src/lib/legibilidad/explorador.mjs';
import {tarjetasFuentes} from '../src/lib/legibilidad/fuentes.mjs';
import {marcasEnIdioma} from '../src/lib/legibilidad/marcas.mjs';
import {etiquetaCausal, textoLegible} from '../src/lib/legibilidad/recomendaciones-vista.mjs';
import {rotuloAuto, avisoAuto} from '../src/lib/legibilidad/titulo-descriptivo.mjs';
import {coberturaTexto, CLAVES_COBERTURA} from '../src/lib/legibilidad/cobertura';
import {motivoEtiqueta, submotivoEtiqueta, tipoCasoEtiqueta, retailerEtiqueta} from '../src/lib/legibilidad/motivos';
import {agregarGeo} from '../../../packages/workspace-service/mapa-problemas.mjs';
import {createTrendsRepository} from '../../../packages/workspace-service/trends.mjs';
import {createIncidencesRepository} from '../../../packages/workspace-service/incidences.mjs';
import {notaDe} from '../src/lib/legibilidad/trad.mjs';

const tEs = traductor('es'), tEn = traductor('en');
const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

// ---------------------------------------------------------------- detectores
/** Español en una salida que debería estar en inglés: acentos, palabras vacías, vocabulario del producto y meses abreviados solo españoles. */
const ES_EN_INGLES = /[áéíóúñ¿¡ü]|\b(hace|de|del|la|las|los|el|sin|con|para|por|una|nunca|pedido|pedidos|libro|consulta|reembolsos?|grupo|único|falló|faltan|cálculo|calculo|días|alerta|atrasada|carga|ene|abr|dic|periódica|hoja|tienda propia|otro)\b/i;
/** Inglés en una salida que debería estar en español (palabras que no existen en español). */
const EN_EN_ESPANOL = /\b(the|of|and|ago(?! \d{4})|with|from|not|without|refunds|orders|never|late|paused|alert|group|single|jan|aug|dec|apr|up to date|manual upload|loaded)\b/i;
/** Variables o claves sin resolver. */
const SIN_RESOLVER = /\{\w+\}|\bundefined\b|\bNaN\b|\[object |^(tr|res|prob|conf|cco|det|mapa|fuga)\.[\w.]+$/;
/** Todas las cadenas hoja de un valor; se omiten las propiedades que son identificadores o datos y no texto de pantalla. */
const OMITIR = new Set(['clave', 'inicioIso', 'finIso', 'corteIso', 'hastaIso', 'actualizadoIso', 'fuenteCruda', 'categoria', 'ahora', 'clase', 'nivel', 'id', 'base', 'key', 'dir', 'mes', 'month']);
export function cadenas(v: unknown, acc: string[] = [], clave = ''): string[] {
  if (typeof v === 'string') { if (!OMITIR.has(clave) && v.trim()) acc.push(v); }
  else if (Array.isArray(v)) v.forEach((x) => cadenas(x, acc, clave));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) cadenas(x, acc, k);
  return acc;
}
/** Quita lo que es dato o nombre propio del producto y puede legítimamente repetirse en ambos idiomas. */
const limpio = (s: string) => s.replace(/\*\*/g, '').replace(/HubSpot|Zendesk|Amazon|Walmart|Shopify|Best Buy|Excel|Tracker|USD|CAD|MXN|SKU/g, '');
export function sinEspanol(valor: unknown): string[] { return cadenas(valor).filter((s) => ES_EN_INGLES.test(limpio(s)) || SIN_RESOLVER.test(s)); }
export function sinIngles(valor: unknown): string[] { return cadenas(valor).filter((s) => EN_EN_ESPANOL.test(limpio(s)) || SIN_RESOLVER.test(s)); }

test('los detectores reconocen español en inglés, inglés en español y variables sin resolver', () => {
  assert.deepEqual(sinEspanol({a: 'Libro de pedidos y reembolsos', b: 'hace 2 h', c: 'Sep 20, 2026', d: 'Orders and refunds ledger', e: '20 ene 2026'}), ['Libro de pedidos y reembolsos', 'hace 2 h', '20 ene 2026']);
  assert.deepEqual(sinIngles({a: 'Orders and refunds ledger', b: 'hace 2 h', c: 'Grupo 1 de 2'}), ['Orders and refunds ledger']);
  assert.deepEqual(sinEspanol(['Hola {n}', 'hello', 'undefined']), ['Hola {n}', 'undefined']);
});

// ---------------------------------------------------------------- fixtures
const AHORA = Date.parse('2026-10-20T12:00:00Z'), HORA = 3600 * 1000;
const iso = (msAntes: number) => new Date(AHORA - msAntes).toISOString();
const fuente = (key: string, method: string, o: Record<string, unknown> = {}) => ({key, method, status: 'ok', lastSuccessAt: iso(2 * HORA), nextRunAt: iso(-2 * HORA), lastNewRecords: 5, dataWatermark: '2026-09-20T00:00:00Z', errorCode: null, expectedEverySeconds: 21600, ...o});
const FRESH = {availability: 'ready',
  sources: [
    fuente('ledger', 'api_poll', {errorCode: 'SYNC_FAILED', status: 'error'}), fuente('tracker', 'sheet_sync'), fuente('hubspot', 'webhook', {errorCode: 'RECONNECT_REQUIRED'}), fuente('zendesk', 'stub', {status: 'never', lastSuccessAt: null}),
    fuente('csv_conversations', 'manual_upload', {expectedEverySeconds: null}), fuente('amazon', 'file_drop', {errorCode: 'RATE_LIMITED', status: 'error'}), fuente('walmart', 'api_poll', {errorCode: 'TIMEOUT', status: 'error'}),
    fuente('bestbuy', 'api_poll', {errorCode: 'CRM_CREDENTIAL_CONFIGURATION_REQUIRED', status: 'error'}), fuente('shopify', 'api_poll', {errorCode: 'ODD_CODE', status: 'error'}), fuente('otra_fuente', 'otro_metodo', {status: 'paused'}),
    fuente('hubspot', 'api_poll', {lastSuccessAt: iso(5 * 60 * 1000), nextRunAt: iso(-20 * 1000), dataWatermark: '2026-12-31', errorCode: 57014}), fuente('amazon', 'api_poll', {lastSuccessAt: iso(30 * 1000), nextRunAt: iso(-3 * 24 * HORA)}),
    fuente('tracker', 'api_poll', {lastSuccessAt: iso(5 * 24 * HORA), nextRunAt: iso(-90 * 60 * 1000), dataWatermark: '2026-01-05T00:00:00Z'})],
  insights: [...Object.keys(CALCULOS), 'calculo_desconocido'].map((insight, i) => ({insight, status: ['ready', 'partial', 'skipped', 'failed'][i % 4], refreshedAt: i === 5 ? null : iso(i * HORA), sourceWatermark: '2026-09-30', rows: 10 + i, pending: i % 3}))};
const FUGA = {titular: {status: 'ok', sinMonto: 3, otrasMonedas: [{currency: 'MXN', n: 2}, {currency: 'CAD', n: 1}]}, todasParciales: true, intensidad: {status: 'ok'}, tracker: {status: 'ok', filasReembolsos: 5, conMonto: 2}, contactoRepetido: {status: 'ok', pctSinVincular: 12.5},
  ventanas: [{canal: 'amazon', tipo: 'refund', completa: false, inicio: '2026-01-01', fin: '2026-06-30', corte: '2026-07-01'}, {canal: 'tienda', tipo: 'order', completa: true, inicio: '2026-02-01', fin: '2026-08-31', corte: '2026-09-02'}, {canal: 'otro', tipo: 'refund', completa: false, inicio: null, fin: null, corte: null}, {canal: 'walmart', tipo: 'refund', completa: false, inicio: '2026-03-01', fin: '2026-07-31', corte: '2026-08-05'}]};
const CARGA = {sla: {status: 'ok', hilos: 10, medibles: 5}, canal: {status: 'ok', derivable: false, conCanal: 3, total: 9}};
const COBERTURA = {sources: [{key: 'zendesk', label: 'Zendesk', loaded: false, status: 'empty'}, {key: 'tracker', label: 'Tracker (Excel)', loaded: false, status: 'empty'}]};
const CATS = ['Order: Spare Parts', 'Warranty: Battery Replacement', 'Shipping: Arrived Late', 'Warranty: Troubleshooting (before deciding)', ...Object.keys(CATEGORIAS).slice(0, 25), 'Marketing: Algo nuevo'];

// ---------------------------------------------------------------- A1: Confianza y Conexiones
for (const idioma of ['en', 'es'] as const) {
  const t = traductor(idioma), malo = idioma === 'en' ? sinEspanol : sinIngles;
  test(`Confianza (${idioma}): fuentes, frescura, ventanas y «qué no sabemos» salen solo en ${idioma}, con todos los métodos, códigos de error y cálculos`, () => {
    const fuentes = bloqueFuentes(FRESH, AHORA, idioma, t), frescura = bloqueFrescura(FRESH, AHORA, idioma, t), ventanas = bloqueVentanas(FUGA, idioma, t);
    const tareas = queNoSabemos({fuga: FUGA, carga: CARGA, cobertura: COBERTURA, frescura: FRESH, ahora: AHORA, idioma, t});
    assert.equal(fuentes.filas.length, FRESH.sources.length); assert.equal(frescura.filas.length, FRESH.insights.length);
    assert.ok(tareas.length >= 8, 'el fixture debe disparar las tareas de «qué no sabemos»: ' + tareas.length);
    for (const [nombre, v] of Object.entries({fuentes, frescura, ventanas, tareas})) assert.deepEqual(malo(v), [], `${nombre} en ${idioma}`);
    if (idioma === 'en') {
      const f0 = fuentes.filas[0];
      assert.equal(f0.nombre, 'Orders and refunds ledger'); assert.equal(f0.metodo, 'Periodic API polling'); assert.equal(f0.exito, '2 h ago'); assert.equal(f0.siguiente, 'in 2 h');
      assert.equal(f0.hasta, 'Sep 20, 2026'); assert.equal(f0.error, 'The last sync failed'); assert.equal(frescura.filas[1].nombre, 'Refunds by SKU, channel and month');
    } else assert.equal(fuentes.filas[0].nombre, 'Libro de pedidos y reembolsos');
  });
}
test('Confianza sin traductor en español es el español canónico que fijan las pruebas existentes (contrato)', () => {
  const b = bloqueFuentes(FRESH, AHORA); assert.equal(b.filas[0].nombre, 'Libro de pedidos y reembolsos'); assert.equal(b.filas[0].exito, 'hace 2 h'); assert.equal(b.filas[0].hasta, '20 sep 2026');
});
test('el nivel de una fuente no depende del idioma', () => { assert.equal(nivelFuente(FRESH.sources[0], AHORA), 'alerta'); });

// ---------------------------------------------------------------- sincronización, sello, fechas
for (const idioma of ['en', 'es'] as const) {
  const t = traductor(idioma), malo = idioma === 'en' ? sinEspanol : sinIngles;
  test(`sincronización y sello (${idioma}): rótulos, antigüedades, fechas y los 12 meses`, () => {
    const salida: unknown[] = [filasSincronizacion(FRESH, AHORA, t)];
    for (const s of [0, 20, 44, 45, 59, 600, 3599, 3600, 7200, 100000, 172799, 172800, 400000]) salida.push(hace(s, t));
    for (const d of [-100, 0, 20, 31, 1800, 3600, 7200, 100000, 172800, 600000]) salida.push(dentroDe(new Date(AHORA + d * 1000).toISOString(), AHORA, t));
    for (const c of [null, 'SYNC_FAILED', 'RECONNECT_REQUIRED', 'RATE_LIMITED', 'TIMEOUT', 57014, 'CRM_CREDENTIAL_CONFIGURATION_REQUIRED', 'XYZ']) salida.push(textoError(c as never, t));
    for (const k of [...Object.keys(CALCULOS), 'x']) salida.push(nombreCalculo(k, t));
    for (const k of Object.keys(METODOS)) salida.push(nombreMetodo(k, t));
    for (const k of Object.keys(FUENTES)) salida.push(nombreFuente(k, t));
    for (let m = 1; m <= 12; m++) salida.push(diaTxt(`2026-${String(m).padStart(2, '0')}-0${(m % 9) + 1}T00:00:00Z`, t));
    for (const clase of ['observed', 'estimated', 'inferred', 'otra']) { const s = sello({clase, fuente: 'Ledger', hasta: '2026-09-20', actualizado: iso(3 * HORA), ahora: AHORA, t}); salida.push([s.claseTxt, s.fuente, s.hasta, s.actualizado, s.texto, s.hastaCorto, s.actualizadoCorto]); }
    const vacio = sello({ahora: AHORA, t}); salida.push([vacio.fuente, vacio.hasta, vacio.actualizado, vacio.texto, vacio.hastaCorto, vacio.actualizadoCorto]);
    salida.push(haceDeIso(iso(HORA), AHORA, t));
    assert.deepEqual(malo(salida), []);
  });
}

// ---------------------------------------------------------------- M2: ficha de problema
for (const idioma of ['en', 'es'] as const) {
  const t = traductor(idioma), malo = idioma === 'en' ? sinEspanol : sinIngles;
  test(`ficha de problema (${idioma}): título (categoría), «Grupo n de m» y «Único grupo` + '»', () => {
    const motivo = (m: string) => (m === 'severity' ? (idioma === 'en' ? 'High severity' : 'Severidad alta') : null);
    const salida = [...CATS.map((label) => encabezadoFicha({label, grupo: {n: 1, de: 2}, critical: {critical: true, signals: 60, reason: 'severity'}}, motivo, t)),
      encabezadoFicha({label: 'Order: Spare Parts', grupo: {n: 1, de: 1}, critical: null}, motivo, t), encabezadoFicha({label: '', grupo: null, critical: null}, motivo, t)];
    assert.deepEqual(malo(salida.filter((h) => h).map((h) => ({categoria: h!.categoria, grupo: h!.grupo, motivo: h!.motivo}))).filter((s) => idioma === 'en' ? !/^Marketing: Algo nuevo$/.test(s) : true), []);
    const h = encabezadoFicha({label: 'Order: Spare Parts', grupo: {n: 1, de: 2}, critical: null}, undefined, t)!;
    assert.equal(h.categoria, idioma === 'en' ? 'Order: Spare Parts' : 'Pedido: Refacciones');
    assert.equal(h.grupo, idioma === 'en' ? 'Group 1 of 2' : 'Grupo 1 de 2');
    assert.equal(encabezadoFicha({label: 'x', grupo: {n: 1, de: 1}, critical: null}, undefined, t)!.grupo, idioma === 'en' ? 'Single group' : 'Único grupo');
  });
}

// ---------------------------------------------------------------- M1: Resumen
const mes = (m: string, o: number) => ({month: m, orders: {count: 2, amountMinor: String(o), unknownAmounts: 1}, refunds: {count: 1, amountMinor: '100', unknownAmounts: 0}});
const TRENDS = {generatedAt: 'x', window: {start: 'a', end: 'b', months: 12}, note: '',
  conversations: {status: 'ok', class: 'observed', series: [{month: '2026-07', count: 80}, {month: '2026-08', count: 100}, {month: '2026-09', count: 150}, {month: '2026-10', count: 9}], outsideWindow: 4, undated: 2, total: null, completeness: {dataThrough: '2026-10-05'}},
  ledger: {status: 'ok', class: 'observed', currency: 'USD', exponent: 2, otherCurrencies: ['CAD', 'MXN'], currencies: ['USD', 'CAD', 'MXN'], series: [mes('2026-08', 100000), mes('2026-09', 150000), mes('2026-10', 1)], completeness: {dataThrough: '2026-10-05'}}};
const CATS_VISTA = {status: 'ok', rows: [{category: 'Order: Spare Parts', count: 40}, {category: 'Shipping: Arrived Late', count: 20}], totals: {incidences: 60, categories: 2, runs: 5}, truncated: false};
for (const idioma of ['en', 'es'] as const) {
  const t = traductor(idioma), malo = idioma === 'en' ? sinEspanol : sinIngles, loc = idioma === 'en' ? LOCALES.en : LOCALES.es;
  test(`Resumen (${idioma}): las tres tarjetas, la categoría principal y los estados vacíos salen solo en ${idioma}`, () => {
    const ahora = new Date('2026-10-21T12:00:00Z');
    const tarjetas = insightsResumen({trends: TRENDS as never, categorias: CATS_VISTA as never, ahora, t, loc});
    const vacias = [insightsResumen({trends: null, categorias: null, ahora, t, loc}), insightsResumen({trends: null, categorias: {status: 'timeout', rows: []} as never, ahora, t, loc}), insightsResumen({trends: null, categorias: {status: 'empty', rows: []} as never, ahora, t, loc})];
    assert.equal(tarjetas.length, 3); assert.ok(!tarjetas[2].vacio);
    assert.deepEqual(malo([tarjetas.map((x) => ({...x, texto: x.texto?.replace(/\*\*/g, '')})), vacias]), []);
    assert.match(tarjetas[2].texto, idioma === 'en' ? /most incidents is \*\*Order: Spare Parts\*\*/ : /es \*\*Pedido: Refacciones\*\*/);
    const probs = insightsProblemas({items: [{id: 'a', title: 'Baterías', evidence: [{id: '1'}], metrics: [{kind: 'exposure', amount_minor: '500000', currency: 'USD', exponent: 2, coverage: {known_n: 4, eligible_n: 5}}]}] as never, moneda: 'USD', t});
    assert.deepEqual(malo(probs.map((x: {fuente?: string; cobertura?: string; razon?: string}) => ({fuente: x.fuente, cobertura: x.cobertura, razon: x.razon}))), []);
  });
}

// ---------------------------------------------------------------- M3: Mapa
test('Mapa: los dos rótulos «sin dato» están en el catálogo y se traducen al pintar sin cambiar el dato del servidor', () => {
  const filas = Array.from({length: 12}, () => ({estado: 'US-TX', tipo: 'standard', tieneDireccion: true, motivo: null, retailer: null}));
  const geo = agregarGeo(filas as never, 5);
  const motivo = geo.estados[0].motivos.items[0].etiqueta, retailer = geo.estados[0].retailers.items[0].etiqueta;
  assert.equal(motivo, 'Sin motivo en la hoja'); assert.equal(retailer, 'Sin retailer'); // el dato del servidor no cambia
  assert.equal(motivoEtiqueta(motivo, tEn as never), 'No reason in the sheet'); assert.equal(retailerEtiqueta(retailer, tEn as never), 'No retailer');
  assert.equal(motivoEtiqueta(motivo, tEs as never), 'Sin motivo en la hoja'); assert.equal(retailerEtiqueta(retailer, tEs as never), 'Sin retailer');
});
test('los catálogos de motivo, submotivo, tipo de caso y retailer salen sin español en inglés y sin inglés en español, rótulo por rótulo', () => {
  const tablas: Array<[string, (r: string, t?: never) => string]> = [['tr.mot.', motivoEtiqueta as never], ['tr.smot.', submotivoEtiqueta as never], ['tr.tcaso.', tipoCasoEtiqueta as never], ['tr.ret.', retailerEtiqueta as never]];
  const NOMBRES_PROPIOS = /^(Amazon|Walmart|Shopify|Best Buy|Lowe’s|Home Depot)$/;
  for (const [prefijo, fn] of tablas) for (const [clave, rotulo] of Object.entries(es)) {
    if (!clave.startsWith(prefijo)) continue;
    const salidaEn = fn(rotulo as string, tEn as never), salidaEs = fn(rotulo as string, tEs as never);
    assert.equal(salidaEn, (en as Record<string, string>)[clave], clave); assert.equal(salidaEs, rotulo, clave);
    if (!NOMBRES_PROPIOS.test(salidaEn)) assert.deepEqual(sinEspanol([salidaEn]), [], 'español en inglés: ' + clave);
  }
});
test('los rótulos de cobertura que arma el servidor salen sin español en inglés (cada clave tr.cov.*)', () => {
  const claves = CLAVES_COBERTURA(); assert.ok(claves.length >= 10);
  for (const clave of claves) {
    const texto = (es as Record<string, string>)[clave].replace(/\{(\w+)\}/g, '12');
    const salida = coberturaTexto(tEn as never, texto); assert.notEqual(salida, texto, clave); assert.deepEqual(sinEspanol([salida]), [], clave);
  }
});

// ---------------------------------------------------------------- notas de tendencias (sin Postgres)
test('trends.mjs e incidences.mjs mandan noteKey con una clave que existe en ambos diccionarios y que traduce la nota (se ejecuta con una base simulada)', async () => {
  const s = {tenantId: '11111111-1111-4111-8111-111111111111', async query(q: string) { return {rows: /statement_timeout/.test(q) ? [{v: '0'}] : /count\(\*\) AS n FROM \(SELECT 1/.test(q) ? [{n: 0}] : []}; }};
  const database = {transaction: async (_m: string, f: (x: typeof s) => unknown) => f(s)};
  const inc = createIncidencesRepository({database} as never);
  const vistas = [await createTrendsRepository({database} as never).monthly(), await inc.categories(), await inc.monthly(), await inc.monthly({problemId: '11111111-1111-4111-8111-111111111111'})] as Array<{noteKey: string; note: string}>;
  assert.deepEqual(vistas.map((v) => v.noteKey), ['tr.nt.tendencias', 'tr.nt.incCategorias', 'tr.nt.incTotal', 'tr.nt.incProblema']);
  for (const v of vistas) {
    assert.ok(v.noteKey in es && v.noteKey in en, v.noteKey); assert.equal(notaDe(tEs as never, v), v.note, 'el español del diccionario es la nota del paquete: ' + v.noteKey);
    assert.deepEqual(sinEspanol([notaDe(tEn as never, v)]), [], v.noteKey); assert.notEqual(notaDe(tEn as never, v), v.note);
    assert.equal(notaDe(null as never, v), v.note, 'sin traductor sale el español del paquete (contrato de otros consumidores)');
  }
});

// ---------------------------------------------------------------- resto de lib/legibilidad
for (const idioma of ['en', 'es'] as const) {
  const t = traductor(idioma), malo = idioma === 'en' ? sinEspanol : sinIngles;
  test(`lib/legibilidad (${idioma}): críticos, hallazgos, jerga, brief, guías, explorador, fuentes, marcas, causal, título automático`, () => {
    const salida: unknown[] = [];
    for (const g of [1, 2, 53]) for (const n of [null, 1, 60]) salida.push(fraseCriticosT(t as never, {grupos: g, senales: n}), avisoCriticosT(t as never, {grupos: g, senales: n}));
    salida.push(avisoDeMeta(t as never, {critical_counts: {groups: 3, signals: 7}}));
    for (const s of ['low', 'medium', 'high', 'critical', 'unknown']) salida.push(severidadDe(s, t as never));
    salida.push(resumenEvidencia({issues: [{category: 'Order: Spare Parts', severity: 'high', evidence: [{}]}, {category: 'x', severity: 'low'}]}, t as never));
    for (const k of ['net', 'gross', 'recorded', 'published_priority', null]) salida.push(etiquetaBase(k as never, t as never));
    for (const s of ['proposed', 'dismissed', 'draft', 'approved', 'executing', 'closed', 'cancelled']) salida.push(estadoAccion(s, t as never));
    for (const id of IDS_GUIA) salida.push(guia(id, t as never));
    salida.push(lineaProblemas(true, t as never), lineaProblemas(false, t as never), lineaProblemas(null, t as never));
    for (const n of [0, 1, 2, 1234]) salida.push(textoConversaciones(n, t as never), textoCitas(n, t as never));
    salida.push(resumenResultados({total: 0, texto: '', estado: 'all'}, t as never), resumenResultados({total: 5, texto: 'x', estado: 'all'}, t as never), avisoTerceros(t as never), avisoImporte(t as never));
    salida.push(tarjetasFuentes({sources: [{key: 'ledger', label: 'L', loaded: true, total: 10, incorporated: 8, rejected: 1, pending: 1}, {key: 'zendesk', label: 'Z', loaded: false}, {key: 'tracker', label: 'T', loaded: true, status: 'timeout'}]}, TRENDS, t as never).map((x) => ({nombre: x.nombre, unidad: x.unidad, rango: x.rango, rangoNota: x.rangoNota, datosHasta: x.datosHasta, ultimaCarga: x.ultimaCarga})));
    salida.push(marcasEnIdioma('Hola [nombre], vive en [dirección] y su dato es [dato personal oculto]', t as never));
    for (const e of ['confirmed', 'rejected', 'unknown_state', 'possible']) salida.push(etiquetaCausal(e, t as never));
    salida.push(rotuloAuto(t as never), avisoAuto(t as never), textoLegible('Hay 3 problemas', t as never));
    salida.push(fraseVigilar({total: 5, listados: 3}, '2026-10-01', (n: number) => fraseCriticosT(t as never, {grupos: n}), t as never), fraseVigilar({total: null, listados: 3}, null, (n: number) => fraseCriticosT(t as never, {grupos: n}), t as never));
    assert.deepEqual(malo(salida).filter((x) => idioma !== 'es' || !/^Hola|^Hay 3/.test(x)), []);
  });
}

// ---------------------------------------------------------------- M4: middleware
test('middleware.ts: el 429 y el modo soporte salen de la tabla mínima por cookie (sin español fijo); código y estado HTTP no cambian', async () => {
  const {MENSAJES_ACCESO} = await import('../src/lib/auth-http');
  assert.equal(MENSAJES_ACCESO.es.limite, 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.'); assert.equal(MENSAJES_ACCESO.es.soporte, 'Modo soporte: solo lectura.');
  assert.deepEqual(sinEspanol(Object.values(MENSAJES_ACCESO.en)), []); assert.deepEqual(sinIngles(Object.values(MENSAJES_ACCESO.es)), []);
  assert.deepEqual(Object.keys(MENSAJES_ACCESO.en).sort(), Object.keys(MENSAJES_ACCESO.es).sort());
  const mw = leer('src/middleware.ts');
  assert.match(mw, /code:'rate_limited',message:MENSAJES_ACCESO\[idiomaDelMiddleware\(request\)\]\.limite,retryable:true\}\},\{status:429/);
  assert.match(mw, /message:MENSAJES_ACCESO\[idiomaDelMiddleware\(request\)\]\.soporte,retryable:false\}\},\{status:403/);
  assert.doesNotMatch(mw.replace(/\/\/.*$/gm, ''), /Demasiadas|solo lectura/);
  const auth = leer('src/lib/auth-http.ts');
  assert.match(auth, /export const idiomaDelMiddleware=\(request:Pick<NextRequest,'cookies'>\):Idioma=>resolverIdioma\(\{cookie:request\.cookies\.get\(COOKIE_IDIOMA\)\?\.value\}\)/);
  const pet = (lang?: string) => ({cookies: {get: (n: string) => (n === 'rovaq_lang' && lang ? {value: lang} : undefined)}}) as never;
  const {idiomaDelMiddleware} = await import('../src/lib/auth-http');
  assert.equal(idiomaDelMiddleware(pet('en')), 'en'); assert.equal(idiomaDelMiddleware(pet('es')), 'es');
});

// ---------------------------------------------------------------- M5: inglés natural
test('inglés natural: «critical signal» sin calco, «quotes» solo para citas textuales y «price quotes» para cotizaciones', () => {
  const e = en as Record<string, string>;
  assert.equal(e['tr.crit.senal1'], '{n} critical signal'); assert.equal(e['tr.crit.senalN'], '{n} critical signals');
  assert.doesNotMatch(Object.entries(e).filter(([k]) => k.startsWith('tr.crit.')).map(([, v]) => v).join('\n'), /piece(s)? of evidence/);
  assert.equal(e['tr.tcaso.quotes'], 'Price quotes'); assert.equal(e['cargador.campo.quoted_amount'], 'Quoted cost');
  assert.equal(e['nav.item.economics'], 'Published cuts', 'unificado a propósito: no se toca');
});

// ---------------------------------------------------------------- barrido de llamadas
const SRC = new URL('../src/', import.meta.url).pathname;
function fuentes(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) { if (!/node_modules|(^|\/)i18n$/.test(p)) fuentes(p, acc); } else if (/\.(tsx|ts|mjs)$/.test(e.name) && !/\.test\.|\.d\.m?ts$/.test(e.name)) acc.push(p);
  }
  return acc;
}
function partirArgs(s: string): string[] {
  const out: string[] = []; let d = 0, cur = '', q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === '\\') cur += s[++i] ?? ''; else if (c === q) q = null; continue; }
    if ('\'"`'.includes(c)) { q = c; cur += c; continue; }
    if ('([{'.includes(c)) d++; if (')]}'.includes(c)) d--;
    if (c === ',' && d === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function cierre(s: string, i: number): number {
  let d = 0, q: string | null = null;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
    if ('\'"`'.includes(c)) { q = c; continue; }
    if (c === '(') d++; else if (c === ')') { d--; if (d === 0) return k; }
  }
  return -1;
}
type Fn = {nombre: string; archivo: string; modulo: string; idxT: number; idxI: number; objT: boolean; objI: boolean};
/** Funciones exportadas de presentación con traductor (t/tr/ctx) o idioma opcional, en lib/legibilidad, lib/confianza y components/confianza. */
export function funcionesConTraductor(): Fn[] {
  const out: Fn[] = [];
  for (const f of fuentes(SRC).filter((x) => /\/(lib\/(legibilidad|confianza)|components\/confianza)\/[^/]+\.mjs$/.test(x))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/export (?:async )?(?:function ([A-Za-z0-9_$]+)\s*\(|const ([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\()/g)) {
      const abre = m.index! + m[0].length - 1, params = partirArgs(src.slice(abre + 1, cierre(src, abre)));
      const idxT = params.findIndex((p) => /^\s*(t|tr|ctx)\s*(=|$|:)/.test(p)), idxI = params.findIndex((p) => /^\s*idioma\s*(=|$)/.test(p));
      const objT = params.some((p) => /^\s*\{[^}]*\b(t|ctx)\b/.test(p)), objI = params.some((p) => /^\s*\{[^}]*\bidioma\b/.test(p));
      if (idxT >= 0 || idxI >= 0 || objT || objI) out.push({nombre: m[1] ?? m[2], archivo: f, modulo: path.basename(f).replace(/\.mjs$/, ''), idxT, idxI, objT, objI});
    }
  }
  return out;
}
/** Llamadas (con el mismo import) que no pasan el traductor o el idioma. */
export function llamadasSinTraductor(): string[] {
  const todas = fuentes(SRC), fns = funcionesConTraductor(), malas: string[] = [];
  for (const fn of fns) for (const f of todas) {
    if (f === fn.archivo) continue;
    const s = fs.readFileSync(f, 'utf8');
    if (!s.includes(fn.nombre) || !new RegExp('import[^;]*\\b' + fn.nombre.replace(/\$/g, '\\$') + '\\b[^;]*from\\s*[\'"][^\'"]*/' + fn.modulo + '(?:\\.mjs)?[\'"]').test(s)) continue;
    const re = new RegExp('(?<![\\w$.])' + fn.nombre.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
    for (let m = re.exec(s); m; m = re.exec(s)) {
      const abre = m.index + m[0].length - 1, fin = cierre(s, abre); if (fin < 0) continue;
      const args = s.slice(abre + 1, fin), n = partirArgs(args).length;
      const conT = fn.idxT >= 0 ? n > fn.idxT || /\b(t|tx|tr|ctx|traductor)\b/.test(args) : fn.objT ? /\b(t|tx|ctx)\b/.test(args) : true;
      const conI = fn.idxI >= 0 ? n > fn.idxI || /\b(idioma|loc)\b/.test(args) : fn.objI ? /\bidioma\b/.test(args) : true;
      // confianza-modelo recibe AMBOS (idioma para su tabla propia y t para las ayudas): se exige el traductor aunque se pase el idioma
      const tieneT = fn.idxT >= 0 || fn.objT, tieneI = fn.idxI >= 0 || fn.objI, bien = tieneT && tieneI && fn.idxT < 0 && fn.idxI < 0 ? conT || conI : tieneT ? conT : conI; // opciones {idioma, t}: basta uno de los dos
      if (!bien || (fn.modulo === 'confianza-modelo' && !conT)) malas.push(`${path.relative(SRC, f)}:${s.slice(0, m.index).split('\n').length} ${fn.nombre}(${args.replace(/\s+/g, ' ').slice(0, 60)})`);
    }
  }
  return malas;
}
/** Llamadas sin traductor que son correctas y por qué (archivo:función → motivo). */
const SIN_TRADUCTOR_JUSTIFICADO: Record<string, string> = {
  'components/hoy/hoy-modelo.mjs sello': 'el sello de Hoy guarda hastaIso/actualizadoIso/fuenteCruda y la pantalla lo vuelve a redactar con el traductor activo (sello trae los datos crudos para eso)',
  'lib/legibilidad/problemas-catalogo.mjs etiquetaCategoria': 'el catálogo de problemas guarda el título canónico en español como clave de coincidencia; la pantalla lo traduce al pintar',
  'lib/legibilidad/meses.mjs variacion': 'comparacionMensual solo expone sinCobertura/parcial a la pantalla; el texto del delta no se pinta (overview-dashboard usa solo .sinCobertura)',
  'lib/legibilidad/resumen-ejecutivo.mjs variacion': 'kpiPedidos no tiene pantalla que lo pinte (sin consumidores .tsx); kpiConversaciones ya pasa el idioma',
  'components/briefs/panel.tsx etiquetaBase': 'es la etiquetaBase de brief.mjs (rankingBasis -> constante), distinta de la de jerga.mjs; la traducción la hace baseLegible con tx',
  'components/workspace/scope-bar.tsx etiquetaBase': 'es el respaldo canónico que etiquetaBaseT(t, clave, canónica) sustituye por la clave del diccionario',
  'components/datos/analisis-hallazgos.tsx resumenEvidencia': 'resumenEvidencia conserva `categoria` original y la pantalla traduce el título al pintar (cambiar de idioma no deja títulos viejos)',
};
test('barrido: toda función de presentación con traductor o idioma opcional lo recibe en cada llamada (excepciones justificadas)', () => {
  const fns = funcionesConTraductor();
  assert.ok(fns.length >= 55, 'el barrido encontró solo ' + fns.length + ' funciones');
  assert.ok(fns.some((f) => f.nombre === 'bloqueFuentes' && f.idxT === 3), 'bloqueFuentes debe declarar el traductor como 4.º parámetro');
  const malas = llamadasSinTraductor().filter((l) => { const m = /^(.+?):\d+ (\w+)\(/.exec(l)!; return !(`${m[1]} ${m[2]}` in SIN_TRADUCTOR_JUSTIFICADO); });
  assert.deepEqual(malas, [], 'llamada sin traductor o idioma: la salida quedaría en español');
});
test('barrido: las excepciones justificadas siguen existiendo (si ya no hay llamada, quítalas)', () => {
  const vivas = new Set(llamadasSinTraductor().map((l) => { const m = /^(.+?):\d+ (\w+)\(/.exec(l)!; return `${m[1]} ${m[2]}`; }));
  for (const [k, motivo] of Object.entries(SIN_TRADUCTOR_JUSTIFICADO)) { assert.ok(motivo.length > 30, k); assert.ok(vivas.has(k), 'excepción sin llamada: ' + k); }
});
test('barrido: las tres pantallas que usan confianza-modelo le pasan el traductor (bloques, ventanas y «qué no sabemos»)', () => {
  const pantalla = leer('src/components/confianza/confianza-pantalla.tsx'), conexiones = leer('src/components/datos/conexiones-resumen.tsx');
  assert.match(pantalla, /bloqueFuentes\(fresh\.data,undefined,idioma,tx\)/); assert.match(pantalla, /bloqueFrescura\(fresh\.data,undefined,idioma,tx\)/);
  assert.match(pantalla, /bloqueVentanas\(fuga\.data,idioma,tx\)/); assert.match(pantalla, /queNoSabemos\(\{[^}]*idioma,t:tx\}\)/);
  assert.match(conexiones, /bloqueFuentes\(f\.data,undefined,idioma,tx\)/);
});
test('barrido: la ficha y la tarjeta de Resumen pasan el traductor a la categoría', () => {
  assert.match(leer('src/components/workspace/problem-sheet.tsx'), /encabezadoFicha\(f,\(m:string\)=>motivoT\(t,m\),t\)/);
  assert.match(leer('src/lib/legibilidad/insights.mjs'), /\*\*\$\{etiquetaCategoria\(top\.category,ctx\?\.t\)\}\*\*[\s\S]*\{cat:etiquetaCategoria\(top\.category,ctx\?\.t\),/);
});
test('TXT de confianza-modelo: español e inglés tienen las mismas claves y las mismas variables', () => {
  assert.deepEqual(Object.keys(TXT_CONF.en).sort(), Object.keys(TXT_CONF.es).sort());
});
