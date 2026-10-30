#!/usr/bin/env node
// Prueba del cruce del tema global (T16): en cada cambio oscuro/claro de la portada, hacia abajo y hacia arriba, muestrea CADA cuadro (requestAnimationFrame)
// el contraste WCAG entre el texto y su fondo mientras cambia el tema. Sondas: texto principal (--s-tinta) y texto atenuado (--s-apagado) sobre el fondo
// de la página, el mismo texto sobre una tarjeta (--s-superficie), el par texto/fondo de un botón primario, y los primeros titulares y párrafos reales
// de la ventana. Sale con 1 si en algún cuadro el contraste baja del mínimo (3:1; el juez T15b midió 1.52:1 a los 260 ms con la transición lineal).
// Uso: node tema-cruce.mjs --url http://127.0.0.1:PUERTO/ [--vp 1440,390] [--minimo 3]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';

export const MINIMO = 3;

/** Luminancia relativa WCAG de [r, g, b] (0 a 255). */
export const luminancia = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Analiza el cruce: muestras = [{t, sondas: {nombre: contraste}}]; devuelve el mínimo por sonda y las que fallan. */
export function evaluar(muestras, minimo = MINIMO) {
  const peor = {};
  for (const m of muestras) for (const [k, v] of Object.entries(m.sondas)) if (!peor[k] || v < peor[k].c) peor[k] = {c: v, t: m.t};
  const fallas = Object.entries(peor).filter(([, v]) => v.c < minimo).map(([k, v]) => `${k}: ${v.c.toFixed(2)}:1 a ${Math.round(v.t)} ms`);
  return {peor, fallas, cuadros: muestras.length};
}

/** Corre dentro de la página: instala las sondas y devuelve una función que muestrea durante ms. */
export function muestrearEnPagina(ms) {
  const parse = (c) => {
    const m = c.match(/-?[\d.]+/g);
    if (!m) return null;
    if (c.startsWith('color(')) return [0, 1, 2].map((i) => Math.round(parseFloat(m[i]) * 255));
    return [0, 1, 2].map((i) => parseFloat(m[i]));
  };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const con = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const caja = document.createElement('div');
  caja.setAttribute('aria-hidden', 'true');
  caja.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;z-index:-1';
  caja.innerHTML = '<span id="__t" style="color:var(--s-tinta)">x</span><span id="__a" style="color:var(--s-apagado)">x</span>' +
    '<div id="__s" style="background:var(--s-superficie)"><span id="__st" style="color:var(--s-tinta)">x</span><span id="__sa" style="color:var(--s-apagado)">x</span></div>' +
    '<span id="__b" style="background:var(--s-boton-fondo);color:var(--s-boton-texto)">x</span>';
  document.body.appendChild(caja);
  const q = (id) => caja.querySelector(id);
  const bgDe = (e) => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(\s*0,\s*0,\s*0,\s*0\)|transparent/.test(c)) return parse(c); } return [255, 255, 255]; };
  const reales = [...document.querySelectorAll('h2, .s-lead, .s-columna__texto, .s-paso__texto p')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; }).slice(0, 4);
  return new Promise((res) => {
    const out = [], t0 = performance.now();
    const paso = (t) => {
      const fondo = parse(getComputedStyle(document.body).backgroundColor) || bgDe(document.body);
      const s = {};
      const col = (e) => parse(getComputedStyle(e).color);
      s['texto principal / fondo'] = con(col(q('#__t')), fondo);
      s['texto atenuado / fondo'] = con(col(q('#__a')), fondo);
      const sup = parse(getComputedStyle(q('#__s')).backgroundColor);
      s['texto principal / tarjeta'] = con(col(q('#__st')), sup);
      s['texto atenuado / tarjeta'] = con(col(q('#__sa')), sup);
      s['botón: texto / fondo'] = con(col(q('#__b')), parse(getComputedStyle(q('#__b')).backgroundColor));
      reales.forEach((e, i) => { s[`real ${i + 1} (${e.tagName.toLowerCase()}) / fondo`] = con(col(e), bgDe(e)); });
      out.push({t: t - t0, sondas: s});
      if (t - t0 < ms) requestAnimationFrame(paso); else { caja.remove(); res(out); }
    };
    requestAnimationFrame(paso);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = a.url || process.env.ROVAQ_URL;
  const minimo = Number(a.minimo || MINIMO);
  if (!url) { console.error('Falta --url'); process.exit(2); }
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440'])) {
    await conSesion({vp: Number(vp), esquema: 'dark', sinCandado: true, esperaCarga: false, etiqueta: 'tema-cruce'}, async (s) => {
      await s.page.goto(url, {waitUntil: 'load'});
      await dormir(2500);
      // Cruces: cada sección cuyo data-tema difiere del de la anterior
      const cruces = await s.page.evaluate(() => {
        const secs = [...document.querySelectorAll('section[data-tema], footer[data-tema]')];
        return secs.flatMap((e, i) => (i && e.dataset.tema !== secs[i - 1].dataset.tema ? [{id: e.id || 'pie', top: Math.round(e.getBoundingClientRect().top + scrollY), a: secs[i - 1].dataset.tema, b: e.dataset.tema}] : []));
      });
      const vh = s.viewport.height;
      let peorGlobal = Infinity;
      for (const c of cruces) for (const dir of ['abajo', 'arriba']) {
        const linea = dir === 'abajo' ? 0.42 : 0.58;
        const antes = c.top - linea * vh - 60, despues = c.top - linea * vh + 60;
        await s.page.evaluate((y) => scrollTo({top: y, behavior: 'instant'}), dir === 'abajo' ? antes : despues);
        await dormir(1500);
        const prom = s.page.evaluate(`(${muestrearEnPagina.toString()})(1400)`);
        await dormir(120);
        await s.page.evaluate((y) => scrollTo({top: y, behavior: 'instant'}), dir === 'abajo' ? despues : antes);
        const r = evaluar(await prom, minimo);
        const min = Math.min(...Object.values(r.peor).map((v) => v.c));
        peorGlobal = Math.min(peorGlobal, min);
        console.log(`${r.fallas.length ? 'FALLA' : 'OK   '} vp ${vp} ${dir} hacia ${c.b} en #${c.id}: mínimo ${min.toFixed(2)}:1 en ${r.cuadros} cuadros${r.fallas.length ? ' · ' + r.fallas.join(' | ') : ''}`);
        fallas += r.fallas.length;
      }
      console.log(`RESUMEN vp ${vp}: ${cruces.length} cambios de tema, contraste mínimo en todos los cruces ${Number.isFinite(peorGlobal) ? peorGlobal.toFixed(2) : 'n/d'}:1 (exigido ${minimo}:1)`);
    });
  }
  process.exit(fallas ? 1 : 0);
}
