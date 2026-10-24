/**
 * Guardia HTTP de «ver como» (solo lectura). Es la CAPA EXTERNA: rechaza escrituras y exportaciones antes de llegar a la ruta.
 * La marca es una cookie, no autoridad; si alguien la borra, las escrituras siguen fallando abajo (db.ts permite solo 'read' con sesión de soporte y
 * el administrador no tiene membresía en la organización, así que ninguna política de escritura lo deja pasar).
 * Módulo sin dependencias de servidor para poder probarse y usarse desde el middleware.
 */
export const SUPPORT_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;
/** Rutas propias del administrador que siguen permitidas con sesión de soporte (cambiar de organización, salir, consola de plataforma). */
const ALLOWED_PREFIXES = ['/auth/', '/platform', '/api/platform'];
const EXPORT_PATH = /\/(export|download)(\/|$)/;
export type SupportVerdict = {ok: true} | {ok: false; code: 'support_read_only' | 'support_export_blocked'};
/** `mark` = valor de la cookie de marca (epoch en segundos de caducidad). Sin marca vigente no se decide nada aquí. */
export function supportMarkActive(mark: string | undefined, nowMs = Date.now()): boolean {
  if (!mark || !/^\d{9,12}$/.test(mark)) return false;
  return Number(mark) * 1000 > nowMs;
}
export function supportVerdict(method: string, path: string): SupportVerdict {
  const m = method.toUpperCase();
  if (ALLOWED_PREFIXES.some(p => path === p || path.startsWith(p.endsWith('/') ? p : p + '/') )) return {ok: true};
  if (!(SUPPORT_SAFE_METHODS as readonly string[]).includes(m)) return {ok: false, code: 'support_read_only'};
  if (EXPORT_PATH.test(path)) return {ok: false, code: 'support_export_blocked'};
  return {ok: true};
}
