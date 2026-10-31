// Nombres de los roles en TODA la interfaz: «Administrador del espacio» / «Workspace administrator» (valor técnico `owner`), Analista / Analyst,
// Operador / Operator, Lectura / Read-only (valor técnico `viewer`). Barre los diccionarios ES y EN y falla si un texto visible aún llama
// «propietario», «dueño», «lector», «owner» o «viewer» a un puesto. Los valores técnicos del código y de la base no se tocan.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {ROL_ES} from '../src/lib/team/vista.mjs';
import {textoSoloPara, MODOS} from '../src/lib/copiloto/modos.mjs';
import fs from 'node:fs';
import {DATABASE_ACTION_ROLES} from '@vexa/platform/capabilities';

const ESP = es as Record<string, string>, ING = en as Record<string, string>;

// Las claves donde «owner» era la PERSONA RESPONSABLE de una acción, intervención o recomendación ya no usan «owner» en inglés (se prestaba a confundirse
// con el puesto «Workspace administrator»): dicen «Assignee» o «Responsible», según la pantalla. En español ya decían «responsable».
const RESPONSABLE = new Set([
  'recs.responsable', 'recs.respTodos', 'recs.sinResp', 'recs.subEnCurso', 'recs.kSinResp', 'recs.pConResp', 'recs.notaResp',
  'acc.responsable', 'acc.respLinea', 'acc.respRec', 'interv.thResp', 'prob.tabGestionarHint',
  'tr.brief.responsable', 'tr.ec.docResp', 'tr.ws.afResp',
  'tr.iv.btnReasignar', 'tr.iv.lblResponsable', 'tr.iv.notaReasig', 'tr.iv.nuevoResp', 'tr.iv.respAsig', 'tr.iv.respOriginal',
  'tr.iv.respPlan', 'tr.iv.respRegistro', 'tr.iv.respSin', 'tr.iv.selResp',
]);
// «lector»/«reader» en otro sentido: lector de pantalla (accesibilidad).
const OTRO_SENTIDO = /lectores? de pantalla|screen readers?|\{\w+\}/gi; // también quita los nombres de las {variables}
const ES_MAL = /propiet|dueñ|\blectora?e?s?\b/i;
const EN_MAL = /\bowners?\b|\bviewers?\b/i;

test('ningún texto visible de es.ts llama propietario/dueño/lector al puesto', () => {
  const malos = Object.entries(ESP).filter(([, v]) => ES_MAL.test(v.replace(OTRO_SENTIDO, ' '))).map(([k, v]) => `${k}: ${v}`);
  assert.deepEqual(malos, []);
});
test('ningún texto visible de en.ts llama owner/viewer al puesto', () => {
  const malos = Object.entries(ING).filter(([, v]) => EN_MAL.test(v.replace(OTRO_SENTIDO, ' '))).map(([k, v]) => `${k}: ${v}`);
  assert.deepEqual(malos, []);
});
test('las claves de «responsable» existen, dicen «responsable» en español y «Assignee/Responsible» (nunca «owner») en inglés', () => {
  for (const k of RESPONSABLE) {
    assert.ok(k in ESP && k in ING, 'la clave ya no existe: ' + k);
    assert.ok(!ES_MAL.test(ESP[k]), 'el español nombra el puesto: ' + k);
    assert.match(ESP[k], /responsable/i, 'el español ya no dice responsable: ' + k);
    assert.doesNotMatch(ING[k], /\bowners?\b/i, 'el inglés aún dice owner: ' + k);
    assert.match(ING[k], /assign|responsible/i, 'el inglés no dice Assignee/Responsible: ' + k);
  }
});
test('las cuatro etiquetas de rol son las oficiales en todas las pantallas que las repiten', () => {
  const OFICIAL = {es: {owner: 'Administrador del espacio', analyst: 'Analista', operator: 'Operador', viewer: 'Lectura'}, en: {owner: 'Workspace administrator', analyst: 'Analyst', operator: 'Operator', viewer: 'Read-only'}};
  for (const [idioma, dic] of [['es', ESP], ['en', ING]] as const) {
    for (const rol of ['owner', 'analyst', 'operator', 'viewer'] as const) {
      const esperado = OFICIAL[idioma][rol];
      assert.equal(dic['shell.rol.' + rol], esperado, `${idioma} shell.rol.${rol}`);
      assert.equal(dic['conx.e.rol.' + rol], esperado, `${idioma} conx.e.rol.${rol} (pantalla Equipo e invitar)`);
    }
    assert.equal(dic['tr.acc.rolOwner'], OFICIAL[idioma].owner, idioma + ' tr.acc.rolOwner');
    assert.equal(dic['tr.acc.rolViewer'], OFICIAL[idioma].viewer, idioma + ' tr.acc.rolViewer');
  }
  assert.deepEqual(Object.values(ROL_ES), ['Administrador del espacio', 'Analista', 'Operador', 'Lectura']);
});
test('textos de roles fuera de los diccionarios (Hoy, aviso de área restringida, pie de plataforma)', () => {
  assert.equal(textoSoloPara(MODOS.cfo), 'Esta área es solo para administradores del espacio y analistas');
  const hoy = fs.readFileSync(new URL('../src/components/hoy/hoy-textos.mjs', import.meta.url), 'utf8');
  assert.match(hoy, /propietariosAnalistas: 'Lo ven administradores del espacio y analistas\.'/);
  assert.match(hoy, /propietariosAnalistas: 'Visible to workspace administrators and analysts\.'/);
  assert.doesNotMatch(hoy, /propietarios y analistas|owners and analysts/);
  assert.equal(ESP['cop.rol.owner'], 'administradores del espacio');
  assert.equal(ING['cop.rol.owner'], 'workspace administrators');
  assert.match(ESP['tr.pl.rolesFoot'], /administradores del espacio/);
  assert.match(ING['tr.pl.rolesFoot'], /Workspace administrators \{owner\}.*Read-only \{viewer\}/);
});
test('gramática: la etiqueta de rol no aparece repetida en una misma frase larga', () => {
  for (const dic of [ESP, ING]) for (const [k, v] of Object.entries(dic)) {
    const n = (v.match(/administradores? del espacio|workspace administrators?/gi) ?? []).length;
    if (!/^(onb|conx\.e|shell|cop\.rol|tr\.pl\.rolesFoot|tr\.acc)/.test(k)) assert.ok(n <= 2, `${k} repite el rol ${n} veces: ${v}`);
  }
});

// La pantalla Equipo no promete lo que la regla real no da: solo quien tiene `approve` «aprueba»; `execute` es de operador; `propose` de analista y operador.
test('Equipo (conx.e.d.*) describe las capacidades reales de cada rol y no dice que analista u operador deciden', () => {
  const R = DATABASE_ACTION_ROLES;
  assert.deepEqual([...R.approve], ['owner']);
  for (const rol of ['analyst', 'operator'] as const) {
    assert.ok(R.propose.includes(rol), rol + ' propone');
    assert.ok(!R.approve.includes(rol), rol + ' no aprueba');
    assert.doesNotMatch(ESP['conx.e.d.' + rol], /\bdecid|\bdecide\b/i);
    assert.doesNotMatch(ING['conx.e.d.' + rol], /\bdecides?\b|\bacts on\b/i);
    assert.match(ESP['conx.e.d.' + rol], /Propone/);assert.match(ESP['conx.e.d.' + rol], /no aprueba/);
    assert.match(ING['conx.e.d.' + rol], /Proposes/);assert.match(ING['conx.e.d.' + rol], /cannot approve/);
  }
  assert.ok(R.execute.includes('operator') && !R.execute.includes('analyst'));
  assert.match(ESP['conx.e.d.operator'], /ejecuta/);assert.doesNotMatch(ESP['conx.e.d.analyst'], /ejecuta/);
  assert.ok(R.import.includes('analyst'));assert.match(ESP['conx.e.d.analyst'], /importa/);
  assert.match(ESP['conx.e.d.owner'], /aprueba/);
  // El recorrido dice lo mismo que la pantalla a la que manda.
  assert.match(ESP['onb.propietario.acciones.cuerpo'], /Solo el administrador del espacio aprueba/);
});
