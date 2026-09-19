-- Review/apply through the principal. No client writes or automatic provisioning.
begin;
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);
create table public.memberships (
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','analyst','operator','viewer')),
  status text not null default 'invited' check (status in ('active','invited','revoked')),
  permissions_version integer not null default 1 check (permissions_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id,user_id)
);
create index memberships_user_status on public.memberships(user_id,status,tenant_id);
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
revoke all on public.organizations, public.memberships from public, anon, authenticated;
grant select on public.organizations, public.memberships to authenticated;
-- This policy does not query organizations or memberships: no recursion.
create policy membership_self_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy organization_member_read on public.organizations for select to authenticated
  using (exists (select 1 from public.memberships m
    where m.tenant_id = organizations.id and m.user_id = (select auth.uid()) and m.status = 'active'));
-- No INSERT/UPDATE/DELETE policies; provisioning and role changes are outside this delivery.
commit;
