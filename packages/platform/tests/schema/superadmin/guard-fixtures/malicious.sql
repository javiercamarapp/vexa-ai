-- Mutante: bypass total de membresia debe abortar.
create or replace function public.vexa_member(p_tenant uuid, p_roles text[] default array['owner'::text,'analyst'::text,'operator'::text,'viewer'::text]) returns boolean language sql stable set search_path='' as $$ select true $$;
