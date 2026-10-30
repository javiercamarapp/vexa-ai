// inicio.js (T10): solo la portada. sitio.js lo importa tras reposo y llama a la exportación por defecto con
// {RM, NAT, motor}. Hace: escena fija de cuatro pasos (paso activo y marca .s-visto para animar su visual),
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

export default function iniciar({RM, motor}) {
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
  const hilo = construirHilo(RM);

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

/* ---------- hilo: carril propio en el margen izquierdo ----------
 * Un solo trazo vertical recto. Su centro lo calcula el CSS (--s-hilo-x, registrada como longitud) a partir del margen libre a la izquierda del
 * contenido, así que nunca cruza texto, imágenes, botones ni tarjetas. Aquí solo se dibuja: núcleo que avanza con la lectura, pulso de luz con
 * glow que viaja con la cabeza, nodos que se encienden al llegar el trazo y la cabeza con el único punto rojo. Con movimiento reducido
 * aparece dibujado y sin pulso. */
const ANCLAS = ['problema', 'valor', 'modulos', 'pantallas', 'puestos', 'seguridad', 'integraciones', 'cierre'];
const LARGO_PULSO = 170;
function construirHilo(RM) {
  const zona = $('.s-hilo-zona'), cont = zona && $('[data-hilo]', zona);
  if (!zona || !cont || typeof ResizeObserver === 'undefined') return null;
  const svg = el('svg', {'aria-hidden': 'true', focusable: 'false'}, cont, 's-hilo');
  const defs = el('defs', {}, svg);
  const grad = el('linearGradient', {id: 's-hilo-grad', x1: 0, y1: 0, x2: 0, y2: 1}, defs);
  el('stop', {offset: 0, 'stop-opacity': 0}, grad, 's-hilo__stop');
  el('stop', {offset: 1, 'stop-opacity': 1}, grad, 's-hilo__stop');
  const trazo = el('path', {pathLength: 1}, svg, 's-hilo__trazo');
  const pulso = el('g', {}, svg, 's-hilo__pulso');
  const brillo = el('rect', {fill: 'url(#s-hilo-grad)', height: LARGO_PULSO}, pulso, 's-hilo__brillo');
  const nucleo = el('rect', {fill: 'url(#s-hilo-grad)', height: LARGO_PULSO}, pulso, 's-hilo__nucleo');
  const cabeza = div('s-hilo__cabeza', cont);
  cabeza.setAttribute('aria-hidden', 'true');
  let H = 0, nodos = [], ultimo = -1;

  function medir() {
    H = zona.clientHeight;
    if (!H) return;
    const cs = getComputedStyle(zona);
    const x = parseFloat(cs.getPropertyValue('--s-hilo-x')) || 8, w = parseFloat(cs.getPropertyValue('--s-hilo-w')) || 3;
    trazo.setAttribute('d', `M${x} 0V${H}`);
    trazo.setAttribute('stroke-width', w);
    nucleo.setAttribute('x', x - w / 2); nucleo.setAttribute('width', w);
    brillo.setAttribute('x', x - w * 2); brillo.setAttribute('width', w * 4);
    cabeza.style.setProperty('--x', x + 'px');
    const z0 = zona.getBoundingClientRect().top + scrollY;
    nodos.forEach((n) => n.remove());
    nodos = ANCLAS.flatMap((id) => {
      const s = $(id === 'modulos' ? '#modulos' : `[data-seccion="${id}"]`, zona);
      if (!s) return [];
      const n = div('s-hilo__nodo', cont);
      n._y = s.getBoundingClientRect().top + scrollY - z0 + 64;
      n.style.setProperty('--x', x + 'px'); n.style.setProperty('--y', n._y + 'px');
      return [n];
    });
    ultimo = -1;
    if (RM) { trazo.style.setProperty('stroke-dashoffset', '0'); nodos.forEach((n) => n.classList.add('s-visto')); }
  }
  new ResizeObserver(medir).observe(zona);
  medir();

  return {
    medir,
    cuadro(y, vh) {
      if (RM || !H) return;
      const cab = Math.min(H, Math.max(0, 0.6 * vh - zona.getBoundingClientRect().top));
      if (Math.abs(cab - ultimo) < 0.5) return;
      ultimo = cab;
      trazo.style.setProperty('stroke-dashoffset', String(1 - cab / H));
      const viaja = cab > 8 && cab < H - 8;
      pulso.style.setProperty('transform', `translateY(${Math.max(0, cab - LARGO_PULSO)}px)`);
      pulso.style.setProperty('opacity', viaja ? '1' : '0');
      cabeza.style.setProperty('--y', cab + 'px');
      cabeza.style.opacity = viaja ? '1' : '0';
      for (const n of nodos) n.classList.toggle('s-visto', cab >= n._y);
    },
  };
}
