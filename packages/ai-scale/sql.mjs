// Generador de SQL de SOLO LECTURA para la cohorte. Ventana parametrizable por fecha del PRIMER o del ÚLTIMO mensaje.
// Se corre por MCP (execute_sql) o con `supabase db query --linked -f`. Ninguna sentencia escribe.
import {tenantPiloto} from '../../config/cliente-piloto.mjs';
// UUID de la organización piloto: VEXA_TENANT_ID o config local (ver config/cliente-piloto.mjs). Sin valor real por defecto.
export const TENANT=tenantPiloto();
export const PROJECT_REF='proyecto-ejemplo';
const iso=/^\d{4}-\d{2}-\d{2}$/;
function check({from,to,basis,tenant=TENANT}){
  if(!iso.test(from)||!iso.test(to)||from>=to)throw Error('ventana inválida: use --from YYYY-MM-DD --to YYYY-MM-DD (to exclusivo)');
  if(!['first','last'].includes(basis))throw Error('--basis debe ser first o last');
  if(!/^[a-f0-9-]{36}$/.test(tenant))throw Error('tenant inválido: defina VEXA_TENANT_ID');
}
// CTE común: conversaciones vigentes (mismas condiciones que queue.conversationsPage) con primer/último mensaje.
const cohortFrom=({from,to,basis,tenant=TENANT})=>`with p as (select '${tenant}'::uuid as tenant, '${from}'::timestamptz as lo, '${to}'::timestamptz as hi),
mm as (
  select m.conversation_id, min(m.occurred_at) as first_at, max(m.occurred_at) as last_at, count(*) as n_msgs
  from public.messages m join p on m.tenant_id=p.tenant where m.deleted_at is null group by m.conversation_id),
cohort as (
  select c.id, c.source, mm.first_at, mm.last_at, mm.n_msgs
  from p
  join public.conversations c on c.tenant_id=p.tenant
  join public.connections n on n.tenant_id=c.tenant_id and n.id=c.connection_id
  join public.source_heads h on h.tenant_id=c.tenant_id and h.id=c.id
  join mm on mm.conversation_id=c.id
  where c.deleted_at is null and n.status='active' and h.state in ('unique','selected')
    and mm.${basis}_at >= p.lo and mm.${basis}_at < p.hi)`;

export function seleccionConteos(o){check(o);return `-- SOLO LECTURA. Cohorte "${o.basis==='first'?'primer':'último'} mensaje en [${o.from}, ${o.to})". Devuelve conteos, sin contenido.
${cohortFrom(o)}
select
  (select count(*) from cohort) as conversaciones,
  (select count(*) from cohort where source in ('hubspot','zendesk')) as legibles_por_sql_crm,
  (select count(*) from cohort where source not in ('hubspot','zendesk')) as requieren_storage,
  (select coalesce(sum(n_msgs),0) from cohort) as mensajes,
  (select count(distinct ir.import_id) from cohort co join public.messages m on m.tenant_id=(select tenant from p) and m.conversation_id=co.id and m.deleted_at is null join public.source_heads h on h.tenant_id=m.tenant_id and h.id=m.id join public.source_revisions sr on sr.tenant_id=h.tenant_id and sr.id=h.selected_revision_id join public.message_revisions r on r.tenant_id=sr.tenant_id and r.id=sr.message_revision_id join public.import_rows ir on ir.tenant_id=r.tenant_id and ir.payload_ref=r.text_ref where co.source not in ('hubspot','zendesk')) as imports_de_storage_necesarios,
  (select count(*) from public.message_revisions r join public.messages m on m.tenant_id=r.tenant_id and m.id=r.message_id join cohort co on co.id=m.conversation_id where r.tenant_id=(select tenant from p) and r.redacted_text is not null) as revisiones_con_texto_en_base,
  (select min(first_at) from cohort) as primer_mensaje_min,
  (select max(last_at) from cohort) as ultimo_mensaje_max,
  (select coalesce(jsonb_object_agg(source,n),'{}'::jsonb) from (select source,count(*) n from cohort group by source) s) as por_fuente,
  (select coalesce(jsonb_object_agg(mes,n),'{}'::jsonb) from (select to_char(date_trunc('month',${o.basis}_at),'YYYY-MM') mes,count(*) n from cohort group by 1 order by 1) s) as por_mes;`;}

// Estadísticas agregadas (sin contenido) para --dry-count. Longitud solo medible por SQL en fuentes CRM (sync_raw_objects).
export function estadisticas(o){check(o);return `-- SOLO LECTURA. Estadísticas agregadas de la cohorte (sin contenido). Guarde el resultado como JSON en el archivo de --stats.
${cohortFrom(o)},
len as (
  select co.id, co.n_msgs, sum(length(so.normalized->'payload'->>'text')) as chars, count(so.id) as medidos
  from cohort co
  join public.messages m on m.tenant_id=(select tenant from p) and m.conversation_id=co.id and m.deleted_at is null
  join public.source_heads h on h.tenant_id=m.tenant_id and h.id=m.id
  join public.source_revisions sr on sr.tenant_id=h.tenant_id and sr.id=h.selected_revision_id
  join public.message_revisions r on r.tenant_id=sr.tenant_id and r.id=sr.message_revision_id
  join public.import_rows ir on ir.tenant_id=r.tenant_id and ir.payload_ref=r.text_ref
  join public.sync_raw_objects so on so.tenant_id=ir.tenant_id and so.import_id=ir.import_id and (so.row_ref=ir.row_ref or so.row_ref||':linked-v1'=ir.row_ref)
  group by co.id, co.n_msgs)
select
  (select count(*) from cohort) as conversations,
  (select count(*) from len) as conversations_measured,
  percentile_cont(0.5) within group (order by n_msgs) as msgs_p50,
  percentile_cont(0.9) within group (order by n_msgs) as msgs_p90,
  avg(n_msgs) as msgs_mean,
  percentile_cont(0.5) within group (order by chars) as chars_p50,
  percentile_cont(0.9) within group (order by chars) as chars_p90,
  percentile_cont(0.99) within group (order by chars) as chars_p99,
  avg(chars) as chars_mean
from len;`;}

// Verificación posterior (SELECT): cuántas conversaciones de la cohorte ya tienen extracción vigente.
export function verificacion(o){check(o);return `-- SOLO LECTURA. Verificación de avance/persistencia sobre la cohorte.
${cohortFrom(o)}
select
  (select count(*) from cohort) as cohorte,
  (select count(distinct r.conversation_id) from public.extraction_runs r join cohort co on co.id=r.conversation_id where r.tenant_id=(select tenant from p) and r.status in ('succeeded','abstained')) as con_extraccion_ok,
  (select count(distinct r.conversation_id) from public.extraction_runs r join cohort co on co.id=r.conversation_id where r.tenant_id=(select tenant from p) and r.status='failed') as con_extraccion_fallida,
  (select count(*) from public.issues i join public.extraction_runs r on r.tenant_id=i.tenant_id and r.id=i.extraction_run_id join cohort co on co.id=r.conversation_id where i.tenant_id=(select tenant from p)) as issues,
  (select count(*) from public.evidence_spans e join public.issues i on i.tenant_id=e.tenant_id and i.id=e.issue_id join public.extraction_runs r on r.tenant_id=i.tenant_id and r.id=i.extraction_run_id join cohort co on co.id=r.conversation_id where e.tenant_id=(select tenant from p)) as evidence_spans,
  (select count(*) from public.problem_embedding_members m join cohort co on co.id=m.conversation_id where m.tenant_id=(select tenant from p)) as embeddings_en_problemas,
  (select count(distinct m.problem_id) from public.problem_embedding_members m join cohort co on co.id=m.conversation_id where m.tenant_id=(select tenant from p)) as problemas;`;}

// Previa a persistir: cuántas conversaciones de la cohorte YA tienen una extracción vigente (oficial); persistir.mjs las respeta y no duplica.
export function corridasPrevias(o){check(o);return `-- SOLO LECTURA. Conversaciones de la cohorte que ya tienen extracción vigente (no se les persistirá otra).
${cohortFrom(o)}
select (select count(*) from cohort) as cohorte,
 (select count(distinct r.conversation_id) from public.extraction_runs r join cohort co on co.id=r.conversation_id where r.tenant_id=(select tenant from p) and r.status in ('succeeded','abstained')) as ya_con_extraccion_vigente,
 (select count(distinct r.conversation_id) from public.extraction_runs r join cohort co on co.id=r.conversation_id where r.tenant_id=(select tenant from p) and r.status in ('succeeded','abstained') and r.provenance->>'source'='ia-escala-cohorte-v1') as de_esta_cohorte_ia_escala;`;}

// Exportación paginada (keyset por id de conversación) de mensajes de fuentes CRM. {after} y {limit} los pone exportar.mjs.
export function exportarPagina(o,{after=null,limit=200}={}){check(o);
  if(after!==null&&!/^[a-f0-9-]{36}$/.test(after))throw Error('cursor inválido');
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw Error('limit inválido');
  return `-- SOLO LECTURA. Texto de mensajes de la cohorte (fuentes CRM). Salida contiene contenido real: solo para el proceso de Javier.
${cohortFrom(o)},
pag as (select id from cohort where source in ('hubspot','zendesk') ${after?`and id > '${after}'::uuid`:''} order by id limit ${limit}),
d0 as (select co.id as conversation_id, m.id as message_id, r.id as revision_id, m.role, m.occurred_at as at, so.normalized->'payload'->>'text' as text, so.normalized->'payload'->>'role' as payload_role,
 row_number() over (partition by m.id order by ir.created_at, ir.id, so.id) as rn, count(*) over (partition by m.id) as n_rows
from pag join cohort co on co.id=pag.id
join public.messages m on m.tenant_id=(select tenant from p) and m.conversation_id=co.id and m.deleted_at is null
join public.source_heads h on h.tenant_id=m.tenant_id and h.id=m.id and h.state in ('unique','selected')
join public.source_revisions sr on sr.tenant_id=h.tenant_id and sr.id=h.selected_revision_id
join public.message_revisions r on r.tenant_id=sr.tenant_id and r.id=sr.message_revision_id
join public.import_rows ir on ir.tenant_id=r.tenant_id and ir.payload_ref=r.text_ref
join public.sync_raw_objects so on so.tenant_id=ir.tenant_id and so.import_id=ir.import_id and (so.row_ref=ir.row_ref or so.row_ref||':linked-v1'=ir.row_ref)
),
d as (select conversation_id, message_id, revision_id, role, at, text, payload_role, n_rows, false as sentinel from d0 where rn=1), -- un mensaje, una fila
last_page as (select id from pag order by id desc limit 1)
select * from d
union all
select lp.id, null::uuid, null::uuid, null::text, null::timestamptz, null::text, null::text, null::bigint, true from last_page lp where lp.id is not null
order by conversation_id, sentinel, at, message_id;`;}


// ---- Fuente csv: el texto vive en Storage. SQL de METADATOS (sin texto): mensajes de la cohorte + import_rows (left join: cuenta "sin payload").
export function csvMensajesPagina(o,{after=null,limit=300}={}){check(o);
  if(after!==null&&!/^[a-f0-9-]{36}$/.test(after))throw Error('cursor inválido');
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw Error('limit inválido');
  return `-- SOLO LECTURA. Metadatos (sin texto) de mensajes de la cohorte en fuentes que no son CRM (csv).
${cohortFrom(o)},
pag as (select id, source from cohort where source not in ('hubspot','zendesk') ${after?`and id > '${after}'::uuid`:''} order by id limit ${limit}),
d0 as (select co.id as conversation_id, pag.source, m.id as message_id, r.id as revision_id, m.role, m.occurred_at as at, r.hash as rev_hash, ir.import_id, ir.row_ref,
 row_number() over (partition by m.id order by ir.created_at nulls last, ir.id) as rn, count(*) over (partition by m.id) as n_rows
from pag join cohort co on co.id=pag.id
join public.messages m on m.tenant_id=(select tenant from p) and m.conversation_id=co.id and m.deleted_at is null
join public.source_heads h on h.tenant_id=m.tenant_id and h.id=m.id and h.state in ('unique','selected')
join public.source_revisions sr on sr.tenant_id=h.tenant_id and sr.id=h.selected_revision_id
join public.message_revisions r on r.tenant_id=sr.tenant_id and r.id=sr.message_revision_id
left join public.import_rows ir on ir.tenant_id=r.tenant_id and ir.payload_ref=r.text_ref),
d as (select conversation_id, source, message_id, revision_id, role, at, rev_hash, import_id, row_ref, n_rows, false as sentinel from d0 where rn=1), -- un mensaje, una fila (el lector oficial exige exactamente 1 import_row)
last_page as (select id from pag order by id desc limit 1)
select conversation_id, source, message_id, revision_id, role, at, rev_hash, import_id, row_ref, n_rows, sentinel from d
union all
select lp.id, null::text, null::uuid, null::uuid, null::text, null::timestamptz, null::text, null::uuid, null::text, null::bigint, true from last_page lp where lp.id is not null
order by conversation_id, sentinel, at, message_id;`;}

// Metadatos de los imports (archivo en Storage). Mismos campos que usa source-reader.mjs para leer. Sin contenido.
export function importsMeta(ids,{tenant=TENANT}={}){
  if(!Array.isArray(ids)||!ids.length||ids.length>200||ids.some(i=>!/^[a-f0-9-]{36}$/.test(i)))throw Error('ids de import inválidos');
  if(!/^[a-f0-9-]{36}$/.test(tenant))throw Error('tenant inválido');
  return `-- SOLO LECTURA. Metadatos de imports (ruta del objeto, hash, tamaño, mapeo). Sin texto.
select i.id as import_id, i.object_path, i.file_hash, i.mapping_version, i.provenance, i.tenant_id, i.connection_id, i.created_at, u.size, u.content_type, cn.source, cn.account_id
from public.imports i
join public.connections cn on cn.tenant_id=i.tenant_id and cn.id=i.connection_id
left join public.import_uploads u on u.tenant_id=i.tenant_id and u.import_id=i.id
where i.tenant_id='${tenant}'::uuid and i.id in (${ids.map(i=>`'${i}'::uuid`).join(',')});`;}

// Taxonomía vigente del tenant, tomada de la última extracción registrada (provenance.taxonomy). SOLO LECTURA.
export const taxonomia=(tenant=TENANT)=>{if(!/^[a-f0-9-]{36}$/.test(tenant))throw Error('tenant inválido');return `-- SOLO LECTURA. Taxonomía usada por la última extracción vigente del tenant.
select provenance->'taxonomy' as taxonomy, created_at from public.extraction_runs
where tenant_id='${tenant}'::uuid and jsonb_typeof(provenance->'taxonomy')='array' order by created_at desc limit 1;`;};

export const WRITE_WORDS=/\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do)\b/i;
