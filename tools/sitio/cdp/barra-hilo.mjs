#!/usr/bin/env node
// T49: el hilo serpenteante no puede pasar por debajo de la barra de navegación ni rozarla.
// hilo-carril.mjs mide el hilo contra el contenido y deja fuera la barra (.s-cabecera) porque es fija; aquí se mide contra ella, con píxeles.
// Método: en cada posición de scroll en la que el trazo (o una nota o un nodo) cae en la franja de la barra se toma la franja superior de la pantalla
// (de 0 hasta el borde inferior de la barra más AIRE px) con el hilo visible y otra vez con el hilo oculto. Si los dos recortes difieren en un solo
// píxel, el hilo se ve dentro de la barra (la píldora de vidrio lo trasluce) o pegado a su borde. Es una medida de lo que ve la persona, no de la geometría.
// Uso: node barra-hilo.mjs --url http://127.0.0.1:PUERTO/ [--vp 1440,768,390] [--max 14] [--aire 10] [--tolerancia 0]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';
import {decodificarPng} from './png.mjs';

export const AIRE_MIN = 10; // px bajo la barra en los que el hilo no puede verse
export const UMBRAL_CANAL = 6; // diferencia por canal (0 a 255) a partir de la cual un píxel cuenta como distinto

/** Cuenta los píxeles que difieren entre dos PNG del mismo tamaño. */
export function pixelesDistintos(pngA, pngB, umbral = UMBRAL_CANAL) {
  const a = decodificarPng(pngA), b = decodificarPng(pngB);
  if (a.ancho !== b.ancho || a.alto !== b.alto) throw new Error(`recortes de distinto tamaño ${a.ancho}x${a.alto} y ${b.ancho}x${b.alto}`);
  let n = 0;
  for (let i = 0; i < a.datos.length; i += a.canales) {
    for (let c = 0; c < Math.min(3, a.canales); c++) if (Math.abs(a.datos[i + c] - b.datos[i + c]) > umbral) { n++; break; }
  }
  return n;
}

/** Elige hasta `max` posiciones repartidas de una lista ordenada (conserva la primera y la última). */
export function repartir(posiciones, max) {
  if (posiciones.length <= max) return posiciones;
  const o = [];
  for (let i = 0; i < max; i++) o.push(posiciones[Math.round((i * (posiciones.length - 1)) / (max - 1))]);
  return [...new Set(o)];
}

/** Corre en la página: posiciones de scroll (múltiplos de `paso`) en las que algo del hilo cae en la franja [0, bajoBarra + 40], y el borde inferior de la barra. */
export function candidatasEnPagina(paso) {
  const barra = document.querySelector('.s-cabecera__barra');
  const base = document.getElementById('s-hilo-d');
  const zona = document.querySelector('.s-hilo-zona');
  if (!barra || !base || !zona) return {error: 'sin barra, trazo o zona del hilo'};
  const alto = document.documentElement.scrollHeight;
  const vh = innerHeight;
  // El borde inferior de la barra ya compacta: la barra pasa de 66 a 82 px al pasar los 60 px de scroll
  scrollTo({top: 200, behavior: 'instant'});
  return new Promise((res) => setTimeout(() => {
    const bajo = barra.getBoundingClientRect().bottom;
    const z = zona.getBoundingClientRect();
    const zy = z.top + scrollY; // y de la zona en el documento (estable: se resta el scroll actual)
    const L = base.getTotalLength();
    const pts = [];
    for (let s = 0; s <= L; s += 6) pts.push(zy + base.getPointAtLength(s).y);
    document.querySelectorAll('.s-hilo__nota, .s-hilo__nodo').forEach((e) => { const r = e.getBoundingClientRect(); pts.push(r.top + scrollY, r.bottom + scrollY); });
    const ys = [];
    for (let y = 0; y <= alto - vh; y += paso) {
      if (pts.some((p) => p - y > -12 && p - y < bajo + 60)) ys.push(y);
    }
    res({bajo: Math.round(bajo * 10) / 10, ys, alto, vh});
  }, 900));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = a.url || process.env.ROVAQ_URL;
  if (!url) { console.error('Falta --url'); process.exit(2); }
  const aire = Number(a.aire || AIRE_MIN);
  const tolerancia = Number(a.tolerancia || 0);
  const max = Number(a.max || 14);
  const esquema = a.esquema || 'dark';
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '768', '390'])) {
    await conSesion({vp: Number(vp), esquema, sinCandado: true, esperaCarga: false, etiqueta: 'barra-hilo'}, async (s) => {
      await s.page.goto(url, {waitUntil: 'load'});
      await dormir(3000);
      const alto = await s.page.evaluate(() => document.documentElement.scrollHeight);
      // Recorre la página una vez para que el hilo se dibuje y las notas aparezcan
      for (let y = 0; y < alto; y += Math.round(s.viewport.height * 0.7)) { await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y); await dormir(90); }
      const c = await s.page.evaluate(`(${candidatasEnPagina.toString()})(${Number(a.paso || 60)})`);
      if (c.error) { console.log('FALLA', vp, c.error); fallas++; return; }
      const ys = repartir(c.ys, max);
      let peor = {y: null, n: 0};
      const detalle = [];
      for (const y of ys) {
        await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y);
        await dormir(900);
        const clip = {x: 0, y: 0, width: s.viewport.width, height: Math.ceil(c.bajo + aire)};
        const con = await s.page.screenshot({clip, type: 'png', animations: 'disabled'});
        await s.page.addStyleTag({content: '.s-hilo-zona > [data-hilo] { visibility: hidden !important; }'}).then(async (h) => {
          await dormir(150);
          const sin = await s.page.screenshot({clip, type: 'png', animations: 'disabled'});
          const n = pixelesDistintos(con, sin);
          detalle.push([y, n]);
          if (n > peor.n) peor = {y, n};
          await h.evaluate((e) => e.remove());
        });
      }
      const ok = peor.n <= tolerancia;
      console.log(`${ok ? 'OK   ' : 'FALLA'} vp ${vp}: ${ys.length} posiciones de ${c.ys.length} candidatas (barra hasta ${c.bajo} px, aire ${aire} px); peor y ${peor.y}: ${peor.n} píxeles del hilo dentro de la franja de la barra (tolerancia ${tolerancia})${ok ? '' : ' · ' + JSON.stringify(detalle.filter(([, n]) => n > tolerancia).slice(0, 8))}`);
      if (!ok) fallas++;
    });
  }
  process.exit(fallas ? 1 : 0);
}
