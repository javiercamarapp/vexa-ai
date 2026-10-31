// K1. Contrato de contenido del sitio de Rovaq AI.
// Solo sintaxis borrable (sin enum ni parameter properties): Node lo importa directo y tsc lo comprueba.
// Una hoja de contenido es siempre una pareja { es, en }. Las claves de los dos idiomas son las mismas por construcción.

/** Hoja bilingüe: español de México y inglés de EE. UU. */
export interface Bi {
  readonly es: string;
  readonly en: string;
}

/** Quién debe aprobar un texto antes de publicarse. */
export type Revisor = 'responsable' | 'abogado';

/**
 * Condición de una afirmación MATIZ (P-D sección 5).
 * n = 0: condición de adyacencia, el texto solo se maqueta junto a las hojas de `acompana`.
 * n = 1 a 13: verificación del producto o de negocio, registrada en aprobaciones.json.
 */
export interface Condicion {
  readonly n: number;
  /** La condición escrita, en español, para quien revisa. No se publica. */
  readonly texto: string;
  /** Rutas de hojas que deben renderizarse a su lado. Si una no es publicable, esta tampoco. */
  readonly acompana?: readonly string[];
}

/** Texto afirmable tal cual. El nivel es opcional porque PUBLICO es el valor por defecto. */
export interface TextoPublico extends Bi {
  readonly nivel?: 'PUBLICO';
}

/** Texto afirmable solo con su condición. Nunca se renderiza sin ella. */
export interface TextoMatiz extends Bi {
  readonly nivel: 'MATIZ';
  readonly condicion: Condicion;
  /** Revisores cuya aprobación, atada al hash del texto, hace falta para publicar. */
  readonly req?: readonly Revisor[];
  /** Ruta de la hoja que se publica mientras esta no sea publicable. */
  readonly alterno?: string;
  /** Verificación 1 a 13 que debe estar cumplida en aprobaciones.json para publicar esta hoja. */
  readonly verifica?: number;
}

export type Texto = TextoPublico | TextoMatiz;

/** Árbol de contenido: hojas bilingües, identificadores simples, listas y objetos. */
export type Nodo = Texto | string | readonly Nodo[] | { readonly [clave: string]: Nodo };

/** Proyección a un idioma: el mismo árbol con cadenas. */
export type Proy<T> = T extends Bi
  ? string
  : T extends string
    ? T
    : T extends readonly (infer U)[]
      ? Proy<U>[]
      : { [K in keyof T]: Proy<T[K]> };

/** SEO de una página o sección. */
export interface SeoPagina {
  readonly titulo: Bi;
  readonly descripcion: Bi;
}

/** Estado de revisión de una página interna. */
export type EstadoPagina = 'publicable' | 'pendiente-de-revision';

/** Página interna del mapa del sitio. `id` es el identificador del registro (K2). */
export interface Pagina {
  readonly id: string;
  readonly estado: EstadoPagina;
  /** Motivo de la pendiente de revisión, para quien revisa. No se publica. */
  readonly pendiente?: string;
  readonly seo: SeoPagina;
  readonly h1: Bi;
  readonly subtitulo: Bi;
  readonly bloques: readonly Nodo[];
  readonly cta?: Bi;
  readonly rotulo?: Bi;
}

// ---------------------------------------------------------------- blog (T24)

/**
 * Bloque del cuerpo de un artículo. Solo alias de objeto con hojas bilingües (sin booleanos): así un `Articulo` sigue siendo una `Pagina`
 * y publicar(), estadoPagina() y los espejos Markdown lo recorren sin cambios.
 *  p            párrafo
 *  h2, h3       subtítulos (el h1 es el de la página; los h2 alimentan la tabla de contenido)
 *  lista        lista con viñetas; pasos, lista numerada
 *  cita         cita destacada del propio artículo (opcional, una por artículo como máximo)
 *  no-afirmamos nota «Lo que no afirmamos» (opcional, al final del cuerpo); el rótulo lo pone el renderizador
 */
export type BloqueArticulo =
  | { readonly tipo: 'p'; readonly texto: Bi }
  | { readonly tipo: 'h2'; readonly texto: Bi }
  | { readonly tipo: 'h3'; readonly texto: Bi }
  | { readonly tipo: 'lista'; readonly items: readonly Bi[] }
  | { readonly tipo: 'pasos'; readonly items: readonly Bi[] }
  | { readonly tipo: 'cita'; readonly texto: Bi }
  | { readonly tipo: 'no-afirmamos'; readonly items: readonly Bi[] };

/**
 * Artículo del blog. Es una Pagina: `seo.titulo` y `seo.descripcion` son el título y la descripción SEO, `h1` el titular, `subtitulo` la bajada
 * y `bloques` el cuerpo. La ruta por idioma y el id (a1 a a8) vienen del registro K2. El autor siempre es la organización.
 * El tiempo de lectura se deriva del cuerpo (lib/sitio/articulos.mjs), no se escribe.
 */
export interface Articulo extends Pagina {
  /** Fecha de publicación AAAA-MM-DD. Sin ella el artículo no es publicable. */
  readonly pub: string;
  /** Última modificación AAAA-MM-DD; si falta se usa la de publicación. */
  readonly mod?: string;
  /** Tema del artículo, por ejemplo Reembolsos. Va al RSS y al JSON-LD. */
  readonly etiqueta?: Bi;
  readonly autor: 'organizacion';
  /** Dos o tres frases para el índice del blog y el RSS. */
  readonly resumen: Bi;
  readonly bloques: readonly BloqueArticulo[];
  /** Ids del registro K2: otros artículos (a2) y páginas de producto o casos de uso (fuga-de-reembolsos, propietario). Se enlazan solo si se publican. */
  readonly relacionados: readonly string[];
}
