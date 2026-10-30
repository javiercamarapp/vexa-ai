-- 20261206000500 (PROPUESTA, NO APLICADA): VINCULOS problema-conversacion-hallazgo (public.problem_conversations) derivados de la membresia REAL de los problemas.
-- Por qué: problem_conversations (0004) existe pero NADIE la escribe ni la lee: la membresia vive en problem_embedding_members y en la instantanea de problem_versions
--   (kind 'vector-problem-v1'). Con la tabla vacia no hay forma de consultar «que conversaciones, con que hallazgo, sostienen este problema» sin pasar por vectores, y la
--   exposicion (problema -> conversacion -> pedido) no tiene de donde colgarse.
-- Qué AÑADE: public.refresh_problem_conversations(tenant, dry_run). Idempotente. Una fila vigente (valid_until null) por (problema vigente, conversacion) con
--   provenance.kind='problem-link-v1'. NO crea tablas, NO cambia politicas, NO programa nada, NO toca otras tablas.
-- Qué NO inventa: solo existe un vinculo si hay una fila en problem_embedding_members de un problema VIGENTE (ultima version vector-problem-v1 en estado 'active' y
--   problems.archived_at nulo), con corrida de extraccion 'succeeded' y conversacion no borrada. issue_id solo se llena si EXACTAMENTE UN hallazgo de esa corrida tiene un
--   evidence_span sobre la revision del miembro; con 0 o con mas de 1 queda NULL (no se adivina). El pedido NO se vincula aqui (eso es conversations.order_id / economic_problem_links).
-- Cuando una version nueva retira un problema o saca una conversacion del grupo (dividir/unir, reasignar), el vinculo vigente se CIERRA (valid_until) y no se borra: la historia queda.
-- Quien la corre: la persona con acceso de propietario de la base (supabase db query --linked), nunca la aplicacion. Se niega a correr si el rol no puede saltar RLS (si no, RLS
--   ocultaria filas y el resultado seria un conteo falso).
-- Orden: aplicar esta migracion, luego correr refresh_problem_conversations(tenant, true) (ensayo) y despues (tenant, false). Ver 2-vincular-problema-conversaciones-29oct.sh.
-- Reversa: packages/workspace-service/tests/20261206000500_problem_conversations_link.down.sql
begin;
set local lock_timeout='3s'; set local statement_timeout='15s';
do $$
begin
 if to_regclass('public.problem_conversations') is null or to_regclass('public.problem_embedding_members') is null or to_regclass('public.problem_versions') is null
    or to_regclass('public.extraction_runs') is null or to_regclass('public.issues') is null or to_regclass('public.evidence_spans') is null or to_regclass('public.embeddings') is null then
  raise exception 'faltan tablas base de evidencia/problemas (0004, 0016)';
 end if;
end $$;

create or replace function public.refresh_problem_conversations(p_tenant uuid, p_dry_run boolean default false) returns jsonb
language plpgsql set search_path='' as $$
declare n_probs integer; n_desired integer; n_issue integer; n_orders integer; n_close integer:=0; n_insert integer:=0; n_keep integer;
begin
 if p_tenant is null or not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'PROBLEM_LINKS_TENANT_UNKNOWN' using errcode='22023'; end if;
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'PROBLEM_LINKS_NEEDS_OWNER: el rol (%) debe ser superusuario o tener BYPASSRLS', current_user using errcode='42501'; end if;
 perform set_config('lock_timeout','5s',true);
 -- Mismo candado que dividir/unir problemas: no se vincula a mitad de una reestructuracion.
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':vector-problems',0));
 drop table if exists pg_temp.pcl_desired;
 create temp table pcl_desired on commit drop as
 with cur as (
   select distinct on (v.problem_id) v.problem_id, v.version, v.provenance->'snapshot'->>'state' as state
   from public.problem_versions v where v.tenant_id=p_tenant and v.provenance->>'kind'='vector-problem-v1' order by v.problem_id, v.version desc),
 act as (
   select c.problem_id, c.version from cur c join public.problems p on p.tenant_id=p_tenant and p.id=c.problem_id and p.archived_at is null where c.state='active'),
 mem as (
   select a.problem_id, a.version, m.conversation_id, m.embedding_id, m.extraction_run_id, e.message_revision_id, cv.order_id
   from act a
   join public.problem_embedding_members m on m.tenant_id=p_tenant and m.problem_id=a.problem_id
   join public.extraction_runs r on r.tenant_id=p_tenant and r.id=m.extraction_run_id and r.status='succeeded'
   join public.conversations cv on cv.tenant_id=p_tenant and cv.id=m.conversation_id and cv.deleted_at is null
   join public.embeddings e on e.tenant_id=p_tenant and e.id=m.embedding_id),
 iss as (
   select mem.problem_id, mem.conversation_id, i.id as issue_id
   from mem join public.issues i on i.tenant_id=p_tenant and i.extraction_run_id=mem.extraction_run_id
   join public.evidence_spans es on es.tenant_id=p_tenant and es.issue_id=i.id and es.message_revision_id=mem.message_revision_id
   group by 1,2,3),
 pick as (select problem_id, conversation_id, case when count(*)=1 then (array_agg(issue_id))[1] end as issue_id from iss group by 1,2)
 select g.problem_id, g.conversation_id, g.version, g.embeddings, g.has_order, pk.issue_id
 from (select problem_id, conversation_id, max(version) as version, count(*)::int as embeddings, bool_or(order_id is not null) as has_order from mem group by 1,2) g
 left join pick pk on pk.problem_id=g.problem_id and pk.conversation_id=g.conversation_id;
 create unique index on pg_temp.pcl_desired(problem_id, conversation_id);

 select count(*), count(*) filter(where issue_id is not null), count(*) filter(where has_order), count(distinct problem_id) into n_desired, n_issue, n_orders, n_probs from pg_temp.pcl_desired;
 -- Vigentes propios que ya no corresponden (otro problema, conversacion fuera del grupo, hallazgo distinto) -> se cierran.
 create temp table pcl_close on commit drop as
  select l.id from public.problem_conversations l
  where l.tenant_id=p_tenant and l.valid_until is null and l.provenance->>'kind'='problem-link-v1'
    and not exists(select 1 from pg_temp.pcl_desired d where d.problem_id=l.problem_id and d.conversation_id=l.conversation_id and d.issue_id is not distinct from l.issue_id);
 create temp table pcl_new on commit drop as
  select d.* from pg_temp.pcl_desired d
  where not exists(select 1 from public.problem_conversations l where l.tenant_id=p_tenant and l.valid_until is null and l.problem_id=d.problem_id and l.conversation_id=d.conversation_id and l.issue_id is not distinct from d.issue_id);
 select count(*) into n_close from pg_temp.pcl_close; select count(*) into n_insert from pg_temp.pcl_new;
 n_keep:=n_desired-n_insert;
 if not p_dry_run then
  update public.problem_conversations l set valid_until=clock_timestamp(), updated_at=clock_timestamp() where l.tenant_id=p_tenant and l.id in (select id from pg_temp.pcl_close);
  insert into public.problem_conversations(tenant_id, problem_id, conversation_id, issue_id, valid_from, provenance)
   select p_tenant, n.problem_id, n.conversation_id, n.issue_id, clock_timestamp(),
          jsonb_build_object('kind','problem-link-v1','source','problem_embedding_members','problem_version',n.version,'embeddings',n.embeddings)
   from pg_temp.pcl_new n;
 end if;
 drop table pg_temp.pcl_close; drop table pg_temp.pcl_new; drop table pg_temp.pcl_desired;
 return jsonb_build_object('tenant',p_tenant,'dry_run',p_dry_run,'active_problems_with_members',n_probs,'desired_links',n_desired,'inserted',n_insert,'closed',n_close,'unchanged',n_keep,
   'with_issue',n_issue,'without_issue',n_desired-n_issue,'with_order_on_conversation',n_orders);
end $$;
revoke all on function public.refresh_problem_conversations(uuid,boolean) from public,anon,authenticated,service_role,vexa_backend;
commit;
