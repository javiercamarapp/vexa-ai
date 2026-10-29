import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
/** Medidas del sistema UI en las rutas de superadmin. /sin-acceso y /seguridad exigen sesión real en producción, así que aquí se verifica por estructura
 *  (clases y reglas CSS); la medición real en pantalla la hace tests/ui/choques.mjs con fixtures (VEXA_UI_FIXTURES_PLATFORM=1). */
const src=join(import.meta.dirname,'../src');
const leer=r=>readFileSync(join(src,r),'utf8');
const ui=leer('app/(app)/ui.css'),platformUi=leer('components/platform/platform-ui.css'),admin=leer('components/platform/admin-tools.css');

test('pantallas de acceso del sistema: H1 de 20 px (--t-page) y clase acceso-sistema en las tres', () => {
  assert.match(ui,/body \.access-flow\.acceso-sistema h1\{font:600 var\(--t-page\)/);
  assert.match(ui,/--t-page:20px/);
  for(const f of ['components/sin-acceso-vista.tsx','app/(app)/seguridad/page.tsx','app/(app)/platform/layout.tsx'])assert.match(leer(f),/access-flow acceso-sistema/,f);
  for(const f of ['components/sin-acceso-vista.tsx','app/(app)/seguridad/page.tsx','app/(app)/platform/layout.tsx'])assert.doesNotMatch(leer(f),/role="alert"/,f+': los avisos usan <Notice>');
});
test('botón «Cambiar de cliente»: estilo propio en la barra (no hereda el primario negro) y chip ⌘K legible', () => {
  assert.match(leer('components/platform/admin-tools.tsx'),/className="at-trigger"/);
  const t=admin.match(/\.workspace-header \.at-trigger\s*\{([^}]*)\}/)?.[1]??'';
  assert.match(t,/background: var\(--ui-surface\)/);assert.match(t,/border: 1px solid var\(--ui-input\)/);
  assert.match(admin,/\.at-trigger \.at-kbd\s*\{[^}]*color: var\(--ui-secondary\)/);
});
test('paleta ⌘K: la fila seleccionada no deja texto oscuro sobre fondo oscuro', () => {
  assert.match(admin,/\.at-fila\[aria-selected=true\]\s*\{[^}]*color: var\(--ui-nav-text\)/);
});
test('tablas de plataforma: el botón de orden no se encoge (texto pegado al borde) y el rótulo de selección existe en celular', () => {
  assert.match(platformUi,/\.pf-table th \.pf-sort\{[^}]*max-width:none/);
  assert.match(platformUi,/td\.pf-check::after\{content:"Seleccionar"/);
});
test('fichas con 5 o 6 tarjetas llenan la fila (sin zona vacía) y las tarjetas no heredan el margen de <article>', () => {
  assert.match(platformUi,/\.pf-tiles>\.pf-tile\{margin:0\}/);
  assert.match(platformUi,/\.pf-tiles-6\{grid-template-columns:repeat\(3/);
  assert.match(platformUi,/\.pf-tiles-5\{grid-template-columns:repeat\(5/);
  assert.match(leer('components/platform/org-ficha.tsx'),/pf-tiles pf-tiles-6/);
});
