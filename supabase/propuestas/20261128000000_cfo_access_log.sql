-- Bitácora de consultas del Copiloto CFO (insert-only, por organización). LISTA PARA APLICAR, NO APLICADA.
-- Contenido idéntico a packages/cfo-copilot/sql/cfo_access_log.proposal.sql (solo cambia este encabezado). Reversa: 20261128000000_cfo_access_log.down.sql.
-- Por qué: sin esta tabla el copiloto no ejecuta ninguna herramienta (falla cerrado). En producción, POST /cfo/data/copilot registra
-- db-fallo {accion:propose, clase:sqlstate_42P01} (tabla inexistente) y el chat de CFO responde «no se pudo registrar la consulta en la bitácora».
-- Dependencias (ya existentes): public.organizations, public.memberships(tenant_id,user_id), public.vexa_member, public.vexa_backend_action, rol vexa_backend.
-- Probada en Postgres local desechable: packages/cfo-copilot/tests/cfo-access-log-pg.test.mjs. Al aplicarla, moverla a supabase/migrations/.
begin;
create table public.cfo_access_log(
 id bigint generated always as identity primary key,
 tenant_id uuid not null references public.organizations(id) on delete restrict,
 actor_id uuid not null,
 tool text check(tool is null or tool ~ '^[a-z_]{1,40}$'),
 args_hash text check(args_hash is null or args_hash ~ '^[a-f0-9]{64}$'),
 outcome text not null check(outcome ~ '^[a-z_:]{1,40}$'),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id)
);
alter table public.cfo_access_log enable row level security;
alter table public.cfo_access_log force row level security;
revoke all on public.cfo_access_log from public,anon,authenticated,service_role,vexa_backend;
grant select,insert on public.cfo_access_log to vexa_backend;
create policy cfo_access_log_read on public.cfo_access_log for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id,array['owner']));
create policy cfo_access_log_insert on public.cfo_access_log for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['propose']) and public.vexa_member(tenant_id,array['owner','analyst']));
create function public.cfo_access_log_append_only() returns trigger language plpgsql set search_path='' as $$ begin raise exception using errcode='42501',message='cfo_access_log_append_only'; end $$;
create trigger cfo_access_log_immutable before update or delete on public.cfo_access_log for each row execute function public.cfo_access_log_append_only();
create index cfo_access_log_recent on public.cfo_access_log(tenant_id,created_at desc);
commit;
