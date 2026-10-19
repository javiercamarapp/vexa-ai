-- ROLLBACK de 0053 (metadatos de adjuntos). ELIMINA TABLAS attachment_links y attachment_blobs (solo metadatos).
-- Los BYTES viven en Storage (<tenant>/attachments/<aa>/<sha256>) y este script NO los toca: quedarian huerfanos.
-- Para descartarlos hay que borrarlos aparte (accion de Javier, con inventario previo); si solo se revierte el esquema,
-- se pueden re-registrar despues por sha256 (los objetos son direccionables por contenido).
-- Guardia: aborta si hay filas, salvo   set vexa.rollback_confirm_drop_data = 'yes';
begin;
set local lock_timeout='5s';
do $$
declare n bigint:=0;t text;c bigint;
begin
 foreach t in array array['attachment_links','attachment_blobs'] loop
  if to_regclass('public.'||t) is not null then execute format('select count(*) from public.%I',t) into c; n:=n+c; end if;
 end loop;
 if n>0 and coalesce(current_setting('vexa.rollback_confirm_drop_data',true),'')<>'yes' then
  raise exception 'ROLLBACK_0053_ABORTADO: % filas de adjuntos se perderian; respalde y declare vexa.rollback_confirm_drop_data=yes',n using errcode='P0001';
 end if;
end $$;
drop table if exists public.attachment_links;
drop table if exists public.attachment_blobs;
drop function if exists public.attachment_blob_guard();
commit;
