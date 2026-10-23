// Ficha de UN problema (grupo): lo que el sistema SÍ sabe, con topes por parte y «no disponible ahora» (null, nunca 0) cuando una parte no alcanza.
// Es solo lectura, acotada al tenant y a las embeddings del problema; no recorre el libro económico ni verifica evidencia completa (la cita se verifica al abrir).
// Vocabulario: «conversaciones» = conversaciones distintas del grupo (membresía vigente); «citas registradas» = evidence_spans de sus extracciones; «incidencias» NO se usan aquí.
// El dinero por problema NO existe en este corte (no hay vínculos problema–pedido): este módulo no lo calcula ni lo estima.
import {WorkspaceError, uuid} from './contracts.mjs';
import {guarded} from './catalog-overview.mjs';
import {resumirSenales} from './critico.mjs';
export const FACTS_BUDGET_MS = 2500;
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const KIND = {image: 'imagen', video: 'video', audio: 'audio', application: 'documento', text: 'documento', message: 'documento'};
const claseAdjunto = m => KIND[m] ?? 'otro';

/** Posición del grupo dentro de los de su misma etiqueta (por conversaciones desc, empate por id): misma regla que numerarGrupos de la lista. */
export function posicionGrupo(filas, id) {
  const yo = filas.find(f => f.id === id);
  if (!yo) return null;
  const hermanos = filas.filter(f => norm(f.label) === norm(yo.label))
    .sort((a, b) => (b.n ?? -1) - (a.n ?? -1) || a.id.localeCompare(b.id));
  return {n: hermanos.findIndex(f => f.id === id) + 1, de: hermanos.length};
}

/** Une los adjuntos por clase. rows = filas de GROUPING SETS ((kind),()) con is_total. */
export function resumirAdjuntos(rows, cobertura) {
  const total = rows.find(r => Number(r.is_total) === 1);
  const porClase = {imagen: 0, video: 0, audio: 0, documento: 0, otro: 0};
  for (const r of rows) if (Number(r.is_total) !== 1) porClase[claseAdjunto(r.kind)] += Number(r.n);
  return {
    total: total ? Number(total.n) : 0,
    conversaciones: total ? Number(total.convs) : 0,
    porClase,
    cobertura: cobertura ? {enlazados: Number(cobertura.linked), total: Number(cobertura.total)} : null,
  };
}

export function createProblemFactsRepository({database, now = () => new Date(), budgetMs = FACTS_BUDGET_MS}) {
  return {
    async get({problemId}) {
      if (!uuid(problemId)) throw new WorkspaceError('problem_input_invalid', 400);
      return database.transaction('read', async s => {
        const deadline = () => Date.now() + budgetMs;
        const cat = await guarded(s, deadline(), 'facts_catalog', async () => (await s.query(
          `SELECT DISTINCT ON (problem_id) problem_id AS id, provenance->'snapshot'->>'label' AS label, provenance->'snapshot'->>'state' AS state,
            jsonb_array_length(coalesce(provenance->'snapshot'->'conversationIds','[]'::jsonb)) AS n
           FROM public.problem_versions WHERE tenant_id=$1 AND provenance->>'kind'='vector-problem-v1' ORDER BY problem_id, version DESC`, [s.tenantId])).rows);
        const filas = (cat ?? []).filter(r => r.state === 'active').map(r => ({id: r.id, label: r.label, n: Number(r.n)}));
        const yo = filas.find(f => f.id === problemId);
        if (cat && !yo) throw new WorkspaceError('problem_not_found', 404);
        const miembros = await guarded(s, deadline(), 'facts_members', async () => (await s.query(
          `SELECT provenance->'snapshot'->'embeddingIds' AS eids, provenance->'snapshot'->'conversationIds' AS cids
           FROM public.problem_versions WHERE tenant_id=$1 AND problem_id=$2 AND provenance->>'kind'='vector-problem-v1' ORDER BY version DESC LIMIT 1`, [s.tenantId, problemId])).rows[0] ?? null);
        const eids = Array.isArray(miembros?.eids) ? miembros.eids : null, cids = Array.isArray(miembros?.cids) ? miembros.cids : null;

        const senales = eids ? await guarded(s, deadline(), 'facts_signals', async () => (await s.query(
          `SELECT i.category,i.severity,count(DISTINCT es.id)::int AS spans FROM unnest($2::uuid[]) w(eid)
            JOIN public.problem_embedding_members m ON m.tenant_id=$1 AND m.embedding_id=w.eid
            JOIN public.embeddings e ON e.tenant_id=m.tenant_id AND e.id=m.embedding_id
            JOIN public.issues i ON i.tenant_id=m.tenant_id AND i.extraction_run_id=m.extraction_run_id
            JOIN public.evidence_spans es ON es.tenant_id=i.tenant_id AND es.issue_id=i.id AND es.message_revision_id=e.message_revision_id
            GROUP BY i.category,i.severity`, [s.tenantId, eids])).rows) : null;
        let criticos = null, citas = null, temas = null, severidades = null;
        if (senales) {
          const resumen = resumirSenales(senales.map(r => ({pid: problemId, ...r})));
          const g = resumen.porGrupo.get(problemId);
          criticos = {critical: !!g, signals: g?.signals ?? 0, reason: g?.reason ?? null};
          citas = senales.reduce((a, r) => a + Number(r.spans), 0);
          const por = new Map();
          for (const r of senales) por.set(r.category, (por.get(r.category) ?? 0) + Number(r.spans));
          temas = [...por].map(([category, count]) => ({category, count})).sort((a, b) => b.count - a.count || String(a.category).localeCompare(String(b.category))).slice(0, 5);
          const sev = {};
          for (const r of senales) sev[r.severity ?? 'unknown'] = (sev[r.severity ?? 'unknown'] ?? 0) + Number(r.spans);
          severidades = sev;
        }
        const meta = await guarded(s, deadline(), 'facts_meta', async () => (await s.query('SELECT severity FROM public.problems WHERE tenant_id=$1 AND id=$2', [s.tenantId, problemId])).rows[0] ?? null);
        const recs = await guarded(s, deadline(), 'facts_recs', async () => (await s.query(
          `SELECT * FROM (SELECT DISTINCT ON (r.id) r.id,r.title,r.status,r.version,left(r.action,400) AS action,r.created_at,
             (SELECT i.status FROM public.interventions i WHERE i.tenant_id=r.tenant_id AND i.recommendation_id=r.id ORDER BY i.version DESC, i.created_at DESC LIMIT 1) AS intervention
            FROM public.recommendations r WHERE r.tenant_id=$1 AND r.problem_id=$2 AND r.status<>'dismissed' ORDER BY r.id, r.version DESC) x ORDER BY created_at DESC LIMIT 5`, [s.tenantId, problemId])).rows);
        const adj = cids ? await guarded(s, deadline(), 'facts_attach', async () => {
          const rows = (await s.query(
            `SELECT split_part(coalesce(b.mime_type,'?'),'/',1) AS kind,count(DISTINCT l.id)::int AS n,count(DISTINCT l.conversation_id)::int AS convs,grouping(split_part(coalesce(b.mime_type,'?'),'/',1)) AS is_total
             FROM public.attachment_links l JOIN public.attachment_blobs b ON b.tenant_id=l.tenant_id AND b.id=l.blob_id
             WHERE l.tenant_id=$1 AND l.conversation_id=ANY($2::uuid[]) GROUP BY GROUPING SETS ((1),())`, [s.tenantId, cids])).rows;
          const cob = (await s.query("SELECT count(*) FILTER (WHERE conversation_id IS NOT NULL)::int AS linked,count(*)::int AS total FROM public.attachment_links WHERE tenant_id=$1 AND source_family='conversation'", [s.tenantId])).rows[0];
          return resumirAdjuntos(rows, cob);
        }) : null;

        return {
          problemId, generatedAt: now().toISOString(), class: 'observed',
          label: yo?.label ?? null,
          grupo: cat && yo ? posicionGrupo(filas, problemId) : null,
          conversations: yo ? yo.n : null,
          citations: citas,
          severity: meta ? (meta.severity ?? null) : null,
          severityMix: severidades,
          critical: criticos,
          themes: temas,
          recommendations: recs === null ? {state: 'unavailable', items: []} : {state: 'ok', items: recs.map(r => ({id: r.id, title: r.title, status: r.status, version: Number(r.version), action: r.action, intervention: r.intervention ?? null}))},
          attachments: adj === null ? {state: 'unavailable'} : {state: 'ok', ...adj},
          parts: {catalog: cat ? 'ok' : 'unavailable', signals: senales ? 'ok' : 'unavailable', meta: meta ? 'ok' : 'unavailable'},
          note: 'Conversaciones y citas son registros cargados del grupo; la cita se verifica al abrirla. El dinero por problema no está disponible: no hay vínculos problema–pedido.',
        };
      });
    },
  };
}
