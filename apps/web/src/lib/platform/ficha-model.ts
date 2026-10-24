/** Modelo puro de la ficha 360 de un cliente. Entrada: el JSON agregado de platform_org_detail (sin PII). Salida: filas y señales listas para pintar. */
export type OrgDetail = {
  generatedAt: string;
  organization: {id: string; name: string; createdAt: string};
  members: {owner: number; analyst: number; operator: number; viewer: number; total: number};
  invitations: {pending: number; expired: number; deliveryProblems: number};
  connections: Array<{source: string; status: string; health: string | null; lastSuccess: string | null; errorCode: string | null}>;
  sources: Array<{source: string; total: number; incorporated: number; rejected: number; pending: number; lastUpdate: string | null}>;
  imports: {total: number; open: number; failed30d: number; lastAt: string | null};
  jobs: {queued: number; running: number; partial: number; failed30d: number; stuck: number; succeeded24h: number; failed24h: number; lastAt: string | null};
  ledger: {rows: number; lastAt: string | null};
  ai: {window: string; spentMicro: string; limitMicro: string; uncertain: number};
  cuts: Array<{id: string; status: string; asOf: string | null; publishedAt: string | null; createdAt: string; components: number | null}>;
  support: Array<{id: string; adminId: string; reason: string; startedAt: string; expiresAt: string; endedAt: string | null; endReason: string | null}>;
  audit: Array<{operation: string; actorId: string; createdAt: string}>;
};
export type Level = 'ok' | 'warn' | 'bad' | 'info';
export type Freshness = 'none' | 'fresh' | 'aging' | 'stale';
const H = 3600_000, D = 24 * H;
export function freshness(iso: string | null | undefined, now: number): Freshness {
  if (!iso) return 'none'; const age = now - Date.parse(iso);
  return !Number.isFinite(age) ? 'none' : age < 2 * D ? 'fresh' : age < 7 * D ? 'aging' : 'stale';
}
export function relative(iso: string | null | undefined, now: number): string {
  if (!iso) return 'Sin registro'; const ms = now - Date.parse(iso); if (!Number.isFinite(ms)) return 'Sin registro';
  if (ms < 0) return 'Hace un momento'; const m = Math.floor(ms / 60000);
  return m < 1 ? 'Hace un momento' : m < 60 ? `Hace ${m} min` : m < 48 * 60 ? `Hace ${Math.floor(m / 60)} h` : `Hace ${Math.floor(m / 1440)} d`;
}
const SOURCE_LABEL: Record<string, string> = {hubspot: 'HubSpot', csv: 'CSV', zendesk: 'Zendesk', excel: 'Excel', sin_conexion: 'Cargas manuales'};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s;
export type SourceRow = {source: string; label: string; total: number; incorporated: number; rejected: number; pending: number; incorporatedBps: number | null; lastUpdate: string | null; freshness: Freshness; connection: {status: string; health: string | null; errorCode: string | null; lastSuccess: string | null} | null};
export function sourceRows(d: OrgDetail, now: number): SourceRow[] {
  const keys = [...new Set([...d.sources.map(s => s.source), ...d.connections.map(c => c.source)])].sort();
  return keys.map(k => {
    const s = d.sources.find(x => x.source === k), c = d.connections.find(x => x.source === k) ?? null, last = s?.lastUpdate ?? c?.lastSuccess ?? null;
    return {source: k, label: sourceLabel(k), total: s?.total ?? 0, incorporated: s?.incorporated ?? 0, rejected: s?.rejected ?? 0, pending: s?.pending ?? 0,
      incorporatedBps: s && s.total > 0 ? Math.round(s.incorporated * 10000 / s.total) : null, lastUpdate: last, freshness: freshness(last, now),
      connection: c ? {status: c.status, health: c.health, errorCode: c.errorCode, lastSuccess: c.lastSuccess} : null};
  });
}
export function aiUsage(d: OrgDetail) {
  const spent = BigInt(d.ai.spentMicro || '0'), limit = BigInt(d.ai.limitMicro || '0');
  return {spentMicro: spent.toString(), limitMicro: limit.toString(), pctBps: limit > 0n ? Number(spent * 10000n / limit) : null, window: d.ai.window, uncertain: d.ai.uncertain};
}
export type Signal = {level: Exclude<Level, 'ok'>; text: string};
/** Señales de atención con su motivo en lenguaje llano; el peor nivel manda. Nada se infiere de lo que no se midió. */
export function signals(d: OrgDetail, now: number): Signal[] {
  const out: Signal[] = [], ai = aiUsage(d);
  if (d.members.owner === 0) out.push({level: 'bad', text: 'No tiene ningún dueño activo.'});
  if (d.jobs.stuck > 0) out.push({level: 'bad', text: `${d.jobs.stuck} proceso(s) atascado(s).`});
  for (const c of d.connections) {
    if (c.health === 'reconnect_required' || c.status === 'reconnect_required') out.push({level: 'bad', text: `${sourceLabel(c.source)} necesita reconectarse.`});
    else if (c.health === 'stale' || c.status === 'failed') out.push({level: 'warn', text: `${sourceLabel(c.source)} no se está actualizando.`});
  }
  if (ai.pctBps !== null && ai.pctBps >= 10000) out.push({level: 'bad', text: 'Gasto de IA por encima del tope.'}); else if (ai.pctBps !== null && ai.pctBps >= 8000) out.push({level: 'warn', text: 'Gasto de IA cerca del tope.'});
  if (ai.uncertain > 0) out.push({level: 'warn', text: `${ai.uncertain} reserva(s) de IA con resultado incierto.`});
  if (d.jobs.failed30d > 0) out.push({level: 'warn', text: `${d.jobs.failed30d} proceso(s) fallido(s) en 30 días.`});
  if (d.imports.failed30d > 0) out.push({level: 'warn', text: `${d.imports.failed30d} carga(s) fallida(s) en 30 días.`});
  if (d.invitations.expired > 0) out.push({level: 'warn', text: `${d.invitations.expired} invitación(es) vencida(s) sin aceptar.`});
  if (d.invitations.deliveryProblems > 0) out.push({level: 'warn', text: `${d.invitations.deliveryProblems} invitación(es) con problema de entrega.`});
  if (d.ledger.rows === 0) out.push({level: 'warn', text: 'Aún no tiene asientos cargados.'});
  else if (freshness(d.ledger.lastAt, now) === 'stale') out.push({level: 'warn', text: 'El libro no recibe asientos desde hace más de una semana.'});
  if (!d.cuts.some(c => c.status === 'published')) out.push({level: 'info', text: 'Sin cortes publicados.'});
  return out.sort((a, b) => ({bad: 0, warn: 1, info: 2})[a.level] - ({bad: 0, warn: 1, info: 2})[b.level]);
}
export const overallLevel = (s: Signal[]): Level => (s.some(x => x.level === 'bad') ? 'bad' : s.some(x => x.level === 'warn') ? 'warn' : 'ok');
export const OP_LABEL: Record<string, string> = {create: 'Organización creada', team_invite: 'Invitación enviada', team_role: 'Cambio de rol', team_revoke: 'Acceso revocado', team_cancel: 'Invitación cancelada', team_claim: 'Entrega de invitación', team_receipt: 'Recibo de entrega',
  team_list: 'Lectura del equipo', org_view: 'Ficha consultada', support_start: 'Modo soporte iniciado', support_end: 'Modo soporte terminado', copilot_query: 'Consulta del copiloto'};
export const END_LABEL: Record<string, string> = {ended: 'Terminó el administrador', expired: 'Venció'};
export const FIXTURE_DETAIL = (id: string, now: number): OrgDetail => ({
  generatedAt: new Date(now).toISOString(), organization: {id, name: 'Cliente de ejemplo A (sintético)', createdAt: new Date(now - 60 * D).toISOString()},
  members: {owner: 1, analyst: 2, operator: 0, viewer: 1, total: 4}, invitations: {pending: 1, expired: 1, deliveryProblems: 0},
  connections: [{source: 'hubspot', status: 'active', health: 'healthy', lastSuccess: new Date(now - 3 * H).toISOString(), errorCode: null}, {source: 'zendesk', status: 'active', health: 'stale', lastSuccess: new Date(now - 9 * D).toISOString(), errorCode: 'TIMEOUT'}],
  sources: [{source: 'hubspot', total: 18250, incorporated: 18102, rejected: 0, pending: 148, lastUpdate: new Date(now - 3 * H).toISOString()}, {source: 'zendesk', total: 5400, incorporated: 5311, rejected: 89, pending: 0, lastUpdate: new Date(now - 9 * D).toISOString()}, {source: 'sin_conexion', total: 61200, incorporated: 60980, rejected: 220, pending: 0, lastUpdate: new Date(now - 2 * D).toISOString()}],
  imports: {total: 31, open: 1, failed30d: 2, lastAt: new Date(now - 3 * H).toISOString()}, jobs: {queued: 1, running: 0, partial: 0, failed30d: 2, stuck: 0, succeeded24h: 40, failed24h: 0, lastAt: new Date(now - 5 * 60000).toISOString()},
  ledger: {rows: 85361, lastAt: new Date(now - 6 * H).toISOString()}, ai: {window: '2026-10', spentMicro: '61840000', limitMicro: '100000000', uncertain: 0},
  cuts: [{id: 'c1', status: 'published', asOf: new Date(now - 2 * D).toISOString(), publishedAt: new Date(now - 2 * D).toISOString(), createdAt: new Date(now - 2 * D).toISOString(), components: 412}, {id: 'c2', status: 'draft', asOf: null, publishedAt: null, createdAt: new Date(now - 1 * D).toISOString(), components: null}],
  support: [{id: 's1', adminId: 'a0000000-0000-4000-8000-000000000001', reason: 'Revisar la carga de HubSpot', startedAt: new Date(now - 5 * D).toISOString(), expiresAt: new Date(now - 5 * D + 30 * 60000).toISOString(), endedAt: new Date(now - 5 * D + 12 * 60000).toISOString(), endReason: 'ended'}],
  audit: [{operation: 'org_view', actorId: 'a0000000-0000-4000-8000-000000000001', createdAt: new Date(now - 60000).toISOString()}, {operation: 'support_end', actorId: 'a0000000-0000-4000-8000-000000000001', createdAt: new Date(now - 5 * D + 12 * 60000).toISOString()}],
});
