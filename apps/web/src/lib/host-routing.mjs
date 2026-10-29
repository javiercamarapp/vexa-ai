// Enrutamiento por host. Fuente única y pura (sin Next): decidirHost() es la decisión por petición, probada caso por caso, y reglasNext() la traduce a las
// reglas de configuración (redirects y rewrites con `has host`) que next.config.ts entrega a Next. Con ellas rovaq.ai se sirve sin ejecutar el middleware.
//   rovaq.ai     sitio público estático: español sin prefijo (/ y /producto) e inglés bajo /en. Internamente /sitio/es/... y /sitio/en/...
//   www.rovaq.ai redirige 308 al apex conservando ruta y consulta
//   app.rovaq.ai la aplicación, sin cambios
//   hosts viejos de Vercel (solo en producción) redirigen 308 a app.rovaq.ai
// Las rutas del sitio salen del registro (content/sitio/registro.mjs); las de la aplicación, de PREFIJOS_PRIVADOS (lib/site.mjs). Nada se escribe a mano dos veces.
import {RUTAS} from '../content/sitio/registro.mjs';
import {PREFIJOS_PRIVADOS, RUTAS_PUBLICAS} from './site.mjs';

export const HOST_APP = 'app.rovaq.ai';
export const ORIGEN_APP = 'https://app.rovaq.ai';
export const HOST_SITIO = 'rovaq.ai';
export const HOST_WWW = 'www.rovaq.ai';
export const ORIGEN_SITIO = 'https://rovaq.ai';
export const HOSTS_LANDING = Object.freeze([HOST_SITIO, HOST_WWW]);
export const HOSTS_ANTIGUOS = Object.freeze(['rovaq-ai.vercel.app', 'vexa-ai.vercel.app']);
/** Raíz interna del sitio: /sitio/es y /sitio/en. Nunca es una URL pública. */
export const PREFIJO_INTERNO = '/sitio';
/** Rutas de la aplicación que alguien puede compartir en rovaq.ai y que van a app.rovaq.ai (lista cerrada, sin /api: ver RUTA_API_ABIERTA). */
export const RUTAS_APP = Object.freeze([...PREFIJOS_PRIVADOS, ...RUTAS_PUBLICAS].filter((r) => r !== '/api'));

/** Host en minúsculas, sin puerto ni punto final; con varios valores (proxies) toma el primero. */
export function normalizarHost(valor) {
  const primero = String(valor ?? '').split(',')[0].trim().toLowerCase();
  return primero.replace(/:\d+$/, '').replace(/\.$/, '');
}
/** Endpoints que responden en cualquier host: salud de la versión, trabajos internos y webhooks de terceros. */
export function rutaSiempreAbierta(pathname) {
  return pathname === '/api/health/version'
    || pathname === '/api/internal' || pathname.startsWith('/api/internal/')
    || pathname === '/api/webhooks' || pathname.startsWith('/api/webhooks/');
}
const PREFIJOS_ACTIVOS = ['/_next/', '/fonts/', '/brand/', '/images/', '/.well-known/', '/opengraph-image', '/twitter-image', '/og/'];
const ARCHIVOS_PUBLICOS = new Set([
  '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest', '/sitio.webmanifest', '/safari-pinned-tab.svg', '/robots.txt', '/sitemap.xml', '/humans.txt',
  '/llms.txt', '/llms-full.txt', '/index.md', '/en/llms.txt', '/en/llms-full.txt', '/en/index.md', '/blog/rss.xml', '/en/blog/rss.xml',
]);
/** Activos públicos que el sitio necesita en rovaq.ai (fuentes, marca, íconos, imágenes sociales, robots, sitemap, agentic). */
export function esActivoPublico(pathname) {
  // Archivos con extensión bajo /vendor/ (scripts de terceros vendoreados) y /s/ (activos del sitio con hash en el nombre). /vendor y /s solos no son activos.
  if (/^\/(?:vendor|s)\/[\w./-]+\.[a-z0-9]+$/i.test(pathname)) return !pathname.includes('..');
  return ARCHIVOS_PUBLICOS.has(pathname) || /^\/(?:favicon|icon)-[\w-]+\.png$/.test(pathname) || PREFIJOS_ACTIVOS.some((p) => pathname.startsWith(p));
}
/** URL pública de una ruta interna del sitio (/sitio/es/x es /x; /sitio/en/x es /en/x), o null si no es una ruta interna del sitio. */
export function rutaPublicaDeInterna(pathname) {
  const m = /^\/sitio\/(es|en)(\/.*)?$/.exec(pathname);
  if (!m) return null;
  const resto = m[2] ?? '';
  if (m[1] === 'es') return resto || '/';
  return '/en' + resto;
}
/** Ruta interna que sirve una URL pública del sitio: / es /sitio/es, /en es /sitio/en, /en/x es /sitio/en/x y el resto cuelga de /sitio/es. */
export function destinoInterno(pathname) {
  if (pathname === '/') return PREFIJO_INTERNO + '/es';
  if (pathname === '/en') return PREFIJO_INTERNO + '/en';
  if (pathname.startsWith('/en/')) return PREFIJO_INTERNO + '/en' + pathname.slice(3);
  return PREFIJO_INTERNO + '/es' + pathname;
}
const RUTAS_SITIO = new Set(RUTAS);
const esRutaApp = (pathname) => RUTAS_APP.some((r) => pathname === r || pathname.startsWith(r + '/')) || pathname === '/api' || pathname.startsWith('/api/');
const redir = (url) => ({tipo: 'redirigir', url, status: 308});

/**
 * Decisión por host. Devuelve:
 *  - {tipo:'pasar'}                       sin cambio (host de la app, desarrollo, vistas previas)
 *  - {tipo:'activo'}                      activo público o endpoint abierto en un host de sitio o antiguo: se sirve sin autenticación
 *  - {tipo:'reescribir', destino}         rovaq.ai se sirve con el sitio sin cambiar la URL; con noEncontrada:true la ruta no existe y responde el 404 del sitio
 *  - {tipo:'redirigir', url, status:308}  a la aplicación, al apex o a la URL canónica, conservando ruta y consulta
 * `produccion` solo es verdadero en el despliegue de producción (VERCEL_ENV=production): en local y en vistas previas los hosts antiguos no redirigen
 * y /sitio/... sigue abierto en el host de la app para poder probar el sitio por /sitio/es.
 */
export function decidirHost({host, pathname, search = '', produccion = false}) {
  const h = normalizarHost(host);
  if (h === HOST_WWW) return redir(ORIGEN_SITIO + pathname + search);
  if (h === HOST_SITIO) {
    const limpia = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    // Un solo URL por contenido: /sitio/es/x y /sitio/en/x no se publican, y los /landing de la versión anterior van a su equivalente.
    const publica = rutaPublicaDeInterna(limpia);
    if (publica !== null) return redir(publica + search);
    if (limpia === '/landing') return redir('/' + search);
    if (limpia === '/landing/en') return redir('/en' + search);
    if (RUTAS_SITIO.has(limpia)) return limpia !== pathname ? redir(limpia + search) : {tipo: 'reescribir', destino: destinoInterno(limpia)};
    if (esActivoPublico(pathname) || rutaSiempreAbierta(pathname)) return {tipo: 'activo'};
    if (esRutaApp(pathname)) return redir(ORIGEN_APP + pathname + search);
    // Ruta desconocida: 404 propio del sitio (la ruta [...ruta] no pregenera nada y responde 404 real), no una redirección a la aplicación.
    return {tipo: 'reescribir', destino: destinoInterno(limpia), noEncontrada: true};
  }
  if (produccion && HOSTS_ANTIGUOS.includes(h)) {
    if (rutaSiempreAbierta(pathname)) return {tipo: 'activo'};
    return redir(ORIGEN_APP + pathname + search);
  }
  // El sitio vive en rovaq.ai: en producción, /sitio/... en la aplicación redirige allí (en local y en vistas previas pasa).
  if (produccion && h === HOST_APP && (pathname === PREFIJO_INTERNO || pathname.startsWith(PREFIJO_INTERNO + '/'))) return redir(ORIGEN_SITIO + (rutaPublicaDeInterna(pathname) ?? '/') + search);
  return {tipo: 'pasar'};
}
/** Rutas que antes de este cambio pasaban por el middleware de autenticación (el matcher era una lista). Fuera de ellas el middleware no hace nada en el host de la app. */
export function rutaConAutenticacion(pathname) {
  return pathname === '/' || pathname === '/seguridad' || pathname === '/sin-acceso' || pathname === '/login'
    || /^\/(?:api|platform|cfo|auth|overview|problems|customers|recommendations|explorer|preguntale|interventions|briefs)(?:\/|$)/.test(pathname);
}
export const ES_HOST_LANDING = (host) => HOSTS_LANDING.includes(normalizarHost(host));

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Reglas de configuración de Next. Se evalúan en este orden: redirects, rewrites.beforeFiles, sistema de archivos (public/ y rutas fijas), rewrites.afterFiles.
// Todas llevan `has host`, así que no afectan a app.rovaq.ai ni a ningún otro host. Las pruebas comparan estas reglas con decidirHost para cada ruta.
// ---------------------------------------------------------------------------------------------------------------------------------------------------
const enHost = (value) => [{type: 'host', value}];
const API_ABIERTA = 'health/version$|internal(?:/|$)|webhooks(?:/|$)';
/** Alternativa de regex con los primeros segmentos de la aplicación, por ejemplo 'auth|platform|login'. */
const ALTERNATIVA_APP = RUTAS_APP.map((r) => r.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
/** Rutas internas del sitio que en un host dado redirigen a la URL pública (un solo URL por contenido). Con `resto` también cae aquí lo demás de /sitio. */
const reglasInternasAPublica = (host, destino, {resto = false} = {}) => [
  {source: '/sitio/es', has: enHost(host), destination: destino('/'), permanent: true},
  {source: '/sitio/es/:resto+', has: enHost(host), destination: destino('/:resto+'), permanent: true},
  {source: '/sitio/en', has: enHost(host), destination: destino('/en'), permanent: true},
  {source: '/sitio/en/:resto+', has: enHost(host), destination: destino('/en/:resto+'), permanent: true},
  ...(resto ? [{source: '/sitio', has: enHost(host), destination: destino('/'), permanent: true}, {source: '/sitio/:resto+', has: enHost(host), destination: destino('/'), permanent: true}] : []),
];
export function reglasNext({produccion = false} = {}) {
  const sitio = enHost(HOST_SITIO);
  const redirects = [
    // www al apex, todo el árbol.
    {source: '/:ruta*', has: enHost(HOST_WWW), destination: ORIGEN_SITIO + '/:ruta*', permanent: true},
    // Hosts antiguos de Vercel (solo en el build de producción, como VERCEL_ENV en el middleware): todo a la aplicación salvo los endpoints abiertos.
    ...(produccion ? HOSTS_ANTIGUOS.map((h) => ({source: `/:ruta((?!api/(?:${API_ABIERTA})).*)`, has: enHost(h), destination: ORIGEN_APP + '/:ruta', permanent: true})) : []),
    // El sitio vive en rovaq.ai: /sitio/... en la aplicación (solo producción) redirige allí.
    ...(produccion ? reglasInternasAPublica(HOST_APP, (r) => ORIGEN_SITIO + r, {resto: true}) : []),
    // rovaq.ai: un solo URL por contenido y compatibilidad con la ruta anterior.
    ...reglasInternasAPublica(HOST_SITIO, (r) => r),
    {source: '/landing', has: sitio, destination: '/', permanent: true},
    {source: '/landing/en', has: sitio, destination: '/en', permanent: true},
    // Rutas de la aplicación compartidas en rovaq.ai: a app.rovaq.ai con el mismo path y consulta.
    {source: `/:seg(${ALTERNATIVA_APP})/:resto*`, has: sitio, destination: ORIGEN_APP + '/:seg/:resto*', permanent: true},
    {source: '/api', has: sitio, destination: ORIGEN_APP + '/api', permanent: true},
    {source: `/api/:resto((?!${API_ABIERTA}).+)`, has: sitio, destination: ORIGEN_APP + '/api/:resto', permanent: true},
  ];
  const beforeFiles = [
    // Una regla exacta por ruta del registro (no comodines: no pisan archivos de public/ como /en/llms.txt).
    ...RUTAS.map((ruta) => ({source: ruta, has: sitio, destination: destinoInterno(ruta)})),
  ];
  const afterFiles = [
    // Lo que no es archivo, ni ruta del registro, ni de la aplicación, ni endpoint abierto: 404 propio del sitio (nunca una redirección a la aplicación).
    {source: '/en/:resto*', has: sitio, destination: '/sitio/en/:resto*'},
    {source: `/:resto((?!en(?:/|$)|_next/|api/(?:${API_ABIERTA.replace('$', '')})).+)`, has: sitio, destination: '/sitio/es/:resto'},
  ];
  return {redirects, beforeFiles, afterFiles, fallback: []};
}
