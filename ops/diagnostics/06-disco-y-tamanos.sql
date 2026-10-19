-- SOLO LECTURA. Disco / crecimiento. Base de datos total y 20 relaciones mayores (tabla+indices+toast), con filas vivas/muertas estimadas.
select pg_size_pretty(pg_database_size(current_database())) as base_total;
select c.relname, pg_size_pretty(pg_total_relation_size(c.oid)) as total, pg_total_relation_size(c.oid) as bytes,
       s.n_live_tup, s.n_dead_tup, s.last_autovacuum
from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_stat_user_tables s on s.relid=c.oid
where n.nspname='public' and c.relkind='r' order by pg_total_relation_size(c.oid) desc limit 20;
-- Objetos de Storage (bytes en el bucket; en Supabase el tamano esta en metadata->>'size').
select bucket_id, count(*) as objetos, pg_size_pretty(coalesce(sum((metadata->>'size')::bigint),0)) as tamano
from storage.objects group by bucket_id order by 1;
-- Filas por tenant en las tablas grandes (conteos exactos pueden ser lentos: usar en horas valle).
select o.id as tenant_id, (select count(*) from public.conversations c where c.tenant_id=o.id) as conversaciones,
       (select count(*) from public.messages m where m.tenant_id=o.id) as mensajes
from public.organizations o order by 1;
