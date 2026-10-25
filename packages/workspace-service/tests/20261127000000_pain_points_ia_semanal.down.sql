-- Reversa de 20261127000000: borra la lectura de IA, el ledger de gasto, la salida del reporte semanal y las bajas. La pantalla vuelve a mostrar «Lectura de IA no disponible»; /api/internal/weekly responde 503 hasta reaplicar.
-- ATENCIÓN: borra las bajas del reporte semanal (report_unsubscribes). Respáldalas antes si ya hubo envíos reales.
begin;
set local lock_timeout='3s';
drop function if exists public.weekly_unsubscribe(uuid,uuid,boolean);
drop function if exists public.weekly_report_mark(uuid,uuid,text);
drop function if exists public.weekly_report_claim(uuid,uuid);
drop function if exists public.weekly_report_record(uuid,jsonb);
drop function if exists public.weekly_recipients(uuid);
drop function if exists public.analysis_run_save(uuid,jsonb);
drop function if exists public.analysis_run_view(uuid);
drop function if exists public.analysis_budget_settle(uuid,text,bigint);
drop function if exists public.analysis_budget_reserve(uuid,text,bigint);
drop function if exists public.analysis_budget_status(uuid);
drop function if exists public.analysis_week_start();
drop function if exists public.pp_ia_authorized(uuid);
drop table if exists public.report_unsubscribes;
drop table if exists public.weekly_report_outbox;
drop table if exists public.analysis_spend;
drop table if exists public.analysis_reads;
drop table if exists public.analysis_runs;
commit;
