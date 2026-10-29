// Sesión de Chrome por CDP: candado, medición previa, emulaciones y colectores.
// Un solo proceso de Chrome a la vez: toda herramienta abre el navegador con abrir().
import { CHROME, VIEWPORTS, ARGS_GPU, ARGS_SIN_WEBGL, ARGS_CUADROS, RED_SLOW_4G } from './config.mjs';
import { cargarPlaywright } from './playwright.mjs';
import { adquirir } from './candado.mjs';
import { esperarCargaBaja } from './carga-mac.mjs';

// Se inyecta antes de cualquier script de la página. Cero dependencias, sin eval en la página.
const INIT_SCRIPT = `(() => {
  try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => true, configurable: true }); } catch (e) {}
  const m = (window.__rovaq = { lcp: null, cls: 0, clsEntradas: [], largas: [], csp: [] });
  const descr = (el) => {
    if (!el) return null;
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList && el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
    return s;
  };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.lcp = { t: e.startTime, tamano: e.size, url: e.url || null, elemento: descr(e.element), etiqueta: e.element ? e.element.tagName : null };
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) { m.cls += e.value; m.clsEntradas.push({ t: e.startTime, v: e.value }); }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) m.largas.push({ t: e.startTime, d: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
  document.addEventListener('securitypolicyviolation', (e) => {
    m.csp.push({ directiva: e.violatedDirective, bloqueado: e.blockedURI, fuente: e.sourceFile || null, linea: e.lineNumber, muestra: e.sample || null, disposicion: e.disposition });
  });
})();`;

export function resolverViewport(vp) {
  const v = VIEWPORTS[String(vp)];
  if (!v) throw new Error(`Viewport desconocido ${vp}; usa ${Object.keys(VIEWPORTS).join(', ')}`);
  return v;
}

// opciones: { vp, esquema: 'light'|'dark', movimiento: 'reduce'|'no-preference', webgl: bool,
//   cpu: 1|4, red: 'slow4g'|null, saveData: bool, js: bool, sinCandado: bool, esperaCarga: bool }
export async function abrir(opc = {}) {
  const o = { vp: 1440, esquema: 'light', movimiento: 'no-preference', webgl: true, cpu: 1, red: null, saveData: false, js: true, ...opc };
  const vp = resolverViewport(o.vp);
  const candado = o.sinCandado ? { liberar() {} } : await adquirir({ etiqueta: o.etiqueta || 'sesion' });
  let carga = null;
  try {
    if (o.esperaCarga !== false) carga = await esperarCargaBaja();
    const { chromium } = cargarPlaywright();
    const browser = await chromium.launch({
      executablePath: CHROME,
      headless: true,
      args: [...(o.webgl ? ARGS_GPU : ARGS_SIN_WEBGL), ...ARGS_CUADROS, ...(process.env.ROVAQ_CHROME_ARGS ? process.env.ROVAQ_CHROME_ARGS.split(' ') : [])],
    });
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      colorScheme: o.esquema,
      reducedMotion: o.movimiento,
      javaScriptEnabled: o.js,
      hasTouch: vp.movil,
      extraHTTPHeaders: o.saveData ? { 'Save-Data': 'on' } : undefined,
    });
    await ctx.addInitScript(INIT_SCRIPT);
    const page = await ctx.newPage();
    const registro = { consola: [], errores: [], peticiones: [], respuestas: [] };
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) registro.consola.push({ tipo: m.type(), texto: m.text().slice(0, 300) });
    });
    page.on('pageerror', (e) => registro.errores.push(String(e).slice(0, 300)));
    page.on('request', (r) => registro.peticiones.push(r.url()));
    page.on('response', (r) => registro.respuestas.push(r));
    const cdp = await ctx.newCDPSession(page);
    if (o.cpu && o.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
    if (o.red === 'slow4g') {
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', RED_SLOW_4G);
    }
    let cerrado = false;
    const cerrar = async () => {
      if (cerrado) return;
      cerrado = true;
      try {
        await browser.close();
      } finally {
        candado.liberar();
      }
    };
    return { browser, ctx, page, cdp, registro, opciones: o, viewport: vp, carga, cerrar };
  } catch (e) {
    candado.liberar();
    throw e;
  }
}

// Ejecuta fn(sesion) y siempre cierra Chrome y suelta el candado.
export async function conSesion(opc, fn) {
  const s = await abrir(opc);
  try {
    return await fn(s);
  } finally {
    await s.cerrar();
  }
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Origen externo = cualquier petición cuyo origen no sea el de la página (data: y blob: no cuentan).
export function origenesExternos(peticiones, urlBase) {
  const base = new URL(urlBase).origin;
  const ext = new Set();
  for (const u of peticiones) {
    if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) continue;
    try {
      const o = new URL(u).origin;
      if (o !== base) ext.add(o);
    } catch {
      /* url rara */
    }
  }
  return [...ext];
}

// Posiciones de scroll: cada 60 por ciento del viewport más las secciones por data-seccion.
export async function posicionesDeScroll(page, vpAlto, { paso = 0.6 } = {}) {
  return page.evaluate(
    ([alto, p]) => {
      const total = document.documentElement.scrollHeight;
      const max = Math.max(0, total - alto);
      const pos = [];
      for (let y = 0; y <= max; y += alto * p) pos.push({ nombre: 'y' + String(Math.round(y)).padStart(5, '0'), y: Math.round(y) });
      if (!pos.length || pos[pos.length - 1].y < max) pos.push({ nombre: 'fin', y: Math.round(max) });
      const secs = document.querySelectorAll('[data-seccion], section[data-tema], main > section[id]');
      const vistos = new Set();
      secs.forEach((el, i) => {
        const clave = el.getAttribute('data-seccion') || el.id || 's' + (i + 1);
        if (vistos.has(clave)) return;
        vistos.add(clave);
        const y = Math.max(0, Math.min(max, Math.round(el.getBoundingClientRect().top + scrollY)));
        pos.push({ nombre: 'sec-' + clave, y, seccion: clave });
      });
      return pos.sort((a, b) => a.y - b.y || a.nombre.localeCompare(b.nombre));
    },
    [vpAlto, paso],
  );
}
