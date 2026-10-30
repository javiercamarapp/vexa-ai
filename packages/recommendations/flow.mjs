// Repositorio del FLUJO de aprobación (Proceder / Ajustar / En curso / Resultado). Compone el repositorio de recomendaciones y el de intervenciones ya existentes:
// no ejecuta nada externo, no envía correos y no toca dinero. Cada escritura exige versión esperada y requestKey (idempotente), y SQL (20261111000000) vuelve a validar rol, orden y lo aprobado.
// Si la migración aún no está aplicada, la lectura sigue funcionando (flow.available=false) y las operaciones nuevas responden configuration_required: nunca se simula una aprobación.
import {WorkspaceError, check, uuid} from '../workspace-service/contracts.mjs';
import {validarAprobacion, validarAjuste, validarResultado, puedeDecidir, comparacionAntesDespues, etapaActual, prioridadVigente} from './flujo.mjs';

const iso = x => (x === null || x === undefined ? null : new Date(x).toISOString());
const one = async (s, q, a = []) => (await s.query(q, a)).rows[0];
const eventView = r => ({id: r.id, kind: r.kind, recommendationVersion: r.recommendation_version, actorId: r.actor_id, ownerId: r.owner_id, dueDate: r.due_date ? (r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : String(r.due_date).slice(0, 10)) : null, priority: r.priority, outcome: r.outcome, note: r.note, comment: r.comment, interventionId: r.intervention_id, comparison: r.comparison ?? null, createdAt: iso(r.created_at)});
const strict = (q, keys) => check(q && typeof q === 'object' && !Array.isArray(q) && Object.keys(q).every(k => keys.includes(k)), 'input_invalid');
const rk = k => check(typeof k === 'string' && k.length >= 1 && k.length <= 128 && k.trim() === k, 'request_key_invalid');
const problemas = lista => { if (lista.length) throw new WorkspaceError(lista[0].campo + '_invalid', 400); };

export function createFlowRepository({database, recommendations, interventions = null, ahora = () => new Date()}) {
  const tx = (action, fn) => database.transaction(action, fn);
  async function disponible(s) { return (await one(s, "SELECT to_regclass('public.recommendation_flow_events') IS NOT NULL AS ok")).ok === true; }
  async function eventos(ids) {
    return tx('read', async s => {
      const role = s.role;
      if (!(await disponible(s)) || !ids.length) return {available: await disponible(s), byId: new Map(), role};
      const rows = (await s.query('SELECT * FROM public.recommendation_flow_events WHERE tenant_id=$1 AND recommendation_id = ANY($2::uuid[]) ORDER BY created_at,id', [s.tenantId, ids])).rows;
      const byId = new Map();
      for (const r of rows) { const l = byId.get(r.recommendation_id) ?? []; l.push(eventView(r)); byId.set(r.recommendation_id, l); }
      return {available: true, byId, role};
    });
  }
  const pack = (item, evs, available, role) => ({...item, priorityBase: item.priority, priority: prioridadVigente(item, evs), flow: {available, role, events: evs, etapa: etapaActual(item, evs), interventionId: evs.find(e => e.kind === 'approved')?.interventionId ?? null}});
  async function requireDecider(action = 'read') {
    const role = await tx(action, async s => s.role);
    check(puedeDecidir(role), 'role_forbidden', 403);
    return role;
  }
  async function requireFlow() { const ok = await tx('read', disponible); if (!ok) throw new WorkspaceError('configuration_required', 503); }
  async function insertEvent(s, e, requestKey) {
    const key = 'flow:' + e.kind + ':' + requestKey;
    await s.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [s.tenantId + ':flow:' + key]);
    const replay = await one(s, 'SELECT * FROM public.recommendation_flow_events WHERE tenant_id=$1 AND idempotency_key=$2', [s.tenantId, key]);
    if (replay) { check(replay.recommendation_id === e.recommendationId && replay.kind === e.kind, 'idempotency_conflict', 409); return eventView(replay); }
    return eventView(await one(s, 'INSERT INTO public.recommendation_flow_events(tenant_id,recommendation_id,recommendation_version,kind,actor_id,owner_id,due_date,priority,outcome,note,comment,intervention_id,comparison,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
      [s.tenantId, e.recommendationId, e.version, e.kind, s.userId, e.ownerId ?? null, e.dueDate ?? null, e.priority ?? null, e.outcome ?? null, e.note ?? null, e.comment ?? null, e.interventionId ?? null, e.comparison ? JSON.stringify(e.comparison) : null, key]));
  }
  const insert = (e, requestKey) => tx('propose', s => insertEvent(s, e, requestKey));
  /** Reintento con la MISMA clave tras un corte de red: si el evento ya existe se devuelve el estado actual (idempotente); la clave de OTRA recomendación es conflicto. */
  async function replayed(kind, id, requestKey) {
    const r = await tx('read', async s => one(s, 'SELECT recommendation_id FROM public.recommendation_flow_events WHERE tenant_id=$1 AND idempotency_key=$2', [s.tenantId, 'flow:' + kind + ':' + requestKey]));
    if (!r) return false;
    check(r.recommendation_id === id, 'idempotency_conflict', 409);
    return true;
  }
  const guard = async (id, eventsList, {needs, forbids} = {}) => {
    const kinds = new Set(eventsList.map(e => e.kind));
    for (const k of needs ?? []) check(kinds.has(k), 'flow_order_invalid', 409);
    for (const k of forbids ?? []) check(!kinds.has(k), 'flow_order_invalid', 409);
  };
  const api = {
    async list({query}) {
      const data = await recommendations.list({query}); const {available, byId, role} = await eventos(data.items.map(i => i.id));
      return {...data, flowAvailable: available, items: data.items.map(i => pack(i, byId.get(i.id) ?? [], available, role))};
    },
    async get({id}) {
      const item = await recommendations.get({id}); const {available, byId, role} = await eventos([id]);
      return pack(item, byId.get(id) ?? [], available, role);
    },
    /** PROCEDER: responsable + fecha; asigna el responsable si hace falta, crea la intervención en borrador y registra la aprobación. No envía nada. */
    async approve(q) {
      strict(q, ['id', 'expectedVersion', 'ownerId', 'dueDate', 'comment', 'requestKey']); rk(q.requestKey); check(uuid(q.id), 'recommendation_not_found', 404);
      problemas(validarAprobacion({ownerId: q.ownerId, dueDate: q.dueDate, comment: q.comment}, ahora()));
      await requireDecider(); await requireFlow();
      const before = await api.get({id: q.id});
      const done = before.flow.events.find(e => e.kind === 'approved');
      if (done) { const replay = await tx('read', async s => one(s, 'SELECT 1 AS ok FROM public.recommendation_flow_events WHERE tenant_id=$1 AND idempotency_key=$2', [s.tenantId, 'flow:approved:' + q.requestKey])); check(replay, 'already_approved', 409); return before; }
      check(!before.stale && before.status === 'proposed', 'recommendation_not_open', 409);
      check(before.version === q.expectedVersion || before.flow.events.length === 0 && before.version === q.expectedVersion, 'version_conflict', 409);
      let version = before.version;
      if (before.ownerId !== q.ownerId) {
        const extra = q.comment ? ' ' + q.comment.replace(/\s+/g, ' ').slice(0, 1500) : '';
        version = (await recommendations.revise({id: q.id, expectedVersion: version, action: before.action, preconditions: before.preconditions, rationale: before.rationale, ownerId: q.ownerId, reason: ('Responsable asignado al aprobar la recomendación.' + extra).slice(0, 2000)})).version;
      }
      const draft = await recommendations.createDraft({id: q.id, expectedVersion: version, requestKey: q.requestKey});
      await insert({recommendationId: q.id, version, kind: 'approved', ownerId: q.ownerId, dueDate: q.dueDate, comment: q.comment || null, interventionId: draft.id}, q.requestKey);
      return api.get({id: q.id});
    },
    /** AJUSTAR: cambia acción, razón, supuestos, responsable y prioridad con comentario obligatorio; guarda una versión nueva (historial inmutable). */
    async adjust(q) {
      strict(q, ['id', 'expectedVersion', 'action', 'rationale', 'preconditions', 'ownerId', 'priority', 'comment', 'requestKey']); rk(q.requestKey); check(uuid(q.id), 'recommendation_not_found', 404);
      problemas(validarAjuste(q));
      await requireDecider(); await requireFlow();
      if (await replayed('adjusted', q.id, q.requestKey)) return api.get({id: q.id});
      const before = await api.get({id: q.id});
      await guard(q.id, before.flow.events, {forbids: ['approved']});
      const rev = await recommendations.revise({id: q.id, expectedVersion: q.expectedVersion, action: q.action, preconditions: q.preconditions, rationale: q.rationale, ownerId: q.ownerId ?? null, reason: q.comment});
      await insert({recommendationId: q.id, version: rev.version, kind: 'adjusted', ownerId: q.ownerId ?? null, priority: q.priority ?? null, comment: q.comment}, q.requestKey);
      return api.get({id: q.id});
    },
    /** EN CURSO: la persona responsable marca que el trabajo empezó. */
    async start(q) {
      strict(q, ['id', 'expectedVersion', 'comment', 'requestKey']); rk(q.requestKey); check(uuid(q.id), 'recommendation_not_found', 404);
      await requireDecider(); await requireFlow();
      if (await replayed('started', q.id, q.requestKey)) return api.get({id: q.id});
      const before = await api.get({id: q.id});
      check(before.version === q.expectedVersion, 'version_conflict', 409);
      await guard(q.id, before.flow.events, {needs: ['approved'], forbids: ['started', 'resolved']});
      await insert({recommendationId: q.id, version: before.version, kind: 'started', comment: q.comment || null}, q.requestKey);
      return api.get({id: q.id});
    },
    /** RESULTADO manual. La comparación antes/después se toma SOLO de la medición de la intervención si existe dato observado; si no, queda vacía (no se inventa). */
    async resolve(q) {
      strict(q, ['id', 'expectedVersion', 'outcome', 'note', 'requestKey']); rk(q.requestKey); check(uuid(q.id), 'recommendation_not_found', 404);
      problemas(validarResultado(q));
      await requireDecider(); await requireFlow();
      if (await replayed('resolved', q.id, q.requestKey)) return api.get({id: q.id});
      const before = await api.get({id: q.id});
      check(before.version === q.expectedVersion, 'version_conflict', 409);
      await guard(q.id, before.flow.events, {needs: ['approved'], forbids: ['resolved']});
      let comparison = null;
      const interventionId = before.flow.interventionId;
      if (interventions && interventionId) {
        try { const iv = await interventions.get({id: interventionId}); comparison = comparacionAntesDespues([...(iv.measurements ?? [])].reverse().find(m => comparacionAntesDespues(m))); } catch { comparison = null; }
      }
      await insert({recommendationId: q.id, version: before.version, kind: 'resolved', outcome: q.outcome, note: q.note, interventionId, comparison}, q.requestKey);
      return api.get({id: q.id});
    },
  };
  return api;
}
