// Traducción grupo E (errores de API y de validación que arma el servidor): paridad es/en de d-tr-e, el idioma lo decide la cookie rovaq_lang
// (inglés por omisión), el `code` estable no cambia y los archivos migrados no vuelven a llevar el texto fijo en español.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trEEs, trEEn} from '../src/lib/i18n/d-tr-e';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {idiomaDePeticion, mensajeError, mensajesDe} from '../src/lib/i18n/errores-api';
import {economicErrorResponse} from '../src/app/api/economics/query';
import {submitBlock} from '../src/lib/analysis-jobs';
import {parseImport, EconomicImportError} from '../src/lib/economic-import/contract';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const variables = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const ES = trEEs as Record<string, string>, EN = trEEn as Record<string, string>;
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const peticion = (valor?: string) => ({cookies: {get: (n: string) => (n === 'rovaq_lang' && valor !== undefined ? {value: valor} : undefined)}});

test('d-tr-e: las claves tr.err.* son idénticas en es y en, sin vacíos, con las mismas {variables}', () => {
  const ke = Object.keys(ES).sort(), kn = Object.keys(EN).sort();
  assert.ok(ke.length > 90, 'diccionario con contenido: ' + ke.length);
  assert.deepEqual(kn.filter((k) => !ke.includes(k)), [], 'claves solo en inglés');
  assert.deepEqual(ke.filter((k) => !kn.includes(k)), [], 'claves solo en español');
  for (const k of ke) {
    assert.ok(k.startsWith('tr.err.'), 'prefijo tr.err.: ' + k);
    assert.ok(ES[k].trim() && EN[k].trim(), 'vacío: ' + k);
    assert.equal(variables(EN[k]), variables(ES[k]), 'variables distintas: ' + k);
    assert.equal((es as Record<string, string>)[k], ES[k], 'es.ts incorpora ' + k);
    assert.equal((en as Record<string, string>)[k], EN[k], 'en.ts incorpora ' + k);
  }
});

test('d-tr-e: el inglés no lleva acentos del español, signos invertidos ni paréntesis, y las cifras entran por {variable}', () => {
  for (const [k, v] of Object.entries(EN)) {
    assert.doesNotMatch(v, /[áéíóúñüÁÉÍÓÚÑÜ¿¡«»]/, 'acento o comillas españolas en inglés: ' + k);
    assert.doesNotMatch(v, /[()]/, 'paréntesis en inglés: ' + k);
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji en inglés: ' + k);
    assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, 'cifra escrita a mano en inglés: ' + k);
  }
  for (const [k, v] of Object.entries(ES)) {
    assert.doesNotMatch(v, /\p{Extended_Pictographic}/u, 'emoji en español: ' + k);
    assert.doesNotMatch(v.replace(/\{\w+\}/g, ''), /(^|[^\w.-])\d{2,}/, 'cifra escrita a mano en español: ' + k);
  }
});

test('errores-api: el idioma sale de la cookie rovaq_lang, inglés por omisión y ante valores inválidos', () => {
  assert.equal(idiomaDePeticion(peticion('es')), 'es');
  assert.equal(idiomaDePeticion(peticion('en')), 'en');
  assert.equal(idiomaDePeticion(peticion()), 'en');
  assert.equal(idiomaDePeticion(peticion('fr')), 'en');
  assert.equal(mensajeError('es', 'tr.err.opFallo'), 'No se pudo completar la operación autorizada.');
  assert.equal(mensajeError('en', 'tr.err.opFallo'), 'The authorized operation could not be completed.');
  const m = mensajesDe(peticion('es'));
  assert.equal(m('tr.err.impSize', {mib: 8}), 'El archivo supera 8 MiB.');
  assert.equal(mensajesDe(peticion())('tr.err.impSize', {mib: 8}), 'The file exceeds 8 MiB.');
});

test('economicErrorResponse: mismo code y estado en ambos idiomas, solo cambia el texto', () => {
  for (const e of [{code: '57014'}, {status: 409, code: 'x_conflict'}, {status: 400, code: 'scope_invalid'}, new Error('boom')]) {
    const a = economicErrorResponse(e, 'es'), b = economicErrorResponse(e, 'en');
    assert.equal(a.status, b.status);
    assert.equal(a.body.error.code, b.body.error.code);
    assert.equal(a.body.error.retryable, b.body.error.retryable);
    assert.notEqual(a.body.error.message, b.body.error.message);
    assert.doesNotMatch(b.body.error.message, /[áéíóúñ]/);
  }
  assert.equal(economicErrorResponse({status: 409}, 'es').body.error.message, 'La versión, identidad o fuente requiere revisión.');
  assert.equal(economicErrorResponse({status: 409}).body.error.message, 'The version, identity or source needs review.');
});

test('submitBlock: español por omisión (pruebas existentes) y el idioma se puede pedir', () => {
  assert.match(submitBlock({ready: true, enabled: false}, true, false)!, /desactivado/);
  assert.match(submitBlock({ready: true, enabled: false}, true, false, 'en')!, /turned off/);
  assert.equal(submitBlock({ready: true, enabled: true}, true, true, 'en'), null);
});

test('importación económica: el error lleva clave para pintarlo en el idioma de la interfaz y el message sigue en español', () => {
  try { parseImport('{', 'x'); assert.fail('debía lanzar'); } catch (e) {
    assert.ok(e instanceof EconomicImportError);
    assert.equal(e.code, 'json');
    assert.equal(e.clave, 'tr.err.impJson');
    assert.equal(e.message, 'El archivo no contiene JSON válido.');
    assert.equal(mensajeError('en', e.clave, e.vars), 'The file does not contain valid JSON.');
  }
});

// Archivos migrados: no queda el texto fijo en español, y toda clave tr.err.* que usan existe en los dos idiomas.
const PROHIBIDOS: Record<string, string[]> = {
  'src/lib/agent/server.ts': ['Inicia sesión para preguntarle', 'Tu rol no tiene acceso'],
  'src/app/api/agent/turn/route.ts': ['Cancelado.', 'No disponible por ahora'],
  'src/app/api/agent/state/route.ts': ['Las respuestas salen de herramientas'],
  'src/app/api/economic-priorities/route.ts': ['La configuración de prioridad', 'No se pudo consultar o guardar'],
  'src/app/api/economics/route.ts': ['Configura el acceso autorizado'],
  'src/app/api/economics/query.ts': ['La consulta tardó', 'requiere revisión', 'Revisa los campos'],
  'src/app/api/problems/[id]/causality/route.ts': ['No se pudo consultar o actualizar'],
  'src/app/api/workspace/mappings/bounded.ts': ['La configuración del servidor'],
  'src/lib/analysis-jobs.ts': ['Falta definir o actualizar', 'El proveedor de IA está desactivado', 'Elige una conversación'],
  'src/lib/economic-snapshots-server.ts': ['La configuración del servidor de snapshots', 'No se pudo consultar o publicar'],
  'src/lib/workspace/detail-server.ts': ['La configuración del servidor de detalle', 'No se pudo consultar el detalle'],
  'src/lib/workspace/server.ts': ['La configuración del servidor del espacio', 'No se pudo consultar el espacio'],
  'src/lib/candidates/server.ts': ['No se pudo completar la gestión'],
  'src/lib/migrations/aliases.ts': ['No se pudo consultar o modificar el alias'],
  'src/lib/recommendations/server.ts': ['Configura el acceso autorizado', 'requiere revisión', 'No se pudo completar la operación'],
  'src/lib/interventions/server.ts': ['Configura el acceso autorizado', 'requiere revisión', 'No se pudo completar la operación'],
  'src/lib/briefs/server.ts': ['Configura el acceso autorizado', 'requiere revisión', 'No se pudo completar la operación'],
  'src/lib/explorer/server.ts': ['Configura el acceso autorizado', 'El cursor o alcance', 'No se pudo completar la consulta'],
  'src/lib/imports/server.ts': ['Configurar PostgreSQL', 'Acceso rechazado'],
  'src/lib/email-auth/server.ts': ['Si la cuenta existe'],
  'src/lib/notifications/server.ts': ['Configura el acceso autorizado', 'La preferencia o la página', 'Configuración disponible en este servidor'],
  'src/lib/notifications/push-server.ts': ['La suscripción cambió', 'No se pudo verificar la suscripción'],
  'src/lib/notifications/delivery-server.ts': ['La política cambió', 'No se pudo verificar la política'],
  'src/lib/problems/server.ts': ['No se pudo consultar o modificar los problemas'],
  'src/lib/connections/settings.ts': ['No se pudo consultar o guardar la configuración'],
  'src/lib/connections/errors.ts': ['La operación de conexiones'],
  'src/lib/economic-import/contract.ts': ['El archivo no contiene', 'Estructura no admitida', 'El ledger contiene', 'Un registro existente'],
  'src/lib/economic-import/runner.ts': ['Validando archivo', 'Carga pausada', 'Tu acceso cambió', 'Todos los registros del archivo'],
};
test('grupo E: los archivos migrados no vuelven a llevar el texto fijo en español', () => {
  for (const [archivo, textos] of Object.entries(PROHIBIDOS)) {
    const codigo = sinComentarios(leer(archivo));
    for (const t of textos) assert.ok(!codigo.includes(t), `${archivo}: reapareció «${t}»`);
  }
});

test('grupo E: toda clave tr.err.* referida en el código existe en español e inglés', () => {
  const usadas = new Set<string>();
  for (const archivo of [...Object.keys(PROHIBIDOS), 'src/components/economic-import-panel.tsx', 'src/components/import-preview.tsx', 'src/components/extraction-panel.tsx']) {
    for (const m of leer(archivo).matchAll(/'(tr\.err\.[\w]+)'/g)) {
      assert.ok(m[1] in ES && m[1] in EN, `${archivo}: falta ${m[1]}`);
      usadas.add(m[1]);
    }
  }
  assert.ok(usadas.size > 80, 'se usan las claves del grupo: ' + usadas.size);
  const sinUso = Object.keys(ES).filter((k) => !usadas.has(k));
  assert.deepEqual(sinUso, [], 'claves sin uso');
});
