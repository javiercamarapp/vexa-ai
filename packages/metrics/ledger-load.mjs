// Lecturas por lote del libro económico y sus versiones. Mismas filas y misma decisión de «contribuyente activo» que las consultas por fila
// anteriores: economic_contributor_active(tenant, actor) depende solo del tenant, del actor y de la sesión, así que se evalúa UNA vez por
// actor distinto (unos pocos) y se une, en vez de una vez por fila (85 mil llamadas = ~12 s). Nada cruza transacciones: el memo vive en el
// objeto de sesión `s` (la transacción) y solo se activa dentro de una sección explícita (`memoSection`) que sostiene los candados del libro.
const memos = new WeakMap();
export function memoSection(s, work) {
  if (memos.has(s)) return work();
  memos.set(s, new Map());
  const done = () => memos.delete(s);
  return Promise.resolve().then(work).finally(done);
}
/** Devuelve el valor memoizado dentro de una memoSection; fuera de ella ejecuta `load` sin memo. */
export function memoized(s, key, load) {
  const m = memos.get(s);
  if (!m) return load();
  if (!m.has(key)) m.set(key, Promise.resolve().then(load));
  return m.get(key);
}
export const inMemoSection = s => memos.has(s);
export const hasMemo = (s, key) => memos.get(s)?.has(key) === true;
/** Comparte el memo de la sección de `from` con `to` (otro objeto de sesión sobre la MISMA transacción, p. ej. uno con tope de tiempo). Devuelve quien lo suelta. */
export function shareMemo(from, to) { const m = memos.get(from); if (m) memos.set(to, m); return () => { if (m && memos.get(to) === m) memos.delete(to); }; }
/** Ejecuta `work` sin usar ni poblar el memo de la sección (verificaciones que deben releer la base). */
export async function withoutMemo(s, work) {
  const saved = memos.get(s); memos.delete(s);
  try { return await work(); } finally { if (saved) memos.set(s, saved); }
}

const ident = /^[a-z_]+(,[a-z_]+)*$/;
/** Última versión por clave, con `actor_active` calculado una vez por actor distinto. `key` puede ser compuesta («problem_id,entity_id»). */
export async function latestRows(s, table, key, {version = 'version'} = {}) {
  if (!ident.test(table) || !ident.test(key) || !ident.test(version)) throw new Error('latest_rows_identifier_invalid');
  return memoized(s, 'latest:' + table + ':' + key, async () => (await s.query(
    `SELECT l.*,act.active AS actor_active FROM (SELECT DISTINCT ON(${key}) * FROM public.${table} WHERE tenant_id=$1 ORDER BY ${key},${version} DESC) l
     JOIN (SELECT d.actor_id,public.economic_contributor_active($1::uuid,d.actor_id) AS active FROM (SELECT DISTINCT actor_id FROM public.${table} WHERE tenant_id=$1) d) act ON act.actor_id=l.actor_id
     ORDER BY ${key.split(',').map(k => 'l.' + k).join(',')}`, [s.tenantId])).rows);
}

const ENTRY_COLUMNS = 'e.id,e.entity_id,e.source_id,e.revision,e.actor_id,e.recorded_at,e.external_id,e.kind,e.effective_at,e.currency,e.exponent,e.basis,e.amount_minor,e.status,e.order_id,e.reversal_of,e.details';
/**
 * Última revisión de cada asiento. `activeOnly`: entre las revisiones cuyo contribuyente sigue activo (lo que hace el modo snapshot al filtrar la historia
 * y quedarse con la última). `full`: todas las columnas (report incluido) para el panel vivo; sin ella solo lo que usan las cifras.
 * Cada fila lleva `actor_active`.
 */
export async function latestEntries(s, {activeOnly = false, full = false} = {}) {
  // Si todos los contribuyentes del libro siguen activos, «última revisión entre las activas» ES la última revisión: se reutiliza la misma lectura.
  if (activeOnly && !full && (await ledgerActorStates(s)).every(a => a.active)) return latestEntries(s, {full});
  return memoized(s, 'entries:' + activeOnly + ':' + full, async () => (await s.query(
    `SELECT ${full ? 'e.*' : ENTRY_COLUMNS},act.active AS actor_active FROM (SELECT DISTINCT ON(entity_id) x.* FROM public.economic_ledger_entries x
      ${activeOnly ? 'JOIN (SELECT d.actor_id FROM (SELECT DISTINCT actor_id FROM public.economic_ledger_entries WHERE tenant_id=$1) d WHERE public.economic_contributor_active($1::uuid,d.actor_id)) ok ON ok.actor_id=x.actor_id' : ''}
      WHERE x.tenant_id=$1 ORDER BY x.entity_id,x.revision DESC) e
     JOIN (SELECT d.actor_id,public.economic_contributor_active($1::uuid,d.actor_id) AS active FROM (SELECT DISTINCT actor_id FROM public.economic_ledger_entries WHERE tenant_id=$1) d) act ON act.actor_id=e.actor_id
     ORDER BY e.entity_id`, [s.tenantId])).rows);
}
/** Historia completa (todas las revisiones) con `actor_active`, para el panel vivo. */
export async function ledgerHistory(s) {
  return memoized(s, 'history', async () => (await s.query(
    `SELECT e.*,act.active AS actor_active FROM public.economic_ledger_entries e
     JOIN (SELECT d.actor_id,public.economic_contributor_active($1::uuid,d.actor_id) AS active FROM (SELECT DISTINCT actor_id FROM public.economic_ledger_entries WHERE tenant_id=$1) d) act ON act.actor_id=e.actor_id
     WHERE e.tenant_id=$1 ORDER BY e.entity_id,e.revision`, [s.tenantId])).rows);
}

/** Contribuyentes distintos del libro y si siguen activos (una sola evaluación de economic_contributor_active por actor). */
export async function ledgerActorStates(s) {
  return memoized(s, 'ledger-actors', async () => (await s.query(
    'SELECT d.actor_id,public.economic_contributor_active($1::uuid,d.actor_id) AS active FROM (SELECT DISTINCT actor_id FROM public.economic_ledger_entries WHERE tenant_id=$1) d', [s.tenantId])).rows);
}

/** ¿Existe el resumen inmutable de referencias que crea la migración 0055? (el código sigue funcionando sin ella, por el camino lento). */
export async function hasRefSummary(s) {
  // El parámetro de tenant no filtra nada (es un catálogo); existe para que TODA lectura del repositorio quede ligada al tenant autorizado.
  return memoized(s, 'has-ref-summary', async () => +(await s.query("SELECT count(*)::int AS n FROM pg_attribute WHERE attrelid='public.metric_snapshots'::regclass AND attname='refs_small' AND NOT attisdropped AND $1::uuid IS NOT NULL", [s.tenantId])).rows[0].n > 0);
}
