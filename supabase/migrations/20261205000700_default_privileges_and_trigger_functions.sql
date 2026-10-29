-- M3 y B1 (auditoría 2; cierre 29-oct): privilegios por defecto del esquema public y funciones de disparador.
--  * M3: Supabase otorga por defecto a anon, authenticated y service_role todo sobre tablas, secuencias y funciones nuevas de `public` creadas por postgres y
--    supabase_admin. Una migración futura que olvide el REVOKE dejaría una tabla abierta a anon con solo la RLS como protección. Se revoca el valor por defecto
--    para anon y authenticated (service_role conserva el suyo: lo usan las herramientas de Supabase). Las migraciones del proyecto ya otorgan de forma explícita
--    (`grant ... to vexa_backend`, `to authenticated`), así que no cambia nada de lo existente. En funciones se retiran las entradas explícitas para anon y authenticated. NO se retira EXECUTE a PUBLIC por defecto: eso exigiría quitarlo en todos los esquemas del rol (sin `in schema`) y rompería funciones de extensiones que ejecutan los roles de la API; la defensa para funciones nuevas es `revoke ... from public` en cada migración, vigilada por la prueba de funciones ejecutables por anon.
--  * B1: cinco funciones de disparador dejan de ser ejecutables por anon/authenticated/public (no son invocables como RPC, pero es mínimo privilegio) y las
--    cuatro ai_budget_* fijan search_path vacío (las referencias ya van calificadas con public.; pg_catalog siempre se busca primero).
-- Reversión: alter default privileges ... grant (ver rollback) ; grant execute on las funciones a public; alter function ... set search_path=pg_catalog,public.
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';
-- R2-20 (auditoría run 2): en Supabase gestionado `postgres` NO es superusuario ni miembro de supabase_admin, así que `alter default privileges for role supabase_admin`
-- falla con insufficient_privilege. Cada rol se trata por separado: lo de `postgres` (el que ejecuta las migraciones) se aplica siempre; lo de supabase_admin solo si el
-- rol actual es superusuario o miembro de él, y si no se emite un NOTICE «R2-20 OMITIDO» y se sigue. Nada de lo que sigue (revokes de los cinco disparadores, search_path de
-- las cuatro ai_budget_*) depende de esto. El valor por defecto de supabase_admin lo cierra quien tenga ese rol (panel de Supabase o soporte); el script de aplicar lo reporta.
do $$ declare r text; begin
 foreach r in array array['postgres','supabase_admin'] loop
  if not exists(select 1 from pg_roles where rolname=r) then raise notice 'R2-20 OMITIDO: el rol % no existe', r; continue; end if;
  if not (r = current_user or (select rolsuper from pg_roles where rolname = current_user) or pg_has_role(current_user, r, 'member')) then
   raise notice 'R2-20 OMITIDO: % no es miembro de % (alter default privileges for role % no se aplica)', current_user, r, r; continue; end if;
  begin
   execute format('alter default privileges for role %I in schema public revoke all on tables from anon, authenticated',r);
   execute format('alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated',r);
   execute format('alter default privileges for role %I in schema public revoke execute on functions from anon, authenticated',r);
  exception when insufficient_privilege then raise notice 'R2-20 OMITIDO: privilegios insuficientes para alter default privileges for role %', r;
  end;
 end loop;
end $$;
revoke execute on function public.ai_budget_attempt_guard(),public.ai_budget_limit_guard(),public.ai_budget_reconciliation_guard(),public.ai_budget_reservation_guard(),public.cfo_access_log_append_only() from anon, authenticated, public;
alter function public.ai_budget_attempt_guard() set search_path='';
alter function public.ai_budget_limit_guard() set search_path='';
alter function public.ai_budget_reconciliation_guard() set search_path='';
alter function public.ai_budget_reservation_guard() set search_path='';
commit;
