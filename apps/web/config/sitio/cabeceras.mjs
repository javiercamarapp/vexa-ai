// Cabeceras del sitio público (T3). Una fuente para next.config.ts y las pruebas. Pura: recibe el manifest, no lee archivos ni importa Next.
//  - Espejos Markdown y archivos llms: noindex, Content-Type y Link canonical (reglasCabecerasEspejos de agentic.mjs).
//  - CSP candidata EN MODO INFORME, solo para rovaq.ai y www (el host de la aplicación conserva su política vigente).
//  - noindex por cabecera en cualquier host que no sea el del sitio (segunda barrera, además de robots.txt).
import {PAGINAS} from '../../src/content/sitio/registro.mjs';
import {reglasCabecerasEspejos} from './agentic.mjs';
import {rutaEspejoDe} from '../../src/lib/sitio/espejos.mjs';

/** Hosts del sitio como expresión de `has host` de Next. */
export const HOST_SITIO_RE = '(?:www\\.)?rovaq\\.ai';
/** Dónde llegan los informes de violación de CSP: el host de la aplicación (rovaq.ai redirige /api a la app y un informe no sigue redirecciones de forma fiable). */
export const URI_INFORMES_CSP = 'https://app.rovaq.ai/api/csp-informe';

/**
 * CSP candidata del sitio. Next inyecta scripts en línea de hidratación (self.__next_f.push, $RC...), que la lista blanca de la prueba de HTML enumera
 * (tests/sitio/csp-lista-blanca.json); sin nonces por petición no se pueden permitir por hash en una página estática, así que script-src lleva 'unsafe-inline'
 * y NADA más fuera de 'self' (sin eval, sin orígenes externos). El sitio no usa style en línea ni atributos style (escáner de fuentes), por eso style-src es solo 'self'.
 * Plan para enforce: vigilar los informes 1-2 semanas; pasar a nonces cuando el middleware sirva el HTML; entonces retirar 'unsafe-inline'.
 */
export function cspSitioInforme(uriInformes = URI_INFORMES_CSP) {
  return [
    "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'",
    "media-src 'self'", "worker-src 'self' blob:", "manifest-src 'self'", "form-action 'self' https://app.rovaq.ai", "base-uri 'self'", "object-src 'none'",
    "frame-ancestors 'none'", `report-uri ${uriInformes}`,
  ].join('; ');
}

/** Espejos con su ficha mínima {id, ruta} desde el registro. */
const fichasDelRegistro = () => PAGINAS.map((p) => ({id: p.id, ruta: {es: p.es.ruta, en: p.en.ruta}}));

/**
 * Reglas de headers() para los espejos y archivos llms. Los espejos con hash en el nombre (/s/md/...) conservan la caché inmutable de /s/: aquí no se redefine Cache-Control.
 * `manifestMd` es la sección md de public/s/manifest.json.
 */
export function reglasEspejos(manifestMd = {}) {
  const espejoDe = (id, lang) => rutaEspejoDe(id, lang, manifestMd);
  return reglasCabecerasEspejos(fichasDelRegistro(), espejoDe).map((r) => (
    r.source.startsWith('/s/') ? {...r, headers: r.headers.filter((h) => h.key !== 'Cache-Control')} : r
  ));
}

/** Reglas por host: CSP en informe solo para el sitio y noindex en todo lo demás. */
export function reglasPorHost({uriInformes = URI_INFORMES_CSP} = {}) {
  const sitio = [{type: 'host', value: HOST_SITIO_RE}];
  return [
    {source: '/:path*', has: sitio, headers: [{key: 'Content-Security-Policy-Report-Only', value: cspSitioInforme(uriInformes)}]},
    // Segunda barrera de indexación fuera del sitio (app.rovaq.ai, vistas previas, hosts antiguos). El primer control es robots.txt por host.
    {source: '/:path*', missing: sitio, headers: [{key: 'X-Robots-Tag', value: 'noindex, nofollow'}]},
  ];
}
