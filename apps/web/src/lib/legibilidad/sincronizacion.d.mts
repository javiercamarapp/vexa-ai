export function hace(seg: number | null): string | null;
export function dentroDe(iso: string | null, ahora?: number): string | null;
export function textoError(code: string | null): string | null;
export function filasSincronizacion(f: unknown, ahora?: number): {
  disponible: boolean;
  fuentes: Array<{clave: string; nombre: string; metodo: string; estado: string; tono: 'ok' | 'bad' | 'info' | 'warn'; exito: string; siguiente: string | null; error: string | null; nuevos: number | null; latencia: string | null}>;
  calculos: Array<{clave: string; nombre: string; estado: string; actualizado: string | null; pendientes: number}>;
};
