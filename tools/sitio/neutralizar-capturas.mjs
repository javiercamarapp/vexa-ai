#!/usr/bin/env node
// Variante NEUTRA de las capturas reales del producto para la landing («un solo acento»: el rojo de Rovaq).
// El producto pinta series de gráficas, chips y tarjetas con naranja, azul, teal, rosa, verde y durazno; en la landing esos colores compiten con el
// acento. Este paso desatura TODA la captura a escala de grises por luminancia (la misma matriz Rec. 709 que filter: grayscale(1) de CSS), sin tocar
// geometría, texto ni sellos (los sellos de procedencia se distinguen por patrón, no por color). Los PNG originales en color NO se modifican:
// se escriben en otra carpeta que luego procesan imagenes-producto.mjs y recortes-pasos.mjs.
// También neutraliza pareto.svg (fills y strokes rgb/rgba/hex a su gris de igual luminancia).
//
// Uso: node tools/sitio/neutralizar-capturas.mjs <carpeta de capturas en color> <carpeta de salida>
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';

const BUILD = process.env.SITIO_BUILD_DIR || join(homedir(), 'vexa-tools', 'sitio-build');
const sharp = createRequire(join(BUILD, 'package.json'))('sharp');
const [, , entrada0, salida0] = process.argv;
if (!entrada0 || !salida0 || !existsSync(resolve(entrada0))) { console.error('Uso: neutralizar-capturas.mjs <entrada> <salida>'); process.exit(2); }
const entrada = resolve(entrada0), salida = resolve(salida0);
if (entrada === salida) { console.error('La salida debe ser otra carpeta: los originales en color no se tocan.'); process.exit(2); }

const gris = (r, g, b) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
const hexAGris = (h) => { const v = h.length === 4 ? [...h.slice(1)].map((c) => parseInt(c + c, 16)) : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const y = gris(...v); return `#${y.toString(16).padStart(2, '0').repeat(3)}`; };
function neutralizarSvg(s) {
  return s
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g, (_, r, g, b, a) => { const y = gris(+r, +g, +b); return `${a ? 'rgba' : 'rgb'}(${y}, ${y}, ${y}${a ?? ''})`; })
    .replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, hexAGris);
}

async function carpeta(de, a) {
  mkdirSync(a, {recursive: true});
  for (const f of readdirSync(de, {withFileTypes: true})) {
    const o = join(de, f.name), d = join(a, f.name);
    if (f.isDirectory()) { await carpeta(o, d); continue; }
    if (/\.png$/i.test(f.name)) { await sharp(o).grayscale().png({compressionLevel: 9}).toFile(d); console.log('png ', f.name); }
    else if (/\.svg$/i.test(f.name)) { writeFileSync(d, neutralizarSvg(readFileSync(o, 'utf8'))); console.log('svg ', f.name); }
    else copyFileSync(o, d);
  }
}
await carpeta(entrada, salida);
