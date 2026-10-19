-- SOLO LECTURA. Estado de las colas durables por tipo de job y salud de los consumidores.
-- Un job es "listo" si esta en cola y su proximo intento ya llego; es "reclamable por lease vencida" si esta running con lease_until pasado.
select type, state, count(*) as n,
       count(*) filter (where state='queued' and next_attempt_at<=now()) as listos,
       count(*) filter (where state='running' and lease_until<=now()) as lease_vencida,
       count(*) filter (where state='running' and deadline is not null and deadline<=now()) as deadline_vencido,
       round(extract(epoch from now()-min(created_at) filter (where state='queued'))/60) as cola_mas_vieja_min
from public.jobs
group by type, state
order by type, state;

-- Ultimo latido de cada consumidor (audit_events) y ultimo despacho por consumidor/tenant.
select tenant_id, max(occurred_at) as ultimo_latido, round(extract(epoch from now()-max(occurred_at))/60) as hace_min
from public.audit_events where action='consumer_heartbeat' group by tenant_id order by 2 desc;

select tenant_id, enabled, last_dispatched_at as imports, crm_last_dispatched_at as crm, extraction_last_dispatched_at as extraction,
       problems_last_dispatched_at as problems, notification_last_dispatched_at as notifications
from public.worker_delegations order by tenant_id;
