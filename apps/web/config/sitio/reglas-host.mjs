// Reglas por host que next.config.ts entrega a Next (Fase A). La decisión vive en src/lib/host-routing.mjs; este módulo solo la expone y fija el modo.
//
// MODO_ENRUTAMIENTO
//   'next-config'  Fase A (vigente): redirects y rewrites con `has host` evaluados por la capa de enrutamiento, sin ejecutar código. El matcher del
//                  middleware excluye rovaq.ai y www.rovaq.ai, así que el sitio no cuesta ninguna invocación de función.
//   'middleware'   Fase B (respaldo, a una compilación de distancia): si en Vercel `has host` no se comporta como en local, hay que cambiar DOS cosas:
//                  1) aquí, poner MODO_ENRUTAMIENTO = 'middleware' (reglasHost() devuelve listas vacías);
//                  2) en src/middleware.ts, quitar el `missing` del matcher para que rovaq.ai vuelva a pasar por el middleware, que ya aplica decidirHost().
//                  La página sigue siendo estática y la sirve el CDN; el costo es una invocación de middleware por visita al sitio.
import {reglasNext} from '../../src/lib/host-routing.mjs';

export const MODO_ENRUTAMIENTO = 'next-config';

/** Matcher de referencia del middleware: todo menos estáticos y activos públicos, y sin rovaq.ai ni www. src/middleware.ts lleva el mismo literal (Next lo exige estático); una prueba los compara. */
export const MATCHER_MIDDLEWARE = Object.freeze([
  {
    source: '/((?!_next/static|_next/image|fonts/|brand/|images/|vendor/|s/).*)',
    missing: [{type: 'header', key: 'host', value: '(www\\.)?rovaq\\.ai'}],
  },
]);

/** Listas para redirects() y rewrites() de next.config.ts. `produccion` es verdadero solo en el build de producción (VERCEL_ENV=production). */
export function reglasHost({produccion = false} = {}) {
  if (MODO_ENRUTAMIENTO === 'middleware') return {redirects: [], beforeFiles: [], afterFiles: [], fallback: []};
  return reglasNext({produccion});
}
