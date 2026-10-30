-- R2-01 (auditoría run-2; cierre F5, 29-oct): la base exige AAL2 a los administradores de plataforma cuando vexa_platform.settings.mfa_required es verdadero.
-- Antes solo platform_support('start') comprobaba mfa_satisfied(); platform_manage, platform_observe, platform_org_detail, platform_security_events y platform_team_manage
-- (que abren con vexa_platform.require_admin()) funcionaban con una sesión AAL1 aunque el interruptor estuviera encendido.
-- Esta migración NO enciende el interruptor (sigue false): con él apagado nada cambia. Antes de encenderlo, los administradores deben enrolar su TOTP en /seguridad.
-- Diseño:
--   require_admin_aal1(): el cuerpo original de require_admin (grant fresco + sesión viva), sin MFA. Solo lo usan el estado «¿soy administrador?» y la propia /seguridad.
--   require_admin(): require_admin_aal1() + mfa_satisfied(); lanza platform_mfa_required (42501). Todas las operaciones de plataforma lo siguen usando.
--   public.platform_manage(): ahora es una envoltura. La operación `status` (la única que se consulta para decidir si llevar al administrador a /seguridad) usa require_admin_aal1,
--   así un administrador sin segundo factor puede seguir enrolando aunque el interruptor esté encendido (si no, se quedaría fuera sin remedio). Todo lo demás pasa a vexa_platform.platform_manage_core, que exige AAL2.
-- Reversión: ver supabase/operations/20261206_f5_seguridad.rollback.sql
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';
create function vexa_platform.require_admin_aal1() returns uuid language plpgsql security definer set search_path='' as $$
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
create or replace function vexa_platform.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin_aal1();
begin
 if not vexa_platform.mfa_satisfied() then raise exception using errcode='42501',message='platform_mfa_required';end if;
 return u;
end $$;
revoke all on function vexa_platform.require_admin_aal1() from public,anon,authenticated;
alter function public.platform_manage(jsonb) rename to platform_manage_core;
alter function public.platform_manage_core(jsonb) set schema vexa_platform;
create function public.platform_manage(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_input is not null and jsonb_typeof(p_input)='object' and p_input->>'operation'='status' and (p_input-'operation')='{}'::jsonb then
  perform vexa_platform.require_admin_aal1();
  return jsonb_build_object('administrator',true);
 end if;
 return vexa_platform.platform_manage_core(p_input);
end $$;
revoke all on function public.platform_manage(jsonb) from public,anon;
grant execute on function public.platform_manage(jsonb) to authenticated;
revoke all on function vexa_platform.platform_manage_core(jsonb) from public,anon,authenticated;
commit;
