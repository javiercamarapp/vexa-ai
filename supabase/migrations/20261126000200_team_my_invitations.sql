-- SUPERADMIN (24-oct-2026). PROPUESTA ESCRITA, NO APLICADA: la aplica el dueño.
-- Pantalla /sin-acceso: invitaciones del PROPIO correo confirmado de quien llama. Solo lectura; nunca devuelve filas de otro correo ni correos de terceros.
-- Aceptar sigue siendo team_manage op 'accept' (valida correo, vigencia y membresía activa).
begin;
create function public.team_my_invitations() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); e text;
begin
 if u is null then raise exception using errcode='42501',message='team_authentication_required';end if;
 select lower(btrim(au.email)) into e from auth.users au where au.id=u and au.email_confirmed_at is not null and au.deleted_at is null;
 if e is null then return jsonb_build_object('pending','[]'::jsonb,'expired','[]'::jsonb);end if;
 return jsonb_build_object(
  'pending',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'organization',x.name,'role',x.role,'expiresAt',x.expires_at) order by x.expires_at) from (
    select i.id,o.name,i.role,i.expires_at from public.team_invitations i join public.organizations o on o.id=i.tenant_id
    where i.email=e and i.status='pending' and i.expires_at>clock_timestamp() order by i.expires_at limit 10) x),'[]'::jsonb),
  'expired',coalesce((select jsonb_agg(jsonb_build_object('organization',x.name,'role',x.role,'expiredAt',x.expires_at) order by x.expires_at desc) from (
    select o.name,i.role,i.expires_at from public.team_invitations i join public.organizations o on o.id=i.tenant_id
    where i.email=e and i.status in('pending','expired') and i.expires_at<=clock_timestamp() and i.expires_at>clock_timestamp()-interval '60 days' order by i.expires_at desc limit 5) x),'[]'::jsonb));
end $$;
revoke all on function public.team_my_invitations() from public,anon;
grant execute on function public.team_my_invitations() to authenticated;
commit;
