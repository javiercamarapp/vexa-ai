-- Rollback revisable de 20261126000100. NO se ejecuta automáticamente.
-- Fuente anterior: pg_get_functiondef observado en proyecto-ejemplo,
-- 25-oct-2026. prosrc MD5 cae7466c4f8cf09c37e7028f6013aa70.
-- Solo admite la versión de soporte revisada; cualquier deriva aborta.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $rollback$
declare member record; helper record;
begin
 select p.*,l.lanname into member from pg_proc p join pg_language l on l.oid=p.prolang
 where p.oid=to_regprocedure('public.vexa_member(uuid,text[])');
 select p.*,l.lanname into helper from pg_proc p join pg_language l on l.oid=p.prolang
 where p.oid=to_regprocedure('public.vexa_support_active(uuid)');
 if member.oid is null or helper.oid is null
    or md5(member.prosrc) is distinct from '127d396d5dcefa3f2d954ddf146005bf'
    or member.lanname is distinct from 'plpgsql'
    or member.prosecdef is distinct from false or member.provolatile is distinct from 's'
    or member.proconfig is distinct from array['search_path=""']::text[]
    or md5(helper.prosrc) is distinct from '34a5e5cc2eccbf878a512a09cbed1702'
    or helper.lanname is distinct from 'sql'
    or helper.prosecdef is distinct from true or helper.provolatile is distinct from 's'
    or helper.proconfig is distinct from array['search_path=""']::text[] then
  raise exception 'SUPPORT_ROLLBACK_SOURCE_DRIFT';
 end if;
end
$rollback$;

-- Definición exacta devuelta por pg_get_functiondef, solo se añade el terminador.
CREATE OR REPLACE FUNCTION public.vexa_member(p_tenant uuid, p_roles text[] DEFAULT ARRAY['owner'::text, 'analyst'::text, 'operator'::text, 'viewer'::text])
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.memberships m where m.tenant_id=p_tenant
 and m.user_id=(select public.vexa_request_uid()) and m.status='active' and m.role=any(p_roles))
$function$;

-- Primero se retira la dependencia desde vexa_member; nunca CASCADE.
drop function public.vexa_support_active(uuid) restrict;

do $verify$
begin
 if (select md5(prosrc) from pg_proc where oid='public.vexa_member(uuid,text[])'::regprocedure)
    is distinct from 'cae7466c4f8cf09c37e7028f6013aa70'
    or to_regprocedure('public.vexa_support_active(uuid)') is not null then
  raise exception 'SUPPORT_ROLLBACK_VERIFY_FAILED';
 end if;
end
$verify$;
commit;
