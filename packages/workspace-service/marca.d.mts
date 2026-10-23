export const ROVAQ: Readonly<{negro: string; rojo: string; blanco: string}>;
export const MINIMOS: Readonly<{horizontal: number; simbolo: number}>;
export type RovaqVariante = 'horizontal' | 'simbolo';
export type RovaqLogoDatos = Readonly<{viewBox: string; tinta: readonly string[]; punto: Readonly<{cx: number; cy: number; r: number}>}>;
export const LOGOS: Readonly<Record<RovaqVariante, RovaqLogoDatos>>;
export function espacioLibreEn(variante: RovaqVariante, ancho: number): number;
export function rovaqLogoSvg(opciones?: {variante?: RovaqVariante; tono?: 'positivo' | 'negativo'; ancho?: number}): string;
