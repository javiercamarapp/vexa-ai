-- Reversa de 20261209000000_user_preferences_idioma.
-- Borra la tabla public.user_preferences (y con ella los idiomas guardados: el idioma de la interfaz sigue en la cookie del navegador y los envíos del sistema vuelven a español).
-- Es el único dato que se pierde; nada más depende de esta tabla (el código tolera su ausencia).
begin;
set local lock_timeout='3s';
drop trigger if exists user_preferences_touch on public.user_preferences;
drop function if exists public.user_preferences_touch();
drop table if exists public.user_preferences;
commit;
