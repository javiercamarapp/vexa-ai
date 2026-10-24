-- SUPERADMIN (24-oct-2026). PROPUESTA ESCRITA, NO APLICADA. NO APLICAR sin el inventario de abajo.
-- Rama de LECTURA para «ver como»: vexa_member(p_tenant,p_roles) acepta ademas una sesion de soporte vigente (vexa_platform.support_sessions) SOLO si:
--   * la conexion es la del servidor (SET LOCAL ROLE vexa_backend + vexa.action='read' + vexa.tenant_id = p_tenant), es decir la transaccion BEGIN READ ONLY de createDatabase;
--   * p_roles incluye 'viewer' (las politicas de escritura/administracion piden owner/analyst/operator y NO la pasan).
-- El cliente PostgREST con el JWT del administrador (sin vexa.action) NO obtiene nada: falla cerrado.
-- Requiere 20261125000000 aplicada antes.
--
-- INVENTARIO OBLIGATORIO ANTES DE APLICAR (no se pudo correr aqui: no hay base ligada):
--   1) select polname, polcmd, pg_get_expr(polqual,polrelid) from pg_policy where pg_get_expr(polqual,polrelid) ~ 'memberships';
--      -> toda politica que lea public.memberships DIRECTO (42 migraciones) NO pasa por vexa_member y por tanto NO vera la rama de soporte (esas tablas se veran vacias en modo soporte: falla cerrada, aceptable, pero hay que saberlo).
--   2) select polname, polcmd from pg_policy where pg_get_expr(polqual,polrelid) ~ 'vexa_member\(' and polcmd in ('a','w','d','*');
--      -> toda politica de ESCRITURA que llame vexa_member(t) con roles por defecto (incluye viewer) quedaria abierta a soporte; la transaccion READ ONLY lo bloquea,
--         pero conviene cambiarla a roles explicitos antes de aplicar.
--   3) Probar con dos organizaciones: administrador con sesion en A lee A, no lee B, no escribe en A, y tras end/expiracion no lee A.
begin;

create function public.vexa_support_active(p_tenant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(
  current_setting('vexa.action',true)='read'
  and p_tenant is not null and p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid
  and exists(select 1 from vexa_platform.support_sessions s
   where s.admin_id=public.vexa_request_uid() and s.tenant_id=p_tenant and s.mode='read' and s.ended_at is null and s.expires_at>clock_timestamp())
  and exists(select 1 from vexa_platform.administrators a where a.user_id=public.vexa_request_uid() and a.active),false)
$$;
revoke all on function public.vexa_support_active(uuid) from public,anon,authenticated;
grant execute on function public.vexa_support_active(uuid) to vexa_backend;

do $migration$
declare src text;
begin
 select p.prosrc into strict src from pg_proc p where p.oid='public.vexa_member(uuid,text[])'::regprocedure;
 -- Falla si la funcion cambio respecto a 20261004061000 (deriva): no se sobrescribe a ciegas.
 if regexp_replace(src,'\s+',' ','g') is distinct from ' BEGIN RETURN exists(select 1 from public.memberships m where m.tenant_id=p_tenant and m.user_id=(select public.vexa_request_uid()) and m.status=''active'' and m.role=any(p_roles)); END; ' then
  raise exception 'VEXA_MEMBER_SOURCE_DRIFT';
 end if;
end
$migration$;

create or replace function public.vexa_member(p_tenant uuid, p_roles text[] default array['owner'::text,'analyst'::text,'operator'::text,'viewer'::text])
returns boolean language plpgsql stable set search_path to '' as $function$
begin return exists(select 1 from public.memberships m where m.tenant_id=p_tenant
 and m.user_id=(select public.vexa_request_uid()) and m.status='active' and m.role=any(p_roles))
 or ('viewer'=any(p_roles) and public.vexa_support_active(p_tenant)); end;
$function$;

commit;
