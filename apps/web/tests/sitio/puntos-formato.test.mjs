// Pruebas del formato PTS3 (T5): ida y vuelta, orden Morton, rechazo de archivos dañados, decodificador del navegador contra el de build,
// determinismo del muestreo (semilla fija, mismo SHA-256) y presupuesto de peso de los .pts publicados.
// Se corre con: node --test apps/web/tests/sitio/puntos-formato.test.mjs
import {test, describe} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {codificar, decodificar, morton, deMorton, octa, deOcta, TAM_CABECERA} from '../../../../tools/puntos/pts3.mjs';
import {decodificarPts3, remuestrear} from '../../src/sitio-js/nube.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), PTS = path.join(AQUI, '../../public/s/pts');
const HERR = path.join(process.env.HOME || '', 'vexa-tools/puntos'), GLB = path.join(process.env.HOME || '', 'vexa-notas-28oct/landing/renders/r3/final');
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function nube(n, semilla) {
  const r = mulberry(semilla), pts = [];
  for (let i = 0; i < n; i++) {
    const nn = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1], l = Math.hypot(...nn) || 1;
    pts.push({p: [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1].map((c) => Math.max(-0.999, Math.min(0.999, c))), n: nn.map((c) => c / l), lum: r(), rojo: r() < 0.03, borde: r() < 0.25});
  }
  return pts;
}
const ab = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

describe('Morton y normales', () => {
  test('el código Morton va y vuelve', () => { for (const [x, y, z] of [[0, 0, 0], [1023, 1023, 1023], [5, 900, 77], [512, 1, 1022]]) assert.deepEqual(deMorton(morton(x, y, z)), [x, y, z]); });
  test('la normal octaédrica conserva la dirección (error angular bajo)', () => {
    const r = mulberry(7);
    for (let i = 0; i < 500; i++) { const n = [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1], l = Math.hypot(...n), u = n.map((c) => c / l), [ex, ey] = octa(u), d = deOcta(ex, ey); assert.ok(u[0] * d[0] + u[1] * d[1] + u[2] * d[2] > 0.9999); }
  });
});

describe('ida y vuelta', () => {
  const pts = nube(3000, 42), buf = codificar(pts), d = decodificar(buf);
  test('cabecera: magia, versión, bits y recuento', () => {
    assert.equal(buf.toString('ascii', 0, 4), 'PTS3'); assert.equal(buf.readUInt16LE(4), 1); assert.equal(buf[6], 10); assert.equal(buf.readUInt32LE(8), 3000); assert.equal(d.n, 3000);
  });
  test('tamaño coherente con N: cabecera + posiciones + 3 planos', () => assert.equal(buf.length, TAM_CABECERA + buf.readUInt32LE(12) + 3 * 3000));
  test('cada punto decodificado cae en su celda de 10 bits (error de posición <= 1/1024)', () => {
    // El orden cambia (Morton), así que se compara como conjunto de celdas.
    const celda = (p) => p.map((c) => Math.min(1023, Math.max(0, Math.floor((c + 1) / 2 * 1024)))).join(','), fuente = new Map();
    for (const s of pts) fuente.set(celda(s.p), (fuente.get(celda(s.p)) || 0) + 1);
    for (let i = 0; i < d.n; i++) { const k = celda([d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2]]); assert.ok(fuente.get(k) > 0, 'celda sin origen'); fuente.set(k, fuente.get(k) - 1); }
    assert.ok([...fuente.values()].every((v) => v === 0));
  });
  test('los puntos salen en orden Morton estricto (no decreciente) y dentro de la caja', () => {
    let prev = -1; for (let i = 0; i < d.n; i++) { const q = [0, 1, 2].map((k) => Math.floor((d.pos[i * 3 + k] + 1) / 2 * 1024)), m = morton(...q); assert.ok(m >= prev); prev = m; for (let k = 0; k < 3; k++) assert.ok(d.pos[i * 3 + k] > -1 && d.pos[i * 3 + k] < 1); }
  });
  test('normales unitarias, luminancia y banderas conservadas en total', () => {
    for (let i = 0; i < d.n; i++) assert.ok(Math.abs(Math.hypot(d.nor[i * 3], d.nor[i * 3 + 1], d.nor[i * 3 + 2]) - 1) < 1e-4);
    assert.equal(d.rojo.reduce((a, b) => a + b, 0), pts.filter((s) => s.rojo).length); assert.equal(d.borde.reduce((a, b) => a + b, 0), pts.filter((s) => s.borde).length);
    const lumFuente = pts.reduce((a, s) => a + s.lum, 0) / pts.length, lumDec = d.lum.reduce((a, b) => a + b, 0) / d.n; assert.ok(Math.abs(lumFuente - lumDec) < 0.01);
  });
  test('es determinista: mismo conjunto, mismo SHA-256, aunque llegue en otro orden', () => {
    const a = crypto.createHash('sha256').update(codificar(pts)).digest('hex'), b = crypto.createHash('sha256').update(codificar([...pts].reverse())).digest('hex');
    assert.equal(a, b);
  });
  test('la variante con gzip decodifica igual', () => { const g = codificar(pts, {gzip: true}), e = decodificar(g); assert.equal(g[7] & 1, 1); assert.deepEqual([...e.pos], [...d.pos]); assert.deepEqual([...e.lum], [...d.lum]); });
});

describe('archivos dañados', () => {
  const buf = codificar(nube(500, 3));
  test('magia incorrecta', () => { const x = Buffer.from(buf); x.write('PTS2', 0, 'ascii'); assert.throws(() => decodificar(x), /magia/); });
  test('versión desconocida', () => { const x = Buffer.from(buf); x.writeUInt16LE(9, 4); assert.throws(() => decodificar(x), /versión/); });
  test('truncado: el tamaño no cuadra con N', () => assert.throws(() => decodificar(buf.subarray(0, buf.length - 7)), /tamaño/));
  test('N alterado', () => { const x = Buffer.from(buf); x.writeUInt32LE(501, 8); assert.throws(() => decodificar(x), /PTS3/); });
});

describe('decodificador del navegador (nube.js) contra el de build', () => {
  for (const gzip of [false, true]) test(`mismas posiciones, normales y banderas con gzip=${gzip}`, async () => {
    const buf = codificar(nube(2000, 11), {gzip}), a = decodificar(buf), b = await decodificarPts3(ab(buf));
    assert.equal(b.n, a.n); for (let i = 0; i < a.pos.length; i++) assert.ok(Math.abs(a.pos[i] - b.pos[i]) < 1e-6); for (let i = 0; i < a.nor.length; i++) assert.ok(Math.abs(a.nor[i] - b.nor[i]) < 1e-5);
    assert.deepEqual([...a.rojo], [...b.rojo]); assert.deepEqual([...a.borde], [...b.borde]);
  });
  test('rechaza una magia ajena', async () => { await assert.rejects(decodificarPts3(new ArrayBuffer(64)), /magia/); });
  test('remuestrear toma 1 de cada n sobre el orden Morton y repite con desplazamiento si faltan puntos', async () => {
    const d = await decodificarPts3(ab(codificar(nube(1000, 5)))), r = remuestrear(d, 250), s = remuestrear(d, 1500);
    assert.equal(r.m, 250); assert.equal(r.pos.length, 750); assert.equal(r.att.length, 2000);
    for (let j = 0; j < 250; j++) assert.equal(r.pos[j * 3], d.pos[Math.floor(j * 4) * 3]);
    assert.equal(s.m, 1500); assert.ok(s.pos.every((v) => v >= -1 && v <= 1));
  });
});

describe('archivos publicados en public/s/pts', () => {
  const man = fs.existsSync(path.join(PTS, 'manifest-pts.json')) ? JSON.parse(fs.readFileSync(path.join(PTS, 'manifest-pts.json'), 'utf8')) : null;
  test('hay un .pts por objeto y el manifiesto coincide con los archivos (nombre con hash, SHA-256, bytes)', { skip: !man }, () => {
    assert.deepEqual(Object.keys(man).sort(), ['hero', 'o1', 'o2', 'o3', 'o4']);
    for (const [k, v] of Object.entries(man)) { const buf = fs.readFileSync(path.join(PTS, v.archivo)), sha = crypto.createHash('sha256').update(buf).digest('hex'); assert.equal(sha, v.sha256); assert.equal(buf.length, v.bytes); assert.ok(v.archivo.startsWith(k + '.' + sha.slice(0, 8))); assert.equal(decodificar(buf).n, v.puntos); }
  });
  test('cantidades: héroe 12 000 y pasos 9 000', { skip: !man }, () => { assert.equal(man.hero.puntos, 12000); for (const k of ['o1', 'o2', 'o3', 'o4']) assert.equal(man[k].puntos, 9000); });
  test('el cuerpo va con gzip interno (bandera de la cabecera)', { skip: !man }, () => { for (const v of Object.values(man)) assert.equal(fs.readFileSync(path.join(PTS, v.archivo))[7] & 1, 1); });
  test('presupuesto con brotli: héroe < 50 KB y cada paso < 40 KB (también sin que la CDN comprima: gzip interno)', { skip: !man }, () => {
    for (const [k, v] of Object.entries(man)) { const br = zlib.brotliCompressSync(fs.readFileSync(path.join(PTS, v.archivo)), {params: {[zlib.constants.BROTLI_PARAM_QUALITY]: 11}}).length; assert.ok(br < (k === 'hero' ? 50 : 40) * 1000, `${k}: ${br} B con brotli`); assert.ok(v.bytes < (k === 'hero' ? 50 : 40) * 1000, `${k}: ${v.bytes} B tal cual`); }
  });
  test('menos del 4 % de los puntos son rojos y cada objeto tiene alguno', { skip: !man }, () => {
    for (const v of Object.values(man)) { const d = decodificar(fs.readFileSync(path.join(PTS, v.archivo))), r = d.rojo.reduce((a, b) => a + b, 0); assert.ok(r > 0 && r / d.n < 0.04, `${r}/${d.n}`); }
  });
  test('todos los objetos comparten la caja unitaria (lado mayor ≈ 2)', { skip: !man }, () => {
    for (const v of Object.values(man)) { const d = decodificar(fs.readFileSync(path.join(PTS, v.archivo))); let m = 0; for (let i = 0; i < d.pos.length; i++) m = Math.max(m, Math.abs(d.pos[i])); assert.ok(m > 0.97 && m < 1, String(m)); }
  });
});

describe('determinismo del muestreo desde los GLB', () => {
  const hay = fs.existsSync(path.join(HERR, 'node_modules')) && fs.existsSync(path.join(GLB, 'o3.glb'));
  test('reconstruir o3 dos veces da el mismo SHA-256 y el mismo contenido que el publicado', { skip: !hay, timeout: 120000 }, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pts-')), glb = path.join(tmp, 'glb'); fs.mkdirSync(glb); fs.copyFileSync(path.join(GLB, 'o3.glb'), path.join(glb, 'o3.glb'));
    const sha = [];
    for (const i of [1, 2]) { const out = path.join(tmp, 'o' + i), r = spawnSync('bash', [path.join(AQUI, '../../../../tools/puntos/construir.sh'), glb, out], {encoding: 'utf8'}); assert.equal(r.status, 0, r.stderr); sha.push(JSON.parse(fs.readFileSync(path.join(out, 'manifest-pts.json'), 'utf8')).o3.sha256); }
    assert.equal(sha[0], sha[1]);
    // El publicado debe decodificar igual que lo reconstruido (se compara el contenido, no el SHA, por si cambia la versión de zlib).
    const man = JSON.parse(fs.readFileSync(path.join(PTS, 'manifest-pts.json'), 'utf8')), nuevo = decodificar(fs.readFileSync(path.join(tmp, 'o1', JSON.parse(fs.readFileSync(path.join(tmp, 'o1', 'manifest-pts.json'), 'utf8')).o3.archivo))), pub = decodificar(fs.readFileSync(path.join(PTS, man.o3.archivo)));
    assert.deepEqual([...nuevo.pos], [...pub.pos], 'el publicado no corresponde al código actual'); assert.deepEqual([...nuevo.lum], [...pub.lum]);
    fs.rmSync(tmp, {recursive: true, force: true});
  });
});
