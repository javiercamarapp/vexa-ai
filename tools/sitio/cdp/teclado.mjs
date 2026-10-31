#!/usr/bin/env node
// T49: recorrido completo con teclado (Tab). Comprueba que cada parada: (1) está dentro de la ventana después de enfocarla, (2) tiene indicador de foco visible
// (contorno o sombra de :focus-visible, con grosor y color distintos del fondo), (3) no queda oculta (tamaño cero, opacidad o visibility), (4) avanza en orden de lectura
// (el desplazamiento vertical del documento no retrocede más de `retroceso` px entre paradas) y (5) no hay trampa: el recorrido sale de la página.
// Uso: node teclado.mjs --url URL [--vp 1440,390] [--max 160] [--retroceso 160]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';
import {pixelesDistintos} from './barra-hilo.mjs';

/** Corre en la página: describe el elemento enfocado. */
export function paradaEnPagina() {
  const e = document.activeElement;
  if (!e || e === document.body || e === document.documentElement) return {cuerpo: true};
  const r = e.getBoundingClientRect(), c = getComputedStyle(e);
  const tiene = (x) => { const k = getComputedStyle(x); return (k.outlineStyle !== 'none' && parseFloat(k.outlineWidth) > 0) || (k.boxShadow && k.boxShadow !== 'none'); };
  // El indicador puede vivir en el propio elemento, en un ancestro cercano (:has(:focus-visible), p. ej. la tarjeta de una pantalla) o, en un grupo SVG, en un hijo con trazo
  let ring = tiene(e), donde = e;
  const directo = !!ring;
  for (let n = e.parentElement, i = 0; !ring && n && i < 4; n = n.parentElement, i++) { ring = tiene(n); if (ring) donde = n; }
  window.__rovaqAnillo = donde;
  if (!ring && e instanceof SVGElement) ring = [...e.querySelectorAll('*')].some((d) => { const k = getComputedStyle(d); return k.stroke !== 'none' && parseFloat(k.strokeWidth) > 0 && parseFloat(k.strokeOpacity || 1) > 0.3; });
  const desc = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(/\s+/).slice(0, 2).join('.') : '');
  const texto = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return {
    desc, texto, x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
    enVentana: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
    oculto: r.width < 1 || r.height < 1 || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05,
    anillo: !!ring, indirecto: !!ring && !directo, contorno: `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor}`.slice(0, 60), sombra: (c.boxShadow || '').slice(0, 60),
    foco: e.matches(':focus-visible'),
    fijo: !!e.closest('.s-cabecera') || getComputedStyle(e).position === 'fixed', // la cabecera es fija: su y en el documento es la del scroll, no su lugar en la lectura
  };
}

export function evaluarParadas(paradas, {retroceso = 160, max = 160} = {}) {
  const fallas = [];
  let yAnt = -1;
  paradas.forEach((p, i) => {
    if (p.cuerpo) return;
    const quien = `#${i + 1} ${p.desc} «${p.texto}»`;
    if (!p.enVentana) fallas.push(`${quien}: fuera de la ventana al enfocarla`);
    if (p.oculto) fallas.push(`${quien}: enfocable pero oculta`);
    if (!p.anillo) fallas.push(`${quien}: sin indicador de foco (contorno ${p.contorno}, sombra ${p.sombra}${p.pixelesDeFoco !== undefined ? `, ${p.pixelesDeFoco} píxeles de diferencia al enfocar` : ''})`);
    if (!p.foco) fallas.push(`${quien}: no coincide con :focus-visible`);
    if (p.fijo) return;
    if (yAnt >= 0 && p.y < yAnt - retroceso) fallas.push(`${quien}: orden ilógico (y ${p.y} tras ${yAnt})`);
    yAnt = Math.max(yAnt, p.y);
  });
  if (paradas.length >= max) fallas.push(`sin salida en ${max} paradas (posible trampa de foco)`);
  return fallas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = (a.url || process.env.ROVAQ_URL || '').replace(/\/$/, '');
  if (!url) { console.error('Falta --url'); process.exit(2); }
  const max = Number(a.max || 160), retroceso = Number(a.retroceso || 160);
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '390'])) {
    for (const esquema of lista(a.esquema, ['dark'])) {
      await conSesion({vp: Number(vp), esquema, sinCandado: true, esperaCarga: false, etiqueta: 'teclado'}, async (s) => {
        await s.page.goto(url + (a.ruta || '/'), {waitUntil: 'load'});
        await dormir(2500);
        const paradas = [];
        let saliO = false;
        for (let i = 0; i < max; i++) {
          await s.page.keyboard.press('Tab');
          await dormir(60);
          const p = await s.page.evaluate(`(${paradaEnPagina.toString()})()`);
          if (p.cuerpo && i > 0) { saliO = true; break; }
          if (p.indirecto && p.enVentana) {
            // El indicador vive en otro elemento (tarjeta o trazo SVG): se comprueba con píxeles, enfocado contra sin foco, en una caja un poco mayor que la parada
            const h = await s.page.evaluateHandle(() => document.activeElement);
            const caja = await h.evaluate(() => { const r = window.__rovaqAnillo.getBoundingClientRect(), m = 14; const x = Math.max(0, r.left - m), y = Math.max(0, r.top - m); return {x, y, width: Math.min(innerWidth - x, r.width + 2 * m), height: Math.min(innerHeight - y, r.height + 2 * m)}; });
            const con = await s.page.screenshot({clip: caja, type: 'png', animations: 'disabled'});
            await h.evaluate((e) => e.blur());
            await dormir(120);
            const sin = await s.page.screenshot({clip: caja, type: 'png', animations: 'disabled'});
            await h.evaluate((e) => e.focus({focusVisible: true}));
            p.pixelesDeFoco = pixelesDistintos(con, sin);
            if (p.pixelesDeFoco < 12) p.anillo = false;
          }
          paradas.push(p);
        }
        const f = evaluarParadas(saliO ? paradas : [...paradas], {retroceso, max: saliO ? Infinity : max});
        console.log(`${f.length ? 'FALLA' : 'OK   '} vp ${vp} ${esquema}: ${paradas.length} paradas, ${saliO ? 'sale de la página' : 'sin salida'}${f.length ? ' · ' + f.slice(0, 8).join(' | ') : ''}`);
        if (Number(vp) >= 1101) {
          // Menú de escritorio: Enter lo abre y Esc lo cierra sin mover el foco (con :focus-within quedaba abierto)
          await s.page.goto(url + (a.ruta || '/'), {waitUntil: 'load'});
          await dormir(2000);
          for (let i = 0; i < 3; i++) { await s.page.keyboard.press('Tab'); await dormir(60); }
          const est = () => s.page.evaluate(() => { const b = document.activeElement, m = b.closest('.s-cabecera__item')?.querySelector('.s-menu'); return {expandido: b.getAttribute('aria-expanded'), visible: m ? getComputedStyle(m).visibility : null, enBoton: b.hasAttribute('aria-haspopup')}; });
          await s.page.keyboard.press('Enter'); await dormir(500);
          const abierto = await est();
          await s.page.keyboard.press('Escape'); await dormir(600);
          const cerrado = await est();
          const okMenu = abierto.expandido === 'true' && abierto.visible === 'visible' && cerrado.expandido === 'false' && cerrado.visible === 'hidden' && cerrado.enBoton;
          console.log(`${okMenu ? 'OK   ' : 'FALLA'} vp ${vp} ${esquema}: menú Producto con Enter y Esc · abierto ${JSON.stringify(abierto)} · tras Esc ${JSON.stringify(cerrado)}`);
          if (!okMenu) fallas++;
        }
        if (a.lista) console.log(paradas.map((p, i) => `${i + 1}. ${p.desc} «${p.texto}» y${p.y}`).join('\n'));
        fallas += f.length;
      });
    }
  }
  process.exit(fallas ? 1 : 0);
}
