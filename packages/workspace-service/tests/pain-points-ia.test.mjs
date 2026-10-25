// Triple análisis de IA (L4) con PROVEEDOR SIMULADO: nada llama a un proveedor real ni gasta dinero.
//   node --test packages/workspace-service/tests/pain-points-ia.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPainAiService, consenso, construirEntrada, extraerJson, validarLectura, pareceTenerPII, usdTxt, LECTURAS, PROMPT_VERSION, ESTIMADO_POR_LECTURA_MICRO} from '../pain-points-ia.mjs';
import {crearProveedorReal, iaHabilitada} from '../pain-points-ia-proveedor.mjs';
import {almacenMemoria, jsonLectura, proveedorSimulado, vistaSimulada} from './ia-ayudas.mjs';

const mk = (o = {}) => {
  const store = o.store ?? almacenMemoria(o.memoria), provider = 'provider' in o ? o.provider : proveedorSimulado(o.sim), vista = o.vista ?? vistaSimulada();
  const svc = createPainAiService({store, provider, vista: async () => vista, evidencia: o.evidencia ?? null, now: () => new Date('2026-10-24T12:00:00Z')});
  return {svc, store, provider, vista};
};

test('acuerdo: tres lecturas, cada una con su rol y su prompt; consenso determinista; todo es Inferido', async () => {
  const {svc, provider, store} = mk({sim: {respuestas: {causa_raiz: jsonLectura('causa_raiz', {sev: 'alta'}), impacto: jsonLectura('impacto', {sev: 'alta'}), accion: jsonLectura('accion', {sev: 'alta'})}}});
  const r = await svc.analizar({id: 'P2'});
  assert.equal(provider.llamadas.length, 3);
  assert.deepEqual(provider.llamadas.map(l => l.rol), ['causa_raiz', 'impacto', 'accion']);
  assert.equal(new Set(provider.llamadas.map(l => l.sistema)).size, 3, 'prompts distintos por rol');
  for (const l of provider.llamadas) { assert.match(l.sistema, /ROL:/); assert.match(l.usuario, /<DATOS>/); assert.match(l.sistema, /INFERENCIA/); }
  assert.equal(r.actual.estado, 'completo');
  assert.equal(r.actual.consenso.estado, 'acuerdo');
  assert.equal(r.actual.consenso.tono, 'ok');
  assert.equal(r.actual.consenso.severidad, 'alta');
  assert.equal(r.actual.consenso.confianza, 0.7);
  assert.ok(r.actual.lecturas.every(l => l.clase === 'inferred' && l.contenido.clase === 'inferred'), 'la salida de IA es siempre Inferido');
  assert.equal(r.clase, 'inferred'); assert.equal(r.ingreso, 'bruto');
  assert.equal(r.resultado.reutilizado, false); assert.equal(r.resultado.nuevas, 3); assert.equal(r.resultado.costoMicro, 300_000);
  // CONSULTA antes y REGISTRO después, por lectura y en ese orden
  const ev = store.eventos.filter(e => e[0] !== 'guardar').map(e => e[0]);
  assert.deepEqual(ev, ['reservar', 'liquidar', 'reservar', 'liquidar', 'reservar', 'liquidar']);
  assert.equal((await store.presupuesto()).usedMicro, 300_000);
});

test('acción recomendada: solo propuesta con evidencia, sin ejecución automática (aunque el modelo la pida)', async () => {
  const o = JSON.parse(jsonLectura('accion')); o.propuesta.ejecucion = 'automatica'; o.ejecutar = true;
  const {svc} = mk({sim: {respuestas: {accion: JSON.stringify(o)}}});
  const r = await svc.analizar({id: 'P2'});
  const a = r.actual.lecturas.find(l => l.rol === 'accion').contenido;
  assert.equal(a.propuesta.ejecucion, 'ninguna_hasta_orden');
  assert.ok(a.propuesta.evidencia.length > 0 && a.propuesta.pasos.length > 0);
  assert.equal('ejecutar' in a, false);
});

test('desacuerdo: baja la confianza y no inventa una severidad; parcial: un nivel de diferencia', async () => {
  const des = mk({sim: {respuestas: {causa_raiz: jsonLectura('causa_raiz', {sev: 'alta'}), impacto: jsonLectura('impacto', {sev: 'baja'}), accion: jsonLectura('accion', {sev: 'media'})}}});
  const d = (await des.svc.analizar({id: 'P2'})).actual.consenso;
  assert.equal(d.estado, 'desacuerdo'); assert.equal(d.tono, 'bad'); assert.equal(d.severidad, null); assert.deepEqual(d.rango, ['baja', 'alta']);
  assert.equal(d.confianza, 0.35); assert.equal(d.discrepancias.length, 3);
  const par = mk({sim: {respuestas: {causa_raiz: jsonLectura('causa_raiz', {sev: 'alta'}), impacto: jsonLectura('impacto', {sev: 'alta'}), accion: jsonLectura('accion', {sev: 'media'})}}});
  const p = (await par.svc.analizar({id: 'P2'})).actual.consenso;
  assert.equal(p.estado, 'acuerdo_parcial'); assert.equal(p.tono, 'warn'); assert.equal(p.confianza, 0.52);
  assert.ok(d.confianza < p.confianza && p.confianza < 0.7, 'a más discrepancia, menos confianza');
});

test('la confianza nunca pasa de 0.85 aunque el modelo diga 1.0 (todo es Inferido)', () => {
  const l = r => ({rol: r, estado: 'ok', contenido: {severidad: 'alta', confianza: 1}});
  assert.equal(consenso([l('causa_raiz'), l('impacto'), l('accion')]).confianza, 0.85);
});

test('tope agotado A MITAD: dos lecturas se guardan, la tercera NO se llama, se avisa y nada falla en silencio', async () => {
  const {svc, provider, store} = mk({memoria: {usado: 4_750_000}});
  const r = await svc.analizar({id: 'P2'});
  assert.equal(provider.llamadas.length, 2, 'la tercera no sale');
  assert.equal(r.resultado.tope, true); assert.equal(r.resultado.nuevas, 2);
  assert.equal(r.actual.estado, 'parcial'); assert.equal(r.actual.lecturas.length, 2);
  assert.notEqual(r.actual.consenso.estado, 'sin_lecturas'); assert.equal(r.actual.consenso.completo, false);
  assert.ok(r.actual.consenso.confianza <= 0.7 * 0.7 + 0.01, 'incompleto baja la confianza');
  assert.equal(store.eventos.filter(e => e[0] === 'reservar').length, 3, 'la tercera SÍ consultó el ledger y rebotó');
  assert.ok((await store.presupuesto()).usedMicro <= 5_000_000);
});

test('tope agotado de entrada: no llama, no guarda, dice «tope» y muestra la última lectura guardada', async () => {
  const store = almacenMemoria();
  const previa = mk({store});
  await previa.svc.analizar({id: 'P2'}); // corrida previa con otro corte
  const vista2 = vistaSimulada(); vista2.puntos.find(p => p.id === 'P2').corte = '2026-10-23T00:00:00.000Z';
  const agotado = almacenMemoria({usado: 5_000_000}); agotado.runs = store.runs; agotado.ultimoRun = store.ultimoRun; agotado.buscarRun = store.buscarRun;
  const {svc, provider} = mk({store: agotado, vista: vista2});
  const r = await svc.analizar({id: 'P2'});
  assert.equal(provider.llamadas.length, 0);
  assert.equal(r.resultado.tope, true); assert.equal(r.topeAlcanzado, true); assert.equal(r.actual, null);
  assert.ok(r.ultima && r.ultima.esActual === false && r.ultima.lecturas.length === 3, 'se muestra la última lectura guardada, rotulada como no actual');
  assert.equal(agotado.eventos.some(e => e[0] === 'guardar'), false);
});

test('idempotencia: repetir (punto, corte, versión) no llama ni cobra; solo se completan las lecturas faltantes', async () => {
  const {svc, provider, store} = mk();
  await svc.analizar({id: 'P2'});
  const gastoAntes = (await store.presupuesto()).usedMicro;
  const otra = await svc.analizar({id: 'P2'});
  assert.equal(otra.resultado.reutilizado, true); assert.equal(provider.llamadas.length, 3); assert.equal((await store.presupuesto()).usedMicro, gastoAntes);
  assert.equal(store.runs.size, 1);
  // corte nuevo => corrida nueva
  const v2 = vistaSimulada(); v2.puntos.find(p => p.id === 'P2').corte = '2026-10-23T00:00:00.000Z';
  const m2 = mk({store, vista: v2, provider}); await m2.svc.analizar({id: 'P2'});
  assert.equal(store.runs.size, 2);
  // versión de prompt es parte de la clave
  assert.equal(PROMPT_VERSION, 'pp-ia-v1');
  assert.ok([...store.runs.keys()].every(k => k.endsWith('|' + PROMPT_VERSION)));
});

test('JSON inválido del modelo: lectura «invalido» (se cobra lo gastado), consenso incompleto y el reintento solo repite esa lectura', async () => {
  const sim = proveedorSimulado({respuestas: {impacto: 'lo siento, no puedo responder en JSON'}});
  const {svc, store} = mk({provider: sim});
  const r = await svc.analizar({id: 'P2'});
  const imp = r.actual.lecturas.find(l => l.rol === 'impacto');
  assert.equal(imp.estado, 'invalido'); assert.equal(imp.motivoInvalido, 'json_invalido'); assert.equal(imp.costoMicro, 100_000);
  assert.equal(r.resultado.invalidas, 1); assert.equal(r.actual.estado, 'parcial');
  assert.equal((await store.presupuesto()).usedMicro, 300_000, 'las tres llamadas se cobraron');
  const antes = sim.llamadas.length;
  const bueno = proveedorSimulado();
  const m = mk({store, provider: bueno});
  const r2 = await m.svc.analizar({id: 'P2'});
  assert.deepEqual(bueno.llamadas.map(l => l.rol), ['impacto'], 'solo la inválida se reintenta');
  assert.equal(r2.actual.estado, 'completo'); assert.equal(r2.actual.lecturas.find(l => l.rol === 'impacto').intento, 2);
  assert.ok(antes === 3 && [...store.gasto.keys()].some(k => k.endsWith('|impacto|2')));
});

test('validación de salida: formas inválidas, PII en la salida y montos no sustentados se rechazan', () => {
  const entrada = '{"dinero":"USD 4,567.00 (ingreso bruto)"}';
  const ok = jsonLectura('impacto', {monto: '$4,567.00'});
  assert.equal(validarLectura('impacto', ok, entrada).ok, true, 'cita una cifra que sí recibió');
  assert.equal(validarLectura('impacto', jsonLectura('impacto', {monto: 'USD 4,567.00'}), entrada).ok, true);
  assert.equal(validarLectura('impacto', jsonLectura('impacto', {monto: '$999,999.00'}), entrada).motivo, 'monto_no_sustentado');
  assert.equal(validarLectura('impacto', '{"severidad":"enorme"}', entrada).motivo, 'severidad_invalida');
  assert.equal(validarLectura('impacto', jsonLectura('impacto', {texto: 'Escribe a ana@example.com'}), entrada).motivo, 'pii_en_salida');
  assert.equal(validarLectura('causa_raiz', jsonLectura('causa_raiz', {categoria: 'brujería'}), entrada).motivo, 'categoria_invalida');
  assert.equal(validarLectura('accion', jsonLectura('impacto'), entrada).motivo, 'propuesta_invalida');
  assert.equal(validarLectura('impacto', '{"severidad":"alta","confianza":1.4,"lectura":"x","puntos":[],"supuestos":[]}', entrada).motivo, 'confianza_invalida');
  assert.deepEqual(extraerJson('```json\n{"a":1}\n```'), {a: 1}); assert.equal(extraerJson('nada'), null); assert.equal(extraerJson('[1]'), null);
});

test('PII bloqueada ANTES de enviar: ni se llama al proveedor ni se reserva presupuesto', async () => {
  const vista = vistaSimulada(); vista.puntos.find(p => p.id === 'P2').noSabemos = ['Contactar a maria@correo.com sobre el caso'];
  const {svc, provider, store} = mk({vista});
  await assert.rejects(() => svc.analizar({id: 'P2'}), e => e.code === 'pii_blocked' && e.status === 422);
  assert.equal(provider.llamadas.length, 0); assert.equal(store.eventos.length, 0);
  // también por una fila de evidencia con un teléfono o un número largo
  const evidencia = {async get() { return {estado: 'ok', filas: [{fecha: '2026-10-01', canal: 'Walmart', sku: 'ABC', estado: 'Pendiente', motivo: 'Llamar al 55 1234 5678', importeMinor: '100', origen: 'Libro'}], total: {n: 1, sinMonto: 0, minor: '100'}, verificacion: {marca: '✓'}}; }};
  const m = mk({evidencia}); await assert.rejects(() => m.svc.analizar({id: 'P2'}), /pii_blocked/); assert.equal(m.provider.llamadas.length, 0);
  assert.equal(pareceTenerPII('orden 123456789012'), true); assert.equal(pareceTenerPII('https://x.com'), true); assert.equal(pareceTenerPII('USD 1,234,567.89 · 2026-10-20 a 2026-10-24'), false);
});

test('la entrada es redactada: solo columnas de la lista blanca, 20 filas máx., sin referencias; unknown ≠ 0; monedas separadas', async () => {
  const punto = vistaSimulada().puntos.find(p => p.id === 'P2');
  punto.otrasMonedas = [{currency: 'CAD', exponent: 2, minor: '12345', n: 3}];
  const filas = Array.from({length: 30}, (_, i) => ({fecha: '2026-10-01', canal: 'Walmart', sku: 'SKU' + i, estado: 'Pendiente', motivo: null, moneda: 'USD', importeMinor: i === 0 ? null : '1000', ref: 'a1b2c3d4', origen: 'Libro · reembolsos', nombre: 'Juan Pérez', correo: 'x@y.com'}));
  const {objeto, texto} = construirEntrada(punto, {estado: 'ok', filas, total: {n: 30, sinMonto: 1, minor: '29000'}, verificacion: {marca: '✓'}});
  assert.equal(objeto.evidencia.filas.length, 20);
  assert.deepEqual(Object.keys(objeto.evidencia.filas[0]).sort(), ['canal', 'estado', 'fecha', 'importe', 'motivo', 'origen', 'sku']);
  assert.equal(objeto.evidencia.filas[0].importe, 'sin monto');
  assert.doesNotMatch(texto, /Juan|x@y\.com|a1b2c3d4/);
  assert.match(texto, /USD 4,567\.00/); assert.match(texto, /CAD\)? ?\(no se suma\)|CAD \(no se suma\)/);
  assert.match(texto, /ingreso bruto/); assert.doesNotMatch(texto, /margen":\s*\d/);
  assert.equal(usdTxt('5'), 'USD 0.05'); assert.equal(usdTxt('123456789'), 'USD 1,234,567.89');
});

test('costo registrado: liquida con el costo real de cada llamada; sin respuesta = costo incierto (cuenta la reserva)', async () => {
  const costos = {causa_raiz: 61_000, impacto: 99_500};
  const sim = proveedorSimulado({costo: i => costos[i.rol] ?? 0, lanzar: {accion: true}});
  const {svc, store} = mk({provider: sim});
  const r = await svc.analizar({id: 'P2'});
  const liq = store.eventos.filter(e => e[0] === 'liquidar').map(e => e[2]);
  assert.deepEqual(liq, [61_000, 99_500, null]);
  assert.equal(r.actual.lecturas.find(l => l.rol === 'accion').estado, 'error');
  assert.equal((await store.presupuesto()).usedMicro, 61_000 + 99_500 + ESTIMADO_POR_LECTURA_MICRO, 'el incierto cuenta su reserva completa');
  assert.equal(r.resultado.costoMicro, 160_500);
  assert.equal([...store.gasto.values()].find(g => g.estado === 'incierto').actual, null);
});

test('IA apagada, punto inexistente, punto sin dato y doble clic concurrente', async () => {
  const off = mk({provider: null});
  await assert.rejects(() => off.svc.analizar({id: 'P2'}), e => e.code === 'ia_apagada' && e.status === 503);
  assert.equal((await off.svc.estado({id: 'P2'})).habilitada, false);
  await assert.rejects(() => mk().svc.analizar({id: 'P99'}), e => e.code === 'pain_point_not_found' && e.status === 404);
  await assert.rejects(() => mk().svc.analizar({id: 'P2;drop'}), e => e.code === 'pain_point_invalid');
  const m = mk(); await assert.rejects(() => m.svc.analizar({id: 'P3'}), e => e.code === 'pain_point_sin_dato' && e.status === 409);
  assert.equal(m.provider.llamadas.length, 0);
  // el segundo clic mientras el primero sigue en curso no gasta dos veces
  let soltar; const pausa = new Promise(r => { soltar = r; });
  const lento = {llamadas: [], async completar(i) { this.llamadas.push(i.rol); await pausa; return {texto: jsonLectura(i.rol), costoMicro: 100_000, tokensIn: 1, tokensOut: 1}; }};
  const c = mk({provider: lento});
  const a = c.svc.analizar({id: 'P2'});
  await new Promise(r => setTimeout(r, 10));
  const b = await c.svc.analizar({id: 'P2'});
  assert.equal(b.resultado.enCurso, true); assert.equal(b.resultado.nuevas, 0);
  soltar(); await a;
  assert.equal(lento.llamadas.length, 3, 'cada lectura se pidió una sola vez');
});

test('consenso puro: «desconocida» no cuenta como un nivel (unknown ≠ 0) y sin lecturas no hay consenso', () => {
  const l = (rol, sev, conf = 0.8) => ({rol, estado: 'ok', contenido: {severidad: sev, confianza: conf}});
  const c = consenso([l('causa_raiz', 'alta'), l('impacto', 'desconocida'), l('accion', 'alta')]);
  assert.equal(c.estado, 'acuerdo'); assert.equal(c.completo, false); assert.equal(c.tono, 'warn'); assert.ok(c.confianza < 0.8);
  assert.equal(consenso([l('causa_raiz', 'alta'), l('impacto', 'desconocida'), l('accion', 'desconocida')]).estado, 'incompleto');
  assert.equal(consenso([]).estado, 'sin_lecturas'); assert.equal(consenso([{rol: 'impacto', estado: 'invalido', contenido: {}}]).estado, 'sin_lecturas');
  assert.equal(consenso([l('causa_raiz', 'alta'), l('impacto', 'baja')]).estado, 'desacuerdo');
  assert.equal(LECTURAS.length, 3);
});

test('proveedor real: apagado por defecto; encendido calcula el costo real de los tokens (fetch inyectado, sin red)', async () => {
  assert.equal(crearProveedorReal({}), null); assert.equal(iaHabilitada({VEXA_PAIN_AI: 'enabled'}), false);
  const env = {VEXA_PAIN_AI: 'enabled', VEXA_PAIN_AI_API_KEY: 'sk-ant-' + 'x'.repeat(30), VEXA_PAIN_AI_USD_PER_MTOK_IN: '3', VEXA_PAIN_AI_USD_PER_MTOK_OUT: '15'};
  let visto;
  const p = crearProveedorReal(env, {fetchImpl: async (url, init) => { visto = {url, init}; return {ok: true, json: async () => ({content: [{type: 'text', text: '{"a":1}'}], usage: {input_tokens: 1000, output_tokens: 200}})}; }});
  const r = await p.completar({sistema: 's', usuario: 'u'});
  assert.equal(r.costoMicro, 1000 * 3 + 200 * 15); assert.equal(r.texto, '{"a":1}');
  assert.match(visto.url, /^https:\/\/api\.anthropic\.com\//); assert.equal(visto.init.redirect, 'error');
  const mal = crearProveedorReal(env, {fetchImpl: async () => ({ok: false, status: 429})});
  await assert.rejects(() => mal.completar({sistema: 's', usuario: 'u'}), /PROVEEDOR_RECHAZO/);
});
