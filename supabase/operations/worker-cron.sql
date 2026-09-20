-- EXPLICIT INTERACTIVE REMOTE APPROVAL REQUIRED. Never called automatically.
-- Operator supplies endpoint + trigger secret using session settings, not source literals.
-- Requires existing pg_cron, pg_net and vault; fails closed if unavailable.
begin;
DO $$
declare endpoint text:=current_setting('vexa.worker_endpoint',true); secret text:=current_setting('vexa.worker_secret',true); sid uuid;
begin
 if current_setting('vexa.worker_bootstrap_approved',true) is distinct from 'yes' then raise exception 'interactive approval required'; end if;
 if current_setting('vexa.worker_revoke',true)='yes' then
  if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.unschedule(jobid) from cron.job where jobname='vexa-worker-chunk'; end if;
  return;
 end if;
 if endpoint !~ '^https://[^/]+/api/internal/worker$' or endpoint is null or length(secret)<32 or secret is null then raise exception 'configuration required'; end if;
 if not exists(select 1 from pg_extension where extname='pg_cron') or not exists(select 1 from pg_extension where extname='pg_net') or not exists(select 1 from pg_namespace where nspname='vault') then raise exception 'existing cron/net/vault extensions required'; end if;
 select id into sid from vault.secrets where name='vexa_worker_trigger';
 if sid is null then perform vault.create_secret(secret,'vexa_worker_trigger'); else perform vault.update_secret(sid,secret); end if;
 perform cron.schedule('vexa-worker-chunk','30 seconds',format($cmd$select net.http_post(url:=%L,headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='vexa_worker_trigger')),body:='{}'::jsonb,timeout_milliseconds:=55000);$cmd$,endpoint));
end $$;
commit;
-- Revoke under the same interactive approval: select cron.unschedule('vexa-worker-chunk');
-- Then revoke worker in owner UI and rotate/remove the trigger secret in the server.
