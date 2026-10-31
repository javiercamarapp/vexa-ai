#!/usr/bin/env node
// T49: la cabeza del hilo (posición que sale de la tabla de arco de inicio.js) cae sobre el trazo que dibuja el navegador. Compara, en 13 posiciones de scroll, el punto
// de la cabeza con base.getPointAtLength(arco dibujado). Tolerancia 1 px. Uso: node hilo-exactitud.mjs --url URL [--vp 1440,390] [--tolerancia 1]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';

/** Corre en la página: desviación entre la cabeza del hilo y el punto del trazo al arco dibujado. */
export function desviacionEnPagina() {
  const base = document.getElementById('s-hilo-d'), tr = document.querySelector('.s-hilo__trazo'), cab = document.querySelector('.s-hilo__cabeza');
  if (!base || !tr || !cab) return {error: 'sin trazo o cabeza'};
  const total = base.getTotalLength(), arco = total - parseFloat(tr.style.strokeDashoffset);
  const q = base.getPointAtLength(Math.max(0, Math.min(total, arco)));
  const x = parseFloat(cab.style.getPropertyValue('--x')), y = parseFloat(cab.style.getPropertyValue('--y'));
  return {d: Math.hypot(q.x - x, q.y - y)};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = a.url || process.env.ROVAQ_URL;
  if (!url) { console.error('Falta --url'); process.exit(2); }
  const tol = Number(a.tolerancia || 1);
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '390'])) {
    await conSesion({vp: Number(vp), esquema: 'dark', sinCandado: true, esperaCarga: false, etiqueta: 'hilo-exactitud'}, async (s) => {
      await s.page.goto(url, {waitUntil: 'load'});
      await dormir(3500);
      const alto = await s.page.evaluate(() => document.documentElement.scrollHeight);
      let peor = 0, n = 0, error = null;
      for (let y = 300; y < alto - 900; y += Math.round(alto / 14)) {
        await s.page.evaluate((q) => scrollTo({top: q, behavior: 'instant'}), y);
        await dormir(700);
        const r = await s.page.evaluate(`(${desviacionEnPagina.toString()})()`);
        if (r.error) { error = r.error; break; }
        peor = Math.max(peor, r.d); n++;
      }
      const ok = !error && peor <= tol;
      console.log(`${ok ? 'OK   ' : 'FALLA'} vp ${vp}: ${error || `${n} posiciones, desviación máxima ${peor.toFixed(3)} px (tolerancia ${tol})`}`);
      if (!ok) fallas++;
    });
  }
  process.exit(fallas ? 1 : 0);
}
