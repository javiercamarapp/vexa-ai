// T13: manifest de activos (contrato K3), hashes, presupuestos de peso por tipo, licencias, determinismo y archivos huérfanos.
// Los pasos que reconstruyen (fuentes, JS, imágenes) necesitan ~/vexa-tools/sitio-build; si no existe se saltan.
// Las imágenes solo se reconstruyen con SITIO_VERIFICAR_IMAGENES=1 (tardan unos minutos por la búsqueda de calidad).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join, relative} from 'node:path';
import {brotliCompressSync, constants as zc} from 'node:zlib';

const raiz = join(import.meta.dirname, '..', '..');
const repo = join(raiz, '..', '..');
const pub = join(raiz, 'public');
const manifest = JSON.parse(readFileSync(join(pub, 's', 'manifest.json'), 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const brotli = (b) => brotliCompressSync(b, {params: {[zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_MODE]: zc.BROTLI_MODE_GENERIC}}).length;
const brotliFuente = (b) => brotliCompressSync(b, {params: {[zc.BROTLI_PARAM_QUALITY]: 11, [zc.BROTLI_PARAM_MODE]: zc.BROTLI_MODE_FONT}}).length;
const disco = (url) => join(pub, url.replace(/^\//, ''));
const KB = 1000;
const SECCIONES = ['js', 'pts', 'img', 'fuentes', 'md'];
const herramientas = existsSync(join(process.env.SITIO_BUILD_DIR || join(homedir(), 'vexa-tools', 'sitio-build'), 'node_modules', 'esbuild'));

function entradas() {
  const r = [];
  for (const s of SECCIONES) for (const [k, e] of Object.entries(manifest[s] ?? {})) r.push({seccion: s, clave: k, e});
  return r;
}
// Cada archivo servible que declara una entrada: la propia y sus variantes.
function archivosDeclarados() {
  const r = [];
  for (const {seccion, clave, e} of entradas()) {
    r.push({seccion, clave, url: e.url, sha256: e.sha256, bytes: e.bytes});
    for (const v of [...(e.variantes ?? []), ...(e.avif ?? [])]) r.push({seccion, clave, url: v.url, sha256: v.sha256, bytes: v.bytes});
  }
  return r;
}

test('manifest válido: versión, secciones conocidas, claves con url pública y sin campos faltantes', () => {
  assert.equal(manifest.version, 1);
  for (const k of Object.keys(manifest)) assert.ok(['version', 'precargas', 'auxiliares', ...SECCIONES].includes(k), `sección desconocida ${k}`);
  for (const s of ['js', 'pts', 'img', 'fuentes']) assert.ok(Object.keys(manifest[s] ?? {}).length > 0, `sección vacía ${s}`);
  for (const {seccion, clave, e} of entradas()) {
    assert.match(e.url, /^\/(s|vendor)\/[A-Za-z0-9._\-\/]+$/, `${seccion}/${clave}`);
    assert.match(e.sha256, /^[0-9a-f]{64}$/, `${seccion}/${clave} sha256`);
    assert.ok(Number.isInteger(e.bytes) && e.bytes > 0, `${seccion}/${clave} bytes`);
    assert.ok(Number.isInteger(e.brotli ?? 1) && (e.brotli ?? 1) > 0);
  }
  for (const k of ['nube.js', 'lenis.js']) assert.ok(manifest.js[k], `falta js/${k}`);
  for (const k of ['hero', 'o1', 'o2', 'o3', 'o4']) assert.ok(manifest.pts[k] && manifest.img[k] && manifest.img[`${k}-orbe`], `falta ${k}`);
  for (const k of ['display', 'texto', 'mono-400', 'mono-500']) assert.ok(manifest.fuentes[k], `falta fuentes/${k}`);
});

test('los hashes del manifest coinciden con los archivos y con el sufijo de 8 caracteres del nombre', () => {
  for (const a of archivosDeclarados()) {
    assert.ok(existsSync(disco(a.url)), `no existe ${a.url}`);
    const buf = readFileSync(disco(a.url));
    assert.equal(sha(buf), a.sha256, a.url);
    assert.equal(buf.length, a.bytes, a.url);
    if (a.url.startsWith('/s/')) assert.match(a.url, new RegExp(`\\.${a.sha256.slice(0, 8)}\\.[a-z0-9]+$`), `hash en el nombre: ${a.url}`);
  }
  // brotli declarado: se recalcula en las secciones que lo llevan
  for (const {seccion, clave, e} of entradas()) {
    if (!e.brotli) continue;
    const buf = readFileSync(disco(e.url));
    const esperado = seccion === 'fuentes' ? brotliFuente(buf) : brotli(buf);
    if (seccion === 'pts') continue; // el campo brotli de PTS3 lo mide T5 sobre el crudo con gzip interno
    assert.equal(e.brotli, esperado, `${seccion}/${clave} brotli`);
  }
});

test('Lenis: el hash del manifest es el de vendor.lock.json y el archivo coincide', () => {
  const lock = JSON.parse(readFileSync(join(pub, 'vendor', 'vendor.lock.json'), 'utf8')).archivos.find((x) => x.nombre === 'lenis');
  const e = manifest.js['lenis.js'];
  assert.equal(e.sha256, lock.sha256);
  assert.equal(e.url, `/vendor/${lock.archivo}`);
  assert.equal(sha(readFileSync(join(pub, 'vendor', lock.archivo))), lock.sha256);
  assert.equal(e.version, '1.1.13');
});

test('imágenes: todas con alt en español e inglés, ancho y alto definidos y reales en el archivo', () => {
  const dimWebp = (b) => {
    assert.equal(b.toString('latin1', 0, 4), 'RIFF');
    const t = b.toString('latin1', 12, 16);
    if (t === 'VP8X') return {w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3)};
    if (t === 'VP8 ') return {w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff};
    throw new Error('WebP no reconocido ' + t);
  };
  const dimAvif = (b) => { const i = b.indexOf('ispe'); return {w: b.readUInt32BE(i + 8), h: b.readUInt32BE(i + 12)}; };
  const dimJpg = (b) => { let i = 2; while (i < b.length) { const m = b[i + 1]; const l = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return {w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5)}; i += 2 + l; } };
  for (const [clave, e] of Object.entries(manifest.img)) {
    assert.ok(e.alt?.es?.length > 10 && e.alt?.en?.length > 10, `${clave} sin alt es/en`);
    assert.ok(Number.isInteger(e.ancho) && e.ancho > 0 && Number.isInteger(e.alto) && e.alto > 0, `${clave} sin ancho o alto`);
    assert.ok(e.variantes?.some((v) => v.url === e.url), `${clave}: url debe estar entre las variantes`);
    for (const v of [...e.variantes, ...(e.avif ?? [])]) {
      assert.ok(v.ancho > 0 && v.alto > 0, `${v.url} sin medidas`);
      const b = readFileSync(disco(v.url));
      const d = v.url.endsWith('.webp') ? dimWebp(b) : v.url.endsWith('.avif') ? dimAvif(b) : v.url.endsWith('.svg') ? {w: v.ancho, h: v.alto} : dimJpg(b);
      assert.deepEqual([d.w, d.h], [v.ancho, v.alto], `${v.url} medidas reales`);
    }
    if (e.fondo === 'oscuro') assert.ok(['poster', 'objeto'].includes(e.tipo), clave);
  }
  assert.ok(manifest.img['hero'].tipo === 'poster' && manifest.img['o1-orbe'].tipo === 'orbe');
});

test('AVIF solo donde ahorra 25 por ciento o más contra el WebP del mismo ancho', () => {
  for (const [clave, e] of Object.entries(manifest.img)) {
    for (const a of e.avif ?? []) {
      const w = e.variantes.find((v) => v.ancho === a.ancho);
      assert.ok(w && a.bytes <= w.bytes * 0.75, `${clave} avif ${a.ancho}: ${a.bytes} contra ${w?.bytes}`);
    }
  }
});

test('presupuestos de peso por tipo (SPEC sección 8)', () => {
  // Fuentes: techo 130 KB y objetivo 85 KB, en total con brotli.
  const f = Object.values(manifest.fuentes).reduce((s, e) => s + e.brotli, 0);
  assert.ok(f < 130 * KB, `fuentes ${f} B`);
  assert.ok(f <= 85 * KB, `fuentes ${f} B por encima del objetivo de 85 KB`);
  // Imágenes: póster 60 KB, objetos 50 KB, orbes 20 KB, anchos de 480 hasta 20 KB; la variante densa de 1440 tiene tope propio.
  for (const [clave, e] of Object.entries(manifest.img)) {
    for (const v of e.variantes) {
      const capturaProducto = ['heroe', 'captura', 'recorte'].includes(e.tipo); // capturas reales del producto (29-oct): 960 hasta 60 KB, 1440 hasta 120 KB, 2880 hasta 260 KB, SVG vectorial hasta 20 KB
      const tope = capturaProducto ? (v.url.endsWith('.svg') ? 20 : v.ancho >= 2000 ? 260 : v.ancho >= 1400 ? 120 : 60) * KB : e.tipo === 'orbe' ? 20 * KB : e.tipo === 'social' ? 200 * KB : v.ancho === 1440 ? 120 * KB : v.ancho === 480 ? 20 * KB : (e.tipo === 'poster' ? 60 : 50) * KB;
      assert.ok(v.bytes <= tope, `${clave} ${v.ancho}: ${v.bytes} B > ${tope}`);
    }
    if (e.tipo === 'poster') assert.ok(e.bytes <= 60 * KB, 'póster del héroe');
    if (e.tipo === 'objeto') assert.ok(e.bytes <= 50 * KB, clave);
  }
  // Datos 3D por objeto (T5): héroe 50 KB, el resto 40 KB.
  for (const [k, e] of Object.entries(manifest.pts)) assert.ok(e.bytes <= (k === 'hero' ? 50 : 40) * KB, `pts ${k}`);
  // JS propio y Lenis: 20 KB con brotli entre todos los scripts del sitio (recalibrado de 17 el 29-oct: nube 8.4 + sitio 2.4 + inicio 3.8 + Lenis 3.4 = 18; ver recalibraciones en tools/sitio/presupuestos.json).
  const js = Object.values(manifest.js).reduce((s, e) => s + e.brotli, 0);
  assert.ok(js <= 20 * KB, `JS propio y Lenis ${js} B > 20 KB`);
});

test('JS: módulos del mismo origen sin eval, wasm ni mapa de fuente', () => {
  for (const [k, e] of Object.entries(manifest.js)) {
    if (e.vendor) continue;
    const t = readFileSync(disco(e.url), 'utf8');
    assert.doesNotMatch(t, /\beval\s*\(|new\s+Function\s*\(|WebAssembly|sourceMappingURL/, k);
    assert.match(e.url, /^\/s\/[a-z]+\.[0-9a-f]{8}\.js$/, k);
    assert.equal(e.modulo, true);
  }
});

test('licencias OFL 1.1 presentes con procedencia y commit para las tres familias', () => {
  const t = readFileSync(join(pub, 's', 'fuentes', 'LICENCIAS.txt'), 'utf8');
  for (const fam of ['Source Serif 4', 'Hanken Grotesk', 'IBM Plex Mono']) assert.ok(t.includes(`FAMILIA: ${fam}`), fam);
  assert.equal((t.match(/SIL OPEN FONT LICENSE Version 1\.1/g) ?? []).length, 3, 'texto completo de la OFL por familia');
  assert.equal((t.match(/Licencia: SIL Open Font License, Version 1\.1 \(verificada en el texto\)/g) ?? []).length, 3);
  assert.equal((t.match(/Commit de google\/fonts: [0-9a-f]{40}/g) ?? []).length, 3);
  assert.match(t, /Reserved Font Name "Plex"/);
  // El nombre reservado no puede quedar en los archivos modificados.
  for (const k of ['mono-400', 'mono-500']) assert.ok(!readFileSync(disco(manifest.fuentes[k].url)).includes('IBM Plex'), `${k} conserva el nombre reservado`);
});

test('fuentes.css referencia exactamente los woff2 del manifest y declara las tres caras de respaldo ajustadas', () => {
  const css = readFileSync(join(raiz, 'src', 'styles', 'sitio', 'fuentes.css'), 'utf8');
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(urls, Object.values(manifest.fuentes).map((e) => e.url).sort());
  for (const n of ['Source Serif 4 Fallback', 'Hanken Grotesk Fallback', 'IBM Plex Mono Fallback']) {
    const bloque = css.slice(css.indexOf(`font-family: "${n}"`));
    assert.match(bloque.slice(0, 400), /size-adjust: [\d.]+%;\s+ascent-override: [\d.]+%;\s+descent-override: [\d.]+%;\s+line-gap-override: [\d.]+%;/, n);
  }
  assert.equal((css.match(/font-display: swap/g) ?? []).length, 2);
  assert.equal((css.match(/font-display: optional/g) ?? []).length, 2);
  assert.equal((css.match(/unicode-range:/g) ?? []).length, 4);
  // Solo display y texto se precargan (la mono no).
  assert.deepEqual((manifest.precargas ?? []).map((p) => p.clave).sort(), ['fuentes/display', 'fuentes/texto']);
  for (const p of manifest.precargas) { assert.equal(p.as, 'font'); assert.equal(p.type, 'font/woff2'); assert.equal(p.crossOrigin, 'anonymous'); }
});

test('sin claves huérfanas: todo archivo de public/s está en el manifest y toda entrada tiene su archivo', () => {
  const declarados = new Set(archivosDeclarados().map((a) => a.url));
  const permitidos = new Set(['/s/manifest.json', ...manifest.auxiliares.map((a) => `/s/${a}`)]); // fuente de T5 y licencias
  const recorrer = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? recorrer(p) : [p]; });
  for (const f of recorrer(join(pub, 's'))) {
    const url = '/' + relative(pub, f).split('\\').join('/');
    assert.ok(declarados.has(url) || permitidos.has(url), `archivo huérfano fuera del manifest: ${url}`);
  }
  for (const u of declarados) assert.ok(existsSync(disco(u)), `entrada sin archivo: ${u}`);
  assert.deepEqual([...permitidos].sort(), ['/s/fuentes/LICENCIAS.txt', '/s/manifest.json', '/s/pts/manifest-pts.json']);
  // manifest-pts.json de T5 y la sección pts dicen lo mismo
  const mp = JSON.parse(readFileSync(join(pub, 's', 'pts', 'manifest-pts.json'), 'utf8'));
  assert.deepEqual(Object.keys(mp).sort(), Object.keys(manifest.pts).sort());
  for (const [k, e] of Object.entries(mp)) assert.equal(manifest.pts[k].sha256, e.sha256);
  // los GLB fuente no están en public
  assert.ok(!recorrer(pub).some((f) => /\.glb$/.test(f)));
});

test('activos.ts resuelve las claves del contrato K3', async () => {
  const {crearActivos} = await import('../../src/lib/sitio/activos.ts');
  const a = crearActivos(manifest);
  assert.equal(a.url('nube.js'), manifest.js['nube.js'].url);
  assert.equal(a.url('lenis.js'), '/vendor/lenis-1.1.13.min.js');
  assert.equal(a.url('pts/hero'), manifest.pts.hero.url);
  assert.equal(a.url('fuentes/display'), manifest.fuentes.display.url);
  assert.equal(a.url('img/hero', {ancho: 480}), manifest.img.hero.variantes.find((v) => v.ancho === 480).url);
  assert.deepEqual(a.medidas('img/o2'), {ancho: 960, alto: 960});
  assert.match(a.alt('img/hero', 'es'), /^Objeto de adorno/);
  assert.match(a.alt('img/hero', 'en'), /^Decorative object/);
  assert.equal(a.precargas().length, 2);
  assert.throws(() => a.url('img/inexistente'), /ACTIVO_NO_EN_MANIFEST/);
  assert.throws(() => a.url('img/hero', {ancho: 123}), /ACTIVO_VARIANTE_NO_EXISTE/);
});

test('íconos existentes: tamaños reales iguales a su nombre y site.webmanifest apunta a archivos que existen', () => {
  const dimPng = (f) => { const b = readFileSync(join(pub, f)); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; };
  for (const [f, d] of [['favicon-16x16.png', '16x16'], ['favicon-32x32.png', '32x32'], ['favicon-48x48.png', '48x48'], ['apple-touch-icon.png', '180x180'],
    ['icon-192.png', '192x192'], ['icon-512.png', '512x512'], ['icon-maskable-192.png', '192x192'], ['icon-maskable-512.png', '512x512']]) assert.equal(dimPng(f), d, f);
  assert.ok(statSync(join(pub, 'favicon.ico')).size > 100 && existsSync(join(pub, 'favicon.svg')));
  const wm = JSON.parse(readFileSync(join(pub, 'site.webmanifest'), 'utf8'));
  for (const i of wm.icons) { assert.ok(existsSync(join(pub, i.src)), i.src); assert.equal(dimPng(i.src.slice(1)), i.sizes); }
});

test('determinismo: reconstruir fuentes y JS da los mismos hashes', {skip: !herramientas && 'faltan las herramientas en ~/vexa-tools/sitio-build'}, () => {
  for (const s of ['fuentes.mjs', 'construir-js.mjs']) {
    try { execFileSync('node', [join(repo, 'tools', 'sitio', s), '--verificar'], {stdio: 'pipe', timeout: 120000}); }
    catch (e) { assert.fail(`${s} --verificar difiere: ${e.stderr?.toString().slice(0, 500)}`); }
  }
});

test('determinismo de imágenes (SITIO_VERIFICAR_IMAGENES=1)', {skip: !(herramientas && process.env.SITIO_VERIFICAR_IMAGENES) && 'solo con SITIO_VERIFICAR_IMAGENES=1'}, () => {
  try { execFileSync('node', [join(repo, 'tools', 'sitio', 'imagenes.mjs'), '--verificar'], {stdio: 'pipe', timeout: 590000}); }
  catch (e) { assert.fail(`imagenes.mjs --verificar difiere: ${e.stderr?.toString().slice(0, 500)}`); }
});
