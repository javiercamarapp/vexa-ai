begin;
alter table public.interventions add column plan_id uuid,add column actual_start timestamptz,add column actual_end timestamptz,add column approved_at timestamptz,add column last_actor_id uuid,add column last_request_key text,add column last_fingerprint text,add column result_id uuid,add column measurement_cycle integer not null default 0 check(measurement_cycle>=0);
alter table public.interventions add foreign key(tenant_id,plan_id) references public.measurement_plans(tenant_id,id) on delete restrict,add foreign key(tenant_id,last_actor_id) references public.memberships(tenant_id,user_id) on delete restrict;
create table public.intervention_events(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,intervention_id uuid not null,version integer not null,actor_id uuid not null,request_key text not null,fingerprint text not null,definition jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),unique(tenant_id,intervention_id,version),unique(tenant_id,intervention_id,request_key),foreign key(tenant_id) references public.organizations(id),foreign key(tenant_id,intervention_id) references public.interventions(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id));
create table public.intervention_results(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,intervention_id uuid not null,plan_id uuid not null,post_snapshot_id uuid not null,actor_id uuid not null,measurement_cycle integer not null check(measurement_cycle>0),result jsonb not null default '{}',created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),foreign key(tenant_id) references public.organizations(id),foreign key(tenant_id,intervention_id) references public.interventions(tenant_id,id),foreign key(tenant_id,plan_id) references public.measurement_plans(tenant_id,id),foreign key(tenant_id,post_snapshot_id) references public.metric_snapshots(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id));
alter table public.interventions add foreign key(tenant_id,result_id) references public.intervention_results(tenant_id,id);
create function public.intervention_inputs_current(t uuid,sid uuid,refs jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare snap public.metric_snapshots; ref jsonb; input jsonb; run public.extraction_runs; c record; m record; source_row record; current_actor uuid; current_active boolean; keys text[]; identity_text text; entity text; external_key text;
begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or current_setting('vexa.action',true) not in ('read','propose','approve','execute') or not public.vexa_member(t) then return false;end if;
 select * into snap from public.metric_snapshots where tenant_id=t and id=sid;
 if snap.id is null or snap.status<>'published' or jsonb_typeof(refs) is distinct from 'array' then return false;end if;
 if not exists(select 1 from public.memberships where tenant_id=t and user_id=snap.created_by and status='active' and role='owner') or not exists(select 1 from public.memberships where tenant_id=t and user_id=snap.published_by and status='active' and role='owner') then return false;end if;
 for ref in select value from jsonb_array_elements(snap.input_manifest->'refs') loop
  if ref->'authorized'='true'::jsonb and not exists(select 1 from public.memberships where tenant_id=t and user_id=(ref->>'actorId')::uuid and status='active' and role='owner') then return false;end if;
  if ref->'authorized'='true'::jsonb and ref->'active'='true'::jsonb then
   current_actor=null;current_active=null;
   if ref->>'table'='economic_source_versions' then
    select latest.actor_id,latest.active into current_actor,current_active from public.economic_source_versions original join lateral(select actor_id,active from public.economic_source_versions v where v.tenant_id=t and v.source_id=original.source_id order by version desc limit 1) latest on true where original.tenant_id=t and original.id=(ref->>'id')::uuid;
   elsif ref->>'table'='economic_currency_versions' then
    select latest.actor_id,latest.active into current_actor,current_active from public.economic_currency_versions original join lateral(select actor_id,active from public.economic_currency_versions v where v.tenant_id=t and v.currency=original.currency order by version desc limit 1) latest on true where original.tenant_id=t and original.id=(ref->>'id')::uuid;
   elsif ref->>'table'='economic_fx_versions' then
    select latest.actor_id,latest.active into current_actor,current_active from public.economic_fx_versions original join lateral(select actor_id,active from public.economic_fx_versions v where v.tenant_id=t and v.rate_id=original.rate_id order by version desc limit 1) latest on true where original.tenant_id=t and original.id=(ref->>'id')::uuid;
   else continue;end if;
   if current_active is distinct from true or not exists(select 1 from public.memberships where tenant_id=t and user_id=current_actor and status='active' and role='owner') then return false;end if;
  end if;
 end loop;
 for ref in select value from jsonb_array_elements(snap.input_manifest->'models') loop
  select * into run from public.extraction_runs where tenant_id=t and id=(ref->>'id')::uuid;
  if run.id is null or run.status<>'succeeded' or jsonb_typeof(run.provenance->'input_manifest') is distinct from 'array' or jsonb_array_length(run.provenance->'input_manifest')=0 then return false;end if;
  select v.*,n.account_id,n.status as connection_status,h.state as head_state into c from public.conversations v join public.connections n on n.tenant_id=v.tenant_id and n.id=v.connection_id left join public.source_heads h on h.tenant_id=v.tenant_id and h.id=v.id where v.tenant_id=t and v.id=run.conversation_id;
  if c.id is null or c.deleted_at is not null or c.connection_status<>'active' or c.head_state is null or c.head_state not in ('unique','selected','ambiguous') then return false;end if;
  keys=array[c.id::text,c.external_id];
  select '['||string_agg(to_json(v)::text,',' order by ord)||']' into identity_text from unnest(array['v1',t::text,c.connection_id::text,c.source,c.account_id,'conversation',c.external_id]) with ordinality a(v,ord);
  keys=keys||array[identity_text,encode(sha256(convert_to(identity_text,'UTF8')),'hex')];
  for input in select value from jsonb_array_elements(run.provenance->'input_manifest') loop
   select r.id,r.message_id,r.hash,r.redacted_text,r.redaction_version,r.deleted_at,o.id as original_id,o.message_id as original_message_id,o.deleted_at as original_deleted,v.deleted_at as message_deleted,v.connection_id,v.external_id,sr.canonical_id,sr.connection_id as source_connection,sr.snapshot,h.state as head_state into m from public.message_revisions r join public.message_revisions o on o.tenant_id=r.tenant_id and o.id::text=r.provenance->>'original_revision_id' join public.messages v on v.tenant_id=r.tenant_id and v.id=r.message_id join public.source_revisions sr on sr.tenant_id=o.tenant_id and sr.message_revision_id=o.id and sr.entity_type='message' left join public.source_heads h on h.tenant_id=v.tenant_id and h.id=v.id where r.tenant_id=t and r.id=(input->>'message_revision_id')::uuid;
   if m.id is null or m.deleted_at is not null or m.original_deleted is not null or m.message_deleted is not null or m.redaction_version is null or m.original_id::text is distinct from input->>'original_revision_id' or m.message_id<>m.original_message_id or m.canonical_id<>m.message_id or m.connection_id<>c.connection_id or m.source_connection<>c.connection_id or m.head_state is null or m.head_state not in ('unique','selected','ambiguous') or m.hash is distinct from input->>'hash' or encode(sha256(convert_to(m.redacted_text,'UTF8')),'hex') is distinct from input->>'hash' or (select count(*) from jsonb_array_elements(m.snapshot) x where x->>'table'='messages' and x->'row'->>'id'=m.message_id::text and x->'row'->>'role'=input->>'role' and x->'row'->>'conversation_id'=run.conversation_id::text)<>1 then return false;end if;
   keys=keys||array[m.id::text,m.original_id::text,m.message_id::text,m.external_id];
   select '['||string_agg(to_json(v)::text,',' order by ord)||']' into identity_text from unnest(array['v1',t::text,c.connection_id::text,c.source,c.account_id,'message',m.external_id]) with ordinality a(v,ord);
   keys=keys||array[identity_text,encode(sha256(convert_to(identity_text,'UTF8')),'hex')];
  end loop;
  if exists(select 1 from public.tombstones where tenant_id=t and (connection_id is null or connection_id=c.connection_id) and deleted_source_key=any(keys)) then return false;end if;
 end loop;
 return true;
end $$;
revoke all on function public.intervention_inputs_current(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.intervention_inputs_current(uuid,uuid,jsonb) to vexa_backend;

create function public.intervention_member(t uuid,u uuid,roles text[] default array['owner','analyst','operator']) returns boolean language sql stable security definer set search_path='' as $$select coalesce(t=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','propose','approve','execute') and public.vexa_member(t) and exists(select 1 from public.memberships where tenant_id=t and user_id=u and status='active' and role=any(roles)),false)$$;
revoke all on function public.intervention_member(uuid,uuid,text[]) from public,anon,authenticated,service_role;grant execute on function public.intervention_member(uuid,uuid,text[]) to vexa_backend;
create function public.intervention_authorized(t uuid,iid uuid) returns boolean language plpgsql stable security definer set search_path='' as $$declare i public.interventions;r jsonb;begin
select * into i from public.interventions where tenant_id=t and id=iid;if i.id is null or i.provenance->>'kind' is distinct from 'recommendation-draft-v1' then return false;end if;r=i.provenance->'definition';
if public.intervention_member(t,(i.provenance->>'actorId')::uuid) is not true or public.intervention_inputs_current(t,i.baseline_ref,r->'evidence_refs') is not true then return false;end if;
if exists(select 1 from public.recommendation_versions h where h.tenant_id=t and h.recommendation_id=i.recommendation_id and h.version<=i.recommendation_version and public.intervention_member(t,h.actor_id) is not true) then return false;end if;return true;end $$;
revoke all on function public.intervention_authorized(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.intervention_authorized(uuid,uuid) to vexa_backend;
create function public.intervention_canonical(id uuid,aliases jsonb) returns uuid language plpgsql immutable set search_path='' as $$declare seen uuid[]='{}';begin while aliases ? id::text loop if id=any(seen) then raise check_violation;end if;seen=array_append(seen,id);id=(aliases->>id::text)::uuid;end loop;return id;end $$;
revoke all on function public.intervention_canonical(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.intervention_projection(t uuid,sid uuid,f jsonb,metric text,mids uuid[] default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snap public.metric_snapshots;refs uuid[];sourceids uuid[];orderids uuid[]='{}';selected uuid[]='{}';uncertain uuid[]='{}';eventids uuid[]='{}';aliases jsonb='{}';r record;a record;d record;family text;family_count integer;covered boolean;order_covered boolean;subtotal numeric=0;known integer=0;eligible integer=0;unknown boolean=false;blocked boolean=false;missing text[]='{}';sku_known boolean;source_known boolean;sku_match boolean;source_match boolean;sku_set text[];source_set text[];orderkey uuid;nextkey uuid;visited uuid[];amount numeric;reversal_sum numeric;customer_count integer;customer_covered boolean;
begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or current_setting('vexa.action',true) not in ('read','propose','approve','execute') or not public.vexa_member(t) or metric not in ('allOrders','exposure','refunds') then raise insufficient_privilege;end if;
 select * into snap from public.metric_snapshots where tenant_id=t and id=sid and status='published';if snap.id is null then raise check_violation;end if;if public.intervention_inputs_current(t,sid,'[]') is not true then raise insufficient_privilege;end if;
 select array_agg((x->>'id')::uuid) into refs from jsonb_array_elements(snap.input_manifest->'refs') x where x->'authorized'='true' and x->'active'='true';refs=coalesce(refs,'{}');
 select coalesce(array_agg(source_id),'{}') into sourceids from public.economic_source_versions where tenant_id=t and id=any(refs) and active;
 if mids is null then select coalesce(array_agg(id),'{}') into mids from(select distinct on(ledger_row_id) id,active from public.workspace_order_dimension_versions where tenant_id=t and ledger_row_id=any(refs) order by ledger_row_id,version desc) x where active;end if;
 if exists(select 1 from public.workspace_order_dimension_versions where tenant_id=t and id=any(mids) and public.intervention_member(t,actor_id,array['owner']) is not true) or cardinality(mids)<>(select count(*) from public.workspace_order_dimension_versions where tenant_id=t and id=any(mids) and ledger_row_id=any(refs) and active) then raise insufficient_privilege;end if;
 select coalesce(jsonb_object_agg(alias_entity_id::text,canonical_entity_id::text),'{}') into aliases from public.economic_order_aliases where tenant_id=t and id=any(refs) and active;
 for r in select distinct public.intervention_canonical(entity_id,aliases) as id from public.economic_ledger_entries where tenant_id=t and id=any(refs) and source_id=any(sourceids) and kind='order' loop
  select * into a from public.economic_ledger_entries where tenant_id=t and id=any(refs) and entity_id=r.id and kind='order';if a.id is null then raise check_violation;end if;
  orderids=array_append(orderids,r.id);
  if a.currency<>f->>'currency' or a.exponent<>(f->>'exponent')::integer or a.basis<>f->>'basis' or a.effective_at<snap.date_start or a.effective_at>=snap.date_end or a.recorded_at>snap.as_of or a.status in ('pending','cancelled') then continue;end if;
  select count(distinct (select array_agg(v order by v) from unnest(m.skus) v))=1 and count(m.skus)>0 into sku_known from public.workspace_order_dimension_versions m join public.economic_ledger_entries e on e.tenant_id=m.tenant_id and e.id=m.ledger_row_id where m.tenant_id=t and m.id=any(mids) and public.intervention_canonical(e.entity_id,aliases)=a.entity_id;
  select m.skus into sku_set from public.workspace_order_dimension_versions m join public.economic_ledger_entries e on e.tenant_id=m.tenant_id and e.id=m.ledger_row_id where m.tenant_id=t and m.id=any(mids) and m.skus is not null and public.intervention_canonical(e.entity_id,aliases)=a.entity_id limit 1;
  select array_agg(distinct m.source) filter(where m.source is not null) into source_set from public.workspace_order_dimension_versions m join public.economic_ledger_entries e on e.tenant_id=m.tenant_id and e.id=m.ledger_row_id where m.tenant_id=t and m.id=any(mids) and public.intervention_canonical(e.entity_id,aliases)=a.entity_id;
  source_known=coalesce(cardinality(source_set),0)=1;
  sku_match=case when jsonb_array_length(f->'sku')=0 then true when sku_known then exists(select 1 from jsonb_array_elements_text(f->'sku') x where x=any(sku_set)) else null end;
  source_match=case when jsonb_array_length(f->'source')=0 then true when source_known then exists(select 1 from jsonb_array_elements_text(f->'source') x where x=any(source_set)) else null end;
  if sku_match=false or source_match=false then continue;end if;
  if sku_match is null or source_match is null then uncertain=array_append(uncertain,a.entity_id);else selected=array_append(selected,a.entity_id);end if;
 end loop;
 family=case when metric='refunds' then 'payment_ledger' else 'order_export' end;
 select count(*),coalesce(bool_and(complete and window_start<=snap.date_start and window_end>=snap.date_end and watermark>=snap.date_end),false) into family_count,covered from public.economic_source_versions where tenant_id=t and id=any(refs) and active and evidence_type=family;
 select coalesce(bool_and(complete and window_start<=snap.date_start and window_end>=snap.date_end and watermark>=snap.date_end),false) into order_covered from public.economic_source_versions where tenant_id=t and id=any(refs) and active and evidence_type='order_export';
 if not covered then missing=array_append(missing,'SOURCE_INCOMPLETE');end if;if snap.as_of<snap.date_end then missing=array_append(missing,'WINDOW_INCOMPLETE');end if;if cardinality(uncertain)>0 then missing=array_append(missing,'DIMENSION_MEMBERSHIP_UNKNOWN');end if;
 if metric='exposure' and not exists(select 1 from public.economic_relation_coverage where tenant_id=t and id=any(refs) and complete and input_hash=snap.input_manifest->>'exposureInputHash' and scope=snap.provenance->'scope') then missing=array_append(missing,'relation_coverage_unconfirmed');end if;
 if metric<>'refunds' and exists(select 1 from public.economic_ledger_entries where tenant_id=t and id=any(refs) and entity_id=any(selected) and status='unknown') then blocked=true;missing=array_append(missing,'STATUS_UNKNOWN');end if;
 for a in select * from public.economic_ledger_entries where tenant_id=t and id=any(refs) and source_id=any(sourceids) and currency=f->>'currency' and exponent=(f->>'exponent')::integer and basis=f->>'basis' and effective_at>=snap.date_start and effective_at<snap.date_end and recorded_at<=snap.as_of and status not in ('pending','cancelled') loop
  if metric<>'refunds' then
   if a.kind<>'order' or a.entity_id<>public.intervention_canonical(a.entity_id,aliases) or not(a.entity_id=any(selected)) then continue;end if;
   if metric='exposure' and not exists(select 1 from public.economic_problem_links l where l.tenant_id=t and l.id=any(refs) and l.active and public.intervention_canonical(l.entity_id,aliases)=a.entity_id) then continue;end if;
  else
   if a.kind not in ('refund','reversal') then continue;end if;
   orderkey=a.order_id;nextkey=a.reversal_of;visited=array[a.entity_id];
   while orderkey is null and nextkey is not null loop
    if nextkey=any(visited) then missing=array_append(missing,'REVERSAL_CONFLICT');exit;end if;visited=array_append(visited,nextkey);
    select * into d from public.economic_ledger_entries where tenant_id=t and id=any(refs) and entity_id=nextkey;orderkey=d.order_id;nextkey=d.reversal_of;
   end loop;
   if orderkey is null or not(public.intervention_canonical(orderkey,aliases)=any(orderids)) or public.intervention_canonical(orderkey,aliases)=any(uncertain) then missing=array_append(missing,'DIMENSION_MEMBERSHIP_UNKNOWN');continue;end if;
   if not(public.intervention_canonical(orderkey,aliases)=any(selected)) then continue;end if;
   if a.kind='reversal' then
    select * into d from public.economic_ledger_entries where tenant_id=t and id=any(refs) and entity_id=a.reversal_of and kind='refund' and status='settled' and currency=a.currency and exponent=a.exponent and basis=a.basis and effective_at>=snap.date_start and effective_at<snap.date_end;
    if d.id is null then missing=array_append(missing,'REVERSAL_ORPHAN');continue;end if;
    select -sum(amount_minor) into reversal_sum from public.economic_ledger_entries where tenant_id=t and id=any(refs) and reversal_of=a.reversal_of and kind='reversal' and status='settled';
    if reversal_sum>d.amount_minor then missing=array_append(missing,'REVERSAL_EXCESS');end if;
   end if;
  end if;
  eventids=array_append(eventids,a.entity_id);if a.status='unknown' then blocked=true;missing=array_append(missing,'STATUS_UNKNOWN');end if;
  eligible=eligible+1;if a.amount_minor is null or a.status='unknown' then unknown=true;else subtotal=subtotal+a.amount_minor;known=known+1;end if;
 end loop;
 if metric='refunds' then
  if 'REVERSAL_ORPHAN'=any(missing) or 'REVERSAL_EXCESS'=any(missing) or 'REVERSAL_CONFLICT'=any(missing) then blocked=true;end if;
  subtotal=0;known=0;eligible=0;unknown=false;
  for a in select * from public.economic_ledger_entries where tenant_id=t and id=any(refs) and entity_id=any(eventids) and kind='refund' and status='settled' loop
   eligible=eligible+1;select coalesce(sum(amount_minor),0) into amount from public.economic_ledger_entries where tenant_id=t and id=any(refs) and entity_id=any(eventids) and kind='reversal' and reversal_of=a.entity_id and status='settled';
   if a.amount_minor is null or exists(select 1 from public.economic_ledger_entries where tenant_id=t and id=any(refs) and entity_id=any(eventids) and kind='reversal' and reversal_of=a.entity_id and amount_minor is null) then unknown=true;else subtotal=subtotal+a.amount_minor+amount;known=known+1;end if;
  end loop;
 end if;
 if unknown then missing=array_append(missing,'AMOUNT_UNKNOWN');end if;
 select coalesce(array_agg(distinct x order by x),'{}') into missing from unnest(missing) x;
 select count(distinct c.customer_key),count(distinct public.intervention_canonical(c.entity_id,aliases))=cardinality(selected) into customer_count,customer_covered from public.economic_order_customers c where c.tenant_id=t and c.id=any(refs) and c.customer_key is not null and public.intervention_canonical(c.entity_id,aliases)=any(selected);
 if exists(select 1 from public.economic_order_customers c where c.tenant_id=t and c.id=any(refs) and c.customer_key is not null and public.intervention_canonical(c.entity_id,aliases)=any(selected) group by public.intervention_canonical(c.entity_id,aliases) having count(distinct c.customer_key)>1) then customer_covered=false;end if;
 return jsonb_build_object('customerDenominator',case when order_covered and cardinality(uncertain)=0 and customer_covered then customer_count else null end,'amountMinor',case when cardinality(missing)=0 then subtotal::text else null end,'knownSubtotalMinor',case when family_count>0 and not blocked then subtotal::text else null end,'knownCount',known,'totalCount',eligible,'selectedCount',cardinality(selected),'denominator',case when order_covered and cardinality(uncertain)=0 then cardinality(selected) else null end,'missingReasons',to_jsonb(missing),'status',case when cardinality(missing)=0 then 'complete' when family_count>0 and not blocked then 'partial' else 'unavailable' end,'mappingIds',to_jsonb(mids));
end $$;
revoke all on function public.intervention_projection(uuid,uuid,jsonb,text,uuid[]) from public,anon,authenticated,service_role;grant execute on function public.intervention_projection(uuid,uuid,jsonb,text,uuid[]) to vexa_backend;
create function public.intervention_result_compute(t uuid,iid uuid,post_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i public.interventions;p public.measurement_plans;b public.metric_snapshots;post public.metric_snapshots;before_metric jsonb;after_metric jsonb;f jsonb;reasons text[]='{}';delta numeric;begin
 if public.intervention_authorized(t,iid) is not true then raise insufficient_privilege;end if;
 select * into i from public.interventions where tenant_id=t and id=iid;select * into p from public.measurement_plans where tenant_id=t and id=i.plan_id;
 select * into b from public.metric_snapshots where tenant_id=t and id=p.baseline_ref and status='published';select * into post from public.metric_snapshots where tenant_id=t and id=post_id and status='published';
 if b.id is null or post.id is null or i.actual_end is null or post.date_start<i.actual_end or post.date_end<=post.date_start then raise check_violation;end if;
 if public.intervention_inputs_current(t,b.id,i.provenance->'definition'->'evidence_refs') is not true or public.intervention_inputs_current(t,post.id,i.provenance->'definition'->'evidence_refs') is not true then raise insufficient_privilege;end if;
 f=p.provenance->'filters';
 if (b.provenance->'scope')-array['start','end'] is distinct from (post.provenance->'scope')-array['start','end'] then reasons=array_append(reasons,'SCOPE_MISMATCH');end if;
 if b.policy_version is distinct from post.policy_version or b.economic_schema_version is distinct from post.economic_schema_version or (select coalesce(jsonb_agg(distinct (x-'id') order by (x-'id')),'[]') from jsonb_array_elements(b.input_manifest->'models') x) is distinct from (select coalesce(jsonb_agg(distinct (x-'id') order by (x-'id')),'[]') from jsonb_array_elements(post.input_manifest->'models') x) then reasons=array_append(reasons,'METRIC_VERSION_MISMATCH');end if;
 if b.date_end-b.date_start<>post.date_end-post.date_start then reasons=array_append(reasons,'WINDOW_DURATION_MISMATCH');end if;
 if post.as_of<post.date_end+make_interval(days=>(p.provenance->'plan'->>'maturityDays')::integer) then reasons=array_append(reasons,'OBSERVATION_IMMATURE');end if;
 before_metric=public.intervention_projection(t,b.id,f,p.provenance->'plan'->>'outcome',array(select jsonb_array_elements_text(p.provenance->'baselineMappingIds')::uuid));
 after_metric=public.intervention_projection(t,post.id,f,p.provenance->'plan'->>'outcome');
 if before_metric->>'status'<>'complete' or after_metric->>'status'<>'complete' then reasons=array_append(reasons,'COVERAGE_INCOMPLETE');end if;
 if p.unit='customer' then before_metric=jsonb_set(before_metric,'{denominator}',before_metric->'customerDenominator');after_metric=jsonb_set(after_metric,'{denominator}',after_metric->'customerDenominator');end if;
 if before_metric->>'denominator' is null or after_metric->>'denominator' is null or (before_metric->>'denominator')::integer=0 or (after_metric->>'denominator')::integer=0 then reasons=array_append(reasons,'DENOMINATOR_UNAVAILABLE');end if;
 if cardinality(reasons)=0 then delta=(after_metric->>'amountMinor')::numeric-(before_metric->>'amountMinor')::numeric;end if;
 return jsonb_build_object('baselineSnapshotId',b.id,'postSnapshotId',post.id,'baselineContentHash',b.content_hash,'postContentHash',post.content_hash,'method','before_after','interpretation','association-not-causal-savings','benefitsAreAdditive',false,'currency',f->>'currency','exponent',(f->>'exponent')::integer,'baselineAmountMinor',before_metric->'amountMinor','postAmountMinor',after_metric->'amountMinor','baselineKnownSubtotalMinor',before_metric->'knownSubtotalMinor','postKnownSubtotalMinor',after_metric->'knownSubtotalMinor','deltaMinor',delta::text,'status',case when cardinality(reasons)=0 then 'complete' else 'partial' end,'reasons',to_jsonb(reasons),'baselineDenominator',before_metric->'denominator','postDenominator',after_metric->'denominator','causallyAttributedIncrementalMargin',null,'baselineProjection',before_metric,'postProjection',after_metric,'metricDefinitionVersion',p.provenance->'plan'->>'metricDefinitionVersion','population',p.population_ref,'unit',p.unit,'controlPlan',p.provenance->'plan'->>'controlPlan','concurrentChanges',p.provenance->'plan'->>'concurrentChanges');
end $$;
revoke all on function public.intervention_result_compute(uuid,uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.intervention_result_compute(uuid,uuid,uuid) to vexa_backend;
-- Recheck authors of captured financial dimensions independently of operational actors.
create function public.intervention_result_mappings_current(t uuid,r jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare side text;sid uuid;ids uuid[];snap public.metric_snapshots;
begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or current_setting('vexa.action',true) not in ('read','propose','approve','execute') or not public.vexa_member(t) then return false;end if;
 for side in select unnest(array['baseline','post']) loop
  if jsonb_typeof(r->(side||'Projection')->'mappingIds') is distinct from 'array' or jsonb_typeof(r->(side||'SnapshotId')) is distinct from 'string' then return false;end if;
  sid=(r->>(side||'SnapshotId'))::uuid;
  if public.intervention_inputs_current(t,sid,'[]') is not true then return false;end if;
  select * into snap from public.metric_snapshots where tenant_id=t and id=sid and status='published';if snap.id is null then return false;end if;
  select coalesce(array_agg(value::uuid),'{}') into ids from jsonb_array_elements_text(r->(side||'Projection')->'mappingIds');
  if cardinality(ids)<>(select count(*) from public.workspace_order_dimension_versions m where m.tenant_id=t and m.id=any(ids) and m.active and public.intervention_member(t,m.actor_id,array['owner']) and exists(select 1 from jsonb_array_elements(snap.input_manifest->'refs') ref where ref->>'table'='economic_ledger_entries' and (ref->>'id')::uuid=m.ledger_row_id and ref->'authorized'='true'::jsonb and ref->'active'='true'::jsonb)) then return false;end if;
 end loop;
 return true;
end $$;
revoke all on function public.intervention_result_mappings_current(uuid,jsonb) from public,anon,authenticated,service_role;grant execute on function public.intervention_result_mappings_current(uuid,jsonb) to vexa_backend;
create function public.intervention_result_guard() returns trigger language plpgsql security definer set search_path='' as $$declare i public.interventions;begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;select * into i from public.interventions where tenant_id=new.tenant_id and id=new.intervention_id for update;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or current_setting('vexa.action',true) is distinct from 'execute' or new.actor_id is distinct from auth.uid() or i.status is distinct from 'measuring' or new.plan_id is distinct from i.plan_id or not(public.vexa_member(new.tenant_id,array['owner']) or (public.vexa_member(new.tenant_id,array['operator']) and i.owner_id=auth.uid())) or public.intervention_member(new.tenant_id,i.owner_id,array['owner','operator']) is not true then raise insufficient_privilege;end if;
 new.measurement_cycle=i.measurement_cycle;new.result=public.intervention_result_compute(new.tenant_id,new.intervention_id,new.post_snapshot_id);new.created_at=clock_timestamp();return new;end $$;
create trigger intervention_result_guard before insert or update or delete on public.intervention_results for each row execute function public.intervention_result_guard();revoke all on function public.intervention_result_guard() from public,anon,authenticated,service_role;
create function public.intervention_plan_guard() returns trigger language plpgsql security definer set search_path='' as $$declare i public.interventions;b public.metric_snapshots;context public.metric_snapshots;binding public.workspace_scope_bindings;p jsonb;projected jsonb;begin
 select * into i from public.interventions where tenant_id=coalesce(new.tenant_id,old.tenant_id) and id=coalesce(new.intervention_id,old.intervention_id) for update;
 if i.provenance->>'kind' is distinct from 'recommendation-draft-v1' then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 if current_setting('vexa.action',true) is distinct from 'propose' or new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or not public.vexa_member(new.tenant_id,array['owner','analyst','operator']) or i.status<>'draft' or public.intervention_authorized(new.tenant_id,i.id) is not true then raise insufficient_privilege;end if;
 p=new.provenance->'plan';if jsonb_typeof(p) is distinct from 'object' or not(p ?& array['hypothesis','ownerId','start','end','unit','population','outcome','controlPlan','metricDefinitionVersion','baselineSnapshotId','scopeHash','maturityDays','concurrentChanges']) or (select count(*) from jsonb_object_keys(p))<>13 or exists(select 1 from jsonb_each(p) kv where kv.key<>'maturityDays' and jsonb_typeof(kv.value) is distinct from 'string') or new.baseline_ref::text is distinct from p->>'baselineSnapshotId' or p->>'scopeHash' is distinct from i.provenance->>'scopeHash' or p->>'unit' not in ('order','customer') or p->>'outcome' not in ('allOrders','exposure','refunds') or length(btrim(p->>'hypothesis')) not between 20 and 2000 or length(btrim(p->>'population')) not between 10 and 2000 or length(btrim(p->>'controlPlan')) not between 10 and 2000 or length(btrim(p->>'concurrentChanges')) not between 10 and 2000 or jsonb_typeof(p->'maturityDays') is distinct from 'number' or p->>'maturityDays'!~'^(0|[1-9][0-9]{0,2})$' or (p->>'maturityDays')::integer>365 or public.intervention_member(new.tenant_id,(p->>'ownerId')::uuid,array['owner','operator']) is not true then raise check_violation;end if;
 if not isfinite(new.date_start) or not isfinite(new.date_end) or new.date_start is null or new.date_end is null or new.date_start>=new.date_end or new.date_start is distinct from (p->>'start')::timestamptz or new.date_end is distinct from (p->>'end')::timestamptz or new.unit is distinct from p->>'unit' or new.population_ref is distinct from p->>'population' or new.result_ref is not null then raise check_violation;end if;
 if new.version<>coalesce((select max(version) from public.measurement_plans where tenant_id=new.tenant_id and intervention_id=i.id),0)+1 then raise serialization_failure;end if;
 select * into b from public.metric_snapshots where tenant_id=new.tenant_id and id=new.baseline_ref and status='published';select * into context from public.metric_snapshots where tenant_id=i.tenant_id and id=i.baseline_ref;select * into binding from public.workspace_scope_bindings where tenant_id=i.tenant_id and scope_hash=i.provenance->>'scopeHash';
 if b.id is null or binding.id is null or b.date_end>new.date_start or b.as_of<b.date_end or b.policy_version is distinct from p->>'metricDefinitionVersion' or (b.provenance->'scope')-array['start','end'] is distinct from (context.provenance->'scope')-array['start','end'] or b.policy_version is distinct from context.policy_version or b.economic_schema_version is distinct from context.economic_schema_version or (select coalesce(jsonb_agg(distinct (x-'id') order by (x-'id')),'[]') from jsonb_array_elements(b.input_manifest->'models') x) is distinct from (select coalesce(jsonb_agg(distinct (x-'id') order by (x-'id')),'[]') from jsonb_array_elements(context.input_manifest->'models') x) or public.intervention_inputs_current(i.tenant_id,b.id,'[]') is not true then raise check_violation;end if;
 projected=public.intervention_projection(i.tenant_id,b.id,binding.filters,p->>'outcome');
 new.provenance=jsonb_build_object('kind','intervention-plan-v1','plan',p,'filters',binding.filters,'baselineMappingIds',projected->'mappingIds','baselineContentHash',b.content_hash,'actorId',auth.uid());new.created_at=clock_timestamp();new.updated_at=new.created_at;return new;end $$;
create trigger intervention_plan_guard before insert or update or delete on public.measurement_plans for each row execute function public.intervention_plan_guard();revoke all on function public.intervention_plan_guard() from public,anon,authenticated,service_role;
create function public.intervention_managed_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.measurement_plans;a text=current_setting('vexa.action',true);receipt jsonb;begin
 if tg_op='INSERT' then return new;end if;
 if old.provenance->>'kind' is distinct from 'recommendation-draft-v1' then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' then raise insufficient_privilege;end if;
 if new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or public.intervention_authorized(new.tenant_id,new.id) is not true or new.last_actor_id is distinct from auth.uid() or new.version<>old.version+1 or new.last_request_key is null or length(new.last_request_key) not between 1 and 128 or new.last_fingerprint!~'^[a-f0-9]{64}$' or new.last_fingerprint is null or new.reason is null or length(btrim(new.reason)) not between 20 and 2000 then raise check_violation;end if;
 if exists(select 1 from public.intervention_results z where z.tenant_id=new.tenant_id and z.intervention_id=new.id and public.intervention_result_mappings_current(z.tenant_id,z.result) is not true) then raise insufficient_privilege;end if;
 if (to_jsonb(new)-array['version','status','owner_id','hypothesis','reason','measurement_ref','plan_id','actual_start','actual_end','approved_at','last_actor_id','last_request_key','last_fingerprint','result_id','approval_content','updated_at']) is distinct from (to_jsonb(old)-array['version','status','owner_id','hypothesis','reason','measurement_ref','plan_id','actual_start','actual_end','approved_at','last_actor_id','last_request_key','last_fingerprint','result_id','approval_content','updated_at']) or new.approval_content is distinct from old.approval_content or new.approved_at is distinct from old.approved_at then raise check_violation;end if;
 if a='approve' and public.vexa_member(new.tenant_id,array['owner']) and new.status=old.status and new.owner_id is distinct from old.owner_id and old.status not in ('closed','cancelled') then
 if public.intervention_member(new.tenant_id,new.owner_id,array['owner','operator']) is not true or (to_jsonb(new)-array['version','owner_id','reason','last_actor_id','last_request_key','last_fingerprint','updated_at']) is distinct from (to_jsonb(old)-array['version','owner_id','reason','last_actor_id','last_request_key','last_fingerprint','updated_at']) then raise check_violation;end if;new.updated_at=clock_timestamp();return new;
 elsif old.status='draft' and new.status='draft' and a='propose' then
  select * into p from public.measurement_plans where tenant_id=new.tenant_id and id=new.plan_id and intervention_id=new.id;
  if p.id is null or new.measurement_ref is distinct from p.id or new.owner_id::text is distinct from p.provenance->'plan'->>'ownerId' or new.hypothesis is distinct from p.provenance->'plan'->>'hypothesis' or new.actual_start is not null or new.actual_end is not null or new.result_id is not null then raise check_violation;end if;
 elsif old.status='draft' and new.status='approved' and a='approve' and public.vexa_member(new.tenant_id,array['owner']) then
  select * into p from public.measurement_plans where tenant_id=new.tenant_id and id=old.plan_id and intervention_id=new.id;
  if p.id is null or new.plan_id is distinct from old.plan_id or public.intervention_member(new.tenant_id,new.owner_id,array['owner','operator']) is not true or (public.intervention_projection(new.tenant_id,p.baseline_ref,p.provenance->'filters',p.provenance->'plan'->>'outcome',array(select jsonb_array_elements_text(p.provenance->'baselineMappingIds')::uuid))->>'status')<>'complete' then raise check_violation;end if;
  new.approved_at=clock_timestamp();new.approval_content=jsonb_build_object('plan',to_jsonb(p),'hypothesis',old.hypothesis,'baseline',old.baseline_ref,'recommendationVersion',old.recommendation_version);
 elsif old.status='closed' and new.status='measuring' and a='approve' and public.vexa_member(new.tenant_id,array['owner']) then
 if new.result_id is not null then raise check_violation;end if;new.measurement_cycle=old.measurement_cycle+1;
 elsif new.status='cancelled' and old.status in ('draft','approved','active','measuring') and a='approve' and public.vexa_member(new.tenant_id,array['owner']) then null;
 elsif a='execute' and (public.vexa_member(new.tenant_id,array['owner']) or(public.vexa_member(new.tenant_id,array['operator']) and old.owner_id=auth.uid())) and public.intervention_member(new.tenant_id,old.owner_id,array['owner','operator']) then
  if old.status='approved' and new.status='active' then
   if new.actual_start is null or not isfinite(new.actual_start) or new.actual_start<old.approved_at or new.actual_start>clock_timestamp() or new.actual_end is not null then raise check_violation;end if;
  elsif old.status='active' and new.status='measuring' then
   if new.actual_end is null or not isfinite(new.actual_end) or new.actual_end<old.actual_start or new.actual_end>clock_timestamp() or new.actual_start is distinct from old.actual_start then raise check_violation;end if;new.measurement_cycle=old.measurement_cycle+1;
  elsif old.status='measuring' and new.status='measuring' then
   if new.result_id is null or new.result_id is not distinct from old.result_id or not exists(select 1 from public.intervention_results where tenant_id=new.tenant_id and id=new.result_id and intervention_id=new.id and plan_id=new.plan_id and measurement_cycle=old.measurement_cycle) then raise check_violation;end if;
  elsif old.status='measuring' and new.status='closed' then
   if new.result_id is null or new.result_id is distinct from old.result_id or not exists(select 1 from public.intervention_results where tenant_id=new.tenant_id and id=new.result_id and intervention_id=new.id and result->>'status'='complete' and measurement_cycle=old.measurement_cycle) then raise check_violation;end if;
  else raise check_violation;end if;
 else raise insufficient_privilege;end if;
 if (old.status<>'draft' or new.status<>'draft') and (new.owner_id,new.hypothesis,new.plan_id,new.measurement_ref) is distinct from (old.owner_id,old.hypothesis,old.plan_id,old.measurement_ref) then raise check_violation;end if;
 if old.status<>'draft' and new.approval_content is null then raise check_violation;end if;
 if not(old.status='approved' and new.status='active') and new.actual_start is distinct from old.actual_start then raise check_violation;end if;
 if not(old.status='active' and new.status='measuring') and new.actual_end is distinct from old.actual_end then raise check_violation;end if;
 if not(old.status='measuring' and new.status='measuring' or old.status='closed' and new.status='measuring') and new.result_id is distinct from old.result_id then raise check_violation;end if;
 new.updated_at=clock_timestamp();return new;end $$;
create trigger z_intervention_managed_guard before update or delete on public.interventions for each row execute function public.intervention_managed_guard();revoke all on function public.intervention_managed_guard() from public,anon,authenticated,service_role;
create function public.intervention_event_capture() returns trigger language plpgsql security definer set search_path='' as $$begin if new.provenance->>'kind'='recommendation-draft-v1' then insert into public.intervention_events(tenant_id,intervention_id,version,actor_id,request_key,fingerprint,definition) values(new.tenant_id,new.id,new.version,coalesce(new.last_actor_id,(new.provenance->>'actorId')::uuid),coalesce(new.last_request_key,new.idempotency_key,'legacy-draft:'||new.id::text),coalesce(new.last_fingerprint,new.provenance->>'requestFingerprint',encode(sha256(convert_to(to_jsonb(new)::text,'UTF8')),'hex')),to_jsonb(new));end if;return new;end $$;
create trigger intervention_event_capture after insert or update on public.interventions for each row execute function public.intervention_event_capture();revoke all on function public.intervention_event_capture() from public,anon,authenticated,service_role;
create trigger intervention_event_immutable before update or delete on public.intervention_events for each row execute function public.recommendation_history_immutable();
alter table public.intervention_events enable row level security;alter table public.intervention_events force row level security;alter table public.intervention_results enable row level security;alter table public.intervention_results force row level security;
revoke all on public.intervention_events,public.intervention_results from public,anon,authenticated,service_role,vexa_backend;grant select on public.intervention_events to vexa_backend;grant select,insert on public.intervention_results to vexa_backend;
create policy intervention_event_read on public.intervention_events for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.intervention_authorized(tenant_id,intervention_id));
create policy intervention_result_read on public.intervention_results for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.intervention_authorized(tenant_id,intervention_id) and public.intervention_result_mappings_current(tenant_id,result));
create policy intervention_result_write on public.intervention_results for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and public.vexa_backend_action(tenant_id,array['execute']));
create policy intervention_plan_browser on public.measurement_plans as restrictive for select to authenticated using(provenance->>'kind' is distinct from 'intervention-plan-v1');

create or replace function public.recommendation_draft_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.recommendations;v integer;
begin
 if tg_op='DELETE' then if old.provenance->>'kind'='recommendation-draft-v1' then raise insufficient_privilege;end if;return old;end if;
 if tg_op='UPDATE' and old.provenance->>'kind'='recommendation-draft-v1' then return new;end if;
 if new.provenance->>'kind' is distinct from 'recommendation-draft-v1' then return new;end if;
 if tg_op<>'INSERT' or new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or current_setting('vexa.action',true) is distinct from 'propose' or not public.vexa_member(new.tenant_id,array['owner','analyst','operator']) or new.provenance->>'actorId' is distinct from auth.uid()::text then raise insufficient_privilege;end if;
 select * into r from public.recommendations where tenant_id=new.tenant_id and id=new.recommendation_id for share;
 if r.id is null or r.recommendation_schema is distinct from 'recommendation-v1' or r.status<>'proposed' or r.version is distinct from (new.provenance->>'recommendationVersion')::integer or new.baseline_ref is distinct from r.snapshot_id or new.owner_id is distinct from r.owner_id or new.status<>'draft' or new.version<>1 or new.provenance->>'scopeHash' is distinct from r.scope_hash or new.recommendation_version is distinct from r.version or (r.owner_id is not null and not public.recommendation_member_active(new.tenant_id,r.owner_id)) or r.problem_version_id is distinct from (select id from public.problem_versions where tenant_id=new.tenant_id and problem_id=r.problem_id order by version desc limit 1) or not public.recommendation_member_active(new.tenant_id,r.actor_id) then raise check_violation;end if;
 if exists(select 1 from public.recommendation_versions h where h.tenant_id=new.tenant_id and h.recommendation_id=r.id and public.recommendation_member_active(h.tenant_id,h.actor_id) is not true) then raise insufficient_privilege;end if;
 if public.recommendation_inputs_current(new.tenant_id,r.snapshot_id,r.evidence_refs) is not true then raise check_violation;end if;
 new.measurement_cycle=0;new.provenance=jsonb_set(new.provenance,'{definition}',to_jsonb(r));new.created_at=clock_timestamp();new.updated_at=new.created_at;return new;
end $$;

create or replace function public.vexa_intervention_transition() returns trigger
language plpgsql security invoker set search_path='' as $$
declare action text := current_setting('vexa.action',true);
begin
 if tg_op='UPDATE' and old.provenance->>'kind'='recommendation-draft-v1' then return new;end if;
 if tg_op='INSERT' then
   if new.status<>'draft' or new.approval_content is not null then
     raise exception 'interventions must start draft' using errcode='23514';
   end if;
 else
   if new.approval_content is distinct from old.approval_content then
     raise exception 'approval receipt is database owned' using errcode='23514';
   end if;
   -- CAS bookkeeping is not approved content. If touched after draft it must
   -- accompany a state transition and advance exactly one; content checks below
   -- still apply independently of the counter. Legacy status-only writes remain
   -- compatible; the service enforces expected_version and always increments.
   if old.status<>'draft' and (new.version,new.reason) is distinct from (old.version,old.reason) and
      (new.status is not distinct from old.status or new.version<>old.version+1) then
     raise exception 'operational change requires transition and next version' using errcode='23514';
   end if;
   if action='approve' and public.vexa_member(new.tenant_id,array['owner']) and new.status='approved' then
     update public.recommendations set approval_bound=true where tenant_id=new.tenant_id and id=new.recommendation_id;
     if not found then raise exception 'recommendation unavailable' using errcode='23514'; end if;
     new.approval_content := public.vexa_approval_content(new);
   elsif old.status<>'draft' then
     if (to_jsonb(new)-array['status','version','reason','updated_at']) is distinct from (to_jsonb(old)-array['status','version','reason','updated_at']) then
       raise exception 'approved definition immutable without reapproval' using errcode='23514';
     end if;
     if action='execute' and (old.approval_content is null or old.approval_content is distinct from public.vexa_approval_content(new)) then
       raise exception 'approved content changed; reapproval required' using errcode='23514';
     end if;
   end if;
 end if;
 if tg_op='UPDATE' and new.status is distinct from old.status then
   if action='approve' and public.vexa_member(new.tenant_id,array['owner']) and
      ((old.status='draft' and new.status='approved') or
       (old.status in ('draft','approved','active','measuring') and new.status='cancelled')) then
     return new;
   end if;
   if action='execute' and public.vexa_member(new.tenant_id,array['owner','operator']) and
      (public.vexa_member(new.tenant_id,array['owner']) or old.owner_id=(select auth.uid())) and
      ((old.status='approved' and new.status='active') or
       (old.status='active' and new.status='measuring') or
       (old.status='measuring' and new.status='closed')) then
     return new;
   end if;
   raise exception 'invalid intervention transition' using errcode='23514';
 end if;
 return new;
end $$;
-- Existing recommendation drafts retain a baseline audit event when upgrading.
insert into public.intervention_events(tenant_id,intervention_id,version,actor_id,request_key,fingerprint,definition)
select i.tenant_id,i.id,i.version,(i.provenance->>'actorId')::uuid,coalesce(i.idempotency_key,'legacy-draft:'||i.id::text),coalesce(i.provenance->>'requestFingerprint',encode(sha256(convert_to(to_jsonb(i)::text,'UTF8')),'hex')),to_jsonb(i) from public.interventions i where i.provenance->>'kind'='recommendation-draft-v1' and not exists(select 1 from public.intervention_events e where e.tenant_id=i.tenant_id and e.intervention_id=i.id and e.version=i.version);
commit;
