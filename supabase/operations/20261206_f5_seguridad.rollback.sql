-- Reversión de las migraciones de F5-seguridad (20261206*). Ejecutar en orden inverso. Cada bloque es independiente.
-- 20261206000000_platform_mfa_in_database
begin;
drop function if exists public.platform_manage(jsonb);
alter function vexa_platform.platform_manage_core(jsonb) set schema public;
alter function public.platform_manage_core(jsonb) rename to platform_manage;
grant execute on function public.platform_manage(jsonb) to authenticated;
create or replace function vexa_platform.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
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
drop function if exists vexa_platform.require_admin_aal1();
commit;

-- 20261206000100_email_auth_per_ip_hourly_cap (restaura el tope horario global por correo)
begin;
create or replace function public.email_auth_admit(p_ip_hash text,p_email_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); n_min int; n_hour int; oldest timestamptz;
begin
 if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' or (p_ip_hash is not null and p_ip_hash !~ '^[a-f0-9]{64}$') then
  raise exception using errcode='22023',message='email_auth_input_invalid';
 end if;
 delete from public.email_auth_events where id in(select id from public.email_auth_events where at<t-interval '1 hour' order by at limit 500);
 perform pg_advisory_xact_lock(hashtextextended('email-auth:'||coalesce(p_ip_hash,'-'),0));
 perform pg_advisory_xact_lock(hashtextextended('email-auth:'||p_email_hash,0));
 if p_ip_hash is not null then
  select count(*) filter(where at>t-interval '1 minute'),count(*),min(at) filter(where at>t-interval '1 minute') into n_min,n_hour,oldest from public.email_auth_events where scope='ip' and key_hash=p_ip_hash and at>t-interval '1 hour';
  if n_min>=10 then return jsonb_build_object('verdict','ip_limited','retry_after',greatest(1,ceil(extract(epoch from (oldest+interval '1 minute'-t)))::int)); end if;
  if n_hour>=60 then return jsonb_build_object('verdict','ip_limited','retry_after',300); end if;
 end if;
 select count(*) filter(where at>t-interval '1 minute'),count(*) into n_min,n_hour from public.email_auth_events where scope='email' and key_hash=p_email_hash and at>t-interval '1 hour';
 if n_min>=1 or n_hour>=6 then return jsonb_build_object('verdict','duplicate','retry_after',60); end if;
 insert into public.email_auth_events(scope,key_hash) values('email',p_email_hash);
 if p_ip_hash is not null then insert into public.email_auth_events(scope,key_hash) values('ip',p_ip_hash); end if;
 return jsonb_build_object('verdict','ok','retry_after',0);
end $$;
alter table public.email_auth_events drop column if exists ip_hash;
commit;

-- 20261206000300_team_authority_and_owner_mfa (restaura team_manage_core y platform_team_manage anteriores; elimina la opción de MFA de propietarios)
begin;
create or replace function vexa_platform.team_manage_core(p_tenant uuid,p_input jsonb,p_platform boolean) returns jsonb
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
create or replace function public.platform_team_manage(p_tenant uuid,p_input jsonb) returns jsonb
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
 if op='list' then
  -- Lectura de correos de otra organización: se registra ANTES de leer. Si la bitácora falla, no se lee.
  insert into vexa_platform.audit(actor_id,operation,tenant_id,request_id,details) values(u,'team_list',p_tenant,gen_random_uuid(),jsonb_build_object('kind',coalesce(p_input->>'kind','members'),'paged',p_input ? 'cursor'));
 end if;
 result:=vexa_platform.team_manage_core(p_tenant,p_input,true);
 if p_input->>'operation'<>'list' then
  insert into vexa_platform.audit(actor_id,operation,tenant_id,target_id) values(u,'team_'||(p_input->>'operation'),p_tenant,coalesce(nullif(p_input->>'id','')::uuid,nullif(result->>'id','')::uuid));
 end if;
 return result;
end $$;
drop function if exists public.org_security(uuid,jsonb);
drop function if exists public.owner_mfa_required(uuid);
drop table if exists public.organization_security;
commit;
