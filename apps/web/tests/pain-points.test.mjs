// «Puntos de dolor»: modelo de burbujas determinista, formato sin ceros falsos, menú y ruta.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/pain-points.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {disponerBurbujas, mayores, valorDe, TEMAS_ORDEN} from '../src/components/pain-points/burbujas-modelo.mjs';
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
