// QA-2 (23-oct): al entrar a una pantalla se disparaban ~34 precargas `_rsc` de todo el menú y 7 daban 503. Se desactivó la precarga en WorkspaceLink;
// esta prueba cierra los demás disparadores: ningún componente puede usar el Link de next/link sin prefetch={false}, ni router.prefetch,
// y el calentamiento propio de datos conserva su tope de 2 peticiones.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {TOPE_PREFETCH} from '../src/lib/workspace/swr.mjs';

const SRC = join(import.meta.dirname, '../src');
function archivos(dir) { return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? archivos(p) : /\.(tsx|ts|jsx|mjs)$/.test(n) && !/\.test\./.test(n) ? [p] : []; }); }
const todos = archivos(SRC), rel = f => f.slice(SRC.length + 1);
/** Etiquetas de apertura <Link ...> (sin confundir con <LinkButton): se corta en el primer `>` fuera de llaves. */
function etiquetasLink(texto) {
  const r = [];
  for (const m of texto.matchAll(/<Link(?=\s)/g)) {
    let prof = 0, i = m.index + 5;
    for (; i < texto.length; i++) { const c = texto[i]; if (c === '{') prof++; else if (c === '}') prof--; else if (c === '>' && prof === 0 && texto[i - 1] !== '=') break; }
    r.push(texto.slice(m.index, i + 1));
  }
  return r;
}
test('todo import directo de next/link usa prefetch={false} en cada <Link> (solo WorkspaceLink decide la precarga)', () => {
  const directos = todos.filter(f => /from\s+['"]next\/link['"]/.test(readFileSync(f, 'utf8')));
  assert.ok(directos.length >= 10, 'se esperaban los Link directos conocidos: ' + directos.length);
  const malos = [];
  for (const f of directos) {
    if (rel(f).endsWith('workspace/navigation-lifecycle.tsx')) continue;
    for (const tag of etiquetasLink(readFileSync(f, 'utf8'))) if (!/prefetch=\{false\}/.test(tag)) malos.push(rel(f) + ': ' + tag.slice(0, 80));
  }
  assert.deepEqual(malos, [], 'Link sin prefetch={false}');
});
test('WorkspaceLink no precarga por omisión y nadie llama a router.prefetch', () => {
  const lifecycle = readFileSync(join(SRC, 'components/workspace/navigation-lifecycle.tsx'), 'utf8');
  assert.match(lifecycle, /<NextLink prefetch=\{false\} \{\.\.\.props\}/);
  const llamadas = todos.filter(f => /router\.prefetch\(|\.prefetch\(/.test(readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(llamadas, []);
});
test('quien pasa prefetch a WorkspaceLink lo hace de forma explícita (ninguna pantalla lo activa)', () => {
  const activan = todos.filter(f => !rel(f).endsWith('navigation-lifecycle.tsx') && /<Link[^>]*\sprefetch(?!=\{false\})/.test(readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(activan, []);
});
test('el calentamiento de datos mantiene su tope de 2 peticiones simultáneas', () => assert.equal(TOPE_PREFETCH, 2));
