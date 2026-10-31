// inicio.js (T10): solo la portada. sitio.js lo importa tras reposo y llama a la exportación por defecto con
// {urls, RM, NAT, motor}. Hace: escena fija de cuatro pasos (paso activo y marca .s-visto para animar su visual),
// y el hilo que se dibuja con el scroll.
// Scroll nativo, sin librerías de animación; este archivo solo lee scrollY y escribe variables CSS con setProperty.
const D = document, H = D.documentElement;
const $ = (s, r = D) => r.querySelector(s);
const $$ = (s, r = D) => [...r.querySelectorAll(s)];
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const SVG = 'http://www.w3.org/2000/svg';

/** Paso activo de la escena con histéresis de .04. */
export function pasoDe(s, actual, h = 0.04) {
  let n = actual;
  while (n < 3 && s > n + 1 + h) n++;
  while (n > 0 && s < n - h) n--;
  return n;
}

const el = (tag, attrs = {}, padre, clase) => {
  const e = D.createElementNS(SVG, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (clase) e.setAttribute('class', clase);
  padre?.appendChild(e);
  return e;
};
const div = (clase, padre) => { const e = D.createElement('div'); e.className = clase; padre?.appendChild(e); return e; };

export default function iniciar({urls, RM, motor}) {
  const {tareas, despertar} = motor;
  const ancho = () => innerWidth;

  /* ---------- escena de cuatro pasos (solo escritorio ancho) ---------- */
  const esc = $('[data-escena]');
  const pasos = esc ? $$('.s-paso', esc) : [];
  let paso = -1;
  const escenaActiva = () => !RM && ancho() > 1100;
  // El visual de cada paso se anima al activarse (.s-visto); apilado lo marca sitio.js al entrar en pantalla.
  const marcar = (n) => { if (escenaActiva()) pasos[n]?.classList.add('s-visto'); };
  let ultY = scrollY, ultT = performance.now();

  /* ---------- hilo ---------- */
  let notas = [];
  try { notas = JSON.parse(urls.notas || '[]'); } catch { notas = []; }
  const hilo = construirHilo(RM, notas);

  /* ---------- tareas por cuadro ---------- */
  tareas.add((t) => {
    const y = scrollY, vh = innerHeight;
    const vel = Math.abs(y - ultY) / Math.max(1, t - ultT) * 1000;
    ultY = y; ultT = t;
    H.toggleAttribute('data-rapido', vel > 650);
    if (esc && escenaActiva()) {
      const r = $('.s-escena__pista', esc).getBoundingClientRect();
      const n = pasoDe(lim(-r.top / Math.max(1, r.height - vh)) * 4, Math.max(paso, 0));
      if (n !== paso) { paso = n; esc.dataset.paso = String(n); marcar(n); }
    }
    hilo?.cuadro(y, vh);
    return false;
  });
  addEventListener('resize', () => hilo?.medir(), {passive: true});
  despertar(400);
}

/* ---------- hilo serpenteante ----------
 * Un solo trazo que baja por la página y cruza de un lado al otro, como el de two26, pero solo por espacio libre. En el tramo de cada sección
 * ondula dentro del margen (carril). Cruza en las BANDAS (huecos deliberados entre secciones, .s-banda) con una S grande de ±35 % de la altura
 * del hueco, con un rizo en algunas, y en los huecos naturales entre bloques con una S de tangentes verticales. Todo se calcula aquí con las
 * cajas de maquetación reales (offsetTop y offsetHeight, que no cambian con los revelados), se recalcula con ResizeObserver y deja 20 px de
 * aire al contenido. En las bandas el núcleo es más grueso (capas con ramas de 3 escalones, sobre el mismo path vía <use>); el pulso de cuatro
 * capas con glow, la cabeza con el único punto rojo, los nodos y las notas en píldora se encienden al llegar el trazo. Con movimiento
 * reducido aparece dibujado, sin pulso. */
// BLOQUE-ICONOS-INICIO
const ICONOS = [
  [['rect', {x: 1.5, y: 2.5, width: 5, height: 4, rx: 0.5}], ['rect', {x: 9.5, y: 4.5, width: 5, height: 4, rx: 0.5}], ['rect', {x: 4.5, y: 9.5, width: 5, height: 4, rx: 0.5}]],
  [['circle', {cx: 8, cy: 6.5, r: 3.5}], ['path', {d: 'M5.5 9.5 4.5 14l3.5-2 3.5 2-1-4.5'}]],
  [['path', {d: 'M3.5 2.5h6l3 3v8h-9z'}], ['path', {d: 'M9.5 2.5v3h3'}], ['path', {d: 'm5.5 9.5 1.7 1.7 3.3-3.4'}]],
  [['circle', {cx: 2.5, cy: 8, r: 1.5}], ['circle', {cx: 6.5, cy: 8, r: 1.5}], ['circle', {cx: 10.5, cy: 8, r: 1.5}], ['circle', {cx: 14, cy: 8, r: 0.5}], ['path', {d: 'M4 8h1M8 8h1M12 8h1'}]],
  [['path', {d: 'M4 12 12 4'}], ['path', {d: 'M5.5 4H12v6.5'}]],
];
// BLOQUE-ICONOS-FIN
let AIRE = 24; // (medir() lo baja a 20 en el móvil) 16 px de margen mínimo más medio núcleo de banda (3.75 a 1440, 2.1 a 390) y holgura; el móvil usa menos aire para cruzar por los huecos naturales (~88 px) sin alargar la página
const PULSO = [[230, 0.1], [150, 0.22], [90, 0.45], [40, 0.9]]; // largo en px y opacidad de cada capa del pulso
const ICONO_DE = [0, 1, 2, 3, 4, 0, 1]; // ícono de la nota de cada banda
const LOOPS = [1, 4]; // bandas (base 0) con rizo: solo dos en toda la página (hilo-carril exige 10 cruces a 1440 y cada rizo suma uno)
const TRIPLES = [3]; // una sola banda cruza tres veces (ida, vuelta e ida), sin rizo
const COLA = 72; // px de carril libre al final de cada banda en escritorio: con la sección anclada bajo la cabecera fija el barrido no pasa por debajo de ella
const RAMPA = 3, PASO_RAMPA = 26; // escalones y largo de cada uno al engrosar o afinar el trazo

const f1 = (n) => n.toFixed(1);
/** Grosor de trazo escalado por --s-hilo-k: 1 en oscuro y más fino en claro (lo fija el CSS por tema, sin volver a medir). */
const gr = (px) => `calc(${px}px * var(--s-hilo-k, 1))`;

/** Intervalos libres verticales (coordenadas de la zona) entre el contenido, de al menos `min` px; las bandas no cuentan como contenido. */
function huecos(zona, H, min) {
  const ocupado = [];
  const pasos = $('#modulos', zona);
  // .s-pantalla__img es el recorte ampliado de móvil: su caja sobrepasa a la miniatura que la recorta, que sí cuenta como contenido
  const ajeno = (e) => e.closest('[data-hilo], .s-solo-lector, [data-banda]') || (pasos && pasos.contains(e)) || e.classList.contains('s-pantalla__img');
  const MEDIA = /^(SVG|IMG|CANVAS|PICTURE|VIDEO)$/i;
  for (const e of zona.getElementsByTagName('*')) {
    if (!(e instanceof HTMLElement) || ajeno(e) || !e.offsetHeight) continue;
    const contenido = /^(IMG|FIGURE|BUTTON|A|CANVAS|VIDEO)$/.test(e.tagName) || e.matches('.s-tarjeta, .s-ventana, .s-acordeon__item')
      || [...e.childNodes].some((c) => (c.nodeType === 3 && c.nodeValue.trim()) || (c.nodeType === 1 && MEDIA.test(c.tagName)));
    if (!contenido) continue;
    let y = 0, n = e;
    for (; n && n !== zona; n = n.offsetParent) y += n.offsetTop;
    if (n === zona) ocupado.push([y - AIRE, y + e.offsetHeight + AIRE]);
  }
  // La escena fija de los pasos se mueve con el scroll: se trata entera como contenido (menos 40 px de aire de sus bordes)
  if (pasos) { let y = 0, n = pasos; for (; n && n !== zona; n = n.offsetParent) y += n.offsetTop; if (n === zona) ocupado.push([y + 40, y + pasos.offsetHeight - 40]); }
  ocupado.sort((a, b) => a[0] - b[0]);
  const libres = [];
  let fin = 0;
  for (const [a, b] of ocupado) { if (a - fin >= min) libres.push([fin, a]); if (b > fin) fin = b; }
  if (H - fin >= min) libres.push([fin, H]);
  return libres;
}

/** Puntos de la S grande de una banda, de (xa, y0) a (xb, y1): tres vaivenes de ±30 % de la altura y, si `rizo`, un rizo suave en el centro. */
function puntosBanda(xa, y0, xb, y1, rizo, ancho, triple, v) {
  const h = y1 - y0, X = (u) => xa + (xb - xa) * u, dir = xb > xa ? 1 : -1;
  if (triple) return [[xa, y0], [X(0.55), y0 + 0.2 * h], [X(0.97), y0 + 0.38 * h], [X(0.45), y0 + 0.58 * h], [X(0.03), y0 + 0.74 * h], [X(0.6), y0 + 0.9 * h], [xb, y1]];
  const sup = y0 + 0.2 * h, inf = y0 + 0.8 * h;
  if (!rizo || ancho < 700) {
    // Tres formas de S simple, por banda: la base, su espejo y una diagonal amplia (el barrido no se repite igual)
    if (v % 3 === 1) return [[xa, y0], [X(0.22), sup], [X(0.52), inf], [X(0.8), sup + 0.04 * h], [xb, y1]];
    if (v % 3 === 2) return [[xa, y0], [X(0.35), y0 + 0.3 * h], [X(0.65), y0 + 0.7 * h], [xb, y1]];
    return [[xa, y0], [X(0.18), inf], [X(0.48), sup], [X(0.78), inf - 0.04 * h], [xb, y1]];
  }
  const b = Math.min(44, 0.16 * h), a = 0.55 * b, cx = X(0.5), cy = y0 + 0.4 * h, rz = [];
  for (let t = -Math.PI; t <= Math.PI + 0.01; t += Math.PI / 9) rz.push([cx + dir * (a * t - b * Math.sin(t)) * 1, cy - b * Math.cos(t) * -1 * -1]);
  return [[xa, y0], [X(0.16), inf], ...rz, [X(0.8), inf - 0.04 * h], [xb, y1]];
}

function construirHilo(RM, notas) {
  const zona = $('.s-hilo-zona'), cont = zona && $('[data-hilo]', zona);
  if (!zona || !cont || typeof ResizeObserver === 'undefined') return null;
  const svg = el('svg', {'aria-hidden': 'true', focusable: 'false'}, cont, 's-hilo');
  const defs = el('defs', {}, svg);
  const base = el('path', {id: 's-hilo-d'}, defs);
  const usar = (clase) => { const u = el('use', {href: '#s-hilo-d'}, svg, clase); return u; };
  const guia = usar('s-hilo__guia');
  const trazo = usar('s-hilo__trazo');
  const grosor = el('g', {}, svg, 's-hilo__grosor');
  const capas = PULSO.map(([, o], i) => { const c = usar('s-hilo__pulso'); c.style.setProperty('opacity', String(o)); if (i === 0) c.classList.add('s-hilo__brillo'); return c; });
  const cabeza = div('s-hilo__cabeza', cont);
  cabeza.setAttribute('aria-hidden', 'true');
  let H = 0, total = 0, tabla = null, nodos = [], piezas = [], bandas = [], ultimo = -1, vivo = false, w0 = 3, wb = 7;

  function medir() {
    H = zona.clientHeight;
    const W = zona.clientWidth, c0 = $('.s-contenedor', zona);
    if (!H || !c0) return;
    const cs = getComputedStyle(zona);
    w0 = parseFloat(cs.getPropertyValue('--s-hilo-w')) || 3;
    wb = parseFloat(cs.getPropertyValue('--s-hilo-wb')) || 7;
    const zr = zona.getBoundingClientRect(), z0 = zr.top + scrollY;
    const margen = c0.getBoundingClientRect().left - zr.left + parseFloat(getComputedStyle(c0).paddingLeft);
    // Carril dentro del margen: con margen amplio (1440) ondula en toda la franja libre; con margen estrecho (390) es recto
    // T22: la barra de vidrio (compacta tras 60 px de scroll, --s-cab-w = min(1088px, 94vw)) pasa sobre el carril; el trazo se queda a 40 px o más de su borde izquierdo
    // (a 1440 el carril llegaba a 22 px de la barra y a 4800 rozaba su esquina a 18 px).
    const barraIzq = (innerWidth - Math.min(1088, 0.94 * innerWidth)) / 2;
    const xmin = 4 + w0 / 2, xmax = innerWidth > 768 ? Math.min(margen - 18 - wb / 2, barraIzq - 40 - wb / 2) : margen - 18 - wb / 2;
    const recto = xmax - xmin < 12;
    const movil0 = innerWidth <= 768;
    // En móvil el riel recto queda a 10 px del borde (no pegado a él); el margen de 29 px deja 16 px libres entre su núcleo y el texto
    const centro = recto ? (movil0 ? 10 : Math.min(xmax, xmin + 2)) : (xmin + xmax) / 2, amp = recto ? 0 : ((xmax - xmin) / 2) * 0.9;
    const lado = (s, k) => { const x = centro + (k % 2 ? amp : -amp); return s ? W - x : x; };
    const movil = innerWidth <= 768, corrida = movil ? 500 : 380, paso = 260;
    AIRE = movil ? 18.5 : 24;
    const libres = huecos(zona, H, movil ? 2 * AIRE + 4 : 2 * AIRE + 16);
    // Bandas: el hueco libre que contiene el centro de cada .s-banda visible
    const bs = $$('[data-banda]', zona).filter((b) => b.offsetHeight).map((b) => { let y = 0, n = b; for (; n && n !== zona; n = n.offsetParent) y += n.offsetTop; return y + b.offsetHeight / 2; });
    const deBanda = new Map();
    bs.forEach((cy, i) => { const g = libres.find(([a, b]) => cy > a && cy < b); if (g) deBanda.set(g, i); });
    // Recorrido como lista de órdenes de dibujo
    let d = '', cur = [lado(0, 0), 0], k = 0, s = 0, ult = 0;
    d = `M${f1(cur[0])} 0`;
    const sCurva = (x, y) => { const [x0, y0] = cur, m = (y - y0) / 2; d += `C${f1(x0)} ${f1(y0 + m)} ${f1(x)} ${f1(y - m)} ${f1(x)} ${f1(y)}`; cur = [x, y]; };
    const catmull = (P) => {
      const Q = [[P[0][0], P[0][1] - 80], ...P, [P.at(-1)[0], P.at(-1)[1] + 80]];
      for (let i = 1; i < Q.length - 2; i++) {
        const [p0, p1, p2, p3] = [Q[i - 1], Q[i], Q[i + 1], Q[i + 2]];
        let c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        if (i === 1) c1 = [p1[0], p1[1] + 50];
        if (i === Q.length - 3) c2 = [p2[0], p2[1] - 50];
        d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
      }
      cur = P.at(-1);
    };
    const ondas = (hasta) => { while (cur[1] + paso * 1.4 < hasta) { k++; sCurva(lado(s, k), cur[1] + paso); } };
    const entradas = []; // cruces de banda: puntos de entrada y salida y gap
    let nb = 0;
    const cruces = libres.map((g) => ({g, banda: deBanda.has(g) ? deBanda.get(g) : -1})).filter(({g, banda}) => banda >= 0 || (g[0] + g[1]) / 2 - 0 > 0);
    for (const {g: [a, b], banda} of cruces) {
      const cy = (a + b) / 2;
      if (banda < 0 && (cy - ult < corrida || cy > H - 200 || bs.some((by) => Math.abs(by - cy) < corrida * 0.55))) continue;
      if (banda >= 0 && cy - ult < 120) continue;
      if (banda >= 0) {
        const y0 = a + 8, cola = movil || b - a - 16 - COLA < 110 ? 0 : COLA, y1 = b - 8 - cola;
        ondas(y0);
        if (cur[1] < y0 - 1) sCurva(cur[0], y0);
        const xa = cur[0];
        s ^= 1; k++;
        const xb = lado(s, k);
        catmull(puntosBanda(xa, y0, xb, y1, LOOPS.includes(banda) && !movil, W, TRIPLES.includes(banda) && !movil, banda));
        entradas.push({a, b, y0, y1, xa, xb, banda: nb++});
        ult = y1;
      } else {
        const alto = Math.min(b - a - 6, 140), y0 = cy - alto / 2, y1 = cy + alto / 2;
        ondas(y0);
        sCurva(cur[0], y0);
        s ^= 1; k++;
        sCurva(lado(s, k), y1);
        ult = y1;
      }
    }
    ondas(H);
    k++;
    sCurva(lado(s, k), H);
    base.setAttribute('d', d);
    total = base.getTotalLength();
    base.setAttribute('pathLength', total);
    for (const u of [guia, trazo, ...capas]) { u.style.setProperty('stroke-dasharray', `${total} ${total}`); }
    guia.style.setProperty('stroke-width', gr(w0));
    // Tabla de arco a posición (el máximo corrido de Y permite buscar por altura aunque el trazo suba en los rizos)
    const n = Math.ceil(total / 5) + 1;
    tabla = {s: new Float32Array(n), x: new Float32Array(n), y: new Float32Array(n), m: new Float32Array(n)};
    let mx = -1;
    for (let i = 0; i < n; i++) { const L = Math.min(total, (i * total) / (n - 1)), q = base.getPointAtLength(L); tabla.s[i] = L; tabla.x[i] = q.x; tabla.y[i] = q.y; mx = Math.max(mx, q.y); tabla.m[i] = mx; }
    // Arco de entrada y salida de cada banda y capas de grosor con rampas de tres escalones
    grosor.replaceChildren();
    piezas = [];
    bandas = entradas.map((e) => {
      const arco = (x, y) => { let mejor = 0, dm = 1e9; for (let i = 0; i < n; i++) { const dd = (tabla.x[i] - x) ** 2 + (tabla.y[i] - y) ** 2; if (dd < dm) { dm = dd; mejor = i; } } return tabla.s[mejor]; };
      return {...e, sa: arco(e.xa, e.y0), sb: arco(e.xb, e.y1)};
    });
    for (const bd of bandas) {
      const tramos = [[bd.sa, bd.sb, wb]];
      for (let i = 0; i < RAMPA; i++) {
        const ancho = w0 + ((wb - w0) * (i + 1)) / (RAMPA + 1);
        tramos.push([bd.sa - PASO_RAMPA * (RAMPA - i), bd.sa - PASO_RAMPA * (RAMPA - i - 1) + 1, ancho]);
        tramos.push([bd.sb - 1 + PASO_RAMPA * (RAMPA - i - 1), bd.sb + PASO_RAMPA * (RAMPA - i), ancho]);
      }
      for (const [s0, s1, ancho] of tramos) {
        const u = el('use', {href: '#s-hilo-d'}, grosor, 's-hilo__capa');
        u.style.setProperty('stroke-width', gr(ancho));
        u.style.setProperty('stroke-dasharray', `0 ${total}`);
        u.style.setProperty('stroke-dashoffset', String(-Math.max(0, s0)));
        piezas.push({u, s0: Math.max(0, s0), s1: Math.min(total, s1), v: -1});
      }
    }
    cabeza.style.setProperty('--w', wb + 'px');
    // Nodos al inicio de cada sección (donde el trazo está en un margen) y notas en píldora dentro de las bandas
    nodos.forEach((x) => x.remove());
    nodos = [];
    for (const id of ['problema', 'valor', 'modulos', 'pantallas', 'puestos', 'seguridad', 'integraciones', 'cierre']) {
      const sec = $(id === 'modulos' ? '#modulos' : `[data-seccion="${id}"]`, zona);
      if (!sec) continue;
      let y = sec.getBoundingClientRect().top + scrollY - z0 + 64;
      for (let t = 0; t < 8; t++) { const q = en(y); if (q.x < margen - 10 || q.x > W - margen + 10) break; y += 48; }
      const q = en(y), nodo = div('s-hilo__nodo', cont);
      nodo._y = y;
      nodo.style.setProperty('--x', q.x + 'px'); nodo.style.setProperty('--y', y + 'px');
      nodos.push(nodo);
    }
    if (!movil) bandas.forEach((bd, i) => {
      const txt = notas[i];
      if (!txt) return;
      const nota = div('s-hilo__nota', cont);
      nota.style.setProperty('--r', (i % 2 ? 3 : -3) + 'deg');
      const ic = el('svg', {viewBox: '0 0 16 16', 'aria-hidden': 'true'}, nota, 's-hilo__icono');
      for (const [tag, at] of ICONOS[ICONO_DE[i]]) el(tag, at, ic);
      const tx = D.createElement('span');
      tx.textContent = txt;
      nota.appendChild(tx);
      const nw = nota.offsetWidth + 16, nh = nota.offsetHeight + 16; // con el giro de 3 grados
      // El candidato válido más cercano al trazo, a 16 px o más de él (contando el núcleo grueso), dentro del hueco libre
      let mejor = null;
      const ys0 = bd.a + 4 + nh / 2, ys1 = bd.b - 4 - nh / 2;
      const cerca = [];
      for (let j = 0; j < n; j++) if (tabla.y[j] > bd.a - 120 && tabla.y[j] < bd.b + 120) cerca.push(j);
      for (let cx = W * 0.14; cx < W * 0.86; cx += W * 0.03) for (let cy = ys0; cy <= ys1; cy += 10) {
        let dmin = 1e9;
        for (const j of cerca) { const dx = Math.max(cx - nw / 2 - tabla.x[j], 0, tabla.x[j] - cx - nw / 2), dy = Math.max(cy - nh / 2 - tabla.y[j], 0, tabla.y[j] - cy - nh / 2); const dd = Math.hypot(dx, dy); if (dd < dmin) dmin = dd; }
        if (dmin >= 16 + wb / 2 + 6 && (!mejor || dmin < mejor.d)) mejor = {cx, cy, d: dmin};
      }
      if (!mejor) { nota.remove(); return; }
      nota.style.setProperty('--x', mejor.cx - nota.offsetWidth / 2 + 'px');
      nota.style.setProperty('--y', mejor.cy - nota.offsetHeight / 2 + 'px');
      nota._y = bd.y0 + (bd.y1 - bd.y0) * 0.35;
      nodos.push(nota);
    });
    ultimo = -1;
    vivo = true;
    if (RM) { dibujar(H); nodos.forEach((x) => x.classList.add('s-visto')); }
  }

  /** Posición del trazo al llegar a la altura y de la zona (primer punto cuyo máximo de Y alcanza y). */
  function en(y) {
    const M = tabla.m;
    let a = 0, b = M.length - 1;
    while (a < b) { const m = (a + b) >> 1; if (M[m] < y) a = m + 1; else b = m; }
    return {s: tabla.s[a], x: tabla.x[a], y: tabla.y[a]};
  }
  function anchoEn(s) {
    let w = w0;
    for (const bd of bandas) {
      const rampa = RAMPA * PASO_RAMPA;
      const t = s < bd.sa ? (s - (bd.sa - rampa)) / rampa : s > bd.sb ? ((bd.sb + rampa) - s) / rampa : 1;
      if (t > 0) w = Math.max(w, w0 + (wb - w0) * Math.min(1, t));
    }
    return w;
  }
  function dibujar(cab) {
    const q = en(cab);
    trazo.style.setProperty('stroke-width', gr(w0));
    trazo.style.setProperty('stroke-dashoffset', String(total - q.s));
    for (const p of piezas) {
      const v = Math.max(0, Math.min(p.s1, q.s) - p.s0);
      if (v !== p.v) { p.v = v; p.u.style.setProperty('stroke-dasharray', `${v} ${total}`); }
    }
    return q;
  }

  new ResizeObserver(medir).observe(zona);
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(medir);
  medir();

  return {
    medir,
    cuadro(y, vh) {
      if (RM || !vivo || !H) return;
      const cab = Math.min(H, Math.max(0, 0.6 * vh - zona.getBoundingClientRect().top));
      if (Math.abs(cab - ultimo) < 0.5) return;
      ultimo = cab;
      const q = dibujar(cab), ww = anchoEn(q.s);
      capas.forEach((c, i) => {
        c.style.setProperty('stroke-dasharray', `${PULSO[i][0]} ${total}`);
        c.style.setProperty('stroke-dashoffset', String(PULSO[i][0] - q.s));
        c.style.setProperty('stroke-width', gr(i === 0 ? ww * 4 : ww));
      });
      const viaja = cab > 8 && cab < H - 8;
      svg.classList.toggle('s-hilo--viaja', viaja);
      cabeza.style.setProperty('--x', q.x + 'px'); cabeza.style.setProperty('--y', q.y + 'px');
      cabeza.style.setProperty('--d', Math.round(5 + ww * 0.75) + 'px');
      cabeza.style.opacity = viaja ? '1' : '0';
      for (const n of nodos) n.classList.toggle('s-visto', cab >= n._y);
    },
  };
}
