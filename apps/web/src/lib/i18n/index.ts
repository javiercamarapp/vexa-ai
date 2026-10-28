import {es, type Clave} from './es';
import {en} from './en';
import type {Idioma} from './idioma';
export type {Clave};
export * from './idioma';
export const DICCIONARIOS: Record<Idioma, Record<Clave, string>> = {es, en};
export type Variables = Record<string, string | number>;
/** Traduce una clave; reemplaza {variable}. Una clave desconocida (no debería pasar: está tipada) devuelve la propia clave para que se note. */
export function traducir(idioma: Idioma, clave: Clave, variables?: Variables): string {
  const base = DICCIONARIOS[idioma]?.[clave] ?? es[clave] ?? clave;
  return variables ? base.replace(/\{(\w+)\}/g, (m, k: string) => (k in variables ? String(variables[k]) : m)) : base;
}
export type Traductor = (clave: Clave, variables?: Variables) => string;
export const traductor = (idioma: Idioma): Traductor => (clave, variables) => traducir(idioma, clave, variables);
