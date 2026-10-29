// Constructores de contenido compartidos por landing.ts y paginas/**. Solo sintaxis borrable.
import type { Bi, Condicion, Revisor, TextoMatiz } from './tipos.ts';

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
