// Formato PTS3: codificador y decodificador puros (sin dependencias salvo zlib de Node, que solo usa el cuerpo con gzip opcional).
// Un archivo = cabecera de 16 bytes + cuerpo.
//   cabecera: 'PTS3' (4), versión u16 (1), bits por eje u8 (10), banderas u8 (bit0 = el cuerpo va con gzip), N u32, bytes del bloque de posiciones u32.
//   cuerpo:   bloque de posiciones = N deltas varint (LEB128) del código Morton de 3 x bits, en orden Morton estricto (creciente, delta 0 permitido);
//             tres planos de N bytes: normal octaédrica x, normal octaédrica y (cada una cuantizada a -31..31, almacenada +31) y
//             un plano de atributos: bits 0 a 4 luminancia (0..31), bit 5 punto rojo, bit 6 punto de arista.
// El orden Morton es el mismo para todos los objetos: el punto k de un objeto viaja al punto k del siguiente.
import zlib from 'node:zlib';

export const MAGIA = 'PTS3', VERSION = 1, BITS = 10, TAM_CABECERA = 16, NQ = 31;

const spread = (v) => { v = (v | 0) & 0x3ff; v = (v | (v << 16)) & 0x30000ff; v = (v | (v << 8)) & 0x300f00f; v = (v | (v << 4)) & 0x30c30c3; v = (v | (v << 2)) & 0x9249249; return v; };
const compact = (v) => { v &= 0x9249249; v = (v | (v >> 2)) & 0x30c30c3; v = (v | (v >> 4)) & 0x300f00f; v = (v | (v >> 8)) & 0x30000ff; v = (v | (v >> 16)) & 0x3ff; return v; };
export const morton = (x, y, z) => (spread(x) | (spread(y) << 1) | (spread(z) << 2)) >>> 0;
export const deMorton = (m) => [compact(m), compact(m >> 1), compact(m >> 2)];
export const cuantiza = (c) => Math.min(1023, Math.max(0, Math.floor((c + 1) / 2 * 1024)));
export const centro = (q) => (q + 0.5) / 1024 * 2 - 1;

// Proyección octaédrica de una normal unitaria a dos valores en [-1, 1].
export function octa(n) {
  const l = Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) || 1; let x = n[0] / l, y = n[1] / l;
  if (n[2] < 0) { const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1), oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1); x = ox; y = oy; }
  return [x, y];
}
export function deOcta(ex, ey) {
  let x = ex, y = ey, z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) { const ox = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1), oy = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1); x = ox; y = oy; }
  const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l];
}

// puntos: [{p:[x,y,z] en -1..1, n:[nx,ny,nz], lum:0..1, rojo:bool, borde:bool}]. Devuelve {buf, orden}.
export function codificar(puntos, {gzip = false} = {}) {
  const items = puntos.map((s) => {
    const q = s.p.map(cuantiza), [ex, ey] = octa(s.n);
    return {m: morton(q[0], q[1], q[2]), nx: Math.round(ex * NQ) + NQ, ny: Math.round(ey * NQ) + NQ,
      a: Math.min(31, Math.max(0, Math.round(s.lum * 31))) | (s.rojo ? 32 : 0) | (s.borde ? 64 : 0)};
  });
  // Orden total y estable: por código Morton y, a igualdad, por los atributos.
  items.sort((a, b) => a.m - b.m || a.a - b.a || a.nx - b.nx || a.ny - b.ny);
  const n = items.length, pos = [];
  let prev = 0;
  for (const it of items) { let d = it.m - prev; prev = it.m; while (d >= 128) { pos.push((d & 127) | 128); d = Math.floor(d / 128); } pos.push(d); }
  const cuerpo = Buffer.alloc(pos.length + n * 3);
  Buffer.from(pos).copy(cuerpo, 0);
  items.forEach((it, i) => { cuerpo[pos.length + i] = it.nx; cuerpo[pos.length + n + i] = it.ny; cuerpo[pos.length + 2 * n + i] = it.a; });
  const cab = Buffer.alloc(TAM_CABECERA);
  cab.write(MAGIA, 0, 'ascii'); cab.writeUInt16LE(VERSION, 4); cab[6] = BITS; cab[7] = gzip ? 1 : 0; cab.writeUInt32LE(n, 8); cab.writeUInt32LE(pos.length, 12);
  const cuerpoFinal = gzip ? zlib.gzipSync(cuerpo, {level: 9}) : cuerpo;
  return Buffer.concat([cab, cuerpoFinal]);
}

// Devuelve {n, pos: Float32Array(n*3) en -1..1, nor: Float32Array(n*3), lum: Float32Array(n), rojo: Uint8Array(n), borde: Uint8Array(n)}.
export function decodificar(buf) {
  if (buf.length < TAM_CABECERA || buf.toString('ascii', 0, 4) !== MAGIA) throw new Error('PTS3: magia inválida');
  if (buf.readUInt16LE(4) !== VERSION) throw new Error('PTS3: versión no soportada');
  if (buf[6] !== BITS) throw new Error('PTS3: bits por eje no soportados');
  const n = buf.readUInt32LE(8), nPos = buf.readUInt32LE(12);
  const cuerpo = buf[7] & 1 ? zlib.gunzipSync(buf.subarray(TAM_CABECERA)) : buf.subarray(TAM_CABECERA);
  if (cuerpo.length !== nPos + n * 3) throw new Error('PTS3: tamaño incoherente con N');
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), lum = new Float32Array(n), rojo = new Uint8Array(n), borde = new Uint8Array(n);
  let o = 0, m = 0;
  for (let i = 0; i < n; i++) {
    let d = 0, mul = 1, b;
    do { if (o >= nPos) throw new Error('PTS3: varint truncado'); b = cuerpo[o++]; d += (b & 127) * mul; mul *= 128; } while (b & 128);
    m += d; const q = deMorton(m >>> 0);
    pos[i * 3] = centro(q[0]); pos[i * 3 + 1] = centro(q[1]); pos[i * 3 + 2] = centro(q[2]);
    const nn = deOcta((cuerpo[nPos + i] - NQ) / NQ, (cuerpo[nPos + n + i] - NQ) / NQ); nor.set(nn, i * 3);
    const a = cuerpo[nPos + 2 * n + i]; lum[i] = (a & 31) / 31; rojo[i] = (a >> 5) & 1; borde[i] = (a >> 6) & 1;
  }
  if (o !== nPos) throw new Error('PTS3: bloque de posiciones con bytes sobrantes');
  return {n, pos, nor, lum, rojo, borde};
}
