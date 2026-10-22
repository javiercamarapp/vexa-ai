-- 20261027000000 (PROPUESTA, NO APLICADA): economic_snapshot_digest produce EXACTAMENTE los mismos bytes y el mismo sha256, pero sin reconstruir el manifiesto (27 MB) dentro de jsonb_build_object.
-- Diagnóstico (23-oct, producción, solo lectura, snapshot f3937770: input_manifest 27 MB de texto, 10 MB comprimido en TOAST): la función corre en CADA lectura del snapshot (loadFresh).
--   Original: jsonb_build_object(... 'manifest', input_manifest ...)::text  = copia + reserialización de 27 MB: 1,352 ms (EXPLAIN ANALYZE, sin RLS).
--   Solo input_manifest::text: 280 ms; sha256 sobre ese texto: +50 ms. Esta versión: arma el esqueleto (todo menos el manifiesto, con un marcador) y pega input_manifest::text en el marcador: 434 ms (-68 %).
-- Equivalencia: jsonb::text es recursivo y sin sangrías; el manifiesto serializado solo equivale al serializado dentro del objeto. Verificado en producción para los 3 snapshots (a77406d8, d7010e91, f3937770):
--   sha256 de la versión original = sha256 de esta versión = content_hash almacenado. Prueba local: packages/workspace-service/tests/digest-una-pasada.test.mjs.
-- NO debilita nada: se sigue hasheando TODO el contenido (manifiesto completo y componentes) en cada lectura; no hay caché ni atajos. Fail-closed: si el marcador no aparece EXACTAMENTE una vez
--   en el esqueleto (datos que lo contuvieran), la función devuelve NULL, que nunca iguala a content_hash (snapshot_integrity_failed), igual que un contenido alterado.
-- Mismas guardas (tenant de la sesión, acción read + membresía, o import), SECURITY INVOKER, search_path vacío y GRANT solo a vexa_backend (CREATE OR REPLACE conserva los privilegios).
-- Reversa: packages/workspace-service/tests/20261027000000_snapshot_digest_single_pass.down.sql
begin;
set local lock_timeout='3s';
CREATE OR REPLACE FUNCTION public.economic_snapshot_digest(p_tenant uuid,p_snapshot uuid) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH skel AS MATERIALIZED (
  SELECT s.input_manifest AS m,jsonb_build_object('scope',s.provenance->'scope','exposure',s.provenance->'exposure','asOf',to_char(s.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'inputHash',s.input_hash,'manifest',to_jsonb('@@vexa-digest-manifest-slot-4c1f9e27@@'::text),'policy',s.policy_version,'schema',s.economic_schema_version,
  'components',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'metric',c.metric,'amount',c.amount_minor,'subtotal',c.known_subtotal_minor,'currency',c.currency,'exponent',c.exponent,'known',c.known_count,'total',c.total_count,'kind',c.kind,'provenance',c.provenance) ORDER BY c.metric,c.currency,c.id) FROM public.components c WHERE c.tenant_id=s.tenant_id AND c.snapshot_id=s.id),'[]'::jsonb))::text AS t
  FROM public.metric_snapshots s WHERE s.tenant_id=p_tenant AND s.id=p_snapshot AND p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND ((current_setting('vexa.action',true)='read' AND public.vexa_member(p_tenant)) OR public.vexa_backend_action(p_tenant,ARRAY['import']))
 )
 SELECT encode(sha256(convert_to(left(t,strpos(t,'"@@vexa-digest-manifest-slot-4c1f9e27@@"')-1)||m::text||substr(t,strpos(t,'"@@vexa-digest-manifest-slot-4c1f9e27@@"')+length('"@@vexa-digest-manifest-slot-4c1f9e27@@"')),'UTF8')),'hex')
 FROM skel WHERE length(t)-length(replace(t,'"@@vexa-digest-manifest-slot-4c1f9e27@@"',''))=length('"@@vexa-digest-manifest-slot-4c1f9e27@@"')
$$;
commit;
