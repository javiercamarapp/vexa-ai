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
  assert.match(bloque, /animation:none!important/); assert.match(bloque, /transition:none!important/); assert.match(bloque, /opacity:1!important/); assert.match(bloque, /transform:none!important/); assert.match(bloque, /position:static!important/);
  // Cada @keyframes y cada animation-timeline están dentro de un bloque no-preference.
  const fuera = sinBloques(sinBloques(css, '@media(prefers-reduced-motion:no-preference)'), '@media(prefers-reduced-motion:reduce)');
  assert.doesNotMatch(fuera, /@keyframes|animation-timeline|animation:/, 'movimiento fuera de no-preference');
  assert.match(css, /@supports \(animation-timeline:view\(\)\)/); assert.match(css, /@supports not \(animation-timeline:view\(\)\)/);
  assert.match(css, /view-timeline:--pasos/); assert.match(css, /position:sticky/);
});
test('CSS y marca: Hanken Grotesk, un solo rojo señal, sin degradados ni vidrio', () => {
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|conic-gradient|backdrop-filter|filter:\s*blur/i);
  assert.doesNotMatch(css, /\bInter\b|Fraunces|Instrument Sans|Bricolage|googleapis/);
  const rojos = css.match(/#e8241c/gi) ?? [];
  assert.equal(rojos.length, 1, 'el rojo se declara una vez como variable');
  assert.match(css, /#0e0e10/i);
  assert.match(css, /prefers-color-scheme:dark/);
});
test('JavaScript de movimiento: sin librerías, con respaldo y variables escritas con setProperty', () => {
  const c = leer('src/components/landing/cliente.tsx');
  assert.doesNotMatch(c, /gsap|lenis|framer|motion\/react|from 'motion'/i);
  assert.match(c, /IntersectionObserver/); assert.match(c, /setProperty\('--p'/); assert.match(c, /setProperty\('--rx'/); assert.match(c, /prefers-reduced-motion: reduce/);
  assert.match(c, /CSS\.supports\('animation-timeline: view\(\)'\)/);
  const pkg = JSON.parse(leer('package.json')); for (const d of Object.keys({...pkg.dependencies, ...pkg.devDependencies})) assert.doesNotMatch(d, /gsap|lenis|framer-motion|^motion$/);
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
    assert.ok((h.match(/data-frase/g) ?? []).length === 1);
    assert.equal((h.match(/class="panel"/g) ?? []).length, 4);
    assert.equal((h.match(/<details/g) ?? []).length, 7);
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
