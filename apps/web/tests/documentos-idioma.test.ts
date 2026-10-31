// T48: los documentos que se generan para un TERCERO (paquete de evidencia, mensaje de reclamo, borradores, listas y colas) salen en el idioma que elige quien los genera.
// Sin idioma el resultado es el español de siempre, byte a byte; con 'en' no queda español. Las pruebas usan datos sintéticos (DEMO-*).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// @ts-expect-error -- fixture .mjs de pruebas, sin archivo de declaración
import {vistaSintetica as fugaSintetica} from './ui/fuga-sintetico.mjs';
// @ts-expect-error -- fixture .mjs de pruebas, sin archivo de declaración
import {entradasSinteticas} from './ui/brechas-sintetico.mjs';
import {armarVista} from '../../../packages/workspace-service/brechas.mjs';
import * as F from '../src/components/refunds/fuga-archivos.mjs';
import * as G from '../src/components/gaps/gaps-archivos.mjs';
import {generarBorradores, correoProveedor, faqEquipo, listasSkus, campanaCrossSelling, sinPII} from '../../../packages/recommendations/borradores.mjs';
import {rotulosDeDocumento} from '../src/components/i18n/selector-idioma-documento';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const sinEstilo = (t: string) => t.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
const ACENTOS = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
const PALABRAS_ES = /\b(reembolsos?|para|del|los|las|con|sin|hola|gracias|periodo|proveedor|resumen|ingreso|bruto|fuente|libro|pedidos?|líneas|motivo)\b/i;
const sinEspanol = (t: string, que: string) => { const x = sinEstilo(t); assert.doesNotMatch(x, ACENTOS, que + ': acentos o signos del español'); assert.doesNotMatch(x, PALABRAS_ES, que + ': palabras del español'); };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la vista sintética no tiene tipos
type Vista = any;
let memo: Promise<{v: Vista; sku: string}> | null = null;
const datos = () => (memo ??= (fugaSintetica() as Promise<Vista>).then((v: Vista) => ({v, sku: v.skus.top[0].sku as string})));
const REGLAS = rotulosDeDocumento('en');

test('el idioma del documento es independiente del de la pantalla: sin idioma = español de siempre (byte a byte)', async () => {
  const {v, sku} = await datos();
  assert.deepEqual(F.paqueteEvidencia(v, sku), F.paqueteEvidencia(v, sku, 'es'));
  assert.deepEqual(F.paqueteEvidencia(v, sku, 'es', {}), F.paqueteEvidencia(v, sku));
  assert.deepEqual(F.listaWalmart(v), F.listaWalmart(v, 'es')); assert.deepEqual(F.colaVencidos(v), F.colaVencidos(v, 'es'));
  assert.deepEqual(F.mensajeReclamo(v, sku), F.mensajeReclamo(v, sku, 'es'));
  assert.deepEqual(F.paqueteEvidencia(v, sku, 'fr'), F.paqueteEvidencia(v, sku), 'un idioma desconocido cae a español');
  const p = F.paqueteEvidencia(v, sku)!;
  assert.match(p.html.contenido, /<html lang="es">/); assert.match(p.html.contenido, /Lo que este paquete no prueba/); assert.match(p.html.nombre, /^evidencia-/);
  assert.match(p.csv.contenido, /^﻿seccion,clave,valor,detalle/);
  assert.match(F.mensajeReclamo(v, sku)!.cuerpo, /^Hola,/);
});

test('paquete de evidencia en inglés: html lang, títulos, tablas, CSV, nombres de archivo y «lo que no prueba» sin español; mismas cifras', async () => {
  const {v, sku} = await datos();
  const e = F.paqueteEvidencia(v, sku, 'en', REGLAS)!, o = F.paqueteEvidencia(v, sku)!;
  assert.match(e.html.contenido, /<html lang="en">/); assert.match(e.html.contenido, /What this package does not prove/); assert.match(e.html.contenido, /Evidence package · SKU/);
  assert.match(e.html.nombre, /^evidence-.*\.html$/); assert.match(e.csv.nombre, /^evidence-.*\.csv$/);
  assert.match(e.csv.contenido, /^﻿section,key,value,detail/);
  sinEspanol(e.html.contenido, 'paquete html'); sinEspanol(e.csv.contenido, 'paquete csv');
  // Las cifras no dependen del idioma: el mismo número de reembolsos y los mismos importes en centavos.
  const cifras = (t: string) => [...t.matchAll(/\d[\d,.]*/g)].map(m => m[0].replace(/[,.]/g, '')).join('|');
  assert.equal(cifras(e.csv.contenido.split('\n').slice(1).filter(l => /^(summary|channel|month_channel),/.test(l)).join('\n')), cifras(o.csv.contenido.split('\n').slice(1).filter(l => /^(resumen|canal|mes_canal),/.test(l)).join('\n')));
  // Los motivos del Tracker (datos en español) se rotulan en el idioma del documento cuando se pasan las reglas; sin ellas salen como vienen.
  assert.match(F.paqueteEvidencia(v, sku, 'en')!.csv.contenido, /tracker_reason,(Garantía|Defectuoso|Envío)/, 'sin reglas, el dato del Tracker sale tal cual');
});

test('mensaje de reclamo, lista de Walmart y cola de vencidos en inglés', async () => {
  const {v, sku} = await datos();
  const m = F.mensajeReclamo(v, sku, 'en')!;
  assert.match(m.asunto, /^Review of refunds for SKU/); assert.match(m.cuerpo, /^Hello,/); assert.match(m.cuerpo, /Thank you,$/);
  sinEspanol(m.asunto + '\n' + m.cuerpo, 'reclamo');
  const o = F.mensajeReclamo(v, sku)!;
  assert.equal(m.cuerpo.match(/\d[\d,]*/g)!.join('|').replace(/,/g, ''), o.cuerpo.match(/\d[\d,]*/g)!.join('|').replace(/,/g, ''), 'las mismas cifras en los dos idiomas');
  const l = F.listaWalmart(v, 'en'); assert.match(l.nombre, /^skus-to-review-walmart/); assert.match(l.contenido, /rank,sku,walmart_refunds/); sinEspanol(l.contenido, 'lista walmart');
  const c = F.colaVencidos(v, 'en', REGLAS); assert.match(c.nombre, /^queue-denied-refunds/); assert.match(c.contenido, /tracker_row,status,sku,reason,sub_reason,channel/); sinEspanol(c.contenido, 'cola');
  assert.equal(F.listaWalmart(v, 'en').total, F.listaWalmart(v).total); assert.equal(F.colaVencidos(v, 'en').total, F.colaVencidos(v).total);
});

test('«lo que no se sabe» en inglés coincide con el diccionario (tr.fuga.nss0..4) y las reglas de motivos traducen', () => {
  F.NO_SE_SABE_EN.forEach((x: string, i: number) => { assert.equal((en as Record<string, string>)['tr.fuga.nss' + i], x); assert.equal((es as Record<string, string>)['tr.fuga.nss' + i], F.NO_SE_SABE[i]); });
  assert.equal(F.noSeSabe('en'), F.NO_SE_SABE_EN); assert.equal(F.noSeSabe('es'), F.NO_SE_SABE); assert.equal(F.noSeSabe(undefined), F.NO_SE_SABE);
  assert.notEqual(REGLAS.motivo!('Defectuoso'), 'Defectuoso'); assert.equal(REGLAS.motivo!('Rótulo nuevo'), 'Rótulo nuevo'); assert.deepEqual(rotulosDeDocumento('es'), {});
});

test('Brechas de ingreso: archivos en el idioma de la sesión; sin idioma, español de siempre', () => {
  const vEs = armarVista({...entradasSinteticas({}), ahora: new Date('2026-10-23T20:00:00Z')}), vEn = armarVista({...entradasSinteticas({}), ahora: new Date('2026-10-23T20:00:00Z'), idioma: 'en'});
  for (const f of ['csvIngresos', 'csvIntensidad', 'csvRecomendaciones', 'resumenHtml'] as const) assert.deepEqual(G[f](vEs), G[f](vEs, 'es'), f);
  const r = G.resumenHtml(vEn, 'en'); assert.match(r.contenido, /<html lang="en">/); assert.match(r.nombre, /^revenue-gaps-/);
  sinEspanol(r.contenido, 'resumen brechas');
  assert.match(G.csvIngresos(vEn, 'en').contenido, /^﻿rank,sku,family/); assert.match(G.csvIngresos(vEn, 'en').nombre, /^revenue-by-sku/);
  sinEspanol(G.csvIngresos(vEn, 'en').contenido, 'csv ingresos'); sinEspanol(G.csvIntensidad(vEn, 'en').contenido, 'csv intensidad'); sinEspanol(G.csvRecomendaciones(vEn, 'en').contenido, 'csv recomendaciones');
  assert.match(G.resumenHtml(vEs).contenido, /<html lang="es">/); assert.match(G.csvIntensidad(vEs).contenido, /senal_suficiente/);
});

const item = (title: string) => ({title, action: 'Review the packaging with the supplier', rationale: 'There are returns for damage in transit', kind: 'x'});
const entrada = (title: string, extra = {}) => ({item: item(title), responsableNombre: 'Ana Pérez', fechaCompromiso: '2026-10-30', periodo: {inicio: '2026-10-01', fin: '2026-11-01'}, generadoEn: '2026-10-23T10:00:00Z',
  citas: [{role: 'customer', category: 'Return: Defective Product', quote: 'Write me at juan.perez@correo.com or +52 55 1234 5678, the box broke'}],
  skus: [{sku: 'SKU-A', canal: 'walmart', n: 7, usdBrutoMinor: '123456'}, {sku: 'SKU-B', canal: 'amazon', n: 3, usdBrutoMinor: '999'}], ...extra });

test('borradores: sin idioma = español; con idioma «en» todo el texto fijo, nombres de archivo y avisos salen en inglés', () => {
  const base = entrada('Return: Defective Product');
  assert.deepEqual(generarBorradores(base), generarBorradores({...base, idioma: 'es'} as never));
  const r = generarBorradores({...base, idioma: 'en', responsableNombre: 'Ana Perez'} as never);
  assert.equal(r.tipo, 'proveedor'); assert.equal(r.enviado, false);
  for (const a of r.archivos) sinEspanol(a.contenido, a.id);
  assert.deepEqual(r.archivos.map(a => a.nombre.split('-202')[0]), ['supplier-email-return-defective-product', 'supplier-email-return-defective-product', 'team-faq-return-defective-product', 'team-faq-return-defective-product', 'skus-to-review-walmart', 'skus-to-review-amazon']);
  const md = r.archivos.find(a => a.id === 'correo-proveedor-md')!.contenido;
  assert.match(md, /DRAFT: nothing has been sent/); assert.match(md, /Hello,/); assert.match(md, /In the period 2026-10-01 to 2026-11-01/);
  assert.match(r.archivos.find(a => a.id === 'correo-proveedor-html')!.contenido, /<html lang="en">/);
  assert.match(r.archivos.find(a => a.id === 'skus-walmart')!.contenido, /^﻿rank,sku,refunds,usd_refunded,note/);
  const todo = r.archivos.map(a => a.contenido).join('\n');
  assert.doesNotMatch(todo, /juan\.perez|@correo|1234 5678/); assert.match(todo, /\[email omitted\]/); assert.match(todo, /\[phone omitted\]/);
  assert.doesNotMatch(sinEstilo(todo), /margin|profit/i);
  // aviso cuando no hay SKUs: en el idioma del documento
  assert.match(generarBorradores({...base, skus: [], idioma: 'en'} as never).avisos[0], /^There are no SKUs identified/);
  assert.match(generarBorradores({...base, skus: []}).avisos[0], /^No hay SKUs identificados/);
  // campaña de venta cruzada
  const c = generarBorradores({...entrada('Pre-sale: Recommendation'), responsableNombre: 'Ana Perez', idioma: 'en'} as never);
  assert.equal(c.tipo, 'cross_sell'); const camp = c.archivos.find(a => a.id === 'campana-cross-md')!; assert.match(camp.nombre, /^cross-selling-campaign-/); sinEspanol(camp.contenido, 'campaña');
});

test('borradores: las marcas de datos de terceros y los textos por omisión también salen en el idioma del documento', () => {
  assert.equal(sinPII('hola [nombre] en [dirección] y [dato personal oculto]', 'en'), 'hola [name] en [address] y [personal data hidden]');
  assert.equal(sinPII('a@b.co'), '[correo omitido]'); assert.equal(sinPII('a@b.co', 'en'), '[email omitted]');
  const sinResp = correoProveedor({...entrada('Other: Something'), responsableNombre: undefined, fechaCompromiso: undefined, periodo: undefined, idioma: 'en'} as never);
  assert.match(sinResp[1].contenido, /Owner to be confirmed/); assert.match(sinResp[1].contenido, /the period of the selected scope/); assert.match(sinResp[1].contenido, /reply by a date to be defined/);
  const sinRespEs = correoProveedor({...entrada('Other: Something'), responsableNombre: undefined, fechaCompromiso: undefined, periodo: undefined} as never);
  assert.match(sinRespEs[1].contenido, /Responsable por confirmar/); assert.match(sinRespEs[1].contenido, /periodo del alcance seleccionado/);
  for (const f of [faqEquipo, listasSkus, campanaCrossSelling]) assert.ok(f.length === 1);
});

test('pantallas: cada descarga recibe el idioma del documento (selector) o el de la sesión; el selector es una lista rotulada', () => {
  const fuga = leer('src/components/refunds/fuga-pantalla.tsx');
  assert.match(fuga, /paqueteEvidencia\(v,sku,idiomaDoc,rotulosDeDocumento\(idiomaDoc\)\)/);
  assert.match(fuga, /listaWalmart\(v,idiomaDoc\)/); assert.match(fuga, /colaVencidos\(v,idiomaDoc,rotulosDeDocumento\(idiomaDoc\)\)/);
  assert.match(fuga, /<SelectorIdiomaDocumento valor=\{idiomaDoc\} onChange=\{setIdiomaDoc\}\/>/);
  const rec = leer('src/components/hoy/paquete-reclamo.tsx');
  assert.match(rec, /paqueteEvidencia\(fuga,sku,idiomaDoc,rotulosDeDocumento\(idiomaDoc\)\)/); assert.match(rec, /mensajeReclamo\(fuga,sku,idiomaDoc\)/); assert.match(rec, /\[fuga,sku,idiomaDoc\]/);
  assert.match(rec, /<SelectorIdiomaDocumento valor=\{idiomaDoc\} onChange=\{setIdiomaDoc\}\/>/);
  const bor = leer('src/components/recommendations/flujo-borradores.tsx');
  assert.match(bor, /idioma:idiomaDoc,t:traductor\(idiomaDoc\)/); assert.match(bor, /\[estado,idiomaDoc,item,miembros\]/); assert.match(bor, /<SelectorIdiomaDocumento valor=\{idiomaDoc\} onChange=\{setIdiomaDoc\}\/>/);
  const gaps = leer('src/components/gaps/gaps-pantalla.tsx');
  for (const f of ['resumenHtml', 'csvIngresos', 'csvIntensidad', 'csvRecomendaciones']) assert.match(gaps, new RegExp(`bajarArchivo\\(${f}\\(v,idioma\\)\\)`));
  const sel = leer('src/components/i18n/selector-idioma-documento.tsx');
  assert.match(sel, /<label htmlFor=\{id\}/); assert.match(sel, /<select id=\{id\} value=\{valor\}/); assert.match(sel, /useState<Idioma \| null>\(null\)/);
  assert.match(sel, /elegido \?\? sesion/, 'por omisión el idioma de la sesión');
  assert.equal((es as Record<string, string>)['tr.doc.idioma'], 'Idioma del documento'); assert.equal((en as Record<string, string>)['tr.doc.idioma'], 'Document language');
});

test('exportes por petición: usan el idioma de la petición (cookie o navegador), no uno fijo', () => {
  assert.match(leer('src/lib/briefs/server.ts'), /briefHtml\(data,idiomaDePeticion\(request\)/);
  assert.match(leer('src/app/(app)/(workspace)/cfo/data/export/route.ts'), /loadReport\(r\.access, idiomaDePeticion\(request\)\)/);
  assert.match(leer('src/components/agente/answer-view.tsx'), /answerToHtml\(\{question,answer:a,userContext,idioma\}\)/);
  assert.match(leer('src/components/agente/answer-view.tsx'), /answerToMarkdown\(\{question,answer:a,idioma\}\)/);
  assert.match(leer('src/app/api/agent/turn/route.ts'), /idioma=idiomaDePeticion\(request\)/);
});
