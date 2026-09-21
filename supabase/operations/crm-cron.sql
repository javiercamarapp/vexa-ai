-- EXPLICIT INTERACTIVE REMOTE APPROVAL REQUIRED. Never called automatically.
-- Separate CRM schedule; does not replace or modify the durable import schedule.
-- Credentials come from session settings and Vault, never from source literals.
begin;
DO $$
declare endpoint text:=current_setting('vexa.crm_endpoint',true); secret text:=current_setting('vexa.crm_secret',true); sid uuid;
begin
 if current_setting('vexa.crm_bootstrap_approved',true) is distinct from 'yes' then raise exception 'interactive approval required'; end if;
 if current_setting('vexa.crm_revoke',true)='yes' then
  if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.unschedule(jobid) from cron.job where jobname='vexa-crm-chunk'; end if;
  return;
 end if;
 if endpoint is null or endpoint !~ '^https://[a-zA-Z0-9.-]+/api/internal/crm$' or secret is null or length(secret)<32 then raise exception 'configuration required'; end if;
 if not exists(select 1 from pg_extension where extname='pg_cron') or not exists(select 1 from pg_extension where extname='pg_net') or not exists(select 1 from pg_namespace where nspname='vault') then raise exception 'existing cron/net/vault extensions required'; end if;
 select id into sid from vault.secrets where name='vexa_crm_trigger';
 if sid is null then perform vault.create_secret(secret,'vexa_crm_trigger'); else perform vault.update_secret(sid,secret); end if;
 perform cron.schedule('vexa-crm-chunk','30 seconds',format($cmd$select net.http_post(url:=%L,headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='vexa_crm_trigger')),body:='{}'::jsonb,timeout_milliseconds:=55000);$cmd$,endpoint));
end $$;
commit;
-- Stop with crm_bootstrap_approved=yes and crm_revoke=yes under legitimate approval.
-- Pausing a connection in the owner UI also stops its new dispatches.
