// SQL del manifiesto de un snapshot económico. Las referencias (una por cada versión vigente de cada tabla de insumos) se construyen y se verifican EN LA BASE:
// el servidor de aplicación solo ve, por tabla, la cantidad, un digest sha256 de la lista ordenada de referencias y la última marca de tiempo.
//  - El manifiesto almacenado conserva exactamente la forma que consumen 0021/0023/0025-0027 y las vistas: refs[{table,id,actorId,authorized,active,sourceId,version,rowHash}].
//  - La identidad de entrada del snapshot (input_hash, id) usa esos digests: cualquiera puede recalcularlos desde el manifiesto almacenado (verifyStoredSql) y
//    comprobar que coinciden; economic_snapshot_digest sigue cubriendo el manifiesto completo.
//  - `authorized` = economic_contributor_active del actor de la fila, evaluado una vez por actor distinto (la función solo depende de tenant, actor y sesión).
//  - rowHash = sha256 del texto jsonb de la fila completa más su estado de autorización: cualquier cambio en la fila o en la autorización cambia el digest.
export const TABLES = Object.freeze([
  {table: 'economic_source_versions', key: 'source_id', version: 'version', active: 'l.active', source: 'l.source_id', times: ['created_at', 'watermark']},
  {table: 'economic_ledger_entries', key: 'entity_id', version: 'revision', active: 'true', source: 'l.source_id', times: ['recorded_at']},
  {table: 'economic_problem_links', key: 'problem_id,entity_id', version: 'version', active: 'l.active', source: 'NULL::uuid', times: ['created_at']},
  {table: 'economic_order_aliases', key: 'alias_entity_id', version: 'version', active: 'l.active', source: 'NULL::uuid', times: ['created_at']},
  {table: 'economic_order_customers', key: 'entity_id', version: 'version', active: 'true', source: 'NULL::uuid', times: ['created_at']},
  {table: 'economic_relation_coverage', key: 'scope_key', version: 'version', active: 'true', source: 'NULL::uuid', times: ['created_at']},
  {table: 'economic_currency_versions', key: 'currency', version: 'version', active: 'l.active', source: 'NULL::uuid', times: ['created_at']},
  {table: 'economic_fx_versions', key: 'rate_id', version: 'version', active: 'l.active', source: 'NULL::uuid', times: ['created_at']},
]);
export const TABLE_NAMES = TABLES.map(t => t.table);

const actorCte = `act AS MATERIALIZED (SELECT d.actor_id,public.economic_contributor_active($1::uuid,d.actor_id) AS active FROM (${TABLES.map(t => `SELECT actor_id FROM public.${t.table} WHERE tenant_id=$1`).join(' UNION ')}) d)`;
const refCte = (t, i) => `r${i} AS MATERIALIZED (SELECT ${i} AS t,row_number() OVER (ORDER BY ${t.key.split(',').map(k => 'l.' + k).join(',')}) AS k,
  jsonb_build_object('table','${t.table}','id',l.id,'actorId',l.actor_id,'authorized',act.active,'active',${t.active},'sourceId',${t.source},'version',l.${t.version},
   'rowHash',encode(sha256(convert_to((to_jsonb(l)||jsonb_build_object('actor_active',act.active))::text,'UTF8')),'hex')) AS ref,
  ${t.times.length > 1 ? 'greatest(' + t.times.map(c => 'l.' + c).join(',') + ')' : 'l.' + t.times[0]} AS ts
  FROM (SELECT DISTINCT ON(${t.key}) * FROM public.${t.table} WHERE tenant_id=$1 ORDER BY ${t.key},${t.version} DESC) l JOIN act ON act.actor_id=l.actor_id)`;
const ctes = `WITH ${actorCte},${TABLES.map(refCte).join(',')}`;

/** Una fila por tabla: n, digest (sha256 de las referencias en orden), ts (última marca de tiempo). Parámetros: $1 tenant. */
export const digestsSql = `${ctes}
 ${TABLES.map((t, i) => `SELECT ${i} AS t,count(*)::int AS n,encode(sha256(convert_to(coalesce(string_agg(ref::text,',' ORDER BY k),''),'UTF8')),'hex') AS digest,max(ts) AS ts FROM r${i}`).join(' UNION ALL ')}`;

/** Fragmento reutilizable: todas las referencias en orden (tabla, clave). */
export const refsSelect = `${ctes},refs AS (${TABLES.map((t, i) => `SELECT t,k,ref FROM r${i}`).join(' UNION ALL ')})
 SELECT coalesce(jsonb_agg(ref ORDER BY t,k),'[]'::jsonb) FROM refs`;

/** Digest por tabla recalculado desde un manifiesto ya almacenado. Parámetros: $1 tenant, $2 snapshot. */
export const verifyStoredSql = `SELECT r->>'table' AS table_name,count(*)::int AS n,encode(sha256(convert_to(string_agg(r::text,',' ORDER BY ord),'UTF8')),'hex') AS digest
 FROM public.metric_snapshots s,jsonb_array_elements(s.input_manifest->'refs') WITH ORDINALITY e(r,ord) WHERE s.tenant_id=$1 AND s.id=$2 GROUP BY 1`;

export const EMPTY_DIGEST = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * Verificación de las referencias capturadas contra el estado ACTUAL, por lote: cada fila referenciada debe existir (evidencia conservada), su contribuyente
 * seguir activo y, para fuentes/monedas/tasas vigentes al capturar, la última versión seguir disponible. Devuelve la PRIMERA referencia (en orden de manifiesto)
 * que falla con su código, o ninguna fila. Tablas desconocidas en el manifiesto tienen prioridad (manifest_invalid). Parámetros: $1 tenant, $2 snapshot.
 */
export const authorizeSql = `WITH m AS MATERIALIZED (SELECT input_manifest->'refs' AS refs FROM public.metric_snapshots WHERE tenant_id=$1 AND id=$2),
 r AS MATERIALIZED (SELECT e.ord,e.ref->>'table' AS t,(e.ref->>'id')::uuid AS id,coalesce((e.ref->>'authorized')::boolean,false) AS authorized,coalesce((e.ref->>'active')::boolean,false) AS active FROM m,jsonb_array_elements(m.refs) WITH ORDINALITY e(ref,ord)),
 ${actorCte},
 chk AS (
  (SELECT 0::bigint AS ord,'snapshot_manifest_invalid' AS code FROM r WHERE t IS NULL OR t<>ALL($3::text[]) LIMIT 1)
  ${TABLES.map(t => {
    const latest = t.table === 'economic_source_versions' ? 'source_id' : t.table === 'economic_currency_versions' ? 'currency' : t.table === 'economic_fx_versions' ? 'rate_id' : null;
    const kind = t.table === 'economic_source_versions' ? 'snapshot_source_unavailable' : 'snapshot_configuration_unavailable';
    return `UNION ALL SELECT r.ord,CASE WHEN c.id IS NULL THEN 'snapshot_evidence_unavailable' WHEN r.authorized AND NOT coalesce(act.active,false) THEN 'snapshot_contributor_unavailable'
      ${latest ? `WHEN r.active AND r.authorized AND NOT EXISTS(SELECT 1 FROM (SELECT v.active,public.economic_contributor_active(v.tenant_id,v.actor_id) AS actor_active FROM public.${t.table} v WHERE v.tenant_id=$1 AND v.${latest}=c.${latest} ORDER BY v.version DESC LIMIT 1) cur WHERE cur.active AND cur.actor_active) THEN '${kind}'` : ''} END AS code
      FROM r LEFT JOIN public.${t.table} c ON c.tenant_id=$1 AND c.id=r.id LEFT JOIN act ON act.actor_id=c.actor_id WHERE r.t='${t.table}'`;
  }).join('\n  ')}
 )
 SELECT code FROM chk WHERE code IS NOT NULL ORDER BY ord LIMIT 1`;

/**
 * Camino rápido de la misma verificación: una sola expansión del manifiesto y comparaciones agregadas (existencia por semi-join, contribuyentes distintos,
 * última versión de fuentes/configuración). Devuelve `bad = 0` solo si NINGUNA referencia falla por ningún criterio; en cualquier otro caso el llamador ejecuta
 * authorizeSql para decidir el código exacto. Parámetros: $1 tenant, $2 snapshot, $3 nombres de tabla.
 */
export const authorizeFastSql = `WITH r AS MATERIALIZED (SELECT e.ref->>'table' AS t,(e.ref->>'id')::uuid AS id,(e.ref->>'actorId')::uuid AS actor_id,coalesce((e.ref->>'authorized')::boolean,false) AS authorized,coalesce((e.ref->>'active')::boolean,false) AS active
   FROM public.metric_snapshots m,jsonb_array_elements(m.input_manifest->'refs') e(ref) WHERE m.tenant_id=$1 AND m.id=$2),
  n AS (SELECT count(*) AS total${TABLES.map((t, i) => `,count(*) FILTER (WHERE t='${t.table}') AS n${i}`).join('')},count(*) FILTER (WHERE authorized AND actor_id IS NULL) AS null_actors FROM r)
 SELECT abs(n.total - (${TABLES.map((t, i) => 'n.n' + i).join('+')})) + n.null_actors
  ${TABLES.map((t, i) => `+ (n.n${i} - (SELECT count(*) FROM public.${t.table} c WHERE c.tenant_id=$1 AND c.id IN (SELECT id FROM r WHERE t='${t.table}')))`).join('\n  ')}
  + (SELECT count(*) FROM (SELECT DISTINCT actor_id FROM r WHERE authorized AND actor_id IS NOT NULL) a WHERE NOT coalesce(public.economic_contributor_active($1::uuid,a.actor_id),false))
  ${[['economic_source_versions', 'source_id'], ['economic_currency_versions', 'currency'], ['economic_fx_versions', 'rate_id']].map(([table, key]) => `+ (SELECT count(*) FROM r JOIN public.${table} c ON c.tenant_id=$1 AND c.id=r.id WHERE r.t='${table}' AND r.active AND r.authorized AND NOT EXISTS(SELECT 1 FROM (SELECT v.active,public.economic_contributor_active(v.tenant_id,v.actor_id) AS actor_active FROM public.${table} v WHERE v.tenant_id=$1 AND v.${key}=c.${key} ORDER BY v.version DESC LIMIT 1) cur WHERE cur.active AND cur.actor_active))`).join('\n  ')}
  AS bad FROM n`;

/**
 * Misma verificación, sobre el RESUMEN inmutable que 0055 calcula al insertar el snapshot (refs_small = referencias que no son del libro; refs_ledger_ids = ids del libro;
 * refs_actor_ids = contribuyentes distintos): no se expande el manifiesto de decenas de miles de referencias. Devuelve bad = NULL si el snapshot no tiene resumen
 * (anterior a 0055); bad = 0 solo si ninguna referencia falla; en otro caso el llamador ejecuta authorizeSql para el código exacto. Parámetros: $1 tenant, $2 snapshot.
 */
const SMALL = TABLES.filter(t => t.table !== 'economic_ledger_entries');
export const authorizeSummarySql = `WITH s AS MATERIALIZED (SELECT refs_ledger_ids AS ids,refs_small AS small,refs_actor_ids AS actors FROM public.metric_snapshots WHERE tenant_id=$1 AND id=$2 AND refs_small IS NOT NULL),
  r AS MATERIALIZED (SELECT e.ref->>'table' AS t,(e.ref->>'id')::uuid AS id,coalesce((e.ref->>'authorized')::boolean,false) AS authorized,coalesce((e.ref->>'active')::boolean,false) AS active FROM s,jsonb_array_elements(s.small) e(ref)),
  n AS (SELECT count(*) AS total${SMALL.map((t, i) => `,count(*) FILTER (WHERE t='${t.table}') AS n${i}`).join('')} FROM r)
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM s) THEN NULL ELSE
  abs(n.total - (${SMALL.map((t, i) => 'n.n' + i).join('+')}))
  ${SMALL.map((t, i) => `+ (n.n${i} - (SELECT count(*) FROM public.${t.table} c WHERE c.tenant_id=$1 AND c.id IN (SELECT id FROM r WHERE t='${t.table}')))`).join(' ')}
  + (SELECT cardinality(s.ids) - count(*) FROM public.economic_ledger_entries c WHERE c.tenant_id=$1 AND c.id IN (SELECT unnest(s.ids)))
  + (SELECT count(*) FROM (SELECT unnest(s.actors) AS actor_id) a WHERE a.actor_id IS NULL OR NOT coalesce(public.economic_contributor_active($1::uuid,a.actor_id),false))
  ${[['economic_source_versions', 'source_id'], ['economic_currency_versions', 'currency'], ['economic_fx_versions', 'rate_id']].map(([table, key]) => `+ (SELECT count(*) FROM r JOIN public.${table} c ON c.tenant_id=$1 AND c.id=r.id WHERE r.t='${table}' AND r.active AND r.authorized AND NOT EXISTS(SELECT 1 FROM (SELECT v.active,public.economic_contributor_active(v.tenant_id,v.actor_id) AS actor_active FROM public.${table} v WHERE v.tenant_id=$1 AND v.${key}=c.${key} ORDER BY v.version DESC LIMIT 1) cur WHERE cur.active AND cur.actor_active))`).join(' ')}
  END AS bad FROM n, s`;
