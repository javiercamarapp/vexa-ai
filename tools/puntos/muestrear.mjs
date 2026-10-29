// Muestreo offline de nubes de puntos desde mallas GLB a formato PTS3. Se ejecuta con las dependencias de ~/vexa-tools/puntos (nunca sobre el node_modules compartido):
//   node muestrear.mjs <directorio con hero.glb o1.glb ...> <directorio de salida, p. ej. apps/web/public/s/pts>
// Cada malla se gira a su pose, se recentra y se escala a un cubo común (lado mayor = 2, de -1 a 1). Los puntos se reparten por área de triángulo con más peso donde hay curvatura,
// y una fracción sigue las aristas vivas y los contornos abiertos (donde la nube ya se lee como forma). Semilla fija por nombre: mismo GLB, mismo archivo, mismo SHA-256.
// La luminancia sale de la convexidad local (las mallas no tienen color ni UV: el PNG de cada objeto está tomado desde otra cámara y no se puede proyectar sin deformar),
// y el PNG solo sirvió para localizar la marca roja, que se define abajo en el espacio del modelo.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld, simplify} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {codificar} from './pts3.mjs';

export const FRACCION_ARISTAS = 0.22, ANGULO_ARISTA = 62;
const rad = (g) => g * Math.PI / 180;
// Pose (grados, en orden Y, X, Z), cantidad de puntos y regla de la marca roja (en el espacio ya normalizado y girado).
const esfera = (c, r, f) => (p, n) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < r && (!f || f(p, n));
// base: giro que deja el objeto de frente (x a la derecha, y arriba, z hacia el visor). rojo: regla en ese marco. vista: giro de tres cuartos que se hornea en los puntos.
export const OBJETOS = {
  hero: {n: 12000, base: [90, 0, 0], vista: [-32, 8, 0], rojo: esfera([0.62, -0.66, 0.2], 0.1, (p) => p[2] > 0.12)},
  o1: {n: 9000, base: [0, 0, 0], vista: [-42, 7, 0], rojo: 'pico'},
  o2: {n: 9000, base: [90, 0, 0], vista: [-20, 8, 0], rojo: esfera([-0.65, 0.14, 0], 0.07)},
  o3: {n: 9000, base: [0, 0, 0], vista: [-20, 0, 0], rojo: (p, n) => Math.abs(p[1] - 0.13) < 0.016 && n[2] > 0.25},
  o4: {n: 9000, base: [90, 0, 0], vista: [-28, 6, 0], rojo: (p, n) => Math.abs(p[0]) < 0.1 && p[1] > 0.74 && n[2] > 0.4},
};
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const semilla = (nombre) => parseInt(crypto.createHash('sha256').update('pts3:' + nombre).digest('hex').slice(0, 8), 16);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
function gira(p, [ry, rx, rz]) {
  const cy = Math.cos(rad(ry)), sy = Math.sin(rad(ry)), cx = Math.cos(rad(rx)), sx = Math.sin(rad(rx)), cz = Math.cos(rad(rz)), sz = Math.sin(rad(rz));
  let [x, y, z] = p; [x, z] = [cy * x + sy * z, -sy * x + cy * z]; [y, z] = [cx * y - sx * z, sx * y + cx * z]; [x, y] = [cz * x - sz * y, sz * x + cz * y]; return [x, y, z];
}

export async function leeMalla(archivo, simplifica = false) {
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(archivo);
  await doc.transform(weld(), ...(simplifica ? [simplify({simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.0006})] : []));
  const tris = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), n = idx ? idx.getCount() / 3 : pos.getCount() / 3;
    for (let f = 0; f < n; f++) { const ids = [0, 1, 2].map((j) => idx ? idx.getScalar(f * 3 + j) : f * 3 + j); tris.push({P: ids.map((k) => pos.getElement(k, [0, 0, 0])), ids}); }
  }
  return tris;
}

// Devuelve los puntos [{p, n, lum, rojo, borde}] ya normalizados. Determinista.
export function muestreaTris(tris0, nombre, cfg) {
  const {n: N, base: pose, rojo: reglaRojo, vista} = cfg;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const tris = [];
  for (const t of tris0) { const P = t.P.map((p) => gira(p, pose)); for (const p of P) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); } tris.push({P, ids: t.ids}); }
  const ctr = min.map((m, i) => (m + max[i]) / 2), esc = 2 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  for (const t of tris) { t.P = t.P.map((p) => p.map((c, i) => (c - ctr[i]) * esc)); const c = cruz(sub(t.P[1], t.P[0]), sub(t.P[2], t.P[0])); t.area = Math.hypot(...c) / 2; t.fn = t.area > 0 ? c.map((x) => x / (2 * t.area)) : [0, 0, 1]; t.curv = 0; }
  const util = tris.filter((t) => t.area > 1e-12);
  // Aristas por vértice soldado: compartidas por dos triángulos (diedro) o por uno solo (contorno abierto).
  const mapa = new Map();
  util.forEach((t, i) => { for (let e = 0; e < 3; e++) { const a = t.ids[e], b = t.ids[(e + 1) % 3], k = a < b ? a * 4194304 + b : b * 4194304 + a; (mapa.get(k) ?? mapa.set(k, []).get(k)).push([i, t.P[e], t.P[(e + 1) % 3]]); } });
  const aristas = [], cos = Math.cos(rad(ANGULO_ARISTA));
  for (const [, l] of mapa) {
    const len = Math.hypot(...sub(l[0][1], l[0][2])); if (len < 0.004) continue;
    if (l.length === 2) { const t0 = util[l[0][0]], t1 = util[l[1][0]], d = t0.fn[0] * t1.fn[0] + t0.fn[1] * t1.fn[1] + t0.fn[2] * t1.fn[2], ang = Math.acos(Math.max(-1, Math.min(1, d))); t0.curv = Math.max(t0.curv, ang); t1.curv = Math.max(t1.curv, ang); if (d < cos) aristas.push({a: l[0][1], b: l[0][2], len, n: norma([t0.fn[0] + t1.fn[0], t0.fn[1] + t1.fn[1], t0.fn[2] + t1.fn[2]]), peso: 1}); }
    else if (l.length === 1) aristas.push({a: l[0][1], b: l[0][2], len, n: util[l[0][0]].fn, peso: 1.4});
  }
  const acum = (lista, peso) => { const ac = new Float64Array(lista.length); let tot = 0; lista.forEach((x, i) => { tot += peso(x); ac[i] = tot; }); return {ac, tot}; };
  const pick = ({ac, tot}, r) => { const x = r * tot; let lo = 0, hi = ac.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (ac[m] < x) lo = m + 1; else hi = m; } return lo; };
  const sup = acum(util, (t) => t.area * (1 + 1.2 * Math.min(1, t.curv / 1.2))), edg = acum(aristas, (e) => e.len * e.peso);
  const nAr = aristas.length ? Math.round(N * FRACCION_ARISTAS) : 0, rnd = mulberry32(semilla(nombre)), pts = [];
  for (let i = 0; i < N - nAr; i++) {
    const t = util[pick(sup, rnd())]; let r1 = rnd(), r2 = rnd(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const p = [0, 1, 2].map((k) => t.P[0][k] * (1 - r1 - r2) + t.P[1][k] * r1 + t.P[2][k] * r2);
    pts.push({p, n: t.fn, lum: 0.6 + 0.25 * Math.min(1, t.curv / 1.4) + (rnd() - 0.5) * 0.1, rojo: false, borde: false});
  }
  for (let i = 0; i < nAr; i++) { const e = aristas[pick(edg, rnd())], u = rnd(); pts.push({p: [0, 1, 2].map((k) => e.a[k] + (e.b[k] - e.a[k]) * u), n: e.n, lum: 0.85, rojo: false, borde: true}); }
  if (reglaRojo === 'pico') { let top = pts[0]; for (const s of pts) if (s.p[1] > top.p[1]) top = s; for (const s of pts) if (Math.hypot(s.p[0] - top.p[0], s.p[1] - top.p[1], s.p[2] - top.p[2]) < 0.14) s.rojo = true; }
  else if (reglaRojo) for (const s of pts) if (reglaRojo(s.p, s.n)) s.rojo = true;
  // Giro de vista (tres cuartos) y reencuadre: la caja de los puntos vuelve a quedar centrada y con lado mayor 2.
  if (vista) {
    const g = (v) => gira(v, vista); let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const s of pts) { s.p = g(s.p); s.n = g(s.n); for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], s.p[i]); mx[i] = Math.max(mx[i], s.p[i]); } }
    const c2 = mn.map((m, i) => (m + mx[i]) / 2), e2 = 2 / Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
    for (const s of pts) s.p = s.p.map((c, i) => Math.max(-0.9995, Math.min(0.9995, (c - c2[i]) * e2)));
  }
  return pts;
}

export async function construyeObjeto(archivo, nombre, cfg = OBJETOS[nombre], opts = {}) {
  const tris = await leeMalla(archivo); const pts = muestreaTris(tris, nombre, cfg);
  return codificar(pts, opts);
}

const esPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (esPrincipal) {
  // Por defecto el cuerpo va con gzip interno (la CDN no comprime octet-stream de forma fiable): 22 KB menos en el héroe sin CDN y solo 2 a 3 KB más que brotli con CDN. --crudo lo desactiva.
  const [, , entrada, salida, opt] = process.argv, gzip = opt !== '--crudo';
  fs.mkdirSync(salida, {recursive: true});
  const manifest = {};
  for (const nombre of Object.keys(OBJETOS)) {
    const f = path.join(entrada, nombre + '.glb'); if (!fs.existsSync(f)) continue;
    const buf = await construyeObjeto(f, nombre, OBJETOS[nombre], {gzip}), sha = crypto.createHash('sha256').update(buf).digest('hex'), archivo = `${nombre}.${sha.slice(0, 8)}.pts`;
    for (const viejo of fs.readdirSync(salida)) if (viejo.startsWith(nombre + '.') && viejo.endsWith('.pts')) fs.unlinkSync(path.join(salida, viejo));
    fs.writeFileSync(path.join(salida, archivo), buf);
    const br = zlib.brotliCompressSync(buf, {params: {[zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length}}).length;
    manifest[nombre] = {archivo, puntos: OBJETOS[nombre].n, bytes: buf.length, brotli: br, sha256: sha};
    console.log(archivo, 'bytes', buf.length, 'brotli', br, 'bytes/punto(brotli)', (br / OBJETOS[nombre].n).toFixed(2));
  }
  fs.writeFileSync(path.join(salida, 'manifest-pts.json'), JSON.stringify(manifest, null, 1) + '\n');
}
