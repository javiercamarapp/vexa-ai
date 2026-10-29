// Landing pública: política de seguridad (sin style ni scripts en línea), diccionario ES y EN igual, afirmaciones prohibidas, bloque único de movimiento reducido y SEO.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {Landing, jsonLdLanding} from '../src/components/landing/landing';
import {landingEs, landingEn} from '../src/lib/i18n/d-landing';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {landingUrl, PREFIJOS_PRIVADOS, RUTAS_PUBLICAS} from '../src/lib/site.mjs';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const PAGINAS = ['src/app/(app)/(landing)/landing/page.tsx', 'src/app/(app)/(landing)/landing/en/page.tsx'];
const ARCHIVOS = ['src/components/landing/landing.tsx', 'src/components/landing/mocks.tsx', 'src/components/landing/cliente.tsx', 'src/components/landing/pagina.tsx', ...PAGINAS];
const cssCrudo = leer('src/components/landing/landing.css');
const css = cssCrudo.replace(/\/\*[\s\S]*?\*\//g, '');
const variables = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const router = {back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}} as never;
const html = (idioma: 'es' | 'en') => renderToStaticMarkup(<AppRouterContext.Provider value={router}><Landing idioma={idioma} /></AppRouterContext.Provider>);
/** Quita de la hoja los bloques @media que empiezan con el prefijo dado, emparejando llaves. */
function sinBloques(hoja: string, prefijo: string) {
  let salida = hoja, i;
  while ((i = salida.indexOf(prefijo)) >= 0) { let nivel = 0, j = salida.indexOf('{', i); for (; j < salida.length; j++) { if (salida[j] === '{') nivel++; else if (salida[j] === '}' && --nivel === 0) break; } salida = salida.slice(0, i) + salida.slice(j + 1); }
  return salida;
}

test('claves landing.*: mismas en español e inglés, mismas variables, sin vacíos y presentes en los diccionarios de la app', () => {
  assert.deepEqual(Object.keys(landingEn).sort(), Object.keys(landingEs).sort());
  assert.ok(Object.keys(landingEs).length > 150);
  for (const k of Object.keys(landingEs) as Array<keyof typeof landingEs>) {
    assert.ok(k.startsWith('landing.'), k);
    assert.ok(landingEs[k].trim() && landingEn[k].trim(), 'vacío ' + k);
    assert.equal(variables(landingEn[k]), variables(landingEs[k]), 'variables ' + k);
    assert.equal((es as Record<string, string>)[k], landingEs[k]); assert.equal((en as Record<string, string>)[k], landingEn[k]);
  }
});
test('textos visibles: sin paréntesis, sin emojis ni rayas largas, sin signos de exclamación', () => {
  for (const d of [landingEs, landingEn]) for (const [k, v] of Object.entries(d)) {
    assert.doesNotMatch(v, /[()]/, 'paréntesis en ' + k);
    assert.doesNotMatch(v, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'emoji en ' + k);
    assert.doesNotMatch(v, /[—–!]/, 'raya larga o exclamación en ' + k);
  }
});
test('afirmaciones prohibidas: sin certificaciones, porcentajes, clientes, testimonios, tiempo real ni IA que recomienda', () => {
  // Nunca, en ningún texto.
  const prohibidas = /HIPAA|PCI|LFPDPPP|\d+ ?%|100 ?por ciento|(?<!\w)a prueba de|hackeo|hack-?proof|bank-?grade|testimon|case stud|caso de [eé]xito|trusted by|conf[ií]an en nosotros|nuestros clientes|our customers|garantiz|guarantee|recomienda|recommends|AI-powered recommend|\$\s?\d|ahorra|saves? you|ROI|anonimizamos|we anonymize/i;
  // Solo como límite declarado: en las secciones de límites, seguridad honesta, integraciones, preguntas, capacidades y el contador de SLA.
  const condicionadas = /SOC ?2|ISO ?27001|GDPR|tiempo real|real[- ]time|\bprecio|\bpricing|disponibilidad|availability|\bSLA\b|uptime/i;
  const donde = /^landing\.(seg\.no|no|faq|int|cap|cls|val|m|hero|prob|cuentas)\./;
  const negada = /\b(no|not|nunca|never|sin|without|todavía no|yet)\b|Does not|does not/i;
  for (const d of [landingEs, landingEn]) for (const [k, v] of Object.entries(d)) {
    if (k === 'landing.m.org') continue;
    assert.doesNotMatch(v, prohibidas, `${k}: ${v}`);
    if (condicionadas.test(v) || /\b(?:USD|CAD|MXN)\b/.test(v)) { assert.match(k, donde, 'afirmación condicionada fuera de su sección: ' + k); if (!k.endsWith('.q') && /SOC ?2|ISO ?27001|GDPR|tiempo real|real[- ]time/i.test(v)) assert.match(v, negada, 'debe ir negada: ' + k); }
  }
  // En el marcado completo solo se permiten cifras dentro de las ilustraciones rotuladas.
  for (const idioma of ['es', 'en'] as const) {
    const h = html(idioma);
    assert.doesNotMatch(h, /100 ?%/i);
    assert.doesNotMatch(h, /testimon|trusted by/i);
  }
});
test('lo que se dice de la seguridad es honesto: certificaciones y pruebas externas figuran como hoja de ruta, no como logro', () => {
  assert.match(landingEs['landing.seg.no.2'], /prueba de penetración externa/);
  assert.match(landingEs['landing.seg.no.1'], /No tenemos certificación SOC 2 ni ISO 27001/);
  assert.match(landingEn['landing.seg.no.1'], /do not hold SOC 2 or ISO 27001/);
  assert.match(landingEn['landing.seg.no.3'], /roadmap/); assert.match(landingEs['landing.no.6'], /No trabaja en tiempo real/);
});
test('sin atributos style en el marcado renderizado ni en el código fuente', () => {
  for (const idioma of ['es', 'en'] as const) assert.doesNotMatch(html(idioma), /\sstyle=/i);
  for (const f of ARCHIVOS) { const s = leer(f); assert.doesNotMatch(s, /\bstyle\s*=/, f); assert.doesNotMatch(s, /setAttribute\(\s*['"]style/, f); assert.doesNotMatch(s, /cssText|innerHTML|insertAdjacentHTML|document\.write|eval\(/, f); assert.doesNotMatch(s, /createElement\(\s*['"]style/, f); }
});
test('sin scripts en línea nuevos: el único bloque es JSON-LD de datos y no hay estilos en línea', () => {
  for (const idioma of ['es', 'en'] as const) { const h = html(idioma); assert.doesNotMatch(h, /<script/i); assert.doesNotMatch(h, /<style/i); assert.doesNotMatch(h, /\son\w+=/i); }
  const page = leer('src/components/landing/pagina.tsx');
  assert.equal((page.match(/dangerouslySetInnerHTML/g) ?? []).length, 1);
  assert.match(page, /type="application\/ld\+json"/);
  for (const f of ARCHIVOS.slice(0, 3)) assert.doesNotMatch(leer(f), /dangerouslySetInnerHTML/, f);
  assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:/, 'sin recursos externos en el CSS');
});
test('CSS: un único bloque prefers-reduced-motion:reduce que deja el estado final, y todo el movimiento en no-preference', () => {
  const reduce = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g) ?? [];
  assert.equal(reduce.length, 1);
  const bloque = css.slice(css.indexOf('@media(prefers-reduced-motion:reduce)'));
  for (const p of [/animation:none!important/, /transition:none!important/, /opacity:1!important/, /transform:none!important/]) assert.match(bloque, p);
  const fuera = sinBloques(sinBloques(css, '@media(prefers-reduced-motion:no-preference)'), '@media(prefers-reduced-motion:reduce)');
  assert.doesNotMatch(fuera, /@keyframes|animation-timeline|animation:/, 'movimiento fuera de no-preference');
  // La escena anclada solo existe con movimiento permitido; en la base los pasos quedan apilados.
  assert.match(sinBloques(css, '@media(prefers-reduced-motion:no-preference)'), /\.fw-pista\{position:relative\}/);
  assert.match(css, /position:sticky/);
});
test('CSS y marca: Hanken Grotesk, un solo rojo señal, sin azules, sin vidrio ni degradados decorativos', () => {
  assert.doesNotMatch(css, /(?<!repeating-)linear-gradient|conic-gradient|backdrop-filter|filter:\s*blur/i);
  assert.doesNotMatch(css, /\bInter\b|Fraunces|Instrument Sans|Bricolage|googleapis|@import|url\(\s*['"]?https?:/);
  assert.equal((css.match(/#e8241c/gi) ?? []).length, 1, 'el rojo se declara una vez como variable');
  assert.match(css, /#0e0e10/i); assert.match(css, /prefers-color-scheme:dark/);
  // Sin azules: ningún color hexadecimal con el canal azul claramente dominante.
  for (const [, h] of css.matchAll(/#([0-9a-f]{6})\b/gi)) { const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); assert.ok(!(b > r + 24 && b > g + 12), 'azul #' + h); }
  assert.doesNotMatch(css, /\b(blue|navy|royalblue|dodgerblue)\b|hsl\(\s*(19\d|2\d\d)/i);
});
test('JavaScript de movimiento: GSAP, ScrollTrigger y Lenis del mismo origen con versión en el nombre, hash verificado, licencias y sin CDN, three ni dependencias nuevas', () => {
  const c = leer('src/components/landing/cliente.tsx');
  for (const f of ['/vendor/gsap-3.13.0.min.js', '/vendor/ScrollTrigger-3.13.0.min.js', '/vendor/lenis-1.1.13.min.js', '/landing/nube.js']) assert.ok(c.includes(f), f);
  assert.doesNotMatch(c, /https?:\/\/|jsdelivr|unpkg|cdnjs/);
  assert.match(c, /prefers-reduced-motion: reduce/); assert.match(c, /setAttribute\('data-landing-js'/);
  const lic = leer('public/vendor/LICENSES.txt');
  for (const n of ['GSAP 3.13.0', 'ScrollTrigger 3.13.0', 'Lenis 1.1.13', 'standard-license', 'Webflow']) assert.ok(lic.includes(n), n);
  const lock = JSON.parse(leer('public/vendor/vendor.lock.json')).archivos as Array<{archivo: string; sha256: string}>;
  const enDisco = fs.readdirSync(new URL('../public/vendor/', import.meta.url)).filter((f) => f.endsWith('.js')).sort();
  assert.deepEqual(lock.map((x) => x.archivo).sort(), enDisco, 'archivos de vendor fuera del lock o huérfanos');
  for (const x of lock) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/vendor/' + x.archivo, import.meta.url))).digest('hex'), x.sha256, x.archivo);
  assert.ok(!fs.existsSync(new URL('../public/vendor/three', import.meta.url)), 'three.js ya no se sirve');
  const nube = leer('public/landing/nube.js');
  assert.ok(nube.split('\n').length < 260, 'motor propio de unas 250 líneas');
  assert.match(nube, /Math\.min\(devicePixelRatio \|\| 1, this\.movil \? 1\.5 : 2\)/); assert.match(nube, /IntersectionObserver/); assert.match(nube, /prefers-reduced-motion: reduce/); assert.match(nube, /webglcontextlost/);
  assert.doesNotMatch(nube, /https?:\/\/|eval\(|new Function|WebAssembly|setAttribute\(\s*['"]style|import /);
  const pkg = JSON.parse(leer('package.json')); for (const d of Object.keys({...pkg.dependencies, ...pkg.devDependencies})) assert.doesNotMatch(d, /gsap|lenis|^three$|^ogl$|framer-motion|gltf|sharp/);
  assert.match(leer('next.config.ts'), /script-src 'self'/);
});
test('activos de la landing: archivos .pts válidos y deterministas, todo public/landing bajo 6 MB y cada imagen con alt, ancho y alto', () => {
  const raiz = new URL('../public/landing/', import.meta.url);
  let total = 0;
  const recorre = (dir: URL) => { for (const e of fs.readdirSync(dir, {withFileTypes: true})) { const u = new URL(e.name + (e.isDirectory() ? '/' : ''), dir); if (e.isDirectory()) recorre(u); else total += fs.statSync(u).size; } };
  recorre(raiz);
  assert.ok(total < 6 * 1024 * 1024, 'public/landing pesa ' + total);
  assert.ok(!fs.existsSync(new URL('3d/', raiz)), 'los GLB fuente no se sirven');
  const manifest = JSON.parse(fs.readFileSync(new URL('pts/manifest.json', raiz), 'utf8')) as Record<string, {archivo: string; puntos: number; bytes: number; sha256: string}>;
  assert.deepEqual(Object.keys(manifest).sort(), ['nucleo', 'paso1', 'paso2', 'paso3', 'paso4']);
  for (const [, m] of Object.entries(manifest)) {
    const buf = fs.readFileSync(new URL('pts/' + m.archivo, raiz));
    assert.equal(buf.length, m.bytes); assert.equal(buf.length, 16 + m.puntos * 10); assert.equal(buf.toString('ascii', 0, 4), 'PTS2'); assert.equal(buf.readUInt32LE(8), m.puntos);
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), m.sha256); assert.ok(m.archivo.includes(m.sha256.slice(0, 8)), 'el nombre lleva el hash');
    assert.ok(buf.length < 240 * 1024, 'archivo de puntos pequeño'); assert.ok(m.puntos >= 20000 && m.puntos <= 24000, 'entre 20 000 y 24 000 puntos');
  }
  assert.equal(fs.readdirSync(new URL('pts/', raiz)).filter((f) => f.endsWith('.pts')).length, 5, 'sin .pts huérfanos');
  for (const idioma of ['es', 'en'] as const) for (const im of html(idioma).match(/<img[^>]*>/g) ?? []) { assert.match(im, /\balt="/); assert.match(im, /\bwidth="\d+"/); assert.match(im, /\bheight="\d+"/); }
  assert.match(html('en'), /<img[^>]*fetchPriority="high"|<img[^>]*fetchpriority="high"/i);
});
test('solo hay lienzos de nube declarados con archivos .pts del mismo origen y la imagen estática de respaldo sigue en el HTML', () => {
  const h = html('en');
  assert.equal((h.match(/data-nube=/g) ?? []).length, 2);
  for (const [, m] of h.matchAll(/data-pts="([^"]+)"/g)) for (const u of m.split(',')) assert.match(u, /^\/landing\/pts\/[\w-]+\.[0-9a-f]{8}\.pts$/);
  assert.ok(h.includes('/landing/objeto-nucleo.webp'));
});
test('la escena fija usa los cuatro sellos de clase de cifra como eje', () => {
  for (const [idioma, d] of [['es', landingEs], ['en', landingEn]] as const) { const h = html(idioma); for (const k of ['obs', 'est', 'inf', 'sin']) assert.ok(h.includes(`data-s="${k}"`), k); assert.ok(h.includes(d['landing.val.sin'])); }
});
test('las miniaturas de pantallas se rotulan como datos de ejemplo y no hay cifras sueltas en el texto', () => {
  const mocks = leer('src/components/landing/mocks.tsx');
  assert.doesNotMatch(mocks, /\bstyle\b\s*=/); assert.ok((mocks.match(/<Rotulo t=\{t\}/g) ?? []).length >= 5, 'cada maqueta lleva su rótulo');
  assert.match(landingEs['landing.sintetico'], /Datos de ejemplo\. No son de un cliente\./); assert.match(landingEn['landing.sintetico'], /Example data\. Not from a customer\./);
  for (const idioma of ['es', 'en'] as const) assert.ok(html(idioma).includes(idioma === 'es' ? landingEs['landing.sintetico'] : landingEn['landing.sintetico']));
});
test('inglés por omisión: la landing en inglés muestra el titular en inglés y en español cambia solo con idioma es', () => {
  assert.match(html('en'), /Know how much money you lose, and why\./);
  assert.match(html('es'), /Sabe cuánto dinero se te va, y por qué\./);
  assert.match(html('es'), /Datos de ejemplo\. No son de un cliente\./);
});
test('SEO: canonical y datos estructurados propios en rovaq.ai; la app sigue noindex y la landing no está entre los prefijos privados', () => {
  assert.equal(landingUrl(undefined), 'https://rovaq.ai'); assert.equal(landingUrl('http://evil.example'), 'https://rovaq.ai'); assert.equal(landingUrl('https://staging.rovaq.ai/x'), 'https://staging.rovaq.ai');
  const j = JSON.parse(JSON.stringify(jsonLdLanding('https://rovaq.ai')));
  assert.deepEqual(j['@graph'].map((n: {'@type': string}) => n['@type']), ['Organization', 'WebSite']);
  assert.doesNotMatch(JSON.stringify(j), /aggregateRating|offers|price|review/i);
  const meta = leer('src/components/landing/pagina.tsx');
  assert.match(meta, /canonical: url/); assert.match(meta, /'es-MX': base \+ RUTA_PUBLICA\.es, en: base \+ RUTA_PUBLICA\.en, 'x-default'/); assert.match(meta, /robots: \{index: true, follow: true\}/); assert.match(meta, /summary_large_image/); assert.match(meta, /absolute: titulo/);
  // Las páginas públicas no leen cookies ni cabeceras: el idioma sale de la URL.
  for (const f of [...PAGINAS, 'src/components/landing/pagina.tsx', 'src/components/landing/landing.tsx']) assert.doesNotMatch(leer(f), /cookies\(|headers\(|idiomaActual/, f);
  assert.match(leer(PAGINAS[0]), /idioma="es"/); assert.match(leer(PAGINAS[1]), /idioma="en"/);
  assert.ok(!PREFIJOS_PRIVADOS.includes('/landing')); assert.deepEqual([...RUTAS_PUBLICAS], ['/login']);
  assert.match(leer('src/app/robots.ts'), /ES_HOST_LANDING/); assert.match(leer('src/app/sitemap.ts'), /ES_HOST_LANDING/);
});
test('layout: el arranque limpio y el tema respetan /landing', () => {
  assert.match(leer('src/app/(app)/layout.tsx'), /login\|auth\|platform\|landing/);
});
