-- SOLO LECTURA. Imports que siguen abiertos (running/queued/partial/mapping/uploaded/reserved) desde hace mas de 24 h, con sus conteos y
-- el job asociado. Los 6 imports 'crm-canonical-v1' en running desde el 28-sep aparecen aqui. NO cerrar sin criterio de Javier:
-- cerrar es una escritura de produccion (ver docs/operacion/04-RUNBOOK-INCIDENTES.md, seccion "imports running").
select i.id, i.tenant_id, i.state, i.created_at, i.updated_at, round(extract(epoch from now()-i.updated_at)/86400,1) as dias_sin_actividad,
       i.total, i.accepted, i.rejected, i.duplicates, i.pending,
       i.provenance->'mapping'->>'profile' as perfil, j.id as job_id, j.state as job_state, j.failure_count, j.lease_until
from public.imports i left join public.jobs j on j.tenant_id=i.tenant_id and j.import_id=i.id
where i.state in ('running','queued','partial','mapping','uploaded','reserved') and i.updated_at<now()-interval '24 hours'
order by i.updated_at;

-- Resumen por estado (todo el historial).
select state, count(*) as n, min(created_at) as mas_viejo, max(updated_at) as ultima_actividad from public.imports group by state order by state;

-- Filas por estado de los imports abiertos viejos (coherencia: accepted+rejected+duplicates+pending debe ser total).
select i.id, i.total, i.accepted+i.rejected+i.duplicates+i.pending as suma, (i.total = i.accepted+i.rejected+i.duplicates+i.pending) as cuadra
from public.imports i where i.state in ('running','queued','partial') and i.updated_at<now()-interval '24 hours';

-- Cursores de sincronizacion con lease vencida.
select id, tenant_id, connection_id, mode, done, lease_until, lease_until<=now() as vencida, updated_at
from public.sync_cursors where not done and (lease_until is null or lease_until<=now()) order by updated_at;
