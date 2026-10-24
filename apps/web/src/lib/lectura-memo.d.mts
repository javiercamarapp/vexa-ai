export function conMemoria<T>(clave: string, ttlMs: number, leer: () => Promise<T>, ahora?: () => number): Promise<T>;
export function olvidarMemoria(): void;
export function olvidarSiDegradada<T>(clave: string, valor: T): T;
