// Resumen del catálogo para la pantalla «Problemas» cuando no hay vínculos problema–pedido (sin importe por problema).
// Reúne, para TODOS los problemas vigentes y con topes de tiempo, lo que la lista necesita para ser legible: conversaciones (incidencias), severidad registrada,
// aviso crítico, citas REGISTRADAS (se verifican al abrir cada problema), recomendaciones guardadas. NO trae texto de conversación (minimización de privacidad: las listas no muestran extractos; el texto solo aparece al abrir la evidencia).
// Regla de honestidad: cada parte opcional que no alcanza su tope responde «unavailable» (valor null en las filas), nunca 0, y las demás partes siguen.
// No hace verificaciones completas de evidencia: la cita se verifica al abrir el problema.
import {resumirSenales} from './critico.mjs';
export const OVERVIEW_BUDGET_MS = 2500;

// Ejecuta una consulta opcional dentro de un SAVEPOINT con statement_timeout local; si vence o falla, revierte el savepoint (la transacción de lectura sigue utilizable) y devuelve null.
async function guarded(s, deadline, name, work) {
  const left = deadline - Date.now();
  if (left < 50) return null;
  const previous = (await s.query("SELECT current_setting('statement_timeout') AS v")).rows[0]?.v ?? '0';
  await s.query('SAVEPOINT ' + name);
  await s.query("SELECT set_config('statement_timeout',$1,true)", [Math.ceil(left) + 'ms']);
  try {
    const value = await work();
    await s.query("SELECT set_config('statement_timeout',$1,true)", [previous]);
    await s.query('RELEASE SAVEPOINT ' + name);
    return value;
  } catch {
    await s.query('ROLLBACK TO SAVEPOINT ' + name);
    await s.query("SELECT set_config('statement_timeout',$1,true)", [previous]);
    await s.query('RELEASE SAVEPOINT ' + name);
    return null; // 57014 (tope) u otro fallo de esta parte: «no disponible ahora», nunca un valor inventado
  }
}

/**
 * @param s transacción de lectura del tenant autorizado
 * @param catalog problemas vigentes del catálogo ({id,label,incidences,embeddingIds})
 * @param signalRows filas {pid,category,severity,spans} que ya leyó el cálculo de señales críticas (o null si no alcanzó)
 * @param isCritical regla única de «crítico» (la misma de criticalCount)
 */
export async function catalogOverview(s, catalog, {signalRows = null, isCritical, budgetMs = OVERVIEW_BUDGET_MS} = {}) {
  const deadline = Date.now() + budgetMs, ids = catalog.map(c => c.id);
  const per = new Map();
  // Regla única de «crítico» (critico.mjs): grupos con revisión crítica, señales críticas (evidencias) y motivo por grupo.
  const crit = signalRows ? resumirSenales(signalRows) : null;
  if (signalRows) for (const r of signalRows) {
    const o = per.get(r.pid) ?? {critical: false, spans: 0};
    o.spans += Number(r.spans) || 0;
    if (isCritical ? isCritical(r) : crit.porGrupo.has(r.pid)) o.critical = true;
    per.set(r.pid, o);
  }
  const meta = ids.length ? await guarded(s, deadline, 'catalog_meta', async () => new Map((await s.query(
    `SELECT p.id,p.severity,(SELECT count(DISTINCT r.id)::int FROM public.recommendations r WHERE r.tenant_id=$1 AND r.problem_id=p.id AND r.status<>'dismissed') AS recs
     FROM public.problems p WHERE p.tenant_id=$1 AND p.id=ANY($2::uuid[])`, [s.tenantId, ids])).rows.map(r => [r.id, r]))) : new Map();
  const rows = catalog.map(c => {
    const m = meta?.get(c.id), g = per.get(c.id);
    return {
      id: c.id, label: c.label, conversations: c.incidences,
      severity: meta ? (m?.severity ?? null) : null,
      critical: signalRows ? (g?.critical ?? false) : null,
      critical_signals: signalRows ? (crit.porGrupo.get(c.id)?.signals ?? 0) : null,
      critical_reason: signalRows ? (crit.porGrupo.get(c.id)?.reason ?? null) : null,
      citations: signalRows ? (g?.spans ?? 0) : null,
      recommendations: meta ? (m?.recs ?? 0) : null,
    };
  });
  const state = v => v ? 'ok' : 'unavailable';
  return {status: 'ok', total: rows.length, rows, critical: crit ? {groups: crit.grupos, signals: crit.senales} : null, parts: {signals: state(signalRows), severity: state(meta)}};
}
