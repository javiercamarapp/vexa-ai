// Almacén SQL de la lectura de IA (L4): llama a las funciones de 20261127000000_pain_points_ia_semanal.sql. Lecturas con la sesión del usuario (RLS); escrituras SOLO por funciones con guarda.
// Cada llamada es SU PROPIA transacción: la reserva se confirma ANTES de la llamada al proveedor y la liquidación ocurre DESPUÉS, con el costo real.
// Si la migración aún no está aplicada (42883/42P01) las lecturas devuelven «no disponible» y las escrituras fallan cerrado: nada se gasta.
import {WorkspaceError} from './contracts.mjs';

const falta = e => ['42883', '42P01'].includes(e?.code) || /does not exist|no existe/i.test(String(e?.message ?? ''));
const porSql = async (promesa) => { try { return await promesa; } catch (e) { if (falta(e)) throw new WorkspaceError('ia_no_migrada', 503); throw e; } };
const fn = async (s, nombre, args = [], casts = []) => (await s.query(`SELECT public.${nombre}(${args.map((_, i) => '$' + (i + 1) + (casts[i] ? '::' + casts[i] : '')).join(',')}) AS r`, args)).rows[0]?.r ?? null;

export function createPainAiStore({database}) {
  return {
    presupuesto: () => porSql(database.transaction('read', s => fn(s, 'analysis_budget_status', [s.tenantId], ['uuid']))),
    reservar: (clave, estimadoMicro) => porSql(database.transaction('import', s => fn(s, 'analysis_budget_reserve', [s.tenantId, clave, String(estimadoMicro)], ['uuid', 'text', 'bigint']))),
    liquidar: (clave, costoMicro) => porSql(database.transaction('import', s => fn(s, 'analysis_budget_settle', [s.tenantId, clave, costoMicro == null ? null : String(costoMicro)], ['uuid', 'text', 'bigint']))),
    buscarRun: (puntoId, corte, version) => porSql(database.transaction('read', async s => {
      const r = (await s.query('SELECT id FROM public.analysis_runs WHERE tenant_id=$1 AND point_id=$2 AND cut=$3 AND prompt_version=$4', [s.tenantId, puntoId, corte, version])).rows[0];
      return r ? fn(s, 'analysis_run_view', [r.id], ['uuid']) : null;
    })),
    ultimoRun: (puntoId) => porSql(database.transaction('read', async s => {
      const r = (await s.query(`SELECT r.id FROM public.analysis_runs r WHERE r.tenant_id=$1 AND r.point_id=$2 AND EXISTS(SELECT 1 FROM public.analysis_reads a WHERE a.run_id=r.id AND a.status='ok') ORDER BY r.updated_at DESC LIMIT 1`, [s.tenantId, puntoId])).rows[0];
      return r ? fn(s, 'analysis_run_view', [r.id], ['uuid']) : null;
    })),
    guardar: (payload) => porSql(database.transaction('import', s => fn(s, 'analysis_run_save', [s.tenantId, JSON.stringify(payload)], ['uuid', 'jsonb']))),
  };
}
