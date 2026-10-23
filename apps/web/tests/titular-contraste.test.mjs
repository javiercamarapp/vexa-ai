// M4 (QA-2): el titular de Fuga ($354,780) salia gris (--muted) porque `.workspace-content :where(section,article,fieldset)>p:first-of-type` (0,2,1)
// ganaba a `.workspace-content .fg-big` (0,2,0). Comprueba por especificidad que el selector del titular gana a esa regla.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css = readFileSync(new URL('../src/components/refunds/fuga.css', import.meta.url), 'utf8'), globals = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const especificidad = sel => { const s = sel.replace(/:where\([^)]*\)/g, ''); return [(s.match(/#[\w-]+/g) || []).length, (s.match(/\.[\w-]+|:(?!:)[\w-]+|\[[^\]]+\]/g) || []).length, (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length]; };
const mayor = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
test('el titular de Fuga usa --ink y su selector gana a la regla de párrafo gris de globals.css', () => {
  const regla = css.match(/(\.workspace-content \.fg-big,[^{]*)\{margin:0;color:var\(--ink\)/);
  assert.ok(regla, 'regla del titular con color --ink');
  // Desde el sistema de UI la regla gris de globals.css es de especificidad CERO (:where completo): cualquier clase de componente la supera.
  const gris = globals.match(/(:where\(\.workspace-content :where\(section,article,fieldset\):not\(\.ui-reset\)\)>p:first-of-type)\s*\{\s*color:var\(--muted\)/);
  assert.ok(gris, 'regla gris de globals.css (en :where)');
  const selectores = regla[1].split(','), mejor = selectores.map(especificidad).reduce((m, e) => mayor(e, m) ? e : m, [0, 0, 0]);
  assert.ok(mayor(mejor, [0, 1, 1]) || mejor[1] >= 2, `la especificidad del titular ${mejor} debe superar a la regla gris (0,1,1)`);
});
