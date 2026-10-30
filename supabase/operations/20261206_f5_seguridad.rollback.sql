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
