// Constructores de contenido compartidos por landing.ts y paginas/**. Solo sintaxis borrable.
import type { Articulo, Bi, BloqueArticulo, Condicion, Revisor, TextoMatiz } from './tipos.ts';

/** Hoja bilingüe. */
export const b = (es: string, en: string): Bi => ({ es, en });

/** Declara una hoja MATIZ con su condición. n = 0 es adyacencia (acompana); n = 1 a 13, la verificación de P-D sección 5. */
export function m(
  n: number,
  texto: string,
  hoja: Bi,
  extra: { readonly acompana?: readonly string[]; readonly req?: readonly Revisor[]; readonly alterno?: string; readonly verifica?: number } = {},
): TextoMatiz {
  const condicion: Condicion = extra.acompana ? { n, texto, acompana: extra.acompana } : { n, texto };
  return {
    es: hoja.es,
    en: hoja.en,
    nivel: 'MATIZ',
    condicion,
    ...(extra.req ? { req: extra.req } : {}),
    ...(extra.alterno ? { alterno: extra.alterno } : {}),
    ...(extra.verifica ? { verifica: extra.verifica } : {}),
  };
}

// ---------------------------------------------------------------- artículos del blog (T24)

/** Párrafo de un artículo. */
export const p = (es: string, en: string): BloqueArticulo => ({ tipo: 'p', texto: b(es, en) });
/** Subtítulo h2 (entra a la tabla de contenido). */
export const h2 = (es: string, en: string): BloqueArticulo => ({ tipo: 'h2', texto: b(es, en) });
/** Subtítulo h3. */
export const h3 = (es: string, en: string): BloqueArticulo => ({ tipo: 'h3', texto: b(es, en) });
/** Lista con viñetas: cada elemento es [es, en]. */
export const ul = (...items: readonly (readonly [string, string])[]): BloqueArticulo => ({ tipo: 'lista', items: items.map(([es, en]) => b(es, en)) });
/** Lista numerada: cada elemento es [es, en]. */
export const pasos = (...items: readonly (readonly [string, string])[]): BloqueArticulo => ({ tipo: 'pasos', items: items.map(([es, en]) => b(es, en)) });
/** Cita destacada del propio artículo. */
export const cita = (es: string, en: string): BloqueArticulo => ({ tipo: 'cita', texto: b(es, en) });
/** Nota «Lo que no afirmamos» (el rótulo lo pone el renderizador): cada elemento es [es, en]. */
export const noAfirmamos = (...items: readonly (readonly [string, string])[]): BloqueArticulo => ({ tipo: 'no-afirmamos', items: items.map(([es, en]) => b(es, en)) });

/** Declara un artículo: el autor es siempre la organización y, con contenido escrito, el estado por defecto es publicable. */
export function articulo(a: Omit<Articulo, 'autor' | 'estado'> & { readonly estado?: Articulo['estado'] }): Articulo {
  return { estado: 'publicable', autor: 'organizacion', ...a };
}
