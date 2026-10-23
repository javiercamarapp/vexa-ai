-- Reversa de 20261114000000: quita el veredicto precalculado de corridas, su contador y los disparadores. Los datos de origen no se tocan.
-- La aplicación vuelve sola a la consulta en vivo (usableRunsSummary).
begin;
set local lock_timeout='3s';
drop trigger if exists problem_verdict_tombstones on public.tombstones;
drop trigger if exists problem_verdict_retention on public.retention_ledger;
drop trigger if exists problem_verdict_conversations on public.conversations;
drop trigger if exists problem_verdict_messages on public.messages;
drop trigger if exists problem_verdict_message_revisions on public.message_revisions;
drop trigger if exists problem_verdict_connections on public.connections;
drop trigger if exists problem_verdict_runs on public.extraction_runs;
drop function if exists public.refresh_problem_run_verdicts(uuid,integer),public.problem_verdict_bump_insert(),public.problem_verdict_bump_deleted(),public.problem_verdict_bump_status();
drop table if exists public.insight_problem_run_verdict,public.problem_verdict_epoch;
delete from public.insight_state where insight='problem_run_verdict';
alter table public.insight_state drop constraint if exists insight_state_insight_check;
alter table public.insight_state add constraint insight_state_insight_check
 check(insight in('conversation_volume','refund_by_sku_month','thread_resolution','tracker_refund_status','repeat_contact'));
commit;
