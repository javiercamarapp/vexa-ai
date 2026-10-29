export type IdiomaSitio = 'es' | 'en';
export type PaginaRegistro = {readonly id: string; readonly tipo: string; readonly es: {readonly ruta: string}; readonly en: {readonly ruta: string}};
export const IDIOMAS: readonly IdiomaSitio[];
export const PAGINAS: readonly PaginaRegistro[];
export function porId(id: string): PaginaRegistro | undefined;
export function rutaDe(id: string, lang: IdiomaSitio): string | null;
export function idDeRuta(ruta: string): {id: string; lang: IdiomaSitio} | null;
export const RUTAS: readonly string[];
