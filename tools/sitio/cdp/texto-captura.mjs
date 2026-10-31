#!/usr/bin/env node
// T49: tamaño efectivo del texto DENTRO de las capturas de producto. texto-minimo.mjs mide el texto del DOM y no ve el de las imágenes: en T23 las tiras de
// «Cada cifra dice de dónde viene» y del paso 3 se leían a 4 a 6 px a 390 sin que ninguna prueba lo notara.
// Cada captura es un recorte de una pantalla de 1440 px de ancho (2000 unidades = 1440 px CSS del original, es decir 0.72 px por unidad; las medidas en unidades son
// las de tools/sitio/recortes-pasos.mjs). El texto más pequeño de las tarjetas de cifras mide 11 px en el original (línea «hasta 3 nov · hace unos segundos» de la
// captura a 2x, altura de línea de 22 px) y 12 px en la lista de problemas del paso 2 (rótulo «USD · no se suma entre problemas»). Son estimaciones leídas de las capturas, no de
// la interfaz original (que no está en el repositorio). Tamaño efectivo = texto original x (ancho con que se pinta la imagen / ancho del original en px CSS).
// Uso: node texto-captura.mjs --url http://127.0.0.1:PUERTO/ [--vp 390,360,768] [--minimo 11]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';

export const PX_POR_UNIDAD = 0.72;
export const TEXTO_ORIGINAL_PX = 11;
// Capturas medidas y su ancho de recorte en unidades (recortes-pasos.mjs: PASOS.<clave>.w). `selector` apunta al <img> pintado.
export const CAPTURAS = {
  valor: {unidades: 1550, tarjetas: 4, texto: 11, selector: '.s-valor__ventana img.s-ventana__img'},
  paso1: {unidades: 565, texto: 11, selector: '[data-paso-ventana="1"] img.s-ventana__img'},
  paso2: {unidades: 1020, texto: 12, selector: '[data-paso-ventana="2"] img.s-ventana__img'},
  paso3: {unidades: 1160, tarjetas: 3, texto: 11, selector: '[data-paso-ventana="3"] img.s-ventana__img'},
  paso4: {unidades: 505, texto: 11, selector: '[data-paso-ventana="4"] img.s-ventana__img'},
};

/** Tamaño efectivo (px) del texto mínimo de la captura cuando se pinta con `anchoPintado` px de ancho. */
export const efectivo = (unidades, anchoPintado, texto = TEXTO_ORIGINAL_PX) => texto * anchoPintado / (unidades * PX_POR_UNIDAD);

/** Corre en la página: ancho con que se pinta cada captura y el de su contenedor con desplazamiento. */
export function medirCapturas(capturas) {
  const o = {};
  for (const [k, c] of Object.entries(capturas)) {
    const img = document.querySelector(c.selector);
    if (!img) { o[k] = null; continue; }
    const r = img.getBoundingClientRect();
    let cont = img.parentElement;
    while (cont && !(cont.scrollWidth > cont.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(cont).overflowX))) cont = cont.parentElement;
    o[k] = {ancho: r.width, visible: img.checkVisibility(), contenedor: cont ? {cliente: cont.clientWidth, total: cont.scrollWidth} : null};
  }
  return o;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = (a.url || process.env.ROVAQ_URL || '').replace(/\/$/, '');
  if (!url) { console.error('Falta --url'); process.exit(2); }
  const minimo = Number(a.minimo || 11);
  let fallas = 0;
  for (const vp of lista(a.vp, ['390', '360'])) {
    const ancho = Number(vp);
    await conSesion({vp: ancho === 360 ? 390 : ancho, esquema: 'dark', sinCandado: true, esperaCarga: false, etiqueta: 'texto-captura'}, async (s) => {
      if (ancho === 360) await s.page.setViewportSize({width: 360, height: 800});
      await s.page.goto(url, {waitUntil: 'load'});
      await dormir(2000);
      const alto = await s.page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < alto; y += 500) { await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y); await dormir(80); }
      await dormir(800);
      const m = await s.page.evaluate(`(${medirCapturas.toString()})(${JSON.stringify(CAPTURAS)})`);
      for (const [k, c] of Object.entries(CAPTURAS)) {
        const r = m[k];
        if (!r) { console.log(`FALLA vp ${vp} ${k}: no se encontró la imagen`); fallas++; continue; }
        const e = efectivo(c.unidades, r.ancho, c.texto);
        const ok = e >= minimo;
        console.log(`${ok ? 'OK   ' : 'FALLA'} vp ${vp} ${k}: pintada a ${Math.round(r.ancho)} px (${c.unidades} unidades), texto mínimo efectivo ${e.toFixed(1)} px (mínimo ${minimo})${r.contenedor ? `, desplazamiento ${r.contenedor.cliente} de ${r.contenedor.total} px` : ', sin desplazamiento'}`);
        if (!ok) fallas++;
      }
    });
  }
  process.exit(fallas ? 1 : 0);
}
