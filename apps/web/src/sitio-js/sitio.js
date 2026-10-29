// sitio.js (T10): carga temprana del sitio. Módulo ES del mismo origen, sin dependencias, sin eval, sin style en el marcado.
// Hace: html[data-js], cabecera, menús, panel móvil, escena de tema global, revelados, conteo del héroe, palabras, puestos, acordeón
// y el motor de barrido de respaldo (--p) para navegadores sin animation-timeline. Carga inicio.js tras reposo solo en la portada.
// La URL de inicio.js llega por un atributo de datos de su propia etiqueta <script data-sitio>.
const D = document, H = D.documentElement;
const $ = (s, r = D) => r.querySelector(s);
const $$ = (s, r = D) => [...r.querySelectorAll(s)];
const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAT = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()');
const guion = $('script[data-sitio]');
const DATOS = guion ? guion.dataset : {};

H.setAttribute('data-js', '');

/* React hidrata el documento entero: tocar la estructura (quitar o añadir nodos, cambiar texto) antes de que termine provoca el
 * error 418 y que React rehaga el documento. Atributos y clases son seguros; lo estructural espera a que el pie tenga su fibra. */
const hidratado = () => { const f = $('.s-pie') || $('main'); return !f || Object.keys(f).some((k) => k.startsWith('__reactFiber')); };
const listo = new Promise((res) => { let n = 0; const t = () => (hidratado() || ++n > 50 ? res() : setTimeout(t, 100)); t(); });

/* ---------- motor de cuadros: un solo rAF compartido, solo vive mientras algo se mueve ---------- */
const tareas = new Set();
let raf = 0, vivoHasta = 0;
function cuadro(t) {
  raf = 0;
  let sigue = t < vivoHasta;
  for (const f of tareas) if (f(t)) sigue = true;
  if (sigue) raf = requestAnimationFrame(cuadro);
}
function despertar(ms = 1200) {
  vivoHasta = performance.now() + ms;
  if (!raf) raf = requestAnimationFrame(cuadro);
}
for (const e of ['scroll', 'resize', 'wheel', 'touchmove', 'keydown']) addEventListener(e, () => despertar(), {passive: true});

/* Barrido de respaldo: escribe --p (0 a 1) en destino, solo mientras el origen está cerca de la vista. */
const barridos = [];
let ioBarrido = null;
function barrer(origen, fn, destino = origen) {
  if (NAT || RM || !origen) return;
  const b = {origen, destino, fn, vis: false, p: -1};
  barridos.push(b);
  ioBarrido ||= new IntersectionObserver((es) => es.forEach((e) => { const x = barridos.find((q) => q.origen === e.target); if (x) x.vis = e.isIntersecting; despertar(300); }), {rootMargin: '25% 0px'});
  ioBarrido.observe(origen);
  if (barridos.length === 1) tareas.add(() => {
    const vh = innerHeight;
    for (const q of barridos) if (q.vis) {
      const p = lim(q.fn(q.origen.getBoundingClientRect(), vh));
      if (Math.abs(p - q.p) > 0.0005) { q.p = p; q.destino.style.setProperty('--p', p.toFixed(4)); }
    }
    return false;
  });
}
// Rangos equivalentes a los de CSS (ver tipografia.css e inicio.css)
export const rangos = {
  palabras: (r, vh) => (0.8 * vh - r.top) / (r.height + 0.45 * vh), // cover 20vh a cover 100% - 35vh
  pista: (r, vh) => (r.height > vh ? -r.top / (r.height - vh) : 0), // contain
  entrada: (r, vh) => (r.height ? (vh - r.top) / r.height : 0), // entry
};

/* ---------- cabecera, menús y panel móvil ---------- */
function cabecera() {
  const cab = $('.s-cabecera');
  if (!cab) return;
  const compacta = () => cab.toggleAttribute('data-compacta', scrollY > 60);
  addEventListener('scroll', compacta, {passive: true});
  compacta();

  const items = $$('.s-cabecera__item', cab).filter((i) => $('.s-menu', i) && $('[aria-haspopup]', i));
  const abrirItem = (it, v) => { it.toggleAttribute('data-abierto', v); $('[aria-haspopup]', it).setAttribute('aria-expanded', String(v)); };
  items.forEach((it) => {
    const b = $('[aria-haspopup]', it);
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => { const v = !it.hasAttribute('data-abierto'); items.forEach((o) => abrirItem(o, false)); abrirItem(it, v); });
    it.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && it.hasAttribute('data-abierto')) { abrirItem(it, false); b.focus(); }
      else if (e.key === 'ArrowDown' && e.target === b) { e.preventDefault(); abrirItem(it, true); $('.s-menu a', it)?.focus(); }
    });
    it.addEventListener('focusout', (e) => { if (!it.contains(e.relatedTarget)) abrirItem(it, false); });
  });
  D.addEventListener('pointerdown', (e) => items.forEach((it) => { if (!it.contains(e.target)) abrirItem(it, false); }));

  const bg = $('.s-cabecera__burger', cab), panel = $('#panel-movil');
  if (!bg || !panel) return;
  const enfocables = () => [bg, ...$$('a[href]', panel)];
  const panelAbrir = (v) => {
    cab.toggleAttribute('data-menu-abierto', v);
    bg.setAttribute('aria-expanded', String(v));
    bg.setAttribute('aria-label', (v ? bg.dataset.etiquetaCerrar : bg.dataset.etiquetaAbrir) || bg.getAttribute('aria-label'));
    H.classList.toggle('s-menu-abierto', v);
    if (v) $('a[href]', panel)?.focus();
  };
  bg.addEventListener('click', () => panelAbrir(!cab.hasAttribute('data-menu-abierto')));
  panel.addEventListener('click', (e) => { if (e.target.closest('a[href]')) panelAbrir(false); });
  cab.addEventListener('keydown', (e) => {
    if (!cab.hasAttribute('data-menu-abierto')) return;
    if (e.key === 'Escape') { panelAbrir(false); bg.focus(); return; }
    if (e.key !== 'Tab') return;
    const l = enfocables(), a = D.activeElement;
    if (e.shiftKey && a === l[0]) { e.preventDefault(); l[l.length - 1].focus(); }
    else if (!e.shiftKey && a === l[l.length - 1]) { e.preventDefault(); l[0].focus(); }
  });
  matchMedia('(min-width: 1101px)').addEventListener('change', (m) => { if (m.matches && cab.hasAttribute('data-menu-abierto')) panelAbrir(false); });
}

/* ---------- escena de tema global ----------
 * Un solo atributo en <html> (data-escena) cambia las variables semánticas de fondo, texto, bordes y cabecera con una transición de 700 ms
 * (tokens.css). Se dispara cuando el borde superior de la sección siguiente cruza el 42 % del alto de la ventana al bajar y el 58 % al subir:
 * la histéresis evita parpadeos con scroll rápido o hacia atrás. Las secciones no tienen fondo propio, así que no hay costuras. */
function tema() {
  const cab = $('.s-cabecera');
  const secs = $$('section[data-tema], footer[data-tema]');
  if (!secs.length) return;
  let ultY = scrollY, escena = '', libre = true;
  const aplicar = () => {
    libre = true;
    const y = scrollY, bajando = y >= ultY;
    if (y !== ultY) ultY = y;
    const linea = innerHeight * (bajando ? 0.42 : 0.58);
    let t = secs[0].dataset.tema;
    for (const s of secs) if (s.getBoundingClientRect().top <= linea) t = s.dataset.tema; else break;
    if (t !== escena) { escena = t; H.setAttribute('data-escena', t); if (cab) cab.dataset.tema = t; }
  };
  const pedir = () => { if (libre) { libre = false; requestAnimationFrame(aplicar); } };
  addEventListener('scroll', pedir, {passive: true});
  addEventListener('resize', pedir, {passive: true});
  aplicar();
  requestAnimationFrame(() => requestAnimationFrame(() => H.setAttribute('data-escena-anim', '')));
}

/* ---------- héroe: conteo de la cifra (el resto de la entrada es CSS) ---------- */
function conteo() {
  if (RM) return;
  const f = new Intl.NumberFormat('en-US');
  listo.then(() => {
    if (performance.now() > 2500) return;
    $$('[data-cuenta]').forEach((e) => {
      const n = +e.dataset.cuenta, t0 = performance.now() + 750;
      e.textContent = '0';
      const paso = (t) => {
        const k = lim((t - t0) / 800);
        e.textContent = f.format(Math.round(n * (1 - (1 - k) ** 3)));
        if (k < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  });
}

/* ---------- revelados ---------- */
function revelados() {
  // Los pasos de la escena fija ([data-visto]) los marca inicio.js uno a uno; apilados (móvil, tableta) se revelan aquí.
  const escena = !RM && innerWidth > 1100;
  const lista = $$(escena ? '[data-reveal]' : '[data-reveal],[data-visto]');
  if (!lista.length) return;
  if (RM || typeof IntersectionObserver === 'undefined') { lista.forEach((e) => e.classList.add('s-visto')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('s-visto'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -12% 0px', threshold: 0.1});
  lista.forEach((e) => io.observe(e));
}

/* ---------- párrafo que se ilumina por palabra ---------- */
function palabras() {
  $$('[data-palabras]').forEach((p) => {
    const s = $$('[data-i]', p);
    s.forEach((w) => { w.style.setProperty('--i', w.dataset.i); w.style.setProperty('--n', String(s.length)); });
    barrer(p, rangos.palabras);
  });
}

/* ---------- puestos (S7) y acordeón (S9) ---------- */
function puestos() {
  const sec = $('[data-puesto]');
  if (!sec) return;
  const tabs = $$('[data-puesto-n]', sec), paneles = $$('[data-puesto-panel]', sec), nombre = $('.s-capsula__nombre', sec);
  const sel = (n, foco) => {
    sec.dataset.puesto = n;
    tabs.forEach((t) => { const on = t.dataset.puestoN === String(n); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && foco) t.focus(); });
    paneles.forEach((p) => { p.hidden = p.dataset.puestoPanel !== String(n); });
    if (nombre && hecho) nombre.textContent = tabs[n - 1].textContent;
  };
  let hecho = false;
  listo.then(() => { hecho = true; sel(+sec.dataset.puesto || 1); });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => sel(i + 1));
    t.addEventListener('keydown', (e) => {
      const k = {ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1}[e.key];
      if (k === undefined) return;
      e.preventDefault();
      sel(((k + tabs.length) % tabs.length) + 1, true);
    });
  });
  sel(+sec.dataset.puesto || 1);
}

function acordeon() {
  $$('.s-acordeon__item').forEach((it) => {
    const b = $('.s-acordeon__boton', it);
    if (!b) return;
    b.setAttribute('aria-expanded', String(it.hasAttribute('data-abierto')));
    b.addEventListener('click', () => { const v = !it.hasAttribute('data-abierto'); it.toggleAttribute('data-abierto', v); b.setAttribute('aria-expanded', String(v)); });
  });
}

/* ---------- portada: inicio.js tras reposo (hilo, paso activo de la escena y latido del pie) ---------- */
function portada() {
  if (!DATOS.inicio || !$('[data-hilo]')) return;
  let hecho = false;
  const ir = async () => {
    if (hecho) return;
    hecho = true;
    try {
      await listo;
      const m = await import(DATOS.inicio);
      m.default({urls: DATOS, RM, NAT, motor: {tareas, despertar, barrer, rangos, lim}});
    } catch { /* la portada funciona sin inicio.js: póster, pasos apilados y estados finales */ }
  };
  const reposo = () => ('requestIdleCallback' in window ? requestIdleCallback(ir, {timeout: 2500}) : setTimeout(ir, 1200));
  if (D.readyState === 'complete') reposo(); else addEventListener('load', () => setTimeout(reposo, 200), {once: true});
  setTimeout(ir, 4000);
}

/* ---------- arranque: cada pieza aislada, un fallo no detiene a las demás ---------- */
for (const f of [cabecera, tema, conteo, revelados, palabras, puestos, acordeon, portada]) {
  try { f(); } catch { /* aislado */ }
}
