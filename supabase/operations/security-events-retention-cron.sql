-- REQUIERE APROBACION EXPLICITA DE JAVIER. Nunca se ejecuta automaticamente. Programa la retencion diaria de vexa_platform.security_events (migracion 20261206000200).
-- Corre dentro de la base (sin HTTP ni secretos): cada noche borra por lotes las filas de mas de 180 dias y vuelve a llamar mientras haya mas.
-- Requiere pg_cron habilitado (supabase/operations/bootstrap-extensions.sql). Detener: select cron.unschedule('vexa-security-events-retention');
begin;
do $$
begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'pg_cron requerido'; end if;
 perform cron.unschedule(jobid) from cron.job where jobname='vexa-security-events-retention';
 perform cron.schedule('vexa-security-events-retention','17 3 * * *',$cmd$
  do $r$ declare i int:=0; res jsonb; begin
   loop
    select vexa_platform.security_events_retain(interval '180 days',5000) into res;
    i:=i+1; exit when (res->>'more')<>'true' or i>=20;
   end loop;
  end $r$;
 $cmd$);
end $$;
commit;
