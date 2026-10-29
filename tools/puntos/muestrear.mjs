// Muestreo offline de nubes de puntos desde mallas GLB. Se ejecuta en ~/vexa-tools/puntos (npm ci allí; nunca sobre el node_modules compartido):
//   node muestrear.mjs <directorio con .glb> <directorio de salida>
// Cada modelo se recentra y se escala a un cubo unitario; los puntos se eligen con probabilidad proporcional al área del triángulo con una semilla fija por nombre (determinista),
// se ordenan por código Morton (el punto k de un modelo viaja al punto k del siguiente con trayectorias coherentes) y se escriben en binario.
// Formato .pts: cabecera de 16 bytes (PTS1, versión u16, reservado u16, N u32, reservado u32) y por punto 12 bytes:
//   x y z int16 (normalizados, 32767 = 1.0), normal octaédrica nx ny int8, luminancia u8, y un byte de banderas: bits 0 a 6 rojez (0 a 127) y bit 7 = punto de arista.
// Antes de muestrear la malla se suelda y se simplifica (meshoptimizer) para detectar aristas vivas; un tercio de los puntos sigue esas aristas y los contornos, el resto cubre las superficies con más densidad donde hay curvatura.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld, simplify} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const N_PUNTOS = 22002, FRACCION_ARISTAS = 0.34, ANGULO_ARISTA = 30;
const [, , entrada, salida] = process.argv;
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const semilla = (nombre) => parseInt(crypto.createHash('sha256').update(nombre).digest('hex').slice(0, 8), 16);
const spread = (v) => { v = (v | 0) & 0x3ff; v = (v | (v << 16)) & 0x30000ff; v = (v | (v << 8)) & 0x300f00f; v = (v | (v << 4)) & 0x30c30c3; v = (v | (v << 2)) & 0x9249249; return v; };
const morton = (x, y, z) => spread(x) | (spread(y) << 1) | (spread(z) << 2);

const octa = (n) => { const l = Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) || 1; let x = n[0] / l, y = n[1] / l; if (n[2] < 0) { const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1), oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1); x = ox; y = oy; } return [x, y]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norma = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

async function muestrea(archivo, nombre) {
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(archivo);
  await doc.transform(weld(), simplify({simplifier: MeshoptSimplifier, ratio: 0.05, error: 0.0012}));
  const tris = [], cache = new Map();
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
    const tex = prim.getMaterial()?.getBaseColorTexture();
    let img = null;
    if (tex) { if (!cache.has(tex)) { const {data, info} = await sharp(Buffer.from(tex.getImage())).resize(512, 512, {fit: 'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject: true}); cache.set(tex, {data, w: info.width, h: info.height}); } img = cache.get(tex); }
    const n = idx ? idx.getCount() / 3 : pos.getCount() / 3;
    for (let f = 0; f < n; f++) {
      const ids = [0, 1, 2].map((j) => idx ? idx.getScalar(f * 3 + j) : f * 3 + j);
      const P = ids.map((k) => pos.getElement(k, [0, 0, 0])), N = nor ? ids.map((k) => nor.getElement(k, [0, 0, 0])) : null, T = uv ? ids.map((k) => uv.getElement(k, [0, 0])) : null;
      const c = cruz(sub(P[1], P[0]), sub(P[2], P[0])), area = Math.hypot(...c) / 2;
      if (area > 0) tris.push({P, N, T, img, area, fn: c.map((x) => x / (2 * area)), curv: 0});
    }
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t.P) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  const ctr = min.map((m, i) => (m + max[i]) / 2), esc = 2 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  // Aristas vivas: aristas compartidas por dos triángulos cuyo ángulo diedro supera el umbral.
  const q = (p) => p.map((x) => Math.round((x - ctr[0]) * esc * 2000)).join(','), mapa = new Map();
  tris.forEach((t, i) => { for (let e = 0; e < 3; e++) { const a = t.P[e], b = t.P[(e + 1) % 3], ka = q(a), kb = q(b), k = ka < kb ? ka + '|' + kb : kb + '|' + ka; (mapa.get(k) ?? mapa.set(k, []).get(k)).push([i, a, b]); } });
  const aristas = [], cos = Math.cos(ANGULO_ARISTA * Math.PI / 180);
  for (const [, l] of mapa) if (l.length === 2) { const t0 = tris[l[0][0]], t1 = tris[l[1][0]], d = t0.fn[0] * t1.fn[0] + t0.fn[1] * t1.fn[1] + t0.fn[2] * t1.fn[2]; const ang = Math.acos(Math.max(-1, Math.min(1, d))); t0.curv = Math.max(t0.curv, ang); t1.curv = Math.max(t1.curv, ang); if (d < cos) { const len = Math.hypot(...sub(l[0][1], l[0][2])); aristas.push({a: l[0][1], b: l[0][2], len, n: norma([t0.fn[0] + t1.fn[0], t0.fn[1] + t1.fn[1], t0.fn[2] + t1.fn[2]])}); } }
  const ponderado = (lista, peso) => { const ac = new Float64Array(lista.length); let tot = 0; lista.forEach((x, i) => { tot += peso(x); ac[i] = tot; }); return {ac, tot}; };
  const pick = (ac, tot, r) => { const x = r * tot; let lo = 0, hi = ac.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (ac[m] < x) lo = m + 1; else hi = m; } return lo; };
  const sup = ponderado(tris, (t) => t.area * (1 + 2.5 * Math.min(1, t.curv / 1.2))), edg = ponderado(aristas, (e) => e.len);
  const nAr = aristas.length ? Math.round(N_PUNTOS * FRACCION_ARISTAS) : 0;
  const rnd = mulberry32(semilla(nombre)), pts = [];
  const empuja = (p, nn, lum, roj, borde) => { const qq = p.map((c) => Math.min(1023, Math.max(0, Math.round((c + 1) / 2 * 1023)))); pts.push({p, n: nn, lum, roj, borde, m: morton(...qq)}); };
  for (let i = 0; i < N_PUNTOS - nAr; i++) {
    const t = tris[pick(sup.ac, sup.tot, rnd())]; let r1 = rnd(), r2 = rnd(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; } const w = [1 - r1 - r2, r1, r2];
    const p = [0, 1, 2].map((k) => (t.P[0][k] * w[0] + t.P[1][k] * w[1] + t.P[2][k] * w[2] - ctr[k]) * esc);
    let nn = t.fn; if (t.N) { nn = norma([0, 1, 2].map((k) => t.N[0][k] * w[0] + t.N[1][k] * w[1] + t.N[2][k] * w[2])); }
    let lum = 0.5, roj = 0;
    if (t.img && t.T) {
      const u = (t.T[0][0] * w[0] + t.T[1][0] * w[1] + t.T[2][0] * w[2]), vv = (t.T[0][1] * w[0] + t.T[1][1] * w[1] + t.T[2][1] * w[2]);
      const px = Math.min(t.img.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * t.img.w))), py = Math.min(t.img.h - 1, Math.max(0, Math.floor((vv - Math.floor(vv)) * t.img.h))), k = (py * t.img.w + px) * 4;
      const R = t.img.data[k] / 255, G = t.img.data[k + 1] / 255, B = t.img.data[k + 2] / 255; lum = 0.3 * R + 0.59 * G + 0.11 * B; roj = Math.min(1, Math.max(0, (R - Math.max(G, B) - 0.18) * 3));
    }
    empuja(p, nn, lum, roj, false);
  }
  for (let i = 0; i < nAr; i++) { const e = aristas[pick(edg.ac, edg.tot, rnd())], u = rnd(); empuja([0, 1, 2].map((k) => (e.a[k] + (e.b[k] - e.a[k]) * u - ctr[k]) * esc), e.n, 0.3, 0, true); }
  pts.sort((a, b) => a.m - b.m);
  const buf = Buffer.alloc(16 + pts.length * 10); buf.write('PTS2', 0, 'ascii'); buf.writeUInt16LE(2, 4); buf.writeUInt32LE(pts.length, 8);
  pts.forEach((s, i) => { const o = 16 + i * 10; for (let k = 0; k < 3; k++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.p[k])) * 32767), o + k * 2); const [ox, oy] = octa(s.n); buf.writeInt8(Math.round(ox * 127), o + 6); buf.writeInt8(Math.round(oy * 127), o + 7); buf[o + 8] = Math.round(Math.min(1, s.lum * 1.4) * 255); buf[o + 9] = Math.round(s.roj * 127) | (s.borde ? 128 : 0); });
  return buf;
}

if (entrada && salida) {
  fs.mkdirSync(salida, {recursive: true});
  const manifest = {};
  for (const f of fs.readdirSync(entrada).filter((x) => x.endsWith('.glb')).sort()) {
    const nombre = path.basename(f, '.glb'), buf = await muestrea(path.join(entrada, f), nombre);
    const hash = crypto.createHash('sha256').update(buf).digest('hex'), archivo = `${nombre}.${hash.slice(0, 8)}.pts`;
    for (const viejo of fs.readdirSync(salida)) if (viejo.startsWith(nombre + '.') && viejo.endsWith('.pts')) fs.unlinkSync(path.join(salida, viejo));
    fs.writeFileSync(path.join(salida, archivo), buf); manifest[nombre] = {archivo, puntos: N_PUNTOS, bytes: buf.length, sha256: hash};
    console.log(archivo, buf.length);
  }
  fs.writeFileSync(path.join(salida, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
}
