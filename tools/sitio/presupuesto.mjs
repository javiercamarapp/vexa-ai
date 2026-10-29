#!/usr/bin/env node
// Presupuestos de peso (SPEC sección 8, P-C 4.5): mide bytes transferidos con brotli sobre un
// build servido localmente y falla si se supera el techo o si crece más de 5 por ciento
// contra la línea base guardada.
//
// Uso: node tools/sitio/presupuesto.mjs --url http://127.0.0.1:3000/ [--escenarios critico,inicial3d,...]
//        [--base tools/sitio/presupuesto-base.json] [--guardar-base] [--exigir-base] [--json salida.json]
//      node tools/sitio/presupuesto.mjs --activos [--public apps/web/public]
//
// Escenarios: critico, inicial3d, recorrido, sinWebglCritico, sinWebglRecorrido (presupuestos.json).
import { brotliCompressSync, constants as zc } from 'node:zlib';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RUTA_PRESUPUESTOS = join(AQUI, 'presupuestos.json');
export const RUTA_BASE = join(AQUI, 'presupuesto-base.json');

export const COLUMNAS = ['html', 'css', 'jsNext', 'jsPropio', 'fuentes', 'imagenes', 'datos3d', 'otros'];
const TEXTO = new Set(['.ttf', '.otf', '.html', '.htm', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt', '.md', '.webmanifest', '.map']);
const FUENTES = new Set(['.woff2', '.woff', '.ttf', '.otf']);
const IMAGENES = new Set(['.webp', '.avif', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico']);
const DATOS3D = new Set(['.pts', '.glb', '.gltf', '.bin']);

export const cargarPresupuestos = (ruta = RUTA_PRESUPUESTOS) => JSON.parse(readFileSync(ruta, 'utf8'));

// Clasifica una respuesta en una de las columnas de la tabla de la sección 8.
export function clasificar(url, tipoRecurso = '', tipoContenido = '') {
  let ruta;
  try { ruta = new URL(url).pathname; } catch { ruta = url; }
  const ext = extname(ruta).toLowerCase();
  if (tipoRecurso === 'document' || (!ext && /text\/html/.test(tipoContenido))) return 'html';
  if (ext === '.css') return 'css';
  if (ext === '.js' || ext === '.mjs') return ruta.startsWith('/_next/') ? 'jsNext' : 'jsPropio';
  if (FUENTES.has(ext)) return 'fuentes';
  if (DATOS3D.has(ext) || ruta.startsWith('/s/pts/')) return 'datos3d';
  if (IMAGENES.has(ext)) return 'imagenes';
  return 'otros';
}

// Bytes transferidos: brotli calidad 5 para texto; los binarios ya comprimidos van crudos.
export function bytesTransferidos(cuerpo, url) {
  let ext = '';
  try { ext = extname(new URL(url).pathname).toLowerCase(); } catch { /* sin ext */ }
  const comprimible = TEXTO.has(ext) || ext === '';
  if (!comprimible) return cuerpo.length;
  if (cuerpo.length === 0) return 0;
  return brotliCompressSync(cuerpo, { params: { [zc.BROTLI_PARAM_QUALITY]: 5, [zc.BROTLI_PARAM_SIZE_HINT]: cuerpo.length } }).length;
}

export function sumar(items) {
  const col = Object.fromEntries(COLUMNAS.map((c) => [c, 0]));
  for (const it of items) col[it.columna] = (col[it.columna] || 0) + it.bytes;
  const total = COLUMNAS.reduce((s, c) => s + col[c], 0);
  return { columnas: col, total };
}

const KB = (b) => b / 1024;

// Techo, objetivo y crecimiento contra la línea base. base es { total } o undefined.
export function evaluarEscenario(medido, presupuesto, base, crecimientoMaxPct = 5) {
  const fallas = [];
  const avisos = [];
  const kb = KB(medido.total);
  if (kb > presupuesto.techoKB) fallas.push(`${kb.toFixed(1)} KB supera el techo de ${presupuesto.techoKB} KB`);
  else if (kb > presupuesto.objetivoKB) avisos.push(`${kb.toFixed(1)} KB supera el objetivo de ${presupuesto.objetivoKB} KB (techo ${presupuesto.techoKB})`);
  let crecimientoPct = null;
  if (base && base.total > 0) {
    crecimientoPct = ((medido.total - base.total) / base.total) * 100;
    if (crecimientoPct > crecimientoMaxPct) fallas.push(`creció ${crecimientoPct.toFixed(1)} % contra la línea base (${KB(base.total).toFixed(1)} KB), máximo ${crecimientoMaxPct} %`);
  }
  return { fallas, avisos, crecimientoPct, sinBase: !base };
}

export function limitesPorTipo(items, limites) {
  const fallas = [];
  const fuentes = items.filter((i) => i.columna === 'fuentes').reduce((s, i) => s + i.bytes, 0);
  if (KB(fuentes) > limites.fuentesTotal) fallas.push(`fuentes ${KB(fuentes).toFixed(1)} KB > ${limites.fuentesTotal} KB`);
  for (const i of items.filter((x) => x.columna === 'datos3d' && /\.pts$/.test(x.url) && KB(x.bytes) > limites.objetoEscena && !/hero/.test(x.url))) fallas.push(`${basename(i.url)} ${KB(i.bytes).toFixed(1)} KB > ${limites.objetoEscena} KB`);
  return fallas;
}

// Activos: public/s y public/vendor solo con archivos del manifest y del lock; sin GLB en public/.
export function verificarActivos(publico) {
  const res = { pendiente: null, fallas: [] };
  const dirS = join(publico, 's');
  const dirV = join(publico, 'vendor');
  const listar = (d) => {
    const out = [];
    if (!existsSync(d)) return out;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      statSync(p).isDirectory() ? out.push(...listar(p)) : out.push(p);
    }
    return out;
  };
  const glb = listar(publico).filter((f) => /\.(glb|gltf)$/i.test(f));
  for (const f of glb) res.fallas.push(`modelo fuente dentro de public/: ${relative(publico, f)}`);
  const manifestRuta = join(dirS, 'manifest.json');
  if (!existsSync(dirS) || !existsSync(manifestRuta)) {
    res.pendiente = 'public/s/manifest.json aún no existe (lo emite T13)';
  } else {
    const man = readFileSync(manifestRuta, 'utf8');
    for (const f of listar(dirS)) {
      const rel = relative(dirS, f);
      if (rel === 'manifest.json') continue;
      if (!man.includes(rel) && !man.includes(basename(f))) res.fallas.push(`public/s/${rel} no aparece en manifest.json`);
    }
  }
  const lockRuta = join(publico, 'vendor.lock.json');
  const lockAlt = join(dirV, 'vendor.lock.json');
  const lockUsado = existsSync(lockRuta) ? lockRuta : existsSync(lockAlt) ? lockAlt : null;
  if (existsSync(dirV)) {
    if (!lockUsado) res.pendiente = (res.pendiente ? res.pendiente + '; ' : '') + 'vendor.lock.json aún no existe';
    else {
      const lock = readFileSync(lockUsado, 'utf8');
      for (const f of listar(dirV)) {
        if (basename(f) === 'vendor.lock.json') continue;
        if (!lock.includes(basename(f)) && !lock.includes(relative(dirV, f))) res.fallas.push(`public/vendor/${relative(dirV, f)} no aparece en vendor.lock.json`);
      }
    }
  }
  return res;
}

// ------- medición con Chrome por CDP -------
const ESCENARIOS_CFG = {
  critico: { webgl: true, movimiento: 'reduce', saveData: true, recorrido: false, esperaMs: 2500 },
  inicial3d: { webgl: true, movimiento: 'no-preference', saveData: false, recorrido: false, esperaMs: 7000 },
  recorrido: { webgl: true, movimiento: 'no-preference', saveData: false, recorrido: true, esperaMs: 7000 },
  sinWebglCritico: { webgl: false, movimiento: 'no-preference', saveData: false, recorrido: false, esperaMs: 4000 },
  sinWebglRecorrido: { webgl: false, movimiento: 'no-preference', saveData: false, recorrido: true, esperaMs: 4000 },
};

export async function medirEscenario(url, nombre, { vp = 1440 } = {}) {
  const cfg = ESCENARIOS_CFG[nombre];
  if (!cfg) throw new Error(`Escenario desconocido ${nombre}`);
  const { abrir, dormir, posicionesDeScroll } = await import('./cdp/navegador.mjs');
  const s = await abrir({ vp, esquema: 'light', movimiento: cfg.movimiento, webgl: cfg.webgl, saveData: cfg.saveData, etiqueta: 'presupuesto ' + nombre });
  try {
    const { page } = s;
    await page.goto(url, { waitUntil: 'load' });
    await dormir(cfg.esperaMs);
    if (cfg.recorrido) {
      const pos = await posicionesDeScroll(page, s.viewport.height, { paso: 0.6 });
      for (const p of pos) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), p.y);
        await dormir(450);
      }
      await dormir(1500);
    }
    // Cada URL una vez; sin cuerpo (redirecciones, 304) cuenta cero.
    const vistos = new Map();
    for (const r of s.registro.respuestas) {
      const u = r.url();
      if (u.startsWith('data:') || vistos.has(u)) continue;
      let cuerpo = Buffer.alloc(0);
      try { cuerpo = await r.body(); } catch { /* sin cuerpo */ }
      const tc = (await r.allHeaders().catch(() => ({})))['content-type'] || '';
      vistos.set(u, { url: u, columna: clasificar(u, r.request().resourceType(), tc), bytes: bytesTransferidos(cuerpo, u), estado: r.status() });
    }
    const items = [...vistos.values()];
    return { items, ...sumar(items), mac: s.carga, errores: s.registro.errores };
  } finally {
    await s.cerrar();
  }
}

export function tablaTexto(nombre, med, pres, ev) {
  const f = (x) => (x / 1024).toFixed(1).padStart(7);
  const cols = COLUMNAS.map((c) => `${c} ${f(med.columnas[c]).trim()}`).join(' | ');
  return `${ev.fallas.length ? 'FALLA' : 'OK   '} ${nombre.padEnd(18)} ${f(med.total)} KB  objetivo ${pres.objetivoKB}  techo ${pres.techoKB}  | ${cols}`;
}

async function principal() {
  const { leerArgs, lista } = await import('./cdp/args.mjs');
  const a = leerArgs();
  if (a.activos) {
    const r = verificarActivos(a.public || join(AQUI, '..', '..', 'apps', 'web', 'public'));
    if (r.pendiente) console.log('PENDIENTE', r.pendiente);
    for (const f of r.fallas) console.log('FALLA', f);
    process.exit(r.fallas.length ? 1 : 0);
  }
  if (!a.url) { console.error('Uso: node presupuesto.mjs --url URL [--escenarios a,b] [--base ruta] [--guardar-base] [--exigir-base] [--json out]\n     node presupuesto.mjs --activos [--public dir]'); process.exit(2); }
  const P = cargarPresupuestos();
  const nombres = lista(a.escenarios, Object.keys(P.escenarios));
  const rutaBase = a.base || RUTA_BASE;
  const base = existsSync(rutaBase) ? JSON.parse(readFileSync(rutaBase, 'utf8')) : {};
  const clave = (n) => `${new URL(a.url).pathname}|${n}`;
  const salida = {};
  let fallas = 0;
  for (const n of nombres) {
    const pres = P.escenarios[n];
    if (!pres) throw new Error(`Escenario ${n} no está en presupuestos.json`);
    const med = await medirEscenario(a.url, n);
    const ev = evaluarEscenario(med, pres, base[clave(n)], P.crecimientoMaxPct);
    const tipo = limitesPorTipo(med.items, P.limitesPorTipoKB);
    ev.fallas.push(...tipo);
    console.log(tablaTexto(n, med, pres, ev));
    for (const x of ev.fallas) console.log('   FALLA:', x);
    for (const x of ev.avisos) console.log('   aviso:', x);
    if (ev.sinBase) console.log('   PENDIENTE: sin línea base para este escenario (usa --guardar-base tras una corrida buena)' + (a['exigir-base'] ? ' [--exigir-base: cuenta como falla]' : ''));
    if (ev.sinBase && a['exigir-base']) ev.fallas.push('sin línea base');
    fallas += ev.fallas.length ? 1 : 0;
    salida[clave(n)] = { total: med.total, columnas: med.columnas };
    if (a.verbose) for (const i of med.items.sort((x, y) => y.bytes - x.bytes)) console.log(`      ${(i.bytes / 1024).toFixed(1).padStart(7)} KB ${i.columna.padEnd(9)} ${i.url}`);
  }
  if (a['guardar-base']) {
    writeFileSync(rutaBase, JSON.stringify({ ...base, ...salida }, null, 2) + '\n');
    console.log('Línea base guardada en', rutaBase);
  }
  if (a.json) writeFileSync(a.json, JSON.stringify(salida, null, 2));
  console.log(`${nombres.length} escenarios, ${fallas} con falla`);
  process.exit(fallas ? 1 : 0);
}
if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.error(e.message); process.exit(1); });
