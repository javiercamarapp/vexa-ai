// Idioma conmutable (es/en): diccionarios con las mismas claves, cookie inválida cae a español, el menú está traducido y el mecanismo es único (login + espacio de trabajo).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {traducir, resolverIdioma, idiomaDeAcceptLanguage, idiomaValido, cookieIdioma, COOKIE_IDIOMA, IDIOMA_POR_OMISION, type Clave} from '../src/lib/i18n';
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
test('inglés por omisión: sin cookie válida ni ?lang= es en; Accept-Language ya no decide; solo cookie o ?lang= dan español', () => {
  assert.equal(IDIOMA_POR_OMISION, 'en');
  assert.equal(resolverIdioma({}), 'en');
  assert.equal(resolverIdioma({cookie: 'fr'}), 'en');
  assert.equal(resolverIdioma({cookie: 'EN'}), 'en');
  assert.equal(resolverIdioma({cookie: '<script>'}), 'en');
  assert.equal(resolverIdioma({cookie: ''}), 'en');
  assert.equal(resolverIdioma({cookie: 'fr', acceptLanguage: 'es-MX,es;q=0.9'}), 'en', 'cookie inválida + navegador en español: inglés');
  assert.equal(resolverIdioma({acceptLanguage: 'es-MX,es;q=0.9'}), 'en', 'el navegador en español no cambia el idioma');
  assert.equal(resolverIdioma({acceptLanguage: 'de-DE,de;q=0.9'}), 'en');
  assert.equal(resolverIdioma({cookie: 'es'}), 'es');
  assert.equal(resolverIdioma({cookie: 'en', acceptLanguage: 'es'}), 'en');
  assert.equal(resolverIdioma({cookie: 'es', acceptLanguage: 'en-US'}), 'es');
  assert.equal(resolverIdioma({parametro: 'es'}), 'es', '?lang=es sin cookie');
  assert.equal(resolverIdioma({parametro: 'en', cookie: 'es'}), 'en', '?lang= válido manda sobre la cookie');
  assert.equal(resolverIdioma({parametro: 'xx', cookie: 'es'}), 'es', '?lang= inválido se ignora');
  assert.equal(resolverIdioma({parametro: 'xx'}), 'en');
});
test('el idioma de la petición no lee Accept-Language y <html lang> sigue al idioma activo', () => {
  assert.doesNotMatch(leer('src/lib/i18n/servidor.ts'), /headers\(\)|\.get\('accept-language'\)/i);
  assert.match(leer('src/app/(app)/layout.tsx'), /<html lang=\{idioma\}/);
  assert.match(leer('src/app/(app)/layout.tsx'), /await idiomaActual\(\)/);
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
  assert.match(leer('src/app/(app)/login/page.tsx'), /idiomaActual\(params\.lang\)/);
  assert.match(leer('src/app/(app)/login/page.tsx'), /GuardarIdioma/);
  assert.match(leer('src/app/(app)/(workspace)/layout.tsx'), /idiomaActual\(\)/);
  assert.match(leer('src/app/(app)/(workspace)/layout.tsx'), /IdiomaProvider/);
  assert.match(leer('src/components/workspace/shell.tsx'), /<SelectorIdioma\/>/);
  assert.match(leer('src/components/i18n/selector-idioma.tsx'), /<legend className="sr-only">\{t\('idioma\.etiqueta'\)\}<\/legend>/);
  assert.match(leer('src/components/i18n/selector-idioma.tsx'), /guardarIdiomaEnNavegador\(/);
  assert.match(leer('src/lib/i18n/servidor.ts'), /COOKIE_IDIOMA/);
});

test('Hoy: el modelo arma el texto en el idioma pedido (en por omisión) sin cambiar las cifras', async () => {
  const {armarHoy} = await import('../src/components/hoy/hoy-modelo.mjs');
  const estado = {fuga: 'vacio', carga: 'vacio', cfo: 'vacio'} as const;
  const es0 = armarHoy({estado: {...estado}}), en0 = armarHoy({estado: {...estado}, idioma: 'en'});
  assert.equal(es0.titular.texto, 'Todavía no hay datos suficientes para resumir tu dinero de este periodo.');
  assert.equal(en0.titular.texto, 'There is not enough data yet to summarize your money for this period.');
  assert.deepEqual(en0.kpis.map((k) => k.etiqueta), ['Gross revenue', 'Refunds', 'Stuck money', 'Replies >24 h']);
});
test('formateadores centrales: la locale solo cambia la presentación (mes, %), no el valor', async () => {
  const f = await import('../src/lib/formato/es-mx.mjs');
  assert.equal(f.dia('2026-09-18'), '18 sep 2026'); assert.equal(f.dia('2026-09-18', 'en'), 'Sep 18, 2026');
  assert.equal(f.porcentaje(29.34), '29.3 %'); assert.equal(f.porcentaje(29.34, {idioma: 'en'}), '29.3%');
  assert.equal(f.usd('12345640'), 'US$123,456'); assert.equal(f.usd('12345640', {idioma: 'en'}), 'US$123,456');
  const c = await import('../../../packages/cfo-copilot/src/format.mjs');
  assert.equal(c.monthLabel('2026-03'), 'mar 2026'); assert.equal(c.monthLabel('2026-03', 'en'), 'Mar 2026');
});

// ---- Calidad del inglés (T40): sin español suelto, sin «», comillas curvas, ortografía americana y términos unificados ----
const EN = en as Record<string, string>;
const sinVars = (t: string) => t.replace(/\{\w+\}/g, '');
const SUELTAS_ES = ['Cancelar', 'Copiar', 'Copiado', 'Leyenda', 'Filtros', 'Tendencia', 'Quitar', 'Cargando', 'Guardar', 'Cerrar', 'Buscar', 'Eliminar', 'Editar', 'Aceptar', 'Continuar', 'Volver', 'Siguiente', 'Anterior', 'Aplicar', 'Enviar', 'Limpiar', 'Todos', 'Todas', 'Ninguno', 'Ninguna', 'Detalle', 'Fecha', 'Estado', 'Acciones', 'Opciones', 'Confirmar', 'Salir', 'Reintentar', 'Aviso', 'Alerta', 'Cobertura', 'Ingresos', 'Reembolsos', 'Pedidos', 'Ventas', 'Clientes', 'Problemas'];
test('inglés: ningún valor es una palabra suelta en español ni lleva comillas angulares «» (solo el autónimo «Español»)', () => {
  const sueltas = Object.entries(EN).filter(([, v]) => SUELTAS_ES.includes(v.trim())).map(([k, v]) => `${k}=${v}`);
  assert.deepEqual(sueltas, [], 'palabra suelta en español en el diccionario inglés');
  assert.deepEqual(Object.entries(EN).filter(([, v]) => /[«»]/.test(v)).map(([k]) => k), [], 'comillas angulares en inglés: usa “…”');
  assert.equal(EN['idioma.es'], 'Español');
});
test('inglés: comillas curvas consistentes (nunca rectas alrededor de palabras ni angulares) y pares balanceados', () => {
  assert.deepEqual(Object.entries(EN).filter(([, v]) => /"[^"\n]+"/.test(v)).map(([k]) => k), [], 'comillas rectas en inglés: usa “…”');
  for (const [k, v] of Object.entries(EN)) assert.equal((v.match(/“/g) ?? []).length, (v.match(/”/g) ?? []).length, 'comillas curvas desparejadas: ' + k);
});
test('inglés americano: analyze/canceled/recognized (no analyse/cancelled/recognised) y un solo término por rol', () => {
  const malos = Object.entries(EN).filter(([, v]) => /\b(analysed|analysing|analyse)\b|cancell(ed|ing)|recognis/i.test(v)).map(([k, v]) => `${k}: ${v.slice(0, 60)}`);
  assert.deepEqual(malos, [], 'ortografía británica');
  assert.deepEqual(Object.entries(EN).filter(([, v]) => /\b(owners?|viewers?|readers?)\b/i.test(sinVars(v))).map(([k]) => k), [], 'rol sin unificar: Workspace administrator / Read-only');
  assert.equal(EN['tr.pp.btnAnalizar'], 'Analyze'); assert.match(EN['tr.err.agCancelado'], /^Canceled/);
  const roles = Object.entries(EN).filter(([k]) => /shell\.rol\./.test(k)).map(([, v]) => v);
  assert.ok(roles.includes('Workspace administrator') && roles.includes('Read-only'), roles.join('|'));
});
test('inglés: fechas, cifras y moneda salen con el locale del idioma activo (en-US) y no con es-MX fijo', async () => {
  const {formatosDe} = await import('../src/lib/i18n/formatos');
  const iso = '2026-10-20T14:05:00Z', en = formatosDe('en'), es = formatosDe('es');
  assert.match(en.fechaHora(iso) ?? '', /Oct/); assert.match(es.fechaHora(iso) ?? '', /oct/);
  assert.notEqual(en.fechaHora(iso), es.fechaHora(iso));
  assert.equal(en.locale, 'en-US'); assert.equal(es.locale, 'es-MX');
  const eventos = leer('src/components/platform/eventos-seguridad.tsx');
  assert.ok(!/toLocale\w*String\('es-MX'\)/.test(eventos) && /fmt\.fechaHora\(e\.at\)/.test(eventos), 'eventos de seguridad: fecha con el idioma activo');
});
test('el cascarón (enlace de salto, encabezado, lema) y los metadatos salen por clave y por idioma', () => {
  const layout = leer('src/app/(app)/layout.tsx');
  assert.match(layout, /t\("tr\.shell\.saltar"\)/); assert.match(layout, /t\("tr\.shell\.inicioAria"\)/); assert.match(layout, /t\("tr\.shell\.lema"\)/); assert.match(layout, /<html lang=\{idioma\}/);
  assert.ok(!/>Saltar al contenido</.test(layout) && !/Decisiones con evidencia</.test(layout));
  assert.equal(EN['tr.shell.saltar'], 'Skip to content'); assert.equal((es as Record<string, string>)['tr.shell.saltar'], 'Saltar al contenido');
  assert.match(layout, /export async function generateMetadata/);
});
