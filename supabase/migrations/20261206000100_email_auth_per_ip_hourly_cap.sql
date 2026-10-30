-- R2-06 (auditoría run-2; cierre F5, 29-oct): el tope horario por correo de email_auth_admit (6/h) era GLOBAL por correo.
-- Un atacante con una sola IP pedía el enlace de la víctima una vez por minuto, agotaba las 6 admisiones en 6 minutos y la víctima, desde su IP, quedaba sin enlace una hora.
-- Ahora: la ventana de 60 s sigue siendo global por correo (un solo envío pendiente a la vez); el tope horario del correo (6) cuenta POR PAR (correo, IP). Lo que una IP puede hacerle a un correo
-- queda acotado por el tope de esa IP (10/min, 60/h), y otra IP no hereda el castigo. Sigue sin depender de que la cuenta exista y sin guardar nada en claro (solo huellas).
-- Reversión: ver supabase/operations/20261206_f5_seguridad.rollback.sql
begin;
set local lock_timeout='3s'; set local statement_timeout='15s';
alter table public.email_auth_events add column ip_hash text check(ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$');
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
 -- Ventana de 60 s: global por correo. Tope horario: solo las admisiones de ESTE par (correo, IP).
 select count(*) filter(where at>t-interval '1 minute'),count(*) filter(where ip_hash is not distinct from p_ip_hash) into n_min,n_hour from public.email_auth_events where scope='email' and key_hash=p_email_hash and at>t-interval '1 hour';
 if n_min>=1 or n_hour>=6 then return jsonb_build_object('verdict','duplicate','retry_after',60); end if;
 insert into public.email_auth_events(scope,key_hash,ip_hash) values('email',p_email_hash,p_ip_hash);
 if p_ip_hash is not null then insert into public.email_auth_events(scope,key_hash) values('ip',p_ip_hash); end if;
 return jsonb_build_object('verdict','ok','retry_after',0);
end $$;
commit;
