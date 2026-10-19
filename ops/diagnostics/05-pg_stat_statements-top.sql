-- SOLO LECTURA. Requiere la extension pg_stat_statements (Supabase la trae habilitada; NO verificado para vexa-ai; NO probada localmente
-- porque el Postgres local desechable no la carga). Sentencias con peor tiempo medio/maximo: ahi esta el siguiente 57014.
select calls, round(mean_exec_time::numeric,1) as medio_ms, round(max_exec_time::numeric,1) as max_ms, round(total_exec_time::numeric/1000,1) as total_s, rows,
       left(regexp_replace(query,'\s+',' ','g'),160) as consulta
from extensions.pg_stat_statements
where max_exec_time>3000
order by max_exec_time desc limit 20;
