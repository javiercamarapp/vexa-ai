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
 * Un solo trazo que baja por la página y CRUZA de un lado al otro, como el de two26, pero solo por los espacios libres: en el tramo de cada sección
 * ondula dentro del margen (carril) y cruza en los huecos verticales entre bloques con una curva en S de tangentes verticales. El recorrido se
 * calcula aquí con las medidas reales del diseño (texto, imágenes, figuras, botones y tarjetas, con 24 px de aire), se recalcula con ResizeObserver
 * y es monótono en Y, así que nunca sale del hueco que le tocó. Núcleo que avanza con la lectura (dasharray), pulso de cuatro capas con glow que
 * termina en la cabeza, nodos y notas que se encienden al llegar el trazo, y la cabeza con el único punto rojo. Con movimiento reducido
 * aparece dibujado, sin pulso. */
// BLOQUE-ICONOS-INICIO
const ICONOS = [
  [['rect', {x: 1.5, y: 2.5, width: 5, height: 4, rx: 0.5}], ['rect', {x: 9.5, y: 4.5, width: 5, height: 4, rx: 0.5}], ['rect', {x: 4.5, y: 9.5, width: 5, height: 4, rx: 0.5}]],
  [['circle', {cx: 8, cy: 6.5, r: 3.5}], ['path', {d: 'M5.5 9.5 4.5 14l3.5-2 3.5 2-1-4.5'}]],
  [['path', {d: 'M3.5 2.5h6l3 3v8h-9z'}], ['path', {d: 'M9.5 2.5v3h3'}], ['path', {d: 'm5.5 9.5 1.7 1.7 3.3-3.4'}]],
  [['circle', {cx: 2.5, cy: 8, r: 1.5}], ['circle', {cx: 6.5, cy: 8, r: 1.5}], ['circle', {cx: 10.5, cy: 8, r: 1.5}], ['circle', {cx: 14, cy: 8, r: 0.5}], ['path', {d: 'M4 8h1M8 8h1M12 8h1'}]],
  [['path', {d: 'M4 12 12 4'}], ['path', {d: 'M5.5 4H12v6.5'}]],
];
// BLOQUE-ICONOS-FIN
const AIRE = 20; // 16 px de margen mínimo, más medio núcleo y holgura
const PULSO = [[230, 0.1], [150, 0.22], [90, 0.45], [40, 0.9]]; // largo en px y opacidad de cada capa del pulso
/** [section, índice de nota] de las cinco notas junto al trazo. */
const NOTAS = [['problema', 0], ['valor', 1], ['pantallas', 2], ['seguridad', 3], ['cierre', 4]];
const ANCLAS = ['problema', 'valor', 'modulos', 'pantallas', 'puestos', 'seguridad', 'integraciones', 'cierre'];

/** Intervalos verticales (coordenadas de la zona) que ocupa el contenido, y los huecos libres entre ellos de al menos `min` px.
 * Se miden con la caja de maquetación (offsetTop y offsetHeight), que no cambia con los translateY y scaleX de los revelados: así el resultado es
 * el mismo antes y después de que cada bloque aparezca. */
function huecos(zona, H, min) {
  const ocupado = [];
  const pasos = $('#modulos', zona);
  const ajeno = (e) => e.closest('[data-hilo], .s-solo-lector') || (pasos && pasos.contains(e));
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

function construirHilo(RM, notas) {
  const zona = $('.s-hilo-zona'), cont = zona && $('[data-hilo]', zona);
  if (!zona || !cont || typeof ResizeObserver === 'undefined') return null;
  const svg = el('svg', {'aria-hidden': 'true', focusable: 'false'}, cont, 's-hilo');
  const guia = el('path', {}, svg, 's-hilo__guia');
  const trazo = el('path', {}, svg, 's-hilo__trazo');
  const capas = PULSO.map(([, o], i) => { const c = el('path', {}, svg, 's-hilo__pulso'); c.style.setProperty('opacity', String(o)); if (i === 0) c.classList.add('s-hilo__brillo'); return c; });
  const cabeza = div('s-hilo__cabeza', cont);
  cabeza.setAttribute('aria-hidden', 'true');
  let H = 0, total = 0, tabla = null, nodos = [], ultimo = -1, vivo = false;

  function medir() {
    H = zona.clientHeight;
    const W = zona.clientWidth, c0 = $('.s-contenedor', zona);
    if (!H || !c0) return;
    const w = parseFloat(getComputedStyle(zona).getPropertyValue('--s-hilo-w')) || 3;
    const z0 = zona.getBoundingClientRect().top + scrollY;
    const margen = c0.getBoundingClientRect().left - zona.getBoundingClientRect().left + parseFloat(getComputedStyle(c0).paddingLeft);
    // Carril dentro del margen: con margen amplio (1440) ondula en una franja de unos 58 px y deja el resto para las notas; con margen estrecho (390) es recto
    const conNotas = margen >= 160 && notas.length > 0;
    const xmin = 4 + w / 2, xmax = Math.min(margen - 18 - w / 2, conNotas ? 72 : 1e9);
    const centro = xmax - xmin < 12 ? xmax : (xmin + xmax) / 2, amp = xmax - xmin < 12 ? 0 : ((xmax - xmin) / 2) * 0.85;
    const lado = (s, k) => { const x = centro + (k % 2 ? amp : -amp); return s ? W - x : x; };
    // Cruces: en los huecos libres, el primero a más de `corrida` px del anterior
    const corrida = innerWidth <= 768 ? 1300 : 780, paso = 260;
    const libres = huecos(zona, H, 2 * AIRE + 16);
    const pts = [[lado(0, 0), 0]];
    let s = 0, k = 0, ult = 0;
    for (const [a, b] of libres) {
      const centroY = (a + b) / 2;
      if (centroY - ult < corrida || centroY > H - 200) continue;
      const alto = Math.min(b - a - 6, 140), y0 = centroY - alto / 2, y1 = centroY + alto / 2;
      while (pts[pts.length - 1][1] + paso * 1.4 < y0) { k++; pts.push([lado(s, k), pts[pts.length - 1][1] + paso]); }
      pts.push([pts[pts.length - 1][0], y0]);
      s ^= 1; k++;
      pts.push([lado(s, k), y1]);
      ult = y1;
    }
    while (pts[pts.length - 1][1] + paso * 1.4 < H) { k++; pts.push([lado(s, k), pts[pts.length - 1][1] + paso]); }
    pts.push([lado(s, k + 1), H]);
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (y1 - y0) / 2;
      d += `C${x0.toFixed(1)} ${(y0 + m).toFixed(1)} ${x1.toFixed(1)} ${(y1 - m).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    for (const p of [guia, trazo, ...capas]) { p.setAttribute('d', d); p.setAttribute('stroke-width', w); }
    capas[0].setAttribute('stroke-width', w * 4);
    total = trazo.getTotalLength();
    for (const p of [trazo, ...capas]) p.setAttribute('pathLength', total);
    // Tabla de Y a longitud de arco (el recorrido es monótono en Y)
    const n = Math.ceil(total / 6) + 1;
    tabla = {y: new Float32Array(n), s: new Float32Array(n), x: new Float32Array(n)};
    for (let i = 0; i < n; i++) { const q = trazo.getPointAtLength(Math.min(total, (i * total) / (n - 1))); tabla.y[i] = q.y; tabla.s[i] = (i * total) / (n - 1); tabla.x[i] = q.x; }
    cabeza.style.setProperty('--w', w + 'px');
    // Nodos y notas junto al trazo, solo donde el trazo está dentro de un margen
    nodos.forEach((x) => x.remove());
    nodos = [];
    ANCLAS.forEach((id) => {
      const sec = $(id === 'modulos' ? '#modulos' : `[data-seccion="${id}"]`, zona);
      if (!sec) return;
      let y = sec.getBoundingClientRect().top + scrollY - z0 + 64;
      for (let t = 0; t < 8; t++) { const q = en(y); if (q.x < margen - 10 || q.x > W - margen + 10) break; y += 48; }
      const q = en(y);
      const nodo = div('s-hilo__nodo', cont);
      nodo._y = y;
      nodo.style.setProperty('--x', q.x + 'px'); nodo.style.setProperty('--y', y + 'px');
      nodos.push(nodo);
      const j = NOTAS.findIndex(([sid]) => sid === id || (sid === 'pantallas' && id === 'pantallas'));
      if (conNotas && j >= 0 && notas[NOTAS[j][1]] && (q.x < margen - 10 || q.x > W - margen + 10)) {
        const derecha = q.x > W / 2, nota = div('s-hilo__nota', cont);
        nota.dataset.lado = derecha ? 'der' : 'izq';
        nota.style.setProperty('--x', (derecha ? W - xmax - 16 - 6 - w : xmax + 16 + 6 + w) + 'px');
        nota.style.setProperty('--y', y + 'px');
        const ic = el('svg', {viewBox: '0 0 16 16', 'aria-hidden': 'true'}, nota, 's-hilo__icono');
        for (const [tag, at] of ICONOS[NOTAS[j][1]]) el(tag, at, ic);
        const tx = D.createElement('span');
        tx.textContent = notas[NOTAS[j][1]];
        nota.appendChild(tx);
        nota._y = y;
        nodos.push(nota);
      }
    });
    ultimo = -1;
    vivo = true;
    if (RM) { dibujar(H); nodos.forEach((x) => x.classList.add('s-visto')); }
  }

  /** Posición del trazo a la altura y de la zona. */
  function en(y) {
    const Y = tabla.y;
    let a = 0, b = Y.length - 1;
    while (a < b) { const m = (a + b) >> 1; if (Y[m] < y) a = m + 1; else b = m; }
    return {s: tabla.s[a], x: tabla.x[a], y: Y[a]};
  }
  function dibujar(cab) {
    const q = en(cab), L = q.s;
    trazo.style.setProperty('stroke-dasharray', `${total} ${total}`);
    trazo.style.setProperty('stroke-dashoffset', String(total - L));
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
      const q = dibujar(cab);
      capas.forEach((c, i) => {
        c.style.setProperty('stroke-dasharray', `${PULSO[i][0]} ${total}`);
        c.style.setProperty('stroke-dashoffset', String(PULSO[i][0] - q.s));
      });
      const viaja = cab > 8 && cab < H - 8;
      svg.classList.toggle('s-hilo--viaja', viaja);
      cabeza.style.setProperty('--x', q.x + 'px'); cabeza.style.setProperty('--y', q.y + 'px');
      cabeza.style.opacity = viaja ? '1' : '0';
      for (const n of nodos) n.classList.toggle('s-visto', cab >= n._y);
    },
  };
}
