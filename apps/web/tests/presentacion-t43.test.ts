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
  const x = textos('en'), plano = JSON.stringify(x, (_k, v) => (typeof v === 'function' ? v('A', 'B') : v));
  assert.equal(x.atorado.cobertura(3, 10), '3 of 10 requests have an amount.');
  assert.ok(x.atorado.noSabemos.includes('The Tracker amount has no currency: USD is assumed.'));
  assert.ok(x.reembolsos.noSabemos.includes('Export windows are partial: the ledger does not cover the same period for every channel.'));
  assert.equal(x.ingresoNoDisp, 'Not available right now. That is not the same as zero.');
  for (const calco of [/carry an amount/, /does not declare/, /not the whole ledger/, /It does not mean zero/]) assert.doesNotMatch(plano, calco);
  assert.match(JSON.stringify(textos('es'), (_k, v) => (typeof v === 'function' ? v('A', 'B') : v)), /Todavía no hay datos suficientes/);
});

test('meses de Fuga y Brechas: cada llamada a mesCorto/mesLargo lleva el idioma activo (antes salían «ene», «oct» bajo en)', async () => {
  const {mesCorto, mesLargo} = await import('../src/components/refunds/fuga-modelo.mjs');
  assert.equal(mesCorto('2026-01', 'en'), 'Jan 26'); assert.equal(mesCorto('2026-01', 'es'), 'ene 26'); assert.equal(mesLargo('2026-10', 'en'), 'Oct 2026');
  for (const rel of ['src/components/gaps/gaps-bloques.tsx', 'src/components/refunds/fuga-bloques.tsx', 'src/components/refunds/fuga-intensidad.tsx', 'src/components/refunds/fuga-partes.tsx']) {
    const fuente = leer(rel), llamadas = fuente.match(/\bmes(?:Corto|Largo)\((?:[^()]|\([^()]*\))*\)/g) ?? [];
    assert.ok(llamadas.length > 0, rel);
    for (const l of llamadas) assert.match(l, /,idioma\)$/, rel + ': ' + l);
  }
});

test('Fuga y Brechas: «de dónde sale cada cifra» y el avance del histórico salen en inglés; los documentos conservan el español', async () => {
  const {proveniencia: pFuga} = await import('../src/components/refunds/fuga-archivos.mjs');
  const {proveniencia: pBrechas} = await import('../src/components/gaps/gaps-archivos.mjs');
  const {textoAvance} = await import('../src/components/gaps/gaps-modelo.mjs');
  const vf = {todasParciales: true, generatedAt: '2026-10-19T03:00:00.000Z'} as never;
  const vb = {generatedAt: '2026-10-19T03:00:00.000Z', ingresos: {status: 'ok', canales: [{canal: 'amazon', desde: '2025-11-03'}]}} as never;
  for (const l of [...pFuga(vf, 'en'), ...pBrechas(vb, 'en')]) assert.ok(!ACENTOS.test(l) && !/\b(libro|desde|ventanas|ingreso|fuente)\b/i.test(l), 'español bajo en: ' + l);
  assert.match(pFuga(vf, 'en')[2], /^Export windows: none is marked as complete\./);
  assert.match(pBrechas(vb, 'en')[2], /\(Amazon since /);
  assert.match(pFuga(vf)[0], /^Fuente de reembolsos y pedidos/); assert.equal(pFuga(vf)[2], pFuga(vf, 'es')[2]);
  assert.match(pBrechas(vb)[0], /^Ingreso: libro de pedidos/);
  const f = {progreso: {v2: 1200, objetivo: 5000, avancePct: 24}} as never;
  assert.match(textoAvance(f, 'en'), /^1,200 of 5,000 history conversations analyzed \(/); assert.match(textoAvance(f), /^1,200 de 5,000 conversaciones del histórico analizadas/);
  assert.equal(textoAvance(null, 'en'), 'Progress is not available right now.'); assert.equal(textoAvance(null), 'El avance no está disponible ahora.');
  assert.match(leer('src/components/refunds/fuga-pantalla.tsx'), /proveniencia\(v,idioma\)/); assert.match(leer('src/components/gaps/gaps-pantalla.tsx'), /proveniencia\(v,idioma\)/);
  assert.match(leer('src/components/gaps/gaps-familias.tsx'), /textoAvance\(f,idioma\)/);
});

test('críticos: el aviso, la frase y la fecha del brief se arman con las cuentas en el idioma activo; sin traductor, el texto del paquete', async () => {
  const {avisoDeMeta, avisoCriticosT, fraseCriticosT} = await import('../src/lib/legibilidad/criticos.mjs');
  const {fraseVigilar} = await import('../src/lib/legibilidad/brief.mjs');
  const {avisoCriticos, fraseCriticos} = await import('../../../packages/workspace-service/critico.mjs');
  const meta = {critical_notice: avisoCriticos({grupos: 53, senales: 120}), critical_counts: {groups: 53, signals: 120}};
  assert.equal(avisoDeMeta(es, meta), meta.critical_notice, 'en español: idéntico al del paquete');
  assert.equal(avisoDeMeta(null, meta), meta.critical_notice);
  assert.equal(avisoDeMeta(en, meta), '53 problem groups with critical review (120 critical signals). They are always counted: they do not depend on the filters or the amount.');
  assert.equal(avisoDeMeta(en, {critical_notice: 'Texto viejo'}), 'Texto viejo', 'respuesta sin cuentas: se conserva');
  assert.equal(fraseCriticosT(en, {grupos: 1}), '1 problem group with critical review'); assert.equal(fraseCriticosT(es, {grupos: 1, senales: 1}), fraseCriticos({grupos: 1, senales: 1}));
  assert.equal(avisoCriticosT(en, {grupos: 2}), '2 problem groups with critical review. They are always counted: they do not depend on the filters or the amount.');
  const g = (n: number) => fraseCriticosT(en, {grupos: n});
  const vig = fraseVigilar({total: 5, listados: 3}, 'Oct 5, 2026', g, en);
  assert.equal(vig, 'When this brief was saved (Oct 5, 2026) there were 5 problem groups with critical review (not counting the hidden automatic notifications, same criterion as Problems); this brief details the 3 with the most quotes. Problems recalculates with today’s data and may show a different figure.');
  assert.ok(!ACENTOS.test(vig)); assert.match(fraseVigilar({total: null, listados: 2}, null, g, en), /^When this brief was saved, the brief lists 2 problem groups/);
  assert.match(fraseVigilar({total: 5, listados: 3}, '5 oct 2026', (n) => fraseCriticos({grupos: n})), /^Al guardarse este brief \(5 oct 2026\) había 5 grupos de problemas con revisión crítica/);
  const panel = leer('src/components/workspace/shared-panel.tsx'), brief = leer('src/components/briefs/panel.tsx');
  assert.match(panel, /avisoDeMeta\(t,bundle\.meta\)/); assert.doesNotMatch(panel, /DEFINICION|\{bundle\.meta\.critical_notice\}/);
  assert.match(brief, /fraseCriticosT\(tx,/); assert.match(brief, /fraseCriticosT\(tx,\{grupos:n\}\),tx\)/, 'el brief pasa el traductor a fraseVigilar'); assert.doesNotMatch(brief, /DEFINICION\.grupo/);
});

test('validación del flujo de acciones: cada error lleva su código y la pantalla lo traduce; el mensaje en español y los campos no cambian', async () => {
  const {validarAprobacion, validarAjuste, validarDescarte, validarResultado, MIN_COMENTARIO} = await import('../../../packages/recommendations/flujo.mjs');
  const todos = [...validarAprobacion({ownerId: 'x', dueDate: '1999-01-01', comment: 'a'.repeat(2001)}), ...validarAjuste({ownerId: 'x', priority: 'urgente'}), ...validarDescarte({reason: ''}), ...validarResultado({outcome: 'maybe', note: 'x'})];
  assert.deepEqual(todos.map((e: {campo: string}) => e.campo), ['ownerId', 'dueDate', 'comment', 'action', 'rationale', 'preconditions', 'ownerId', 'priority', 'comment', 'reason', 'outcome', 'note']);
  assert.equal(new Set(todos.map((e) => e.codigo)).size, 12, 'un código distinto por error');
  for (const e of todos as Array<{codigo: string; mensaje: string}>) {
    assert.match(e.codigo, /^tr\.val\./);
    assert.equal(es(e.codigo as never, {min: MIN_COMENTARIO}), e.mensaje, 'el español de la clave es el mensaje del paquete');
    const ing = en(e.codigo as never, {min: MIN_COMENTARIO});
    assert.ok(!ACENTOS.test(ing) && ing !== e.mensaje, e.codigo + ': ' + ing);
  }
  assert.equal(en('tr.val.descarteMotivo' as never, {min: 20}), 'The reason is required (at least 20 characters).');
  assert.match(leer('src/components/recommendations/flujo-acciones.tsx'), /e\.codigo\?t\(e\.codigo as Clave,\{min:MIN_COMENTARIO\}\):e\.mensaje/);
});

test('citas: los marcadores de datos de terceros se rotulan en el idioma activo; sin traductor, los del paquete', async () => {
  const {marcasEnIdioma} = await import('../src/lib/legibilidad/marcas.mjs');
  const {enmascararTerceros} = await import('../../../packages/workspace-service/enmascarar-terceros.mjs');
  const texto = enmascararTerceros('Hello,\nMy name is John Smith and I live at 123 Main Street, Austin, TX 78701. Please refund. [PII]');
  assert.match(texto, /\[nombre\]|\[dirección\]/);
  const ing = marcasEnIdioma(texto, en);
  assert.doesNotMatch(ing, /\[nombre\]|\[dirección\]|\[dato personal oculto\]/); assert.match(ing, /\[address\]|\[name\]/); assert.match(ing, /\[personal data hidden\]/);
  assert.equal(marcasEnIdioma('Hola [nombre], envío a [dirección]. [dato personal oculto]', en), 'Hola [name], envío a [address]. [personal data hidden]', 'las tres marcas, una por una');
  assert.equal(marcasEnIdioma(texto, es), texto); assert.equal(marcasEnIdioma(texto), texto);
  assert.equal(marcasEnIdioma('Sin marcas aquí.', en), 'Sin marcas aquí.', 'el resto de la cita no se toca');
  assert.match(leer('src/components/ui/citation.tsx'), /marcasEnIdioma\(enmascararTerceros\(quote\),t\)/);
});

test('cobertura que el servidor arma en español: se rotula por idioma; el texto debe seguir existiendo en el paquete (si cambia, esta prueba falla)', async () => {
  const {coberturaTexto, CLAVES_COBERTURA} = await import('../src/lib/legibilidad/cobertura');
  const servidor = leer('../../packages/workspace-service/index.mjs') + leer('src/lib/workspace/data.ts') + leer('../../packages/briefs/index.mjs');
  const textos = ['Sin snapshot publicado para este alcance.', 'Anclaje de alcance: sin cifras.', 'La versión actual del problema cambió; esta vista conserva la historia y las cifras publicadas.', 'Cobertura financiera según el snapshot; filas por problema no aditivas.', 'Cobertura de cada métrica según el snapshot y las pertenencias confirmadas del alcance; un subtotal conocido no equivale al total.', 'Sin datos publicados', 'Publicación pendiente', 'Sin vínculos problema–pedido: la exposición no se calcula.'];
  for (const x of textos) assert.ok(servidor.includes(x), 'el servidor ya no manda: ' + x);
  for (const x of textos.slice(0, 7)) { const ing = coberturaTexto(en, x); assert.ok(!ACENTOS.test(ing) && ing !== x, x + ' -> ' + ing); assert.equal(coberturaTexto(es, x), x, 'en español no cambia'); assert.equal(coberturaTexto(null, x), x); }
  assert.equal(coberturaTexto(en, 'Cobertura financiera según el snapshot; filas por problema no aditivas.'), 'Financial coverage according to the published cut; per-problem rows are not additive.');
  assert.equal(coberturaTexto(en, '12 órdenes con pertenencia al filtro desconocida; subtotal de pertenencias confirmadas.'), '12 orders with unknown membership in the filter; subtotal of confirmed memberships.');
  assert.equal(coberturaTexto(en, 'Cobertura 3/5'), 'Coverage 3/5'); assert.equal(coberturaTexto(es, 'Cobertura 3/5'), 'Cobertura 3/5');
  assert.match(coberturaTexto(en, 'Sin vínculos problema–pedido: la exposición no se calcula. Se listan los problemas vigentes del catálogo ordenados por incidencias; el importe no está disponible (desconocido, no cero).'), /^No problem-to-order links/);
  assert.equal(coberturaTexto(en, 'Un texto nuevo del servidor'), 'Un texto nuevo del servidor', 'lo desconocido sale tal cual');
  for (const k of CLAVES_COBERTURA()) assert.notEqual(en(k as never, {n: 1, a: 1, b: 2}), es(k as never, {n: 1, a: 1, b: 2}), k);
  assert.match(leer('src/components/workspace/data-state.tsx'), /coberturaTexto\(t,state\.coverage\)/);
  assert.match(leer('src/components/briefs/panel.tsx'), /coberturaTexto\(tx,d\.coverage\)/);
});
