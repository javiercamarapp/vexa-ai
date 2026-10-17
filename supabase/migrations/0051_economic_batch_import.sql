begin;
-- Server-side batch importer for the immutable economic ledger (<=250 entries
-- per call). It is the set-oriented twin of EconomicRepository.record()
-- (packages/metrics/repository.mjs): same validation, same stable entity id,
-- same expectedRevision / replay semantics, same append-only triggers
-- (economic_append_guard still fires for every row). It adds one transaction
-- boundary per batch: any invalid or conflicting entry aborts the whole call
-- with no partial write. No table, policy or guard is changed or loosened.
--
-- Callers must run `SET LOCAL statement_timeout` (e.g. '30000ms') in their own
-- transaction before calling: a function-level SET cannot extend the timer of
-- the statement that is already running (verified on PostgreSQL 17).

-- Pure helper: strict UTC instant exactly as the JS repository accepts it
-- (YYYY-MM-DDTHH:MM:SS[.f{1,3}]Z, must round-trip). Returns null when invalid.
create function public.economic_batch_instant(p text) returns timestamptz language plpgsql immutable set search_path='' as $$
declare norm text;ts timestamptz;
begin
 if p is null or p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$' then return null;end if;
 norm:=case when position('.' in p)>0 then regexp_replace(p,'\.([0-9]{1,3})Z$','.\1')||repeat('0',3-length(substring(p from '\.([0-9]{1,3})Z$')))||'Z' else replace(p,'Z','.000Z') end;
 ts:=p::timestamptz;
 if to_char(ts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>norm then return null;end if;
 return ts;
exception when others then return null;
end $$;

-- Pure helper: same derivation as stable([tenant,source,kind,externalId]) in
-- the JS repository (sha256 of the canonical JSON array, formatted as uuid).
create function public.economic_batch_entity_id(p_tenant uuid,p_source uuid,p_kind text,p_external text) returns uuid language sql immutable set search_path='' as $$
 select (substr(h,1,8)||'-'||substr(h,9,4)||'-5'||substr(h,14,3)||'-a'||substr(h,18,3)||'-'||substr(h,21,12))::uuid
 from (select encode(sha256(convert_to('['||to_json(p_tenant::text)::text||','||to_json(p_source::text)::text||','||to_json(p_kind)::text||','||to_json(p_external)::text||']','UTF8')),'hex') h) x
$$;

-- Pure validation of one entry. Returns null when valid, else the typed code
-- the per-record importer would have raised. Only kinds that can come from
-- bulk exports are accepted; support_model / future_scenario carry approved
-- manual details and stay on the per-record path.
create function public.economic_batch_entry_error(e jsonb) returns text language plpgsql immutable set search_path='' as $$
declare k text;kind text;st text;amt jsonb;rev boolean;
 allowed text[]:=array['expectedRevision','externalId','kind','effectiveAt','currency','exponent','basis','amountMinor','status','orderId','reversalOf','details','report','attested'];
begin
 if jsonb_typeof(e) is distinct from 'object' then return 'entry_invalid';end if;
 for k in select jsonb_object_keys(e) loop if k<>all(allowed) then return 'unsupported_field';end if;end loop;
 foreach k in array allowed loop if not e ? k then return 'entry_invalid';end if;end loop;
 if jsonb_typeof(e->'kind') is distinct from 'string' then return 'entry_invalid';end if;
 kind:=e->>'kind';
 if kind not in('order','refund','reversal','replacement') then return 'entry_invalid';end if;
 if jsonb_typeof(e->'expectedRevision') is distinct from 'number' or (e->>'expectedRevision')!~'^(0|[1-9][0-9]{0,8})$' then return 'entry_invalid';end if;
 if jsonb_typeof(e->'externalId') is distinct from 'string' or btrim(e->>'externalId',E' \t\n\r\f\v')='' or char_length(e->>'externalId')>200 then return 'entry_invalid';end if;
 if public.economic_batch_instant(case when jsonb_typeof(e->'effectiveAt')='string' then e->>'effectiveAt' end) is null then return 'entry_invalid';end if;
 if jsonb_typeof(e->'currency') is distinct from 'string' or (e->>'currency')!~'^[A-Z]{3}$' then return 'entry_invalid';end if;
 if jsonb_typeof(e->'exponent') is distinct from 'number' or (e->>'exponent')!~'^[0-4]$' then return 'entry_invalid';end if;
 if jsonb_typeof(e->'basis') is distinct from 'string' or btrim(e->>'basis',E' \t\n\r\f\v')='' or char_length(e->>'basis')>200 then return 'entry_invalid';end if;
 if jsonb_typeof(e->'report') is distinct from 'string' or char_length(e->>'report') not between 20 and 8000 or btrim(e->>'report',E' \t\n\r\f\v')='' then return 'entry_invalid';end if;
 if e->'attested' is distinct from 'true'::jsonb then return 'entry_invalid';end if;
 if e->'orderId' is distinct from 'null'::jsonb and (jsonb_typeof(e->'orderId') is distinct from 'string' or (e->>'orderId')!~*'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$') then return 'entry_invalid';end if;
 if e->'reversalOf' is distinct from 'null'::jsonb and (jsonb_typeof(e->'reversalOf') is distinct from 'string' or (e->>'reversalOf')!~*'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$') then return 'entry_invalid';end if;
 rev:=kind='reversal';amt:=e->'amountMinor';
 if rev then
  if not (amt='null'::jsonb or jsonb_typeof(amt)='string' and (e->>'amountMinor')~'^(0|-[1-9][0-9]{0,36})$') or e->'reversalOf'='null'::jsonb then return 'amount_or_reversal_invalid';end if;
 else
  if not (amt='null'::jsonb or jsonb_typeof(amt)='string' and (e->>'amountMinor')~'^(0|[1-9][0-9]{0,36})$') or e->'reversalOf'<>'null'::jsonb then return 'amount_or_reversal_invalid';end if;
 end if;
 -- Bulk kinds carry no details (exactKeys(details,[]) in the per-record path).
 if e->'details' is distinct from '{}'::jsonb then return 'unsupported_field';end if;
 if jsonb_typeof(e->'status') is distinct from 'string' then return 'status_invalid';end if;
 st:=e->>'status';
 if not (case when kind='order' then st in('recorded','pending','cancelled','unknown') else st in('settled','pending','cancelled','unknown') end) then return 'status_invalid';end if;
 return null;
end $$;

create function public.economic_batch_import(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;
 actor uuid:=auth.uid();src public.economic_source_versions;sid uuid;sver integer;
 e jsonb;i integer:=0;err text;ent uuid;old public.economic_ledger_entries;ts timestamptz;amt numeric;rev integer;oid uuid;rvo uuid;
 row_id uuid;inserted integer:=0;replayed integer:=0;out jsonb:='[]'::jsonb;
begin
 if t is null or actor is null or public.vexa_backend_action(t,array['configure']) is not true or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if jsonb_typeof(p) is distinct from 'object' or p-array['sourceId','sourceVersion','entries']<>'{}'::jsonb or not (p ?& array['sourceId','sourceVersion','entries'])
  or jsonb_typeof(p->'entries') is distinct from 'array' or jsonb_array_length(p->'entries') not between 1 and 250 or octet_length(p::text)>8388608
  then raise check_violation using message='ECONOMIC_BATCH_INVALID',detail='batch_shape_or_size';end if;
 if jsonb_typeof(p->'sourceId') is distinct from 'string' or (p->>'sourceId')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
  or jsonb_typeof(p->'sourceVersion') is distinct from 'number' or (p->>'sourceVersion')!~'^[1-9][0-9]{0,8}$'
  then raise check_violation using message='ECONOMIC_BATCH_INVALID',detail='source_reference_invalid';end if;
 sid:=(p->>'sourceId')::uuid;sver:=(p->>'sourceVersion')::integer;
 -- Pass 1: pure validation of every entry, before any lock or write.
 for e in select x from jsonb_array_elements(p->'entries') x loop
  i:=i+1;err:=public.economic_batch_entry_error(e);
  if err is not null then raise check_violation using message='ECONOMIC_BATCH_INVALID',detail=format('entry %s: %s',i,err);end if;
 end loop;
 -- Same tenant lock as record() and economic_append_guard (re-entrant).
 perform pg_advisory_xact_lock(hashtextextended(t::text||':economic-ledger',0));
 select * into src from public.economic_source_versions where tenant_id=t and source_id=sid order by version desc limit 1;
 if src.id is null or not src.active or src.version<>sver then raise check_violation using message='ECONOMIC_BATCH_SOURCE_UNAVAILABLE',detail='source_unavailable';end if;
 -- Pass 2: ordered append, identical to calling record() once per entry.
 i:=0;
 for e in select x from jsonb_array_elements(p->'entries') x loop
  i:=i+1;
  if src.evidence_type<>(case e->>'kind' when 'order' then 'order_export' when 'refund' then 'payment_ledger' when 'reversal' then 'payment_ledger' else 'replacement_invoice' end) then raise check_violation using message='ECONOMIC_BATCH_SOURCE_UNAVAILABLE',detail=format('entry %s: source_unavailable',i);end if;
  ent:=public.economic_batch_entity_id(t,sid,e->>'kind',e->>'externalId');
  ts:=public.economic_batch_instant(e->>'effectiveAt');
  amt:=case when e->'amountMinor'='null'::jsonb then null else (e->>'amountMinor')::numeric end;
  rev:=(e->>'expectedRevision')::integer;
  oid:=case when e->'orderId'='null'::jsonb then null else (e->>'orderId')::uuid end;
  rvo:=case when e->'reversalOf'='null'::jsonb then null else (e->>'reversalOf')::uuid end;
  select * into old from public.economic_ledger_entries where tenant_id=t and entity_id=ent order by revision desc limit 1;
  if old.id is not null and old.revision=rev+1
   and (old.source_id,old.external_id,old.kind,old.effective_at,old.currency,old.exponent,old.basis,old.amount_minor,old.status,old.order_id,old.reversal_of,old.details,old.report)
    is not distinct from (sid,e->>'externalId',e->>'kind',ts,e->>'currency',(e->>'exponent')::smallint,e->>'basis',amt,e->>'status',oid,rvo,e->'details',e->>'report') then
   replayed:=replayed+1;row_id:=old.id;
   out:=out||jsonb_build_object('index',i,'entityId',ent,'rowId',row_id,'revision',old.revision,'outcome','replayed');
   continue;
  end if;
  if coalesce(old.revision,0)<>rev then raise serialization_failure using message='ECONOMIC_BATCH_CONFLICT',detail=format('entry %s: entry_version_conflict',i);end if;
  insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,order_id,reversal_of,details,report,report_hash,attested)
  values(t,ent,sid,sver,rev+1,actor,e->>'externalId',e->>'kind',ts,e->>'currency',(e->>'exponent')::smallint,e->>'basis',amt,e->>'status',oid,rvo,e->'details',e->>'report',encode(sha256(convert_to(e->>'report','UTF8')),'hex'),true)
  returning id into row_id;
  inserted:=inserted+1;
  out:=out||jsonb_build_object('index',i,'entityId',ent,'rowId',row_id,'revision',rev+1,'outcome','inserted');
 end loop;
 return jsonb_build_object('processed',i,'inserted',inserted,'replayed',replayed,'entries',out);
end $$;

-- Close default execute privileges, then grant only the backend role.
revoke all on function public.economic_batch_instant(text),public.economic_batch_entity_id(uuid,uuid,text,text),public.economic_batch_entry_error(jsonb),public.economic_batch_import(jsonb) from public,anon,authenticated,service_role,vexa_backend;
grant execute on function public.economic_batch_import(jsonb) to vexa_backend;
commit;
