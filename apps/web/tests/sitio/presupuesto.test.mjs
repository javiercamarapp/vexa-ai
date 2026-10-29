// Presupuestos de peso (SPEC sección 8): tabla, clasificación, brotli, techo, crecimiento de 5 %
// contra la línea base y activos fuera del manifest. La medición con Chrome vive en
// tools/sitio/presupuesto.mjs y se prueba aparte contra el arnés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarPresupuestos, clasificar, bytesTransferidos, sumar, evaluarEscenario, limitesPorTipo, verificarActivos, RUTA_BASE } from '../../../../tools/sitio/presupuesto.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = cargarPresupuestos();
const KB = 1024;

test('presupuestos.json trae la tabla de la sección 8', () => {
  // Recalibrada el 29-oct (T15): sin nube, pts ni Lenis; el recorrido pasa de objetivo 700 y techo 850 a objetivo 618 y techo 700.
  const esperado = { critico: [328, 388], inicial3d: [332, 392], recorrido: [618, 700], sinWebglCritico: [328, 388], sinWebglRecorrido: [474, 534] };
  for (const [n, [obj, techo]] of Object.entries(esperado)) {
    assert.equal(P.escenarios[n].objetivoKB, obj, n);
    assert.equal(P.escenarios[n].techoKB, techo, n);
  }
  assert.equal(P.crecimientoMaxPct, 5);
});

test('las columnas de cada escenario suman su objetivo (con holgura de 8 KB de redondeo)', () => {
  for (const [n, e] of Object.entries(P.escenarios)) {
    const suma = Object.values(e.columnasKB).reduce((a, b) => a + b, 0);
    assert.ok(suma <= e.objetivoKB && e.objetivoKB - suma <= 8, `${n}: suma ${suma} vs objetivo ${e.objetivoKB}`);
    assert.ok(e.techoKB > e.objetivoKB, n);
  }
});

test('clasificar reparte las respuestas en las columnas de la tabla', () => {
  const c = (u, t, ct) => clasificar('https://rovaq.ai' + u, t, ct);
  assert.equal(c('/', 'document', 'text/html'), 'html');
  assert.equal(c('/s/sitio.abc.css'), 'css');
  assert.equal(c('/_next/static/chunks/a.js'), 'jsNext');
  assert.equal(c('/s/inicio.12345678.js'), 'jsPropio');
  assert.equal(c('/vendor/lenis-1.1.13/lenis.min.js'), 'jsPropio');
  assert.equal(c('/s/fuentes/a.woff2'), 'fuentes');
  assert.equal(c('/s/img/p.avif'), 'imagenes');
  assert.equal(c('/s/pts/hero.abc.pts'), 'datos3d');
  assert.equal(c('/s/manifest.json'), 'otros');
});

test('bytesTransferidos aplica brotli al texto y deja crudos los binarios comprimidos', () => {
  const texto = Buffer.from('a'.repeat(50_000));
  assert.ok(bytesTransferidos(texto, 'https://x/a.css') < 200);
  assert.equal(bytesTransferidos(texto, 'https://x/a.woff2'), 50_000);
  assert.equal(bytesTransferidos(texto, 'https://x/a.webp'), 50_000);
  assert.equal(bytesTransferidos(texto, 'https://x/s/pts/h.pts'), 50_000);
  assert.equal(bytesTransferidos(Buffer.alloc(0), 'https://x/a.js'), 0);
});

test('techo: falla por encima del techo, avisa entre objetivo y techo, pasa por debajo', () => {
  const pres = P.escenarios.critico;
  const med = (kb) => ({ total: kb * KB });
  assert.equal(evaluarEscenario(med(300), pres).fallas.length, 0);
  const aviso = evaluarEscenario(med(350), pres);
  assert.equal(aviso.fallas.length, 0);
  assert.equal(aviso.avisos.length, 1);
  assert.equal(evaluarEscenario(med(389), pres).fallas.length, 1);
});

test('crecimiento: más de 5 % contra la línea base falla, 5 % exacto pasa', () => {
  const pres = P.escenarios.recorrido;
  const base = { total: 600 * KB };
  assert.equal(evaluarEscenario({ total: 630 * KB }, pres, base).fallas.length, 0);
  const r = evaluarEscenario({ total: 631 * KB }, pres, base);
  assert.equal(r.fallas.length, 1);
  assert.ok(r.crecimientoPct > 5);
  assert.equal(evaluarEscenario({ total: 500 * KB }, pres, base).fallas.length, 0, 'bajar nunca falla');
});

test('sin línea base queda marcado como pendiente, no como falla', () => {
  const r = evaluarEscenario({ total: 300 * KB }, P.escenarios.critico, undefined);
  assert.equal(r.sinBase, true);
  assert.equal(r.fallas.length, 0);
});

test('fuentes sobre 130 KB y objetos de escena sobre 50 KB fallan', () => {
  const items = [
    { columna: 'fuentes', bytes: 140 * KB, url: 'https://x/a.woff2' },
    { columna: 'datos3d', bytes: 60 * KB, url: 'https://x/s/pts/o1.pts' },
    { columna: 'datos3d', bytes: 55 * KB, url: 'https://x/s/pts/hero.pts' },
  ];
  const f = limitesPorTipo(items, P.limitesPorTipoKB);
  assert.equal(f.length, 2);
  assert.deepEqual(sumar(items).columnas.fuentes, 140 * KB);
});

test('verificarActivos: archivo fuera del manifest y GLB en public/ fallan', () => {
  const d = mkdtempSync(join(tmpdir(), 'pub-'));
  mkdirSync(join(d, 's'), { recursive: true });
  writeFileSync(join(d, 's', 'manifest.json'), JSON.stringify({ js: { sitio: '/s/sitio.abc12345.js' } }));
  writeFileSync(join(d, 's', 'sitio.abc12345.js'), 'x');
  writeFileSync(join(d, 's', 'huerfano.js'), 'x');
  writeFileSync(join(d, 'objeto.glb'), 'x');
  const r = verificarActivos(d);
  assert.equal(r.pendiente, null);
  assert.equal(r.fallas.length, 2);
  assert.ok(r.fallas.some((x) => /huerfano/.test(x)) && r.fallas.some((x) => /glb/.test(x)));
});

const PUB = join(WEB, 'public');
const pend = existsSync(join(PUB, 's', 'manifest.json')) ? false : 'PENDIENTE: public/s/manifest.json aún no existe (lo emite T13)';
test('public/s y public/vendor solo contienen archivos del manifest y del lock; sin GLB', { skip: pend }, () => {
  const r = verificarActivos(PUB);
  assert.deepEqual(r.fallas, []);
});

test('línea base real del sitio', { skip: existsSync(RUTA_BASE) ? false : 'PENDIENTE: tools/sitio/presupuesto-base.json no existe; se guarda con --guardar-base tras el build final (T14)' }, () => {
  assert.ok(Object.keys(JSON.parse(readFileSync(RUTA_BASE, 'utf8'))).length > 0);
});
