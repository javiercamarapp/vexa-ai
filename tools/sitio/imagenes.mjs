#!/usr/bin/env node
// T13: tubería de imágenes del sitio. Lee los renders con alfa (hero, o1 a o4), genera WebP responsivo (y AVIF solo si
// ahorra 25 por ciento o más a igual calidad medida con PSNR), orbes dentro de un disco oscuro para secciones claras,
// y escribe la sección "img" de public/s/manifest.json con ancho, alto, bytes, hash y texto alternativo.
//
// Uso: node tools/sitio/imagenes.mjs [--verificar]
// Dependencias fuera del repo: $SITIO_BUILD_DIR/node_modules/sharp (npm ci con el package-lock de ahí).
// Gancho de T2: si existen $SITIO_SOCIAL_DIR/og-es.png y og-en.png (1200x630) se generan img/social-es y social-en.
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, '..', '..', 'apps', 'web');
const PUB = join(WEB, 'public', 's');
const DIR = join(PUB, 'img');
const MANIFEST = join(PUB, 'manifest.json');
const BUILD = process.env.SITIO_BUILD_DIR || join(homedir(), 'vexa-tools', 'sitio-build');
const ENTRADA = process.env.SITIO_RENDERS_DIR || join(homedir(), 'vexa-notas-28oct', 'landing', 'renders', 'r3', 'final');
const SOCIAL = process.env.SITIO_SOCIAL_DIR || join(homedir(), 'vexa-notas-28oct', 'landing', 'renders', 'social');
const sharp = createRequire(join(BUILD, 'package.json'))('sharp');

const TINTA = {r: 14, g: 14, b: 16}; // #0E0E10, único fondo permitido de los objetos
const ANCHOS = [480, 960, 1440];
const ANCHO_BASE = 960; // variante que devuelve url(clave) sin opciones
// SPEC sección 8: póster 60 KB, objetos 50 KB. La variante de 1440 (pantallas densas) no cabe con alfa en ese tope: tiene tope propio
// y el manifest la marca con densa: true para que el marcado no la ponga en srcset si el presupuesto de imágenes manda.
const TOPE_DENSA = 120 * 1000;
const TOPE = (id, ancho) => ancho === 1440 ? TOPE_DENSA : (ancho === 480 ? 20 : id === 'hero' ? 60 : 50) * 1000;
const ORBES = [96, 192];
const TOPE_ORBE = 20 * 1000;
const OBJETOS = ['hero', 'o1', 'o2', 'o3', 'o4'];
const sha = (b) => createHash('sha256').update(b).digest('hex');

// Texto alternativo: la fuente de verdad es landing.ts (clave imagenes, T11).
function alts() {
  const t = readFileSync(join(WEB, 'src', 'content', 'sitio', 'landing.ts'), 'utf8');
  const bloque = t.slice(t.indexOf('  imagenes: {'));
  const r = {};
  for (const id of [...OBJETOS, 'og']) {
    const m = bloque.match(new RegExp(`^\\s+${id}: \\{ es: '((?:[^'\\\\]|\\\\.)*)', en: '((?:[^'\\\\]|\\\\.)*)' \\}`, 'm'));
    if (!m) throw new Error(`ALT_FALTA imagenes.${id} en landing.ts`);
    r[id] = {es: m[1].replace(/\\'/g, "'"), en: m[2].replace(/\\'/g, "'")};
  }
  return r;
}

// PSNR sobre el compuesto en fondo oscuro; mide solo lo que el visitante ve.
async function compuesto(buf) {
  const {data, info} = await sharp(buf).flatten({background: TINTA}).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return {data, info};
}
function psnr(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  const mse = s / a.length;
  return mse === 0 ? 99 : 10 * Math.log10(255 * 255 / mse);
}

// Mayor calidad (o menor, según 'maxima') que cumple la condición; búsqueda binaria entera.
async function buscar(lo, hi, probar) {
  let mejor = null;
  while (lo <= hi) {
    const q = (lo + hi) >> 1;
    const r = await probar(q);
    if (r.ok) { mejor = {q, ...r}; lo = q + 1; } else hi = q - 1;
  }
  return mejor;
}

async function variantesObjeto(id, origen) {
  const alta = await sharp(origen).ensureAlpha().toBuffer();
  const salida = {webp: [], avif: []};
  for (const ancho of ANCHOS) {
    const base = await sharp(alta).resize(ancho, ancho, {kernel: 'lanczos3'}).png().toBuffer();
    const ref = await compuesto(base);
    const tope = TOPE(id, ancho);
    // El alfa (vidrio semitransparente) pesa más que el color: se prueban varias calidades de alfa y gana la de mayor PSNR bajo el tope.
    let w = null, calidadWebp = 0;
    for (const aq of [80, 60, 40, 25, 15, 8, 0]) {
      const r = await buscar(25, 90, async (q) => {
        const buf = await sharp(base).webp({quality: q, alphaQuality: aq, effort: 6, smartSubsample: true}).toBuffer();
        return {ok: buf.length <= tope, buf};
      });
      if (!r) continue;
      const p = psnr(ref.data, (await compuesto(r.buf)).data);
      if (!w || p > calidadWebp) { w = {...r, aq}; calidadWebp = p; }
    }
    if (!w) throw new Error(`PRESUPUESTO_IMAGEN ${id} ${ancho}: no cabe en ${tope} B`);
    salida.webp.push({ancho, alto: ancho, buf: w.buf, calidad: `${w.q}/a${w.aq}`, psnr: calidadWebp});
    // AVIF: la calidad más baja que iguala el PSNR del WebP elegido.
    let lo = 20, hi = 80, mejor = null;
    while (lo <= hi) {
      const q = (lo + hi) >> 1;
      const buf = await sharp(base).avif({quality: q, effort: 4, chromaSubsampling: '4:2:0'}).toBuffer();
      if (psnr(ref.data, (await compuesto(buf)).data) >= calidadWebp) { mejor = {q, buf}; hi = q - 1; } else lo = q + 1;
    }
    if (mejor && mejor.buf.length <= w.buf.length * 0.75 && mejor.buf.length <= tope) {
      salida.avif.push({ancho, alto: ancho, buf: mejor.buf, calidad: mejor.q});
    }
  }
  return salida;
}

// Orbe: el objeto dentro de un disco #0E0E10 con alfa fuera del círculo, para ir sobre secciones claras.
async function orbes(origen) {
  const lista = [];
  for (const d of ORBES) {
    const objeto = await sharp(origen).ensureAlpha().resize(d, d, {kernel: 'lanczos3'}).png().toBuffer();
    const mascara = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`);
    const disco = await sharp({create: {width: d, height: d, channels: 3, background: TINTA}})
      .composite([{input: objeto}, {input: mascara, blend: 'dest-in'}]).png().toBuffer();
    const w = await buscar(30, 90, async (q) => {
      const buf = await sharp(disco).webp({quality: q, alphaQuality: 90, effort: 6}).toBuffer();
      return {ok: buf.length <= TOPE_ORBE, buf};
    });
    if (!w) throw new Error(`PRESUPUESTO_ORBE ${d}`);
    lista.push({ancho: d, alto: d, buf: w.buf, calidad: w.q});
  }
  return lista;
}

const hash8 = (buf) => sha(buf).slice(0, 8);
function archivo(clave, ancho, buf, ext) { return `${clave}-${ancho}.${hash8(buf)}.${ext}`; }
const pub = (n) => `/s/img/${n}`;
const fila = (n, v) => ({url: pub(n), ancho: v.ancho, alto: v.alto, bytes: v.buf.length, sha256: sha(v.buf), ...(v.ancho === 1440 ? {densa: true} : {})});

function escribirJson(archivoJson, obj) {
  const orden = (o) => Array.isArray(o) ? o.map(orden) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, orden(o[k])])) : o;
  writeFileSync(archivoJson, JSON.stringify(orden(obj), null, 1) + '\n');
}

async function construir() {
  const textos = alts();
  const archivos = new Map(); // nombre -> buffer
  const seccion = {};
  const informe = [];
  for (const id of OBJETOS) {
    const origen = join(ENTRADA, `${id}.png`);
    if (!existsSync(origen)) throw new Error(`FALTA_RENDER ${origen}`);
    const v = await variantesObjeto(id, origen);
    const variantes = v.webp.map((x) => { const n = archivo(id, x.ancho, x.buf, 'webp'); archivos.set(n, x.buf); informe.push(`${id} webp ${x.ancho} q${x.calidad} ${x.buf.length} B psnr ${x.psnr.toFixed(1)}`); return fila(n, x); });
    const avif = v.avif.map((x) => { const n = archivo(id, x.ancho, x.buf, 'avif'); archivos.set(n, x.buf); informe.push(`${id} avif ${x.ancho} q${x.calidad} ${x.buf.length} B`); return fila(n, x); });
    const base = variantes.find((x) => x.ancho === ANCHO_BASE);
    seccion[id] = {
      url: base.url, ancho: base.ancho, alto: base.alto, bytes: base.bytes, sha256: base.sha256,
      variantes, ...(avif.length ? {avif} : {}),
      alt: textos[id], fondo: 'oscuro', tipo: id === 'hero' ? 'poster' : 'objeto',
    };
    const orbe = (await orbes(origen)).map((x) => { const n = archivo(`${id}-orbe`, x.ancho, x.buf, 'webp'); archivos.set(n, x.buf); informe.push(`${id}-orbe webp ${x.ancho} q${x.calidad} ${x.buf.length} B`); return fila(n, x); });
    const ob = orbe[orbe.length - 1];
    seccion[`${id}-orbe`] = {url: ob.url, ancho: ob.ancho, alto: ob.alto, bytes: ob.bytes, sha256: ob.sha256, variantes: orbe, alt: textos[id], fondo: 'cualquiera', tipo: 'orbe'};
  }
  // Gancho de T2: imagen social 1200x630 por idioma (JPEG: los rastreadores sociales no leen WebP de forma fiable).
  for (const lang of ['es', 'en']) {
    const origen = join(SOCIAL, `og-${lang}.png`);
    if (!existsSync(origen)) { informe.push(`social-${lang}: pendiente (no existe ${origen})`); continue; }
    const buf = await sharp(origen).resize(1200, 630, {fit: 'cover'}).jpeg({quality: 84, mozjpeg: true}).toBuffer();
    const n = archivo(`social-${lang}`, 1200, buf, 'jpg');
    archivos.set(n, buf);
    const f = fila(n, {ancho: 1200, alto: 630, buf});
    seccion[`social-${lang}`] = {...f, variantes: [f], alt: {es: textos.og.es, en: textos.og.en}, fondo: 'cualquiera', tipo: 'social'};
    informe.push(`social-${lang} jpg ${buf.length} B`);
  }
  return {archivos, seccion, informe};
}

async function main() {
  const {archivos, seccion, informe} = await construir();
  if (process.argv.includes('--verificar')) {
    let mal = 0;
    for (const [n, buf] of archivos) if (!existsSync(join(DIR, n)) || sha(readFileSync(join(DIR, n))) !== sha(buf)) { console.error('DIFIERE', n); mal++; }
    process.exit(mal ? 1 : 0);
  }
  mkdirSync(DIR, {recursive: true});
  for (const f of readdirSync(DIR)) if (/\.(webp|avif|jpg)$/.test(f)) rmSync(join(DIR, f));
  for (const [n, buf] of archivos) writeFileSync(join(DIR, n), buf);
  const man = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {version: 1};
  man.version = 1;
  man.img = seccion;
  escribirJson(MANIFEST, man);
  console.log(informe.join('\n'));
}
main().catch((e) => { console.error(e); process.exit(1); });
