// L2 (QA-2): «Avisos» y «Retención» usaban el icono de ajustes (el «sol» del selector de tema). Cada ítem de Administración tiene su propio icono semántico.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MENU} from '../src/lib/workspace/menu.mjs';
const iconos = readFileSync(new URL('../src/components/workspace/icon.tsx', import.meta.url), 'utf8');
const dibujo = n => (iconos.match(new RegExp("\\b" + n + ":'([^']+)'")) ?? [])[1];
const items = MENU.flatMap(x => x.tipo === 'item' ? [x] : x.items ?? []);
const de = href => items.find(i => i.href === href);
test('Avisos y Retención tienen icono propio, definido y distinto del de ajustes (el sol del tema) y entre sí', () => {
  const avisos = de('/settings/notifications').icono, retencion = de('/settings/retention').icono;
  assert.notEqual(avisos, 'settings'); assert.notEqual(retencion, 'settings'); assert.notEqual(avisos, retencion);
  for (const n of [avisos, retencion]) assert.ok(dibujo(n), 'el icono ' + n + ' está dibujado');
  assert.notEqual(dibujo(avisos), dibujo('notifications'), 'distinto de la campana de Notificaciones');
});
test('ningún icono del menú cae al dibujo por omisión (briefs) por no estar definido', () => {
  const sin = items.filter(i => i.icono && i.icono !== 'briefs' && !dibujo(i.icono)).map(i => i.href + ':' + i.icono);
  assert.deepEqual(sin, []);
});
