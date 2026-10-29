// K1. Contrato de contenido del sitio de Rovaq AI.
// Solo sintaxis borrable (sin enum ni parameter properties): Node lo importa directo y tsc lo comprueba.
// Una hoja de contenido es siempre una pareja { es, en }. Las claves de los dos idiomas son las mismas por construcción.

/** Hoja bilingüe: español de México y inglés de EE. UU. */
export interface Bi {
  readonly es: string;
  readonly en: string;
}

/** Quién debe aprobar un texto antes de publicarse. */
export type Revisor = 'responsable_a' | 'abogado';

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
