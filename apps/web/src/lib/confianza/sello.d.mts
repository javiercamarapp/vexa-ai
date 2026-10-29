import type {Tr} from '../legibilidad/trad.mjs';
export type ClaseCifra = 'observed' | 'estimated' | 'inferred';
export type Sello = {clase: ClaseCifra; claseTxt: string; fuente: string; hasta: string; actualizado: string; texto: string; hastaCorto: string; actualizadoCorto: string; hastaIso: string | null; actualizadoIso: string | null; fuenteCruda?: string; ahora: number};
export const CLASE: Readonly<Record<ClaseCifra, string>>;
export function diaTxt(iso: unknown, t?: Tr | null): string | null;
export function haceDeIso(iso: string | null | undefined, ahora?: number, t?: Tr | null): string | null;
export function sello(a?: {clase?: string; fuente?: string; hasta?: string | null; actualizado?: string | null; ahora?: number; t?: Tr | null}): Sello;
