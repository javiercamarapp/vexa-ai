// Generadores de SQL (solo texto; nada se ejecuta aquí) de la etapa «exposición económica por problema».
//   - enlaces: INSERT idempotente en public.economic_problem_links (versión 1, solo si NO existe ninguna versión del par problema-entidad)
//   - medición: el MISMO cálculo de candidatos pero como SELECT agregado (solo lectura; sin identificadores ni datos personales)
//   - verificación/diagnóstico: SELECT de solo lectura que Javier/yo corremos por MCP
// Contexto de escritura = el de packages/economics/emit-sql.mjs: tenant + acción `configure` + actor owner EXPLÍCITO (jamás inferido).
import {TENANT, PROJECT_REF} from '../sql.mjs';
import {sinLiterales, rxDominioTienda} from './reglas.mjs';
// Dominio de la tienda propia (config local) escapado para la regex POSIX del SQL generado.
const rxSqlDominio = () => rxDominioTienda().toLowerCase();
export {TENANT, PROJECT_REF};

const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const lit = v => v === null || v === undefined ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const uu = (v, what) => { if (!UUID.test(v)) throw new Error(what + '_INVALIDO'); return v; };
export const KINDS = Object.freeze({order: ['order'], refund: ['refund']});

// ---- lista cerrada de sentencias (misma idea que nucleo.onlyAllowedStatements)
export const ALLOWED = /^(begin|commit|rollback|do \$(ctx|t)\$|set local statement_timeout|set local lock_timeout|with (par|validos)\b|select 'ECON_)/i;
export const FORBIDDEN = /\b(update|delete|drop|alter|truncate|grant|revoke|create|copy)\b/i;
export const soloPermitidas = stmts => stmts.every(s => ALLOWED.test(s.trim()) && !FORBIDDEN.test(sinLiterales(s)) &&
  // el único INSERT permitido es en economic_problem_links
  (!/\binsert\s+into\b/i.test(sinLiterales(s)) || /insert\s+into\s+public\.economic_problem_links\s*\(/i.test(s)) &&
  !/\binsert\s+into\s+(?!public\.economic_problem_links)/i.test(sinLiterales(s)));

/** Bloque DO: contexto owner explícito + guardas de tenant y de actor. */
export function contextoSql({tenant, owner}) {
  uu(tenant, 'TENANT'); uu(owner, 'OWNER');
  return `do $ctx$
begin
  if ${lit(tenant)}::uuid<>${lit(TENANT)}::uuid then raise exception 'TENANT_NO_AUTORIZADO'; end if;
  perform set_config('vexa.tenant_id',${lit(tenant)},true);
  perform set_config('vexa.action','configure',true);
  perform set_config('request.jwt.claim.sub',${lit(owner)},true);
  if (select count(*) from public.memberships where tenant_id=${lit(tenant)}::uuid and user_id=${lit(owner)}::uuid and role='owner' and status='active')<>1 then raise exception 'OWNER_NO_ACTIVO'; end if;
end $ctx$;`;
}

const fila = p => `(${lit(p.ticket)},${p.gorgias ? lit(p.gorgias) : 'null'},${p.fusionados?.length ? `array[${p.fusionados.map(lit).join(',')}]::text[]` : "'{}'::text[]"},${lit(uu(p.entityId, 'ENTITY'))}::uuid,${lit(p.tier)})`;

/** CTEs comunes: pares -> conversaciones -> problemas -> fila vigente del libro. Termina en el CTE `nuevo` (problema, entidad, fila, clase). */
export function cteNuevo({tenant, kind, pares, validos = null}) {
  uu(tenant, 'TENANT');
  if (!KINDS[kind]) throw new Error('KIND_INVALIDO');
  if (!pares.length) throw new Error('SIN_PARES');
  const T = lit(tenant) + '::uuid';
  const val = validos ? `,\nvalidos as (select unnest(array[${validos.map(v => lit(uu(v, 'PROBLEMA'))).join(',')}]::uuid[]) as problem_id)` : '';
  const filtroValidos = validos ? 'and m.problem_id in (select problem_id from validos)' : '';
  return `with par(ticket,gorgias,fus,entity_id,tier) as (values
${pares.map(fila).join(',\n')}
)${val},
claves as (
  select entity_id,tier,'hubspot:'||ticket as k from par
  union select entity_id,tier,'gorgias:'||gorgias from par where gorgias is not null
  union select p.entity_id,p.tier,'hubspot:'||f from par p cross join lateral unnest(p.fus) f
),
conv as (
  select distinct c.id as conversation_id,k.entity_id,k.tier
  from claves k join public.conversations c on c.tenant_id=${T} and c.external_id=k.k and c.deleted_at is null
  join public.source_heads h on h.tenant_id=c.tenant_id and h.id=c.id and h.entity_type='conversation' and h.state in('unique','selected')
),
prob as (
  select distinct m.problem_id,v.entity_id,v.tier
  from conv v join public.problem_embedding_members m on m.tenant_id=${T} and m.conversation_id=v.conversation_id ${filtroValidos}
  join lateral (select pv.provenance from public.problem_versions pv where pv.tenant_id=${T} and pv.problem_id=m.problem_id and pv.provenance->>'kind'='vector-problem-v1' order by pv.version desc limit 1) lv on true
  where lv.provenance->'snapshot'->>'state'='active'
),
fila as (
  select distinct on(e.entity_id) e.id as row_id,e.entity_id
  from public.economic_ledger_entries e
  where e.tenant_id=${T} and e.kind=any(array[${KINDS[kind].map(lit).join(',')}]) and e.entity_id in (select entity_id from prob)
  order by e.entity_id,e.revision desc
),
nuevo as (
  select p.problem_id,p.entity_id,f.row_id,min(p.tier) as tier
  from prob p join fila f on f.entity_id=p.entity_id
  group by 1,2,3
)`;
}

/** INSERT idempotente (versión 1). reportes = {A,B,C}: texto atestado + regla, por clase de relación. */
export function insertarSql({tenant, owner, kind, pares, validos = null, reportes, etiqueta = 'lote', timeoutMs = 120000}) {
  uu(owner, 'OWNER');
  for (const t of new Set(pares.map(p => p.tier))) if (!reportes[t]) throw new Error('REPORTE_AUSENTE_' + t);
  const T = lit(tenant) + '::uuid';
  const rep = `case n.tier ${Object.keys(reportes).map(t => `when ${lit(t)} then ${lit(reportes[t])}`).join(' ')} end`;
  return [
    contextoSql({tenant, owner}),
    `set local statement_timeout='${timeoutMs}ms';`,
    `${cteNuevo({tenant, kind, pares, validos})},
ins as (
  insert into public.economic_problem_links(tenant_id,problem_id,entity_id,ledger_row_id,version,active,actor_id,report,attested)
  select ${T},n.problem_id,n.entity_id,n.row_id,1,true,${lit(owner)}::uuid,${rep},true
  from nuevo n
  where not exists(select 1 from public.economic_problem_links x where x.tenant_id=${T} and x.problem_id=n.problem_id and x.entity_id=n.entity_id)
  returning problem_id,entity_id)
select 'ECON_LINKS_RESULT ${etiqueta} ${kind} pares=${pares.length} candidatos='||(select count(*) from nuevo)||' insertados='||(select count(*) from ins)||' ya_existian='||((select count(*) from nuevo)-(select count(*) from ins)) as resultado;`,
  ];
}

/** Igual que insertarSql pero en BEGIN..EXCEPTION: ejecuta los INSERT con todas las guardas (triggers incluidos), cuenta y deshace. */
export function pruebaReversaSql(o) {
  const ins = insertarSql(o);
  const T = lit(o.tenant) + '::uuid';
  return [
    'begin;',
    ...ins,
    `do $t$ declare n bigint; begin select count(*) into n from public.economic_problem_links where tenant_id=${T} and xmin::text=(txid_current() % 4294967296)::text; raise exception 'ECON_ROLLBACK_TEST insertados_en_la_transaccion=%',n; end $t$;`,
    'rollback;',
  ];
}

/** SELECT de solo lectura: candidatos (problema, entidad) y sumas de importe CONOCIDO por moneda/base. Sin identificadores. */
export function medirSql({tenant, kind, pares, validos = null, etiqueta = 'medicion'}) {
  const T = lit(tenant) + '::uuid';
  return `-- SOLO LECTURA (${etiqueta}). No escribe. Devuelve conteos y sumas agregadas; ningún identificador de ticket/pedido/cliente.
${cteNuevo({tenant, kind, pares, validos})},
ya as (select n.* from nuevo n where exists(select 1 from public.economic_problem_links x where x.tenant_id=${T} and x.problem_id=n.problem_id and x.entity_id=n.entity_id)),
tot as (
  select e.currency,e.basis,count(distinct n.entity_id) as entidades,sum(e.amount_minor) filter (where e.amount_minor is not null) as suma_unica_minor
  from (select distinct entity_id,row_id from nuevo) n join public.economic_ledger_entries e on e.tenant_id=${T} and e.id=n.row_id
  group by 1,2)
select 'ECON_MEDICION' as etiqueta,
  (select count(*) from par) as pares,
  (select count(distinct ticket) from par) as tickets,
  (select count(distinct conversation_id) from conv) as conversaciones_con_ticket_en_base,
  (select count(distinct entity_id) from conv) as entidades_con_conversacion,
  (select count(distinct problem_id) from prob) as problemas_alcanzados,
  (select count(*) from nuevo) as vinculos_problema_entidad,
  (select count(distinct entity_id) from nuevo) as entidades_ligadas_a_algun_problema,
  (select count(*) from ya) as ya_vinculados,
  (select coalesce(jsonb_object_agg(tier,n),'{}'::jsonb) from (select tier,count(*) n from nuevo group by 1) s) as por_clase,
  (select coalesce(jsonb_agg(jsonb_build_object('moneda',currency,'base',basis,'entidades',entidades,'suma_conocida_minor',suma_unica_minor::text) order by currency,basis),'[]'::jsonb) from tot) as sumas_unicas;`;
}

// ====================================================================================== consultas de diagnóstico (MCP, solo lectura)
const T0 = lit(TENANT) + '::uuid';

export const DIAG = {
  '0-ledger': `-- Estado del libro por fuente/tipo/estado/base/moneda (solo conteos y sumas conocidas).
select s.evidence_type, e.kind, e.status, e.basis, e.currency, count(*) as filas, count(*) filter (where e.amount_minor is null) as sin_importe, sum(e.amount_minor)::text as suma_minor
from (select distinct on(entity_id) * from public.economic_ledger_entries where tenant_id=${T0} order by entity_id, revision desc) e
join (select distinct on(source_id) * from public.economic_source_versions where tenant_id=${T0} order by source_id, version desc) s on s.source_id=e.source_id
group by 1,2,3,4,5 order by 1,2,3,4,5;`,
  '1-problemas': `-- Problemas vectoriales vigentes, membresía y formato de external_id de las conversaciones miembro (solo prefijos).
with pv as (select distinct on(problem_id) problem_id, provenance from public.problem_versions where tenant_id=${T0} and provenance->>'kind'='vector-problem-v1' order by problem_id, version desc),
act as (select problem_id from pv where provenance->'snapshot'->>'state'='active'),
mem as (select m.problem_id, m.conversation_id from public.problem_embedding_members m where m.tenant_id=${T0} and m.problem_id in (select problem_id from act))
select (select count(*) from pv) as problemas_vectoriales, (select count(*) from act) as activos,
  (select count(*) from mem) as miembros, (select count(distinct conversation_id) from mem) as conversaciones,
  (select coalesce(jsonb_object_agg(pref, n),'{}'::jsonb) from (select regexp_replace(c.external_id,'^([a-z]+:).*$','\\1') as pref, count(distinct c.id) n from mem join public.conversations c on c.tenant_id=${T0} and c.id=mem.conversation_id group by 1) x) as prefijos_external_id,
  (select coalesce(jsonb_object_agg(src, n),'{}'::jsonb) from (select c.source as src, count(distinct c.id) n from mem join public.conversations c on c.tenant_id=${T0} and c.id=mem.conversation_id group by 1) x) as por_fuente;`,
  '2-clientes': `-- ¿Cuántas conversaciones de problemas tienen cliente HubSpot por asociación nativa vigente? (alcance de «clientes expuestos»; sin identificadores)
with pv as (select distinct on(problem_id) problem_id, provenance from public.problem_versions where tenant_id=${T0} and provenance->>'kind'='vector-problem-v1' order by problem_id, version desc),
conv as (select distinct m.conversation_id from public.problem_embedding_members m where m.tenant_id=${T0} and m.problem_id in (select problem_id from pv where provenance->'snapshot'->>'state'='active'))
select (select count(*) from conv) as conversaciones_en_problemas,
  (select count(distinct b.conversation_id) from public.conversation_customer_association_bindings b where b.tenant_id=${T0} and b.active and b.conversation_id in (select conversation_id from conv)) as con_cliente,
  (select count(distinct b.customer_id) from public.conversation_customer_association_bindings b where b.tenant_id=${T0} and b.active and b.conversation_id in (select conversation_id from conv)) as clientes_distintos;`,
  '3-vinculos-existentes': `-- Estado actual de economic_problem_links / cobertura / snapshots económicos (solo conteos).
select (select count(*) from public.economic_problem_links where tenant_id=${T0}) as vinculos_filas,
  (select count(*) from (select distinct on(problem_id,entity_id) active from public.economic_problem_links where tenant_id=${T0} order by problem_id,entity_id,version desc) x where active) as vinculos_vigentes,
  (select count(*) from public.economic_order_customers where tenant_id=${T0}) as pedido_cliente,
  (select count(*) from public.economic_relation_coverage where tenant_id=${T0}) as coberturas,
  (select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from public.metric_snapshots where tenant_id=${T0} and economic_schema_version='economic-snapshot-v1' group by 1) s) as snapshots_economicos;`,
  '4-tracker-puente': `-- Alcance del puente ALTERNATIVO Tracker (en base): conversación -> ticket -> fila del Tracker (Hubspot ID, Order ID, Retailer) -> línea del libro por marketplace+order_id exactos.
-- No requiere economia-tickets.csv. Solo agregados.
with hdr as (select h.sheet_name,(c->>'col')::int as col,lower(btrim(c->>'v')) as nom from public.tracker_row_heads h cross join lateral jsonb_array_elements(h.cells) c where h.tenant_id=${T0} and h.row_number=1),
cols as (select sheet_name,
  min(col) filter (where nom in ('order id','order_id','order number')) as c_ord,
  min(col) filter (where nom='retailer') as c_ret
  from hdr group by 1 having min(col) filter (where nom in ('order id','order_id','order number')) is not null),
filas as (
  select h.sheet_name,h.ticket_id,
    (select btrim(c->>'v') from jsonb_array_elements(h.cells) c where (c->>'col')::int=cols.c_ord limit 1) as order_id,
    (select btrim(c->>'v') from jsonb_array_elements(h.cells) c where (c->>'col')::int=cols.c_ret limit 1) as retailer
  from public.tracker_row_heads h join cols using(sheet_name)
  where h.tenant_id=${T0} and h.ticket_state in('linked','candidate') and h.ticket_id is not null),
mk as (select ticket_id,order_id,case when retailer ~* '^amazon\\s*::' then 'amazon' when retailer ~* '^walmart\\s*::' then 'walmart' when retailer ~* '^best buy\\s*::\\s*usa$' then 'mirakl_bestbuy_us' when retailer ~* '^best buy\\s*::\\s*can$' then 'mirakl_bestbuy_ca' when retailer ~* '^${rxSqlDominio()}.*shopify' then 'shopify' end as mk from filas where coalesce(order_id,'')<>''),
led as (select distinct on(e.entity_id) e.entity_id, split_part(e.external_id,'|',1) as mk, split_part(e.external_id,'|',2) as order_id, e.status, e.basis from public.economic_ledger_entries e where e.tenant_id=${T0} and e.kind='order' and e.external_id like '%|%|%' order by e.entity_id, e.revision desc)
select (select count(*) from filas) as filas_con_ticket, (select count(*) from mk where mk is not null) as filas_con_pedido_y_marketplace,
  (select count(distinct m.ticket_id||'|'||l.entity_id) from mk m join led l on l.mk=m.mk and l.order_id=m.order_id) as pares_ticket_linea_en_libro,
  (select count(distinct l.entity_id) from mk m join led l on l.mk=m.mk and l.order_id=m.order_id and l.status='recorded') as lineas_recorded_alcanzadas,
  (select count(distinct c.id) from mk m join led l on l.mk=m.mk and l.order_id=m.order_id join public.conversations c on c.tenant_id=${T0} and c.external_id='hubspot:'||m.ticket_id) as conversaciones_alcanzadas;`,
};

/** Comprobaciones posteriores a la carga (solo lectura): incoherencias esperadas = 0. */
export function verificacionSql({tenant = TENANT} = {}) {
  const T = lit(tenant) + '::uuid';
  return `-- SOLO LECTURA. Verificación de economic_problem_links tras la carga. Las columnas «malos_*» deben ser 0.
with cur as (select distinct on(problem_id,entity_id) * from public.economic_problem_links where tenant_id=${T} order by problem_id,entity_id,version desc),
led as (select distinct on(entity_id) * from public.economic_ledger_entries where tenant_id=${T} order by entity_id, revision desc)
select (select count(*) from cur) as vinculos_pares,
  (select count(*) from cur where active) as vigentes,
  (select count(*) from cur c where not exists(select 1 from led l where l.entity_id=c.entity_id and l.id=c.ledger_row_id)) as malos_fila_no_vigente,
  (select count(*) from cur c join led l on l.entity_id=c.entity_id where l.kind not in('order','refund','reversal','replacement','support_model')) as malos_tipo,
  (select count(*) from cur c where not exists(select 1 from public.problem_versions p where p.tenant_id=${T} and p.problem_id=c.problem_id and p.provenance->>'kind'='vector-problem-v1')) as malos_problema,
  (select count(*) from (select problem_id,entity_id from public.economic_problem_links where tenant_id=${T} group by 1,2 having count(*)<>max(version)) x) as malos_versiones,
  (select coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) from (select l.kind,count(*) n from cur c join led l on l.entity_id=c.entity_id where c.active group by 1) s) as por_tipo,
  (select count(distinct problem_id) from cur where active) as problemas_con_vinculo,
  (select count(distinct entity_id) from cur where active) as entidades_vinculadas;`;
}
