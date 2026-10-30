#!/usr/bin/env node
// Prueba del hilo serpenteante con bandas de cruce (mínimo 10 cruces a 1440 y 6 a 390; las notas tampoco pueden tocar el trazo): en un barrido de scroll a 1440 y 390 mide el RECORRIDO REAL del trazo (se muestrea el path cada 4 px) contra los
// rectángulos de texto, imágenes, figuras, botones, enlaces y tarjetas de la portada, y contra las notas del propio hilo. Falla si algún punto del
// núcleo queda a menos de 16 px de un rectángulo. Además cuenta los cruces de lado a lado y comprueba que ocurren en huecos libres (sin contenido
// entre el punto de entrada y el de salida de cada cruce) y que el trazo no desborda el viewport.
// Uso: node hilo-carril.mjs --url http://127.0.0.1:PUERTO/ [--vp 1440,390] [--paso 450] [--margen 16] [--minimo-cruces N] [--js inicio.js recién construido, para iterar sin recompilar Next]
import {leerArgs, lista} from './args.mjs';
import {readFileSync} from 'node:fs';
import {conSesion, dormir} from './navegador.mjs';

export const MARGEN_MIN = 16;

/** Corre dentro de la página: devuelve grosor, cruces, distancia mínima al contenido y los choques. */
export function medirEnPagina(margen) {
  const zona = document.querySelector('.s-hilo-zona');
  const trazo = zona && zona.querySelector('.s-hilo__trazo');
  const base = document.getElementById('s-hilo-d');
  if (!trazo || !base || !base.getAttribute('d')) return {error: 'sin trazo serpenteante (.s-hilo__trazo con d)'};
  const cz = getComputedStyle(zona);
  const w = parseFloat(cz.getPropertyValue('--s-hilo-w')), wb = parseFloat(cz.getPropertyValue('--s-hilo-wb'));
  const z = zona.getBoundingClientRect();
  const ox = z.left + scrollX, oy = z.top + scrollY; // origen de la zona en coordenadas de documento
  const rects = [];
  const ignorar = (e) => !e || e.closest('.s-hilo, .s-hilo__cabeza, .s-hilo__nodo, .s-cabecera, .s-solo-lector');
  const visible = (e) => {
    let op = 1;
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.visibility === 'hidden' || c.display === 'none') return false;
      op *= parseFloat(c.opacity);
    }
    return op > 0.05 || e.closest('.s-hilo__nota');
  };
  // Lo que recorta un ancestro con overflow hidden, clip o auto no se ve fuera de su caja: el rectángulo se limita a ella
  const recortar = (r, e, propio) => {
    let x0 = r.left, x1 = r.right, y0 = r.top, y1 = r.bottom;
    for (let n = propio ? e : e && e.parentElement; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (/^(hidden|clip|auto|scroll)$/.test(c.overflowX) || /^(hidden|clip|auto|scroll)$/.test(c.overflowY)) {
        const b = n.getBoundingClientRect();
        if (/^(hidden|clip|auto|scroll)$/.test(c.overflowX)) { x0 = Math.max(x0, b.left); x1 = Math.min(x1, b.right); }
        if (/^(hidden|clip|auto|scroll)$/.test(c.overflowY)) { y0 = Math.max(y0, b.top); y1 = Math.min(y1, b.bottom); }
      }
    }
    return {left: x0, right: x1, top: y0, bottom: y1, width: x1 - x0, height: y1 - y0};
  };
  const sumar = (r0, desc, nota, e, propio) => {
    const r = nota ? r0 : recortar(r0, e, propio);
    if (r.width < 1 || r.height < 1) return;
    rects.push({x0: r.left + scrollX - ox, x1: r.right + scrollX - ox, y0: r.top + scrollY - oy, y1: r.bottom + scrollY - oy, desc, nota});
  };
  const rec = document.createTreeWalker(zona, NodeFilter.SHOW_TEXT);
  for (let n = rec.nextNode(); n; n = rec.nextNode()) {
    const p = n.parentElement;
    if (!n.textContent.trim() || (ignorar(p) && !p.closest('.s-hilo__nota')) || !visible(p)) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const q of r.getClientRects()) sumar(q, 'texto: ' + n.textContent.trim().slice(0, 24), !!p.closest('.s-hilo__nota'), p, true);
  }
  for (const e of zona.querySelectorAll('img, picture, figure, svg, a, button, .s-tarjeta, .s-ventana, .s-boton, canvas, video')) {
    if (ignorar(e) || !visible(e) || e.matches('svg.s-hilo') || e.closest('.s-hilo__nota')) continue;
    sumar(e.getBoundingClientRect(), e.tagName.toLowerCase() + '.' + String(e.className?.baseVal ?? e.className).slice(0, 30), false, e);
  }
  const L = base.getTotalLength();
  const choques = [];
  let minimo = Infinity, cruces = 0, lado = null, xmin = Infinity, xmax = -Infinity;
  for (let s = 0; s <= L; s += 4) {
    const q = base.getPointAtLength(s);
    xmin = Math.min(xmin, q.x); xmax = Math.max(xmax, q.x);
    const l = q.x > z.width / 2 ? 1 : 0;
    if (lado !== null && l !== lado) cruces++;
    lado = l;
    for (const r of rects) {
      const dx = Math.max(r.x0 - q.x, 0, q.x - r.x1), dy = Math.max(r.y0 - q.y, 0, q.y - r.y1);
      const d = Math.hypot(dx, dy) - wb / 2; // conservador: se mide con el núcleo grueso de las bandas
      if (d < minimo) minimo = d;
      if (d < margen) { if (choques.length < 12) choques.push({desc: r.desc, y: Math.round(q.y + oy), x: Math.round(q.x), d: Math.round(d * 10) / 10}); }
    }
  }
  // Las notas del hilo tampoco pueden tocar el contenido
  const notas = rects.filter((r) => r.nota);
  for (const n of notas) for (const r of rects) {
    if (r.nota) continue;
    const dx = Math.max(r.x0 - n.x1, 0, n.x0 - r.x1), dy = Math.max(r.y0 - n.y1, 0, n.y0 - r.y1);
    const d = Math.hypot(dx, dy);
    if (d < margen && choques.length < 12) choques.push({desc: 'nota ' + n.desc + ' contra ' + r.desc, y: Math.round(n.y0 + oy), x: Math.round(n.x0), d: Math.round(d * 10) / 10});
  }
  return {grosor: w, grosorBanda: wb, cruces, largo: Math.round(L), x: [Math.round(xmin), Math.round(xmax)], zona: Math.round(z.width), margenLibre: Math.round(minimo * 10) / 10, notas: notas.length, choques, n: choques.length};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = a.url || process.env.ROVAQ_URL;
  const margen = Number(a.margen || MARGEN_MIN);
  const minCruces = Number(a['minimo-cruces'] || 0);
  if (!url) { console.error('Falta --url'); process.exit(2); }
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '390'])) {
    await conSesion({vp: Number(vp), esquema: 'dark', sinCandado: true, esperaCarga: false, etiqueta: 'hilo-carril'}, async (s) => {
      if (a.js) { const js = readFileSync(a.js, 'utf8'); await s.page.route(/\/s\/inicio\.[0-9a-f]+\.js/, (r) => r.fulfill({body: js, contentType: 'text/javascript'})); }
      await s.page.goto(url, {waitUntil: 'load'});
      await dormir(3000);
      const alto = await s.page.evaluate(() => document.documentElement.scrollHeight);
      let peor = null, ultimo = null;
      const visto = new Set();
      for (let y = 0; y < alto; y += Number(a.paso || 450)) {
        await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y);
        await dormir(1400); // deja terminar las entradas de las anotaciones de los pasos
        const m = await s.page.evaluate(`(${medirEnPagina.toString()})(${margen})`);
        if (m.error) { console.log('FALLA', vp, m.error); fallas++; break; }
        if (!peor || m.margenLibre < peor.margenLibre) peor = {...m, y};
        ultimo = m;
        if (m.n && !visto.has(m.choques[0].desc + m.choques[0].y)) { visto.add(m.choques[0].desc + m.choques[0].y); console.log(`FALLA vp ${vp} y ${y}: ${m.n} choques`, JSON.stringify(m.choques.slice(0, 3))); }
        if (m.n) fallas++;
      }
      const desborde = await s.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const minimo = minCruces || (Number(vp) >= 1000 ? 10 : 6);
      const ok = peor && peor.margenLibre >= margen && ultimo.cruces >= minimo && desborde <= 0 && ultimo.x[0] >= 0 && ultimo.x[1] <= ultimo.zona;
      console.log(`${ok ? 'OK   ' : 'FALLA'} vp ${vp}: grosor ${peor?.grosor} px (${peor?.grosorBanda} en bandas), ${ultimo?.cruces} cruces de lado a lado, recorrido x ${ultimo?.x}, largo ${ultimo?.largo} px, ${ultimo?.notas} notas, distancia mínima al contenido ${peor?.margenLibre} px (exigido ${margen}), desborde ${desborde}`);
      if (!ok) fallas++;
    });
  }
  process.exit(fallas ? 1 : 0);
}
