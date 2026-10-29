-- RLS-01 (cierre de seguridad 29-oct): decisión de producto sobre lo que ve el LECTOR (viewer) y el OPERADOR por la API de datos directa.
-- Antes: la política member_read de cada tabla dejaba leer a CUALQUIER miembro activo (incluido el lector) texto redactado,
-- nombres de clientes, embeddings e import_rows con su JWT y la anon key pública, saltándose la aplicación.
-- Decisión (documentada en docs/entrega/DECISION-LECTOR-RLS-01.md):
--   * owner y analyst: lectura directa sin cambios (lo mismo que ya ven en la aplicación).
--   * operator: solo salidas agregadas publicadas más las tablas de su trabajo (interventions, measurement_plans).
--   * viewer: solo salidas agregadas que el producto publica (recommendations, weekly_briefs, metric_snapshots,
--     economic_snapshot_heads, problems, problem_versions) y su propia identidad (memberships, organizations).
-- La aplicación NO lee estas tablas por la API directa (usa el pool de servidor con el rol vexa_backend, que tiene su propia política),
-- por lo que esta migración no cambia lo que muestra ninguna pantalla. Hoy no existen cuentas de lector en producción.
-- Mecanismo: política RESTRICTIVE (se suma con AND a las permisivas y restrictivas existentes, que no se tocan) solo para el rol authenticated.
-- Reversión: drop policy role_scoped_direct_read on public.<tabla> (lista en el bloque; ver APLICAR.md).
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$
declare
 -- Solo owner y analyst
 strict_tables text[]:=array['assumptions','attachment_blobs','attachment_links','attempts','attributions','audit_events','checkpoints','components','connections',
  'conversations','cost_rates','customers','dead_letters','economic_events','embeddings','evidence_spans','external_aliases','extraction_runs','import_rows','import_uploads',
  'imports','issues','jobs','message_revisions','messages','order_lines','orders','outbox','problem_conversations','products','reversals','tombstones'];
 -- owner, analyst y operator
 work_tables text[]:=array['interventions','measurement_plans'];
 t text;
begin
 foreach t in array strict_tables loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='tenant_id') then
   raise exception 'RLS-01: la tabla % no tiene tenant_id',t; end if;
  execute format('create policy role_scoped_direct_read on public.%I as restrictive for select to authenticated using (public.vexa_member(tenant_id,array[''owner'',''analyst'']))',t);
  execute format('comment on policy role_scoped_direct_read on public.%I is %L',t,'RLS-01: lectura directa solo owner/analyst; viewer y operator leen por la aplicación (agregados).');
 end loop;
 foreach t in array work_tables loop
  execute format('create policy role_scoped_direct_read on public.%I as restrictive for select to authenticated using (public.vexa_member(tenant_id,array[''owner'',''analyst'',''operator'']))',t);
  execute format('comment on policy role_scoped_direct_read on public.%I is %L',t,'RLS-01: lectura directa owner/analyst/operator; el lector lee por la aplicación (agregados).');
 end loop;
end $$;
commit;
