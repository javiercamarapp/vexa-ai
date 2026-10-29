import type {Tr} from './trad.mjs';
export const FUENTES: Readonly<Record<string, string>>;
export const METODOS: Readonly<Record<string, string>>;
export const CALCULOS: Readonly<Record<string, string>>;
export function nombreCalculo(id: string, t?: Tr | null): string;
export function nombreMetodo(m: string, t?: Tr | null): string;
export function nombreFuente(k: string, t?: Tr | null): string;
export function hace(seg: number | null, t?: Tr | null): string | null;
export function dentroDe(iso: string | null, ahora?: number, t?: Tr | null): string | null;
export function textoError(code: string | null, t?: Tr | null): string | null;
export function filasSincronizacion(f: unknown, ahora?: number, t?: Tr | null): {
  disponible: boolean;
  fuentes: Array<{clave: string; nombre: string; metodo: string; estado: string; tono: 'ok' | 'bad' | 'info' | 'warn'; exito: string; siguiente: string | null; error: string | null; nuevos: number | null; latencia: string | null}>;
  calculos: Array<{clave: string; nombre: string; estado: string; actualizado: string | null; pendientes: number}>;
};
