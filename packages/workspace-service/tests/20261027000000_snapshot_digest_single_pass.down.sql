-- Reversa de 20261027000000: vuelve a la definición original (0021).
begin;
set local lock_timeout='3s';
CREATE OR REPLACE FUNCTION public.economic_snapshot_digest(p_tenant uuid,p_snapshot uuid) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('scope',s.provenance->'scope','exposure',s.provenance->'exposure','asOf',to_char(s.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'inputHash',s.input_hash,'manifest',s.input_manifest,'policy',s.policy_version,'schema',s.economic_schema_version,
 'components',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'metric',c.metric,'amount',c.amount_minor,'subtotal',c.known_subtotal_minor,'currency',c.currency,'exponent',c.exponent,'known',c.known_count,'total',c.total_count,'kind',c.kind,'provenance',c.provenance) ORDER BY c.metric,c.currency,c.id) FROM public.components c WHERE c.tenant_id=s.tenant_id AND c.snapshot_id=s.id),'[]'::jsonb))::text,'UTF8')),'hex')
 FROM public.metric_snapshots s WHERE s.tenant_id=p_tenant AND s.id=p_snapshot AND p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid AND ((current_setting('vexa.action',true)='read' AND public.vexa_member(p_tenant)) OR public.vexa_backend_action(p_tenant,ARRAY['import']))
$$;
commit;
