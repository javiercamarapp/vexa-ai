#!/usr/bin/env node
// Prueba del carril del hilo: en un barrido de scroll a 1440 y 390 mide que la franja del trazo grueso (ancho del núcleo más 16 px de margen
// a cada lado, a todo lo alto de .s-hilo-zona) no toque ningún texto, imagen, figura, botón, enlace ni tarjeta de la portada. Sale con 1 si choca.
// Uso: node hilo-carril.mjs --url http://127.0.0.1:PUERTO/ [--vp 1440,390] [--paso 450] [--margen 16]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';

export const MARGEN_MIN = 16;

/** Corre dentro de la página: devuelve el centro del carril, el grosor del núcleo, la distancia mínima al contenido y los choques. */
export function medirEnPagina(margen) {
  const zona = document.querySelector('.s-hilo-zona');
  if (!zona) return {error: 'sin .s-hilo-zona'};
  const cs = getComputedStyle(zona);
  const x = parseFloat(cs.getPropertyValue('--s-hilo-x')), w = parseFloat(cs.getPropertyValue('--s-hilo-w'));
  const z = zona.getBoundingClientRect();
  const centro = z.left + x;
  const franja = {x0: centro - w / 2 - margen, x1: centro + w / 2 + margen};
  const choques = [];
  let minimo = Infinity;
  const prueba = (r, desc) => {
    if (r.width < 1 || r.height < 1) return;
    // la franja ocupa toda la altura de la zona: solo cuenta la posición horizontal
    const d = r.left >= centro ? r.left - (centro + w / 2) : centro - w / 2 - r.right;
    if (d < minimo) minimo = d;
    if (r.right > franja.x0 && r.left < franja.x1) choques.push({desc, x: Math.round(r.left), w: Math.round(r.width), y: Math.round(r.top + scrollY), d: Math.round(d)});
  };
  const ignorar = (e) => !e || e.closest('.s-hilo, .s-hilo__cabeza, .s-hilo__nodo, .s-cabecera, .s-solo-lector');
  // Visible de verdad: sin visibility hidden, sin display none y con opacidad efectiva mayor de .05 (lo que aún no se reveló no cuenta)
  const visible = (e) => {
    let op = 1;
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.visibility === 'hidden' || c.display === 'none') return false;
      op *= parseFloat(c.opacity);
    }
    return op > 0.05;
  };
  const rec = document.createTreeWalker(zona, NodeFilter.SHOW_TEXT);
  for (let n = rec.nextNode(); n; n = rec.nextNode()) {
    const p = n.parentElement;
    if (!n.textContent.trim() || ignorar(p) || !visible(p)) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const q of r.getClientRects()) prueba(q, 'texto: ' + n.textContent.trim().slice(0, 24));
  }
  for (const e of zona.querySelectorAll('img, picture, figure, svg, a, button, .s-tarjeta, .s-ventana, .s-boton, canvas, video')) {
    if (ignorar(e) || !visible(e) || e.matches('svg.s-hilo')) continue;
    prueba(e.getBoundingClientRect(), e.tagName.toLowerCase() + '.' + String(e.className?.baseVal ?? e.className).slice(0, 30));
  }
  return {x: Math.round(centro * 10) / 10, grosor: w, margenLibre: Math.round(minimo * 10) / 10, choques: choques.slice(0, 12), n: choques.length};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = a.url || process.env.ROVAQ_URL;
  const margen = Number(a.margen || MARGEN_MIN);
  if (!url) { console.error('Falta --url'); process.exit(2); }
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '390'])) {
    await conSesion({vp: Number(vp), esquema: 'dark', sinCandado: true, esperaCarga: false, etiqueta: 'hilo-carril'}, async (s) => {
      await s.page.goto(url, {waitUntil: 'load'});
      await dormir(2500);
      const alto = await s.page.evaluate(() => document.documentElement.scrollHeight);
      let peor = null;
      for (let y = 0; y < alto; y += Number(a.paso || 450)) {
        await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y);
        await dormir(1400); // deja terminar las entradas de 800 ms de las anotaciones de los pasos
        const m = await s.page.evaluate(`(${medirEnPagina.toString()})(${margen})`);
        if (m.error) { console.log('FALLA', vp, m.error); fallas++; break; }
        if (!peor || m.margenLibre < peor.margenLibre) peor = {...m, y};
        if (m.n) { fallas++; console.log(`FALLA vp ${vp} y ${y}: ${m.n} choques`, JSON.stringify(m.choques)); }
      }
      console.log(`${peor && peor.margenLibre >= margen ? 'OK   ' : 'FALLA'} vp ${vp}: grosor ${peor?.grosor} px, carril x ${peor?.x}, distancia mínima al contenido ${peor?.margenLibre} px (mínimo exigido ${margen})`);
      if (peor && peor.margenLibre < margen) fallas++;
    });
  }
  process.exit(fallas ? 1 : 0);
}
