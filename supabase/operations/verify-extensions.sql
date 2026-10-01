-- Metadata only; not proof of Data API configuration. Pair with real HTTP boundary checks.
select current_user as operator,session_user,current_setting('server_version') as version;
select extname,oid,extversion,extowner::regrole::text as owner,extnamespace::regnamespace::text as schema from pg_extension where extname in ('pg_cron','pg_net') order by extname;
select rolname,rolcanlogin,rolcreaterole,rolcreatedb,rolsuper,rolbypassrls from pg_roles where rolname in ('anon','authenticated','postgres','supabase_functions_admin') order by rolname;
select nspname,nspowner::regrole::text as owner,nspacl from pg_namespace where nspname in ('cron','net');
select r.rolname,has_schema_privilege(r.oid,'net','USAGE') as net_usage,has_function_privilege(r.oid,'net.http_post(text,jsonb,jsonb,jsonb,integer)','EXECUTE') as http_post_execute from pg_roles r where rolname in ('anon','authenticated','postgres','service_role');
select 'cron_jobs' as metric,count(*) from cron.job union all select 'cron_runs',count(*) from cron.job_run_details union all select 'http_queue',count(*) from net.http_request_queue union all select 'http_responses',count(*) from net._http_response;
-- Absence of settings here does not prove a configuration supplied through environment/API.
select r.rolname,s.setdatabase,v.setting from pg_db_role_setting s left join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig) as v(setting) where split_part(v.setting,'=',1) in ('pgrst.db_schemas','pgrst.db_extra_search_path');
-- Direct catalog dependencies help inventory bridges, but do not find all dynamic SQL.
select n.nspname,p.proname,p.oid::regprocedure::text as identity,p.prosecdef
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','graphql_public','vexa','extensions') and (case when p.prokind in ('f','p') then pg_get_functiondef(p.oid) else '' end) ~* '\m(net|cron)\M[[:space:]]*\.' and p.prokind in ('f','p');
