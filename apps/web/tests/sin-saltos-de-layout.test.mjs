// M3 (QA-2): el aviso «Mostrando la última carga» y la píldora «Datos nuevos · actualizar» no deben mover el contenido al aparecer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css = n => readFileSync(new URL('../src/' + n, import.meta.url), 'utf8');
test('el aviso de caché y su hueco reservado miden lo mismo (misma variable de alto mínimo, también en pantallas angostas)', () => {
  const ui = css('app/ui.css');
  const aviso = ui.match(/\.state-cache\{[^}]*min-height:var\(--cache-alto,(\d+)px\)/), hueco = ui.match(/\.state-cache-slot\{[^}]*min-height:var\(--cache-alto,(\d+)px\)/);
  assert.ok(aviso && hueco && aviso[1] === hueco[1], 'aviso y hueco comparten --cache-alto');
  assert.match(ui, /@media \(max-width:520px\)\{:root\{--cache-alto:(\d+)px\}\}/);
  assert.match(ui, /\.state-cache\{[^}]*box-sizing:border-box/); assert.match(ui, /\.state-cache-slot\{[^}]*box-sizing:border-box/);
});
test('la píldora no encoge ni parte el encabezado: no se encoge y el título recorta con puntos suspensivos en vez de saltar de línea', () => {
  const dn = css('components/workspace/datos-nuevos.css');
  assert.match(dn, /\.datos-nuevos\{flex:none;white-space:nowrap\}/); assert.match(dn, /\.workspace-heading\{[^}]*text-overflow:ellipsis/);
  assert.match(css('app/globals.css'), /\.workspace-header \{ height:56px;/);
});
