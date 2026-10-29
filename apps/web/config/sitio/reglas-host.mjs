// Reglas por host que next.config.ts entrega a Next (Fase A). La decisión vive en src/lib/host-routing.mjs; este módulo solo la expone y fija el modo.
//
// MODO_ENRUTAMIENTO
//   'next-config'  Fase A: redirects y rewrites con `has host` evaluados por la capa de enrutamiento, sin ejecutar código. El matcher del
//                  middleware excluye rovaq.ai y www.rovaq.ai, así que el sitio no cuesta ninguna invocación de función.
//   'middleware'   Fase B (VIGENTE): si en Vercel `has host` no se comporta como en local, hay que cambiar DOS cosas:
//                  1) aquí, poner MODO_ENRUTAMIENTO = 'middleware' (reglasHost() devuelve listas vacías);
//                  2) en src/middleware.ts, quitar el `missing` del matcher para que rovaq.ai vuelva a pasar por el middleware, que ya aplica decidirHost().
//                  La página sigue siendo estática y la sirve el CDN; el costo es una invocación de middleware por visita al sitio.
import {reglasNext} from '../../src/lib/host-routing.mjs';

// VIGENTE: Fase B. En el build local con `next start`, los rewrites beforeFiles con `has host` hacia /sitio/[lang] (dynamicParams=false) no se resolvieron:
// / y /producto con Host rovaq.ai terminaron en el catch-all de la app (NoFallbackError en el log) aunque /sitio/es directo sirve bien. Los redirects con
// `has host` sí funcionaron. Riesgo en Vercel: `has host` usa el encabezado Host (en el router de Next, sin x-forwarded-host); no se pudo verificar allí.
// Por eso el enrutamiento de rovaq.ai lo hace el middleware (decidirHost), con la página estática servida igual por el CDN. Costo: una invocación por visita.
// Para volver a la Fase A tras depurarlo: MODO_ENRUTAMIENTO = 'next-config' (el matcher cambia solo).
export const MODO_ENRUTAMIENTO = 'middleware';

/** Matcher de referencia del middleware: todo menos estáticos y activos públicos, y sin rovaq.ai ni www. src/middleware.ts lleva el mismo literal (Next lo exige estático); una prueba los compara. */
const FUENTE_MATCHER = '/((?!_next/static|_next/image|fonts/|brand/|images/|vendor/|s/).*)';
export const MATCHER_MIDDLEWARE = Object.freeze(MODO_ENRUTAMIENTO === 'middleware'
  ? [{source: FUENTE_MATCHER}]
  : [{source: FUENTE_MATCHER, missing: [{type: 'header', key: 'host', value: '(www\\.)?rovaq\\.ai'}]}]);

/** Listas para redirects() y rewrites() de next.config.ts. `produccion` es verdadero solo en el build de producción (VERCEL_ENV=production). */
export function reglasHost({produccion = false} = {}) {
  if (MODO_ENRUTAMIENTO === 'middleware') return {redirects: [], beforeFiles: [], afterFiles: [], fallback: []};
  return reglasNext({produccion});
}
