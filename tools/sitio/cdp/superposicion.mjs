#!/usr/bin/env node
// Prueba de superposición (T18b): en un barrido de scroll a 1440 y 390 mide los rectángulos de lo que se ve (líneas de texto, dibujos SVG, imágenes,
// canvas y video) y falla si dos de ellos se intersectan. Es la prueba que faltaba cuando los diagramas de «El problema» se montaban sobre sus titulares
// a 390: ni el texto mínimo ni el hilo miden choques entre bloques del contenido.
//
// Qué se mide (cada elemento se lleva a coordenadas del documento y se recorta con el overflow de sus ancestros):
//   texto      cada línea de cada nodo de texto, reducida a su caja de tinta (alto = 0.8 del tamaño de fuente, centrada), para que dos líneas
//              consecutivas con interlineado apretado no cuenten como choque.
//   dibujo     un <svg> aporta la unión de lo que pinta (getBBox), no la caja del viewBox. Dentro de un mismo <svg> no se comparan piezas.
//   imagen     img, canvas y video (con su recorte).
// Qué NO se mide: lo oculto (display none, visibility hidden, opacidad < 0.05), lo fijo (la cabecera), el texto solo para lector, y la LISTA BLANCA.
//
// LISTA BLANCA (estricta): solo estos selectores, y solo si el elemento además lleva aria-hidden="true" (decorativos que el diseño superpone a propósito).
// Cualquier otro aria-hidden SÍ se mide. Para ampliarla hay que editar LISTA_BLANCA y justificarlo aquí; la prueba comprueba que cada entrada exista.
export const LISTA_BLANCA = [
  {sel: '.s-hilo, .s-hilo *', porque: 'el hilo serpenteante cruza el contenido por diseño; su distancia al contenido la mide hilo-carril.mjs (>= 16 px)'},
  {sel: '.s-hilo__nodo, .s-hilo__cabeza, .s-hilo__nota', porque: 'nodos, cabeza y notas del hilo (posicionados sobre su trazo); las notas se miden contra el contenido en hilo-carril.mjs'},
  {sel: '.s-pv__svg, .s-pv__svg *', porque: 'capa de anotaciones decorativas de la escena de pasos (flechas y rótulos sobre la captura), solo a 1440'},
  {sel: '.s-pie__marca, .s-pie__marca *', porque: 'marca de agua del pie (contorno al ~6 % de luminancia detrás de los enlaces y del texto legal); su caja es la del viewBox, no la tinta'},
  {sel: '.s-ov__tip, .s-ov__tip *', porque: 'avisos al pasar el cursor del héroe: aparecen sobre la captura por diseño y no existen en táctil'},
];

// Pares permitidos (estrictos, por selector): una capa que el diseño pone sobre otra a propósito. Cada par vale solo entre sus dos lados.
export const PARES_PERMITIDOS = [
  {a: 'img.s-ventana__img', b: '.s-ov, .s-ov *', porque: 'el héroe repinta barras, acumulado y marca de 80 % con un SVG transparente exactamente sobre su captura (ventana-fuga.tsx)'},
];

export const TOLERANCIA = {ancho: 3, alto: 3}; // px mínimos de intersección en cada eje para contar como choque

/** Corre dentro de la página: devuelve los rectángulos visibles en coordenadas de documento. */
export function recolectarEnPagina(lista, pares = []) {
  const items = [];
  const sx = scrollX, sy = scrollY;
  const ids = new Map();
  const rid = (n) => { if (!ids.has(n)) ids.set(n, ids.size + 1); return ids.get(n); };
  const permitido = (e) => {
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      if (n.getAttribute('aria-hidden') === 'true' && lista.some((s) => { try { return n.matches(s) || !!n.closest(s); } catch { return false; } })) return true;
    }
    return false;
  };
  const visible = (e) => {
    // Contenido omitido por content-visibility (el cuerpo de un <details> cerrado en móvil) no se ve aunque tenga caja
    if (e.checkVisibility && !e.checkVisibility({contentVisibilityAuto: true})) return false;
    let op = 1;
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === 'none' || c.visibility === 'hidden') return false;
      if (c.position === 'fixed') return false;
      if (n.hasAttribute('hidden')) return false;
      op *= parseFloat(c.opacity);
    }
    return op > 0.05;
  };
  const recortar = (r, e) => {
    let x0 = r.left, x1 = r.right, y0 = r.top, y1 = r.bottom;
    for (let n = e && e.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n);
      const ox = /^(hidden|clip|auto|scroll)$/.test(c.overflowX), oy = /^(hidden|clip|auto|scroll)$/.test(c.overflowY);
      if (!ox && !oy) continue;
      const b = n.getBoundingClientRect();
      if (ox) { x0 = Math.max(x0, b.left); x1 = Math.min(x1, b.right); }
      if (oy) { y0 = Math.max(y0, b.top); y1 = Math.min(y1, b.bottom); }
    }
    return {x0, x1, y0, y1};
  };
  const nombre = (e) => {
    let s = e.tagName.toLowerCase();
    const c = (typeof e.className === 'string' ? e.className : e.className?.baseVal || '').split(/\s+/).filter(Boolean)[0];
    return c ? `${s}.${c}` : s;
  };
  const sec = (e) => e.closest('[data-seccion]')?.dataset.seccion || e.closest('footer,header,nav')?.tagName.toLowerCase() || '';
  const poner = (r, e, tipo, desc, raiz) => {
    const q = recortar(r, e);
    if (q.x1 - q.x0 < 1 || q.y1 - q.y0 < 1) return;
    // Solo lo que cae en el viewport actual: el sticky y los estados de revelado dependen del scroll
    if (q.y1 < 0 || q.y0 > innerHeight) return;
    const ma = pares.map((p) => (e.matches(p.a) ? 1 : 0)), mb = pares.map((p) => (e.matches(p.b) || e.closest(p.b) ? 1 : 0));
    items.push({tipo, desc, ma, mb, raiz: rid(raiz), seccion: sec(e), x0: q.x0 + sx, x1: q.x1 + sx, y0: q.y0 + sy, y1: q.y1 + sy});
  };

  const rec = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = rec.nextNode(); n; n = rec.nextNode()) {
    const t = n.textContent.trim();
    const p = n.parentElement;
    if (!t || !p || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(p.tagName) || p.closest('.s-solo-lector, title, desc')) continue;
    if (!visible(p) || permitido(p)) continue;
    const fs = parseFloat(getComputedStyle(p).fontSize);
    const svg = p.closest('svg');
    let esc = 1;
    if (svg && p.getScreenCTM) { const m = p.getScreenCTM(); if (m) esc = Math.hypot(m.a, m.b); }
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const q of r.getClientRects()) {
      if (q.width < 1 || q.height < 1) continue;
      const alto = Math.min(q.height, 0.8 * fs * esc), cy = q.top + q.height / 2;
      poner({left: q.left, right: q.right, top: cy - alto / 2, bottom: cy + alto / 2}, p, 'texto', `texto «${t.slice(0, 28)}»`, svg || n);
    }
  }
  for (const e of document.querySelectorAll('img, canvas, video')) {
    if (!visible(e) || permitido(e)) continue;
    poner(e.getBoundingClientRect(), e, 'imagen', `${nombre(e)} ${(e.getAttribute('src') || '').split('/').pop().slice(0, 30)}`, e);
  }
  for (const s of document.querySelectorAll('svg')) {
    if (s.parentElement.closest('svg') || !visible(s) || permitido(s)) continue;
    let b;
    try { b = s.getBBox(); } catch { continue; }
    const m = s.getScreenCTM();
    if (!m || b.width < 1 || b.height < 1) continue;
    // Unión de lo que pinta, llevada a pantalla (el viewBox solo escala y traslada)
    const p0 = new DOMPoint(b.x, b.y).matrixTransform(m), p1 = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m);
    poner({left: Math.min(p0.x, p1.x), right: Math.max(p0.x, p1.x), top: Math.min(p0.y, p1.y), bottom: Math.max(p0.y, p1.y)}, s, 'dibujo', `svg ${s.getAttribute('data-diagrama') || nombre(s)}`, s);
  }
  return items;
}

/** Pares que se intersectan (en el mismo viewport). Un par = dos elementos distintos que no son uno raíz del otro. */
export function choques(items, tol = TOLERANCIA) {
  const out = [];
  const o = items.slice().sort((a, b) => a.y0 - b.y0);
  for (let i = 0; i < o.length; i++) {
    for (let j = i + 1; j < o.length && o[j].y0 < o[i].y1 - tol.alto; j++) {
      const a = o[i], b = o[j];
      if (a.raiz === b.raiz) continue; // mismo nodo de texto o mismo dibujo
      if (a.ma.some((v, k) => v && b.mb[k]) || b.ma.some((v, k) => v && a.mb[k])) continue; // par permitido
      const ancho = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const alto = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ancho >= tol.ancho && alto >= tol.alto) out.push({a: a.desc, b: b.desc, seccion: a.seccion || b.seccion, x: Math.round(Math.max(a.x0, b.x0)), y: Math.round(Math.max(a.y0, b.y0)), ancho: Math.round(ancho), alto: Math.round(alto)});
    }
  }
  return out;
}

/** Barrido completo: devuelve la lista única de choques de una página abierta. */
export async function barrer(page, vpAlto, {paso = 0.7, espera = 650} = {}) {
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  const lista = LISTA_BLANCA.map((x) => x.sel);
  const pares = PARES_PERMITIDOS.map(({a, b}) => ({a, b}));
  const vistos = new Map();
  let posiciones = 0;
  for (let y = 0; y < alto; y += Math.round(vpAlto * paso)) {
    await page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y);
    await new Promise((r) => setTimeout(r, espera));
    const items = await page.evaluate(`(${recolectarEnPagina.toString()})(${JSON.stringify(lista)}, ${JSON.stringify(pares)})`);
    for (const c of choques(items)) {
      const k = `${c.a}|${c.b}|${Math.round(c.x / 8)}|${Math.round(c.y / 8)}`;
      if (!vistos.has(k)) vistos.set(k, {...c, scroll: y});
    }
    posiciones++;
  }
  return {choques: [...vistos.values()], posiciones, alto};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const {leerArgs, lista} = await import('./args.mjs');
  const {conSesion, dormir} = await import('./navegador.mjs');
  const a = leerArgs();
  const url = (a.url || process.env.ROVAQ_URL || '').replace(/\/$/, '');
  if (!url) { console.error('Falta --url'); process.exit(2); }
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '390'])) {
    await conSesion({vp: Number(vp), esquema: 'dark', sinCandado: true, esperaCarga: false, etiqueta: 'superposicion'}, async (s) => {
      await s.page.goto(url + (a.ruta || '/'), {waitUntil: 'load'});
      await dormir(2500);
      const r = await barrer(s.page, s.viewport.height);
      console.log(`${r.choques.length ? 'FALLA' : 'OK   '} vp ${vp}: ${r.choques.length} superposiciones en ${r.posiciones} posiciones (alto ${r.alto})`);
      for (const c of r.choques.slice(0, 30)) console.log('   ', JSON.stringify(c));
      fallas += r.choques.length;
    });
  }
  process.exit(fallas ? 1 : 0);
}
