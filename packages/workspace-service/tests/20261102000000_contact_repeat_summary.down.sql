-- Reversa de 20261102000000: borra el resumen de contacto repetido y su función (derivados; los datos de origen no se tocan).
-- La pantalla /refunds vuelve a decir «No disponible ahora» en esa sección.
begin;
set local lock_timeout='3s';
drop function if exists public.refresh_contact_repeat(uuid);
drop table if exists public.contact_repeat_summary;
commit;
