-- SOLO LECTURA. Diagnostico de 503 / 57014 (statement_timeout 10 s fijado por packages/platform/src/db.ts) y bloqueos.
-- Consultas activas > 3 s (excluye la propia).
select pid, usename, application_name, state, wait_event_type, wait_event, round(extract(epoch from now()-query_start)::numeric,1) as seg,
       left(regexp_replace(query,'\s+',' ','g'),200) as consulta
from pg_stat_activity
where pid<>pg_backend_pid() and state<>'idle' and now()-query_start>interval '3 seconds'
order by query_start;

-- Bloqueos: quien espera a quien.
select w.pid as espera, b.pid as bloquea, now()-w.query_start as espera_desde,
       left(regexp_replace(w.query,'\s+',' ','g'),120) as consulta_espera, left(regexp_replace(b.query,'\s+',' ','g'),120) as consulta_bloqueadora
from pg_stat_activity w join pg_stat_activity b on b.pid = any(pg_blocking_pids(w.pid)) where w.wait_event_type='Lock';

-- Conexiones por rol/estado frente al limite.
select usename, state, count(*) from pg_stat_activity group by 1,2 order by 3 desc;
select current_setting('max_connections') as max_connections, (select count(*) from pg_stat_activity) as en_uso;

-- Transacciones abiertas viejas (candidatas a terminar con "transaction timeout", error 25P04, visto el 19-oct).
select pid, usename, state, round(extract(epoch from now()-xact_start)::numeric) as seg_en_transaccion, left(regexp_replace(query,'\s+',' ','g'),120) as ultima
from pg_stat_activity where xact_start is not null and now()-xact_start>interval '20 seconds' and pid<>pg_backend_pid() order by xact_start;
