export const CAUSA: string;
export const CAUSA_EN: string;
export function causaDe(idioma?: string): string;
export function explicarVariacion(report: unknown, moneda: string, opciones?: {umbralBps?: number; idioma?: string; t?: ((clave: string, vars?: Record<string, string | number>) => string) | null}): {titulo: string; lineas: string[]; causa: string} | null;
