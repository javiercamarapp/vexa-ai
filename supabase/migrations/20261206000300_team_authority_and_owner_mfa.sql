-- Autoridad del equipo (cierre F5, 29-oct): R2-09 (invitaciones tras revocar), R2-02 (la plataforma y el rol de propietario) y MFA opcional de propietarios por organización.
--  R2-09  Antes: al revocar a un propietario sus invitaciones pendientes (p. ej. a otro como propietario) seguían vivas y se podían aceptar. Ahora: revocar o degradar a quien las creó las cancela
--         en el mismo paso, y al aceptar se exige que el autor siga siendo propietario activo (si fue miembro alguna vez).
--  R2-02  Antes: un administrador de plataforma podía invitar o nombrar propietarios sin más. Ahora exige sesión de soporte vigente en esa organización, motivo (10 a 500 caracteres) y segundo factor
--         (mfa_satisfied: depende del interruptor de plataforma). El motivo queda en team_audit (visible a los propietarios) y en la bitácora de plataforma.
--  MFA    Tabla organization_security (require_owner_mfa, APAGADA por defecto). Con ella encendida, invitar, cambiar rol, revocar y cancelar invitaciones exigen AAL2 en la base; los propietarios
--         encienden y apagan la opción con public.org_security (también exige AAL2 y al menos dos propietarios activos para que nadie quede fuera). NO enciende nada.
-- Reversión: ver supabase/operations/20261206_f5_seguridad.rollback.sql
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';
create table public.organization_security(
 tenant_id uuid primary key references public.organizations(id) on delete cascade,
 require_owner_mfa boolean not null default false,
 updated_by uuid, updated_at timestamptz not null default clock_timestamp()
);
alter table public.organization_security enable row level security;
alter table public.organization_security force row level security;
revoke all on public.organization_security from public,anon,authenticated,service_role,vexa_backend;
create function public.owner_mfa_required(p_tenant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select require_owner_mfa from public.organization_security where tenant_id=p_tenant),false)
$$;
revoke all on function public.owner_mfa_required(uuid) from public,anon,authenticated,service_role;
grant execute on function public.owner_mfa_required(uuid) to vexa_backend;
-- Estado y cambio de la opción. Solo propietarios activos. get: lectura (AAL1 basta). set: exige AAL2 (también para apagarla) y al menos 2 propietarios activos.
create function public.org_security(p_tenant uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); op text:=p_input->>'operation'; owners int; sin_factor int; actual boolean; quiere boolean;
begin
 if u is null then raise exception using errcode='42501',message='team_authentication_required';end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>512 or p_tenant is null then raise exception using errcode='22023',message='team_input_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended('team:'||p_tenant::text,0));
 if not exists(select 1 from public.memberships where tenant_id=p_tenant and user_id=u and status='active' and role='owner') then raise exception using errcode='42501',message='team_owner_required';end if;
 select count(*),count(*) filter(where not exists(select 1 from auth.mfa_factors f where f.user_id=mm.user_id and f.status='verified')) into owners,sin_factor
 from public.memberships mm where mm.tenant_id=p_tenant and mm.status='active' and mm.role='owner';
 actual:=public.owner_mfa_required(p_tenant);
 if op='get' and (p_input-'operation')='{}'::jsonb then
  return jsonb_build_object('requireOwnerMfa',actual,'activeOwners',owners,'ownersWithoutFactor',sin_factor,'aal',coalesce(auth.jwt()->>'aal','aal1'));
 elsif op='set' and (p_input-array['operation','enabled','confirmed'])='{}'::jsonb and jsonb_typeof(p_input->'enabled')='boolean' and p_input->'confirmed' is not distinct from 'true'::jsonb then
  quiere:=(p_input->>'enabled')::boolean;
  if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception using errcode='42501',message='owner_mfa_required';end if;
  if quiere and owners<2 then raise exception using errcode='P0001',message='owner_mfa_needs_second_owner';end if;
  if quiere is distinct from actual then
   insert into public.organization_security(tenant_id,require_owner_mfa,updated_by,updated_at) values(p_tenant,quiere,u,clock_timestamp())
   on conflict(tenant_id) do update set require_owner_mfa=excluded.require_owner_mfa,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
   insert into public.team_audit(tenant_id,actor_id,operation,target_id,before_value,after_value) values(p_tenant,u,case when quiere then 'owner_mfa_on' else 'owner_mfa_off' end,u,jsonb_build_object('requireOwnerMfa',actual),jsonb_build_object('requireOwnerMfa',quiere,'ownersWithoutFactor',sin_factor));
  end if;
  return jsonb_build_object('requireOwnerMfa',quiere,'activeOwners',owners,'ownersWithoutFactor',sin_factor,'changed',quiere is distinct from actual);
 end if;
 raise exception using errcode='22023',message='team_input_invalid';
end $$;
revoke all on function public.org_security(uuid,jsonb) from public,anon;
grant execute on function public.org_security(uuid,jsonb) to authenticated;

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
  -- R2-09: una invitación solo vale mientras quien la creó siga siendo propietario activo de la organización (si fue miembro alguna vez; las de plataforma no tienen membresía).
  if exists(select 1 from public.memberships mm where mm.tenant_id=i.tenant_id and mm.user_id=i.created_by)
   and not exists(select 1 from public.memberships mm where mm.tenant_id=i.tenant_id and mm.user_id=i.created_by and mm.status='active' and mm.role='owner') then
   update public.team_invitations set status='cancelled',version=version+1 where id=i.id;
   raise exception using errcode='42501',message='team_invitation_unavailable';
  end if;
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
  -- R2-02: la plataforma no concede el rol de propietario como rutina. Exige una sesión de soporte vigente en ESA organización, un motivo (10 a 500 caracteres) y segundo factor (si el interruptor está activo).
  if (op='invite' and p_input->>'role'='owner') or (op='role' and p_input->>'role'='owner') then
   if not exists(select 1 from vexa_platform.support_sessions ss where ss.admin_id=u and ss.tenant_id=p_tenant and ss.ended_at is null and ss.expires_at>clock_timestamp()) then raise exception using errcode='42501',message='platform_owner_grant_requires_support';end if;
   if char_length(coalesce(btrim(p_input->>'reason'),'')) not between 10 and 500 then raise exception using errcode='22023',message='team_input_invalid';end if;
   if not vexa_platform.mfa_satisfied() then raise exception using errcode='42501',message='platform_mfa_required';end if;
  end if;
 else
  if m.status is distinct from 'active' or m.role is distinct from 'owner' then raise exception using errcode='42501',message='team_owner_required';end if;
  -- Opción por organización: con require_owner_mfa activo, las acciones del propietario con efecto fuerte exigen AAL2 en la propia base.
  if op in ('invite','role','revoke','cancel') and public.owner_mfa_required(p_tenant) and coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception using errcode='42501',message='owner_mfa_required';end if;
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
  insert into public.team_audit(tenant_id,actor_id,operation,target_id,after_value) values(p_tenant,u,'invite',i.id,jsonb_build_object('role',i.role)||case when p_platform and i.role='owner' then jsonb_build_object('platform',true,'reason',btrim(p_input->>'reason')) else '{}'::jsonb end);
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
  -- R2-09: al revocar o degradar a quien creó invitaciones pendientes, esas invitaciones se cancelan (antes seguían vivas y concedían rol aunque su autor ya no tuviera autoridad). Las dirigidas a la persona revocada también.
  if op='revoke' then update public.team_invitations set status='cancelled',version=version+1 where tenant_id=p_tenant and status='pending' and (created_by=target.user_id or email=(select lower(email) from auth.users where id=target.user_id));
  elsif target.role='owner' and wanted_role<>'owner' then update public.team_invitations set status='cancelled',version=version+1 where tenant_id=p_tenant and status='pending' and created_by=target.user_id;end if;
  insert into public.team_audit(tenant_id,actor_id,operation,target_id,before_value,after_value) values(p_tenant,u,op,target.user_id,to_jsonb(target),changed||case when p_platform and wanted_role='owner' and op='role' then jsonb_build_object('platform',true,'reason',btrim(p_input->>'reason')) else '{}'::jsonb end);
  return jsonb_build_object('updated',true);
 end if;
 raise exception using errcode='22023',message='team_input_invalid';
end $$;

-- R2-02: platform_team_manage admite el campo `reason` en invite y role (se exige solo al conceder propietario).
create or replace function public.platform_team_manage(p_tenant uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); result jsonb; op text:=p_input->>'operation'; allowed text[];
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4096 then raise exception using errcode='22023',message='team_input_invalid';end if;
 allowed:=case op
  when 'list' then array['operation','kind','cursor'] when 'invite' then array['operation','email','role','requestId','confirmed','reason']
  when 'role' then array['operation','id','version','role','reason'] when 'revoke' then array['operation','id','version']
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


revoke all on function public.platform_team_manage(uuid,jsonb) from public,anon;
grant execute on function public.platform_team_manage(uuid,jsonb) to authenticated;
commit;
