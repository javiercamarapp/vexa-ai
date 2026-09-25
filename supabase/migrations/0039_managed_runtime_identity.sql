-- Managed PostgreSQL does not let postgres grant USAGE on Supabase-owned auth.
-- Resolve auth.uid at definition time; execution keeps the caller's privileges.
-- No SECURITY DEFINER, role inheritance, Auth table grant or identity fallback.
begin;
create function public.vexa_request_uid() returns uuid
language sql stable security invoker set search_path=''
return auth.uid();
revoke all on function public.vexa_request_uid() from public,anon,service_role;
grant execute on function public.vexa_request_uid() to authenticated,vexa_backend;
-- Only VEXA invoker functions with a known direct Auth lookup are rebound.
-- pg_get_functiondef preserves signature/configuration; OR REPLACE preserves ACL/owner.
do $migration$
declare f record; definition text;
begin
 for f in select p.oid,p.proname,p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f' and not p.prosecdef and position('auth.uid()' in p.prosrc)>0
 and p.proname=any(array['vexa_member','vexa_intervention_transition','confirm_import','vexa_alias_event','vexa_health_guard','vexa_extraction_terminal_guard','crm_settings_guard','economic_append_guard','economic_link_guard','economic_money_config_guard','economic_snapshot_write_guard','priority_guard','workspace_dimension_guard','workspace_customer_identity_guard','notification_own','history_batch_guard','history_item_guard'])
 loop
  if pg_get_userbyid(f.proowner)<>current_user then raise exception 'VEXA_FUNCTION_OWNER_MISMATCH';end if;
  definition:=pg_get_functiondef(f.oid);
  execute replace(definition,'auth.uid()','public.vexa_request_uid()');
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not p.prosecdef and p.prokind='f' and position('auth.uid()' in p.prosrc)>0) then
  raise exception 'VEXA_UNREVIEWED_INVOKER_AUTH_REFERENCE';
 end if;
end
$migration$;
commit;
