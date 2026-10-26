-- Fuente SQL observada en produccion, sin consultar datos de clientes.
create or replace function public.vexa_member(p_tenant uuid, p_roles text[] default array['owner'::text,'analyst'::text,'operator'::text,'viewer'::text]) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.memberships m where m.tenant_id=p_tenant
 and m.user_id=(select public.vexa_request_uid()) and m.status='active' and m.role=any(p_roles))
$$;
