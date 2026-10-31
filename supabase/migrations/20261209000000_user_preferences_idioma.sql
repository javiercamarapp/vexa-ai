-- 20261209000000 (PROPUESTA, NO APLICADA): idioma preferido por persona (public.user_preferences).
-- Por qué: el idioma de la interfaz vive en una cookie del navegador (rovaq_lang). Lo que el sistema genera SIN petición de la persona (reporte semanal, notificaciones, push,
--   avisos por correo) no tiene cookie ni navegador, así que salía siempre en español. Esta tabla guarda el idioma que la persona eligió en el selector (es | en) para esos envíos.
-- Qué HACE: crea UNA tabla nueva, public.user_preferences(user_id pk -> auth.users on delete cascade, idioma es|en, updated_at), con RLS forzada:
--   * authenticated: cada persona lee, inserta y actualiza SOLO su propia fila (user_id = auth.uid()); sin borrar; el update tiene with check (no puede mover la fila a otro user_id);
--   * vexa_backend y vexa_email_service: solo LECTURA de (user_id, idioma), para resolver el idioma del destinatario en el worker de avisos y en el reporte semanal;
--   * un trigger fija updated_at = now() en cada update (el cliente no lo decide).
--   No toca ninguna otra tabla ni función. Idempotente (if not exists / drop policy if exists).
-- El código tolera que esta migración NO esté aplicada: el selector sigue funcionando con la cookie y los envíos del sistema caen a español (best effort, silencioso).
-- Reversa: supabase/operations/20261209000000_user_preferences_idioma.rollback.sql. No se aplica sola: la aplica Javier (~/vexa-notas-28oct/7-aplicar-migracion-idioma.sh).
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

create table if not exists public.user_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 idioma text not null check(idioma in('es','en')),
 updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;
revoke all on public.user_preferences from public,anon,authenticated,service_role,vexa_backend,vexa_email_service;
grant select,insert(user_id,idioma),update(user_id,idioma) on public.user_preferences to authenticated; -- update(user_id): el upsert de PostgREST reescribe user_id; el with check de la política impide moverlo a otra persona
grant select(user_id,idioma) on public.user_preferences to vexa_backend,vexa_email_service;

drop policy if exists user_preferences_own_select on public.user_preferences;
drop policy if exists user_preferences_own_insert on public.user_preferences;
drop policy if exists user_preferences_own_update on public.user_preferences;
drop policy if exists user_preferences_service_read on public.user_preferences;
create policy user_preferences_own_select on public.user_preferences for select to authenticated
 using(user_id=(select auth.uid()));
create policy user_preferences_own_insert on public.user_preferences for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy user_preferences_own_update on public.user_preferences for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy user_preferences_service_read on public.user_preferences for select to vexa_backend,vexa_email_service
 using(true);

create or replace function public.user_preferences_touch() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=now();return new;end $$;
drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch before update on public.user_preferences for each row execute function public.user_preferences_touch();
commit;
