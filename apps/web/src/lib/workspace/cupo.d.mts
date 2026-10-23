export const TOPE_LECTURAS: number;
export const TOPE_PRECALENTAMIENTO: number;
export const REINTENTOS_503: number;
export type Limitador = {
  ejecutar<T>(fn: () => Promise<T> | T, opciones?: {baja?: boolean; signal?: AbortSignal}): Promise<T>;
  estado(): {altas: number; bajas: number; enCola: number; pico: number};
  reiniciarPico(): void;
};
export function crearLimitador(opciones?: {tope?: number; topeBaja?: number}): Limitador;
export const limitadorGlobal: Limitador;
export function esperaReintento(n: number, retryAfter?: string | null, azar?: () => number): number;
export function fetchCupo(url: string, init?: RequestInit, opciones?: {baja?: boolean; fetchFn?: typeof fetch; limitador?: Limitador; espera?: (n: number, retryAfter: string | null) => number; reintentos?: number}): Promise<Response>;
