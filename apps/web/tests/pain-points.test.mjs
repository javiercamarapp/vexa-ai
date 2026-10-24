// «Puntos de dolor»: modelo de burbujas determinista, formato sin ceros falsos, menú y ruta.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/pain-points.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {disponerBurbujas, mayores, valorDe, radioDe, rejilla, R_MIN, R_MAX, MAX_BURBUJAS, SEPARACION, TEMAS_ORDEN} from '../src/components/pain-points/burbujas-modelo.mjs';
import {usdCorto, dineroTxt, volumenTxt, periodoTxt, kpisDe, SIN_DATO, etiquetaBurbuja} from '../src/components/pain-points/modelo.mjs';
import {PIE, pieVisible, itemActivo, tituloDePantalla, iconoDePantalla, menuVisible} from '../src/lib/workspace/menu.mjs';
import {vistaPain, evidenciaPain} from './ui/pain-sintetico.mjs';

const V = vistaPain();
const punto = (id, tema, minor, n = 10) => ({id, tema, nombre: id, agregado: false, clase: 'O', dinero: minor == null ? {sinDato: true, causa: 'sin_fuente', motivo: 'x'} : {sinDato: false, tipo: 'bruto', currency: 'USD', exponent: 2, minor: String(minor)}, volumen: {sinDato: false, n, unidad: 'u'}});
const muchos = (k, tema = 'sku') => Array.from({length: k}, (_, i) => punto('Q' + String(i).padStart(2, '0'), tema, (i + 1) * 123456));

test('determinista: misma entrada → mismas posiciones, también con la entrada en otro orden', () => {
  const a = disponerBurbujas({puntos: V.puntos, modo: 'dinero', ancho: 840}), b = disponerBurbujas({puntos: V.puntos, modo: 'dinero', ancho: 840});
  assert.deepEqual(a, b);
  const barajado = [...V.puntos].reverse();
  assert.deepEqual(disponerBurbujas({puntos: barajado, modo: 'dinero', ancho: 840}).burbujas, a.burbujas);
  assert.ok(a.burbujas.length > 5);
});
for (const ancho of [360, 600, 840, 1200]) for (const modo of ['dinero', 'volumen']) test(`sin solapes, dentro de su cúmulo y con radio 14–64 px (ancho ${ancho}, ${modo})`, () => {
  const d = disponerBurbujas({puntos: V.puntos, modo, ancho});
  const todas = [...d.burbujas, ...d.masPorTema];
  for (const b of todas) {
    assert.ok(b.r >= R_MIN && b.r <= R_MAX, `${b.id} r=${b.r}`); assert.ok(b.valor > 0, 'jamás una burbuja de valor 0');
    const c = d.clusters.find(x => x.id === b.tema);
    assert.ok(b.cx - b.r >= c.region.x0 - 1e-6 && b.cx + b.r <= c.region.x1 + 1e-6 && b.cy - b.r >= c.region.y0 - 1e-6 && b.cy + b.r <= c.region.y1 + 1e-6, b.id + ' fuera de su cúmulo');
  }
  for (let i = 0; i < todas.length; i++) for (let j = i + 1; j < todas.length; j++) assert.ok(Math.hypot(todas[i].cx - todas[j].cx, todas[i].cy - todas[j].cy) >= todas[i].r + todas[j].r + SEPARACION - 1e-6, `${todas[i].id} solapa ${todas[j].id}`);
  assert.equal(d.alto, rejilla(ancho).alto);
});
test('radio = raíz del valor: el mayor mide 64 px, uno con la cuarta parte mide 32 px y el mínimo visible es 14 px (nunca se infla en silencio)', () => {
  assert.equal(radioDe(100, 100), R_MAX); assert.equal(radioDe(25, 100), 32); assert.equal(radioDe(0.0001, 100), R_MIN);
  const d = disponerBurbujas({puntos: [punto('A', 'sku', 1000000), punto('B', 'sku', 250000), punto('C', 'sku', 100)], modo: 'dinero'});
  const r = Object.fromEntries(d.burbujas.map(b => [b.id, b])); assert.equal(r.A.r, 64); assert.equal(r.B.r, 32); assert.equal(r.C.r, R_MIN); assert.equal(r.C.minimo, true); assert.ok(!r.A.minimo);
  assert.ok(R_MIN * 2 === 28 && R_MAX * 2 === 128);
});
test('máximo 24 burbujas: el resto se agrega en «+N más» por tema (con su suma) y la tabla sigue teniendo todos', () => {
  const ps = [...muchos(30, 'sku'), ...muchos(3, 'canales').map(p => ({...p, id: 'C' + p.id}))];
  const d = disponerBurbujas({puntos: ps, modo: 'dinero', ancho: 1200});
  assert.ok(d.burbujas.length <= MAX_BURBUJAS, String(d.burbujas.length));
  assert.equal(d.burbujas.length + d.masPorTema.reduce((a, m) => a + m.n, 0) + d.omitidas.reduce((a, m) => a + (m.n ?? 1), 0), 33, 'ninguno se pierde: o burbuja, o +N más, o está en omitidas');
  const mas = d.masPorTema.find(m => m.tema === 'sku'); assert.ok(mas && mas.n >= 6); assert.equal(mas.tipo, 'mas'); assert.ok(mas.r <= 40);
  assert.equal(mayores(ps, 'dinero', 8).length, 8);
});
test('desconocido ≠ 0: los sin dato no se dibujan (van a sinCifra), los agregados tampoco y un modo sin datos queda vacío', () => {
  const d = disponerBurbujas({puntos: [punto('A', 'sku', 5000), punto('S', 'canales', null), {...punto('G', 'sku', 99999999), agregado: true}], modo: 'dinero'});
  assert.deepEqual(d.burbujas.map(b => b.id), ['A']); assert.deepEqual(d.sinCifra.map(p => p.id), ['S']);
  assert.equal(valorDe(punto('Z', 'sku', 0), 'dinero'), null, 'cero no es dato dibujable');
  const vacio = disponerBurbujas({puntos: [punto('S', 'canales', null)], modo: 'dinero'}); assert.equal(vacio.burbujas.length, 0); assert.equal(vacio.escala.vmax, 1);
  assert.ok(V.puntos.find(p => p.id === 'P3').dinero.sinDato); assert.ok(!disponerBurbujas({puntos: V.puntos}).burbujas.some(b => b.id === 'P3'));
  assert.ok(disponerBurbujas({puntos: V.puntos}).sinCifra.some(p => p.id === 'P3'));
});
test('conmutador Dinero/Volumen: cambia el radio, no el cúmulo; en volumen entran puntos sin dinero (garantía, SLA)', () => {
  const din = disponerBurbujas({puntos: V.puntos, modo: 'dinero'}), vol = disponerBurbujas({puntos: V.puntos, modo: 'volumen'});
  assert.ok(!din.burbujas.some(b => b.id === 'P6') && vol.burbujas.some(b => b.id === 'P6'));
  const t = id => [...din.burbujas, ...vol.burbujas].find(b => b.id === id).tema;
  assert.equal(t('P2'), 'devoluciones'); assert.deepEqual(TEMAS_ORDEN, V.temas.map(x => x.id));
  const m = mayores(V.puntos, 'dinero'); assert.ok(m.every((p, i) => i === 0 || valorDe(m[i - 1], 'dinero') >= valorDe(p, 'dinero')), 'de mayor a menor');
});
test('formato: «Sin dato» y nunca $0 por falta de dato; periodo y etiqueta accesible completos', () => {
  assert.equal(dineroTxt({sinDato: true, causa: 'sin_fuente', motivo: ''}), SIN_DATO); assert.equal(volumenTxt({sinDato: true, causa: 'x', motivo: ''}), SIN_DATO);
  assert.equal(usdCorto('5205500'), '$52k'); assert.equal(usdCorto('123456789'), '$1.2 M'); assert.equal(usdCorto('85000'), '$850');
  assert.equal(periodoTxt({desde: '2026-07', hasta: '2026-09'}), 'jul 2026 – sep 2026'); assert.equal(periodoTxt(null), 'Sin periodo definido');
  assert.match(etiquetaBurbuja(V.puntos.find(p => p.id === 'P2'), 'Devoluciones y chargebacks', 'dinero'), /Devoluciones y chargebacks, Walmart: reembolsos pendientes de cerrar, USD 137.568,3?0?, Observado|USD 137,568/);
  const k = kpisDe(V); assert.equal(k.length, 4); assert.ok(k.every(x => x.valor !== '$0')); assert.equal(k[3].label, 'Puntos de dolor');
  assert.ok(!kpisDe(vistaPain({vacio: true})).some(x => /^\$/.test(x.valor)), 'sin lecturas no hay montos en la tira');
});
test('menú: «Puntos de dolor» fijo al pie, solo owner y analyst, sin ser un 9.º espacio; icono dibujado', () => {
  assert.equal(PIE.item.href, '/pain-points'); assert.equal(PIE.etiqueta, 'Insights');
  assert.equal(pieVisible({role: 'owner'})?.etiqueta, 'Puntos de dolor'); assert.equal(pieVisible({role: 'analyst'})?.href, '/pain-points');
  for (const r of ['operator', 'viewer', undefined]) assert.equal(pieVisible({role: r}), null, String(r));
  assert.equal(menuVisible({role: 'owner'}).length, 8, 'los 8 espacios no cambian');
  assert.equal(itemActivo('/pain-points').item.href, '/pain-points'); assert.equal(tituloDePantalla('/pain-points'), 'Puntos de dolor'); assert.equal(iconoDePantalla('/pain-points'), 'painpoints');
  assert.match(readFileSync(new URL('../src/components/workspace/icon.tsx', import.meta.url), 'utf8'), /\bpainpoints:'/);
  const shell = readFileSync(new URL('../src/components/workspace/shell.tsx', import.meta.url), 'utf8');
  assert.ok(shell.indexOf('<PieNavigation') > 0 && shell.indexOf('<PieNavigation') < shell.indexOf('<NotificationNavigationLink'), 'sobre Notificaciones');
});
test('evidencia sintética de la pantalla respeta la forma del contrato (sin PII, total y marca)', () => {
  const e = evidenciaPain('P2', null);
  assert.equal(e.estado, 'ok'); assert.equal(e.verificacion.marca, '✓'); assert.equal(e.filas.length, 50); assert.ok(e.nextCursor);
  assert.deepEqual(Object.keys(e.filas[0]).sort(), ['canal', 'estado', 'fecha', 'importeMinor', 'moneda', 'motivo', 'origen', 'ref', 'sku']);
  assert.equal(evidenciaPain('P3', null).estado, 'sin_dato');
});
test('ruta: archivos de Next, runtime nodejs y dinámicas, solo GET, rol owner/analyst y sin parámetros no soportados', () => {
  for (const f of ['../src/app/api/pain-points/route.ts', '../src/app/api/pain-points/[id]/evidence/route.ts']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8'); assert.match(s, /runtime='nodejs'/); assert.match(s, /dynamic='force-dynamic'/); assert.match(s, /export (const|async function) GET/); assert.doesNotMatch(s, /export (const|async function) (POST|PUT|PATCH|DELETE)/);
  }
  const h = readFileSync(new URL('../src/lib/pain-points/server.ts', import.meta.url), 'utf8');
  assert.match(h, /\['owner','analyst'\]\.includes/); assert.match(h, /olvidarSiDegradada/); assert.match(h, /conMemoria\(clave,TTL_MS/); assert.match(h, /TTL_MS=90_000/); assert.match(h, /PRIVATE_HEADERS/); assert.match(h, /text\/csv/); assert.match(h, /attachment; filename/);
  assert.ok(existsSync(new URL('../src/app/(workspace)/pain-points/page.tsx', import.meta.url)));
});
