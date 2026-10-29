// Enrutamiento por host: decisión pura (decidirHost) y middleware real. rovaq.ai sirve el sitio estático (español sin prefijo, inglés bajo /en), www redirige
// al apex, rutas de la aplicación en rovaq.ai van a app.rovaq.ai, lo desconocido da 404 propio y los hosts antiguos de Vercel redirigen en producción.
// Las reglas de configuración (reglasNext) y el matcher se prueban en host-routing-reglas.test.mjs; aquí, los casos por host.
import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {middleware} from '../src/middleware';
import {decidirHost, normalizarHost, rutaConAutenticacion, rutaSiempreAbierta, esActivoPublico, rutaPublicaDeInterna, destinoInterno, RUTAS_APP, ORIGEN_APP} from '../src/lib/host-routing.mjs';
import {PAGINAS, RUTAS} from '../src/content/sitio/registro.mjs';

const guardado = {...process.env};
afterEach(() => { for (const k of ['VERCEL_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) { if (guardado[k] === undefined) delete process.env[k]; else process.env[k] = guardado[k]; } });
const dec = (host: string, pathname: string, search = '', produccion = false) => decidirHost({host, pathname, search, produccion});
const pet = (host: string, ruta: string, extra: Record<string, string> = {}) => new NextRequest('https://' + host + ruta, {headers: {host, ...extra}});
const rw = (destino: string) => ({tipo: 'reescribir', destino});
const rd = (url: string) => ({tipo: 'redirigir', url, status: 308});
const nf = (destino: string) => ({tipo: 'reescribir', destino, noEncontrada: true});

test('normalizarHost: minúsculas, sin puerto ni punto final, primer valor de proxies', () => {
  assert.equal(normalizarHost('ROVAQ.AI:443'), 'rovaq.ai');
  assert.equal(normalizarHost('rovaq.ai.'), 'rovaq.ai');
  assert.equal(normalizarHost('www.rovaq.ai, otro.example'), 'www.rovaq.ai');
  assert.equal(normalizarHost(null), '');
});

// ---- rovaq.ai: tabla de casos escrita a mano (la expectativa no usa las funciones que se prueban) -----------------------------------------------
const TABLA_SITIO: [string, string, object][] = [
  ['/', '', rw('/sitio/es')],
  ['/', '?utm=1', rw('/sitio/es')],
  ['/en', '', rw('/sitio/en')],
  ['/en/', '', rd('/en')],
  ['/producto', '', rw('/sitio/es/producto')],
  ['/producto/', '?a=1', rd('/producto?a=1')],
  ['/producto/hoy', '', rw('/sitio/es/producto/hoy')],
  ['/producto/fuga-de-reembolsos', '', rw('/sitio/es/producto/fuga-de-reembolsos')],
  ['/en/product', '', rw('/sitio/en/product')],
  ['/en/product/today', '', rw('/sitio/en/product/today')],
  ['/en/product/refund-leakage', '', rw('/sitio/en/product/refund-leakage')],
  ['/casos-de-uso', '', rw('/sitio/es/casos-de-uso')],
  ['/casos-de-uso/lector', '', rw('/sitio/es/casos-de-uso/lector')],
  ['/en/use-cases/viewer', '', rw('/sitio/en/use-cases/viewer')],
  ['/seguridad-y-privacidad', '', rw('/sitio/es/seguridad-y-privacidad')],
  ['/en/security-and-privacy', '', rw('/sitio/en/security-and-privacy')],
  ['/blog', '', rw('/sitio/es/blog')],
  ['/en/blog', '', rw('/sitio/en/blog')],
  ['/blog/un-puesto-una-vista', '', rw('/sitio/es/blog/un-puesto-una-vista')],
  ['/solicitar-acceso', '?x=1&y=dos', rw('/sitio/es/solicitar-acceso')],
  ['/sitio/es', '', rd('/')],
  ['/sitio/es/', '', rd('/')],
  ['/sitio/es/producto', '?a=1', rd('/producto?a=1')],
  ['/sitio/en', '', rd('/en')],
  ['/sitio/en/product/today', '', rd('/en/product/today')],
  ['/landing', '?lang=es', rd('/?lang=es')],
  ['/landing/', '', rd('/')],
  ['/landing/en', '?x=1', rd('/en?x=1')],
  ['/landing/en/', '', rd('/en')],
  ['/login', '', rd('https://app.rovaq.ai/login')],
  ['/overview', '?periodo=30d&x=1', rd('https://app.rovaq.ai/overview?periodo=30d&x=1')],
  ['/overview/abc', '', rd('https://app.rovaq.ai/overview/abc')],
  ['/auth/callback', '?code=abc', rd('https://app.rovaq.ai/auth/callback?code=abc')],
  ['/platform', '', rd('https://app.rovaq.ai/platform')],
  ['/platform/organizaciones', '', rd('https://app.rovaq.ai/platform/organizaciones')],
  ['/seguridad', '', rd('https://app.rovaq.ai/seguridad')],
  ['/sin-acceso', '', rd('https://app.rovaq.ai/sin-acceso')],
  ['/cfo/data/report', '', rd('https://app.rovaq.ai/cfo/data/report')],
  ['/problems/12', '', rd('https://app.rovaq.ai/problems/12')],
  ['/settings/team', '', rd('https://app.rovaq.ai/settings/team')],
  ['/api/briefs/1/export', '', rd('https://app.rovaq.ai/api/briefs/1/export')],
  ['/api', '', rd('https://app.rovaq.ai/api')],
  ['/api/health', '', rd('https://app.rovaq.ai/api/health')],
  ['/api/internals', '', rd('https://app.rovaq.ai/api/internals')],
  ['/api/health/version/x', '', rd('https://app.rovaq.ai/api/health/version/x')],
  ['/api/health/version', '', {tipo: 'activo'}],
  ['/api/internal', '', {tipo: 'activo'}],
  ['/api/internal/cron/sync', '', {tipo: 'activo'}],
  ['/api/webhooks/hubspot', '', {tipo: 'activo'}],
  ['/robots.txt', '', {tipo: 'activo'}],
  ['/sitemap.xml', '', {tipo: 'activo'}],
  ['/favicon.ico', '', {tipo: 'activo'}],
  ['/icon-192.png', '', {tipo: 'activo'}],
  ['/opengraph-image', '', {tipo: 'activo'}],
  ['/s/nube.ab12cd34.js', '', {tipo: 'activo'}],
  ['/s/pts/hero.3b1a371a.pts', '', {tipo: 'activo'}],
  ['/vendor/lenis-1.1.13.min.js', '', {tipo: 'activo'}],
  ['/fonts/hankengrotesk-600.woff2', '', {tipo: 'activo'}],
  ['/.well-known/security.txt', '', {tipo: 'activo'}],
  ['/llms.txt', '', {tipo: 'activo'}],
  ['/en/llms.txt', '', {tipo: 'activo'}],
  ['/blog/rss.xml', '', {tipo: 'activo'}],
  ['/pagina-que-no-existe', '', nf('/sitio/es/__404')],
  ['/producto/no-existe', '', nf('/sitio/es/__404')],
  ['/en/nope', '', nf('/sitio/en/__404')],
  ['/en/product/nope', '', nf('/sitio/en/__404')],
  ['/es', '', nf('/sitio/es/__404')],
  ['/EN', '', nf('/sitio/es/__404')],
  ['/s', '', nf('/sitio/es/__404')],
  ['/s/', '', nf('/sitio/es/__404')],
  ['/vendor/x', '', nf('/sitio/es/__404')],
  ['/s/../login', '', nf('/sitio/es/__404')],
  ['/sitio', '', nf('/sitio/es/__404')],
  ['/sitio/fr', '', nf('/sitio/es/__404')],
  ['/loginx', '', nf('/sitio/es/__404')],
  ['/overviews', '', nf('/sitio/es/__404')],
];
test(`rovaq.ai: ${TABLA_SITIO.length} casos escritos a mano (sitio, redirecciones, app, activos y 404 propio)`, () => {
  assert.ok(TABLA_SITIO.length >= 60);
  for (const h of ['rovaq.ai', 'ROVAQ.AI', 'rovaq.ai:443', 'rovaq.ai.'])
    for (const [ruta, search, esperado] of TABLA_SITIO) assert.deepEqual(dec(h, ruta, search), esperado, `${h} ${ruta}${search}`);
});
test('rovaq.ai: las 68 rutas del registro (34 páginas por idioma) se reescriben a /sitio/<lang>/... con la expectativa escrita aparte', () => {
  assert.equal(RUTAS.length, 68);
  for (const p of PAGINAS) {
    const es = p.es.ruta, en = p.en.ruta;
    assert.deepEqual(dec('rovaq.ai', es), rw(es === '/' ? '/sitio/es' : '/sitio/es' + es), p.id + ' es');
    assert.deepEqual(dec('rovaq.ai', en), rw(en === '/en' ? '/sitio/en' : '/sitio/en' + en.slice(3)), p.id + ' en');
    if (es !== '/') assert.deepEqual(dec('rovaq.ai', es + '/', '?q=1'), rd(es + '?q=1'), p.id + ' barra final es');
    assert.ok(en === '/en' || en.startsWith('/en/'), p.id + ' inglés bajo /en');
    assert.ok(es === '/' || !es.startsWith('/en'), p.id + ' español sin prefijo');
  }
});
test('rovaq.ai: la expectativa del 404 propio es una reescritura, nunca una redirección a la aplicación', () => {
  for (const r of ['/xyz', '/a/b/c', '/en/xyz', '/robots', '/producto/hoy/extra', '/blog/articulo-inventado']) {
    const d = dec('rovaq.ai', r) as {tipo: string; noEncontrada?: boolean};
    assert.equal(d.tipo, 'reescribir', r); assert.equal(d.noEncontrada, true, r);
  }
});
test('rovaq.ai: activo no depende de la autenticación; esActivoPublico rechaza rutas de la app y trucos', () => {
  for (const r of ['/overview', '/icon-evil.js', '/vendor', '/vendor/', '/vendor/x', '/s', '/s/x', '/vendorx/a.js', '/sx/a.js', '/s/../x.js', '/landing/nube.js'])
    assert.equal(esActivoPublico(r), false, r);
  for (const r of ['/vendor/lenis-1.1.13.min.js', '/s/a.b.js', '/s/pts/x.pts', '/s/img/o.webp', '/favicon-32x32.png', '/icon-maskable-512.png']) assert.equal(esActivoPublico(r), true, r);
});

// ---- www: todo redirige al apex ----------------------------------------------------------------------------------------------------------------
test('www.rovaq.ai: 308 al apex conservando ruta y consulta, para todo (sitio, app, activos y desconocidas)', () => {
  const rutas = [...RUTAS, '/login', '/overview', '/api/x', '/api/health/version', '/robots.txt', '/s/a.js', '/vendor/a.js', '/zzz', '/sitio/es', '/landing', '/sin-acceso'];
  assert.ok(rutas.length >= 70);
  for (const h of ['www.rovaq.ai', 'WWW.ROVAQ.AI:443'])
    for (const r of rutas) {
      assert.deepEqual(dec(h, r), rd('https://rovaq.ai' + r), h + r);
      assert.deepEqual(dec(h, r, '?a=1&b=2'), rd('https://rovaq.ai' + r + '?a=1&b=2'), h + r + ' con consulta');
    }
});

// ---- app.rovaq.ai, hosts antiguos, vistas previas y desarrollo ---------------------------------------------------------------------------------
test('app.rovaq.ai sin cambio en cualquier ruta de la aplicación, también en producción', () => {
  const rutas = ['/', '/login', '/overview', '/overview/x', '/problems', '/problems/1', '/customers', '/briefs/2', '/cfo', '/cfo/data/report', '/platform', '/platform/organizaciones', '/seguridad', '/sin-acceso', '/auth/callback', '/auth/logout',
    '/api/x', '/api/health/version', '/api/internal/cron', '/api/webhooks/a', '/settings/team', '/workload', '/pain-points', '/economics', '/robots.txt', '/sitemap.xml', '/opengraph-image', '/favicon.ico', '/fonts/a.woff2', '/_next/static/a.js',
    '/producto', '/en', '/en/product', '/landing', '/ruta-desconocida', '/s/a.js', '/vendor/a.js'];
  assert.ok(rutas.length >= 36);
  for (const prod of [false, true]) for (const r of rutas) assert.deepEqual(dec('app.rovaq.ai', r, '?a=1', prod), {tipo: 'pasar'}, `app ${r} produccion=${prod}`);
});
test('app.rovaq.ai: /sitio/... pasa en local y en vistas previas y redirige a rovaq.ai solo en producción', () => {
  for (const r of ['/sitio/es', '/sitio/es/producto', '/sitio/en', '/sitio/en/product/today', '/sitio', '/sitio/zz']) assert.deepEqual(dec('app.rovaq.ai', r), {tipo: 'pasar'}, r);
  assert.deepEqual(dec('app.rovaq.ai', '/sitio/es', '', true), rd('https://rovaq.ai/'));
  assert.deepEqual(dec('app.rovaq.ai', '/sitio/es/producto', '?a=1', true), rd('https://rovaq.ai/producto?a=1'));
  assert.deepEqual(dec('app.rovaq.ai', '/sitio/en', '', true), rd('https://rovaq.ai/en'));
  assert.deepEqual(dec('app.rovaq.ai', '/sitio/en/product/today', '', true), rd('https://rovaq.ai/en/product/today'));
  assert.deepEqual(dec('app.rovaq.ai', '/sitio', '', true), rd('https://rovaq.ai/'));
  assert.deepEqual(dec('app.rovaq.ai', '/sitio/zz', '', true), rd('https://rovaq.ai/'));
  assert.deepEqual(dec('app.rovaq.ai', '/sitiox', '', true), {tipo: 'pasar'});
});
test('endpoints abiertos en cualquier host: /api/health/version, /api/internal y /api/webhooks', () => {
  for (const r of ['/api/health/version', '/api/internal', '/api/internal/cron/sync', '/api/webhooks', '/api/webhooks/hubspot']) { assert.equal(rutaSiempreAbierta(r), true, r); assert.equal(dec('rovaq.ai', r).tipo, 'activo', 'rovaq.ai ' + r); assert.equal(dec('vexa-ai.vercel.app', r, '', true).tipo, 'activo', 'vexa-ai ' + r); assert.equal(dec('rovaq-ai.vercel.app', r, '', true).tipo, 'activo', 'rovaq-ai ' + r); }
  for (const r of ['/api/health', '/api/health/version/x', '/api/internals', '/api/webhooksx', '/api/auth']) assert.equal(rutaSiempreAbierta(r), false, r);
});
test('hosts antiguos de Vercel en producción: 308 a app.rovaq.ai conservando path y query, salvo los endpoints abiertos', () => {
  const rutas = ['/', '/overview', '/login', '/producto', '/en', '/sitio/es', '/problems/3', '/auth/callback', '/robots.txt', '/s/a.js', '/zzz'];
  for (const h of ['rovaq-ai.vercel.app', 'vexa-ai.vercel.app', 'VEXA-AI.VERCEL.APP'])
    for (const r of rutas) {
      assert.deepEqual(dec(h, r, '?a=1&b=dos', true), rd(ORIGEN_APP + r + '?a=1&b=dos'), h + r);
      assert.equal(dec(h, r, '', false).tipo, 'pasar', 'fuera de producción no redirige ' + h + r);
    }
});
test('desarrollo, vistas previas y hosts parecidos: sin cambio', () => {
  for (const h of ['localhost:3000', '127.0.0.1:3911', 'vexa-ai-git-rama-equipo.vercel.app', 'rovaq.ai.evil.example', 'notrovaq.ai', 'rovaq.ai.mx', 'app.rovaq.ai.evil.example', 'sub.rovaq.ai', 'evilrovaq.ai', ''])
    for (const r of ['/', '/login', '/overview', '/producto', '/landing', '/api/x', '/sitio/es']) assert.equal(dec(h, r, '', true).tipo, 'pasar', h + r);
});

// ---- contratos de las funciones auxiliares ------------------------------------------------------------------------------------------------------
test('rutaPublicaDeInterna y destinoInterno son inversas para las rutas del registro', () => {
  for (const r of RUTAS) assert.equal(rutaPublicaDeInterna(destinoInterno(r)), r, r);
  assert.equal(rutaPublicaDeInterna('/sitio'), null); assert.equal(rutaPublicaDeInterna('/sitio/fr'), null); assert.equal(rutaPublicaDeInterna('/sitio/esx'), null); assert.equal(rutaPublicaDeInterna('/producto'), null);
});
test('RUTAS_APP: sin /api (tiene su excepción) y con /login', () => {
  assert.ok(!RUTAS_APP.includes('/api')); assert.ok(RUTAS_APP.includes('/login')); assert.ok(RUTAS_APP.includes('/platform'));
});
test('rutaConAutenticacion conserva exactamente la lista anterior del matcher', () => {
  for (const r of ['/', '/seguridad', '/sin-acceso', '/login', '/api', '/api/x/y', '/platform', '/platform/z', '/cfo', '/cfo/data', '/auth', '/auth/callback', '/overview/a', '/problems', '/customers/1', '/recommendations', '/explorer', '/preguntale', '/interventions', '/briefs/2']) assert.equal(rutaConAutenticacion(r), true, r);
  for (const r of ['/landing', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/opengraph-image', '/twitter-image', '/favicon.ico', '/.well-known/security.txt', '/humans.txt', '/login/x', '/seguridad/x', '/mapa', '/settings', '/workload', '/confianza']) assert.equal(rutaConAutenticacion(r), false, r);
});

// ---- middleware real (respaldo Fase B en rovaq.ai y comportamiento en los demás hosts) ---------------------------------------------------------------------
test('middleware (respaldo): rovaq.ai/ reescribe a /sitio/es y /en a /sitio/en conservando la consulta, sin cabecera x-rovaq-lang', async () => {
  const r = await middleware(pet('rovaq.ai', '/?lang=es'));
  assert.equal(r.status, 200); assert.match(r.headers.get('x-middleware-rewrite') ?? '', /^https:\/\/rovaq\.ai\/sitio\/es\?lang=es$/);
  const en = await middleware(pet('rovaq.ai', '/en?x=1'));
  assert.match(en.headers.get('x-middleware-rewrite') ?? '', /^https:\/\/rovaq\.ai\/sitio\/en\?x=1$/);
  assert.ok(![...r.headers.keys()].some((k) => /x-rovaq-lang/i.test(k)));
});
test('middleware (respaldo): /login en rovaq.ai redirige 308, una desconocida se reescribe al 404 del sitio y www redirige al apex', async () => {
  const login = await middleware(pet('rovaq.ai', '/login')); assert.equal(login.status, 308); assert.equal(login.headers.get('location'), 'https://app.rovaq.ai/login');
  // El 404 se sirve con HTML completo desde el segmento __404 y estado 404 real (no el cascarón de error de Next).
  const x = await middleware(pet('rovaq.ai', '/no-existe?a=1')); assert.equal(x.status, 404); assert.match(x.headers.get('x-middleware-rewrite') ?? '', /^https:\/\/rovaq\.ai\/sitio\/es\/__404$/);
  const w = await middleware(pet('www.rovaq.ai', '/producto?z=1')); assert.equal(w.status, 308); assert.equal(w.headers.get('location'), 'https://rovaq.ai/producto?z=1');
});
test('middleware: rovaq.ai sirve activos y no pide autenticación', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:56321'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key';
  for (const ruta of ['/robots.txt', '/sitemap.xml', '/opengraph-image', '/fonts/a.woff2', '/api/health/version', '/s/nube.ab12cd34.js', '/vendor/lenis-1.1.13.min.js']) {
    const r = await middleware(pet('rovaq.ai', ruta));
    assert.equal(r.status, 200, ruta); assert.equal(r.headers.get('location'), null, ruta); assert.equal(r.headers.get('x-middleware-rewrite'), null, ruta);
  }
});
test('middleware: x-forwarded-host manda sobre host', async () => {
  const r = await middleware(pet('interno.vercel.app', '/login', {'x-forwarded-host': 'rovaq.ai'}));
  assert.equal(r.status, 308); assert.equal(r.headers.get('location'), 'https://app.rovaq.ai/login');
});
test('middleware: hosts antiguos redirigen solo en producción; salud y webhooks responden', async () => {
  process.env.VERCEL_ENV = 'production';
  const r = await middleware(pet('vexa-ai.vercel.app', '/overview?p=1'));
  assert.equal(r.status, 308); assert.equal(r.headers.get('location'), 'https://app.rovaq.ai/overview?p=1');
  for (const ruta of ['/api/health/version', '/api/internal/x', '/api/webhooks/y']) { const o = await middleware(pet('rovaq-ai.vercel.app', ruta)); assert.equal(o.status, 200, ruta); assert.equal(o.headers.get('location'), null, ruta); }
  process.env.VERCEL_ENV = 'preview';
  const p = await middleware(pet('vexa-ai.vercel.app', '/overview'));
  assert.notEqual(p.status, 308);
});
test('middleware: app.rovaq.ai sigue igual (rutas fuera de la lista pasan intactas, sin cabeceras privadas nuevas)', async () => {
  for (const ruta of ['/landing', '/robots.txt', '/opengraph-image', '/settings/team', '/workload', '/sitio/es']) {
    const r = await middleware(pet('app.rovaq.ai', ruta));
    assert.equal(r.status, 200, ruta); assert.equal(r.headers.get('location'), null, ruta); assert.equal(r.headers.get('x-middleware-rewrite'), null, ruta); assert.equal(r.headers.get('cache-control'), null, ruta);
  }
  const sinConfig = await middleware(pet('app.rovaq.ai', '/overview'));
  assert.equal(sinConfig.status, 200); assert.equal(sinConfig.headers.get('location'), null);
});
test('middleware: en producción /sitio/es en app.rovaq.ai redirige a rovaq.ai', async () => {
  process.env.VERCEL_ENV = 'production';
  const r = await middleware(pet('app.rovaq.ai', '/sitio/es/producto?a=1'));
  assert.equal(r.status, 308); assert.equal(r.headers.get('location'), 'https://rovaq.ai/producto?a=1');
});

test('R2-17: barras iniciales tras /sitio/<idioma> no producen una redirección a otro host', () => {
  for (const [ruta, esperada] of [['/sitio/es//evil.example/x', '/evil.example/x'], ['/sitio/es///evil.example', '/evil.example'], ['/sitio/en//evil.example/x', '/en/evil.example/x']]) {
    const d = decidirHost({host: 'rovaq.ai', pathname: ruta, search: '?y'}) as {tipo: string; url: string};
    assert.equal(d.tipo, 'redirigir');
    assert.equal(d.url, esperada + '?y');
    assert.ok(!d.url.startsWith('//'), 'nunca una URL relativa al protocolo: ' + d.url);
    assert.equal(new URL(d.url, 'https://rovaq.ai').origin, 'https://rovaq.ai');
  }
});

test('middleware: páginas no publicables responden 404 desde __404; las publicables 200; Accept text/markdown reescribe al espejo con sus cabeceras', async () => {
  const pendiente = await middleware(pet('rovaq.ai', '/producto'));
  assert.equal(pendiente.status, 404); assert.match(pendiente.headers.get('x-middleware-rewrite') ?? '', /\/sitio\/es\/__404$/);
  const pendienteEn = await middleware(pet('rovaq.ai', '/en/product'));
  assert.equal(pendienteEn.status, 404); assert.match(pendienteEn.headers.get('x-middleware-rewrite') ?? '', /\/sitio\/en\/__404$/);
  const html = await middleware(pet('rovaq.ai', '/producto/hoy'));
  assert.equal(html.status, 200); assert.match(html.headers.get('x-middleware-rewrite') ?? '', /\/sitio\/es\/producto\/hoy$/);
  const md = await middleware(pet('rovaq.ai', '/producto/hoy', {accept: 'text/markdown'}));
  assert.equal(md.status, 200); assert.match(md.headers.get('x-middleware-rewrite') ?? '', /\/s\/md\/es\/hoy\.[0-9a-f]{8}\.md$/);
  assert.equal(md.headers.get('content-type'), 'text/markdown; charset=utf-8'); assert.equal(md.headers.get('vary'), 'Accept');
  assert.equal(md.headers.get('x-robots-tag'), 'noindex'); assert.equal(md.headers.get('link'), '<https://rovaq.ai/producto/hoy>; rel="canonical"');
  const nav = await middleware(pet('rovaq.ai', '/producto/hoy', {accept: 'text/html,application/xhtml+xml,*/*;q=0.8'}));
  assert.match(nav.headers.get('x-middleware-rewrite') ?? '', /\/sitio\/es\/producto\/hoy$/, 'un navegador recibe HTML');
  const app = await middleware(pet('app.rovaq.ai', '/login', {accept: 'text/markdown'}));
  assert.equal(app.headers.get('content-type')?.includes('markdown') ?? false, false, 'la app no negocia Markdown');
});
