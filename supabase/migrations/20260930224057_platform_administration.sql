begin;
-- Administrative grants are separate from memberships. No business RLS policy changes.
create schema vexa_platform;
revoke all on schema vexa_platform from public,anon,authenticated;
create table vexa_platform.administrators (
 user_id uuid primary key references auth.users(id), active boolean not null default true,
 version bigint not null default 1 check(version>0), created_at timestamptz not null default now()
);
create table vexa_platform.audit (
 id bigint generated always as identity primary key, actor_id uuid not null,
 operation text not null, tenant_id uuid, target_id uuid, request_id uuid,
 details jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(actor_id,request_id)
);
alter table vexa_platform.administrators enable row level security;
alter table vexa_platform.administrators force row level security;
alter table vexa_platform.audit enable row level security;
alter table vexa_platform.audit force row level security;
revoke all on all tables in schema vexa_platform from public,anon,authenticated;
revoke all on all sequences in schema vexa_platform from public,anon,authenticated;
-- Fresh authoritative grant and live Auth session. JWT metadata is never authority.
create function vexa_platform.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); sid text:=auth.jwt()->>'session_id';
begin
 if u is null or sid is null or sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception using errcode='42501',message='platform_access_denied';end if;
 perform 1 from vexa_platform.administrators where user_id=u and active for share;
 if not found then raise exception using errcode='42501',message='platform_access_denied';end if;
 perform 1 from auth.users au join auth.sessions s on s.user_id=au.id
 where au.id=u and au.email_confirmed_at is not null and au.deleted_at is null
 and (au.banned_until is null or au.banned_until<=clock_timestamp())
 and s.id=sid::uuid and (s.not_after is null or s.not_after>clock_timestamp());
 if not found then raise exception using errcode='42501',message='platform_access_denied';end if;
 return u;
end $$;
create function public.platform_manage(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); op text:=p_input->>'operation'; result jsonb; tid uuid; owner_id uuid; rid uuid; previous vexa_platform.audit; c uuid; ac bigint; nm text; em text;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4096 then raise exception using errcode='22023',message='platform_input_invalid';end if;
 if op='status' and (p_input-'operation')='{}'::jsonb then return jsonb_build_object('administrator',true);end if;
 if op='list' and (p_input-array['operation','cursor'])='{}'::jsonb then
  c:=nullif(p_input->>'cursor','')::uuid;
  select coalesce(jsonb_agg(item order by id),'[]') into result from (
   select o.id,jsonb_build_object('id',o.id,'name',o.name,'createdAt',o.created_at) item from public.organizations o where c is null or o.id>c order by o.id limit 26
  )q;
  return jsonb_build_object('items',case when jsonb_array_length(result)>25 then result-25 else result end,'nextCursor',case when jsonb_array_length(result)>25 then result->24->>'id' else null end);
 elsif op='create' and (p_input-array['operation','name','ownerEmail','requestId','confirmed'])='{}'::jsonb then
  nm:=btrim(p_input->>'name');em:=lower(btrim(p_input->>'ownerEmail'));rid:=(p_input->>'requestId')::uuid;
  if jsonb_typeof(p_input->'name') is distinct from 'string' or jsonb_typeof(p_input->'ownerEmail') is distinct from 'string' or jsonb_typeof(p_input->'requestId') is distinct from 'string' or nm is null or length(nm) not between 1 and 200 or em is null or length(em)>254 or em!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or rid is null or p_input->'confirmed' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='platform_input_invalid';end if;
  perform pg_advisory_xact_lock(hashtextextended('platform-create:'||u::text||rid::text,0));
  select * into previous from vexa_platform.audit where actor_id=u and request_id=rid;
  if found then
   if previous.details<>jsonb_build_object('name',nm,'ownerEmail',em) then raise exception using errcode='P0001',message='platform_request_conflict';end if;
   return jsonb_build_object('id',previous.tenant_id,'replay',true);
  end if;
  select au.id into owner_id from auth.users au where lower(btrim(au.email))=em and au.email_confirmed_at is not null and au.deleted_at is null and (au.banned_until is null or au.banned_until<=clock_timestamp());
  if owner_id is null or (select count(*) from auth.users where lower(btrim(email))=em and deleted_at is null)<>1 then raise exception using errcode='22023',message='platform_owner_unavailable';end if;
  if owner_id=u then raise exception using errcode='42501',message='platform_self_change_forbidden';end if;
  insert into public.organizations(name) values(nm) returning id into tid;
  insert into public.memberships(tenant_id,user_id,role,status) values(tid,owner_id,'owner','active');
  insert into vexa_platform.audit(actor_id,operation,tenant_id,target_id,request_id,details) values(u,'create',tid,owner_id,rid,jsonb_build_object('name',nm,'ownerEmail',em));
  return jsonb_build_object('id',tid,'replay',false);
 elsif op='audit' and (p_input-array['operation','cursor'])='{}'::jsonb then
  ac:=nullif(p_input->>'cursor','')::bigint;
  select coalesce(jsonb_agg(item order by id desc),'[]') into result from (
   select a.id,jsonb_build_object('id',a.id::text,'actorId',a.actor_id,'operation',a.operation,'tenantId',a.tenant_id,'targetId',a.target_id,'createdAt',a.created_at) item from vexa_platform.audit a where ac is null or a.id<ac order by a.id desc limit 26
  )q;
  return jsonb_build_object('items',case when jsonb_array_length(result)>25 then result-25 else result end,'nextCursor',case when jsonb_array_length(result)>25 then result->24->>'id' else null end);
 end if;
 raise exception using errcode='22023',message='platform_input_invalid';
end $$;
create function vexa_platform.team_manage_core(p_tenant uuid,p_input jsonb,p_platform boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op text:=p_input->>'operation'; m public.memberships; i public.team_invitations;
 target public.memberships; email_value text; wanted_role text; result jsonb; cursor_value uuid; changed jsonb;
begin
 if p_platform and (op is null or op not in ('list','invite','role','revoke','claim','receipt','cancel')) then raise exception using errcode='22023',message='team_input_invalid';end if;
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
 if p_platform then
  perform vexa_platform.require_admin();
  if op in ('role','revoke') and (p_input->>'id')::uuid=u then raise exception using errcode='42501',message='team_self_change_forbidden';end if;
  if op='invite' and lower(btrim(p_input->>'email'))=(select lower(btrim(email)) from auth.users where id=u) then raise exception using errcode='42501',message='team_self_change_forbidden';end if;
  if op in ('claim','receipt','cancel') and exists(select 1 from public.team_invitations where id=(p_input->>'id')::uuid and tenant_id=p_tenant and email=(select lower(btrim(email)) from auth.users where id=u)) then raise exception using errcode='42501',message='team_self_change_forbidden';end if;
 else
  if m.status is distinct from 'active' or m.role is distinct from 'owner' then raise exception using errcode='42501',message='team_owner_required';end if;
 end if;
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

-- Original owner/invitation entrypoint retains its existing authorization contract.
create or replace function public.team_manage(p_tenant uuid,p_input jsonb) returns jsonb
language sql security definer set search_path='' as $$ select vexa_platform.team_manage_core(p_tenant,p_input,false) $$;
create function public.platform_team_manage(p_tenant uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); result jsonb; op text:=p_input->>'operation'; allowed text[];
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4096 then raise exception using errcode='22023',message='team_input_invalid';end if;
 allowed:=case op
  when 'list' then array['operation','kind','cursor'] when 'invite' then array['operation','email','role','requestId','confirmed']
  when 'role' then array['operation','id','version','role'] when 'revoke' then array['operation','id','version']
  when 'cancel' then array['operation','id','version'] when 'claim' then array['operation','id'] when 'receipt' then array['operation','id','delivery'] end;
 if allowed is null or p_input-allowed<>'{}'::jsonb or (op='list' and coalesce(p_input->>'kind','members') not in ('members','invitations')) or (op='invite' and p_input->'confirmed' is distinct from 'true'::jsonb) then raise exception using errcode='22023',message='team_input_invalid';end if;
 if p_tenant is null or not exists(select 1 from public.organizations where id=p_tenant) then raise exception using errcode='42501',message='platform_access_denied';end if;
 result:=vexa_platform.team_manage_core(p_tenant,p_input,true);
 if p_input->>'operation'<>'list' then
  insert into vexa_platform.audit(actor_id,operation,tenant_id,target_id) values(u,'team_'||(p_input->>'operation'),p_tenant,coalesce(nullif(p_input->>'id','')::uuid,nullif(result->>'id','')::uuid));
 end if;
 return result;
end $$;
revoke all on all functions in schema vexa_platform from public,anon,authenticated;
revoke all on function public.platform_manage(jsonb),public.platform_team_manage(uuid,jsonb) from public,anon;
grant execute on function public.platform_manage(jsonb),public.platform_team_manage(uuid,jsonb) to authenticated;
commit;
