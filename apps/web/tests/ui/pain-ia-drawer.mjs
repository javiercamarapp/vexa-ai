// «Lectura de IA» del drawer de Puntos de dolor (L4): abre el drawer de un punto y mide choques DENTRO del drawer a 1440/768/390 (claro/oscuro) por cada variante de PAIN_IA.
//   Servidor: VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev --webpack -p 3290
//   VEXA_UI_BASE=http://localhost:3290 node tests/ui/pain-ia-drawer.mjs [--sizes=1440,768,390] [--themes=light,dark] [--variantes=vacio,completo,desacuerdo,parcial,tope,apagado] [--capturas=dir]
// Mide: desborde horizontal, texto < 12 px, hermanos que se solapan, botones sin nombre, que «Analizar» esté deshabilitado cuando corresponde y que no exista un botón «Actualizar».
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
const require = createRequire(process.env.VEXA_PW_PACKAGE ?? '/private/tmp/claude-501/vexa-pw/package.json');
const {chromium} = require('playwright-core');
const F = await import('./fixtures.mjs'); const {respond} = F;
const arg = (k, d) => (process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3)) ?? d;
const base = process.env.VEXA_UI_BASE ?? 'http://localhost:3290';
const sizes = arg('sizes', '1440,768,390').split(',').map(Number), themes = arg('themes', 'light,dark').split(','), variantes = arg('variantes', 'vacio,completo,desacuerdo,parcial,tope,apagado').split(',');
const capDir = arg('capturas', null); if (capDir) mkdirSync(capDir, {recursive: true});

function medir() {
  const d = document.querySelector('dialog[open], .drawer[open]'); const out = {sinDrawer: !d, desborde: [], pequeno: [], solapes: [], sinNombre: [], actualizar: [], analizar: null, secciones: 0};
  if (!d) return out;
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const desc = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '') + ' "' + (e.innerText || '').trim().slice(0, 28) + '"';
  const ia = d.querySelector('.pp-ia'); if (!ia) return {...out, sinIA: true};
  out.secciones = 1;
  const dr = d.getBoundingClientRect();
  for (const e of ia.querySelectorAll('*')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.right > dr.right + 1 || r.left < dr.left - 1) out.desborde.push(desc(e)); if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.children.length === 0 && e.clientWidth > 0) out.desborde.push('scroll ' + desc(e)); }
  for (const e of ia.querySelectorAll('*')) { if (!vis(e) || e.closest('svg')) continue; const t = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!t) continue; const px = parseFloat(getComputedStyle(e).fontSize); if (px < 12) out.pequeno.push(px + 'px ' + desc(e)); }
  for (const g of ia.querySelectorAll('.pp-ia-cab, .pp-ia-estado, .pp-ia-card header, .pp-ia-consenso-cab')) { const k = [...g.children].filter(vis); for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = k[i].getBoundingClientRect(), b = k[j].getBoundingClientRect(); if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.solapes.push(desc(k[i]) + ' x ' + desc(k[j])); } }
  for (const b of ia.querySelectorAll('button, a')) if (vis(b) && !(b.innerText || b.getAttribute('aria-label') || b.title || '').trim()) out.sinNombre.push(desc(b));
  for (const b of d.querySelectorAll('button')) if (/actualizar/i.test(b.innerText || '')) out.actualizar.push(desc(b));
  const a = [...ia.querySelectorAll('button')].find(b => /analizar|completar/i.test(b.innerText)); out.analizar = a ? {deshabilitado: a.disabled, texto: a.innerText.trim()} : null;
  return out;
}

const browser = await chromium.launch(); const filas = []; let fallas = 0;
for (const variante of variantes) for (const theme of themes) for (const w of sizes) {
  const ctx = await browser.newContext({viewport: {width: w, height: w < 500 ? 812 : 900}, reducedMotion: 'reduce'});
  await ctx.addInitScript(t => { try { localStorage.setItem('vexa-theme', t); } catch {} }, theme);
  await ctx.route('**/api/**', async route => { const q = route.request(); const u = new URL(q.url()); const ia = /\/ia$/.test(u.pathname);
    if (ia) { process.env.PAIN_IA = variante === 'vacio' ? '' : variante; }
    const h = await respond(q.url(), q.method(), q.postData()); return h ? route.fulfill({status: h[0], contentType: 'application/json', body: JSON.stringify(h[1])}) : route.continue(); });
  const page = await ctx.newPage(); let m;
  try {
    await page.goto(base + '/pain-points', {waitUntil: 'networkidle', timeout: 120000});
    await page.locator('.pp-tabla .row-link-inline').first().click(); await page.locator('.pp-ia').waitFor({timeout: 20000}); await page.waitForTimeout(500);
    m = await page.evaluate(medir);
    if (variante === 'vacio' && theme === 'light') { // «Analizar» corre y pinta las tres tarjetas
      const btn = page.locator('.pp-ia button', {hasText: 'Analizar'}); if (await btn.count()) { process.env.PAIN_IA = 'completo'; await btn.click(); await page.locator('.pp-ia-card[data-rol=accion] .pp-ia-prop').waitFor({timeout: 8000}); m.tras = await page.evaluate(medir); }
    }
    if (capDir) { await page.evaluate(() => document.querySelector('.pp-ia').scrollIntoView({block: 'start'})); await page.waitForTimeout(150); await page.screenshot({path: join(capDir, `ia-${variante}-${theme}-${w}.png`)}); }
  } catch (e) { m = {error: String(e.message).slice(0, 120), desborde: [], pequeno: [], solapes: [], sinNombre: [], actualizar: []}; }
  const nAnalizar = variante === 'apagado' || variante === 'tope' ? (m.analizar && !m.analizar.deshabilitado ? 1 : m.analizar ? 0 : 1) : (m.analizar && m.analizar.deshabilitado ? 1 : 0);
  const n = (m.error ? 1 : 0) + (m.sinDrawer ? 1 : 0) + (m.sinIA ? 1 : 0) + m.desborde.length + m.pequeno.length + m.solapes.length + m.sinNombre.length + m.actualizar.length + nAnalizar + ((m.tras?.desborde?.length ?? 0) + (m.tras?.pequeno?.length ?? 0) + (m.tras?.solapes?.length ?? 0));
  fallas += n; filas.push({variante, tema: theme, ancho: w, desborde: m.desborde.length, pequeno: m.pequeno.length, solapes: m.solapes.length, sinNombre: m.sinNombre.length, actualizar: m.actualizar.length, analizar: JSON.stringify(m.analizar), error: m.error ?? ''});
  if (n && process.argv.includes('--detalle')) console.log('--', variante, theme, w, JSON.stringify({d: m.desborde.slice(0, 4), p: m.pequeno.slice(0, 4), s: m.solapes.slice(0, 3), a: m.analizar, e: m.error, t: m.tras}));
  await ctx.close();
}
await browser.close();
console.table(filas.filter(f => f.desborde || f.pequeno || f.solapes || f.sinNombre || f.actualizar || f.error));
console.log(`${filas.length} combinaciones, ${fallas} hallazgos`);
process.exit(fallas ? 1 : 0);
