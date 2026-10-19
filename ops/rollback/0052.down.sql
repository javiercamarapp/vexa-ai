-- ROLLBACK de 0052 (ingesta del Tracker). ELIMINA TABLAS: hacer respaldo logico ANTES (ops/backup-restore/backup.sh).
-- Guardia: aborta si alguna tabla del Tracker tiene filas, salvo que la sesion declare:
--   set vexa.rollback_confirm_drop_data = 'yes';   (despues de verificar el respaldo)
-- Las tablas son solo-insercion: no existe "rollback parcial" de filas; o se conservan o se descartan todas.
begin;
set local lock_timeout='5s';
do $$
declare n bigint:=0;t text;c bigint;
begin
 foreach t in array array['tracker_versions','tracker_sheet_jobs','tracker_row_revisions','tracker_row_observations','tracker_row_rejections'] loop
  if to_regclass('public.'||t) is not null then execute format('select count(*) from public.%I',t) into c; n:=n+c; end if;
 end loop;
 if n>0 and coalesce(current_setting('vexa.rollback_confirm_drop_data',true),'')<>'yes' then
  raise exception 'ROLLBACK_0052_ABORTADO: % filas del Tracker se perderian; respalde y declare vexa.rollback_confirm_drop_data=yes',n using errcode='P0001';
 end if;
end $$;
drop function if exists public.tracker_close_sheet(uuid,text);
drop function if exists public.tracker_ingest_batch(uuid,text,jsonb,jsonb);
drop function if exists public.tracker_revision_id(uuid,uuid,text,integer,text);
drop view if exists public.tracker_row_heads;
drop table if exists public.tracker_row_rejections;
drop table if exists public.tracker_row_observations;
drop table if exists public.tracker_row_revisions;
drop table if exists public.tracker_sheet_jobs;
drop table if exists public.tracker_versions;
commit;
