#!/usr/bin/env node
// T49: el sitio sin JavaScript en un navegador real. JavaScript apagado en el contexto de Chrome; se recorre la portada y se comprueba que (1) todo el texto
// de la página tiene caja visible (nada a opacidad 0, oculto por una animación que nunca corre ni colapsado), salvo lo que el diseño oculta a propósito
// (texto solo para lector, menús desplegables y panel móvil, que sin JavaScript no se abren y se cubren con el pie y los botones; panel de un <details> cerrado; saltar al contenido), (2) las imágenes cargaron, (3) no hay desborde horizontal,
// (4) todos los enlaces internos y de anclas responden y apuntan a algo que existe. Uso: node sin-js.mjs --url URL [--vp 1440,390] [--ruta /] [--capturas DIR]
import {leerArgs, lista} from './args.mjs';
import {conSesion, dormir} from './navegador.mjs';

/** Corre en la página: texto que existe en el DOM pero no se ve, y estado de las imágenes. */
export function inspeccionarEnPagina() {
  const ocultos = [];
  const excluido = (e) => e.closest('.s-menu, .s-panel-movil, .s-cabecera__nav, .s-cabecera__burger, .s-solo-lector, .s-saltar, script, style, noscript, template, [hidden], [role="tabpanel"][hidden], svg, details:not([open]) > :not(summary)');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.trim();
    const e = n.parentElement;
    if (!t || !e || vistos.has(e) || excluido(e)) continue;
    vistos.add(e);
    const ok = e.checkVisibility({contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true});
    const r = e.getBoundingClientRect();
    if (ok && r.width >= 1 && r.height >= 1) continue;
    // Causa: display none es una decisión de diseño (numerales y selector de idioma que el móvil no muestra); opacidad, visibility o un contenedor colapsado
    // son estados de animación que sin JavaScript nunca se levantan: esos fallan
    let causa = 'colapsado';
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === 'none') { causa = 'display'; break; }
      if (parseFloat(c.opacity) < 0.05) { causa = 'opacidad'; break; }
      if (c.visibility === 'hidden') { causa = 'visibility'; break; }
    }
    ocultos.push({el: e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0], texto: t.slice(0, 50), causa});
  }
  const imgs = [...document.images].filter((i) => i.checkVisibility()).map((i) => ({src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0}));
  const enlaces = [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))];
  const anclas = enlaces.filter((h) => h.startsWith('#') && h.length > 1).filter((h) => !document.getElementById(h.slice(1)));
  return {ocultos, imgs, enlaces, anclasRotas: anclas, dataJs: document.documentElement.hasAttribute('data-js'), ancho: [document.documentElement.scrollWidth, innerWidth]};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = leerArgs();
  const url = (a.url || process.env.ROVAQ_URL || '').replace(/\/$/, '');
  if (!url) { console.error('Falta --url'); process.exit(2); }
  let fallas = 0;
  for (const vp of lista(a.vp, ['1440', '390'])) {
    for (const esquema of lista(a.esquema, ['dark'])) {
      await conSesion({vp: Number(vp), esquema, js: false, sinCandado: true, esperaCarga: false, etiqueta: 'sin-js'}, async (s) => {
        await s.page.goto(url + (a.ruta || '/'), {waitUntil: 'load'});
        await dormir(2000);
        const alto = await s.page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < alto; y += Math.round(s.viewport.height * 0.7)) { await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y); await dormir(100); }
        await dormir(800);
        const r = await s.page.evaluate(`(${inspeccionarEnPagina.toString()})()`);
        // Enlaces internos: cada ruta única responde sin error
        const internos = [...new Set(r.enlaces.filter((h) => h.startsWith('/') && !h.startsWith('//')).map((h) => h.split('#')[0] || '/'))];
        const malos = [];
        for (const h of internos) {
          try { const resp = await s.page.request.get(new URL(h, url + '/').href, {maxRedirects: 5, failOnStatusCode: false}); if (resp.status() >= 400) malos.push(`${h} ${resp.status()}`); } catch (e) { malos.push(`${h} ${String(e).slice(0, 40)}`); }
        }
        const sinCargar = r.imgs.filter((i) => !i.ok);
        const problemas = [];
        if (r.dataJs) problemas.push('html[data-js] presente con JavaScript apagado');
        const porEstado = r.ocultos.filter((o) => o.causa !== 'display');
        const porDiseno = r.ocultos.filter((o) => o.causa === 'display');
        if (porEstado.length) problemas.push(`${porEstado.length} textos sin caja visible por estado (opacidad, visibility o colapsado): ${JSON.stringify(porEstado.slice(0, 6))}`);
        if (a.detalle) console.log(`   ocultos por display none (diseño): ${porDiseno.map((o) => o.el + '«' + o.texto + '»').join(', ')}`);
        if (sinCargar.length) problemas.push(`${sinCargar.length} imágenes sin cargar: ${JSON.stringify(sinCargar.slice(0, 4))}`);
        if (r.ancho[0] !== r.ancho[1]) problemas.push(`desborde horizontal ${r.ancho[0]} contra ${r.ancho[1]}`);
        if (r.anclasRotas.length) problemas.push(`anclas sin destino: ${r.anclasRotas.join(', ')}`);
        if (malos.length) problemas.push(`enlaces internos con error: ${malos.slice(0, 6).join(', ')}`);
        console.log(`${problemas.length ? 'FALLA' : 'OK   '} vp ${vp} ${esquema} sin JS: ${r.imgs.length} imágenes visibles, ${internos.length} rutas internas, ${r.enlaces.length} enlaces${problemas.length ? ' · ' + problemas.join(' · ') : ''}`);
        if (a.capturas) {
          const {mkdirSync} = await import('node:fs');
          mkdirSync(a.capturas, {recursive: true});
          let i = 0;
          for (let y = 0; y < alto; y += s.viewport.height * 2) { await s.page.evaluate((yy) => scrollTo({top: yy, behavior: 'instant'}), y); await dormir(250); await s.page.screenshot({path: `${a.capturas}/sinjs-${vp}-${esquema}-${String(i++).padStart(2, '0')}.png`}); }
        }
        fallas += problemas.length;
      });
    }
  }
  process.exit(fallas ? 1 : 0);
}
