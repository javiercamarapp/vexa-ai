#!/usr/bin/env node
// T49: ninguna imagen del sitio se descarga si su <img> no se ve. El héroe móvil ocultaba la captura con display: none y el navegador la pedía igual (27.6 KB).
// Recorre la página entera en cada ancho y compara las imágenes que el navegador pidió (PerformanceResourceTiming, initiatorType img) con las cajas que se ven:
// una imagen pedida cuya URL nunca fue la currentSrc de un <img> con caja a la vista en todo el recorrido es una descarga desperdiciada. Los data: no cuentan (no hay petición).
// Uso: node imagenes-ocultas.mjs --url http://127.0.0.1:PUERTO/ [--vp 1440,768,390] [--ruta /]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';

/** Corre en la página: currentSrc de los <img> con caja visible ahora (el paso del escenario fijo cambia de imagen: se acumulan en todo el recorrido). */
export function visiblesEnPagina() {
  const o = [];
  for (const img of document.querySelectorAll('img')) {
    const u = img.currentSrc;
    if (u && !u.startsWith('data:') && img.checkVisibility({contentVisibilityAuto: true, visibilityProperty: true})) o.push(u);
  }
  return o;
}

/** Corre en la página: imágenes que el navegador pidió (PerformanceResourceTiming). */
export function pedidasEnPagina() {
  return performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'img' && /\.(avif|webp|png|jpe?g|gif|svg)(\?|$)/.test(r.name)).map((r) => ({src: r.name, bytes: r.transferSize || r.encodedBodySize || 0}));
}

/** Pedidas que nunca tuvieron una caja a la vista durante el recorrido. */
export function sinCaja(pedidas, vistas) {
  const v = new Set(vistas);
  return pedidas.filter((p) => !v.has(p.src));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = (a.url || process.env.ROVAQ_URL || '').replace(/\/$/, '');
  if (!url) { console.error('Falta --url'); process.exit(2); }
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '768', '390'])) {
    await conSesion({vp: Number(vp), esquema: 'dark', sinCandado: true, esperaCarga: false, etiqueta: 'imagenes-ocultas'}, async (s) => {
      await s.page.goto(url + (a.ruta || '/'), {waitUntil: 'load'});
      await dormir(2500);
      const alto = await s.page.evaluate(() => document.documentElement.scrollHeight);
      const vistas = new Set();
      for (let y = 0; y < alto; y += Math.round(s.viewport.height * 0.25)) {
        await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y);
        await dormir(150);
        for (const u of await s.page.evaluate(`(${visiblesEnPagina.toString()})()`)) vistas.add(u);
      }
      await dormir(1200);
      const pedidas = await s.page.evaluate(`(${pedidasEnPagina.toString()})()`);
      const malas = sinCaja(pedidas, [...vistas]).map((p) => ({...p, src: p.src.replace(new URL(url).origin, '')}));
      console.log(`${malas.length ? 'FALLA' : 'OK   '} vp ${vp}: ${pedidas.length} imágenes pedidas, ${vistas.size} con caja visible en algún momento, ${malas.length} pedidas sin caja${malas.length ? ' · ' + JSON.stringify(malas) : ''}`);
      fallas += malas.length;
    });
  }
  process.exit(fallas ? 1 : 0);
}
