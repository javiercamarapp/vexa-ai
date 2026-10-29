#!/usr/bin/env node
// T13: tubería de fuentes del sitio. Descarga las fuentes OFL de google/fonts (commit fijado, SHA-256 verificado),
// las reduce con fonttools (instancia de ejes + subconjunto latino), escribe woff2 con hash de 8 en el nombre,
// calcula las caras de respaldo con métricas ajustadas y emite fuentes.css, LICENCIAS.txt y la sección "fuentes"
// de public/s/manifest.json.
//
// Uso: node tools/sitio/fuentes.mjs [--descargar] [--verificar]
//   --descargar  baja las fuentes que falten a $SITIO_BUILD_DIR/fuentes-src (por defecto ~/vexa-tools/sitio-build)
//   --verificar  reconstruye en memoria y falla si algo difiere de lo publicado (frescura)
// Dependencias fuera del repo: $SITIO_BUILD_DIR/venv (fonttools + brotli por pip, versiones en versiones.lock).
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {brotliCompressSync, constants as zc} from 'node:zlib';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = join(AQUI, '..', '..');
const WEB = join(REPO, 'apps', 'web');
const PUB = join(WEB, 'public', 's');
const DIR_FUENTES = join(PUB, 'fuentes');
const CSS = join(WEB, 'src', 'styles', 'sitio', 'fuentes.css');
const MANIFEST = join(PUB, 'manifest.json');
const BUILD = process.env.SITIO_BUILD_DIR || join(homedir(), 'vexa-tools', 'sitio-build');
const PY = join(BUILD, 'venv', 'bin', 'python');
const SRC = join(BUILD, 'fuentes-src');

// Origen: repositorio google/fonts. Cada familia se fija al último commit que tocó su carpeta (consultado el 2026-10-28).
const GF = 'https://raw.githubusercontent.com/google/fonts';
const FAMILIAS = {
  serif: {commit: '08dc85da6bca7ae308a6f1d38d0b137465646071', carpeta: 'sourceserif4', proyecto: 'https://github.com/adobe-fonts/source-serif',
    archivos: {'SourceSerif4-opsz-wght.ttf': {ruta: 'SourceSerif4[opsz,wght].ttf', sha256: '97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b'}}},
  sans: {commit: 'c1eda9233c33ad7775b27efd794f931095cf6133', carpeta: 'hankengrotesk', proyecto: 'https://github.com/marcologous/hanken-grotesk',
    archivos: {'HankenGrotesk-wght.ttf': {ruta: 'HankenGrotesk[wght].ttf', sha256: '813b3f8fa0965405669a89b38e51bbefd95eef6b8e20d1cb2d8c10cce062662f'}}},
  mono: {commit: '01d5d9f05246fb7090a8403b81257535cb1a088b', carpeta: 'ibmplexmono', proyecto: 'https://github.com/IBM/plex',
    archivos: {
      'IBMPlexMono-Regular.ttf': {ruta: 'IBMPlexMono-Regular.ttf', sha256: '6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46'},
      'IBMPlexMono-Medium.ttf': {ruta: 'IBMPlexMono-Medium.ttf', sha256: 'a9b4c49bb299e05b5f6c481e7fb5e78943d2793249a0c8874ab574a2d1ea6755'},
    }},
};

// Glifos: español de México e inglés. ASCII, Latin-1 (¿ ¡ « » © ñ tildes ü), œ, comillas, rayas, puntos suspensivos,
// viñeta, euro, signo menos, marca registrada, flechas de interfaz. Lo que la fuente no trae se descarta solo.
const UNICODE_LATIN = 'U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+2197,U+2212';
// Rangos que se declaran en @font-face: Latin + Latin-1 + puntuación, igual que el subconjunto.
const FEATURES_TEXTO = 'kern,liga,calt,ccmp,locl,mark,mkmk,case,tnum,lnum,pnum';

// Una salida por archivo woff2. instancia: ejes que se fijan o limitan antes del subconjunto.
const SALIDAS = [
  {clave: 'display', familia: 'serif', fuente: 'SourceSerif4-opsz-wght.ttf', instancia: 'opsz=32 wght=300:400', css: 'Source Serif 4', peso: '300 400', display: 'swap', precarga: true, uso: 'Titulares (Serif 300, opsz fijo 32)', medir: 300},
  {clave: 'texto', familia: 'sans', fuente: 'HankenGrotesk-wght.ttf', instancia: 'wght=400:600', css: 'Hanken Grotesk', peso: '400 600', display: 'swap', precarga: true, uso: 'Cuerpo y botones (400, 500, 600 de T6)', medir: 400},
  {clave: 'mono-400', familia: 'mono', fuente: 'IBMPlexMono-Regular.ttf', instancia: null, css: 'IBM Plex Mono', peso: '400', display: 'optional', precarga: false, uso: 'Etiquetas y numerales', medir: 400},
  {clave: 'mono-500', familia: 'mono', fuente: 'IBMPlexMono-Medium.ttf', instancia: null, css: 'IBM Plex Mono', peso: '500', display: 'optional', precarga: false, uso: 'Cifras de mockup', medir: 500},
];

// Respaldos: fuente de sistema contra la que se calcula size-adjust. Se pesan con una frecuencia fija de letras
// (español e inglés a partes iguales; el espacio pesa 15 por ciento) para que el resultado no cambie cuando cambia el texto.
const RESPALDOS = {
  serif: {nombre: 'Source Serif 4 Fallback', local: ['Times New Roman', 'TimesNewRomanPSMT'], archivo: '/System/Library/Fonts/Supplemental/Times New Roman.ttf'},
  sans: {nombre: 'Hanken Grotesk Fallback', local: ['Arial', 'ArialMT'], archivo: '/System/Library/Fonts/Supplemental/Arial.ttf'},
  mono: {nombre: 'IBM Plex Mono Fallback', local: ['Courier New', 'CourierNewPSMT'], archivo: '/System/Library/Fonts/Supplemental/Courier New.ttf'},
};

const sha = (b) => createHash('sha256').update(b).digest('hex');
const brotli = (b) => brotliCompressSync(b, {params: {[zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_MODE]: zc.BROTLI_MODE_FONT}}).length;
const args = new Set(process.argv.slice(2));

// ---------- descarga ----------
async function descargar() {
  mkdirSync(SRC, {recursive: true});
  for (const [id, f] of Object.entries(FAMILIAS)) {
    const pedidos = [...Object.entries(f.archivos).map(([n, a]) => [n, a.ruta, a.sha256]), [`OFL-${f.carpeta}.txt`, 'OFL.txt', null]];
    for (const [nombre, ruta, hash] of pedidos) {
      const destino = join(SRC, nombre);
      if (existsSync(destino) && (!hash || sha(readFileSync(destino)) === hash)) continue;
      const url = `${GF}/${f.commit}/ofl/${f.carpeta}/${encodeURI(ruta)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`DESCARGA_FALLO ${r.status} ${url}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (hash && sha(buf) !== hash) throw new Error(`HASH_FUENTE_DISTINTO ${nombre}: ${sha(buf)}`);
      writeFileSync(destino, buf);
      console.log('descargado', nombre);
    }
    void id;
  }
}

// ---------- trabajo de fonttools (un solo proceso de Python) ----------
const PY_TRABAJO = String.raw`
import sys, json, io, os
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer
from fontTools.ttLib.woff2 import compress

cfg = json.load(sys.stdin)
FREQ = {}
for k, v in {'e':13.2,'a':10.4,'o':8.1,'s':6.8,'r':6.4,'n':6.7,'i':6.6,'d':5.1,'l':4.5,'c':3.7,'t':6.8,'u':3.3,'m':2.8,'p':2.2,'b':1.45,'h':3.4,'q':0.5,'y':1.45,'v':0.95,'g':1.5,'f':1.45,'j':0.28,'z':0.28,'ñ':0.15,'x':0.18,'k':0.4,'w':1.2}.items():
    FREQ[k] = v
FREQ[' '] = 0.15 / 0.85 * sum(FREQ.values())

def ancho_medio(font, wght=None):
    cmap = font.getBestCmap(); hmtx = font['hmtx']; upm = font['head'].unitsPerEm
    tot = 0.0; peso = 0.0
    for ch, w in FREQ.items():
        g = cmap.get(ord(ch))
        if g is None: continue
        tot += hmtx[g][0] * w; peso += w
    return tot / peso / upm

def metricas(font):
    upm = font['head'].unitsPerEm; h = font['hhea']; o = font['OS/2']
    if o.fsSelection & 128:
        return o.sTypoAscender / upm, -o.sTypoDescender / upm, o.sTypoLineGap / upm
    return h.ascent / upm, -h.descent / upm, h.lineGap / upm

salida = {}
for s in cfg['salidas']:
    f = TTFont(s['entrada'], recalcTimestamp=False)
    if s['instancia']:
        limites = {}
        for par in s['instancia'].split():
            eje, val = par.split('=')
            if ':' in val:
                a, b = val.split(':'); limites[eje] = (float(a), float(b))
            else:
                limites[eje] = float(val)
        f = instancer.instantiateVariableFont(f, limites, inplace=False)
        _b = io.BytesIO(); f.save(_b); _b.seek(0); f = TTFont(_b, recalcTimestamp=False)  # recargar: evita un gvar a medio construir
    # medir el ancho de la cara que se usará, con el peso de medición, antes del subconjunto (la instancia completa)
    if s['medir_peso'] and 'fvar' in f:
        m = instancer.instantiateVariableFont(f, {'wght': s['medir_peso']}, inplace=False)
    else:
        m = f
    ancho_web = ancho_medio(m); asc, desc, gap = metricas(m)
    opciones = subset.Options()
    opciones.layout_features = s['features'].split(',')
    opciones.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    opciones.notdef_outline = True
    opciones.glyph_names = False
    opciones.hinting = False
    opciones.desubroutinize = True
    opciones.flavor = 'woff2'
    opciones.drop_tables += ['DSIG', 'FFTM', 'prep', 'fpgm', 'cvt ', 'gasp']
    sub = subset.Subsetter(opciones)
    sub.populate(unicodes=subset.parse_unicodes(cfg['unicode']))
    sub.subset(f)
    if s['renombrar']:
        # OFL con nombre reservado: el subconjunto es una versión modificada y no puede llevar el nombre reservado.
        for r in f['name'].names:
            if r.nameID in (1, 3, 4, 6, 16, 17, 21, 22):
                t = r.toUnicode()
                t = t.replace('IBM Plex Mono', 'Rovaq Mono').replace('IBMPlexMono', 'RovaqMono').replace('Plex', 'Rovaq')
                r.string = t
    f.flavor = 'woff2'
    buf = io.BytesIO(); f.save(buf)
    cmap = f.getBestCmap()
    with open(s['destino'], 'wb') as fh: fh.write(buf.getvalue())
    # respaldo
    rf = TTFont(s['respaldo'], fontNumber=0)
    ancho_resp = ancho_medio(rf)
    salida[s['clave']] = {
        'anchoWeb': ancho_web, 'anchoRespaldo': ancho_resp,
        'ascent': asc, 'descent': desc, 'lineGap': gap,
        'glifos': len(cmap), 'codepoints': sorted(cmap.keys()),
        'ejes': [[a.axisTag, a.minValue, a.defaultValue, a.maxValue] for a in f['fvar'].axes] if 'fvar' in f else [],
    }
json.dump(salida, sys.stdout)
`;

function construir(dirSalida) {
  mkdirSync(dirSalida, {recursive: true});
  const trabajos = SALIDAS.map((s) => ({
    clave: s.clave, entrada: join(SRC, s.fuente), instancia: s.instancia, medir_peso: s.instancia ? s.medir : null,
    destino: join(dirSalida, `${s.clave}.tmp.woff2`), features: FEATURES_TEXTO, respaldo: RESPALDOS[s.familia].archivo,
    renombrar: s.familia === 'mono',
  }));
  const r = execFileSync(PY, ['-I', '-c', PY_TRABAJO], {input: JSON.stringify({salidas: trabajos, unicode: UNICODE_LATIN}), maxBuffer: 1 << 26});
  return JSON.parse(r.toString());
}

function redondear(x, d = 2) { return Math.round(x * 10 ** d) / 10 ** d; }

function generar() {
  for (const f of Object.values(FAMILIAS)) {
    for (const n of Object.keys(f.archivos)) if (!existsSync(join(SRC, n))) throw new Error(`FALTA_FUENTE ${n}: ejecuta con --descargar`);
  }
  const tmp = join(BUILD, 'tmp-fuentes');
  rmSync(tmp, {recursive: true, force: true});
  const m = construir(tmp);
  const salidas = {};
  for (const s of SALIDAS) {
    const buf = readFileSync(join(tmp, `${s.clave}.tmp.woff2`));
    const hash = sha(buf).slice(0, 8);
    const nombre = `${s.clave}.${hash}.woff2`;
    const x = m[s.clave];
    const resp = RESPALDOS[s.familia];
    const ajuste = x.anchoWeb / x.anchoRespaldo;
    salidas[s.clave] = {
      ...s, buf, nombre, hash, bytes: buf.length, brotli: brotli(buf), sha256: sha(buf),
      ajuste, ascOv: x.ascent / ajuste, descOv: x.descent / ajuste, gapOv: x.gapOv ?? x.lineGap / ajuste,
      glifos: x.glifos, ejes: x.ejes, resp,
    };
  }
  rmSync(tmp, {recursive: true, force: true});
  return salidas;
}

function pct(x) { return `${redondear(x * 100, 2)}%`; }

function cssDe(s) {
  const lineas = [];
  lineas.push('/* GENERADO por tools/sitio/fuentes.mjs (T13). No editar a mano: node tools/sitio/fuentes.mjs.');
  lineas.push(' * Fuentes OFL 1.1 reducidas a latín (español de México e inglés), woff2 con hash de 8 en el nombre.');
  lineas.push(' * Texto: font-display swap con cara de respaldo de métricas ajustadas (CLS cercano a cero). IBM Plex Mono: optional.');
  lineas.push(' * Precarga solo de display y texto (ver "precargas" en public/s/manifest.json). Licencias: public/s/fuentes/LICENCIAS.txt */');
  lineas.push('');
  for (const c of SALIDAS) {
    const x = s[c.clave];
    lineas.push('@font-face {');
    lineas.push(`  font-family: "${c.css}";`);
    lineas.push(`  src: url("/s/fuentes/${x.nombre}") format("woff2");`);
    lineas.push(`  font-weight: ${c.peso};`);
    lineas.push('  font-style: normal;');
    lineas.push(`  font-display: ${c.display};`);
    lineas.push(`  unicode-range: ${UNICODE_LATIN};`);
    lineas.push('}');
    lineas.push('');
  }
  // un respaldo por familia; el de mono y el de texto no necesitan peso porque local() elige regular y negrita sola
  const hechas = new Set();
  for (const c of SALIDAS) {
    if (hechas.has(c.familia)) continue;
    hechas.add(c.familia);
    const x = s[c.clave];
    const r = x.resp;
    lineas.push('@font-face {');
    lineas.push(`  font-family: "${r.nombre}";`);
    lineas.push(`  src: ${r.local.map((n) => `local("${n}")`).join(', ')};`);
    lineas.push(`  size-adjust: ${pct(x.ajuste)};`);
    lineas.push(`  ascent-override: ${pct(x.ascOv)};`);
    lineas.push(`  descent-override: ${pct(x.descOv)};`);
    lineas.push(`  line-gap-override: ${pct(x.gapOv)};`);
    lineas.push('}');
    lineas.push('');
  }
  return lineas.join('\n');
}

let s;
function licencias() {
  const p = [];
  p.push('LICENCIAS DE LAS FUENTES DEL SITIO (rovaq.ai)');
  p.push('Las tres familias se publican bajo la SIL Open Font License, Version 1.1 (OFL 1.1). Cada texto de licencia se copió completo,');
  p.push('sin cambios, de la carpeta ofl/ del repositorio google/fonts en el commit indicado.');
  p.push('Los archivos woff2 de esta carpeta son versiones MODIFICADAS (subconjunto latino y, en las variables, limitación de ejes).');
  p.push('Por la OFL, una versión modificada no puede usar un Nombre de Fuente Reservado. IBM Plex lo declara ("Plex"): en los dos');
  p.push('archivos mono-*.woff2 se renombraron las entradas de nombre (IDs 1, 3, 4, 6, 16 y 17) a "Rovaq Mono"; el aviso de derechos y la licencia');
  p.push('internas (IDs 0, 13 y 14) se conservan. El nombre "IBM Plex Mono" solo aparece en el CSS como alias de la cara (font-family del @font-face).');
  p.push('Source Serif 4 y Hanken Grotesk no declaran nombre reservado en su encabezado de OFL.txt.');
  p.push('');
  for (const [id, f] of Object.entries(FAMILIAS)) {
    const txt = readFileSync(join(SRC, `OFL-${f.carpeta}.txt`), 'utf8');
    const uso = SALIDAS.filter((c) => c.familia === id).map((c) => `${s[c.clave].nombre} (${c.uso})`);
    p.push('='.repeat(78));
    p.push(`FAMILIA: ${SALIDAS.find((c) => c.familia === id).css}`);
    p.push(`Proyecto: ${f.proyecto}`);
    p.push(`Procedencia: ${GF.replace('raw.githubusercontent.com', 'github.com')}/blob/${f.commit}/ofl/${f.carpeta}/`);
    p.push(`Commit de google/fonts: ${f.commit}`);
    p.push(`Archivos fuente: ${Object.entries(f.archivos).map(([n, a]) => `${n} (sha256 ${a.sha256})`).join('; ')}`);
    p.push(`Archivos publicados: ${uso.join('; ')}`);
    p.push(`Encabezado de OFL.txt: ${txt.split('\n').find((l) => /^Copyright/.test(l))}`);
    p.push(`Licencia: ${/SIL OPEN FONT LICENSE Version 1\.1/.test(txt) ? 'SIL Open Font License, Version 1.1 (verificada en el texto)' : 'NO VERIFICADA'}`);
    p.push('');
    p.push(txt.trimEnd());
    p.push('');
  }
  return p.join('\n');
}

function leerManifest() { return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {version: 1}; }
function escribirJson(archivo, obj) {
  const orden = (o) => Array.isArray(o) ? o.map(orden) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, orden(o[k])])) : o;
  writeFileSync(archivo, JSON.stringify(orden(obj), null, 1) + '\n');
}

async function main() {
  if (args.has('--descargar')) await descargar();
  s = generar();
  const css = cssDe(s);
  const lic = licencias();
  const seccion = {};
  for (const c of SALIDAS) {
    const x = s[c.clave];
    seccion[c.clave] = {
      url: `/s/fuentes/${x.nombre}`, bytes: x.bytes, brotli: x.brotli, sha256: x.sha256, hash: x.hash,
      familia: c.css, peso: c.peso, display: c.display, formato: 'woff2', glifos: x.glifos, ejes: x.ejes,
    };
  }
  const precargas = SALIDAS.filter((c) => c.precarga).map((c) => ({clave: `fuentes/${c.clave}`, url: seccion[c.clave].url, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous'}));

  if (args.has('--verificar')) {
    let mal = 0;
    for (const [c, x] of Object.entries(seccion)) {
      const en = join(DIR_FUENTES, `${c}.${x.hash}.woff2`);
      const ok = existsSync(en) && sha(readFileSync(en)) === x.sha256;
      if (!ok) { console.error('DIFIERE', en); mal++; }
    }
    if (!existsSync(CSS) || readFileSync(CSS, 'utf8') !== css) { console.error('DIFIERE fuentes.css'); mal++; }
    process.exit(mal ? 1 : 0);
  }

  mkdirSync(DIR_FUENTES, {recursive: true});
  for (const f of readdirSync(DIR_FUENTES)) if (f.endsWith('.woff2')) rmSync(join(DIR_FUENTES, f));
  for (const c of SALIDAS) writeFileSync(join(DIR_FUENTES, s[c.clave].nombre), s[c.clave].buf);
  writeFileSync(join(DIR_FUENTES, 'LICENCIAS.txt'), lic);
  writeFileSync(CSS, css);
  const man = leerManifest();
  man.version = 1;
  man.fuentes = seccion;
  man.precargas = [...(man.precargas ?? []).filter((p) => !p.clave.startsWith('fuentes/')), ...precargas];
  escribirJson(MANIFEST, man);

  let total = 0;
  console.log('clave       bruto     brotli   glifos  ajuste   asc     desc    gap');
  for (const c of SALIDAS) {
    const x = s[c.clave]; total += x.brotli;
    console.log(`${c.clave.padEnd(10)} ${String(x.bytes).padStart(7)} ${String(x.brotli).padStart(8)} ${String(x.glifos).padStart(7)}  ${pct(x.ajuste).padStart(7)} ${pct(x.ascOv).padStart(7)} ${pct(x.descOv).padStart(7)} ${pct(x.gapOv).padStart(6)}  ${x.nombre}`);
  }
  console.log(`TOTAL brotli: ${total} B (${redondear(total / 1024, 1)} KiB); presupuesto 130 KB, objetivo 85 KB`);
}
main().catch((e) => { console.error(e); process.exit(1); });
