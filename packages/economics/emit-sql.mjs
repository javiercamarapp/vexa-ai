// Emisor de SQL para la carga económica. Cada archivo es UNA transacción autocontenida que:
// Sin begin/commit explícitos: una cadena multi-sentencia enviada por protocolo simple (supabase db query -f) corre como UNA transacción implícita
// y su última sentencia (el SELECT del resultado) es la que devuelve la CLI, igual que en aplicar-0054.sh.
//  1) fija el contexto (tenant, acción `configure`, actor owner) con set_config LOCAL,
//  2) llama public.economic_batch_import (0051) con una tanda ≤250 de UNA fuente,
//  3) devuelve una única fila «ECON_BATCH_RESULT <etiqueta> <procesadas> <insertadas> <repetidas>».
// Todo es idempotente: reenviar el mismo archivo da «repetidas = procesadas». Ninguna función aquí ejecuta SQL.
import {createHash} from 'node:crypto';
import {MAX_BATCH} from './marketplace-map.mjs';

const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const tagFor = body => '$v' + createHash('sha256').update(body).digest('hex').slice(0, 10) + '$';

/** Bloque DO que fija el contexto. actor: uuid explícito o null para «el único owner activo del tenant» (falla si hay 0 o >1). */
export function contextSql(tenantId, actorId = null) {
  if (!UUID.test(tenantId)) throw new Error('TENANT_INVALIDO');
  if (actorId !== null && !UUID.test(actorId)) throw new Error('ACTOR_INVALIDO');
  return `do $ctx$
declare a uuid; n integer;
begin
  perform set_config('vexa.tenant_id',${lit(tenantId)},true);
  perform set_config('vexa.action','configure',true);
  ${actorId ? `a:=${lit(actorId)}::uuid;` : `select count(*),(array_agg(user_id))[1] into n,a from public.memberships where tenant_id=${lit(tenantId)}::uuid and role='owner' and status='active';
  if n<>1 then raise exception 'ACTOR_OWNER_AMBIGUO: % owners activos; pase VEXA_ACTOR=<uuid>',n; end if;`}
  perform set_config('request.jwt.claim.sub',a::text,true);
end $ctx$;`;
}

/** Crea (si faltan) las fuentes en versión 1; si ya existe una con otro tipo/nombre, aborta. Devuelve ECON_SOURCES_RESULT. */
export function sourcesSql(tenantId, sources, actorId = null) {
  const rows = sources.map(s => {
    if (!UUID.test(s.sourceId)) throw new Error('SOURCE_ID_INVALIDO');
    const reportHash = createHash('sha256').update(s.report, 'utf8').digest('hex');
    return `(${lit(s.sourceId)}::uuid,${lit(s.name)},${lit(s.evidenceType)},${s.active},${s.complete},${lit(s.windowStart)}::timestamptz,${lit(s.windowEnd)}::timestamptz,${lit(s.watermark)}::timestamptz,${lit(s.report)},${lit(reportHash)})`;
  }).join(',\n    ');
  return `${contextSql(tenantId, actorId)}
set local statement_timeout='30000ms';
do $chk$
begin
  if exists(select 1 from public.economic_source_versions e join (values ${sources.map(s => `(${lit(s.sourceId)}::uuid,${lit(s.evidenceType)},${lit(s.name)})`).join(',')}) v(id,t,nm) on e.tenant_id=${lit(tenantId)}::uuid and e.source_id=v.id and e.version=1 and (e.evidence_type<>v.t or e.name<>v.nm)) then
    raise exception 'FUENTE_EXISTENTE_DISTINTA';
  end if;
end $chk$;
with ins as (
  insert into public.economic_source_versions(tenant_id,source_id,version,actor_id,name,evidence_type,active,complete,window_start,window_end,watermark,report,report_hash,attested)
  select ${lit(tenantId)}::uuid,v.id,1,auth.uid(),v.nm,v.t,v.act,v.cmp,v.ws,v.we,v.wm,v.rep,v.rh,true
  from (values
    ${rows}
  ) v(id,nm,t,act,cmp,ws,we,wm,rep,rh)
  where not exists(select 1 from public.economic_source_versions e where e.tenant_id=${lit(tenantId)}::uuid and e.source_id=v.id)
  returning 1)
select 'ECON_SOURCES_RESULT creadas '||count(*)||' de ${sources.length}' as resultado from ins;
`;
}

/** Nueva versión de una fuente existente con ventana ampliada (solo para ampliar Shopify hacia atrás). Idempotente. */
export function sourceExtendSql(tenantId, {sourceId, toVersion, windowStart, windowEnd}, actorId = null) {
  return `${contextSql(tenantId, actorId)}
set local statement_timeout='30000ms';
with cur as (select * from public.economic_source_versions where tenant_id=${lit(tenantId)}::uuid and source_id=${lit(sourceId)}::uuid order by version desc limit 1),
ins as (
  insert into public.economic_source_versions(tenant_id,source_id,version,actor_id,name,evidence_type,active,complete,window_start,window_end,watermark,report,report_hash,attested)
  select c.tenant_id,c.source_id,${toVersion},auth.uid(),c.name,c.evidence_type,c.active,false,least(c.window_start,${lit(windowStart)}::timestamptz),greatest(c.window_end,${lit(windowEnd)}::timestamptz),c.watermark,c.report,c.report_hash,true
  from cur c where c.version=${toVersion - 1} returning 1)
select 'ECON_SOURCES_RESULT ampliadas '||(select count(*) from ins)||' (version actual '||(select version from public.economic_source_versions where tenant_id=${lit(tenantId)}::uuid and source_id=${lit(sourceId)}::uuid order by version desc limit 1)||')' as resultado;
`;
}

/** Una tanda. entries: entradas de 14 claves (con `attested`). label: texto sin espacios para el recibo. */
export function batchSql(tenantId, {sourceId, sourceVersion = 1, entries, label}, actorId = null) {
  if (!UUID.test(sourceId)) throw new Error('SOURCE_ID_INVALIDO');
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > MAX_BATCH) throw new Error('TANDA_FUERA_DE_RANGO');
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(label)) throw new Error('ETIQUETA_INVALIDA');
  const body = JSON.stringify({sourceId, sourceVersion, entries});
  const tag = tagFor(body);
  if (body.includes(tag)) throw new Error('ETIQUETA_DOLAR_COLISIONA');
  if (Buffer.byteLength(body, 'utf8') > 8 * 1024 * 1024) throw new Error('TANDA_MAYOR_QUE_8MIB');
  return `${contextSql(tenantId, actorId)}
set local statement_timeout='30000ms';
set local lock_timeout='15000ms';
select 'ECON_BATCH_RESULT ${label} '||(r->>'processed')||' '||(r->>'inserted')||' '||(r->>'replayed') as resultado
from (select public.economic_batch_import(${tag}${body}${tag}::jsonb) as r) q;
`;
}
