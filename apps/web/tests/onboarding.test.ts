// Onboarding F1: catálogo único (capacidades reales de db.ts), resolver de pista, estado local e i18n sin cifras escritas a mano.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATALOGO, PISTAS, ROL_DE_PISTA, ACCIONES, ACCIONES_DE_ESCRITURA, PRERREQUISITOS, pasosDe, problemasDePaso, clavesDePista, CLAVES_UI, rolesConCapacidad} from '../src/lib/onboarding/catalogo.mjs';
import {pistaDe} from '../src/lib/onboarding/pista.mjs';
import {DATABASE_ACTION_ROLES} from '@vexa/platform/capabilities';
import {menuVisible} from '../src/lib/workspace/menu.mjs';
import {claveEstado, hashCorto, leerEstado, guardarEstado, actualizarEstado, reconciliar, limpiarEstadoOnboarding, almacenDelNavegador, ESTADO_VACIO, type Almacen} from '../src/lib/onboarding/estado';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const variables = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const ESP = es as Record<string, string>, ING = en as Record<string, string>;

// (a) Capacidades y menú
test('cada paso del catálogo es válido para su pista: capacidad real del rol y href que menuVisible() le muestra', () => {
  for (const p of CATALOGO) assert.deepEqual(problemasDePaso(p, menuVisible), [], p.id);
});
test('el validador falla si un rol recibe un paso cuya capacidad no tiene o un href que su menú no muestra', () => {
  const base = {id: 'x', pista: 'lector', accion: 'read', href: '/overview', superficie: 'tour', prerrequisito: null, textos: {titulo: 't', cuerpo: 'c'}} as const;
  assert.deepEqual(problemasDePaso(base as never, menuVisible), []);
  assert.match(problemasDePaso({...base, accion: 'approve'} as never, menuVisible).join(), /viewer no tiene la capacidad approve/);
  assert.match(problemasDePaso({...base, pista: 'operador', accion: 'import', href: '/imports'} as never, menuVisible).join(), /operator no tiene la capacidad import/);
  assert.match(problemasDePaso({...base, href: '/cfo'} as never, menuVisible).join(), /menú de viewer no muestra \/cfo/);
  assert.match(problemasDePaso({...base, pista: 'analista', href: '/settings/team'} as never, menuVisible).join(), /menú de analyst no muestra/);
  assert.match(problemasDePaso({...base, accion: 'inventada'} as never, menuVisible).join(), /acción desconocida/);
  assert.match(problemasDePaso({...base, pista: 'plataforma', href: '/overview'} as never, menuVisible).join(), /solo enlaza a \/platform/);
});
test('el lector no tiene pasos de escritura y el operador no tiene pasos de importación ni de configuración', () => {
  for (const p of pasosDe('lector')) assert.ok(!ACCIONES_DE_ESCRITURA.includes(p.accion), p.id);
  for (const p of pasosDe('operador')) assert.ok(!['import', 'configure', 'approve', 'retain'].includes(p.accion), p.id);
  for (const p of pasosDe('analista')) assert.ok(!['configure', 'approve', 'retain'].includes(p.accion), p.id);
});
test('máximo 5 pasos de tour y 4 de checklist por pista; ids únicos y con el prefijo de su pista; prerrequisitos declarados existen', () => {
  const ids = new Set<string>();
  for (const p of CATALOGO) { assert.ok(!ids.has(p.id), 'id repetido ' + p.id); ids.add(p.id); assert.ok(p.id.startsWith(p.pista + '.'), p.id); if (p.prerrequisito) assert.ok(p.prerrequisito in PRERREQUISITOS, p.id); }
  for (const pista of PISTAS) { assert.ok(pasosDe(pista, 'tour').length >= 1 && pasosDe(pista, 'tour').length <= 5, pista + ' tour'); assert.ok(pasosDe(pista, 'checklist').length <= 4, pista + ' checklist'); }
});
test('soporte (Ver como): un solo aviso, sin acciones de escritura, sin enlaces, sin checklist ni prerrequisitos', () => {
  const s = pasosDe('soporte');
  assert.equal(s.length, 1);
  assert.equal(pasosDe('soporte', 'checklist').length, 0);
  assert.equal(s[0].href, null); assert.equal(s[0].prerrequisito, null);
  assert.ok(!ACCIONES_DE_ESCRITURA.includes(s[0].accion));
  assert.equal(ROL_DE_PISTA.soporte, null);
});
test('los pasos de plataforma están dentro de /platform', () => { for (const p of pasosDe('plataforma')) assert.match(p.href!, /^\/platform(\/|$)/); });

// (b) Acciones reales de db.ts
test('db.ts: las 10 acciones reales; el catálogo las importa de la misma constante que usa db.ts', () => {
  const esperadas = ['approve', 'configure', 'execute', 'export', 'import', 'materialize', 'notify', 'propose', 'read', 'retain'];
  assert.deepEqual([...ACCIONES].sort(), esperadas, 'si db.ts cambia sus acciones hay que revisar el catálogo y los textos');
  assert.deepEqual(Object.keys(DATABASE_ACTION_ROLES).sort(), esperadas);
  const db = leer('../../packages/platform/src/db.ts');
  assert.match(db, /from '@vexa\/platform\/capabilities'/);
  assert.match(db, /const roles = DATABASE_ACTION_ROLES/);
  assert.doesNotMatch(db, /const roles: Record/, 'db.ts no debe volver a definir su propia tabla de roles');
  const tiempos = /STATEMENT_TIMEOUT_MS: Record<DatabaseAction, string> = \{([^}]*)\}/.exec(db)![1];
  assert.deepEqual([...tiempos.matchAll(/(\w+):'/g)].map((m) => m[1]).sort(), esperadas, 'las acciones con tiempo límite en db.ts deben ser las mismas');
  assert.match(leer('src/lib/onboarding/catalogo.mjs'), /from '@vexa\/platform\/capabilities'/);
});
test('tabla de capacidades por rol (instantánea): un cambio en db.ts rompe esta prueba y obliga a revisar los recorridos', () => {
  assert.deepEqual(rolesConCapacidad('approve'), ['owner']);
  assert.deepEqual(rolesConCapacidad('configure'), ['owner']);
  assert.deepEqual(rolesConCapacidad('retain'), ['owner']);
  assert.deepEqual(rolesConCapacidad('import'), ['owner', 'analyst']);
  assert.deepEqual(rolesConCapacidad('execute'), ['owner', 'operator']);
  assert.deepEqual(rolesConCapacidad('propose'), ['owner', 'analyst', 'operator']);
  for (const a of ['read', 'notify', 'materialize', 'export']) assert.deepEqual(rolesConCapacidad(a as never), ['owner', 'analyst', 'operator', 'viewer']);
});

// (c) pistaDe
test('pistaDe: soporte gana siempre, aunque sea superadmin, esté en /platform o tenga cualquier rol', () => {
  const sesion = {tenant_id: 't', reason: 'r'};
  for (const rol of ['owner', 'analyst', 'operator', 'viewer', null]) for (const platformAdmin of [true, false]) for (const enPlataforma of [true, false])
    assert.equal(pistaDe({rol, support: sesion, platformAdmin, enPlataforma}), 'soporte');
});
test('pistaDe: dentro de /platform pista plataforma; dentro de una organización la del rol; superadmin sin membresías: sin tour', () => {
  assert.equal(pistaDe({rol: null, platformAdmin: true, enPlataforma: true}), 'plataforma');
  assert.equal(pistaDe({rol: 'owner', platformAdmin: true, enPlataforma: true}), 'plataforma', 'superadmin con membresía dentro de /platform');
  assert.equal(pistaDe({rol: 'owner', platformAdmin: true, enPlataforma: false}), 'propietario', 'superadmin dentro de una organización');
  assert.equal(pistaDe({rol: 'analyst', platformAdmin: true}), 'analista');
  assert.equal(pistaDe({rol: null, platformAdmin: true, enPlataforma: false}), null, 'sin membresías → aviso, sin tour');
  assert.equal(pistaDe({rol: 'owner', platformAdmin: false, enPlataforma: true}), 'propietario', 'enPlataforma sin ser superadmin no cambia la pista');
  assert.deepEqual(['owner', 'analyst', 'operator', 'viewer'].map((rol) => pistaDe({rol})), ['propietario', 'analista', 'operador', 'lector']);
  assert.equal(pistaDe({rol: 'root'}), null); assert.equal(pistaDe({rol: undefined}), null); assert.equal(pistaDe(), null);
  assert.equal(pistaDe({rol: '__proto__'}), null); assert.equal(pistaDe({rol: 'constructor'}), null);
  assert.equal(pistaDe({rol: 'owner', support: undefined}), 'propietario'); assert.equal(pistaDe({rol: 'owner', support: null}), 'propietario');
});

// (d) Estado local
function almacenFalso(): Almacen & {datos: Map<string, string>} {
  const datos = new Map<string, string>();
  return {datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v), removeItem: (k) => void datos.delete(k), key: (i) => [...datos.keys()][i] ?? null, get length() { return datos.size; }};
}
const lanzador: Almacen = {getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); }, removeItem() { throw new Error('x'); }, key() { throw new Error('x'); }, get length(): number { throw new Error('x'); }};
test('la clave es onb.v1.<hash corto>.<pista> y no contiene el id de usuario ni de organización', () => {
  const u = '6f1c2d3e-aaaa-bbbb-cccc-111122223333', o = '9a8b7c6d-dddd-eeee-ffff-444455556666';
  const k = claveEstado(u, o, 'propietario');
  assert.match(k, /^onb\.v1\.[0-9a-f]{8}\.propietario$/);
  assert.ok(!k.includes(u) && !k.includes(o) && !k.includes('6f1c'));
  assert.equal(k, claveEstado(u, o, 'propietario'), 'estable');
  assert.notEqual(k, claveEstado(u, 'otra-org', 'propietario'));
  assert.notEqual(k, claveEstado('otro-usuario', o, 'propietario'));
  assert.notEqual(hashCorto('a', 'bc'), hashCorto('ab', 'c'), 'el separador evita colisiones triviales');
});
test('guardar, leer y actualizar el estado; formas rotas devuelven el estado vacío', () => {
  const a = almacenFalso(); const k = 'onb.v1.aaaaaaaa.lector';
  assert.deepEqual(leerEstado(a, k), ESTADO_VACIO);
  assert.equal(guardarEstado(a, k, {...ESTADO_VACIO, visto: true, paso: 'lector.hoy'}), true);
  assert.deepEqual(leerEstado(a, k), {visto: true, omitido: false, descartado: false, activo: false, paso: 'lector.hoy'});
  assert.deepEqual(actualizarEstado(a, k, {omitido: true}), {visto: true, omitido: true, descartado: false, activo: false, paso: 'lector.hoy'});
  a.datos.set(k, '{no es json'); assert.deepEqual(leerEstado(a, k), ESTADO_VACIO);
  a.datos.set(k, JSON.stringify({visto: 'sí', paso: 42, extra: 1})); assert.deepEqual(leerEstado(a, k), ESTADO_VACIO);
  a.datos.set(k, 'null'); assert.deepEqual(leerEstado(a, k), ESTADO_VACIO);
});
test('localStorage ausente o que lanza excepción no rompe nada', () => {
  assert.deepEqual(leerEstado(null, 'k'), ESTADO_VACIO);
  assert.equal(guardarEstado(null, 'k', ESTADO_VACIO), false);
  assert.deepEqual(leerEstado(lanzador, 'k'), ESTADO_VACIO);
  assert.equal(guardarEstado(lanzador, 'k', ESTADO_VACIO), false);
  assert.deepEqual(actualizarEstado(lanzador, 'k', {visto: true}), {...ESTADO_VACIO, visto: true}, 'sigue en memoria aunque no persista');
  assert.equal(limpiarEstadoOnboarding(lanzador), 0);
  assert.equal(limpiarEstadoOnboarding(null), 0);
  assert.equal(almacenDelNavegador(), null, 'sin window (servidor) no hay almacén');
  const g = globalThis as Record<string, unknown>; const antes = g.window;
  try { g.window = {get localStorage() { throw new Error('SecurityError'); }}; assert.equal(almacenDelNavegador(), null, 'acceder a localStorage lanza'); } finally { if (antes === undefined) delete g.window; else g.window = antes; }
});
test('reconciliar: el paso guardado que ya no es de la pista vuelve al primero; completados salen de lo derivado, no de lo guardado', () => {
  const guardado = {...ESTADO_VACIO, visto: true, paso: 'propietario.acciones'};
  const comoLector = reconciliar(guardado, 'lector', []);
  assert.equal(comoLector.pasoActual, 'lector.hoy');
  assert.equal(comoLector.estado.visto, true, 'lo visto/omitido se conserva');
  assert.deepEqual(comoLector.completados, []);
  const vuelveOwner = reconciliar({...guardado, paso: 'propietario.acciones'}, 'propietario', new Set(['propietario.datos', 'propietario.historial', 'lector.hoy']));
  assert.equal(vuelveOwner.pasoActual, 'propietario.acciones');
  assert.deepEqual(vuelveOwner.completados, ['propietario.datos', 'propietario.historial'], 'ids ajenos a la pista se ignoran');
  assert.deepEqual(reconciliar({...ESTADO_VACIO, paso: 'propietario.datos', visto: true} as never, 'propietario', []).completados, [], 'sin derivados nada está completo aunque lo guardado diga otra cosa');
  const sinPista = reconciliar(guardado, null); assert.equal(sinPista.pasoActual, null); assert.deepEqual(sinPista.completados, []);
});
test('limpiarEstadoOnboarding quita solo las claves onb.* (al cerrar sesión)', () => {
  const a = almacenFalso();
  a.datos.set('onb.v1.aaaaaaaa.lector', '{}'); a.datos.set('onb.v1.bbbbbbbb.propietario', '{}'); a.datos.set('rovaq_menu', '[]'); a.datos.set('theme', 'dark');
  assert.equal(limpiarEstadoOnboarding(a), 2);
  assert.deepEqual([...a.datos.keys()].sort(), ['rovaq_menu', 'theme']);
  assert.equal(limpiarEstadoOnboarding(a), 0);
});

// (e) i18n
test('onb.*: todas las claves del catálogo existen en es y en, con las mismas {variables}; no hay claves huérfanas', () => {
  const usadas = new Set<string>([...CLAVES_UI, ...PISTAS.flatMap((p) => clavesDePista(p))]);
  for (const k of usadas) { assert.ok(k in ESP, 'falta en es: ' + k); assert.ok(k in ING, 'falta en en: ' + k); assert.equal(variables(ING[k]), variables(ESP[k]), k); assert.ok(ESP[k].trim() && ING[k].trim(), k); }
  const onb = Object.keys(ESP).filter((k) => k.startsWith('onb.'));
  assert.deepEqual(onb.filter((k) => !usadas.has(k)), [], 'claves onb.* que ningún paso usa');
  assert.deepEqual(Object.keys(ING).filter((k) => k.startsWith('onb.')).sort(), onb.sort());
  assert.equal(variables(ESP['onb.soporte.aviso.titulo']), 'organizacion');
  assert.equal(variables(ESP['onb.ui.paso']), 'n,total');
});
test('onb.*: sin cifras ni afirmaciones de cumplimiento escritas a mano (RLS, respaldos, SOC, conteos, porcentajes)', () => {
  const prohibido = /\d|%|\bRLS\b|SOC\s?2|ISO\s?27|respaldo|backup|\bSLA\b|pruebas cruzadas|certific/i;
  for (const [idioma, dic] of [['es', ESP], ['en', ING]] as const)
    for (const k of Object.keys(dic).filter((x) => x.startsWith('onb.'))) assert.doesNotMatch(dic[k], prohibido, `${idioma}:${k}`);
});
test('onb.*: los textos de pistas de rol no prometen lo que el rol no puede hacer', () => {
  assert.doesNotMatch(ESP['onb.lector.hoy.cuerpo'] + ESP['onb.lector.problemas.cuerpo'] + ESP['onb.lector.confianza.cuerpo'], /\b(importa|conecta|invita|aprueba|propón)/i);
  assert.match(ESP['onb.soporte.aviso.cuerpo'], /solo lectura/i); assert.match(ING['onb.soporte.aviso.cuerpo'], /read-only/i);
});

// F3c: pistas de analista y operador
test('analista: el paso del corte espera al propietario (no cuenta como tarea suya) y su texto no promete preparar ni publicar', () => {
  const corte = pasosDe('analista').find((p) => p.id === 'analista.corte')!;
  assert.equal(corte.espera, 'propietario'); assert.equal(corte.superficie, 'checklist');
  assert.match(ESP['onb.analista.corte.cuerpo'], /propietario/i); assert.match(ING['onb.analista.corte.cuerpo'], /owner/i);
  assert.match(ESP['onb.analista.corte.cuerpo'], /lo hace el propietario/); assert.match(ING['onb.analista.corte.cuerpo'], /owner prepares and publishes/);
  assert.ok(!pasosDe('analista').some((p) => p.accion === 'configure' || /pedidos|orders/i.test(p.id)), 'el analista no carga pedidos ni configura');
  assert.match(ESP['onb.analista.importar.cuerpo'], /propietario/); assert.match(ING['onb.analista.importar.cuerpo'], /owner/);
});
test('operador y lector tienen paso de avisos propios (notify) y llegan a él desde su menú', () => {
  for (const pista of ['operador', 'lector'] as const) {
    const a = pasosDe(pista).find((p) => p.id === pista + '.avisos')!;
    assert.equal(a.accion, 'notify'); assert.equal(a.href, '/settings/notifications'); assert.equal(a.superficie, 'tour');
    assert.deepEqual(problemasDePaso(a, menuVisible), []);
  }
});
test('operador: sin pasos de importación ni de dinero; el lector no ve pasos con verbos de escritura', () => {
  for (const p of pasosDe('operador')) assert.ok(!['/imports', '/cfo', '/economics', '/connections'].includes(p.href!), p.id);
  const texto = (pista: string, d: Record<string, string>) => pasosDe(pista as never).map((p) => d[p.textos.cuerpo]).join(' ');
  assert.doesNotMatch(texto('lector', ESP), /\b(importa|conecta|invita|aprueba|propón|carga)\b/i);
  assert.doesNotMatch(texto('operador', ESP), /\b(importa|conecta|invita|carga)\b/i);
});
