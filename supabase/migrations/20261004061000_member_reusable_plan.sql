-- Synthetic local equivalence and ABBA reviewed separately; no capacity claim.
DO $migration$
DECLARE before_meta jsonb; after_meta jsonb; before_rls jsonb;
BEGIN
 SELECT to_jsonb(p) INTO STRICT before_meta FROM pg_proc p WHERE oid='public.vexa_member(uuid,text[])'::regprocedure;
 IF (SELECT lanname FROM pg_language WHERE oid=(before_meta->>'prolang')::oid) <> 'sql' OR before_meta->>'prosrc' IS DISTINCT FROM $expected$
 select exists(select 1 from public.memberships m where m.tenant_id=p_tenant
 and m.user_id=(select public.vexa_request_uid()) and m.status='active' and m.role=any(p_roles))
$expected$ THEN RAISE EXCEPTION 'VEXA_MEMBER_SOURCE_DRIFT'; END IF;
 SELECT jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity,'owner',relowner,'acl',relacl) INTO before_rls FROM pg_class WHERE oid='public.memberships'::regclass;
 EXECUTE $definition$CREATE OR REPLACE FUNCTION public.vexa_member(p_tenant uuid, p_roles text[] DEFAULT ARRAY['owner'::text, 'analyst'::text, 'operator'::text, 'viewer'::text])
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
BEGIN RETURN exists(select 1 from public.memberships m where m.tenant_id=p_tenant
 and m.user_id=(select public.vexa_request_uid()) and m.status='active' and m.role=any(p_roles)); END;
$function$
;$definition$;
 SELECT to_jsonb(p) INTO STRICT after_meta FROM pg_proc p WHERE oid='public.vexa_member(uuid,text[])'::regprocedure;
 IF before_meta-'prolang'-'prosrc' IS DISTINCT FROM after_meta-'prolang'-'prosrc' THEN RAISE EXCEPTION 'VEXA_MEMBER_METADATA_DRIFT'; END IF;
 IF before_rls IS DISTINCT FROM (SELECT jsonb_build_object('enabled',relrowsecurity,'forced',relforcerowsecurity,'owner',relowner,'acl',relacl) FROM pg_class WHERE oid='public.memberships'::regclass) THEN RAISE EXCEPTION 'VEXA_MEMBER_RLS_DRIFT'; END IF;
END
$migration$;
