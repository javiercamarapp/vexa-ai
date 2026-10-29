#!/usr/bin/env node
// T13: tubería de JavaScript del sitio y ensamblado del manifest.
//  1. Minifica con esbuild cada apps/web/src/sitio-js/{sitio,inicio}.js que exista y lo escribe en
//     public/s/<nombre>.<hash8>.js (módulo ES del mismo origen, sin eval ni wasm, sin mapa de fuente).
//  2. Ya no hay bibliotecas vendoreadas (sin Lenis) ni nubes de puntos: scroll nativo y capturas reales del producto.
// Contrato para T10: basta con dejar sitio.js e inicio.js en sitio-js/ y volver a correr este script; entran solos.
// Los scripts no se importan entre sí por ruta: las URL con hash se leen del manifest (data-* o JSON en el marcado).
//
// Uso: node tools/sitio/construir-js.mjs [--verificar]
// Dependencias fuera del repo: $SITIO_BUILD_DIR/node_modules/esbuild.
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {brotliCompressSync, constants as zc} from 'node:zlib';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..', 'apps', 'web');
const SRC = join(WEB, 'src', 'sitio-js');
const PUB = join(WEB, 'public', 's');
const VENDOR = join(WEB, 'public', 'vendor');
const MANIFEST = join(PUB, 'manifest.json');
const BUILD = process.env.SITIO_BUILD_DIR || join(homedir(), 'vexa-tools', 'sitio-build');
const esbuild = createRequire(join(BUILD, 'package.json'))('esbuild');

const SCRIPTS = ['sitio', 'inicio'];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const brotli = (b) => brotliCompressSync(b, {params: {[zc.BROTLI_PARAM_QUALITY]: 11}}).length;
const PROHIBIDO = [/\beval\s*\(/, /new\s+Function\s*\(/, /WebAssembly/, /importScripts/, /document\.write\s*\(/];

function escribirJson(archivo, obj) {
  const orden = (o) => Array.isArray(o) ? o.map(orden) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, orden(o[k])])) : o;
  writeFileSync(archivo, JSON.stringify(orden(obj), null, 1) + '\n');
}

async function construirScripts() {
  const salida = new Map(); // archivo -> {nombre, buf}
  const clave = {};
  const pendientes = [];
  for (const n of SCRIPTS) {
    const entrada = join(SRC, `${n}.js`);
    if (!existsSync(entrada)) { pendientes.push(`${n}.js`); continue; }
    const r = await esbuild.build({
      entryPoints: [entrada], bundle: false, minify: true, format: 'esm', target: 'es2020', charset: 'utf8',
      legalComments: 'none', sourcemap: false, write: false, logLevel: 'silent',
    });
    const buf = Buffer.from(r.outputFiles[0].contents);
    const texto = buf.toString('utf8');
    for (const re of PROHIBIDO) if (re.test(texto)) throw new Error(`JS_PROHIBIDO ${n}.js: ${re}`);
    const hash = sha(buf).slice(0, 8);
    const archivo = `${n}.${hash}.js`;
    salida.set(archivo, buf);
    clave[`${n}.js`] = {
      url: `/s/${archivo}`, bytes: buf.length, brotli: brotli(buf), sha256: sha(buf), hash,
      fuenteBytes: readFileSync(entrada).length, modulo: true,
    };
  }
  return {salida, clave, pendientes};
}

async function main() {
  const {salida, clave, pendientes} = await construirScripts();
  const js = {...clave};
  if (process.argv.includes('--verificar')) {
    let mal = 0;
    for (const [n, buf] of salida) if (!existsSync(join(PUB, n)) || sha(readFileSync(join(PUB, n))) !== sha(buf)) { console.error('DIFIERE', n); mal++; }
    const man = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    if (JSON.stringify(man.js) !== JSON.stringify(JSON.parse(JSON.stringify(js)))) { /* el orden de claves no importa */ }
    for (const k of Object.keys(js)) if (!man.js?.[k] || man.js[k].sha256 !== js[k].sha256) { console.error('MANIFEST_DIFIERE js', k); mal++; }
    process.exit(mal ? 1 : 0);
  }
  mkdirSync(PUB, {recursive: true});
  for (const f of readdirSync(PUB)) if (/^[a-z]+\.[0-9a-f]{8}\.js$/.test(f)) rmSync(join(PUB, f));
  for (const [n, buf] of salida) writeFileSync(join(PUB, n), buf);
  const man = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {version: 1};
  man.version = 1;
  man.js = js;
  delete man.pts;
  man.md = man.md ?? {}; // T2 llena la sección md
  man.auxiliares = ['fuentes/LICENCIAS.txt']; // archivos de public/s que no se sirven por clave pero van con los activos
  escribirJson(MANIFEST, man);
  for (const [k, e] of Object.entries(js)) console.log(`${k.padEnd(14)} ${String(e.bytes).padStart(7)} B  brotli ${String(e.brotli).padStart(6)} B  ${e.url}`);
  if (pendientes.length) console.log(`pendientes (aún no existen en src/sitio-js): ${pendientes.join(', ')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
