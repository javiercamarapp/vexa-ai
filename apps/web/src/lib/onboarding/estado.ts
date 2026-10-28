// Estado local del onboarding (solo lo NO derivable de los datos): visto, omitido, descartado y paso actual.
// Vive en localStorage, SIEMPRE dentro de try/catch (modo privado, datos bloqueados, cuota llena o ausencia de window no deben romper el render).
// La clave lleva un hash corto de usuario+organización, nunca el id en claro. Lo que sí se deriva (conexión activa, historial importado…) NO se guarda:
// se recalcula cada vez y, al volver a un rol, jamás se confía en un «completado» guardado.
import {pasosDe, type Pista, type PasoOnboarding} from './catalogo.mjs';

export const PREFIJO_ONB = 'onb.';
export const VERSION_ESTADO = 'v1';
/** Subconjunto de Storage que usamos (permite probar con un almacén falso). */
export interface Almacen { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; key(i: number): string | null; readonly length: number }
/** `activo` = el recorrido estaba abierto al recargar o cerrar la pestaña: se retoma solo en ese paso (Esc, Omitir y Terminar lo apagan). */
export interface EstadoLocal { visto: boolean; omitido: boolean; descartado: boolean; paso: string | null; activo: boolean }
export const ESTADO_VACIO: EstadoLocal = Object.freeze({ visto: false, omitido: false, descartado: false, paso: null, activo: false });

/** Hash corto (FNV-1a 32 bits, 8 hex) de usuario+organización. No es criptográfico: solo evita dejar el id en claro en el navegador. */
export function hashCorto(userId: string, tenantId: string): string {
  let h = 0x811c9dc5;
  const texto = `${userId}\u0000${tenantId}`;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export const claveEstado = (userId: string, tenantId: string, pista: Pista): string => `${PREFIJO_ONB}${VERSION_ESTADO}.${hashCorto(userId, tenantId)}.${pista}`;

/** localStorage del navegador, o null si no existe o el acceso lanza (Safari privado, bloqueo de datos del sitio, SSR). */
export function almacenDelNavegador(): Almacen | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

function normalizar(crudo: unknown): EstadoLocal {
  if (!crudo || typeof crudo !== 'object') return { ...ESTADO_VACIO };
  const c = crudo as Record<string, unknown>;
  return { visto: c.visto === true, omitido: c.omitido === true, descartado: c.descartado === true, activo: c.activo === true, paso: typeof c.paso === 'string' && c.paso.length <= 80 ? c.paso : null };
}
/** Lee el estado; cualquier fallo (sin almacén, excepción, JSON roto, forma rara) devuelve el estado vacío. */
export function leerEstado(almacen: Almacen | null, clave: string): EstadoLocal {
  try { const texto = almacen?.getItem(clave); return texto ? normalizar(JSON.parse(texto)) : { ...ESTADO_VACIO }; } catch { return { ...ESTADO_VACIO }; }
}
/** Guarda el estado. Devuelve true si quedó guardado; false si no hay almacén o falló (el flujo sigue en memoria). */
export function guardarEstado(almacen: Almacen | null, clave: string, estado: EstadoLocal): boolean {
  try { if (!almacen) return false; almacen.setItem(clave, JSON.stringify(normalizar(estado))); return true; } catch { return false; }
}
/** Lee, aplica el parche y guarda; devuelve el estado resultante (aunque no se haya podido persistir). */
export function actualizarEstado(almacen: Almacen | null, clave: string, parche: Partial<EstadoLocal>): EstadoLocal {
  const siguiente = normalizar({ ...leerEstado(almacen, clave), ...parche });
  guardarEstado(almacen, clave, siguiente);
  return siguiente;
}

export interface Reconciliado {
  /** Paso del tour que toca mostrar (id del catálogo) o null si no hay tour. */
  pasoActual: string | null;
  /** Estado limpio de referencias a pasos que ya no existen en la pista actual. */
  estado: EstadoLocal;
  /** Ids del checklist/tour completos, recalculados SOLO de los datos derivados recibidos. */
  completados: string[];
}
/**
 * Reconcilia lo guardado con la pista y los datos de ahora (al cambiar de rol u organización o al volver a un rol anterior):
 * si el paso guardado ya no pertenece al tour de la pista, vuelve al primero; «completado» sale de `derivados` (ids de paso cuyo prerrequisito hoy se cumple), nunca de lo guardado.
 */
export function reconciliar(estado: EstadoLocal, pista: Pista | null, derivados: ReadonlySet<string> | readonly string[] = []): Reconciliado {
  const guardado = normalizar(estado);
  if (!pista) return { pasoActual: null, estado: { ...guardado, paso: null }, completados: [] };
  const tour: PasoOnboarding[] = pasosDe(pista, 'tour');
  const validos = new Set(tour.map((p) => p.id));
  const paso = guardado.paso && validos.has(guardado.paso) ? guardado.paso : (tour[0]?.id ?? null);
  const hechos = new Set(derivados);
  return { pasoActual: paso, estado: { ...guardado, paso }, completados: pasosDe(pista).filter((p) => hechos.has(p.id)).map((p) => p.id) };
}

/** Borra TODAS las claves onb.* del navegador (al cerrar sesión: equipos compartidos). Devuelve cuántas quitó; nunca lanza. */
export function limpiarEstadoOnboarding(almacen: Almacen | null): number {
  try {
    if (!almacen) return 0;
    const claves: string[] = [];
    for (let i = 0; i < almacen.length; i++) { const k = almacen.key(i); if (k && k.startsWith(PREFIJO_ONB)) claves.push(k); }
    let n = 0;
    for (const k of claves) { try { almacen.removeItem(k); n++; } catch { /* sigue con las demás */ } }
    return n;
  } catch { return 0; }
}
