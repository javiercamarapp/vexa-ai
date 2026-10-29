// Enrutamiento por host: rovaq.ai muestra la landing, app.rovaq.ai la aplicación y los hosts antiguos de Vercel redirigen a la aplicación.
// Lógica pura (sin Next) para poder probarla caso por caso; el middleware solo aplica la decisión.
export const HOST_APP = 'app.rovaq.ai';
export const ORIGEN_APP = 'https://app.rovaq.ai';
export const HOSTS_LANDING = Object.freeze(['rovaq.ai', 'www.rovaq.ai']);
export const HOSTS_ANTIGUOS = Object.freeze(['rovaq-ai.vercel.app', 'vexa-ai.vercel.app']);
/** Ruta interna donde vive la landing; en rovaq.ai la raíz se reescribe a ella. */
export const RUTA_LANDING = '/landing';
/** Ruta interna de la landing en inglés: en rovaq.ai se publica como /en (español sin prefijo). */
export const RUTA_LANDING_EN = '/landing/en';
export const URL_PUBLICA_EN = '/en';

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
const PREFIJOS_ACTIVOS = ['/_next/', '/fonts/', '/brand/', '/images/', '/.well-known/', '/opengraph-image', '/twitter-image'];
const ARCHIVOS_PUBLICOS = new Set(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest', '/robots.txt', '/sitemap.xml', '/humans.txt']);
/** Activos públicos que la landing necesita en rovaq.ai (fuentes, marca, íconos, imágenes sociales, robots y sitemap). */
export function esActivoPublico(pathname) {
  // Scripts de terceros vendoreados y activos de la landing (módulo 3D, puntos, renders): archivos con extensión bajo /vendor/ y /landing/. /landing y /landing/en son páginas, no activos.
  if (/^\/vendor\/[\w./-]+\.[a-z0-9]+$/i.test(pathname) || /^\/landing\/[\w./-]+\.[a-z0-9]+$/i.test(pathname)) return !pathname.includes('..');
  return ARCHIVOS_PUBLICOS.has(pathname) || /^\/(?:favicon|icon)-[\w-]+\.png$/.test(pathname) || PREFIJOS_ACTIVOS.some((p) => pathname.startsWith(p));
}
/**
 * Decisión por host. Devuelve:
 *  - {tipo:'pasar'}                       sin cambio (host de la app, desarrollo, vistas previas)
 *  - {tipo:'activo'}                      activo público o endpoint abierto en un host de landing o antiguo: se sirve sin autenticación
 *  - {tipo:'reescribir', destino}         rovaq.ai/ se sirve con la landing sin cambiar la URL
 *  - {tipo:'redirigir', url, status:308}  a la aplicación o a la raíz, conservando ruta y consulta
 * `produccion` solo es verdadero en el despliegue de producción (VERCEL_ENV=production): en local y en vistas previas los hosts antiguos no redirigen.
 */
export function decidirHost({host, pathname, search = '', produccion = false}) {
  const h = normalizarHost(host);
  if (HOSTS_LANDING.includes(h)) {
    if (pathname === '/') return {tipo: 'reescribir', destino: RUTA_LANDING};
    if (pathname === URL_PUBLICA_EN || pathname === URL_PUBLICA_EN + '/') return {tipo: 'reescribir', destino: RUTA_LANDING_EN};
    if (pathname === RUTA_LANDING || pathname === RUTA_LANDING + '/') return {tipo: 'redirigir', url: '/' + search, status: 308};
    if (pathname === RUTA_LANDING_EN || pathname === RUTA_LANDING_EN + '/') return {tipo: 'redirigir', url: URL_PUBLICA_EN + search, status: 308};
    if (esActivoPublico(pathname) || rutaSiempreAbierta(pathname)) return {tipo: 'activo'};
    return {tipo: 'redirigir', url: ORIGEN_APP + pathname + search, status: 308};
  }
  if (produccion && HOSTS_ANTIGUOS.includes(h)) {
    if (rutaSiempreAbierta(pathname)) return {tipo: 'activo'};
    return {tipo: 'redirigir', url: ORIGEN_APP + pathname + search, status: 308};
  }
  return {tipo: 'pasar'};
}
/** Rutas que antes de este cambio pasaban por el middleware de autenticación (el matcher era una lista). Fuera de ellas el middleware no hace nada en el host de la app. */
export function rutaConAutenticacion(pathname) {
  return pathname === '/' || pathname === '/seguridad' || pathname === '/sin-acceso' || pathname === '/login'
    || /^\/(?:api|platform|cfo|auth|overview|problems|customers|recommendations|explorer|preguntale|interventions|briefs)(?:\/|$)/.test(pathname);
}
export const ES_HOST_LANDING = (host) => HOSTS_LANDING.includes(normalizarHost(host));
