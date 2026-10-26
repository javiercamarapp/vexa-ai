-- Before-use only. Preserve every audit row once the feature has been used.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
lock table public.cfo_access_log in access exclusive mode;
do $$ begin
 if exists(select 1 from public.cfo_access_log) then raise exception 'CFO_ROLLBACK_ALREADY_USED'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.cfo_access_log'::regclass and tgname='cfo_access_log_immutable' and not tgisinternal) then raise exception 'CFO_ROLLBACK_SCHEMA_DRIFT'; end if;
end $$;
drop trigger cfo_access_log_immutable on public.cfo_access_log;
drop function public.cfo_access_log_append_only() restrict;
drop table public.cfo_access_log restrict;
commit;
