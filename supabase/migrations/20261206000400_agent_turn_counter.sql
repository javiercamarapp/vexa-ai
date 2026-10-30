-- R2-12 (auditoría run-2; cierre F5, 29-oct): contador DURABLE de preguntas al agente por (organización, usuario, día).
-- El límite de 100 preguntas por usuario y día vivía solo en memoria de cada instancia serverless (se reinicia en cada arranque en frío y no se comparte), así que no frenaba nada.
-- El agente hoy responde con reglas, sin modelo de lenguaje y a costo 0; este contador es requisito ANTES de conectar un proveedor de IA real.
-- public.agent_turn_admit lo ejecuta solo vexa_backend con el tenant y el usuario YA verificados por la aplicación; el incremento y la comparación son atómicos (una sola sentencia).
-- Los turnos por conversación (conversationTurns) siguen viniendo del cliente: acotarlos en servidor requiere una tabla de conversaciones del agente, que aún no existe (ver NOTAS de F5).
-- Reversión: ver supabase/operations/20261206_f5_seguridad.rollback.sql
begin;
set local lock_timeout='3s'; set local statement_timeout='15s';
create table public.agent_turn_counters(
 tenant_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null,
 day date not null,
 turns integer not null default 0 check(turns>=0),
 primary key(tenant_id,user_id,day)
);
alter table public.agent_turn_counters enable row level security;
alter table public.agent_turn_counters force row level security;
revoke all on public.agent_turn_counters from public,anon,authenticated,service_role,vexa_backend;
create function public.agent_turn_admit(p_tenant uuid,p_user uuid,p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d date:=(clock_timestamp() at time zone 'utc')::date; n integer;
begin
 if p_tenant is null or p_user is null or p_limit is null or p_limit not between 1 and 10000 then raise exception using errcode='22023',message='agent_turn_input_invalid';end if;
 delete from public.agent_turn_counters where (tenant_id,user_id,day) in(select c.tenant_id,c.user_id,c.day from public.agent_turn_counters c where c.day<d-7 limit 200);
 insert into public.agent_turn_counters(tenant_id,user_id,day,turns) values(p_tenant,p_user,d,1)
 on conflict(tenant_id,user_id,day) do update set turns=public.agent_turn_counters.turns+1 where public.agent_turn_counters.turns<p_limit
 returning turns into n;
 if n is null then return jsonb_build_object('ok',false,'limit',p_limit); end if;
 return jsonb_build_object('ok',true,'used',n,'limit',p_limit);
end $$;
revoke all on function public.agent_turn_admit(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.agent_turn_admit(uuid,uuid,integer) to vexa_backend;
commit;
