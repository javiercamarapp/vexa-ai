-- PLANTILLA — NO SE EJECUTA NI SE APLICA DESDE ESTE REPOSITORIO. No es una migracion (no esta en supabase/migrations).
-- Requiere APROBACION INTERACTIVA de Javier (escribe en produccion: cron.schedule + Vault) y que supabase/operations/bootstrap-extensions.sql
-- ya haya sido aplicado (pg_cron + pg_net). Mismo patron de seguridad que supabase/operations/worker-cron.sql: endpoint y secreto llegan
-- por ajustes de sesion, el secreto vive en Vault, nunca en el texto.
--
-- Diferencia con worker-cron.sql: el comando solo llama a Vercel SI hay trabajo reclamable (compuerta de gates.sql). Sin trabajo =
-- 0 invocaciones de funcion = 0 costo de Vercel. Con trabajo, cadencia de 30 s (la que ya usan los scripts existentes).
--
-- Uso (ejemplo imports; repetir por consumidor cambiando nombre, endpoint, secreto y compuerta):
--   set vexa.sched_approved='yes'; set vexa.sched_name='vexa-worker-chunk'; set vexa.sched_endpoint='https://<host>/api/internal/worker';
--   set vexa.sched_secret_name='vexa_worker_trigger'; set vexa.sched_every='30 seconds';
--   set vexa.sched_gate='exists(select 1 from public.jobs where type=''import'' and cancel_requested_at is null and next_attempt_at<=now() and (state=''queued'' or (state=''running'' and lease_until<=now())))';
--   (el secreto ya debe existir en Vault con ese nombre; se crea con los scripts existentes, no aqui)
-- Revocar: set vexa.sched_revoke='yes' (mismo bloque) o `select cron.unschedule('vexa-worker-chunk');`
begin;
DO $$
declare endpoint text:=current_setting('vexa.sched_endpoint',true); nm text:=current_setting('vexa.sched_name',true);
        sec text:=current_setting('vexa.sched_secret_name',true); every text:=coalesce(current_setting('vexa.sched_every',true),'30 seconds');
        gate text:=current_setting('vexa.sched_gate',true);
begin
 if current_setting('vexa.sched_approved',true) is distinct from 'yes' then raise exception 'interactive approval required'; end if;
 if current_setting('vexa.sched_revoke',true)='yes' then perform cron.unschedule(jobid) from cron.job where jobname=nm; return; end if;
 if endpoint !~ '^https://[a-zA-Z0-9.-]+/api/internal/[a-z]+$' or nm !~ '^vexa-[a-z-]+$' or sec !~ '^vexa_[a-z_]+$' then raise exception 'configuration required'; end if;
 if every !~ '^[0-9]+ seconds$' and every !~ '^[0-9*/ ]+$' then raise exception 'schedule invalid'; end if;
 if gate is not null and gate !~ '^exists\(select 1 from public\.jobs where type=''[a-z]+''' then raise exception 'gate not recognised'; end if;
 if not exists(select 1 from vault.secrets where name=sec) then raise exception 'vault secret missing'; end if;
 perform cron.schedule(nm, every, format($cmd$select net.http_post(url:=%L,headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name=%L)),body:='{}'::jsonb,timeout_milliseconds:=55000) where %s;$cmd$, endpoint, sec, coalesce(gate,'true')));
end $$;
commit;
-- Observacion (solo lectura): select jobname, schedule, active from cron.job; select status, count(*) from cron.job_run_details where start_time>now()-interval '1 hour' group by 1;
-- Costo en Supabase: pg_cron/pg_net no tienen cargo aparte en Pro (NO verificado); consumen CPU de la base (Micro) y una conexion por ejecucion.
