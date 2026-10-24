import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCommands, norm, pushRecent, rank, readRecents, writeRecents, RECENTS_KEY} from '../src/lib/platform/palette';
const ID = '02000000-0000-4000-8000-000000000002';
test('paleta: acentos y mayúsculas no importan; todas las palabras deben aparecer', () => {
  assert.equal(norm('  Mérida Ñ '), 'merida n');
  const cmds = buildCommands([{id: 'a1', name: 'Comercializadora Mérida', member: false}, {id: 'b2', name: 'Distribuidora Norte', member: true}], [{href: '/overview', label: 'Hoy'}], false);
  assert.deepEqual(rank(cmds, 'merida').map(c => c.id), ['f:a1', 'v:a1']); assert.deepEqual(rank(cmds, 'norte abrir').map(c => c.id), ['o:b2']); assert.equal(rank(cmds, 'zzz').length, 0);
});
test('paleta: miembro = «Abrir»; no miembro = «Ver como»; en modo soporte no se ofrece abrir otro soporte', () => {
  const clients = [{id: 'a1', name: 'A', member: false}, {id: 'b2', name: 'B', member: true}];
  assert.ok(buildCommands(clients, [], false).some(c => c.kind === 'client-view-as')); assert.ok(!buildCommands(clients, [], true).some(c => c.kind === 'client-view-as'));
  assert.ok(buildCommands(clients, [], true).some(c => c.kind === 'client-open'));
});
test('recientes: el reciente sube; máximo 5; el almacenamiento roto no rompe nada', () => {
  const cmds = buildCommands([{id: 'a1', name: 'Cliente Uno', member: false}, {id: 'b2', name: 'Cliente Dos', member: false}], [], false);
  assert.equal(rank(cmds, 'cliente', ['b2'])[0].id, 'f:b2'); assert.deepEqual(pushRecent(['x', 'y', 'z', 'w', 'v'], 'q'), ['q', 'x', 'y', 'z', 'w']); assert.deepEqual(pushRecent(['x', 'y'], 'y'), ['y', 'x']);
  assert.deepEqual(readRecents({getItem: () => { throw new Error('bloqueado'); }}), []); assert.deepEqual(readRecents({getItem: () => '{"x":1}'}), []); assert.deepEqual(readRecents({getItem: () => '["no-uuid","02000000-0000-4000-8000-000000000002"]'}), [ID]);
  let saved = ''; writeRecents({setItem: (k, v) => { assert.equal(k, RECENTS_KEY); saved = v; }}, [ID]); assert.equal(saved, JSON.stringify([ID])); assert.doesNotThrow(() => writeRecents({setItem: () => { throw new Error('cuota'); }}, [ID]));
});
