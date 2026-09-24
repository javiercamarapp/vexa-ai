begin;
create table public.team_invitations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id),
 request_id uuid not null, email text not null check(email=lower(btrim(email)) and length(email) between 3 and 254),
 role text not null check(role in ('owner','analyst','operator','viewer')),
 status text not null default 'pending' check(status in ('pending','accepted','cancelled','expired')),
 delivery text not null default 'not_started' check(delivery in ('not_started','sending','sent','uncertain','failed')),
 created_by uuid not null references auth.users(id), accepted_by uuid references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null, accepted_at timestamptz,
 version integer not null default 1, unique(tenant_id,request_id), check(expires_at>created_at)
);
create unique index team_one_pending on public.team_invitations(tenant_id,email) where status='pending';
create table public.team_audit (
 id bigint generated always as identity primary key,tenant_id uuid not null references public.organizations(id),
 actor_id uuid not null,operation text not null,target_id uuid not null,before_value jsonb,after_value jsonb,created_at timestamptz not null default now()
);
alter table public.team_invitations enable row level security;
alter table public.team_invitations force row level security;
alter table public.team_audit enable row level security;
alter table public.team_audit force row level security;
revoke all on public.team_invitations,public.team_audit from public,anon,authenticated;
-- Sole public entrypoint. Verified JWT subject and authoritative Auth email are checked in SQL.
create function public.team_manage(p_tenant uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op text:=p_input->>'operation'; m public.memberships; i public.team_invitations;
 target public.memberships; email_value text; wanted_role text; result jsonb; cursor_value uuid; changed jsonb;
begin
 if u is null then raise exception using errcode='42501',message='team_authentication_required'; end if;
 if jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4096 then raise exception using errcode='22023',message='team_input_invalid';end if;
 if op in ('inspect','accept') then
  select * into i from public.team_invitations where id=(p_input->>'id')::uuid;
  if not found then raise exception using errcode='42501',message='team_invitation_unavailable';end if;
  p_tenant:=i.tenant_id;
 end if;
 if p_tenant is null then raise exception using errcode='42501',message='team_organization_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('team:'||p_tenant::text,0));
 if op in ('inspect','accept') then
  select * into i from public.team_invitations where id=(p_input->>'id')::uuid for update;
  select lower(btrim(email)) into email_value from auth.users where id=u and email_confirmed_at is not null and deleted_at is null;
  if email_value is null or email_value<>i.email then raise exception using errcode='42501',message='team_invitation_unavailable';end if;
  if i.status='accepted' and i.accepted_by=u then
   select * into target from public.memberships where tenant_id=i.tenant_id and user_id=u;
   if target.status<>'active' or target.user_id is null then raise exception using errcode='42501',message='team_invitation_unavailable';end if;
   return jsonb_build_object('id',i.id,'status','accepted','tenantId',i.tenant_id,'role',target.role);
  end if;
  if i.status<>'pending' or i.expires_at<=clock_timestamp() then raise exception using errcode='42501',message='team_invitation_unavailable';end if;
  if op='inspect' then return jsonb_build_object('id',i.id,'status',i.status,'role',i.role,'expiresAt',i.expires_at,'organization',(select name from public.organizations where id=i.tenant_id));end if;
  select * into target from public.memberships where tenant_id=i.tenant_id and user_id=u for update;
  -- Invitation cannot silently change authority of an already active member.
  if target.status='active' then raise exception using errcode='P0001',message='team_member_already_active';end if;
  insert into public.memberships(tenant_id,user_id,role,status) values(i.tenant_id,u,i.role,'active')
  on conflict(tenant_id,user_id) do update set role=excluded.role,status='active',permissions_version=public.memberships.permissions_version+1;
  update public.team_invitations set status='accepted',accepted_by=u,accepted_at=clock_timestamp(),version=version+1 where id=i.id;
  insert into public.team_audit(tenant_id,actor_id,operation,target_id,before_value,after_value) values(i.tenant_id,u,'accept',i.id,to_jsonb(target),jsonb_build_object('role',i.role,'status','active'));
  return jsonb_build_object('id',i.id,'status','accepted','tenantId',i.tenant_id,'role',i.role);
 end if;
 select * into m from public.memberships where tenant_id=p_tenant and user_id=u for update;
 if m.status is distinct from 'active' or m.role is distinct from 'owner' then raise exception using errcode='42501',message='team_owner_required';end if;
 update public.team_invitations set status='expired',version=version+1 where tenant_id=p_tenant and status='pending' and expires_at<=clock_timestamp();
 if op='list' then
  cursor_value:=nullif(p_input->>'cursor','')::uuid;
  if coalesce(p_input->>'kind','members')='members' then
   select coalesce(jsonb_agg(row_value order by id),'[]') into result from (
    select mm.user_id id,jsonb_build_object('id',mm.user_id,'email',au.email,'role',mm.role,'status',mm.status,'version',mm.permissions_version) row_value
    from public.memberships mm join auth.users au on au.id=mm.user_id where mm.tenant_id=p_tenant and (cursor_value is null or mm.user_id>cursor_value) order by mm.user_id limit 26
   ) q;
  else
   select coalesce(jsonb_agg(row_value order by id),'[]') into result from (
    select ti.id,jsonb_build_object('id',ti.id,'email',ti.email,'role',ti.role,'status',ti.status,'delivery',ti.delivery,'expiresAt',ti.expires_at,'version',ti.version) row_value
    from public.team_invitations ti where ti.tenant_id=p_tenant and ti.status='pending' and (cursor_value is null or ti.id>cursor_value) order by ti.id limit 26
   ) q;
  end if;
  return jsonb_build_object('items',case when jsonb_array_length(result)>25 then result-25 else result end,'nextCursor',case when jsonb_array_length(result)>25 then result->24->>'id' else null end);
 elsif op='invite' then
  email_value:=lower(btrim(p_input->>'email'));wanted_role:=p_input->>'role';
  if email_value is null or email_value!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(email_value)>254 or wanted_role is null or wanted_role not in ('owner','analyst','operator','viewer') or (p_input->>'confirmed') is distinct from 'true' then raise exception using errcode='22023',message='team_input_invalid';end if;
  select * into i from public.team_invitations where tenant_id=p_tenant and request_id=(p_input->>'requestId')::uuid;
  if found then
   if i.email<>email_value or i.role<>wanted_role then raise exception using errcode='P0001',message='team_request_conflict';end if;
   return jsonb_build_object('id',i.id,'status',i.status,'delivery',i.delivery,'replay',true);
  end if;
  if exists(select 1 from public.memberships mm join auth.users au on au.id=mm.user_id where mm.tenant_id=p_tenant and mm.status='active' and lower(au.email)=email_value) then raise exception using errcode='P0001',message='team_member_already_active';end if;
  if exists(select 1 from public.team_invitations where tenant_id=p_tenant and email=email_value and status='pending') then raise exception using errcode='P0001',message='team_invitation_pending';end if;
  insert into public.team_invitations(tenant_id,request_id,email,role,created_by,expires_at) values(p_tenant,(p_input->>'requestId')::uuid,email_value,wanted_role,u,clock_timestamp()+interval '7 days') returning * into i;
  insert into public.team_audit(tenant_id,actor_id,operation,target_id,after_value) values(p_tenant,u,'invite',i.id,jsonb_build_object('role',i.role));
  return jsonb_build_object('id',i.id,'status',i.status,'delivery',i.delivery,'replay',false);
 elsif op in ('claim','receipt','cancel') then
  select * into i from public.team_invitations where tenant_id=p_tenant and id=(p_input->>'id')::uuid for update;
  if not found then raise exception using errcode='42501',message='team_invitation_unavailable';end if;
  if op='claim' then
   if i.status<>'pending' or i.delivery<>'not_started' then return jsonb_build_object('claimed',false);end if;
   update public.team_invitations set delivery='sending',version=version+1 where id=i.id;
   return jsonb_build_object('claimed',true,'email',i.email,'id',i.id);
  elsif op='receipt' then
   if i.delivery='sending' and p_input->>'delivery' in ('sent','failed','uncertain') then update public.team_invitations set delivery=p_input->>'delivery',version=version+1 where id=i.id;end if;
   return jsonb_build_object('recorded',true);
  else
   if i.version is distinct from (p_input->>'version')::int or i.status<>'pending' then raise exception using errcode='P0001',message='team_version_conflict';end if;
   update public.team_invitations set status='cancelled',version=version+1 where id=i.id;
   insert into public.team_audit(tenant_id,actor_id,operation,target_id) values(p_tenant,u,'cancel',i.id);
   return jsonb_build_object('cancelled',true);
  end if;
 elsif op in ('role','revoke') then
  select * into target from public.memberships where tenant_id=p_tenant and user_id=(p_input->>'id')::uuid for update;
  if not found or target.permissions_version is distinct from (p_input->>'version')::int or target.status<>'active' then raise exception using errcode='P0001',message='team_version_conflict';end if;
  wanted_role:=case when op='role' then p_input->>'role' else target.role end;
  if wanted_role is null or wanted_role is null or wanted_role not in ('owner','analyst','operator','viewer') then raise exception using errcode='22023',message='team_input_invalid';end if;
  if target.role='owner' and (op='revoke' or wanted_role<>'owner') and (select count(*) from public.memberships where tenant_id=p_tenant and role='owner' and status='active')<2 then raise exception using errcode='P0001',message='team_last_owner';end if;
  update public.memberships set role=wanted_role,status=case when op='revoke' then 'revoked' else 'active' end,permissions_version=permissions_version+1 where tenant_id=p_tenant and user_id=target.user_id returning to_jsonb(memberships.*) into changed;
  if op='revoke' then update public.team_invitations set status='cancelled',version=version+1 where tenant_id=p_tenant and status='pending' and email=(select lower(email) from auth.users where id=target.user_id);end if;
  insert into public.team_audit(tenant_id,actor_id,operation,target_id,before_value,after_value) values(p_tenant,u,op,target.user_id,to_jsonb(target),changed);
  return jsonb_build_object('updated',true);
 end if;
 raise exception using errcode='22023',message='team_input_invalid';
end $$;
revoke all on function public.team_manage(uuid,jsonb) from public,anon;
grant execute on function public.team_manage(uuid,jsonb) to authenticated;
commit;
