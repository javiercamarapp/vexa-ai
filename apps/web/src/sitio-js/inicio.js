// inicio.js (T10): solo la portada. sitio.js lo importa tras reposo y llama a la exportación por defecto con
// {urls, RM, NAT, motor}. Hace: héroe en modo halo, escena fija de cuatro pasos con nube.js, objeto del cierre,
// el hilo que se dibuja con el scroll, el latido del pie y Lenis (solo escritorio con puntero fino).
// Scroll nativo, sin librerías de animación; este archivo solo lee scrollY y escribe variables CSS con setProperty.
const D = document, H = D.documentElement;
const $ = (s, r = D) => r.querySelector(s);
const $$ = (s, r = D) => [...r.querySelectorAll(s)];
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const SVG = 'http://www.w3.org/2000/svg';

/* ---------- geometría del hilo (copia mínima de tools/sitio/genera-hilo.mjs; la prueba exige igualdad) ---------- */
const r2 = (n) => Math.round(n * 100) / 100;
const CRUCES = [['valor', 1], ['modulos', 0], ['seguridad', 1], ['integraciones', 0], ['cierre', 1]]; // [sección, carril destino: 1 der]
const ANCLAS = [['problema', 't', 0], ['valor', 't', 1], ['pantallas', 't', 0], ['pantallas', 'f', 0], ['seguridad', 't', 1], ['integraciones', 't', 0], ['cierre', 't', 1]];
export function carriles(ancho, cont = 1072) {
  const i = Math.max(20, (ancho - cont) / 4);
  return [i, ancho - i];
}
export function segmentos(m) {
  const x = carriles(m.ancho, m.contenedor), seg = [];
  let c = 0, y = 0;
  for (const [s, a] of CRUCES) {
    const b = m.secciones[s].top, ya = b - 130, yb = b + 30;
    if (ya > y) seg.push([x[c], y, x[c], ya, 0]);
    seg.push([x[c], ya, x[a], yb, 1]);
    c = a; y = yb;
  }
  seg.push([x[c], y, x[c], m.alto, 0]);
  return seg;
}
export function trazar(m) {
  const g = segmentos(m);
  let d = `M${r2(g[0][0])} ${r2(g[0][1])}`;
  for (const [x0, y0, x1, y1, t] of g) {
    if (!t) d += `L${r2(x1)} ${r2(y1)}`;
    else { const h = (y1 - y0) / 2; d += `C${r2(x0)} ${r2(y0 + h)} ${r2(x1)} ${r2(y1 - h)} ${r2(x1)} ${r2(y1)}`; }
  }
  return d;
}
export function tabla(m, n = 33) {
  const pts = [], ac = [0];
  for (const [x0, y0, x1, y1, t] of segmentos(m)) {
    if (!pts.length) pts.push([x0, y0]);
    if (!t) pts.push([x1, y1]);
    else {
      const h = (y1 - y0) / 2;
      for (let i = 1; i <= 64; i++) {
        const k = i / 64, u = 1 - k, b0 = u * u * u, b1 = 3 * u * u * k, b2 = 3 * u * k * k, b3 = k * k * k;
        pts.push([(b0 + b1) * x0 + (b2 + b3) * x1, b0 * y0 + b1 * (y0 + h) + b2 * (y1 - h) + b3 * y1]);
      }
    }
  }
  for (let i = 1; i < pts.length; i++) ac.push(ac[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = ac[ac.length - 1], f = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const y = (m.alto * k) / (n - 1);
    while (j < pts.length - 2 && pts[j + 1][1] < y) j++;
    const [xa, ya] = pts[j], [xb, yb] = pts[j + 1], q = yb === ya ? 0 : lim((y - ya) / (yb - ya));
    f.push({p: Math.round((k / (n - 1)) * 1e4) / 1e4, s: Math.round(((ac[j] + q * (ac[j + 1] - ac[j])) / L) * 1e4) / 1e4, x: r2(xa + q * (xb - xa)), y: r2(y)});
  }
  return f;
}
/** Interpola la tabla: de la fracción de altura P a la de arco s y la posición de la cabeza. */
export function leer(t, P) {
  const k = lim(P) * (t.length - 1), i = Math.min(t.length - 2, Math.floor(k)), f = k - i;
  return {s: t[i].s + f * (t[i + 1].s - t[i].s), x: t[i].x + f * (t[i + 1].x - t[i].x), y: t[i].y + f * (t[i + 1].y - t[i].y)};
}
/** Paso activo de la escena con histéresis de .04. */
export function pasoDe(s, actual, h = 0.04) {
  let n = actual;
  while (n < 3 && s > n + 1 + h) n++;
  while (n > 0 && s < n - h) n--;
  return n;
}
/** Lector de red: true si hay que quedarse con el póster y los pasos apilados. */
export function ahorro(nav = navigator) {
  const c = nav.connection || {};
  return !!c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '') || (nav.deviceMemory ?? 8) <= 2;
}

/* ---------- íconos del hilo (generado desde components/sitio/iconos; ver hilo-iconos.json) ---------- */
// BLOQUE-ICONOS-INICIO
const ICONOS = [
  [['rect', {x: 1.5, y: 2.5, width: 5, height: 4, rx: 0.5}], ['rect', {x: 9.5, y: 4.5, width: 5, height: 4, rx: 0.5}], ['rect', {x: 4.5, y: 9.5, width: 5, height: 4, rx: 0.5}]],
  [['circle', {cx: 8, cy: 6.5, r: 3.5}], ['path', {d: 'M5.5 9.5 4.5 14l3.5-2 3.5 2-1-4.5'}]],
  [['circle', {cx: 2.5, cy: 8, r: 1.5}], ['circle', {cx: 6.5, cy: 8, r: 1.5}], ['circle', {cx: 10.5, cy: 8, r: 1.5}], ['circle', {cx: 14, cy: 8, r: 0.5}], ['path', {d: 'M4 8h1M8 8h1M12 8h1'}]],
  [['path', {d: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z'}], ['path', {d: 'M5 6.5h6M5 8.5h3.5'}]],
  [['rect', {x: 3.5, y: 7.5, width: 9, height: 6, rx: 1}], ['path', {d: 'M5.5 7.5v-2a2.5 2.5 0 0 1 5 0v2M8 10v1.5'}]],
  [['path', {d: 'M3.5 2.5h6l3 3v8h-9z'}], ['path', {d: 'M9.5 2.5v3h3'}], ['path', {d: 'm5.5 9.5 1.7 1.7 3.3-3.4'}]],
  [['path', {d: 'M4 12 12 4'}], ['path', {d: 'M5.5 4H12v6.5'}]],
];
// BLOQUE-ICONOS-FIN

const el = (tag, attrs = {}, padre, clase) => {
  const e = D.createElementNS(SVG, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (clase) e.setAttribute('class', clase);
  padre?.appendChild(e);
  return e;
};
const div = (clase, padre, tag = 'div') => { const e = D.createElement(tag); e.className = clase; padre?.appendChild(e); return e; };

export default function iniciar({urls, RM, NAT, motor}) {
  const {tareas, despertar, barrer, rangos} = motor;
  const fino = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const ancho = () => innerWidth;
  const sinNube = RM || ahorro();

  /* ---------- nube: un contexto vivo a la vez ---------- */
  let modNube = null, activa = null;
  const cargarNube = () => (modNube ||= import(urls.nube).catch(() => null));
  const liberar = () => { if (activa) { activa.api.destruir(); activa.canvas.dataset.estado = 'respaldo'; activa = null; } };
  /** Crea la nube cuando el lienzo se acerca a la vista y la destruye al alejarse. */
  function gestionar(canvas, opc, alCrear) {
    if (!canvas || sinNube || typeof IntersectionObserver === 'undefined') { if (canvas) canvas.dataset.estado = 'respaldo'; return; }
    let ocupado = false;
    new IntersectionObserver(async (es) => {
      const dentro = es[es.length - 1].isIntersecting;
      if (dentro && !(activa && activa.canvas === canvas) && !ocupado) {
        ocupado = true;
        const m = await cargarNube();
        if (!m) { canvas.dataset.estado = 'respaldo'; ocupado = false; return; }
        liberar();
        const api = m.crearNube(canvas, opc);
        activa = {canvas, api};
        alCrear?.(api);
        ocupado = false;
      } else if (!dentro && activa && activa.canvas === canvas) liberar();
    }, {rootMargin: '60% 0px'}).observe(canvas);
  }

  /* ---------- héroe ---------- */
  const pista = $('.s-hero__pista');
  const cvH = $('canvas[data-nube="hero"]');
  let apiH = null;
  gestionar(cvH, {modo: 'halo', puntero: fino, modelos: {hero: cvH?.dataset.pts}, cargar: 'hero'}, (a) => { apiH = a; });
  if (pista) barrer(pista, rangos.pista);

  /* ---------- escena de cuatro pasos (solo escritorio ancho) ---------- */
  const esc = $('[data-escena]');
  const cvE = $('canvas[data-nube="escena"]', esc || D);
  const pasos = esc ? $$('.s-paso', esc) : [];
  const modelosE = {hero: cvE?.dataset.pts};
  pasos.forEach((p, i) => { modelosE['o' + (i + 1)] = p.dataset.pts; });
  let apiE = null, paso = -1;
  const escenaActiva = () => !RM && ancho() > 1100;
  if (esc && escenaActiva()) gestionar(cvE, {modelos: modelosE, cargar: 'hero'}, (a) => { apiE = a; if (paso >= 0) mostrar(paso); });
  else if (cvE) cvE.dataset.estado = 'respaldo';
  let tMorfo = 0;
  function mostrar(n) {
    if (!apiE) return;
    apiE.mostrar('o' + (n + 1));
    clearTimeout(tMorfo);
    tMorfo = setTimeout(() => apiE?.destello?.(), 1000);
  }
  let ultY = scrollY, ultT = performance.now();

  /* ---------- cierre ---------- */
  const cvC = $('canvas[data-nube="cierre"]');
  gestionar(cvC, {modelos: {hero: cvC?.dataset.pts}, cargar: 'hero', puntos: 6000});
  const objC = $('.s-cierre__objeto');
  if (objC && !RM) new IntersectionObserver((es) => { if (es[0].isIntersecting) { objC.classList.add('s-visto'); } }, {threshold: 0.2}).observe(objC);

  /* ---------- pie ---------- */
  const espacio = $('.s-pie-espacio'), pie = $('.s-pie');
  if (pie && espacio && !RM) barrer(espacio, rangos.entrada, pie);

  /* ---------- hilo ---------- */
  const hilo = construirHilo(urls, RM);

  /* ---------- tareas por cuadro ---------- */
  let fuera = false;
  tareas.add((t) => {
    const y = scrollY, vh = innerHeight;
    const vel = Math.abs(y - ultY) / Math.max(1, t - ultT) * 1000;
    ultY = y; ultT = t;
    H.toggleAttribute('data-rapido', vel > 650);
    if (pista && apiH) { const r = pista.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) apiH.progreso(lim(-r.top / Math.max(1, r.height - vh))); }
    if (esc && apiE) {
      const r = $('.s-escena__pista', esc).getBoundingClientRect();
      const s = lim(-r.top / Math.max(1, r.height - vh)) * 4;
      const n = pasoDe(s, Math.max(paso, 0));
      if (n !== paso) { paso = n; esc.dataset.paso = String(n); mostrar(n); }
    } else if (esc && escenaActiva()) {
      const r = $('.s-escena__pista', esc).getBoundingClientRect();
      const n = pasoDe(lim(-r.top / Math.max(1, r.height - vh)) * 4, Math.max(paso, 0));
      if (n !== paso) { paso = n; esc.dataset.paso = String(n); }
    }
    if (espacio && pie) { const r = espacio.getBoundingClientRect(); if (r.height) pie.toggleAttribute('data-latido', (vh - r.top) / r.height >= 0.98); }
    hilo?.cuadro(y, vh);
    return !fuera && lenisVivo();
  });
  addEventListener('resize', () => hilo?.medir(), {passive: true});
  despertar(400);

  /* ---------- Lenis: solo escritorio, puntero fino, sin movimiento reducido ni ahorro de datos ---------- */
  let lenis = null;
  const lenisVivo = () => !!lenis && lenis.isScrolling;
  if (!RM && fino && !ahorro() && urls.lenis) {
    const arranca = () => {
      if (lenis || H.classList.contains('s-cargando')) { if (!lenis) setTimeout(arranca, 400); return; }
      const s = D.createElement('script');
      s.src = urls.lenis;
      s.onload = () => {
        if (!self.Lenis) return;
        lenis = new self.Lenis({duration: 1.2, easing: (x) => Math.min(1, 1.001 - 2 ** (-10 * x)), wheelMultiplier: 0.9, smoothTouch: false});
        tareas.add((t) => { lenis.raf(t); return lenis.isScrolling; });
        despertar(2000);
      };
      D.head.appendChild(s);
    };
    const quieto = () => ('requestIdleCallback' in self ? requestIdleCallback(arranca, {timeout: 2500}) : setTimeout(arranca, 2500));
    quieto();
  }
}

/* ---------- construcción del hilo con medidas reales ---------- */
function construirHilo(urls, RM) {
  const zona = $('.s-hilo-zona'), cont = zona && $('[data-hilo]', zona);
  if (!zona || !cont || typeof ResizeObserver === 'undefined') return null;
  let notas = [];
  try { notas = JSON.parse(urls.notas || '[]'); } catch { notas = []; }
  const orbes = (() => { try { return JSON.parse(urls.orbes || '{}'); } catch { return {}; } })();
  const svg = el('svg', {'aria-hidden': 'true', focusable: 'false'}, cont, 's-hilo');
  const guia = el('path', {pathLength: 1}, svg, 's-hilo__guia');
  const trazo = el('path', {pathLength: 1}, svg, 's-hilo__trazo');
  const cabeza = div('s-hilo__cabeza', cont);
  cabeza.setAttribute('aria-hidden', 'true');
  let M = null, T = null, nodos = [], oculto = [0, 0], largo = 0, ruta = null;

  function medir() {
    const W = zona.clientWidth, Hz = zona.clientHeight, z0 = zona.getBoundingClientRect().top + scrollY;
    if (!W || !Hz) return;
    const secciones = {};
    for (const s of $$(':scope > section', zona)) {
      const r = s.getBoundingClientRect();
      secciones[s.id === 'modulos' ? 'modulos' : s.dataset.seccion] = {top: r.top + scrollY - z0, alto: r.height};
    }
    if (!secciones.cierre || !secciones.problema) return;
    const c = $('.s-contenedor', zona);
    M = {ancho: W, alto: Hz, contenedor: c ? c.getBoundingClientRect().width : 1072, secciones};
    const recto = W <= 1100;
    const d = recto ? `M20 0L20 ${Hz}` : trazar(M);
    svg.setAttribute('viewBox', `0 0 ${W} ${Hz}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    guia.setAttribute('d', d); trazo.setAttribute('d', d);
    ruta = trazo;
    largo = trazo.getTotalLength?.() || 0;
    T = recto ? [{p: 0, s: 0, x: 20, y: 0}, {p: 1, s: 1, x: 20, y: Hz}] : tabla(M);
    colocar(recto);
    const m = secciones.modulos;
    oculto = [m.top, m.top + m.alto];
    // El hilo se oculta durante S5 (el hueco se recorta con un polígono por CSSOM)
    svg.style.setProperty('clip-path', `polygon(0 0,${W}px 0,${W}px ${oculto[0]}px,0 ${oculto[0]}px,0 ${oculto[1]}px,${W}px ${oculto[1]}px,${W}px ${Hz}px,0 ${Hz}px)`);
  }
  function colocar(recto) {
    nodos.forEach((n) => n.remove());
    nodos = [];
    const [xi, xd] = carriles(M.ancho, M.contenedor);
    ANCLAS.forEach(([sec, ref, carril], i) => {
      const s = M.secciones[sec];
      if (!s) return;
      // Las notas de arranque de sección van a 96 px del borde superior: con 56 quedaban bajo la píldora de la cabecera (82 px) al llegar a la sección.
      const y = ref === 't' ? s.top + 96 : s.top + s.alto - 56;
      const x = recto ? 20 : carril ? xd : xi;
      const tema = $(`[data-seccion="${sec}"]`)?.dataset.tema || 'claro';
      const nodo = div('s-hilo__nodo', cont);
      nodo.dataset.tema = tema;
      nodo.style.setProperty('--x', x + 'px'); nodo.style.setProperty('--y', y + 'px');
      nodos.push(nodo);
      nodo._y = y;
      if (recto) return;
      const nota = div('s-hilo__nota', cont);
      nota.dataset.tema = tema;
      nota.dataset.lado = carril ? 'der' : 'izq';
      nota.style.setProperty('--x', x + 'px'); nota.style.setProperty('--y', y + 'px');
      const ic = el('svg', {viewBox: '0 0 16 16', 'aria-hidden': 'true'}, nota, 's-hilo__icono');
      for (const [tag, at] of ICONOS[i]) el(tag, at, ic);
      const tx = D.createElement('span');
      tx.textContent = notas[i] || '';
      nota.appendChild(tx);
      nodos.push(nota);
      nota._y = y;
      const orbe = i === 0 ? orbes.o1 : i === 4 ? orbes.hero : null;
      if (orbe) {
        const im = div('s-hilo__orbe', cont, 'img');
        im.src = orbe; im.alt = ''; im.width = 72; im.height = 72; im.loading = 'lazy'; im.decoding = 'async';
        im.dataset.tema = tema;
        im.style.setProperty('--x', x + 'px'); im.style.setProperty('--y', y + 24 + 'px');
        nodos.push(im);
        im._y = y;
      }
    });
    if (RM) { nodos.forEach((n) => n.classList.add('s-visto')); trazo.style.setProperty('stroke-dashoffset', '0'); }
  }

  const ro = new ResizeObserver(() => medir());
  ro.observe(zona);
  medir();

  let ultimo = '';
  return {
    medir,
    cuadro(y, vh) {
      if (RM || !M || !T) return;
      const top = zona.getBoundingClientRect().top + y; // posición absoluta de la zona
      const Yc = y + 0.6 * vh - top; // cabeza de lectura al 60 % de la ventana
      const P = lim(Yc / M.alto);
      const f = leer(T, P);
      const clave = f.s.toFixed(4) + '|' + f.x.toFixed(1) + '|' + f.y.toFixed(1);
      if (clave === ultimo) return;
      ultimo = clave;
      ruta.style.setProperty('stroke-dashoffset', String(1 - f.s));
      // La cabeza va sobre la curva real (getPointAtLength), no sobre la polilínea de la tabla: en los cruces diagonales la tabla se separaba hasta cientos de píxeles del trazo.
      const q = largo && ruta.getPointAtLength ? ruta.getPointAtLength(f.s * largo) : f;
      cabeza.style.setProperty('--x', (q.x * (zona.clientWidth / M.ancho)) + 'px');
      cabeza.style.setProperty('--y', q.y + 'px');
      cabeza.style.opacity = Yc < 0 || Yc > M.alto || (f.y > oculto[0] && f.y < oculto[1]) ? '0' : '1';
      for (const n of nodos) n.classList.toggle('s-visto', Yc >= n._y);
    },
  };
}
