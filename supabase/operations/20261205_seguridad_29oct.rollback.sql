-- Reversión de las migraciones de seguridad 20261205000000..20261205000600, en orden inverso. Cada bloque es independiente.
-- Las tablas de contadores y de eventos solo guardan datos efímeros o de auditoría de seguridad: respaldar security_events antes si se quiere conservarla.
begin;
drop trigger if exists team_invitation_quota on public.team_invitations; drop function if exists public.team_invitation_quota();                                   -- 0600
drop function if exists public.api_rate_add(text,text,integer),public.api_concurrency_acquire(uuid,text,integer,integer),public.api_concurrency_release(uuid);        -- 0500
drop table if exists public.api_rate_counters,public.api_concurrency_leases;
drop function if exists public.evaluate_security_alerts(),public.platform_security_alerts(interval),public.platform_security_events(jsonb),public.record_security_event(jsonb); -- 0400
drop trigger if exists audit_append_only on vexa_platform.audit; drop trigger if exists audit_mask_reason on vexa_platform.audit; drop trigger if exists team_audit_append_only on public.team_audit;
drop table if exists vexa_platform.security_event_counters,vexa_platform.security_events;
drop function if exists vexa_platform.append_only(),vexa_platform.mask_audit_reason();
drop policy if exists vexa_private_member_upload_types on storage.objects;                                                                                           -- 0300
drop trigger if exists tracker_tombstone_blank on public.tracker_row_revisions; drop function if exists public.tracker_tombstone_blank();                            -- 0200 (restaurar retention_erase desde 20261130000100)
do $$ declare t text; begin foreach t in array array['assumptions','attachment_blobs','attachment_links','attempts','attributions','audit_events','checkpoints','components','connections','conversations','cost_rates','customers','dead_letters','economic_events','embeddings','evidence_spans','external_aliases','extraction_runs','import_rows','import_uploads','imports','issues','jobs','message_revisions','messages','order_lines','orders','outbox','problem_conversations','products','reversals','tombstones','interventions','measurement_plans'] loop
 execute format('drop policy if exists role_scoped_direct_read on public.%I',t); end loop; end $$;                                                                 -- 0100
drop function if exists public.email_auth_admit(text,text); drop table if exists public.email_auth_events;                                                          -- 0000
commit;
