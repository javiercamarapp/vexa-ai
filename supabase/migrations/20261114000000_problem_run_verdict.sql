-- 20261114000000 (PROPUESTA, NO APLICADA): VEREDICTO PRECALCULADO DE LAS CORRIDAS DE EVIDENCIA DE LOS PROBLEMAS (insight_problem_run_verdict).
-- Por qué: la lista de problemas (/problems, /api/problems, el catálogo del Brief y el Explorador) verifica EN CADA PETICIÓN las miles de corridas con una consulta agregada
--   (usableRunsSummary, packages/problems/repository.mjs): 6.5–9 s en frío medidos el 22-oct y hasta 14 s con la base ocupada. Es la lectura más lenta que queda tras
--   acotar la verificación de una ficha (BUILD-ESTABILIDAD, 23-oct). Aquí el MISMO veredicto se calcula FUERA de la ruta del usuario (motor de insights) y la aplicación solo hace
--   SELECT sobre ~9 mil filas por clave primaria.
-- Qué AÑADE: insight_problem_run_verdict (veredicto por corrida), problem_verdict_epoch (contador por tenant) y sus disparadores, refresh_problem_run_verdicts(tenant,presupuesto_ms).
-- Qué NO hace: no cambia ninguna política, función ni dato existente. No programa nada (el disparo vive en la aplicación, como el resto de insights).
-- CORRECCIÓN POR CONSTRUCCIÓN (fail-closed): el veredicto depende de lo que puede cambiar DESPUÉS de calcularlo (borrados de conversación, mensaje o revisión, lápidas,
--   retención, desactivar una conexión, cambiar el estado de una corrida). Cada una de esas escrituras sube problem_verdict_epoch del tenant; la aplicación SOLO usa filas cuyo
--   epoch coincide con el actual y, si no coincide (o falta), cae a la consulta en vivo de siempre. Nunca se sirve un veredicto «usable» obsoleto.
-- Costo de los disparadores: son de SENTENCIA (con tablas de transición), no de fila; una purga de 100 mil filas sube el contador una vez por tenant. El de message_revisions
--   (la tabla más escrita) es necesario para la corrección: MEDIR el costo de la ingesta con él antes de aplicar; si no es aceptable, NO aplicar esta migración (no omitir el disparador).
-- retention_source_deleted_internal (no la versión con sesión) porque el cálculo corre como propietario y no como un miembro: la versión con sesión devolvería false (abierto) sin sesión.
-- Requiere: 20261104000000 (insights_authorized, insight_state). Orden: aplicar la migración, luego el código; sin la migración el código usa la consulta en vivo.
-- Reversa: packages/workspace-service/tests/20261114000000_problem_run_verdict.down.sql
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regprocedure('public.insights_authorized(uuid)') is null or to_regclass('public.insight_state') is null then raise exception 'falta 20261104000000_insights_engine'; end if;
 if to_regprocedure('public.retention_source_deleted_internal(uuid,uuid,text,text)') is null then raise exception 'falta retention_source_deleted_internal (0033)'; end if;
 if to_regclass('public.problem_embedding_members') is null or to_regclass('public.extraction_runs') is null or to_regclass('public.tombstones') is null or to_regclass('public.retention_ledger') is null then raise exception 'faltan tablas base de problemas/evidencia'; end if;
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'el propietario de la migración (%) debe ser superusuario o tener BYPASSRLS', current_user; end if;
end $$;

-- 1) El estado de insight reconoce el nuevo cálculo.
alter table public.insight_state drop constraint if exists insight_state_insight_check;
alter table public.insight_state add constraint insight_state_insight_check
 check(insight in('conversation_volume','refund_by_sku_month','thread_resolution','tracker_refund_status','repeat_contact','order_revenue_month','complaint_family_month','problem_run_verdict'));

-- 2) Contador de cambios que pueden invalidar un veredicto (uno por tenant).
create table if not exists public.problem_verdict_epoch(
 tenant_id uuid primary key references public.organizations(id),
 epoch bigint not null default 1 check(epoch>=1),
 bumped_at timestamptz not null default now()
);

-- 3) Veredicto por corrida: «utilizable» = la misma regla de usableRunsSummary (corrida succeeded con manifiesto de 1 a 500 entradas íntegro, conversación vigente con conexión
--    activa y cabeza unique/selected/ambiguous, sin lápida y sin retención).
create table if not exists public.insight_problem_run_verdict(
 tenant_id uuid not null references public.organizations(id),
 extraction_run_id uuid not null,
 usable boolean not null,
 epoch bigint not null check(epoch>=1),
 refreshed_at timestamptz not null default now(),
 primary key(tenant_id,extraction_run_id)
);

do $$
declare t text;
begin
 foreach t in array array['problem_verdict_epoch','insight_problem_run_verdict'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',t);
  execute format('grant select on public.%I to vexa_backend',t);
  execute format('drop policy if exists verdict_read on public.%I',t);
  execute format('create policy verdict_read on public.%I for select to vexa_backend using(tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and (select public.vexa_member(tenant_id,array[''owner'',''analyst'',''operator'',''viewer''])))',t);
 end loop;
end $$;

-- 4) Disparadores de SENTENCIA: suben el contador del tenant cuando algo que cambia el veredicto se escribe.
create or replace function public.problem_verdict_bump_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.problem_verdict_epoch(tenant_id) select distinct n.tenant_id from n on conflict(tenant_id) do update set epoch=public.problem_verdict_epoch.epoch+1,bumped_at=now();
 return null;
end $$;
create or replace function public.problem_verdict_bump_deleted() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.problem_verdict_epoch(tenant_id) select distinct n.tenant_id from n join o on o.id=n.id where o.deleted_at is distinct from n.deleted_at
  on conflict(tenant_id) do update set epoch=public.problem_verdict_epoch.epoch+1,bumped_at=now();
 return null;
end $$;
create or replace function public.problem_verdict_bump_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.problem_verdict_epoch(tenant_id) select distinct n.tenant_id from n join o on o.id=n.id where o.status is distinct from n.status
  on conflict(tenant_id) do update set epoch=public.problem_verdict_epoch.epoch+1,bumped_at=now();
 return null;
end $$;
revoke all on function public.problem_verdict_bump_insert(),public.problem_verdict_bump_deleted(),public.problem_verdict_bump_status() from public,anon,authenticated,service_role,vexa_backend;

drop trigger if exists problem_verdict_tombstones on public.tombstones;
create trigger problem_verdict_tombstones after insert on public.tombstones referencing new table as n for each statement execute function public.problem_verdict_bump_insert();
drop trigger if exists problem_verdict_retention on public.retention_ledger;
create trigger problem_verdict_retention after insert on public.retention_ledger referencing new table as n for each statement execute function public.problem_verdict_bump_insert();
drop trigger if exists problem_verdict_conversations on public.conversations;
create trigger problem_verdict_conversations after update on public.conversations referencing old table as o new table as n for each statement execute function public.problem_verdict_bump_deleted();
drop trigger if exists problem_verdict_messages on public.messages;
create trigger problem_verdict_messages after update on public.messages referencing old table as o new table as n for each statement execute function public.problem_verdict_bump_deleted();
drop trigger if exists problem_verdict_message_revisions on public.message_revisions;
create trigger problem_verdict_message_revisions after update on public.message_revisions referencing old table as o new table as n for each statement execute function public.problem_verdict_bump_deleted();
drop trigger if exists problem_verdict_connections on public.connections;
create trigger problem_verdict_connections after update on public.connections referencing old table as o new table as n for each statement execute function public.problem_verdict_bump_status();
drop trigger if exists problem_verdict_runs on public.extraction_runs;
create trigger problem_verdict_runs after update on public.extraction_runs referencing old table as o new table as n for each statement execute function public.problem_verdict_bump_status();

-- 5) Cálculo (fuera de la ruta del usuario). Misma regla que packages/problems/repository.mjs usableRunsSummaryBody; si esa consulta cambia, cambia aquí (la prueba
--    packages/problems/tests/veredicto-precalculado.test.mjs compara ambas sobre el mismo mundo).
create or replace function public.refresh_problem_run_verdicts(p_tenant uuid,p_budget_ms integer default 55000) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t0 timestamptz:=clock_timestamp(); v_epoch bigint; n_all integer; n_ok integer;
begin
 if not public.insights_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p_budget_ms is null or p_budget_ms<500 or p_budget_ms>600000 then raise exception 'INSIGHT_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'INSIGHT_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 if not pg_try_advisory_xact_lock(hashtextextended(p_tenant::text||':problem-run-verdict',0)) then return jsonb_build_object('tenant',p_tenant,'status','busy'); end if;
 perform set_config('statement_timeout',p_budget_ms::text,true);
 insert into public.problem_verdict_epoch(tenant_id) values(p_tenant) on conflict(tenant_id) do nothing;
 -- El epoch se lee ANTES de calcular: si algo cambia mientras se calcula, el contador queda por delante y estas filas se consideran obsoletas (seguro).
 select epoch into v_epoch from public.problem_verdict_epoch where tenant_id=p_tenant;
 with runs as (select distinct m.extraction_run_id as id from public.problem_embedding_members m where m.tenant_id=p_tenant),
  sel as materialized (select r.id,r.conversation_id,r.provenance->'input_manifest' as manifest from public.extraction_runs r
   where r.tenant_id=p_tenant and r.id in(select id from runs) and r.status='succeeded' and jsonb_typeof(r.provenance->'input_manifest')='array' and jsonb_array_length(r.provenance->'input_manifest') between 1 and 500),
  ent as materialized (select sel.id,sel.conversation_id,jsonb_array_length(sel.manifest) as total,
    case when x->>'message_revision_id' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then (x->>'message_revision_id')::uuid end as mrid,
    case when x->>'original_revision_id' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then (x->>'original_revision_id')::uuid end as oid,
    x->>'hash' as hash from sel cross join lateral jsonb_array_elements(sel.manifest) x),
  ok as materialized (select ent.id,ent.conversation_id from ent
   join public.message_revisions mr on mr.tenant_id=p_tenant and mr.id=ent.mrid and mr.deleted_at is null and mr.redaction_version is not null and mr.hash=ent.hash and mr.provenance->>'original_revision_id'=ent.oid::text
   join public.messages m on m.tenant_id=p_tenant and m.id=mr.message_id and m.deleted_at is null
   join public.message_revisions o on o.tenant_id=p_tenant and o.id=ent.oid and o.deleted_at is null
   group by ent.id,ent.conversation_id,ent.total having count(*)=ent.total),
  cand as (select ok.id,c.connection_id,c.external_id from ok
   join public.conversations c on c.tenant_id=p_tenant and c.id=ok.conversation_id and c.deleted_at is null
   join public.connections n on n.tenant_id=p_tenant and n.id=c.connection_id and n.status='active'
   join public.source_heads h on h.tenant_id=p_tenant and h.id=c.id and h.state in('unique','selected','ambiguous')
   where not exists(select 1 from public.tombstones t where t.tenant_id=p_tenant and (t.connection_id is null or t.connection_id=c.connection_id) and t.deleted_source_key in(c.id::text,c.external_id))),
  keep as (select cand.id from cand where not public.retention_source_deleted_internal(p_tenant,cand.connection_id,'conversation',cand.external_id)),
  up as (insert into public.insight_problem_run_verdict(tenant_id,extraction_run_id,usable,epoch,refreshed_at)
   select p_tenant,r.id,exists(select 1 from keep k where k.id=r.id),v_epoch,now() from runs r
   on conflict(tenant_id,extraction_run_id) do update set usable=excluded.usable,epoch=excluded.epoch,refreshed_at=excluded.refreshed_at returning usable)
 select count(*),count(*) filter(where usable) into n_all,n_ok from up;
 delete from public.insight_problem_run_verdict v where v.tenant_id=p_tenant and not exists(select 1 from public.problem_embedding_members m where m.tenant_id=p_tenant and m.extraction_run_id=v.extraction_run_id);
 insert into public.insight_state(tenant_id,insight,status,refreshed_at,source_rows,duration_ms,computed_from)
  values(p_tenant,'problem_run_verdict','ready',clock_timestamp(),n_all,(extract(epoch from clock_timestamp()-t0)*1000)::int,jsonb_build_object('epoch',v_epoch,'usable',n_ok))
  on conflict(tenant_id,insight) do update set status='ready',refreshed_at=excluded.refreshed_at,source_rows=excluded.source_rows,duration_ms=excluded.duration_ms,computed_from=excluded.computed_from,error_code=null;
 return jsonb_build_object('tenant',p_tenant,'status','done','runs',n_all,'usable',n_ok,'epoch',v_epoch,'duration_ms',(extract(epoch from clock_timestamp()-t0)*1000)::int);
end $$;
revoke all on function public.refresh_problem_run_verdicts(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.refresh_problem_run_verdicts(uuid,integer) to vexa_backend;
commit;
