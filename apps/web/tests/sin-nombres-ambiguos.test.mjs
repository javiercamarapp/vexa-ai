// El build de producción resuelve «./x» al .mjs aunque exista x.tsx (en desarrollo gana el .tsx): un componente quedaba undefined y /cfo fallaba con React #130.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
const raiz = new URL('../src', import.meta.url).pathname;
const archivos = (d) => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? archivos(p) : [p]; });
test('ningún módulo .tsx/.ts comparte nombre base con un .mjs (importar sin extensión sería ambiguo)', () => {
  const base = f => f.replace(/\.(tsx|ts|mjs)$/, '');
  const todos = archivos(raiz).filter(f => /\.(tsx|ts|mjs)$/.test(f) && !/\.d\.m?ts$/.test(f));
  const vistos = new Map(), duplicados = [];
  for (const f of todos) { const b = base(f); if (vistos.has(b)) duplicados.push(b.replace(raiz, '')); vistos.set(b, f); }
  assert.deepEqual(duplicados, []);
});
