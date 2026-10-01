-- PRIVATE PROPOSAL. Only after comparing receipts and confirming both were created by THIS operation.
-- Operator supplies recorded OIDs via set_config(...,true) in this same transaction.
-- The OID identity check prevents deleting replaced/pre-existing extensions by name alone.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('vexa:operations443:extensions',0));
DO $rollback_guard$
begin
 if current_setting('vexa.operations443.rollback_created_here',true) is distinct from 'yes' then raise exception 'receipt approval required'; end if;
 if current_setting('vexa.operations443.created_pg_cron_oid',true) is null or current_setting('vexa.operations443.created_pg_net_oid',true) is null or (select count(*) from pg_extension where extname in ('pg_cron','pg_net'))<>2 then raise exception 'complete created extension receipt required'; end if;
 if (select oid::text from pg_extension where extname='pg_cron') is distinct from current_setting('vexa.operations443.created_pg_cron_oid',true)
  or (select oid::text from pg_extension where extname='pg_net') is distinct from current_setting('vexa.operations443.created_pg_net_oid',true) then raise exception 'created extension receipt mismatch'; end if;
 if exists(select 1 from cron.job) or exists(select 1 from cron.job_run_details) or exists(select 1 from net.http_request_queue) or exists(select 1 from net._http_response) then raise exception 'work or history exists; preserve for review'; end if;
end $rollback_guard$;
drop extension pg_net restrict;
drop extension pg_cron restrict;
-- No CASCADE, schema/role removal, Vault mutation, shared setting change or job deletion.
commit;
