export function conMemoria<T>(clave: string, ttlMs: number, leer: () => Promise<T>, ahora?: () => number, opciones?: {rancioMs?: number; noGuardar?: ((valor: T) => boolean) | null}): Promise<T>;
export function esDegradada(valor: unknown): boolean;
export function olvidarMemoria(): void;
export function olvidarSiDegradada<T>(clave: string, valor: T): T;
