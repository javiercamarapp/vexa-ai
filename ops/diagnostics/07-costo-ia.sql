-- SOLO LECTURA. Gasto de IA registrado en el ledger de presupuesto (montos en unidades menores, ver ai_budget_limits). Cuadrar con el panel de OpenRouter.
select l.* from public.ai_budget_limits l order by 1 limit 20;
select state, count(*) as n, sum(held_minor) as retenido, sum(actual_minor) as real, sum(reported_minor) as reportado
from public.ai_budget_reservations group by state order by state;
-- Reservas inciertas o sin liquidar hace mas de 1 h (dinero retenido sin cerrar).
select id, tenant_id, purpose, state, held_minor, actual_minor, created_at
from public.ai_budget_reservations where state in ('reserved','uncertain') and created_at<now()-interval '1 hour' order by created_at;
