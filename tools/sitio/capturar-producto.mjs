#!/usr/bin/env node
// Capturas REALES del producto para la landing: `next dev` con VEXA_UI_FIXTURES=1 + el fixture único apps/web/tests/ui/fixture-landing.mjs interceptado por Playwright.
// Sin base de datos, sin Supabase, sin datos de cliente. Un solo proceso pesado: el servidor dev ya debe estar corriendo (ver CAPTURAS-REPORTE.md).
//
// Uso: BASE=http://localhost:3822 OUT=<dir> node tools/sitio/capturar-producto.mjs [hoy,fuga,problemas,caso,preguntale,cco,conexiones] [--temas claro,oscuro] [--recortes]
// Salida: <OUT>/<pantalla>-<tema>-1440@2x.png (2880x1800) y, con --recortes, <OUT>/recortes/*.png y pareto.svg (SVG vectorial hecho con la geometría real del DOM).
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {cargarPlaywright} from './cdp/playwright.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(AQUI, '..', '..', 'apps', 'web', 'tests', 'ui', 'fixture-landing.mjs');
const {respond, informeCfo, fijarIdioma} = await import(pathToFileURL(FIXTURE).href);
const BASE = process.env.BASE ?? 'http://localhost:3822';
const OUT = resolve(process.env.OUT ?? join(AQUI, '..', '..', '.capturas-producto'));
const AHORA = '2026-11-04T14:00:00.000Z';
const args = process.argv.slice(2);
const lista = (args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--temas' && args[i - 1] !== '--idioma') ?? 'hoy,fuga,problemas,caso,evidencia,preguntale,cco,conexiones').split(',');
const temas = (args.includes('--temas') ? args[args.indexOf('--temas') + 1] : 'claro').split(',');
const conRecortes = args.includes('--recortes');
const IDIOMA = args.includes('--idioma') ? args[args.indexOf('--idioma') + 1] : 'es';
if (!['es', 'en'].includes(IDIOMA)) throw new Error('--idioma es|en');
fijarIdioma(IDIOMA);
const PREGUNTA = IDIOMA === 'en' ? 'Which marketplace concentrates the most refunds?' : '¿Qué marketplace concentra más reembolsos?';
const PID = '00000000-0000-4000-8000-000000000101';
// 90 días = el preajuste «90 días» de la barra de periodo con el reloj fijado en AHORA (mañana menos 90 días hasta mañana): la barra lo marca como activo.
const PERIODO = '?date_start=2026-08-07&date_end=2026-11-05&timezone=UTC&date_basis=occurred_at&currency=USD&basis=gross&exponent=2';
const RUTAS = {hoy: '/overview' + PERIODO, fuga: '/refunds', problemas: '/problems' + PERIODO, caso: '/problems/' + PID, preguntale: '/preguntale', cco: '/cco', conexiones: '/connections'};

// Rotulado de la captura: el servicio exige claves internas amazon/walmart/bestbuy; lo visible es Marketplace A/B/C. Orden: lo más largo primero.
const REEMPLAZOS = [[/ sin monto \(Amazon\)/g, ' sin monto'], [/ (with no|without an) amount \(Amazon\)/g, ' $1 amount'], [/Marketplace Amazon/g, 'Marketplace A'], [/Marketplace Walmart/g, 'Marketplace B'], [/Marketplace Best Buy/g, 'Marketplace C'], [/Amazon/g, 'Marketplace A'], [/Walmart/g, 'Marketplace B'], [/Best Buy/gi, 'Marketplace C'], [/Shopify/g, 'Marketplace'],
  // El titular del producto compone «{monto} devueltos en {Reembolsos del …}»: la etiqueta de periodo ya dice «reembolsos». Se corrige en el DOM de la captura.
  [/refunded in refunds (from|of|for)/g, 'refunded $1'], [/devueltos en reembolsos (del|de|desde|entre)/g, 'devueltos $1'],
  [/1 oct - 31 oct 2026/g, '1 ago - 31 oct 2026'], [/7 ago\s*[-–]\s*4 nov 2026/g, '1 ago - 31 oct 2026'], [/Aug 7\s*[-–]\s*Nov 4,? 2026/g, 'Aug 1 - Oct 31, 2026'],
  [/ sin monto \(Amazon\)/g, ' sin monto'], [/ (with no|without an) amount \(Amazon\)/g, ' $1 amount'],
  [/^\s*1 de 1\s*$/g, '1'], [/^\s*1 of 1\s*$/g, '1'], [/Las 4 mayores categorías: 100 %|Top 4 categories: 100 ?%|The 4 largest categories: 100 ?%/g, ''],
  ...(IDIOMA === 'en' ? [
    [/Organización de demostración \((?:sintética|datos sintéticos)\)/g, 'Example organization'], [/Organización de demostración/g, 'Example organization'], [/Segunda empresa de demostración \(sintética\)/g, 'Second example organization'],
    [/Synthetic demo data/gi, 'Example data'], [/Excel Tracker/g, 'Spreadsheet Tracker'], [/Tracker \(Excel\)/g, 'Tracker (spreadsheet)'], [/\bExcel\b/g, 'spreadsheet'],
    [/envío: entrega no recibida/gi, 'shipping: delivery not received'], [/Descripción automática a partir de las categorías más frecuentes de las citas del grupo; no es un nombre curado ni generado por IA\./g, 'Automatic description based on the most frequent categories of the quotes in the group; it is not a curated name and it is not AI-generated.'], [/Fuente del motivo y estado: Tracker de spreadsheet del cliente \(hojas Reembolsos, Garantía de herramientas, Garantía de partes y Etiquetas; última revisión de cada fila; los espejos WTR\/WPR no se suman\)\. Monto del Tracker: moneda no declarada, se supone USD\./g, 'Reason and status source: the customer spreadsheet Tracker (sheets Refunds, Tool warranty, Parts warranty and Labels; latest revision of each row; the WTR/WPR mirrors are not added). Tracker amount: currency not declared, USD assumed.'], [/Defectuoso/g, 'Defective'], [/Devolución/g, 'Return'], [/Envío/g, 'Shipping'], [/Garantía/g, 'Warranty'], [/Fuente de reembolsos y pedidos: libro económico cargado en Rovaq \(Marketplace A y Marketplace B; fecha efectiva en UTC\)\. Solo USD; otras monedas no se suman\./g, 'Refund and order source: economic ledger loaded in Rovaq (Marketplace A and Marketplace B; effective date in UTC). USD only; other currencies are not added.'], [/Ventanas de exportación: ninguna está marcada como completa\. Las líneas vendidas cubren solo la ventana de pedidos de cada canal; no hay cantidad por línea\./g, 'Export windows: none is marked as complete. The lines sold cover only the order window of each channel; there is no quantity per line.'], [/Generado (\d+) nov 2026 desde Rovaq\. Observado = registrado en la fuente; no prueba causa ni responsabilidad\./g, 'Generated Nov $1, 2026 from Rovaq. Observed = recorded at the source; it does not prove cause or responsibility.'], [/(\d[\d,]*) de (\d[\d,]*) registros con importe/g, '$1 of $2 records with an amount'], [/Descripción automática/g, 'Automatic description'], [/Empaque insuficiente en el tramo final/g, 'Insufficient packaging on the final leg'], [/Hipótesis inicial a partir de reclamos/g, 'Initial hypothesis based on claims'],
    [/^\s*entrega\s*$/g, 'delivery'], [/^\s*reembolso\s*$/g, 'refund'], [/^\s*garantía\s*$/gi, 'warranty'],
    [/Ask Responsable A/g, 'Ask the data owner'], [/Ask Responsable B/g, 'Ask whoever exports the reports'], [/Fulfilled by pilot/gi, 'Fulfilled by the seller'], [/USD · gross/gi, 'USD · Gross'],
  ] : [
    [/Organización de demostración \((?:sintética|datos sintéticos)\)/g, 'Organización de ejemplo'], [/Organización de demostración/g, 'Organización de ejemplo'], [/Segunda empresa de demostración \(sintética\)/g, 'Segunda organización de ejemplo'],
    [/Datos sintéticos de demostración/gi, 'Datos de ejemplo'], [/Tracker de Excel/g, 'Tracker (hoja de cálculo)'], [/Tracker \(Excel\)/g, 'Tracker (hoja de cálculo)'], [/\bExcel\b/g, 'hoja de cálculo'],
    [/Pedir a Responsable A/g, 'Pedir al responsable de los datos'], [/Pedir a Responsable B/g, 'Pedir a quien exporta los reportes'], [/cumplido por piloto/gi, 'cumplido por el vendedor'], [/USD\s*·\s*gross/gi, 'USD · Bruto'],
  ]),
  // Rótulos de ejes en español que el producto pinta aun con la interfaz en inglés (nombres cortos de mes).
  ...(IDIOMA === 'en' ? Object.entries({ene: 'Jan', feb: 'Feb', mar: 'Mar', abr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul', ago: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dic: 'Dec'}).map(([k, v]) => [new RegExp('^\\s*' + k + '\\s*$', 'g'), v]) : [])];
const CSS = `nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button]{display:none!important}
.bm:not([data-marca="hubspot"]):not([data-marca="csv"]){display:none!important}
.bm-badge:has(.bm:not([data-marca="hubspot"]):not([data-marca="csv"])){display:none!important}
*{caret-color:transparent!important}
.organization-switch,.sidebar-notifications{display:none!important}
.account-copy strong{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}`;

const MARCAS_PROHIBIDAS = /amazon|walmart|shopify|best ?buy|mercado ?libre|zendesk|excel|piloto|demo-|\bdavid\b|\bliza\b|bodegaa usa|bodegab|bodegac|syn-|vexa/i;

const pw = cargarPlaywright();
const browser = await pw.chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
mkdirSync(join(OUT, 'recortes'), {recursive: true});
const informe = [];

async function sanear(page) {
  await page.evaluate(({r, i}) => {
    const reglas = r.map(([s, f]) => [new RegExp(s[0], s[1]), f]);
    const MES = i === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    // Fecha y hora numéricas del producto (4/11/2026, 1:55:00 p.m. en es; 11/4/2026, 1:55:00 PM en en): ambiguas entre idiomas. Se dejan «4 nov 2026, 1:55 p. m.» / «Nov 4, 2026, 1:55 PM».
    const fechas = x => x.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4}),? (\d{1,2}:\d{2}):\d{2}\s?([apAP])\.?\s?[mM]\.?/g, (m, a, b, y, h, ap) => { const d = i === 'en' ? b : a, mo = i === 'en' ? a : b; return i === 'en' ? `${MES[mo - 1]} ${d}, ${y}, ${h} ${ap.toUpperCase()}M` : `${d} ${MES[mo - 1]} ${y}, ${h} ${ap.toLowerCase()}. m.`; });
    const aplica = t => fechas(reglas.reduce((x, [re, f]) => x.replace(re, f), t));
    const pasar = () => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const v = aplica(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } };
    pasar();
    // React vuelve a pintar algunos rótulos (chips de periodo y base) tras el primer saneo: un observador los corrige al instante hasta tomar la captura.
    if (!window.__saneo) { let t = 0; window.__saneo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { window.__saneo.disconnect(); pasar(); window.__saneo.observe(document.body, {childList: true, subtree: true, characterData: true}); }, 30); }); window.__saneo.observe(document.body, {childList: true, subtree: true, characterData: true}); }
    document.querySelectorAll('[aria-label],[title],[alt],option').forEach(e => { for (const a of ['aria-label', 'title', 'alt']) { const v = e.getAttribute(a); if (v) { const x = aplica(v); if (x !== v) e.setAttribute(a, x); } } });
    document.querySelectorAll('span,div,b,strong').forEach(e => { if (e.childElementCount === 0 && e.textContent.trim() === 'OD') e.textContent = 'OE'; });
  }, {r: REEMPLAZOS.map(([re, f]) => [[re.source, re.flags], f]), i: IDIOMA});
}
/** Oculta la tarjeta (ancestro .card/section) cuyo encabezado coincide: lo que el producto cuenta como estado de cobertura en porcentaje no entra en la imagen de la landing. */
async function ocultarTarjetas(page, patrones) {
  await page.evaluate(({p}) => {
    const res = p.map(x => new RegExp(x, 'i'));
    for (const h of document.querySelectorAll('h2,h3,h4')) if (res.some(r => r.test(h.textContent))) { const c = h.closest('.card, section, article') ?? h.parentElement; if (c) c.style.display = 'none'; }
  }, {p: patrones});
}
/** Oculta el elemento más pequeño cuyo texto empieza así (p. ej. un rótulo de estado que el ancho de la ventana deja cortado con puntos suspensivos). */
async function ocultarPorTexto(page, patron) {
  await page.evaluate(({p}) => {
    const re = new RegExp(p, 'i'); let mejor = null;
    for (const e of document.querySelectorAll('span,p,div,small')) { const t = (e.textContent ?? '').trim(); if (re.test(t) && t.length < 140 && (!mejor || t.length < mejor.textContent.trim().length)) mejor = e; }
    if (mejor) mejor.style.display = 'none';
  }, {p: patron});
}
async function cerrarRuido(page) {
  for (const nombre of [/^Saltar$|^Skip$/, /^Ocultar lista$|^Hide list$/]) {
    const b = page.getByRole('button', {name: nombre}).first();
    if (await b.count().catch(() => 0)) await b.click({timeout: 3000}).catch(() => {});
  }
}

async function nuevoContexto(tema) {
  const ctx = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2, reducedMotion: 'reduce', locale: IDIOMA === 'en' ? 'en-US' : 'es-MX', timezoneId: 'UTC', colorScheme: tema === 'oscuro' ? 'dark' : 'light'});
  await ctx.addCookies([{name: 'rovaq_lang', value: IDIOMA, url: BASE}]);
  await ctx.addInitScript(t => { try { localStorage.setItem('vexa-theme', t); } catch { /* opcional */ } }, tema === 'oscuro' ? 'dark' : 'light');
  await ctx.route(/\/(api\/|cfo\/data\/report)/, async route => {
    const r = route.request(), u = new URL(r.url());
    if (u.origin !== new URL(BASE).origin) return route.continue();
    const hit = await respond(r.url(), r.method(), r.postData());
    if (hit) return route.fulfill({status: hit[0], contentType: 'application/json', body: JSON.stringify(hit[1])});
    return route.fulfill({status: 404, contentType: 'application/json', body: '{"error":{"code":"fixture_missing"}}'});
  });
  return ctx;
}

/** Vector real: recorre el DOM del contenedor y emite rect/text/line con la geometría y los estilos calculados (sin imagen raster). */
async function domASvg(page, selector) {
  return page.evaluate(sel => {
    const root = document.querySelector(sel); if (!root) return null;
    const R = root.getBoundingClientRect(), esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), out = [];
    const transp = c => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
    const fam = new Set();
    const visit = el => {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || (el.getBoundingClientRect().width <= 1 && el.getBoundingClientRect().height <= 1) || /rect\(/.test(cs.clip + cs.clipPath)) return;
      const b = el.getBoundingClientRect(), x = (b.left - R.left).toFixed(2), y = (b.top - R.top).toFixed(2);
      if (el.tagName === 'svg' || el.tagName === 'SVG') { out.push(`<g transform="translate(${x} ${y})">${el.innerHTML}</g>`); return; }
      if (!transp(cs.backgroundColor) && b.width > 0 && b.height > 0) out.push(`<rect x="${x}" y="${y}" width="${b.width.toFixed(2)}" height="${b.height.toFixed(2)}" rx="${Math.min(parseFloat(cs.borderTopLeftRadius) || 0, b.height / 2, b.width / 2).toFixed(2)}" fill="${cs.backgroundColor}"/>`);
      if (parseFloat(cs.borderBottomWidth) > 0 && !transp(cs.borderBottomColor) && cs.borderBottomStyle !== 'none') out.push(`<line x1="${x}" x2="${(b.right - R.left).toFixed(2)}" y1="${(b.bottom - R.top - 0.5).toFixed(2)}" y2="${(b.bottom - R.top - 0.5).toFixed(2)}" stroke="${cs.borderBottomColor}" stroke-width="${cs.borderBottomWidth}"/>`);
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && n.nodeValue.trim()) {
          const rg = document.createRange(); rg.selectNodeContents(n);
          for (const rc of rg.getClientRects()) { if (!rc.width) continue; fam.add(cs.fontFamily);
            out.push(`<text x="${(rc.left - R.left).toFixed(2)}" y="${(rc.top - R.top + rc.height * 0.78).toFixed(2)}" font-family="${esc(cs.fontFamily)}" font-size="${cs.fontSize}" font-weight="${cs.fontWeight}" fill="${cs.color}" ${cs.textAlign === 'right' ? '' : ''}>${esc(n.nodeValue.replace(/\s+/g, ' ').trim())}</text>`); break; }
        } else if (n.nodeType === 1) visit(n);
      }
    };
    visit(root);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${R.width.toFixed(2)} ${R.height.toFixed(2)}" width="${R.width.toFixed(0)}" height="${R.height.toFixed(0)}" role="img">${out.join('')}</svg>`;
  }, selector);
}

for (const tema of temas) {
  const ctx = await nuevoContexto(tema);
  for (const nombre of lista) {
    const page = await ctx.newPage(), errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.clock.setFixedTime(new Date(AHORA));
    await page.addStyleTag({content: CSS}).catch(() => {});
    const t0 = Date.now();
    await page.goto(BASE + (['caso', 'evidencia'].includes(nombre) ? RUTAS.problemas : RUTAS[nombre]), {waitUntil: 'load', timeout: 900000});
    if (['caso', 'evidencia'].includes(nombre)) { await page.locator(`a[href*="/problems/${PID}"]`).first().click({timeout: 120000}); await page.waitForURL(/\/problems\/0/, {timeout: 120000}); }
    await page.addStyleTag({content: CSS});
    await page.waitForSelector(nombre === 'preguntale' ? 'textarea,input[type=text],[contenteditable]' : '.workspace-content h1, main h1', {timeout: 300000}).catch(() => console.log('sin encabezado en', nombre));
    await page.waitForLoadState('networkidle', {timeout: 90000}).catch(() => {});
    await page.waitForTimeout(2500);
    await cerrarRuido(page);
    if (nombre === 'preguntale') {
      const caja = page.locator('textarea, input[type=text], [contenteditable=true]').first();
      await caja.click(); await caja.fill(PREGUNTA); await caja.press('Enter');
      await page.getByText('Marketplace A', {exact: false}).first().waitFor({timeout: 120000}).catch(() => console.log('sin respuesta del agente'));
      await page.waitForTimeout(2000);
      await page.mouse.move(900, 500); await page.mouse.wheel(0, -3000); await page.waitForTimeout(800);
    }
    await page.waitForTimeout(800);
    if (nombre === 'hoy') await ocultarPorTexto(page, '^(Estado de los datos|Data status):');
    if (nombre === 'problemas') await ocultarTarjetas(page, ['^Estado de la cobertura$', '^Coverage status$']);
    await sanear(page); await page.waitForTimeout(600); await sanear(page);
    if (nombre !== 'preguntale') await page.mouse.move(2, 2);
    if (nombre === 'evidencia') await page.getByText(/Lo que dicen los clientes|What customers say/).first().scrollIntoViewIfNeeded().catch(() => {});
    const archivo = `${nombre}-${tema}-1440@2x.png`;
    await page.screenshot({path: join(OUT, archivo)});
    const texto = (await page.locator('body').innerText()).slice(0, 20000);
    mkdirSync(join(OUT, 'textos'), {recursive: true}); const atrib = await page.evaluate(() => [...document.querySelectorAll('[title],[aria-label],[data-tooltip]')].map(e => ['title', 'aria-label', 'data-tooltip'].map(a => e.getAttribute(a)).filter(Boolean).join(' | ')).join('\n')); writeFileSync(join(OUT, 'textos', archivo.replace('.png', '.txt')), texto + '\n--- atributos ---\n' + atrib);
    const mal = texto.match(MARCAS_PROHIBIDAS);
    const malos = [...texto.matchAll(/\b100(?:[.,]0)? ?%|Cobertura completa|Complete coverage|\bNeto\b|· Net\b|\b(\d[\d,.]*) (?:de|of) \1\b|últimos 12 meses|last 12 months(?! ·)/gi)].map(m => m[0]);
    if (malos.length) console.log('   AFIRMACION DUDOSA:', JSON.stringify([...new Set(malos)]));
    const raros = texto.split('\n').filter(l => (IDIOMA === 'en' ? /[áéíóúñ¿¡]|\b(sin|con|del|los|las|una|para|por|hace|desde|entre|ejemplo)\b/i : /\b(the|and|with|from|for|your|of the|no data)\b/i).test(l)).slice(0, 8);
    if (raros.length) console.log('   REVISAR idioma:', JSON.stringify(raros));
    informe.push({archivo, ms: Date.now() - t0, marcaProhibida: mal ? mal[0] : null, errores});
    console.log(archivo, Date.now() - t0, 'ms', mal ? 'MARCA: ' + mal[0] : 'sin marcas', errores.length ? 'errores: ' + errores.slice(0, 2).join(' | ') : '');
    if (conRecortes && nombre === 'fuga' && tema === 'claro') {
      const sel = await page.evaluate(() => { const h = [...document.querySelectorAll('h2,h3')].find(x => /Dónde se fuga|Where it leaks/.test(x.textContent)); let c = h; while (c && c.getBoundingClientRect().height < 500) c = c.parentElement; if (!c) return null; c.setAttribute('data-recorte', 'pareto'); return '[data-recorte="pareto"]'; });
      if (sel) { await page.locator(sel).screenshot({path: join(OUT, 'recortes', 'pareto@2x.png')}); const svg = await domASvg(page, sel); if (svg) writeFileSync(join(OUT, 'recortes', 'pareto.svg'), svg); }
      const kp = page.locator('.fuga-kpis, [class*=kpis]').first();
      if (await kp.count()) await kp.screenshot({path: join(OUT, 'recortes', 'tarjetas-fuga@2x.png')}).catch(() => {});
    }
    if (conRecortes && nombre === 'hoy' && tema === 'claro') {
      const kp = page.locator('.hoy-kpis').first();
      if (await kp.count()) { await kp.screenshot({path: join(OUT, 'recortes', 'tarjetas-hoy@2x.png')}); }
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, 'capturas-informe.json'), JSON.stringify(informe, null, 1));
void informeCfo;
