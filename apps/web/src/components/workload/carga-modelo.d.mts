export const DIAS_CORTO: readonly string[];
export function num(n: number | null | undefined): string;
export function pct(p: number | null | undefined): string;
export function mesTxt(m: string): string;
export function fechaCorta(iso: string | null | undefined): string;
export function horaTxt(h: number): string;
export function horas(h: number | null | undefined): string;
export function pasoCarga(v: number, max: number): 0 | 1 | 2 | 3 | 4 | 5;
