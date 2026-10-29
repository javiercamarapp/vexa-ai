// Enrutamiento por host: decisión pura y middleware real. rovaq.ai sirve la landing, app.rovaq.ai queda igual y los hosts antiguos de Vercel redirigen en producción.
import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {middleware} from '../src/middleware';
import {decidirHost, normalizarHost, rutaConAutenticacion, rutaSiempreAbierta, esActivoPublico, ORIGEN_APP} from '../src/lib/host-routing.mjs';

const guardado = {...process.env};
afterEach(() => { for (const k of ['VERCEL_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) { if (guardado[k] === undefined) delete process.env[k]; else process.env[k] = guardado[k]; } });
const dec = (host: string, pathname: string, search = '', produccion = false) => decidirHost({host, pathname, search, produccion});
const pet = (host: string, ruta: string, extra: Record<string, string> = {}) => new NextRequest('https://' + host + ruta, {headers: {host, ...extra}});

test('normalizarHost: minúsculas, sin puerto ni punto final, primer valor de proxies', () => {
  assert.equal(normalizarHost('ROVAQ.AI:443'), 'rovaq.ai');
  assert.equal(normalizarHost('rovaq.ai.'), 'rovaq.ai');
  assert.equal(normalizarHost('www.rovaq.ai, otro.example'), 'www.rovaq.ai');
  assert.equal(normalizarHost(null), '');
});
test('rovaq.ai y www: la raíz se reescribe a la landing; /landing vuelve a la raíz', () => {
  for (const h of ['rovaq.ai', 'www.rovaq.ai']) {
    assert.deepEqual(dec(h, '/'), {tipo: 'reescribir', destino: '/landing'});
    assert.deepEqual(dec(h, '/landing', '?lang=es'), {tipo: 'redirigir', url: '/?lang=es', status: 308});
  }
});
test('rovaq.ai: cualquier otra ruta redirige 308 a app.rovaq.ai con el mismo path y query', () => {
  assert.deepEqual(dec('rovaq.ai', '/login'), {tipo: 'redirigir', url: ORIGEN_APP + '/login', status: 308});
  assert.deepEqual(dec('www.rovaq.ai', '/overview', '?periodo=30d&x=1'), {tipo: 'redirigir', url: 'https://app.rovaq.ai/overview?periodo=30d&x=1', status: 308});
  assert.deepEqual(dec('rovaq.ai', '/auth/callback', '?code=abc'), {tipo: 'redirigir', url: 'https://app.rovaq.ai/auth/callback?code=abc', status: 308});
  assert.equal(dec('rovaq.ai', '/api/briefs/1/export').tipo, 'redirigir');
});
test('rovaq.ai: fuentes, marca, íconos, imágenes sociales, robots y sitemap se sirven sin redirigir', () => {
  for (const r of ['/_next/static/chunks/a.js', '/_next/image', '/fonts/hankengrotesk-600.woff2', '/brand/rovaq-logo-horizontal-positivo.svg', '/images/login-hero.png', '/favicon.ico', '/favicon.svg', '/favicon-32x32.png', '/icon-192.png', '/icon-maskable-512.png', '/apple-touch-icon.png', '/site.webmanifest', '/robots.txt', '/sitemap.xml', '/opengraph-image', '/twitter-image', '/humans.txt', '/.well-known/security.txt'])
    assert.equal(dec('rovaq.ai', r).tipo, 'activo', r);
  assert.equal(esActivoPublico('/overview'), false);
  assert.equal(esActivoPublico('/icon-evil.js'), false);
});
test('rovaq.ai: español sin prefijo e inglés bajo /en, con /landing y /landing/en redirigiendo a la URL pública', () => {
  for (const h of ['rovaq.ai', 'www.rovaq.ai', 'ROVAQ.AI:443']) {
    assert.deepEqual(dec(h, '/en'), {tipo: 'reescribir', destino: '/landing/en'});
    assert.deepEqual(dec(h, '/en/'), {tipo: 'reescribir', destino: '/landing/en'});
    assert.deepEqual(dec(h, '/landing/en', '?x=1'), {tipo: 'redirigir', url: '/en?x=1', status: 308});
    assert.deepEqual(dec(h, '/landing/en/'), {tipo: 'redirigir', url: '/en', status: 308});
    assert.deepEqual(dec(h, '/landing/'), {tipo: 'redirigir', url: '/', status: 308});
  }
  for (const r of ['/EN', '/en/otra', '/en/product', '/es']) assert.equal(dec('rovaq.ai', r).tipo, 'redirigir', r);
});
test('rovaq.ai: /vendor y /landing/<archivo> se sirven como activos (antes redirigían 308 a la app y la escena 3D no cargaba)', () => {
  for (const r of ['/vendor/gsap-3.13.0.min.js', '/vendor/ScrollTrigger-3.13.0.min.js', '/vendor/lenis-1.1.13.min.js', '/landing/nube.js', '/landing/escena.js', '/landing/pts/nucleo.ab12cd34.pts', '/landing/3d/nucleo.glb', '/landing/objeto-1.webp', '/landing/pts/manifest.json'])
    for (const h of ['rovaq.ai', 'www.rovaq.ai']) assert.deepEqual(dec(h, r), {tipo: 'activo'}, h + r);
  for (const r of ['/vendor', '/vendor/', '/vendor/x', '/landing/x', '/landing/../login', '/landing/a/../../overview.js', '/vendorx/a.js', '/landingx/a.js'])
    assert.equal(dec('rovaq.ai', r).tipo, 'redirigir', r);
  assert.equal(esActivoPublico('/vendor/a.js'), true); assert.equal(esActivoPublico('/landing'), false); assert.equal(esActivoPublico('/landing/en'), false);
});
test('el matcher del middleware excluye /vendor y los archivos de /landing, pero no las páginas /landing ni /landing/en', async () => {
  const fuente = (await import('node:fs')).readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8');
  const m = /matcher:\s*\['([^']+)'\]/.exec(fuente)!; const re = new RegExp('^' + m[1].replace(/\\\\/g, '\\') + '$');
  for (const r of ['/vendor/gsap-3.13.0.min.js', '/landing/escena.js', '/landing/pts/a.pts', '/landing/3d/a.glb', '/_next/static/a.js', '/fonts/a.woff2']) assert.equal(re.test(r), false, 'excluido ' + r);
  for (const r of ['/', '/en', '/landing', '/landing/en', '/overview', '/login', '/api/x']) assert.equal(re.test(r), true, 'pasa por middleware ' + r);
});
test('middleware real en rovaq.ai: /en reescribe, los activos pasan sin redirigir y lo demás va a la app', async () => {
  const en = await middleware(pet('rovaq.ai', '/en?x=1')); assert.equal(en.status, 200); assert.match(en.headers.get('x-middleware-rewrite') ?? '', /\/landing\/en\?x=1/);
  for (const r of ['/vendor/gsap-3.13.0.min.js', '/landing/pts/a.pts', '/landing/3d/a.glb', '/landing/escena.js']) { const x = await middleware(pet('rovaq.ai', r)); assert.equal(x.status, 200, r); assert.equal(x.headers.get('location'), null, r); }
  const login = await middleware(pet('rovaq.ai', '/login')); assert.equal(login.status, 308); assert.equal(login.headers.get('location'), 'https://app.rovaq.ai/login');
});
test('endpoints abiertos en cualquier host: /api/health/version, /api/internal y /api/webhooks', () => {
  for (const r of ['/api/health/version', '/api/internal', '/api/internal/cron/sync', '/api/webhooks', '/api/webhooks/hubspot']) { assert.equal(rutaSiempreAbierta(r), true, r); assert.equal(dec('rovaq.ai', r).tipo, 'activo', 'rovaq.ai ' + r); assert.equal(dec('vexa-ai.vercel.app', r, '', true).tipo, 'activo', 'vexa-ai ' + r); assert.equal(dec('rovaq-ai.vercel.app', r, '', true).tipo, 'activo', 'rovaq-ai ' + r); }
  for (const r of ['/api/health', '/api/health/version/x', '/api/internals', '/api/webhooksx', '/api/auth']) assert.equal(rutaSiempreAbierta(r), false, r);
});
test('hosts antiguos de Vercel en producción: 308 a app.rovaq.ai conservando path y query, salvo los endpoints abiertos', () => {
  for (const h of ['rovaq-ai.vercel.app', 'vexa-ai.vercel.app']) {
    assert.deepEqual(dec(h, '/', '', true), {tipo: 'redirigir', url: 'https://app.rovaq.ai/', status: 308});
    assert.deepEqual(dec(h, '/overview', '?a=1&b=dos', true), {tipo: 'redirigir', url: 'https://app.rovaq.ai/overview?a=1&b=dos', status: 308});
    assert.deepEqual(dec(h.toUpperCase(), '/login', '', true), {tipo: 'redirigir', url: 'https://app.rovaq.ai/login', status: 308});
    assert.equal(dec(h, '/overview', '', false).tipo, 'pasar', 'fuera de producción no redirige');
  }
});
test('app.rovaq.ai, desarrollo y vistas previas: sin cambio', () => {
  for (const h of ['app.rovaq.ai', 'localhost:3000', 'vexa-ai-git-rama-equipo.vercel.app', 'rovaq.ai.evil.example', 'notrovaq.ai'])
    for (const r of ['/', '/login', '/overview', '/landing', '/api/x']) assert.equal(dec(h, r, '', true).tipo, 'pasar', h + r);
});
test('rutaConAutenticacion conserva exactamente la lista anterior del matcher', () => {
  for (const r of ['/', '/seguridad', '/sin-acceso', '/login', '/api', '/api/x/y', '/platform', '/platform/z', '/cfo', '/cfo/data', '/auth', '/auth/callback', '/overview/a', '/problems', '/customers/1', '/recommendations', '/explorer', '/preguntale', '/interventions', '/briefs/2']) assert.equal(rutaConAutenticacion(r), true, r);
  for (const r of ['/landing', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/opengraph-image', '/twitter-image', '/favicon.ico', '/.well-known/security.txt', '/humans.txt', '/login/x', '/seguridad/x', '/mapa', '/settings', '/workload', '/confianza']) assert.equal(rutaConAutenticacion(r), false, r);
});

test('middleware: rovaq.ai/ reescribe a /landing conservando la consulta', async () => {
  const r = await middleware(pet('rovaq.ai', '/?lang=es'));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('x-middleware-rewrite') ?? '', /^https:\/\/rovaq\.ai\/landing\?lang=es$/);
});
test('middleware: rovaq.ai/overview?x=1 redirige 308 a app.rovaq.ai/overview?x=1', async () => {
  const r = await middleware(pet('rovaq.ai', '/overview?x=1'));
  assert.equal(r.status, 308);
  assert.equal(r.headers.get('location'), 'https://app.rovaq.ai/overview?x=1');
});
test('middleware: rovaq.ai sirve activos y no pide autenticación', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:56321'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key';
  for (const ruta of ['/robots.txt', '/sitemap.xml', '/opengraph-image', '/fonts/a.woff2', '/api/health/version']) {
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
  for (const ruta of ['/landing', '/robots.txt', '/opengraph-image', '/settings/team', '/workload']) {
    const r = await middleware(pet('app.rovaq.ai', ruta));
    assert.equal(r.status, 200, ruta); assert.equal(r.headers.get('location'), null, ruta); assert.equal(r.headers.get('x-middleware-rewrite'), null, ruta); assert.equal(r.headers.get('cache-control'), null, ruta);
  }
  const sinConfig = await middleware(pet('app.rovaq.ai', '/overview'));
  assert.equal(sinConfig.status, 200); assert.equal(sinConfig.headers.get('location'), null);
});
