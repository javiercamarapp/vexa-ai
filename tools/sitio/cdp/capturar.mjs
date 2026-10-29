#!/usr/bin/env node
// Capturas de la sección 11: scroll cada 60 por ciento del viewport más las secciones
// (data-seccion) y cuadros de la carga a 0, 300, 700, 1100, 1500, 1900 y 2400 ms.
//
// Uso: node capturar.mjs --url http://127.0.0.1:3000/ --salida DIR
//        [--vp 1440,768,390] [--esquema light,dark] [--modo normal,reduced]
//        [--sin-webgl] [--cpu 4] [--red slow4g] [--solo carga|scroll] [--paso 0.6]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { leerArgs, lista } from './args.mjs';
import { CUADROS_CARGA_MS } from './config.mjs';
import { conSesion, dormir, posicionesDeScroll, origenesExternos } from './navegador.mjs';

const sha = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex');

export async function capturarCombinacion({ url, salida, vp, esquema, modo, webgl, cpu, red, solo, paso, esperaCargaMs = 3600 }) {
  const reducido = modo === 'reduced';
  const pref = `${vp}-${esquema === 'dark' ? 'dark' : 'light'}-${modo}${webgl ? '' : '-sinwebgl'}`;
  const archivos = [];
  await conSesion(
    { vp, esquema, movimiento: reducido ? 'reduce' : 'no-preference', webgl, cpu, red, etiqueta: 'capturar ' + pref },
    async (s) => {
      const { page } = s;
      const guardar = async (nombre, extra = {}, opc = {}) => {
        const ruta = join(salida, `${pref}-${nombre}.png`);
        await page.screenshot({ path: ruta, ...opc });
        archivos.push({ archivo: `${pref}-${nombre}.png`, sha256: sha(ruta), vp, esquema, modo, webgl, ...extra });
      };
      if (solo !== 'scroll') {
        // Cuadros de la carga: se navega sin esperar y se dispara cada captura en su milisegundo.
        const t0 = Date.now();
        const nav = page.goto(url, { waitUntil: 'commit' }).catch(() => {});
        await nav;
        for (const t of CUADROS_CARGA_MS) {
          const resta = t - (Date.now() - t0);
          if (resta > 0) await dormir(resta);
          const real = Date.now() - t0;
          await guardar(`carga-${String(t).padStart(4, '0')}ms`, { tipo: 'carga', objetivoMs: t, realMs: real });
        }
      }
      if (solo !== 'carga') {
        await page.goto(url, { waitUntil: 'load' });
        await dormir(reducido ? 600 : esperaCargaMs);
        await page.waitForSelector('canvas[data-estado="activa"]', { timeout: 2500 }).catch(() => {});
        const alto = s.viewport.height;
        const pos = await posicionesDeScroll(page, alto, { paso });
        for (const p of pos) {
          await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), p.y);
          await dormir(700);
          await guardar(`scroll-${p.nombre}`, { tipo: 'scroll', y: p.y, seccion: p.seccion || null });
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      }
      const ext = origenesExternos(s.registro.peticiones, url);
      archivos.push({ archivo: null, resumen: true, pref, consola: s.registro.consola, errores: s.registro.errores, origenesExternos: ext, csp: await page.evaluate(() => (window.__rovaq ? window.__rovaq.csp : [])) });
    },
  );
  return archivos;
}

async function principal() {
  const a = leerArgs();
  if (!a.url || !a.salida) {
    console.error('Uso: node capturar.mjs --url URL --salida DIR [--vp 1440,768,390] [--esquema light,dark] [--modo normal,reduced] [--sin-webgl] [--cpu 4] [--red slow4g] [--solo carga|scroll]');
    process.exit(2);
  }
  mkdirSync(a.salida, { recursive: true });
  const vps = lista(a.vp, ['1440', '768', '390']);
  const esqs = lista(a.esquema, ['light', 'dark']);
  const modos = lista(a.modo, ['normal']);
  const todo = [];
  for (const vp of vps) for (const esquema of esqs) for (const modo of modos) {
    const r = await capturarCombinacion({ url: a.url, salida: a.salida, vp, esquema, modo, webgl: !a['sin-webgl'], cpu: a.cpu ? Number(a.cpu) : 1, red: a.red || null, solo: a.solo || null, paso: a.paso ? Number(a.paso) : 0.6 });
    todo.push(...r);
    console.log(`${vp} ${esquema} ${modo}: ${r.filter((x) => x.archivo).length} capturas`);
  }
  writeFileSync(join(a.salida, 'indice.json'), JSON.stringify({ url: a.url, creado: new Date().toISOString(), archivos: todo }, null, 2));
  console.log('Índice:', join(a.salida, 'indice.json'));
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.error(e.message); process.exit(1); });
