-- CFO audit: reviewed migration. Rollback refuses any populated log.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
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
