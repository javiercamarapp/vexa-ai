// Decodificador y codificador mínimos de PNG (8 bits, RGB o RGBA, sin entrelazado).
// Alcanza para las capturas de Chrome y no añade dependencias.
import { inflateSync, deflateSync } from 'node:zlib';

const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodificarPng(buf) {
  if (!buf.subarray(0, 8).equals(FIRMA)) throw new Error('No es un PNG');
  let p = 8, ancho = 0, alto = 0, prof = 0, tipo = 0, entrelazado = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const nombre = buf.toString('latin1', p + 4, p + 8);
    const datos = buf.subarray(p + 8, p + 8 + len);
    if (nombre === 'IHDR') {
      ancho = datos.readUInt32BE(0); alto = datos.readUInt32BE(4); prof = datos[8]; tipo = datos[9]; entrelazado = datos[12];
    } else if (nombre === 'IDAT') idat.push(datos);
    else if (nombre === 'IEND') break;
    p += 12 + len;
  }
  if (prof !== 8 || (tipo !== 2 && tipo !== 6) || entrelazado !== 0) throw new Error(`PNG no soportado (prof ${prof}, tipo ${tipo}, entrelazado ${entrelazado})`);
  const canales = tipo === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const fila = ancho * canales;
  const out = Buffer.alloc(alto * fila);
  for (let y = 0; y < alto; y++) {
    const f = raw[y * (fila + 1)];
    const src = y * (fila + 1) + 1;
    const dst = y * fila;
    for (let x = 0; x < fila; x++) {
      const a = x >= canales ? out[dst + x - canales] : 0;
      const b = y > 0 ? out[dst - fila + x] : 0;
      const c = x >= canales && y > 0 ? out[dst - fila + x - canales] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[dst + x] = v & 255;
    }
  }
  return { ancho, alto, canales, datos: out };
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(nombre, datos) {
  const n = Buffer.from(nombre, 'latin1');
  const l = Buffer.alloc(4); l.writeUInt32BE(datos.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([n, datos])));
  return Buffer.concat([l, n, datos, c]);
}

// datos: RGB (3 canales) sin filtro; para pruebas.
export function codificarPng({ ancho, alto, canales = 3, datos }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = canales === 4 ? 6 : 2;
  const fila = ancho * canales;
  const raw = Buffer.alloc(alto * (fila + 1));
  for (let y = 0; y < alto; y++) {
    raw[y * (fila + 1)] = 0;
    datos.copy(raw, y * (fila + 1) + 1, y * fila, (y + 1) * fila);
  }
  return Buffer.concat([FIRMA, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
