import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
/** «use client» debe ser la primera sentencia del archivo (solo comentarios antes): si no, `next build` falla en producción aunque tsc y las pruebas pasen. */
const raiz=join(import.meta.dirname,'../src');
const archivos=d=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?archivos(p):/\.(tsx?|jsx?|mjs)$/.test(n)?[p]:[];});
test('«use client» va antes de cualquier import o código', () => {
  const malos=[];
  for (const f of archivos(raiz)) {
    const s=readFileSync(f,'utf8'), m=/^\s*['"]use client['"];?/m.exec(s);
    if (!m) continue;
    const antes=s.slice(0,m.index).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'').trim();
    if (antes) malos.push(f.replace(raiz+'/',''));
  }
  assert.deepEqual(malos,[],'«use client» fuera de la primera línea: '+malos.join(', '));
});
