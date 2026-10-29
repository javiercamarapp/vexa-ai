-- M-03 (auditoría 1; cierre 29-oct): tope de invitaciones por organización (20 por hora, 100 por día) y un evento de seguridad por cada invitación.
-- Antes un propietario (o una cuenta suya comprometida) podía disparar invitaciones sin límite y enviar correo masivo desde el dominio de Rovaq.
-- Disparador BEFORE INSERT sobre public.team_invitations: cuenta las filas de la misma organización, rechaza con 54000 y mensaje team_invitation_quota
-- (la aplicación lo responde 429 y registra el evento rate_limited) y deja un evento invitation_sent por cada invitación aceptada en vexa_platform.security_events (migración 20261205000400 es requisito). No se guarda el correo.
-- Reversión: drop trigger team_invitation_quota on public.team_invitations; drop function public.team_invitation_quota();
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';
create function public.team_invitation_quota() returns trigger language plpgsql security definer set search_path='' as $$
declare h integer; d integer;
begin
 select count(*) filter(where created_at>clock_timestamp()-interval '1 hour'),count(*) into h,d from public.team_invitations where tenant_id=new.tenant_id and created_at>clock_timestamp()-interval '1 day';
 if h>=20 or d>=100 then
  -- El rechazo revierte esta transacción: el evento rate_limited lo registra la aplicación al recibir el 429 (packages/team).
  raise exception using errcode='54000',message='team_invitation_quota';
 end if;
 insert into vexa_platform.security_events(kind,severity,route,tenant_id,actor_id,detail) values('invitation_sent','info','db/team_invitations',new.tenant_id,new.created_by,jsonb_build_object('operation','invite','resource',new.role));
 return new;
end $$;
revoke all on function public.team_invitation_quota() from public,anon,authenticated,service_role;
create trigger team_invitation_quota before insert on public.team_invitations for each row execute function public.team_invitation_quota();
commit;
