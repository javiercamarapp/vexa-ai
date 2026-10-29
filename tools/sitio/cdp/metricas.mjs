#!/usr/bin/env node
// Métricas de rendimiento por CDP (sección 9 punto 5, 8 y 3.10): LCP con su elemento, CLS,
// tareas largas, TBT, fps en 3 s de scroll guionizado y 5 s de reposo, eventos
// securitypolicyviolation, errores de consola y origen externo.
//
// Uso: node metricas.mjs --url URL [--vp 1440] [--esquema light] [--cpu 4] [--red slow4g]
//        [--sin-webgl] [--modo reduced] [--clic "selector"] [--json salida.json] [--corridas 2]
import { writeFileSync } from 'node:fs';
import { leerArgs } from './args.mjs';
import { conSesion, dormir, origenesExternos } from './navegador.mjs';

export const CRITERIOS = {
  lcpEstranguladoMs: 2500,
  lcpEscritorioMs: 1500,
  cls: 0.05,
  tbtMs: 200,
  cuadroMaxMs: 25,
  clicMs: 100,
};

// Pura y probada: decide qué falla a partir de las métricas crudas.
export function evaluarMetricas(m, { estrangulado, movimientoReducido = false } = {}) {
  const fallas = [];
  const lcpMax = estrangulado ? CRITERIOS.lcpEstranguladoMs : CRITERIOS.lcpEscritorioMs;
  if (m.lcp == null) fallas.push('LCP no se midió (sin candidato)');
  else if (m.lcp.t > lcpMax) fallas.push(`LCP ${Math.round(m.lcp.t)} ms > ${lcpMax} ms (${m.lcp.elemento})`);
  if (m.cls >= CRITERIOS.cls) fallas.push(`CLS ${m.cls.toFixed(4)} >= ${CRITERIOS.cls}`);
  if (m.tbtMs >= CRITERIOS.tbtMs) fallas.push(`TBT ${Math.round(m.tbtMs)} ms >= ${CRITERIOS.tbtMs} ms`);
  if (!movimientoReducido && !m.calibracionInconclusa) {
    for (const f of ['scroll', 'reposo']) {
      const x = m.fps?.[f];
      if (x && x.cuadrosLargos > 0) fallas.push(`${x.cuadrosLargos} cuadros de más de ${CRITERIOS.cuadroMaxMs} ms en ${f} (máx ${x.maxMs.toFixed(1)} ms)`);
    }
  }
  if (m.clicMs != null && m.clicMs > CRITERIOS.clicMs) fallas.push(`respuesta al clic ${Math.round(m.clicMs)} ms > ${CRITERIOS.clicMs} ms`);
  if (m.csp?.length) fallas.push(`${m.csp.length} eventos securitypolicyviolation`);
  if (m.errores?.length) fallas.push(`${m.errores.length} errores de página`);
  if (m.consolaErrores?.length) fallas.push(`${m.consolaErrores.length} errores o avisos de consola`);
  if (m.origenesExternos?.length) fallas.push(`origen externo: ${m.origenesExternos.join(', ')}`);
  return fallas;
}

export function resumirCuadros(deltas) {
  if (!deltas.length) return { n: 0, medianaMs: 0, maxMs: 0, cuadrosLargos: 0, fps: 0 };
  const o = [...deltas].sort((a, b) => a - b);
  const med = o[Math.floor(o.length / 2)];
  const total = deltas.reduce((s, x) => s + x, 0);
  return { n: deltas.length, medianaMs: med, maxMs: o[o.length - 1], cuadrosLargos: deltas.filter((d) => d > CRITERIOS.cuadroMaxMs).length, fps: (deltas.length / total) * 1000 };
}

// Se ejecuta dentro de la página: registra los intervalos entre cuadros durante `ms`,
// con o sin scroll guionizado de arriba abajo.
const MEDIR_CUADROS = ([ms, scroll]) =>
  new Promise((res) => {
    const d = [];
    const t0 = performance.now();
    let ult = t0;
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const paso = (t) => {
      d.push(t - ult);
      ult = t;
      if (scroll) window.scrollTo({ top: Math.min(max, ((t - t0) / ms) * max), behavior: 'instant' });
      if (t - t0 < ms) requestAnimationFrame(paso);
      else res(d.slice(1));
    };
    requestAnimationFrame(paso);
  });

export async function medirUnaVez(url, opc) {
  return conSesion(
    { vp: opc.vp, esquema: opc.esquema, movimiento: opc.modo === 'reduced' ? 'reduce' : 'no-preference', webgl: !opc.sinWebgl, cpu: opc.cpu, red: opc.red, etiqueta: 'metricas' },
    async (s) => {
      const { page } = s;
      // Calibración: cadencia de cuadros de una página en blanco. Si el Chrome o la Mac no
      // llegan a ~50 fps vacíos, la medición de fps de la página es inconclusa y no se culpa al sitio.
      await page.goto('about:blank');
      const blanco = resumirCuadros(await page.evaluate(MEDIR_CUADROS, [1200, false]));
      const calibracionInconclusa = blanco.medianaMs > 20;
      await page.goto(url, { waitUntil: 'load' });
      await dormir(opc.red ? 4000 : 2500); // deja asentar LCP y el cargador
      const crudo = await page.evaluate(() => {
        const r = window.__rovaq || {};
        const nav = performance.getEntriesByType('navigation')[0];
        return { lcp: r.lcp, cls: r.cls, largas: r.largas || [], csp: r.csp || [], load: nav ? nav.loadEventEnd : null, fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime ?? null };
      });
      const tbtMs = crudo.largas.reduce((s2, l) => s2 + Math.max(0, l.d - 50), 0);
      const fps = {};
      if (opc.modo !== 'reduced') {
        fps.scroll = resumirCuadros(await page.evaluate(MEDIR_CUADROS, [3000, true]));
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await dormir(300);
        fps.reposo = resumirCuadros(await page.evaluate(MEDIR_CUADROS, [5000, false]));
      }
      let clicMs = null;
      if (opc.clic) {
        clicMs = await page.evaluate(
          (sel) =>
            new Promise((res) => {
              const el = document.querySelector(sel);
              if (!el) return res(null);
              const t = performance.now();
              el.click();
              requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t)));
            }),
          opc.clic,
        );
      }
      const gl = await page.evaluate(() => {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
      });
      return {
        url, vp: opc.vp, esquema: opc.esquema, modo: opc.modo || 'normal', cpu: opc.cpu || 1, red: opc.red || null, webglDisponible: gl,
        webdriver: await page.evaluate(() => navigator.webdriver),
        lcp: crudo.lcp, fcpMs: crudo.fcp, cargaMs: crudo.load, cls: crudo.cls,
        tareasLargas: crudo.largas.length, tbtMs, fps, clicMs, calibracionBlancoMs: blanco.medianaMs, calibracionInconclusa, nota_cuadros: 'Chrome headless va con --disable-frame-rate-limit: los intervalos miden el costo real de cada cuadro, no la cadencia de 60 Hz. Con tope de 30 fps la calibracion queda inconclusa.',
        csp: crudo.csp, errores: s.registro.errores, consolaErrores: s.registro.consola,
        origenesExternos: origenesExternos(s.registro.peticiones, url),
        mac: s.carga,
      };
    },
  );
}

// Dos corridas y se toma la peor (P-C 9.3).
export async function medir(url, opc) {
  const n = opc.corridas || 2;
  const corridas = [];
  for (let i = 0; i < n; i++) corridas.push(await medirUnaVez(url, opc));
  const estr = !!(opc.cpu > 1 || opc.red);
  const evaluadas = corridas.map((c) => ({ c, fallas: evaluarMetricas(c, { estrangulado: estr, movimientoReducido: opc.modo === 'reduced' }) }));
  const peor = evaluadas.sort((a, b) => b.fallas.length - a.fallas.length || (b.c.lcp?.t ?? 0) - (a.c.lcp?.t ?? 0))[0];
  return { ...peor.c, corridas: n, fallas: peor.fallas, ok: peor.fallas.length === 0 };
}

async function principal() {
  const a = leerArgs();
  if (!a.url) {
    console.error('Uso: node metricas.mjs --url URL [--vp 1440] [--esquema light] [--cpu 4] [--red slow4g] [--sin-webgl] [--modo reduced] [--clic selector] [--corridas 2] [--json out.json]');
    process.exit(2);
  }
  const r = await medir(a.url, { vp: a.vp || 1440, esquema: a.esquema || 'light', modo: a.modo || 'normal', cpu: a.cpu ? Number(a.cpu) : 1, red: a.red || null, sinWebgl: !!a['sin-webgl'], clic: a.clic || null, corridas: a.corridas ? Number(a.corridas) : 2 });
  if (a.json) writeFileSync(a.json, JSON.stringify(r, null, 2));
  console.log(JSON.stringify({ ...r, mac: undefined }, null, 2));
  console.log(r.ok ? 'OK metricas' : 'FALLA metricas:\n  ' + r.fallas.join('\n  '));
  process.exit(r.ok ? 0 : 1);
}
if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.error(e.message); process.exit(1); });
