#!/usr/bin/env node
// Prueba del tamaño mínimo del texto real (T16): recorre la portada y mide el tamaño EFECTIVO (font-size calculado por la escala del SVG y por transform)
// de todo texto visible: sin display none, sin visibility hidden, sin opacidad cero y sin texto solo para lector. Las imágenes (capturas) no cuentan.
// Mínimo: 12 px a 1440 y 11 px a 390. Sale con 1 si algún texto queda por debajo.
// Uso: node texto-minimo.mjs --url http://127.0.0.1:PUERTO/ [--vp 1440,390] [--ruta /]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';

export const MINIMOS = {1440: 12, 390: 11};

/** Corre dentro de la página: devuelve los textos visibles con tamaño efectivo menor que el mínimo. */
export function medirEnPagina(min) {
  const out = [];
  const nombre = (e) => { let s = e.tagName.toLowerCase(); const c = (typeof e.className === 'string' ? e.className : e.className?.baseVal || '').split(/\s+/).filter(Boolean)[0]; return c ? `${s}.${c}` : s; };
  const rec = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = rec.nextNode(); n; n = rec.nextNode()) {
    const t = n.textContent.trim();
    const el = n.parentElement;
    if (!t || !el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(el.tagName) || el.closest('.s-solo-lector')) continue;
    let op = 1, oculto = false;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const c = getComputedStyle(a);
      if (c.display === 'none' || c.visibility === 'hidden') { oculto = true; break; }
      op *= parseFloat(c.opacity);
      if (a.hasAttribute('hidden')) { oculto = true; break; }
      // contenido de un <details> cerrado
      if (a.tagName === 'DETAILS' && !a.open && !a.matches('.s-plegable') && el.closest('summary') === null) { oculto = true; break; }
    }
    const r = el.getBoundingClientRect();
    if (oculto || op < 0.05 || r.width <= 1 || r.height <= 1) continue;
    let f = parseFloat(getComputedStyle(el).fontSize);
    const svg = el.closest('svg');
    if (svg && el.getScreenCTM) { const m = el.getScreenCTM(); if (m) f *= Math.hypot(m.a, m.b); }
    else { let k = 1; for (let a = el; a && a !== document.body; a = a.parentElement) { const tr = getComputedStyle(a).transform; if (tr && tr !== 'none') { const m = new DOMMatrix(tr); k *= Math.hypot(m.a, m.b); } } f *= k; }
    if (f < min - 0.05) out.push({texto: t.slice(0, 40), px: Math.round(f * 10) / 10, el: nombre(el), seccion: el.closest('[data-seccion]')?.dataset.seccion || el.closest('footer,header')?.tagName.toLowerCase() || ''});
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = (a.url || process.env.ROVAQ_URL || '').replace(/\/$/, '');
  if (!url) { console.error('Falta --url'); process.exit(2); }
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '390'])) {
    const min = MINIMOS[vp] ?? 12;
    await conSesion({vp: Number(vp), esquema: 'dark', sinCandado: true, esperaCarga: false, etiqueta: 'texto-minimo'}, async (s) => {
      await s.page.goto(url + (a.ruta || '/'), {waitUntil: 'load'});
      await dormir(2500);
      const alto = await s.page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < alto; y += Math.round(s.viewport.height * 0.6)) { await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y); await dormir(120); }
      await dormir(800);
      const malos = await s.page.evaluate(`(${medirEnPagina.toString()})(${min})`);
      console.log(`${malos.length ? 'FALLA' : 'OK   '} vp ${vp}: ${malos.length} textos por debajo de ${min} px${malos.length ? ' · ' + JSON.stringify(malos.slice(0, 12)) : ''}`);
      fallas += malos.length;
    });
  }
  process.exit(fallas ? 1 : 0);
}
