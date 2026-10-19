-- SOLO LECTURA. "Compuertas" de trabajo pendiente: devuelven true si el consumidor tiene algo que reclamar AHORA.
-- Se usan como `where (compuerta)` dentro del comando de pg_cron para NO invocar la funcion de Vercel cuando no hay trabajo
-- (ver pg_cron-gated.TEMPLATE.sql). Misma condicion de elegibilidad que el claim de packages/jobs/durable/repository.mjs:
-- state='queued' con next_attempt_at vencido, o state='running' con lease_until vencida (reclamable); sin cancelacion pedida.
-- Cobertura: imports, extraction, problems(embedding) y notifications se derivan de public.jobs.type. crm, history y metadata NO
-- son colas de jobs (los dispara el tiempo/configuracion): no hay compuerta; usar cadencia fija (ver docs/operacion/02-CRON-Y-TAREAS-PROGRAMADAS.md).
select 'imports' as consumidor, exists(select 1 from public.jobs where type='import' and cancel_requested_at is null and next_attempt_at<=now() and (state='queued' or (state='running' and lease_until<=now()))) as hay_trabajo
union all
select 'extraction', exists(select 1 from public.jobs where type='extraction' and cancel_requested_at is null and next_attempt_at<=now() and (state='queued' or (state='running' and lease_until<=now())))
union all
select 'problems', exists(select 1 from public.jobs where type='embedding' and cancel_requested_at is null and next_attempt_at<=now() and (state='queued' or (state='running' and lease_until<=now())))
union all
select 'notifications', exists(select 1 from public.jobs where type='notification' and cancel_requested_at is null and next_attempt_at<=now() and (state='queued' or (state='running' and lease_until<=now())));
