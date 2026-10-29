-- AUTH-03 / R-03 (cierre de seguridad 29-oct): límite del enlace de acceso por IP y por correo RESPALDADO EN BASE.
-- El límite local de cada instancia serverless no se comparte: 256 correos inventados por minuto dejaban sin enlace a usuarios reales
-- y el tope por instancia no frenaba el abuso global. Aquí el contador vive en Postgres y lo comparten todas las instancias.
-- Diseño:
--  * Solo se guardan HUELLAS (HMAC-SHA256 en hexadecimal calculado por el servidor con una llave propia): nunca la IP ni el correo en claro.
--  * El veredicto depende únicamente de contadores de la IP y de la huella del correo escrito, nunca de si la cuenta existe:
--    una cuenta real y una inventada reciben exactamente la misma respuesta (no enumera cuentas).
--  * Solo el rol del backend ejecuta la función; anon/authenticated/public no. La tabla no se lee ni se escribe directo.
-- Reversión: drop function public.email_auth_admit(text,text); drop table public.email_auth_events; (solo guarda contadores efímeros de 1 h).
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
create table public.email_auth_events(
 id bigint generated always as identity primary key,
 scope text not null check(scope in ('ip','email')),
 key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
 at timestamptz not null default clock_timestamp()
);
create index email_auth_events_lookup on public.email_auth_events(scope,key_hash,at desc);
create index email_auth_events_prune on public.email_auth_events(at);
alter table public.email_auth_events enable row level security;
alter table public.email_auth_events force row level security;
revoke all on public.email_auth_events from public,anon,authenticated,service_role,vexa_backend;

-- Veredictos: ok | ip_limited (429, 10/min o 60/h por IP) | duplicate (mismo correo: 1/min y 6/h; el servidor responde el 202 genérico).
-- Solo los intentos admitidos dejan fila; los rechazados no inflan la tabla ante una inundación.
create function public.email_auth_admit(p_ip_hash text,p_email_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); n_min int; n_hour int; oldest timestamptz;
begin
 if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' or (p_ip_hash is not null and p_ip_hash !~ '^[a-f0-9]{64}$') then
  raise exception using errcode='22023',message='email_auth_input_invalid';
 end if;
 -- Poda acotada: filas de más de 1 hora ya no cuentan para ninguna ventana.
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
revoke all on function public.email_auth_admit(text,text) from public,anon,authenticated,service_role;
grant execute on function public.email_auth_admit(text,text) to vexa_backend;
comment on function public.email_auth_admit(text,text) is 'AUTH-03: límite por IP y por correo compartido entre instancias; solo huellas, veredicto independiente de la existencia de la cuenta.';
commit;
