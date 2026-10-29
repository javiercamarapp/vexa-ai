// Reglas de configuración por host (reglasNext) frente a decidirHost, con el enrutador real de Next (unstable_getResponseFromNextConfig) y el matcher del
// middleware con unstable_doesMiddlewareMatch. El mismo juego de rutas pasa por las dos vías: si divergen, falla.
import 'next/dist/server/node-environment.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {unstable_getResponseFromNextConfig as correr, getRedirectUrl, getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch as casa} from 'next/experimental/testing/server.js';
import {reglasHost, MATCHER_MIDDLEWARE, MODO_ENRUTAMIENTO} from '../config/sitio/reglas-host.mjs';
import {reglasNext, decidirHost, RUTAS_APP, esActivoPublico, HOSTS_ANTIGUOS} from '../src/lib/host-routing.mjs';
import {RUTAS, PAGINAS} from '../src/content/sitio/registro.mjs';
import * as modConfig from '../next.config.ts';
import {config as configMiddleware} from '../src/middleware.ts';

const nextConfig = modConfig.default?.default ?? modConfig.default;
const RAIZ = join(import.meta.dirname, '..');
const sinNada = async () => [];
/** Ejecuta redirects y beforeFiles (fase 1) y, si nada tocó la ruta, afterFiles (fase 2). Los archivos de public/ y las rutas fijas se sirven entre las dos fases. */
async function simular(host, ruta, search, produccion) {
  const r = reglasHost({produccion});
  const url = `https://${host}${ruta}${search}`;
  const fase1 = await correr({url, headers: {host}, nextConfig: {redirects: async () => r.redirects, rewrites: async () => ({beforeFiles: r.beforeFiles, afterFiles: [], fallback: []})}});
  const salida = (res, fase) => isRewrite(res) ? {tipo: 'reescribir', destino: new URL(getRewrittenUrl(res)).pathname, search: new URL(getRewrittenUrl(res)).search, fase}
    : res.status === 308 ? {tipo: 'redirigir', url: getRedirectUrl(res), status: 308, fase} : null;
  const a = salida(fase1, 1); if (a) return a;
  const fase2 = await correr({url, headers: {host}, nextConfig: {redirects: sinNada, rewrites: async () => ({beforeFiles: [], afterFiles: r.afterFiles, fallback: []})}});
  return salida(fase2, 2) ?? {tipo: 'nada'};
}
const absoluta = (host, u) => new URL(u, 'https://' + host).href;

const MANUALES = ['/', '/en', '/en/', '/login', '/login/x', '/overview', '/overview/1', '/problems/9', '/auth/callback', '/platform/costos-ia', '/seguridad', '/sin-acceso', '/cfo/data/export', '/settings/notifications', '/pain-points', '/workload',
  '/api', '/api/x', '/api/health', '/api/health/version', '/api/health/version/x', '/api/internal', '/api/internal/cron/sync', '/api/internals', '/api/webhooks', '/api/webhooks/hubspot', '/api/briefs/1/export',
  '/robots.txt', '/sitemap.xml', '/opengraph-image', '/twitter-image', '/favicon.ico', '/favicon-32x32.png', '/icon-192.png', '/apple-touch-icon.png', '/site.webmanifest', '/sitio.webmanifest', '/llms.txt', '/en/llms.txt', '/blog/rss.xml',
  '/s/nube.ab12cd34.js', '/s/pts/hero.3b1a371a.pts', '/vendor/lenis-1.1.13.min.js', '/fonts/hankengrotesk-600.woff2', '/brand/x.svg', '/images/x.png', '/.well-known/security.txt',
  '/sitio/es', '/sitio/es/', '/sitio/es/producto', '/sitio/en', '/sitio/en/product', '/sitio', '/sitio/fr', '/landing', '/landing/en', '/landing/',
  '/zzz', '/a/b/c', '/producto/no-existe', '/en/no-existe', '/en/product/no-existe', '/es', '/s', '/vendor/x', '/loginx', '/overviews'];
const RUTAS_PRUEBA = [...new Set([...RUTAS, ...MANUALES])];

test('coherencia: para cada host y ruta, reglasNext (enrutador real de Next) y decidirHost dan el mismo resultado', async () => {
  assert.ok(RUTAS_PRUEBA.length >= 120, 'hay ' + RUTAS_PRUEBA.length);
  let comprobados = 0;
  for (const produccion of [false, true])
    for (const host of ['rovaq.ai', 'www.rovaq.ai', 'app.rovaq.ai', 'rovaq-ai.vercel.app', 'vexa-ai.vercel.app', 'localhost']) {
      if (!produccion && host !== 'rovaq.ai' && host !== 'www.rovaq.ai' && host !== 'app.rovaq.ai') continue;
      for (const ruta of RUTAS_PRUEBA)
        for (const search of ['', '?a=1&b=dos']) {
          // Next quita la barra final con su propia redirección antes de las reglas; decidirHost la trata por su cuenta (cubierto en host-routing.test.ts).
          if (ruta.length > 1 && ruta.endsWith('/')) continue;
          const d = decidirHost({host, pathname: ruta, search, produccion});
          let s; try { s = await simular(host, ruta, search, produccion); } catch (e) { throw new Error('simular ' + host + ' ' + ruta + search + ' prod=' + produccion + ': ' + e.message); }
          const eti = `${host} ${ruta}${search} produccion=${produccion}`;
          if (d.tipo === 'redirigir') { assert.equal(s.tipo, 'redirigir', eti); assert.equal(s.url, absoluta(host, d.url), eti); assert.equal(s.fase, 1, eti); }
          else if (d.tipo === 'reescribir') { assert.equal(s.tipo, 'reescribir', eti); assert.equal(s.destino + s.search, d.destino + search, eti); assert.equal(s.fase, d.noEncontrada ? 2 : 1, eti); }
          else if (d.tipo === 'activo') {
            // Los archivos y rutas fijas los sirve el sistema de archivos antes de afterFiles: ninguna regla de fase 1 los toca. Los endpoints abiertos tampoco caen en el 404 de afterFiles.
            assert.ok(s.tipo === 'nada' || (s.fase === 2 && !ruta.startsWith('/api/')), eti + ' ' + JSON.stringify(s));
          } else assert.deepEqual(s, {tipo: 'nada'}, eti);
          comprobados++;
        }
    }
  assert.ok(comprobados >= 1500, 'comprobados ' + comprobados);
});

test('las reglas existen solo con has host y los redirects son permanentes (308)', () => {
  for (const produccion of [false, true]) {
    const r = reglasNext({produccion});
    for (const lista of [r.redirects, r.beforeFiles, r.afterFiles, r.fallback]) for (const regla of lista) {
      assert.ok(Array.isArray(regla.has) && regla.has.length === 1 && regla.has[0].type === 'host', JSON.stringify(regla));
      assert.ok(typeof regla.source === 'string' && typeof regla.destination === 'string');
    }
    for (const regla of r.redirects) assert.equal(regla.permanent, true);
    assert.equal(r.beforeFiles.length, RUTAS.length, 'una regla exacta por ruta del registro (68)');
    assert.equal(RUTAS.length, 68);
    assert.equal(r.afterFiles.length, 2);
  }
  const hostsFuera = new Set(reglasNext({produccion: false}).redirects.map((x) => x.has[0].value));
  assert.deepEqual([...hostsFuera].sort(), ['rovaq.ai', 'www.rovaq.ai']);
  const hostsProd = new Set(reglasNext({produccion: true}).redirects.map((x) => x.has[0].value));
  assert.deepEqual([...hostsProd].sort(), ['app.rovaq.ai', 'rovaq-ai.vercel.app', 'rovaq.ai', 'vexa-ai.vercel.app', 'www.rovaq.ai']);
  assert.deepEqual(HOSTS_ANTIGUOS.slice().sort(), ['rovaq-ai.vercel.app', 'vexa-ai.vercel.app']);
});

test('next.config.ts entrega exactamente las reglas de reglasHost (y las de producción solo con VERCEL_ENV=production)', async () => {
  const antes = process.env.VERCEL_ENV;
  try {
    delete process.env.VERCEL_ENV;
    assert.deepEqual(await nextConfig.redirects(), reglasHost({produccion: false}).redirects);
    const rw = await nextConfig.rewrites();
    assert.deepEqual(rw, {beforeFiles: reglasHost().beforeFiles, afterFiles: reglasHost().afterFiles, fallback: []});
    process.env.VERCEL_ENV = 'preview';
    assert.deepEqual(await nextConfig.redirects(), reglasHost({produccion: false}).redirects);
    process.env.VERCEL_ENV = 'production';
    assert.deepEqual(await nextConfig.redirects(), reglasHost({produccion: true}).redirects);
  } finally { if (antes === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = antes; }
  assert.equal(MODO_ENRUTAMIENTO, 'next-config');
});

test('el matcher del middleware es estático, igual a MATCHER_MIDDLEWARE, y excluye rovaq.ai, www y los activos públicos', () => {
  assert.deepEqual(configMiddleware.matcher, MATCHER_MIDDLEWARE);
  const fuente = readFileSync(join(RAIZ, 'src/middleware.ts'), 'utf8');
  assert.match(fuente, /export const config = \{ runtime: 'nodejs', matcher: \[\{ source: '[^']+', missing: \[\{ type: 'header', key: 'host', value: '[^']+' \}\] \}\] \};/, 'el matcher debe ser un literal');
  const pasa = (host, ruta) => casa({config: {matcher: MATCHER_MIDDLEWARE}, url: `https://${host}${ruta}`, headers: {host}});
  // Cero invocaciones en el sitio: ni páginas, ni activos, ni desconocidas, ni app de pega.
  for (const h of ['rovaq.ai', 'www.rovaq.ai']) for (const r of ['/', '/en', '/producto', '/en/product', '/login', '/zzz', '/robots.txt', '/s/a.js', '/api/health/version', '/sitio/es']) assert.equal(pasa(h, r), false, h + r);
  // La aplicación, los hosts antiguos, las vistas previas y desarrollo siguen pasando por el middleware.
  for (const h of ['app.rovaq.ai', 'rovaq-ai.vercel.app', 'vexa-ai.vercel.app', 'vexa-ai-git-x-equipo.vercel.app', 'localhost', 'sub.rovaq.ai', 'rovaq.ai.evil.example', 'notrovaq.ai'])
    for (const r of ['/', '/login', '/overview', '/api/x', '/robots.txt', '/sitio/es', '/producto']) assert.equal(pasa(h, r), true, h + r);
  // Activos públicos: ni la app los pasa por el middleware.
  for (const r of ['/_next/static/a.js', '/_next/image', '/fonts/a.woff2', '/brand/a.svg', '/images/a.png', '/vendor/lenis-1.1.13.min.js', '/s/nube.ab12cd34.js', '/s/pts/x.pts']) assert.equal(pasa('app.rovaq.ai', r), false, r);
  for (const r of ['/sources', '/sitio/es', '/settings', '/setup', '/sin-acceso', '/seguridad', '/s']) assert.equal(pasa('app.rovaq.ai', r), true, 'no excluir por prefijo parecido: ' + r);
});

test('cobertura: cada carpeta de la aplicación está en RUTAS_APP (o es /api) y ninguna ruta del sitio choca con ellas', () => {
  const dirs = (d) => readdirSync(d).filter((n) => statSync(join(d, n)).isDirectory());
  const app = join(RAIZ, 'src/app/(app)');
  const segmentos = [...dirs(join(app, '(workspace)')), ...dirs(app).filter((n) => !n.startsWith('(') && !n.startsWith('['))];
  assert.ok(segmentos.length >= 30, 'carpetas: ' + segmentos.length);
  for (const s of segmentos) assert.ok(RUTAS_APP.includes('/' + s), `/${s} es una ruta de la aplicación y falta en PREFIJOS_PRIVADOS/RUTAS_PUBLICAS`);
  assert.ok(existsSync(join(RAIZ, 'src/app/api')));
  const reservados = new Set([...RUTAS_APP.map((r) => r.slice(1)), 'api', 'sitio', 's', 'vendor', 'fonts', 'brand', 'images', '_next', 'landing', 'og']);
  for (const p of PAGINAS) {
    const primero = (r) => r.split('/')[1];
    assert.ok(!reservados.has(primero(p.es.ruta)), `${p.id} es: /${primero(p.es.ruta)} choca con la aplicación`);
    assert.notEqual(primero(p.es.ruta), 'en', p.id + ' español sin prefijo /en');
    if (p.en.ruta !== '/en') assert.ok(!reservados.has(p.en.ruta.split('/')[2]), `${p.id} en`);
    assert.ok(p.en.ruta === '/en' || p.en.ruta.startsWith('/en/'));
  }
});

test('esActivoPublico no cubre ninguna ruta del registro ni de la aplicación', () => {
  for (const r of [...RUTAS, ...RUTAS_APP, ...RUTAS_APP.map((x) => x + '/algo')]) assert.equal(esActivoPublico(r), false, r);
});

test('cabeceras de next.config: /s/ inmutable, sin reglas de /landing y /vendor intacto', async () => {
  const h = await nextConfig.headers();
  const por = (source) => h.find((x) => x.source === source);
  assert.deepEqual(por('/s/:path*').headers, [{key: 'Cache-Control', value: 'public, max-age=31536000, immutable'}]);
  assert.deepEqual(por('/vendor/:path*').headers, [{key: 'Cache-Control', value: 'public, max-age=31536000, immutable'}]);
  assert.ok(!h.some((x) => x.source.startsWith('/landing')));
});
