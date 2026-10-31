// T43: notas que llegan de los paquetes con clave estable (`noteKey`), errores de rutas por código, motivos EN->ES y calcos del inglés, con el TRADUCTOR REAL.
// Las aserciones fijan texto exacto o cableado: si se rompe el cambio, fallan.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {traductor} from '../src/lib/i18n';
import {notaDe} from '../src/lib/legibilidad/trad.mjs';

const en = traductor('en'), es = traductor('es');
const ACENTOS = /[áéíóúñ¿¡«»]/i;
const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

test('notas de tendencias e incidencias: la clave decide el idioma; sin clave o sin traductor, el español del paquete', () => {
  const vista = {note: 'Cuenta incidencias (filas de issues), no problemas agrupados.', noteKey: 'tr.nt.incCategorias'};
  assert.match(notaDe(en, vista), /^Counts incidents \(issue rows\), not grouped problems\./);
  assert.equal(notaDe(es, vista), es('tr.nt.incCategorias' as never));
  assert.match(notaDe(es, vista), /^Cuenta incidencias \(filas de issues\), no problemas agrupados\./);
  assert.equal(notaDe(null, vista), vista.note, 'sin traductor, el español que mandó el paquete');
  assert.equal(notaDe(en, {note: 'Texto viejo'}), 'Texto viejo', 'una vista sin clave (otro consumidor) no se toca');
  assert.equal(notaDe(en, null), '');
  for (const k of ['tr.nt.tendencias', 'tr.nt.incCategorias', 'tr.nt.incProblema', 'tr.nt.incTotal']) {
    const txt = en(k as never);
    assert.ok(!ACENTOS.test(txt.replace(/«|»/g, '')), 'español bajo en: ' + k);
    assert.notEqual(txt, es(k as never));
  }
  assert.equal(en('tr.nt.tendenciasMuestra' as never, {p: 3}), 'Estimated from a 3 % sample of the conversations: dating all of them (by their first message) does not fit in the allowed time.');
  assert.match(es('tr.nt.tendenciasMuestra' as never, {p: 3}), /^Estimado con una muestra del 3 % de las conversaciones/);
});

test('las tres pantallas pintan la nota con notaDe y no el texto crudo del paquete', () => {
  assert.match(leer('src/components/ui/trend-chart.tsx'), /\{notaDe\(t,view\)\}/);
  assert.doesNotMatch(leer('src/components/ui/trend-chart.tsx'), /\{view\.note\}/);
  assert.match(leer('src/components/ui/trend-chart.tsx'), /t\('tr\.nt\.tendenciasMuestra'/);
  assert.match(leer('src/components/ui/incidence-evolution.tsx'), /\{notaDe\(t,v\)\}/);
  assert.doesNotMatch(leer('src/components/ui/incidence-evolution.tsx'), /\{v!\.note\}/);
  assert.match(leer('src/components/workspace/overview-dashboard.tsx'), /\{notaDe\(t,cats\.data\)\}/);
  assert.doesNotMatch(leer('src/components/workspace/overview-dashboard.tsx'), /\{cats\.data\.note\}/);
});

test('errores de acceso del middleware y de /auth: el texto sigue la cookie de idioma; código y estado HTTP no cambian', async () => {
  const {failure, mensajeAcceso, MENSAJES_ACCESO} = await import('../src/lib/auth-http');
  const {AccessError} = await import('../src/lib/auth');
  const pet = (lang?: string) => ({cookies: {get: (n: string) => (n === 'rovaq_lang' && lang ? {value: lang} : undefined)}}) as never;
  const cuerpo = async (r: Response) => ({status: r.status, ...(await r.json() as {error: {code: string; message: string; retryable: boolean}}).error});
  const e403 = new AccessError(403, 'forbidden'), e503 = new AccessError(503, 'auth_not_configured');
  assert.deepEqual(await cuerpo(failure(e403, pet('es'))), {status: 403, code: 'forbidden', message: 'Acceso denegado.', retryable: false});
  assert.deepEqual(await cuerpo(failure(e403, pet('en'))), {status: 403, code: 'forbidden', message: 'Access denied.', retryable: false});
  assert.deepEqual(await cuerpo(failure(e503, pet('en'))), {status: 503, code: 'auth_not_configured', message: 'Could not verify access.', retryable: true});
  assert.equal((await cuerpo(failure(e503, pet('es')))).message, 'No se pudo validar el acceso.');
  assert.equal((await cuerpo(failure(e403, pet()))).message, 'Access denied.', 'sin cookie: idioma por omisión');
  assert.equal((await cuerpo(failure(new Error('x'), pet('es')))).code, 'identity_unavailable');
  assert.equal(mensajeAcceso(401, 'en'), MENSAJES_ACCESO.en.noValidado);
  for (const k of ['denegado', 'noValidado'] as const) assert.ok(!ACENTOS.test(MENSAJES_ACCESO.en[k]));
});

test('todo llamador de failure() le pasa la petición, y import-preview ya no lleva español de respaldo', () => {
  for (const rel of ['src/middleware.ts', 'src/app/(app)/auth/organization/route.ts', 'src/app/(app)/auth/google/route.ts', 'src/app/(app)/auth/logout/route.ts', 'src/app/(app)/auth/callback/route.ts']) {
    const fuente = leer(rel);
    const llamadas = fuente.match(/\bfailure\([^;]*?\)\)?[;}]/g) ?? [];
    assert.ok(llamadas.length > 0, rel);
    for (const l of llamadas) assert.match(l, /request/, rel + ': ' + l);
  }
  assert.doesNotMatch(leer('src/components/import-preview.tsx'), /No se pudo completar la solicitud de importación\.'\)|\(código \$\{r\.status\}/);
});

test('motivos, submotivos, tipos de caso y retailers: cada rótulo del catálogo del paquete tiene su inglés; los datos no se tocan', async () => {
  const {MOTIVOS_CATALOGO, SUBMOTIVOS_CATALOGO, motivoDe, submotivoDe} = await import('../../../packages/workspace-service/fuga-reembolsos.mjs');
  const {TIPOS_CATALOGO, tipoDeHoja, NOMBRE_RETAILER} = await import('../../../packages/workspace-service/mapa-problemas.mjs');
  const {motivoEtiqueta, submotivoEtiqueta, tipoCasoEtiqueta, retailerEtiqueta} = await import('../src/lib/legibilidad/motivos');
  const mot = [...MOTIVOS_CATALOGO.values(), 'Otro', 'Sin motivo'], sub = [...SUBMOTIVOS_CATALOGO.values(), 'Otro (texto libre omitido)'];
  for (const r of mot) { const x = motivoEtiqueta(r, en); assert.ok(!ACENTOS.test(x) && x !== r || r === 'Otro' && x === 'Other', `motivo ${r} -> ${x}`); assert.equal(motivoEtiqueta(r, es), r, 'en español no cambia'); assert.equal(motivoEtiqueta(r), r, 'sin traductor no cambia'); }
  for (const r of sub) { const x = submotivoEtiqueta(r, en); assert.ok(!ACENTOS.test(x) && x !== r, `submotivo ${r} -> ${x}`); assert.equal(submotivoEtiqueta(r, es), r); }
  for (const r of [...TIPOS_CATALOGO.values()].filter((x) => !['B&S', 'RMA'].includes(x)).concat('Otro')) { const x = tipoCasoEtiqueta(r, en); assert.ok(!ACENTOS.test(x) && x !== r || r === 'Otro', `tipo ${r} -> ${x}`); assert.equal(tipoCasoEtiqueta(r, es), r); }
  assert.equal(tipoCasoEtiqueta('B&S', en), 'B&S'); assert.equal(tipoCasoEtiqueta('RMA', en), 'RMA');
  assert.equal(motivoEtiqueta('Defectuoso', en), 'Defective'); assert.equal(motivoEtiqueta('Llegó tarde', en), 'Arrived too late'); assert.equal(motivoEtiqueta('Sin motivo', en), 'No reason');
  assert.equal(submotivoEtiqueta('Artículo equivocado', en), 'Wrong item received'); assert.equal(motivoEtiqueta('Artículo equivocado', en), 'Wrong item sent', 'mismo rótulo, tablas distintas');
  assert.equal(tipoCasoEtiqueta('Garantía de herramientas', en), 'Tool warranty'); assert.equal(retailerEtiqueta(NOMBRE_RETAILER.tienda, en), 'Own store'); assert.equal(retailerEtiqueta('Amazon', en), 'Amazon');
  assert.equal(motivoEtiqueta('Un motivo nuevo del cliente', en), 'Un motivo nuevo del cliente', 'dato fuera del catálogo: tal cual');
  // El paquete sigue mandando el rótulo en español (los datos guardados y agrupados no cambian).
  assert.equal(motivoDe('Defective'), 'Defectuoso'); assert.equal(submotivoDe('Damaged'), 'Dañado'); assert.equal(tipoDeHoja('Warranty Tools'), 'Garantía de herramientas');
});

test('las pantallas de fuga y mapa traducen los rótulos al pintar', () => {
  for (const rel of ['src/components/refunds/fuga-bloques.tsx', 'src/components/refunds/fuga-partes.tsx']) assert.match(leer(rel), /motivoEtiqueta\(/, rel);
  assert.match(leer('src/components/refunds/fuga-partes.tsx'), /submotivoEtiqueta\(k,tx\)/);
  assert.doesNotMatch(leer('src/components/refunds/fuga-partes.tsx'), /\{m\.motivo\}<\/th>/);
  const mapa = leer('src/components/map/mapa-pantalla.tsx');
  for (const f of ['tipoCasoEtiqueta', 'motivoEtiqueta', 'retailerEtiqueta']) assert.match(mapa, new RegExp('rotulo=\\{r=>' + f + '\\(r,t\\)\\}'));
});

test('Hoy en inglés: sin los calcos que T41 señaló (carry an amount, does not declare, not the whole ledger, does not mean zero)', async () => {
  const {textos} = await import('../src/components/hoy/hoy-textos.mjs');
  const x = textos('en') as Record<string, any>, plano = JSON.stringify(x, (_k, v) => (typeof v === 'function' ? v('A', 'B') : v));
  assert.equal(x.atorado.cobertura(3, 10), '3 of 10 requests have an amount.');
  assert.ok(x.atorado.noSabemos.includes('The Tracker amount has no currency: USD is assumed.'));
  assert.ok(x.reembolsos.noSabemos.includes('Export windows are partial: the ledger does not cover the same period for every channel.'));
  assert.equal(x.ingresoNoDisp, 'Not available right now. That is not the same as zero.');
  for (const calco of [/carry an amount/, /does not declare/, /not the whole ledger/, /It does not mean zero/]) assert.doesNotMatch(plano, calco);
  assert.match(JSON.stringify(textos('es'), (_k, v) => (typeof v === 'function' ? v('A', 'B') : v)), /Todavía no hay datos suficientes/);
});
