-- Explicit operation only. Does not schedule jobs or send HTTP.
-- Standard Supabase ACL model: net PUBLIC privileges remain; require verified API boundary.
-- Not the rejected strict-ACL proposal. Root/operator verifies destination and authorization.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
DO $pre$
begin
 if exists(select 1 from pg_extension where extname in ('pg_cron','pg_net')) or exists(select 1 from pg_namespace where nspname in ('cron','net')) then raise exception 'preserve existing extension/schema; review required'; end if;
 if not exists(select 1 from pg_namespace where nspname='extensions') then raise exception 'managed extensions schema required'; end if;
 if current_setting('cron.database_name',true) is distinct from current_database() then raise exception 'cron database mismatch'; end if;
 if not coalesce(current_setting('shared_preload_libraries',true)~'pg_cron',false) or not coalesce(current_setting('shared_preload_libraries',true)~'pg_net',false) then raise exception 'preloaded extensions required'; end if;
 if (select count(*) from pg_available_extensions where name in ('pg_cron','pg_net'))<>2 then raise exception 'extensions unavailable'; end if;
 if (select count(*) from pg_roles where rolname in ('anon','authenticated') and not rolcanlogin and not rolcreaterole and not rolcreatedb and not rolsuper and not rolbypassrls)<>2 then raise exception 'frontend role boundary invalid'; end if;
end $pre$;
create extension pg_cron with schema pg_catalog;
create extension pg_net with schema extensions;
DO $post$
begin
 if exists(select 1 from cron.job) or exists(select 1 from cron.job_run_details) or exists(select 1 from net.http_request_queue) or exists(select 1 from net._http_response) then raise exception 'unexpected work; abort installation'; end if;
 if to_regprocedure('cron.schedule(text,text,text)') is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then raise exception 'extension contract absent'; end if;
end $post$;
select extname,oid,extversion,extowner::regrole::text as owner,extnamespace::regnamespace::text as schema
 from pg_extension where extname in ('pg_cron','pg_net') order by extname;
commit;
