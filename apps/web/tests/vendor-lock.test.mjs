// Bibliotecas de terceros vendoreadas en public/vendor: solo Lenis, con hash verificado, licencia, versión en el nombre y sin CDN. GSAP y ScrollTrigger se retiraron del producto.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const raiz = join(import.meta.dirname, '..');
const leer = (rel) => readFileSync(join(raiz, rel), 'utf8');

test('vendor.lock.json lista exactamente los .js de public/vendor y cada hash coincide', () => {
  const lock = JSON.parse(leer('public/vendor/vendor.lock.json')).archivos;
  const enDisco = readdirSync(join(raiz, 'public/vendor')).filter((f) => f.endsWith('.js')).sort();
  assert.deepEqual(lock.map((x) => x.archivo).sort(), enDisco, 'archivos de vendor fuera del lock o huérfanos');
  for (const x of lock) {
    assert.equal(createHash('sha256').update(readFileSync(join(raiz, 'public/vendor', x.archivo))).digest('hex'), x.sha256, x.archivo);
    assert.match(x.archivo, /-\d+\.\d+\.\d+\.min\.js$/, 'versión en el nombre: ' + x.archivo);
    assert.ok(x.licencia && x.origen.startsWith('https://') && x.version, x.archivo);
  }
});
test('Lenis 1.1.13 es la única biblioteca vendoreada: GSAP, ScrollTrigger y three.js no están', () => {
  assert.deepEqual(readdirSync(join(raiz, 'public/vendor')).filter((f) => f.endsWith('.js')), ['lenis-1.1.13.min.js']);
  for (const f of ['gsap-3.13.0.min.js', 'ScrollTrigger-3.13.0.min.js', 'three']) assert.ok(!existsSync(join(raiz, 'public/vendor', f)), f);
  const lic = leer('public/vendor/LICENSES.txt');
  assert.ok(lic.includes('Lenis 1.1.13') && lic.includes('MIT'));
  assert.doesNotMatch(lic.replace(/Nota de licencia GSAP[\s\S]*$/, ''), /GSAP 3|ScrollTrigger 3/, 'las licencias de lo retirado no se listan como vigentes');
});
test('sin dependencias de animación o 3D en package.json y con script-src propio en la política de contenido', () => {
  const pkg = JSON.parse(leer('package.json'));
  for (const d of Object.keys({...pkg.dependencies, ...pkg.devDependencies})) assert.doesNotMatch(d, /gsap|lenis|^three$|^ogl$|framer-motion|gltf|sharp/, d);
  assert.match(leer('next.config.ts'), /script-src 'self'/);
});
