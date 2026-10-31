// Idioma PREFERIDO de cada persona (public.user_preferences, migración 20261209000000) para lo que el sistema envía SIN petición suya: reporte semanal, aviso por correo y push.
// Un worker no tiene cookie ni Accept-Language, así que el idioma sale de esta preferencia; si la persona no tiene fila (nunca usó el selector, o la migración aún no está aplicada)
// el respaldo es «es»: el producto atiende a México y «es» es el comportamiento histórico byte a byte de todo lo que se envía.
// La lectura es MEJOR ESFUERZO: cualquier error (tabla ausente, permisos, base caída) devuelve un mapa vacío y NUNCA rompe ni retrasa un envío.
import {idiomaDe} from './idioma.mjs';
export const IDIOMA_DE_RESPALDO = 'es';
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** Una sola sentencia, solo lectura, solo idioma válido. El rol de servicio tiene select sobre (user_id, idioma) y nada más. */
const LISTA_IDIOMAS = ['es', 'en'].map(x => "'" + x + "'").join(',');
export const SQL_IDIOMAS = `SELECT user_id::text AS user_id, idioma FROM public.user_preferences WHERE user_id = ANY($1::uuid[]) AND idioma IN (${LISTA_IDIOMAS})`;
const limpiar = ids => [...new Set((ids ?? []).filter(x => typeof x === 'string' && UUID.test(x)).map(x => x.toLowerCase()))].slice(0, 500);
export const mapaDeFilas = filas => { const m = new Map(); for (const f of filas ?? []) if (typeof f?.user_id === 'string' && (f.idioma === 'es' || f.idioma === 'en')) m.set(f.user_id.toLowerCase(), f.idioma); return m; };
/** Lee los idiomas con el `database` del worker ({transaction(action, cb)}) en SU PROPIA transacción corta de lectura (un error aquí no contamina otra transacción). */
export async function idiomasDePersonas(database, userIds, {action = 'read'} = {}) {
  const ids = limpiar(userIds);
  if (!ids.length || typeof database?.transaction !== 'function') return new Map();
  try { return mapaDeFilas((await database.transaction(action, s => s.query(SQL_IDIOMAS, [ids]))).rows); } catch { return new Map(); }
}
/** Lo mismo con una función `consultar(sql, valores) => {rows}` (la usa el repositorio de correo, que trabaja con un pool y no con `database`). */
export async function idiomasConConsulta(consultar, userIds) {
  const ids = limpiar(userIds);
  if (!ids.length || typeof consultar !== 'function') return new Map();
  try { return mapaDeFilas((await consultar(SQL_IDIOMAS, [ids])).rows); } catch { return new Map(); }
}
/** Idioma de una persona con respaldo documentado: su preferencia o «es». */
export const idiomaDeLaPersona = (preferencias, userId) => idiomaDe(preferencias?.get?.(String(userId).toLowerCase()) ?? IDIOMA_DE_RESPALDO);
