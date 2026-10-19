-- SOLO LECTURA. Jobs que probablemente necesitan intervencion. Criterios (ajustar umbrales en la clausula where):
--  a) running con lease vencida  -> el siguiente claim del consumidor la reclama sola (repository.mjs claim); si pasa de unos minutos, el consumidor no corre.
--  b) running con deadline vencido -> el siguiente claim la marca 'failed' (DEADLINE) y escribe dead_letters; NO se reanuda sola.
--  c) failure_count alto -> cerca de ATTEMPTS_EXHAUSTED (min(max_attempts,4)).
--  d) sin progreso > 15 min estando running con lease vigente -> posible bloqueo de BD (ver 04).
select j.id, j.tenant_id, j.type, j.state, j.failure_count, j.max_attempts, j.fencing_token,
       j.lease_until, j.lease_until<=now() as lease_vencida, j.deadline, j.deadline<=now() as deadline_vencido,
       j.last_progress_at, round(extract(epoch from now()-coalesce(j.last_progress_at,j.updated_at))/60) as min_sin_progreso,
       j.cancel_requested_at, j.import_id
from public.jobs j
where j.state in ('running','queued','partial')
  and ( (j.state='running' and (j.lease_until<=now() or j.deadline<=now() or coalesce(j.last_progress_at,j.updated_at)<now()-interval '15 minutes'))
        or j.failure_count>=3
        or (j.state='queued' and j.next_attempt_at<now()-interval '30 minutes') )
order by j.updated_at;

-- Dead letters recientes (jobs terminados por DEADLINE / ATTEMPTS_EXHAUSTED / ACTOR_REVOKED / CONNECTION_REVOKED ...).
select reason, count(*) as n, max(failed_at) as ultimo from public.dead_letters where failed_at>now()-interval '14 days' group by reason order by n desc;

-- Intentos marcados inciertos por lease vencida (el siguiente claim los marca asi).
select error_code, state, count(*) from public.attempts where state='uncertain' group by 1,2;
