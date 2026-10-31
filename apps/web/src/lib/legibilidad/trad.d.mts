/** Traductor de useT(): clave tipada en la app, aquí laxa para que los módulos .mjs lo reciban sin acoplarse al diccionario. */
export type Tr = (clave: any, vars?: Record<string, string | number>) => string;
export const X: (t: Tr | null | undefined, clave: string, es: string, vars?: Record<string, string | number>) => string;
export const idiomaDe: (t: Tr | null | undefined) => 'es' | 'en';
export const P: (t: Tr | null | undefined, n: number, claveUno: string, claveVarios: string, esUno: string, esVarios: string, vars?: Record<string, string | number>) => string;
export const notaDe: (t: Tr | null | undefined, vista: {note?: string | null; noteKey?: string | null} | null | undefined, vars?: Record<string, string | number>) => string;
