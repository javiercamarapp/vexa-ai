import test from 'node:test';
import assert from 'node:assert/strict';
import {puedeDecidir, validarAprobacion, validarAjuste, validarDescarte, validarResultado, etapaActual, accionesPermitidas, construirLinea, pasosEtapa, comparacionAntesDespues, prioridadVigente, fechaValida, ROTULO_ASOCIACION} from '../flujo.mjs';
import {generarBorradores, sinPII, tipoDeRecomendacion} from '../borradores.mjs';

const U = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const item = (o = {}) => ({status: 'proposed', priority: 'high', stale: false, history: [{version: 1, status: 'proposed', reason: 'Propuesta condicionada generada desde evidencia autorizada.', actorId: U(1), createdAt: '2026-10-20T10:00:00.000Z'}], title: 'Return: Defective Product', action: 'Pedir al proveedor revisar el lote del modelo con más reembolsos.', rationale: 'Por qué: 12 citas autorizadas en 2 categorías.', ...o});
const ev = (kind, o = {}) => ({id: kind + '1', kind, recommendationVersion: 1, actorId: U(2), ownerId: null, dueDate: null, priority: null, outcome: null, note: null, comment: null, interventionId: null, comparison: null, createdAt: '2026-10-21T10:00:00.000Z', ...o});

test('roles: solo owner, analyst y operator deciden; viewer solo lee', () => {
  for (const r of ['owner', 'analyst', 'operator']) assert.equal(puedeDecidir(r), true);
  for (const r of ['viewer', '', null, undefined, 'admin']) assert.equal(puedeDecidir(r), false);
  const a = accionesPermitidas({item: item(), eventos: [], rol: 'viewer'});
  assert.equal(a.proceder.permitido, false); assert.match(a.proceder.motivo, /consultar/);
  assert.equal(accionesPermitidas({item: item(), rol: 'analyst'}).proceder.permitido, true);
});

test('aprobación: exige responsable y fecha válidos', () => {
  const ahora = new Date('2026-10-23T12:00:00Z');
  assert.deepEqual(validarAprobacion({ownerId: U(3), dueDate: '2026-10-30'}, ahora), []);
  assert.equal(validarAprobacion({ownerId: 'x', dueDate: '2026-10-30'}, ahora)[0].campo, 'ownerId');
  assert.equal(validarAprobacion({ownerId: U(3), dueDate: '2026-10-22'}, ahora)[0].campo, 'dueDate');
  assert.equal(fechaValida('2026-02-31', ahora), false);
  assert.equal(fechaValida('2026-10-23', ahora), true);
  assert.equal(fechaValida('2030-01-01', ahora), false);
});

test('ajuste y descarte: comentario o motivo obligatorios', () => {
  const ok = {action: 'a'.repeat(25), rationale: 'r'.repeat(25), preconditions: ['una condición clara'], ownerId: null, priority: 'normal', comment: 'Cambio el alcance al lote de octubre.'};
  assert.deepEqual(validarAjuste(ok), []);
  assert.equal(validarAjuste({...ok, comment: 'corto'}).some(e => e.campo === 'comment'), true);
  assert.equal(validarAjuste({...ok, comment: ''}).some(e => e.campo === 'comment'), true);
  assert.equal(validarAjuste({...ok, priority: 'urgente'}).some(e => e.campo === 'priority'), true);
  assert.equal(validarDescarte({reason: ''}).length, 1);
  assert.equal(validarDescarte({reason: 'Ya se corrigió con el proveedor el mes pasado.'}).length, 0);
  assert.equal(validarResultado({outcome: 'maybe', note: 'x'}).length, 2);
  assert.equal(validarResultado({outcome: 'partial', note: 'Bajaron los reembolsos del modelo, falta otro lote.'}).length, 0);
});

test('etapas: solo con eventos reales; lo aprobado no admite ajustar ni descartar', () => {
  assert.equal(etapaActual(item(), []), 'propuesta');
  const ajustada = item({history: [...item().history, {version: 2, status: 'proposed', reason: 'Se acota la acción al lote.', actorId: U(2), createdAt: '2026-10-21T10:00:00.000Z'}]});
  assert.equal(etapaActual(ajustada, []), 'ajustada');
  assert.equal(etapaActual(item(), [ev('approved')]), 'aprobada');
  assert.equal(etapaActual(item(), [ev('approved'), ev('started')]), 'en_curso');
  assert.equal(etapaActual(item(), [ev('approved'), ev('started'), ev('resolved')]), 'resultado');
  assert.equal(etapaActual(item({status: 'dismissed'}), []), 'descartada');
  const a = accionesPermitidas({item: item(), eventos: [ev('approved')], rol: 'owner'});
  assert.equal(a.ajustar.permitido, false); assert.equal(a.descartar.permitido, false); assert.equal(a.iniciar.permitido, true); assert.equal(a.resultado.permitido, true);
  assert.equal(accionesPermitidas({item: item(), rol: 'owner'}).resultado.permitido, false);
  assert.equal(accionesPermitidas({item: item({stale: true}), rol: 'owner'}).proceder.permitido, false);
  assert.equal(accionesPermitidas({item: item(), rol: 'owner', flujoDisponible: false}).proceder.permitido, false);
  const pasos = pasosEtapa('en_curso'); assert.deepEqual(pasos.map(p => p.estado), ['done', 'done', 'current', 'todo']);
});

test('línea de tiempo: quién y cuándo, ordenada, sin duplicar el ajuste', () => {
  const it = item({history: [...item().history, {version: 2, status: 'proposed', reason: 'Se acota la acción al lote de octubre.', actorId: U(2), createdAt: '2026-10-21T09:00:00.000Z'}]});
  const l = construirLinea({item: it, eventos: [ev('adjusted', {recommendationVersion: 2, priority: 'critical', comment: 'Sube a urgente por riesgo.', createdAt: '2026-10-21T09:00:01.000Z'}), ev('approved', {id: 'a1', recommendationVersion: 2, ownerId: U(3), dueDate: '2026-10-30', createdAt: '2026-10-22T09:00:00.000Z'})], nombre: id => 'P' + id.slice(-1)});
  assert.deepEqual(l.map(x => x.titulo), ['Propuesta', 'Ajustada', 'Aprobada']);
  assert.equal(l[1].quien, 'P2'); assert.match(l[1].detalle, /urgente/i); assert.match(l[2].detalle, /2026-10-30/);
  assert.equal(prioridadVigente(it, [ev('adjusted', {priority: 'critical'})]), 'critical'); assert.equal(prioridadVigente(it, []), 'high');
});

test('antes/después: solo con dato observado en ambos periodos y siempre rotulado como asociación', () => {
  assert.equal(comparacionAntesDespues(null), null);
  assert.equal(comparacionAntesDespues({status: 'unavailable', baselineAmountMinor: '100', postAmountMinor: '50'}), null);
  assert.equal(comparacionAntesDespues({status: 'partial', baselineAmountMinor: '100', postAmountMinor: null, postKnownSubtotalMinor: null}), null);
  const c = comparacionAntesDespues({status: 'complete', currency: 'USD', exponent: 2, baselineAmountMinor: '120000', postAmountMinor: '90000', reasons: [], baselineSnapshotId: 'a', postSnapshotId: 'b'});
  assert.equal(c.deltaMinor, '-30000'); assert.equal(c.rotulo, ROTULO_ASOCIACION); assert.match(c.rotulo, /no causa/); assert.equal(c.completa, true);
  assert.equal(comparacionAntesDespues({status: 'partial', currency: 'USD', exponent: 2, baselineKnownSubtotalMinor: '10', postKnownSubtotalMinor: '4'}).completa, false);
});

test('borradores: sin PII, sin margen/utilidad, sin envío, y avisan cuando no hay SKUs', () => {
  const entrada = {item: item({title: 'Return: Defective Product'}), responsableNombre: 'Ana Pérez', fechaCompromiso: '2026-10-30', periodo: {inicio: '2026-10-01', fin: '2026-11-01'}, generadoEn: '2026-10-23T10:00:00Z',
    citas: [{role: 'customer', category: 'Return: Defective Product', quote: 'Escríbeme a juan.perez@correo.com o al +52 55 1234 5678, se rompió la caja'}],
    skus: [{sku: 'SKU-A', canal: 'walmart', n: 7, usdBrutoMinor: '123456'}, {sku: 'SKU-B', canal: 'amazon', n: 3, usdBrutoMinor: '999'}, {sku: 'SKU-C', canal: 'walmart', n: 9, usdBrutoMinor: '500000'}]};
  const r = generarBorradores(entrada);
  assert.equal(r.enviado, false); assert.equal(r.tipo, 'proveedor');
  const nombres = r.archivos.map(a => a.nombre);
  assert.ok(nombres.some(n => /^correo-proveedor.*\.html$/.test(n)) && nombres.some(n => /^faq-equipo.*\.md$/.test(n)) && nombres.some(n => /^skus-a-revisar-walmart.*\.csv$/.test(n)) && nombres.some(n => /^skus-a-revisar-amazon/.test(n)));
  assert.ok(!nombres.some(n => /cross/.test(n)));
  const todo = r.archivos.map(a => a.contenido).join('\n');
  assert.doesNotMatch(todo, /juan\.perez|@correo|1234 5678/);
  assert.doesNotMatch(todo.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, ''), /margen|utilidad|profit|margin/i);
  assert.match(todo, /no se ha enviado nada/i);
  const walmart = r.archivos.find(a => a.id === 'skus-walmart').contenido; assert.ok(walmart.indexOf('SKU-C') < walmart.indexOf('SKU-A'), 'ordenado por importe');
  const sin = generarBorradores({...entrada, skus: []});
  assert.equal(sin.archivos.some(a => a.formato === 'CSV'), false); assert.match(sin.avisos[0], /No hay SKUs/);
  const cross = generarBorradores({...entrada, item: item({title: 'Pre-sale: Recommendation'})});
  assert.equal(cross.tipo, 'cross_sell'); assert.ok(cross.archivos.some(a => /cross-selling/.test(a.nombre)));
  assert.equal(tipoDeRecomendacion({title: 'Algo'}), 'general');
  assert.doesNotMatch(sinPII('mi correo es a.b@c.mx y mi tel 55 1234 5678 9'), /@|5678/);
});
