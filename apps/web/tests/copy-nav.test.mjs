// Copy visible al cliente: marca «Rovaq», sin jerga en el menú, nombres de pantalla = nombres del menú.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalog} from '../../../packages/notifications/catalog.mjs';
import {MENU, tituloDePantalla} from '../src/lib/workspace/menu.mjs';
import {es} from '../src/lib/i18n/es';
const leer = (rel) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

test('los avisos que ve el cliente dicen Rovaq, nunca VEXA (catálogo de preferencias y carga útil del aviso push)', () => {
  for (const e of catalog) assert.ok(!/VEXA/.test(e.label + e.description), e.type);
  for (const f of ['../../packages/notifications/push.mjs', '../../packages/notifications/worker.mjs']) assert.ok(!/title:'VEXA'|en VEXA/.test(leer(f)), f);
});
test('el menú no usa jerga: ni «Gestión económica», ni «Gestionar problemas», ni «Intervenciones» como rótulo', () => {
  const rotulos = MENU.flatMap((e) => (e.tipo === 'grupo' ? [e.etiqueta, ...e.items.map((i) => i.etiqueta)] : [e.etiqueta]));
  for (const malo of ['Gestión económica', 'Gestionar problemas', 'Intervenciones', 'Notificaciones']) assert.ok(!rotulos.includes(malo), malo);
  assert.ok(rotulos.includes('Acciones') && rotulos.includes('Cortes publicados'));
});
test('el título de pestaña de cada pantalla renombrada coincide con el menú', () => {
  const metas = {'src/app/(app)/(workspace)/cfo/page.tsx': 'CFO', 'src/app/(app)/(workspace)/economics/page.tsx': 'Cortes publicados', 'src/app/(app)/(workspace)/interventions/page.tsx': 'Acciones', 'src/app/(app)/(workspace)/connections/page.tsx': 'Fuentes conectadas', 'src/app/(app)/(workspace)/history/page.tsx': 'Histórico e identidad'};
  for (const [f, titulo] of Object.entries(metas)) assert.equal(es[/metaTitulo\(\s*'(meta\.titulo\.[a-z0-9-]+)'/.exec(leer(f))?.[1]], titulo, f);
  assert.equal(tituloDePantalla('/cfo'), 'CFO'); assert.equal(tituloDePantalla('/economics'), 'Cortes publicados'); assert.equal(tituloDePantalla('/interventions'), 'Acciones');
  assert.equal(tituloDePantalla('/connections'), 'Fuentes conectadas'); assert.equal(tituloDePantalla('/history'), 'Histórico e identidad');
});
