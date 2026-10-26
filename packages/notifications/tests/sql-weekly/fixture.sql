-- Fixture mínimo (Postgres desechable) para 20261127000000_pain_points_ia_semanal.sql: solo lo que la migración exige de las migraciones base.
create role anon nologin; create role authenticated nologin; create role service_role nologin; create role vexa_backend nologin;
create table public.organizations(id uuid primary key default gen_random_uuid(), name text);
create table public.memberships(tenant_id uuid, user_id uuid, role text, status text, primary key(tenant_id,user_id));
create function public.vexa_request_uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function public.vexa_member(p_tenant uuid, p_roles text[] DEFAULT ARRAY['owner','analyst','operator','viewer']) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO '' AS $f$
BEGIN RETURN exists(select 1 from public.memberships m where m.tenant_id=p_tenant and m.user_id=(select public.vexa_request_uid()) and m.status='active' and m.role=any(p_roles)); END; $f$;
create function public.vexa_backend_action(p_tenant uuid, p_actions text[]) returns boolean language sql stable security invoker set search_path='' as $f$
 select current_setting('vexa.action',true)=any(p_actions) and public.vexa_member(p_tenant,case current_setting('vexa.action',true) when 'import' then array['owner','analyst'] else array['owner'] end) $f$;
grant usage on schema public to vexa_backend;
grant execute on function public.vexa_member(uuid,text[]), public.vexa_backend_action(uuid,text[]), public.vexa_request_uid() to vexa_backend;
grant select on public.memberships, public.organizations to vexa_backend;
insert into public.organizations(id,name) values('11111111-1111-1111-1111-111111111111','T1'),('22222222-2222-2222-2222-222222222222','T2');
insert into public.memberships values
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','owner','active'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','analyst','active'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000003','viewer','active'),
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000004','analyst','inactive'),
 ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000001','owner','active');
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
insert into auth.users(id,email,email_confirmed_at) select distinct user_id,user_id::text||'@example.test',now() from memberships;
create table public.notification_outbox(tenant_id uuid,id uuid,user_id uuid,idempotency_key text,channel text,state text,actor_id uuid,primary key(tenant_id,id));
create table public.jobs(tenant_id uuid,id uuid,type text,state text,lease_owner text,lease_until timestamptz,deadline timestamptz);
create table public.worker_delegations(tenant_id uuid,user_id uuid,enabled boolean);
create table public.notification_delivery_policies(tenant_id uuid,channel text,version int,enabled boolean,actor_id uuid);
create table public.notification_outbox_items(tenant_id uuid,job_id uuid,user_id uuid,channel text,state text,event_id uuid);
create table public.notification_events(tenant_id uuid,id uuid,type text,resource_id uuid);
create function public.notification_worker(uuid) returns boolean language sql as $$ select false $$;
create function public.notification_recipient_current(uuid,uuid,text,uuid,text) returns boolean language sql as $$ select true $$;
