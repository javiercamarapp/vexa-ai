-- Normal members must not require EXECUTE on the server-only support helper.
-- SQL may check permissions on both operands of OR before evaluating either.
-- Preserve invoker security and existing ACLs; only vexa_backend may consult support.
begin;
set local lock_timeout='5s';

do $guard$
declare previous record;
begin
 select p.prosrc,p.prosecdef,p.provolatile,p.proconfig,l.lanname into strict previous
 from pg_proc p join pg_language l on l.oid=p.prolang
 where p.oid='public.vexa_member(uuid,text[])'::regprocedure;
 if md5(previous.prosrc)<>'127d396d5dcefa3f2d954ddf146005bf'
    or previous.prosecdef or previous.provolatile<>'s'
    or previous.proconfig is distinct from array['search_path=""']::text[]
    or previous.lanname<>'plpgsql' then
  raise exception 'VEXA_MEMBER_SOURCE_DRIFT';
 end if;
end
$guard$;

create or replace function public.vexa_member(p_tenant uuid, p_roles text[] default array['owner'::text,'analyst'::text,'operator'::text,'viewer'::text])
returns boolean language plpgsql stable security invoker set search_path to '' as $function$
begin
 if exists(select 1 from public.memberships m where m.tenant_id=p_tenant
   and m.user_id=(select public.vexa_request_uid()) and m.status='active' and m.role=any(p_roles)) then
  return true;
 end if;
 -- Keep this as a separate statement: authenticated/anon cannot call the helper,
 -- even with forged vexa.* settings or an active platform administrator account.
 if current_user <> 'vexa_backend' then
  return false;
 end if;
 if not coalesce('viewer'=any(p_roles),false) then
  return false;
 end if;
 return public.vexa_support_active(p_tenant);
end;
$function$;

commit;
