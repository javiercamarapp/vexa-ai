// N5 (QA-2): Problemas tardaba más en la segunda visita que en la primera. El botón «Catálogo» pedía /api/problems (otra verificación de resumen de ~7 s) a la vez que la lectura principal.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src = readFileSync(new URL('../../src/components/workspace/current-problems.tsx', import.meta.url), 'utf8');
test('el catálogo no se pide al montar: espera a que la pantalla quede quieta o a que se abra', () => {
  assert.match(src, /useJson<Problem\[\]>\(pedir\|\|open\?'\/api\/problems':null,problems\)/);
  assert.match(src, /requestIdleCallback/); assert.match(src, /setPedir\(true\);setOpen\(true\)/);
});
test('con la respuesta mínima (sin ids de miembros) muestra el conteo real y no 0', () => {
  assert.match(src, /conversationCount\?:number/); assert.match(src, /conversaciones\(row\)/);
  assert.ok(!/row\.conversationIds\.length/.test(src));
});
