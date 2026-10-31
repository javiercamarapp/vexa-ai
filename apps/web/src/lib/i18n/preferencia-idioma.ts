// Idioma preferido POR PERSONA (tabla public.user_preferences, migración 20261209000000). Solo servidor.
// Es MEJOR ESFUERZO: la cookie rovaq_lang sigue siendo lo que manda en la interfaz. Si la tabla no existe (migración sin aplicar), si la base no responde o si no hay sesión,
// el guardado no hace nada y no lanza: el selector funciona igual y los envíos del sistema (reporte semanal, avisos, push) caen a español.
import {idiomaValido, type Idioma} from './idioma';

export type MotivoSinGuardar = 'idioma_invalido' | 'sin_sesion' | 'sin_tabla' | 'error';
export type ResultadoGuardado = {guardado: true} | {guardado: false; motivo: MotivoSinGuardar};
/** Lo mínimo del cliente de Supabase que usa el guardado (el de la sesión de la persona: la RLS limita la escritura a su propia fila). */
export type ClientePreferencias = {from(tabla: string): {upsert(fila: Record<string, unknown>, opciones: {onConflict: string}): PromiseLike<{error: {code?: string; message?: string} | null}>}};

/** La base respondió que la tabla no existe (Postgres 42P01) o que PostgREST no la conoce (PGRST205/PGRST200 «schema cache»). */
export function faltaLaTabla(error: {code?: string; message?: string} | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /user_preferences/.test(error.message ?? '') && /(does not exist|schema cache|not find)/i.test(error.message ?? '');
}

export async function guardarIdiomaDePersona(client: ClientePreferencias, userId: string | null | undefined, valor: unknown): Promise<ResultadoGuardado> {
  const idioma: Idioma | null = idiomaValido(valor);
  if (!idioma) return {guardado: false, motivo: 'idioma_invalido'};
  if (!userId) return {guardado: false, motivo: 'sin_sesion'};
  try {
    const {error} = await client.from('user_preferences').upsert({user_id: userId, idioma}, {onConflict: 'user_id'});
    if (!error) return {guardado: true};
    return {guardado: false, motivo: faltaLaTabla(error) ? 'sin_tabla' : 'error'};
  } catch {
    return {guardado: false, motivo: 'error'};
  }
}
