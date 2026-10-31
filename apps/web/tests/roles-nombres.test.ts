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

const ESP = es as Record<string, string>, ING = en as Record<string, string>;

// Excepciones justificadas: «owner» en inglés aquí es la PERSONA RESPONSABLE de una acción, intervención o recomendación (no el puesto de la organización).
// Su texto en español ya dice «responsable». Cualquier clave nueva con «owner»/«propietario» que no esté aquí hace fallar la prueba.
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
  const malos = Object.entries(ESP).filter(([k, v]) => !RESPONSABLE.has(k) && ES_MAL.test(v.replace(OTRO_SENTIDO, ' '))).map(([k, v]) => `${k}: ${v}`);
  assert.deepEqual(malos, []);
});
test('ningún texto visible de en.ts llama owner/viewer al puesto', () => {
  const malos = Object.entries(ING).filter(([k, v]) => !RESPONSABLE.has(k) && EN_MAL.test(v.replace(OTRO_SENTIDO, ' '))).map(([k, v]) => `${k}: ${v}`);
  assert.deepEqual(malos, []);
});
test('las excepciones de «responsable» existen y siguen diciendo «responsable» en español (no son el puesto)', () => {
  for (const k of RESPONSABLE) {
    assert.ok(k in ESP && k in ING, 'la excepción ya no existe: ' + k);
    assert.ok(!ES_MAL.test(ESP[k]), 'el español de una excepción nombra el puesto: ' + k);
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
  assert.match(ESP['tr.pl.rolesFoot'], /administrador del espacio/);
  assert.match(ING['tr.pl.rolesFoot'], /Workspace administrators \{owner\}.*Read-only \{viewer\}/);
});
test('gramática: la etiqueta de rol no aparece repetida en una misma frase larga', () => {
  for (const dic of [ESP, ING]) for (const [k, v] of Object.entries(dic)) {
    const n = (v.match(/administradores? del espacio|workspace administrators?/gi) ?? []).length;
    if (!/^(onb|conx\.e|shell|cop\.rol|tr\.pl\.rolesFoot|tr\.acc)/.test(k)) assert.ok(n <= 2, `${k} repite el rol ${n} veces: ${v}`);
  }
});
