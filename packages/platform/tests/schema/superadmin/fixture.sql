create role anon nologin; create role authenticated nologin; create role vexa_backend nologin;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz, deleted_at timestamptz, banned_until timestamptz);
create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid, not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table public.organizations(id uuid primary key default gen_random_uuid(), name text, created_at timestamptz default now());
create table public.memberships(tenant_id uuid, user_id uuid, role text, status text, permissions_version int default 1, primary key(tenant_id,user_id));
create table public.team_invitations(id uuid primary key default gen_random_uuid(), tenant_id uuid, request_id uuid, email text, role text, created_by uuid, expires_at timestamptz, status text default 'pending', delivery text default 'not_started', version int default 1, accepted_by uuid, accepted_at timestamptz);
create table public.team_audit(id bigint generated always as identity, tenant_id uuid, actor_id uuid, operation text, target_id uuid, before_value jsonb, after_value jsonb);
create table public.ai_budget_reservations(tenant_id uuid, window_key text, created_at timestamptz default now(), actual_minor bigint, held_minor bigint, state text);
create table public.ai_budget_limits(id serial, tenant_id uuid, window_key text, purpose text, limit_minor bigint);
create table public.economic_ledger_entries(tenant_id uuid, recorded_at timestamptz);
create table public.connections(id uuid default gen_random_uuid(), tenant_id uuid, source text, status text, last_success timestamptz, account_id text);
create table public.connection_health(tenant_id uuid, connection_id uuid, state text, last_success timestamptz, error_code text);
create table public.imports(tenant_id uuid, connection_id uuid, state text, total int, accepted int, duplicates int, rejected int, pending int, updated_at timestamptz default now());
create table public.jobs(tenant_id uuid, state text, lease_until timestamptz, updated_at timestamptz default now());
create table public.metric_snapshots(id uuid default gen_random_uuid(), tenant_id uuid, status text, as_of timestamptz, published_at timestamptz, created_at timestamptz default now(), component_count int);
create function public.vexa_request_uid() returns uuid language sql stable as $$ select auth.uid() $$;
create function public.vexa_member(p_tenant uuid, p_roles text[] DEFAULT ARRAY['owner'::text, 'analyst'::text, 'operator'::text, 'viewer'::text]) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
BEGIN RETURN exists(select 1 from public.memberships m where m.tenant_id=p_tenant
 and m.user_id=(select public.vexa_request_uid()) and m.status='active' and m.role=any(p_roles)); END;
$function$;
