// Modelo de la consola de plataforma (puro). Entrada: instantánea `platform_observe` (agregados por organización; nunca texto de clientes).
import {int, pct, ratioBps} from './format.mjs';

export const EXPECTED_SOURCES = Object.freeze([
  {key: 'hubspot', label: 'HubSpot (conversaciones y contactos)'},
  {key: 'associations', label: 'Asociaciones ticket–contacto'},
  {key: 'csv', label: 'Archivos CSV'},
  {key: 'ledger', label: 'Libro de registros (marketplaces y Shopify)'},
  {key: 'excel', label: 'Excel (Tracker)'},
  {key: 'attachments', label: 'Adjuntos'},
  {key: 'zendesk', label: 'Zendesk'},
]);
export const usd = micro => (micro === null || micro === undefined ? 'No disponible' : 'US$ ' + new Intl.NumberFormat('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(BigInt(micro) / 10000n) / 100));
const days = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
export const HEALTH = Object.freeze({healthy: 'Saludable', attention: 'Requiere atención', critical: 'Crítica'});
export const SEVERITY_LABEL = Object.freeze({alta: 'Alta', media: 'Media', baja: 'Baja', info: 'Informativa'});

export function orgHealth(org, now) {
  const reasons = [];
  const add = (level, text) => reasons.push({level, text});
  if (org.jobs.stuck > 0) add('critical', `${int(org.jobs.stuck)} proceso(s) en segundo plano atascado(s)`);
  if (org.jobs.failed > 0) add(org.jobs.failed >= 3 ? 'critical' : 'attention', `${int(org.jobs.failed)} proceso(s) fallido(s)`);
  if (org.imports.failed > 0) add('attention', `${int(org.imports.failed)} importación(es) fallida(s)`);
  const lim = BigInt(org.ai.limitMicro), spent = BigInt(org.ai.spentMicro);
  if (lim > 0n) { const p = Number(spent * 10000n / lim); if (p >= 10000) add('critical', 'Tope de IA agotado'); else if (p >= 8000) add('attention', `Gasto de IA al ${pct(p)} del tope`); }
  if (org.ai.uncertain > 0) add('attention', `${int(org.ai.uncertain)} reserva(s) de IA sin conciliar`);
  if (org.lastActivityAt && days(org.lastActivityAt, now) >= 14) add('attention', `Sin actividad desde hace ${days(org.lastActivityAt, now)} días`);
  if (!org.lastActivityAt) add('info', 'Sin actividad registrada todavía');
  if (org.invitationsExpired > 0) add('info', `${int(org.invitationsExpired)} invitación(es) vencida(s)`);
  const level = reasons.some(r => r.level === 'critical') ? 'critical' : reasons.some(r => r.level === 'attention') ? 'attention' : 'healthy';
  return {level, label: HEALTH[level], reasons};
}

export function buildPlatformView(raw, {now = raw.generatedAt} = {}) {
  const orgs = raw.organizations.map(o => {
    const health = orgHealth(o, now), loaded = EXPECTED_SOURCES.filter(s => o.sources[s.key]?.loaded).length;
    const spent = BigInt(o.ai.spentMicro), limit = BigInt(o.ai.limitMicro);
    const day = new Date(now).getUTCDate(), dim = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth() + 1, 0)).getUTCDate();
    const projected = day > 0 ? spent * BigInt(dim) / BigInt(day) : spent;
    return {...o, health, sourcesLoaded: loaded, sourcesExpected: EXPECTED_SOURCES.length,
      aiPctBps: limit > 0n ? Number(spent * 10000n / limit) : null, aiSpent: usd(o.ai.spentMicro), aiLimit: usd(o.ai.limitMicro),
      aiProjected: {micro: projected.toString(), display: usd(projected.toString()), overLimit: limit > 0n && projected > limit, kind: 'estimated', how: `Estimado: gasto del mes ÷ ${day} días transcurridos × ${dim} días del mes. Supone gasto uniforme; no es un compromiso.`}};
  });
  const counts = {healthy: 0, attention: 0, critical: 0};
  orgs.forEach(o => { counts[o.health.level] += 1; });
  const totalSpent = orgs.reduce((a, o) => a + BigInt(o.ai.spentMicro), 0n), totalLimit = orgs.reduce((a, o) => a + BigInt(o.ai.limitMicro), 0n);
  const alerts = [];
  for (const o of orgs) for (const r of o.health.reasons) if (r.level !== 'info') alerts.push({id: `org:${o.id}:${r.text}`, severity: r.level === 'critical' ? 'alta' : 'media', title: r.text, organizationId: o.id, organization: o.name, kind: 'observed', source: 'Estado de la organización', href: `/platform/organizaciones?org=${o.id}`});
  for (const s of raw.opsSignals) {
    if (s.status === 'ok') continue;
    alerts.push({id: `ops:${s.kind}`, severity: s.status === 'crit' ? 'alta' : s.status === 'warn' ? 'media' : 'info', title: s.title, detail: s.detail, organizationId: null, organization: null, kind: s.status === 'unknown' ? 'unclassified' : 'observed', source: s.source ?? 'Sin fuente conectada', href: '/platform/alertas', unknown: s.status === 'unknown'});
  }
  const ord = {alta: 0, media: 1, baja: 2, info: 3};
  alerts.sort((a, b) => ord[a.severity] - ord[b.severity] || a.id.localeCompare(b.id));
  const jobsTotals = orgs.reduce((a, o) => ({queued: a.queued + o.jobs.queued, running: a.running + o.jobs.running, partial: a.partial + o.jobs.partial, failed: a.failed + o.jobs.failed, stuck: a.stuck + o.jobs.stuck}), {queued: 0, running: 0, partial: 0, failed: 0, stuck: 0});
  const sourcesMatrix = EXPECTED_SOURCES.map(s => ({...s, cells: orgs.map(o => { const c = o.sources[s.key]; return {organizationId: o.id, organization: o.name, loaded: !!c?.loaded, total: c?.total ?? 0, incorporated: c?.incorporated ?? 0, rejected: c?.rejected ?? 0, pending: c?.pending ?? 0, lastUpdate: c?.lastUpdate ?? null, coverageBps: c?.loaded ? ratioBps(c.incorporated, c.total) : null}; })}));
  return {
    generatedAt: raw.generatedAt, organizations: orgs, counts,
    kpis: {
      organizations: orgs.length, healthy: counts.healthy, attention: counts.attention, critical: counts.critical,
      openAlerts: alerts.filter(a => a.severity !== 'info').length,
      failedJobs: jobsTotals.failed, stuckJobs: jobsTotals.stuck, queued: jobsTotals.queued, running: jobsTotals.running,
      aiSpent: usd(totalSpent.toString()), aiLimit: usd(totalLimit.toString()), aiPctBps: totalLimit > 0n ? Number(totalSpent * 10000n / totalLimit) : null,
      ledgerRows: orgs.reduce((a, o) => a + o.ledger.rows, 0),
    },
    jobs: {totals: jobsTotals, failed: raw.failedJobs.map(j => ({...j, organization: orgs.find(o => o.id === j.organizationId)?.name ?? 'Organización desconocida'}))},
    sources: sourcesMatrix, alerts, opsSignals: raw.opsSignals, audit: raw.audit,
    aiCosts: orgs.map(o => ({id: o.id, name: o.name, spent: o.aiSpent, limit: o.aiLimit, pctBps: o.aiPctBps, projected: o.aiProjected, uncertain: o.ai.uncertain, window: o.ai.window})).sort((a, b) => (b.pctBps ?? -1) - (a.pctBps ?? -1)),
  };
}
