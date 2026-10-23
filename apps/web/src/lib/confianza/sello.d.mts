export type ClaseCifra = 'observed' | 'estimated' | 'inferred';
export type Sello = {clase: ClaseCifra; claseTxt: string; fuente: string; hasta: string; actualizado: string; texto: string};
export const CLASE: Readonly<Record<ClaseCifra, string>>;
export function diaTxt(iso: unknown): string | null;
export function haceDeIso(iso: string | null | undefined, ahora?: number): string | null;
export function sello(a?: {clase?: string; fuente?: string; hasta?: string | null; actualizado?: string | null; ahora?: number}): Sello;
