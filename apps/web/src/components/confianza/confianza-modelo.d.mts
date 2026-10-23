export type Nivel = 'alerta' | 'atrasada' | 'ok' | 'manual' | 'pausa' | 'sin_datos';
export const FACTOR_ALERTA: number;
export const NIVEL_TXT: Readonly<Record<Nivel, string>>;
export function nivelFuente(s: unknown, ahora?: number): Nivel;
export function bloqueFuentes(f: unknown, ahora?: number): {disponible: boolean; filas: Array<{clave: string; nombre: string; metodo: string; nivel: Nivel; estado: string; exito: string | null; siguiente: string | null; nuevos: number | null; hasta: string | null; error: string | null}>};
export function bloqueFrescura(f: unknown, ahora?: number): {disponible: boolean; filas: Array<{clave: string; nombre: string; nivel: Nivel; estado: string; actualizado: string | null; corte: string | null; filas: number; pendientes: number}>; alertas?: number};
export function bloqueVentanas(fuga: unknown): {disponible: boolean; linea: string; filas: Array<{canal: string; tipo: string; completa: boolean; desde: string | null; hasta: string | null; corte: string | null}>};
export type Tarea = {clave: string; titulo: string; afecta: string; cierra: string; base: string};
export function queNoSabemos(a?: {fuga?: unknown; carga?: unknown; cobertura?: unknown; frescura?: unknown; ahora?: number}): Tarea[];
