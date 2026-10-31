// Guarda de dependencias (cierre de seguridad 31-oct, T52): falla si next o nodemailer bajan de la version corregida.
// next < 16.4.3: GHSA-673q-mjm6-r5xr y GHSA-2464-fhr4-w9xw (RCE sin autenticacion) y GHSA-p3m5-59mp-jv5r. nodemailer < 10.3.1: cinco avisos de addressparser y SMTP AUTH.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const leer = (...p) => JSON.parse(readFileSync(path.join(REPO, ...p), 'utf8'));
const partes = v => {
  const m = /^[\^~>=\s]*(\d+)\.(\d+)\.(\d+)/.exec(String(v));
  assert.ok(m, `version no interpretable: ${v}`);
  return m.slice(1).map(Number);
};
const cmp = (a, b) => { const x = partes(a), y = partes(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

const MINIMOS = [
  {nombre: 'next', minimo: '16.4.3', manifiestos: [['apps', 'web', 'package.json']]},
  {nombre: 'nodemailer', minimo: '10.3.1', manifiestos: [['packages', 'notifications', 'package.json']]},
];

for (const {nombre, minimo, manifiestos} of MINIMOS) {
  test(`${nombre} declarado >= ${minimo}`, () => {
    for (const m of manifiestos) {
      const pkg = leer(...m);
      const declarada = pkg.dependencies?.[nombre] ?? pkg.devDependencies?.[nombre];
      assert.ok(declarada, `${nombre} no esta declarado en ${m.join('/')}`);
      assert.ok(cmp(declarada, minimo) >= 0, `${nombre} ${declarada} < ${minimo} en ${m.join('/')}`);
    }
  });
  test(`${nombre} resuelto en package-lock.json >= ${minimo}`, () => {
    const lock = leer('package-lock.json');
    const entradas = Object.entries(lock.packages).filter(([k]) => k === `node_modules/${nombre}` || k.endsWith(`/node_modules/${nombre}`));
    assert.ok(entradas.length > 0, `${nombre} ausente del lock`);
    for (const [k, v] of entradas) assert.ok(cmp(v.version, minimo) >= 0, `${k} resuelve ${v.version} < ${minimo}`);
  });
}

test('comparador de versiones', () => {
  assert.ok(cmp('16.3.8', '16.4.3') < 0);
  assert.ok(cmp('16.4.3', '16.4.3') === 0);
  assert.ok(cmp('^16.10.0', '16.4.3') > 0);
  assert.ok(cmp('10.1.3', '10.3.1') < 0);
});
