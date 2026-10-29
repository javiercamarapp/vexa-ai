// Tipos de lib/sitio/jsonld.mjs (T2).
import type {FichaPagina, IdiomaSitio} from './metadatos.mjs';
export function serializar(obj: unknown): string;
export const LOGO_HORIZONTAL: {ruta: string; ancho: number; alto: number};
export const LOGO_CUADRADO: {ruta: string; ancho: number; alto: number};
export function ids(base?: string): {org: string; sitio: string; app: string};
export function organizacion(base?: string): Record<string, unknown>;
export function sitioWeb(base?: string): Record<string, unknown>;
export function aplicacion(lang: IdiomaSitio, descripcion: string, base?: string): Record<string, unknown>;
export function paginaWeb(ficha: FichaPagina, lang: IdiomaSitio, base?: string): Record<string, unknown>;
export function migas(ficha: FichaPagina, lang: IdiomaSitio, fichasPorId: Map<string, FichaPagina>, base?: string): Record<string, unknown>;
export function preguntasFrecuentes(items: {q: string; a: string}[]): {'@type': 'FAQPage'; mainEntity: unknown[]};
export function articulo(ficha: FichaPagina, lang: IdiomaSitio, base?: string): Record<string, unknown>;
export function blog(ficha: FichaPagina, lang: IdiomaSitio, base?: string): Record<string, unknown>;
export function grafoDePagina(id: string, lang: IdiomaSitio, datos: {fichas: FichaPagina[]; faq?: {q: string; a: string}[]}, base?: string): {'@context': string; '@graph': Record<string, unknown>[]};
