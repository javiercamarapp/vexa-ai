-- Esquema mínimo SOLO para comprobar 0052 en un Postgres local desechable (no sustituye 0001-0051).
create role vexa_backend nologin;create role anon nologin;create role authenticated nologin;create role service_role nologin;
create schema if not exists public;
create table public.organizations(id uuid primary key);
create table public.connections(id uuid primary key,tenant_id uuid not null references public.organizations(id),source text,account_id text,unique(tenant_id,id));
create function public.vexa_member(p_tenant uuid,p_roles text[] default array['owner','analyst','operator','viewer']) returns boolean language sql stable as $$select true$$;
create function public.vexa_backend_action(p_tenant uuid,p_actions text[]) returns boolean language sql stable as $$select true$$;
grant usage on schema public to vexa_backend;grant select on public.connections to vexa_backend;
alter table public.connections enable row level security;create policy r on public.connections for select to vexa_backend using(true);
