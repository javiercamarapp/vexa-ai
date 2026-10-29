import type {Traductor} from '../../lib/i18n';
export type SelloCco = {clase: 'observed' | 'estimated' | 'inferred'; claseTxt: string; fuente: string; hasta: string; actualizado: string; texto: string};
export function mayor(minor: string | null | undefined, exponente: number): number | null;
export function mesTxt(iso: string | null | undefined, locale: string): string | null;
export function diaTxt(iso: string | null | undefined, locale: string): string | null;
export function selloCco(tr: Traductor, locale: string, o: {clase: string; fuente: string | null; corte?: string | null; consultado?: string | null}): SelloCco;
export const ESTADOS: readonly ['listo', 'salvedad', 'falta'];
export function tonoDeEstado(e: string): 'ok' | 'warn' | 'bad';
export function conteoOculto(n: number | null | undefined): boolean;
