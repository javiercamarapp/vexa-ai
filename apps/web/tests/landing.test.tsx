// Landing pública: política de seguridad (sin style ni scripts en línea), diccionario ES y EN igual, afirmaciones prohibidas, bloque único de movimiento reducido y SEO.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {Landing, jsonLdLanding} from '../src/components/landing/landing';
import {landingEs, landingEn} from '../src/lib/i18n/d-landing';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {landingUrl, SITE, PREFIJOS_PRIVADOS, RUTAS_PUBLICAS} from '../src/lib/site.mjs';

const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const ARCHIVOS = ['src/components/landing/landing.tsx', 'src/components/landing/mocks.tsx', 'src/components/landing/cliente.tsx', 'src/app/(landing)/landing/page.tsx'];
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
  const prohibidas = /SOC ?2|ISO ?27001|HIPAA|PCI|GDPR|LFPDPPP|\d+ ?%|100 ?por ciento|a prueba de|hackeo|hack-?proof|bank-?grade|tiempo real|real[- ]time|testimon|testimonial|case stud|caso de [eé]xito|trusted by|conf[ií]an en nosotros|nuestros clientes|our customers|garantiz|guarantee|SLA garant|uptime|disponibilidad|recomienda|recommends|AI-powered recommend|\bprecio|\bpricing|\$\s?\d|USD|MXN|ahorra|saves? you|ROI/i;
  for (const d of [landingEs, landingEn]) for (const [k, v] of Object.entries(d)) {
    if (k === 'landing.m.org') continue;
    assert.doesNotMatch(v, prohibidas, `${k}: ${v}`);
  }
  // En el marcado completo solo se permiten cifras dentro de las ilustraciones rotuladas.
  for (const idioma of ['es', 'en'] as const) {
    const h = html(idioma);
    assert.doesNotMatch(h, /SOC ?2|ISO ?27001|tiempo real|real[- ]time|100 ?%/i);
    assert.doesNotMatch(h, /testimon|trusted by/i);
  }
});
test('lo que se dice de la seguridad es honesto: certificaciones y pruebas externas figuran como hoja de ruta, no como logro', () => {
  assert.match(landingEs['landing.seg.ruta.d'], /pruebas de penetración externas/);
  assert.match(landingEs['landing.seg.cert'], /no tenemos certificaciones/i);
  assert.match(landingEn['landing.seg.cert'], /no formal certifications/i);
  assert.match(landingEn['landing.seg.ruta.d'], /external penetration testing/);
});
test('sin atributos style en el marcado renderizado ni en el código fuente', () => {
  for (const idioma of ['es', 'en'] as const) assert.doesNotMatch(html(idioma), /\sstyle=/i);
  for (const f of ARCHIVOS) { const s = leer(f); assert.doesNotMatch(s, /\bstyle\s*=/, f); assert.doesNotMatch(s, /setAttribute\(\s*['"]style/, f); assert.doesNotMatch(s, /cssText|innerHTML|insertAdjacentHTML|document\.write|eval\(/, f); assert.doesNotMatch(s, /createElement\(\s*['"]style/, f); }
});
test('sin scripts en línea nuevos: el único bloque es JSON-LD de datos y no hay estilos en línea', () => {
  for (const idioma of ['es', 'en'] as const) { const h = html(idioma); assert.doesNotMatch(h, /<script/i); assert.doesNotMatch(h, /<style/i); assert.doesNotMatch(h, /\son\w+=/i); }
  const page = leer('src/app/(landing)/landing/page.tsx');
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
  assert.doesNotMatch(css, /linear-gradient|conic-gradient|backdrop-filter|filter:\s*blur/i);
  assert.doesNotMatch(css, /\bInter\b|Fraunces|Instrument Sans|Bricolage|googleapis|@import|url\(\s*['"]?https?:/);
  assert.equal((css.match(/#e8241c/gi) ?? []).length, 1, 'el rojo se declara una vez como variable');
  assert.match(css, /#0e0e10/i); assert.match(css, /prefers-color-scheme:dark/);
  // Sin azules: ningún color hexadecimal con el canal azul claramente dominante.
  for (const [, h] of css.matchAll(/#([0-9a-f]{6})\b/gi)) { const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); assert.ok(!(b > r + 24 && b > g + 12), 'azul #' + h); }
  assert.doesNotMatch(css, /\b(blue|navy|royalblue|dodgerblue)\b|hsl\(\s*(19\d|2\d\d)/i);
});
test('JavaScript de movimiento: GSAP, ScrollTrigger, Lenis y three.js del mismo origen, solo en la landing, con licencias y sin CDN ni dependencias nuevas', () => {
  const c = leer('src/components/landing/cliente.tsx');
  for (const f of ['/vendor/gsap.min.js', '/vendor/ScrollTrigger.min.js', '/vendor/lenis.min.js', '/landing/escena.js']) assert.ok(c.includes(f), f);
  assert.doesNotMatch(c, /https?:\/\/|jsdelivr|unpkg|cdnjs/);
  assert.match(c, /prefers-reduced-motion: reduce/); assert.match(c, /setAttribute\('data-landing-js'/);
  const lic = leer('public/vendor/LICENSES.txt');
  for (const n of ['GSAP 3.13.0', 'ScrollTrigger 3.13.0', 'Lenis 1.1.13', 'three.js 0.170.0', 'MIT']) assert.ok(lic.includes(n), n);
  const esc = leer('public/landing/escena.js');
  assert.match(esc, /Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/); assert.match(esc, /IntersectionObserver/); assert.match(esc, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(esc, /https?:\/\/|eval\(|new Function|WebAssembly|setAttribute\(\s*['"]style/);
  for (const f of ['three.module.min.js', 'GLTFLoader.js', 'BufferGeometryUtils.js', 'RoomEnvironment.js', 'LICENSE']) assert.ok(fs.existsSync(new URL('../public/vendor/three/' + f, import.meta.url)), f);
  for (const f of ['GLTFLoader.js', 'BufferGeometryUtils.js', 'RoomEnvironment.js']) assert.doesNotMatch(leer('public/vendor/three/' + f), /from 'three'|from "three"/, 'importación sin reescribir ' + f);
  const pkg = JSON.parse(leer('package.json')); for (const d of Object.keys({...pkg.dependencies, ...pkg.devDependencies})) assert.doesNotMatch(d, /gsap|lenis|^three$|framer-motion/);
  assert.match(leer('next.config.ts'), /script-src 'self'/);
});
test('activos de la landing: GLB bajo 1.2 MB cada uno y 5 MB en total, todo public/landing bajo 6 MB, y cada imagen con alt, ancho y alto', () => {
  const raiz = new URL('../public/landing/', import.meta.url);
  let total = 0; const glb: number[] = [];
  const recorre = (dir: URL) => { for (const e of fs.readdirSync(dir, {withFileTypes: true})) { const u = new URL(e.name + (e.isDirectory() ? '/' : ''), dir); if (e.isDirectory()) recorre(u); else { const n = fs.statSync(u).size; total += n; if (e.name.endsWith('.glb')) glb.push(n); } } };
  recorre(raiz);
  assert.ok(total < 6 * 1024 * 1024, 'public/landing pesa ' + total);
  assert.equal(glb.length, 5); for (const n of glb) assert.ok(n < 1.2 * 1024 * 1024, 'GLB de ' + n); assert.ok(glb.reduce((a, b) => a + b, 0) < 5 * 1024 * 1024);
  for (const idioma of ['es', 'en'] as const) for (const im of html(idioma).match(/<img[^>]*>/g) ?? []) { assert.match(im, /\balt="/); assert.match(im, /\bwidth="\d+"/); assert.match(im, /\bheight="\d+"/); }
  assert.match(html('en'), /<img[^>]*fetchPriority="high"|<img[^>]*fetchpriority="high"/i);
});
test('solo hay lienzos 3D declarados con modelos del mismo origen y la imagen estática de respaldo sigue en el HTML', () => {
  const h = html('en');
  assert.equal((h.match(/data-escena3d=/g) ?? []).length, 2);
  for (const [, m] of h.matchAll(/data-modelos="([^"]+)"/g)) for (const u of m.split(',')) assert.match(u, /^\/landing\/3d\/[\w-]+\.glb$/);
  assert.ok(h.includes('/landing/objeto-nucleo.webp'));
});
test('la escena fija usa los cuatro sellos de clase de cifra como eje', () => {
  for (const [idioma, d] of [['es', landingEs], ['en', landingEn]] as const) { const h = html(idioma); for (const k of ['obs', 'est', 'inf', 'sin']) assert.ok(h.includes(`data-s="${k}"`), k); assert.ok(h.includes(d['landing.val.sin'])); }
});
test('marcado: un h1, encabezados en orden, anclas válidas, sin imágenes sin alternativa, CTA como correo al contacto de site.mjs', () => {
  for (const idioma of ['es', 'en'] as const) {
    const h = html(idioma), d = idioma === 'es' ? landingEs : landingEn;
    assert.equal((h.match(/<h1[ >]/g) ?? []).length, 1);
    assert.ok(h.includes(d['landing.hero.titulo']));
    assert.ok(h.includes(`href="mailto:${SITE.contacto}?subject=`), 'CTA mailto');
    assert.doesNotMatch(h, /<form|<input type="(text|email)/);
    for (const [, id] of h.matchAll(/href="#([\w-]+)"/g)) assert.ok(h.includes(`id="${id}"`), 'ancla rota #' + id);
    assert.doesNotMatch(h, /<img(?![^>]*\balt=)/);
    for (const f of h.match(/<figure[\s\S]*?<\/figure>/g) ?? []) { assert.match(f, /role="img"/); assert.ok(f.includes(d['landing.sintetico']), 'figura sin rótulo sintético'); }
        assert.equal((h.match(/class="panel"/g) ?? []).length, 4);
    assert.equal((h.match(/<details/g) ?? []).length, 8);
    assert.doesNotMatch(h, /\{\w+\}/, 'variables sin reemplazar');
  }
});
test('cada ilustración con cifras está rotulada como datos sintéticos de demostración', () => {
  const mocks = leer('src/components/landing/mocks.tsx');
  assert.equal((mocks.match(/<Rotulo t=\{t\}/g) ?? []).length, 5);
  assert.match(mocks, /landing\.sintetico/);
  assert.match(landingEs['landing.sintetico'], /Datos sintéticos de demostración/); assert.match(landingEn['landing.sintetico'], /Synthetic demo data/);
});
test('inglés por omisión: la landing en inglés muestra el titular en inglés y en español cambia solo con idioma es', () => {
  assert.match(html('en'), /Know how much money you lose, and why\./);
  assert.match(html('es'), /Sabe cuánto dinero se te va, y por qué\./);
  assert.match(html('es'), /Datos sintéticos de demostración/);
});
test('SEO: canonical y datos estructurados propios en rovaq.ai; la app sigue noindex y la landing no está entre los prefijos privados', () => {
  assert.equal(landingUrl(undefined), 'https://rovaq.ai'); assert.equal(landingUrl('http://evil.example'), 'https://rovaq.ai'); assert.equal(landingUrl('https://staging.rovaq.ai/x'), 'https://staging.rovaq.ai');
  const j = JSON.parse(JSON.stringify(jsonLdLanding('https://rovaq.ai')));
  assert.deepEqual(j['@graph'].map((n: {'@type': string}) => n['@type']), ['Organization', 'WebSite']);
  assert.doesNotMatch(JSON.stringify(j), /aggregateRating|offers|price|review/i);
  const page = leer('src/app/(landing)/landing/page.tsx');
  assert.match(page, /canonical: `\$\{base\}\/`/); assert.match(page, /robots: \{index: true, follow: true\}/); assert.match(page, /summary_large_image/); assert.match(page, /absolute: titulo/);
  assert.ok(!PREFIJOS_PRIVADOS.includes('/landing')); assert.deepEqual([...RUTAS_PUBLICAS], ['/login']);
  assert.match(leer('src/app/robots.ts'), /ES_HOST_LANDING/); assert.match(leer('src/app/sitemap.ts'), /ES_HOST_LANDING/);
});
test('layout: el arranque limpio y el tema respetan /landing', () => {
  assert.match(leer('src/app/layout.tsx'), /login\|auth\|platform\|landing/);
});
