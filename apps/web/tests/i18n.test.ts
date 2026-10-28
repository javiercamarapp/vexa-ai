// Idioma conmutable (es/en): diccionarios con las mismas claves, cookie inválida cae a español, el menú está traducido y el mecanismo es único (login + espacio de trabajo).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {traducir, resolverIdioma, idiomaDeAcceptLanguage, idiomaValido, cookieIdioma, COOKIE_IDIOMA, type Clave} from '../src/lib/i18n';
import {claveItem, claveTitulo, claveGrupo} from '../src/lib/i18n/menu';
import {periodoDelAlcance} from '../src/lib/i18n/periodo';
import {numero, moneda, fecha} from '../src/lib/i18n/formato';
import {MENU} from '../src/lib/workspace/menu.mjs';
const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const variables = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('es.ts y en.ts tienen exactamente las mismas claves, sin textos vacíos', () => {
  const ke = Object.keys(es).sort(), kn = Object.keys(en).sort();
  assert.deepEqual(kn.filter((k) => !ke.includes(k)), [], 'claves solo en en.ts');
  assert.deepEqual(ke.filter((k) => !kn.includes(k)), [], 'claves solo en es.ts');
  assert.ok(ke.length > 200, 'diccionario con contenido: ' + ke.length);
  for (const k of ke) { assert.ok((es as Record<string, string>)[k].trim(), 'es vacío: ' + k); assert.ok((en as Record<string, string>)[k].trim(), 'en vacío: ' + k); }
});
test('cada clave conserva las mismas {variables} en los dos idiomas', () => {
  for (const k of Object.keys(es)) assert.equal(variables((en as Record<string, string>)[k]), variables((es as Record<string, string>)[k]), k);
});
test('una cookie inválida cae a español; una válida manda; sin cookie decide Accept-Language', () => {
  assert.equal(resolverIdioma({cookie: 'fr'}), 'es');
  assert.equal(resolverIdioma({cookie: 'EN'}), 'es');
  assert.equal(resolverIdioma({cookie: '<script>'}), 'es');
  assert.equal(resolverIdioma({cookie: 'fr', acceptLanguage: 'en-US,en;q=0.9'}), 'es');
  assert.equal(resolverIdioma({cookie: 'en'}), 'en');
  assert.equal(resolverIdioma({cookie: 'es', acceptLanguage: 'en-US'}), 'es');
  assert.equal(resolverIdioma({}), 'es');
  assert.equal(resolverIdioma({acceptLanguage: 'en-US,en;q=0.9,es;q=0.8'}), 'en');
  assert.equal(resolverIdioma({acceptLanguage: 'de-DE,de;q=0.9'}), 'es');
  assert.equal(resolverIdioma({parametro: 'en', cookie: 'es'}), 'en', '?lang= válido manda sobre la cookie');
  assert.equal(resolverIdioma({parametro: 'xx', cookie: 'en'}), 'en', '?lang= inválido se ignora');
});
test('Accept-Language respeta q y el orden; idiomaValido solo acepta es|en exactos', () => {
  assert.equal(idiomaDeAcceptLanguage('es-MX;q=0.5,en;q=0.9'), 'en');
  assert.equal(idiomaDeAcceptLanguage('es-MX,en;q=0.9'), 'es');
  assert.equal(idiomaDeAcceptLanguage('en;q=0,es;q=0.1'), 'es');
  assert.equal(idiomaDeAcceptLanguage(null), null);
  assert.equal(idiomaValido('es'), 'es'); assert.equal(idiomaValido('en-US'), null); assert.equal(idiomaValido(undefined), null);
});
test('la cookie es rovaq_lang, SameSite=Lax, un año, sin datos personales', () => {
  assert.equal(COOKIE_IDIOMA, 'rovaq_lang');
  assert.equal(cookieIdioma('en'), 'rovaq_lang=en; Path=/; Max-Age=31536000; SameSite=Lax');
  assert.match(cookieIdioma('es', true), /; Secure$/);
});
test('traducir reemplaza variables y una variable ausente queda visible', () => {
  assert.equal(traducir('es', 'alcance.skuVarios', {n: 3}), '3 SKU');
  assert.equal(traducir('en', 'alcance.skuVarios', {n: 3}), '3 SKUs');
  assert.equal(traducir('en', 'alcance.nActivos', {}), '{n} active');
  assert.equal(traducir('en', 'hoy.exportar'), 'Export report');
});
test('todo ítem, título propio y grupo del menú tiene traducción en los dos idiomas', () => {
  const faltan: string[] = [];
  const exige = (c: string) => { if (!(c in es) || !(c in en)) faltan.push(c); };
  for (const e of MENU as unknown as {tipo: string; href?: string; etiqueta: string; titulo?: string; clave?: string; items?: {href: string; etiqueta: string; titulo?: string}[]}[]) {
    const items = e.tipo === 'grupo' ? e.items! : [e as {href: string; etiqueta: string; titulo?: string}];
    if (e.tipo === 'grupo') exige(claveGrupo(e.clave!));
    for (const i of items) { exige(claveItem(i.href)); if (i.titulo && i.titulo !== i.etiqueta) exige(claveTitulo(i.href)); }
    // La clave en español coincide con el rótulo canónico de menu.mjs (si uno cambia, el otro debe seguirlo).
    for (const i of items) assert.equal((es as Record<string, string>)[claveItem(i.href)], i.etiqueta, i.href);
  }
  assert.deepEqual(faltan, []);
});
test('el rótulo de las cuatro cifras de Hoy y el selector de idioma existen en inglés', () => {
  for (const k of ['hoy.kpi.ingreso', 'hoy.kpi.reembolsos', 'hoy.kpi.atorado', 'hoy.kpi.respuestas24', 'idioma.cambiar'] as Clave[]) assert.notEqual(en[k], es[k], k);
  assert.equal(en['idioma.cambiar'], 'Switch language to {idioma}');
});
test('periodos, cifras y moneda se formatean con la locale (es-MX / en-US) sin cambiar el valor', () => {
  assert.equal(periodoDelAlcance('2026-10-01', '2026-11-01', 'es'), '1 oct – 31 oct 2026');
  assert.equal(periodoDelAlcance('2026-10-01', '2026-11-01', 'en'), 'Oct 1 – Oct 31, 2026');
  assert.equal(periodoDelAlcance('2026-12-15', '2027-01-16', 'en'), 'Dec 15, 2026 – Jan 15, 2027');
  assert.equal(periodoDelAlcance('malo', 'x', 'en'), null);
  assert.equal(numero('en', 1234567.5), '1,234,567.5');
  assert.equal(numero('es', 1234567.5), '1,234,567.5');
  assert.equal(moneda('en', 1200, 'USD'), '$1,200.00');
  assert.equal(moneda('es', 1200, 'MXN'), '$1,200.00');
  assert.equal(fecha('en', '2026-10-05T00:00:00Z'), 'Oct 5, 2026');
  assert.match(fecha('es', '2026-10-05T00:00:00Z'), /^5 oct(\.)? 2026$/);
});
test('un solo mecanismo: login y espacio de trabajo resuelven el idioma con la misma cookie; el selector vive en el encabezado', () => {
  assert.match(leer('src/app/login/page.tsx'), /idiomaActual\(params\.lang\)/);
  assert.match(leer('src/app/login/page.tsx'), /GuardarIdioma/);
  assert.match(leer('src/app/(workspace)/layout.tsx'), /idiomaActual\(\)/);
  assert.match(leer('src/app/(workspace)/layout.tsx'), /IdiomaProvider/);
  assert.match(leer('src/components/workspace/shell.tsx'), /<SelectorIdioma\/>/);
  assert.match(leer('src/components/i18n/selector-idioma.tsx'), /aria-label=\{t\('idioma\.etiqueta'\)\}/);
  assert.match(leer('src/components/i18n/selector-idioma.tsx'), /guardarIdiomaEnNavegador\(/);
  assert.match(leer('src/lib/i18n/servidor.ts'), /COOKIE_IDIOMA/);
});
