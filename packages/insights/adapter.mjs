// (microsegundos: Date de JS los trunca a ms y confundiría «posterior» con «igual», igual que summaries.mjs)
// Adaptador PILOTO: entrega las conversaciones por mes desde insight_conversation_volume con la forma {months,undated,total} que consume /api/trends (el lector antiguo sobre conversation_monthly se retiró),
// para que /api/trends lo use sin cambiar su lógica. Si el insight no existe, está parcial o no se puede leer: {availability:'absent'|...} y el llamador cae al camino actual.
import {attempt} from '../workspace-service/summaries.mjs';
import {readConversationVolume} from './reader.mjs';
const TXT = 'YYYY-MM-DD HH24:MI:SS.US';
export async function readConversationMonthlyFromInsights(s, {timeoutMs = 1500} = {}) {
  const v = await readConversationVolume(s, {grain: 'month', timeoutMs});
  if (v.availability !== 'ready') return {availability: v.availability === 'partial' ? 'absent' : v.availability, months: []};
  const cur = await attempt(s, async () => (await s.query(
    `SELECT to_char(greatest((SELECT max(created_at) FROM public.conversations WHERE tenant_id=$1),(SELECT max(created_at) FROM public.messages WHERE tenant_id=$1)) AT TIME ZONE 'UTC','${TXT}') AS wm,
            (SELECT to_char(source_watermark AT TIME ZONE 'UTC','${TXT}') FROM public.insight_state WHERE tenant_id=$1 AND insight='conversation_volume') AS saved`, [s.tenantId])).rows[0], timeoutMs);
  if (cur.timeout || cur.unavailable) return {availability: 'timeout', months: []};
  const freshness = cur.value.wm !== null && (cur.value.saved === null || cur.value.wm > cur.value.saved) ? 'stale' : 'fresh';
  return {availability: 'ready', freshness, refreshedAt: v.meta.refreshedAt, cutoff: v.meta.sourceWatermark, months: v.points.map(p => ({month: p.period, n: p.n})), undated: v.undated, total: v.total, via: 'insight'};
}
