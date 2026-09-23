begin;
alter table public.weekly_briefs add column brief_schema text,add column binding_id uuid,add column comparison_binding_id uuid,add column actor_id uuid,add column previous_id uuid,add column input_hash text,add column content_hash text,add column input_manifest jsonb,add column document jsonb,add column canonical_input text,add column canonical_document text;
alter table public.weekly_briefs add foreign key(tenant_id,binding_id) references public.workspace_scope_bindings(tenant_id,id),add foreign key(tenant_id,comparison_binding_id) references public.workspace_scope_bindings(tenant_id,id),add foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id),add foreign key(tenant_id,previous_id) references public.weekly_briefs(tenant_id,id);
create unique index brief_input_unique on public.weekly_briefs(tenant_id,binding_id,input_hash) where brief_schema='brief-v1';
create table public.brief_heads(tenant_id uuid not null,binding_id uuid not null,brief_id uuid not null,primary key(tenant_id,binding_id),foreign key(tenant_id) references public.organizations(id),foreign key(tenant_id,binding_id) references public.workspace_scope_bindings(tenant_id,id),foreign key(tenant_id,brief_id) references public.weekly_briefs(tenant_id,id));
create table public.brief_requests(tenant_id uuid not null,request_key text not null check(length(request_key) between 8 and 200),fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),brief_id uuid not null,actor_id uuid not null,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_key),foreign key(tenant_id) references public.organizations(id),foreign key(tenant_id,brief_id) references public.weekly_briefs(tenant_id,id),foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id));
create function public.brief_inputs_current(t uuid,sid uuid,refs jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare snap public.metric_snapshots; ref jsonb; input jsonb; run public.extraction_runs; c record; m record; source_row record; current_actor uuid; current_active boolean; keys text[]; identity_text text; entity text; external_key text;
begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or coalesce(current_setting('vexa.action',true),'') not in ('read','import') or not public.vexa_member(t) then return false;end if;
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
revoke all on function public.brief_inputs_current(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.brief_inputs_current(uuid,uuid,jsonb) to vexa_backend;

create function public.brief_member(t uuid,u uuid,roles text[] default array['owner','analyst','operator']) returns boolean language sql stable security definer set search_path='' as $$select coalesce(t=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','import') and public.vexa_member(t) and exists(select 1 from public.memberships where tenant_id=t and user_id=u and status='active' and role=any(roles)),false)$$;
revoke all on function public.brief_member(uuid,uuid,text[]) from public,anon,authenticated,service_role;grant execute on function public.brief_member(uuid,uuid,text[]) to vexa_backend;
create function public.brief_projection(t uuid,sid uuid,f jsonb,metric text,mids uuid[] default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snap public.metric_snapshots;refs uuid[];sourceids uuid[];orderids uuid[]='{}';selected uuid[]='{}';uncertain uuid[]='{}';eventids uuid[]='{}';aliases jsonb='{}';r record;a record;d record;family text;family_count integer;covered boolean;order_covered boolean;subtotal numeric=0;known integer=0;eligible integer=0;unknown boolean=false;blocked boolean=false;missing text[]='{}';sku_known boolean;source_known boolean;sku_match boolean;source_match boolean;sku_set text[];source_set text[];orderkey uuid;nextkey uuid;visited uuid[];amount numeric;reversal_sum numeric;customer_count integer;customer_covered boolean;
begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or coalesce(current_setting('vexa.action',true),'') not in ('read','import') or not public.vexa_member(t) or metric not in ('allOrders','exposure','refunds') then raise insufficient_privilege;end if;
 select * into snap from public.metric_snapshots where tenant_id=t and id=sid and status='published';if snap.id is null then raise check_violation;end if;if public.brief_inputs_current(t,sid,'[]') is not true then raise insufficient_privilege;end if;
 select array_agg((x->>'id')::uuid) into refs from jsonb_array_elements(snap.input_manifest->'refs') x where x->'authorized'='true' and x->'active'='true';refs=coalesce(refs,'{}');
 select coalesce(array_agg(source_id),'{}') into sourceids from public.economic_source_versions where tenant_id=t and id=any(refs) and active;
 if mids is null then select coalesce(array_agg(id),'{}') into mids from(select distinct on(ledger_row_id) id,active from public.workspace_order_dimension_versions where tenant_id=t and ledger_row_id=any(refs) order by ledger_row_id,version desc) x where active;end if;
 if exists(select 1 from public.workspace_order_dimension_versions where tenant_id=t and id=any(mids) and public.brief_member(t,actor_id,array['owner']) is not true) or cardinality(mids)<>(select count(*) from public.workspace_order_dimension_versions where tenant_id=t and id=any(mids) and ledger_row_id=any(refs) and active) then raise insufficient_privilege;end if;
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
   if metric='exposure' and not exists(select 1 from public.economic_problem_links l where l.tenant_id=t and l.id=any(refs) and l.active and (f->>'problemId' is null or l.problem_id=(f->>'problemId')::uuid) and public.intervention_canonical(l.entity_id,aliases)=a.entity_id) then continue;end if;
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
revoke all on function public.brief_projection(uuid,uuid,jsonb,text,uuid[]) from public,anon,authenticated,service_role;grant execute on function public.brief_projection(uuid,uuid,jsonb,text,uuid[]) to vexa_backend;
create function public.brief_binding_current(t uuid,bid uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare b public.workspace_scope_bindings;s public.metric_snapshots;begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or coalesce(current_setting('vexa.action',true),'') not in ('read','import') or not public.vexa_member(t) then return false;end if;
 select * into b from public.workspace_scope_bindings where tenant_id=t and id=bid;if b.id is null or public.brief_inputs_current(t,b.base_snapshot_id,'[]') is not true then return false;end if;
 select * into s from public.metric_snapshots where tenant_id=t and id=b.base_snapshot_id;
 if cardinality(b.mapping_ids)<>(select count(*) from public.workspace_order_dimension_versions m where m.tenant_id=t and m.id=any(b.mapping_ids) and m.active and public.brief_member(t,m.actor_id,array['owner']) and exists(select 1 from jsonb_array_elements(s.input_manifest->'refs') r where r->>'table'='economic_ledger_entries' and r->>'id'=m.ledger_row_id::text and r->'authorized'='true' and r->'active'='true')) then return false;end if;
 return true;end $$;
revoke all on function public.brief_binding_current(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.brief_binding_current(uuid,uuid) to vexa_backend;
create function public.brief_manifest_current(t uuid,m jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare a jsonb;r jsonb;h record;res public.intervention_results;p public.measurement_plans;x jsonb;mid uuid;sid uuid;pr public.priority_runs;begin
 if jsonb_typeof(m) is distinct from 'object' or jsonb_typeof(m->'actions') is distinct from 'array' or public.brief_binding_current(t,(m->>'bindingId')::uuid) is not true then return false;end if;
 if m->>'comparisonBindingId' is not null and public.brief_binding_current(t,(m->>'comparisonBindingId')::uuid) is not true then return false;end if;
 if m->>'priorityRunId' is not null then select * into pr from public.priority_runs where tenant_id=t and id=(m->>'priorityRunId')::uuid and status='published';if pr.id is null or pr.snapshot_id::text is distinct from m->>'snapshotId' or public.brief_member(t,pr.actor_id,array['owner']) is not true or not exists(select 1 from public.priority_policy_versions where tenant_id=t and id=pr.policy_id and public.brief_member(t,actor_id,array['owner'])) or exists(select 1 from public.priority_entries e join public.priority_actionability_versions a on a.tenant_id=e.tenant_id and a.id=e.actionability_id where e.tenant_id=t and e.run_id=pr.id and public.brief_member(t,a.actor_id,array['owner']) is not true) then return false;end if;end if;
 for a in select value from jsonb_array_elements(m->'actions') loop
  if a->>'kind'='recommendation' then
   select definition into r from public.recommendation_versions where tenant_id=t and recommendation_id=(a->>'id')::uuid and version=(a->>'version')::integer;
   if r is null or public.brief_inputs_current(t,(r->>'snapshot_id')::uuid,r->'evidence_refs') is not true or public.brief_binding_current(t,(r->>'workspace_binding_id')::uuid) is not true then return false;end if;
   if r->>'owner_id' is not null and public.brief_member(t,(r->>'owner_id')::uuid) is not true then return false;end if;
   if exists(select 1 from public.recommendation_versions v where v.tenant_id=t and v.recommendation_id=(a->>'id')::uuid and v.version<=(a->>'version')::integer and public.brief_member(t,v.actor_id) is not true) then return false;end if;
  elsif a->>'kind'='intervention' then
   select definition into r from public.intervention_events where tenant_id=t and intervention_id=(a->>'id')::uuid and version=(a->>'version')::integer;
   if r is null or public.brief_inputs_current(t,(r->>'baseline_ref')::uuid,'[]') is not true then return false;end if;
   if exists(select 1 from public.recommendation_versions v where v.tenant_id=t and v.recommendation_id=(r->>'recommendation_id')::uuid and v.version<=(r->>'recommendation_version')::integer and public.brief_member(t,v.actor_id) is not true) then return false;end if;
   if r->>'plan_id' is not null then select * into p from public.measurement_plans where tenant_id=t and id=(r->>'plan_id')::uuid;if p.id is null or public.brief_inputs_current(t,p.baseline_ref,'[]') is not true then return false;end if;for mid in select value::uuid from jsonb_array_elements_text(p.provenance->'baselineMappingIds') loop if not exists(select 1 from public.workspace_order_dimension_versions where tenant_id=t and id=mid and active and public.brief_member(t,actor_id,array['owner'])) then return false;end if;end loop;end if;
   if r->>'result_id' is not null then select * into res from public.intervention_results where tenant_id=t and id=(r->>'result_id')::uuid;if res.id is null then return false;end if;for x in select value from jsonb_build_array(jsonb_build_object('sid',res.result->'baselineSnapshotId','ids',res.result->'baselineProjection'->'mappingIds'),jsonb_build_object('sid',res.result->'postSnapshotId','ids',res.result->'postProjection'->'mappingIds')) loop sid=(x->>'sid')::uuid;if public.brief_inputs_current(t,sid,'[]') is not true then return false;end if;for mid in select value::uuid from jsonb_array_elements_text(x->'ids') loop if not exists(select 1 from public.workspace_order_dimension_versions where tenant_id=t and id=mid and active and public.brief_member(t,actor_id,array['owner'])) then return false;end if;end loop;end loop;end if;
  else return false;end if;
 end loop;return true;end $$;
revoke all on function public.brief_manifest_current(uuid,jsonb) from public,anon,authenticated,service_role;grant execute on function public.brief_manifest_current(uuid,jsonb) to vexa_backend;
create function public.brief_visible(t uuid,bid uuid) returns boolean language plpgsql stable security definer set search_path='' as $$declare b public.weekly_briefs;begin
 if t is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or coalesce(current_setting('vexa.action',true),'') not in ('read','import') or not public.vexa_member(t) then return false;end if;
 select * into b from public.weekly_briefs where tenant_id=t and id=bid;if b.id is null then return false;end if;if b.brief_schema is null then return true;end if;return coalesce(b.brief_schema='brief-v1' and public.brief_member(t,b.actor_id,array['owner','analyst']) and public.brief_manifest_current(t,b.input_manifest),false);end $$;
revoke all on function public.brief_visible(uuid,uuid) from public,anon,authenticated,service_role;grant execute on function public.brief_visible(uuid,uuid) to vexa_backend;
create function public.brief_metric(t uuid,bid uuid,k text,pid uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.workspace_scope_bindings;c public.components;p jsonb;key text;begin
 if public.brief_binding_current(t,bid) is not true then raise insufficient_privilege;end if;select * into b from public.workspace_scope_bindings where tenant_id=t and id=bid;
 if k not in ('exposure','allOrders','refunds') or (pid is not null and k<>'exposure') then raise check_violation;end if;
 if jsonb_array_length(b.filters->'sku')=0 and jsonb_array_length(b.filters->'source')=0 then
 key=case when k='exposure' then 'exposure.'||coalesce(pid::text,'global') else k end;
 select * into c from public.components where tenant_id=t and snapshot_id=b.base_snapshot_id and metric=key and currency=b.filters->>'currency' and provenance->'component'->'conversion'='null'::jsonb;
 if c.id is not null then return jsonb_build_object('amountMinor',c.amount_minor::text,'knownSubtotalMinor',c.known_subtotal_minor::text,'knownCount',coalesce(c.known_count,0),'totalCount',coalesce(c.total_count,0),'status',coalesce(c.provenance->'component'->'money'->>'status',case when c.amount_minor is null then 'unavailable' else 'complete' end),'missingReasons',coalesce(c.provenance->'component'->'money'->'missing_reasons','[]'::jsonb));end if;end if;
 p=public.brief_projection(t,b.base_snapshot_id,case when pid is null then b.filters else b.filters||jsonb_build_object('problemId',pid) end,k,b.mapping_ids);return p;
end $$;
revoke all on function public.brief_metric(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;grant execute on function public.brief_metric(uuid,uuid,text,uuid) to vexa_backend;
create function public.brief_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.workspace_scope_bindings;prior public.workspace_scope_bindings;s public.metric_snapshots;ps public.metric_snapshots;x jsonb;m jsonb;v jsonb;ev jsonb;pv public.problem_versions;def jsonb;expected jsonb;amount text;delta text;comparable boolean;head uuid;begin
 if tg_op<>'INSERT' then if old.brief_schema is not null or new.brief_schema is not null then raise check_violation;end if;return case when tg_op='DELETE' then old else new end;end if;
 if new.brief_schema is null then return new;end if;
 if new.brief_schema is distinct from 'brief-v1' or new.status is distinct from 'published' or new.actor_id is distinct from auth.uid() or current_setting('vexa.action',true) is distinct from 'import' or public.brief_member(new.tenant_id,new.actor_id,array['owner','analyst']) is not true then raise insufficient_privilege;end if;
 if new.binding_id is null or new.input_hash is null or new.content_hash is null or new.canonical_input is null or new.canonical_document is null or new.document is null or new.input_manifest is null or new.input_hash!~'^[a-f0-9]{64}$' or new.content_hash!~'^[a-f0-9]{64}$' or new.canonical_input::jsonb is distinct from new.input_manifest or new.canonical_document::jsonb is distinct from new.document or encode(sha256(convert_to(new.canonical_input,'UTF8')),'hex') is distinct from new.input_hash or encode(sha256(convert_to(new.canonical_document,'UTF8')),'hex') is distinct from new.content_hash then raise check_violation;end if;
 if public.brief_manifest_current(new.tenant_id,new.input_manifest) is not true then raise insufficient_privilege;end if;
 select * into b from public.workspace_scope_bindings where tenant_id=new.tenant_id and id=new.binding_id;select * into s from public.metric_snapshots where tenant_id=new.tenant_id and id=new.snapshot_id;
 if b.base_snapshot_id is distinct from new.snapshot_id or b.scope_hash is distinct from new.scope_hash or new.input_manifest->>'bindingId' is distinct from b.id::text or new.input_manifest->>'comparisonBindingId' is distinct from new.comparison_binding_id::text or new.input_manifest->>'snapshotId' is distinct from new.snapshot_id::text or new.input_manifest->>'snapshotContentHash' is distinct from s.content_hash or new.input_manifest->>'documentHash' is distinct from new.content_hash or new.input_manifest->>'template' is distinct from 'brief-observed-v1' then raise check_violation;end if;
 expected=b.filters||jsonb_build_object('date_start',b.filters->>'date_start'||'T00:00:00.000Z','date_end',b.filters->>'date_end'||'T00:00:00.000Z','scope_hash',b.scope_hash);
 if new.document->'scope' is distinct from expected or new.document->>'snapshotId' is distinct from s.id::text or new.document->>'scopeHash' is distinct from b.scope_hash or new.document->>'baseScopeHash' is distinct from b.base_scope_hash or new.document->>'templateVersion' is distinct from 'brief-observed-v1' or new.document->'sent' is distinct from 'false'::jsonb or new.document->'causalClaim' is distinct from 'false'::jsonb or new.document->'comparison'->'causalClaim' is distinct from 'false'::jsonb or new.document->'problemRowsAreAdditive' is distinct from 'false'::jsonb or (new.document->>'asOf')::timestamptz is distinct from s.as_of then raise check_violation;end if;
 if jsonb_typeof(new.document->'forecast') is distinct from 'object' or new.document->'forecast'->>'status' is distinct from 'not_estimable' or (new.document->'forecast')-array['status','reason'] is distinct from '{}'::jsonb or jsonb_typeof(new.document->'forecast'->'reason') is distinct from 'string' then raise check_violation;end if;
 if jsonb_typeof(new.document->'metrics') is distinct from 'array' or jsonb_array_length(new.document->'metrics')<>3 or (select count(distinct value->>'kind') from jsonb_array_elements(new.document->'metrics'))<>3 then raise check_violation;end if;
 for m in select value from jsonb_array_elements(new.document->'metrics') loop
 v=public.brief_metric(new.tenant_id,b.id,m->>'kind');if m->>'currency' is distinct from b.filters->>'currency' or m->'exponent' is distinct from b.filters->'exponent' or m->'amount_minor' is distinct from v->'amountMinor' or m->'known_subtotal' is distinct from v->'knownSubtotalMinor' or m->'coverage' is distinct from jsonb_build_object('known_n',v->'knownCount','eligible_n',v->'totalCount') or m->>'status' is distinct from v->>'status' or (select coalesce(jsonb_agg(z order by z),'[]') from jsonb_array_elements(m->'missing_reasons') z) is distinct from (select coalesce(jsonb_agg(z order by z),'[]') from jsonb_array_elements(v->'missingReasons') z) or m->>'source_ref' is distinct from 'workspace:'||b.scope_hash then raise check_violation;end if;
 end loop;
 if jsonb_typeof(new.document->'top3') is distinct from 'array' or jsonb_array_length(new.document->'top3')>3 or jsonb_typeof(new.document->'critical') is distinct from 'array' then raise check_violation;end if;
 for x in select value from jsonb_array_elements((new.document->'top3')||(new.document->'critical')) loop
 select p.* into pv from public.problem_versions p where p.tenant_id=new.tenant_id and p.problem_id=(x->>'id')::uuid and p.version=(x->>'version')::integer and exists(select 1 from jsonb_array_elements(b.problem_versions) bp where bp->>'problemId'=p.problem_id::text and bp->>'versionId'=p.id::text);
 if pv.id is null or x->>'title' is distinct from pv.provenance->'snapshot'->>'label' or jsonb_typeof(x->'evidence') is distinct from 'array' or jsonb_array_length(x->'evidence')=0 or (x->>'evidenceCount')::integer is distinct from jsonb_array_length(x->'evidence') then raise check_violation;end if;
 for ev in select value from jsonb_array_elements(x->'evidence') loop
 if not exists(select 1 from public.evidence_spans es join public.issues i on i.tenant_id=es.tenant_id and i.id=es.issue_id join public.extraction_runs r on r.tenant_id=i.tenant_id and r.id=i.extraction_run_id where es.tenant_id=new.tenant_id and r.id::text=ev->>'runId' and es.message_revision_id::text=ev->>'messageRevisionId' and es.quote_hash=ev->>'quoteHash' and es.quote_hash=encode(sha256(convert_to(ev->>'quote','UTF8')),'hex') and i.category=ev->>'category' and coalesce(i.severity,'unknown')=ev->>'severity' and exists(select 1 from jsonb_array_elements(r.provenance->'input_manifest') z where z->>'message_revision_id'=es.message_revision_id::text and z->>'role'=ev->>'role') and exists(select 1 from public.problem_embedding_members em where em.tenant_id=r.tenant_id and em.extraction_run_id=r.id and em.embedding_id in(select value::uuid from jsonb_array_elements_text(pv.provenance->'snapshot'->'embeddingIds')))) then raise check_violation;end if;end loop;
 for m in select value from jsonb_array_elements(x->'metrics') loop v=public.brief_metric(new.tenant_id,b.id,m->>'kind',(x->>'id')::uuid);if m->>'currency' is distinct from b.filters->>'currency' or m->'exponent' is distinct from b.filters->'exponent' or m->'amount_minor' is distinct from v->'amountMinor' or m->'known_subtotal' is distinct from v->'knownSubtotalMinor' or m->'coverage' is distinct from jsonb_build_object('known_n',v->'knownCount','eligible_n',v->'totalCount') or m->>'status' is distinct from v->>'status' or (select coalesce(jsonb_agg(z order by z),'[]') from jsonb_array_elements(m->'missing_reasons') z) is distinct from (select coalesce(jsonb_agg(z order by z),'[]') from jsonb_array_elements(v->'missingReasons') z) then raise check_violation;end if;end loop;
 end loop;
 if jsonb_typeof(new.document->'actions') is distinct from 'array' or jsonb_array_length(new.document->'actions') is distinct from jsonb_array_length(new.input_manifest->'actions') then raise check_violation;end if;
 for x in select value from jsonb_array_elements(new.document->'actions') loop
 if not exists(select 1 from jsonb_array_elements(new.input_manifest->'actions') a where a->>'kind'=x->>'kind' and a->>'id'=x->>'id' and a->'version'=x->'version') then raise check_violation;end if;
 if x->>'kind'='recommendation' then select definition into def from public.recommendation_versions where tenant_id=new.tenant_id and recommendation_id=(x->>'id')::uuid and version=(x->>'version')::integer;expected=jsonb_build_object('title',def->'title','status',def->'status','ownerId',def->'owner_id','summary',(def->>'action')||' '||(def->>'rationale'));else select definition into def from public.intervention_events where tenant_id=new.tenant_id and intervention_id=(x->>'id')::uuid and version=(x->>'version')::integer;expected=jsonb_build_object('title',def->'provenance'->'definition'->'title','status',def->'status','ownerId',def->'owner_id','summary',def->'hypothesis');end if;
 if (x-array['id','version','kind','href']) is distinct from expected then raise check_violation;end if;end loop;
 if new.comparison_binding_id is null then if new.document->'comparison'->>'status' is distinct from 'not_requested' or new.document->'comparison'->'metrics' is distinct from '[]'::jsonb then raise check_violation;end if;
 else
 select * into prior from public.workspace_scope_bindings where tenant_id=new.tenant_id and id=new.comparison_binding_id;select * into ps from public.metric_snapshots where tenant_id=new.tenant_id and id=prior.base_snapshot_id;
 if (b.filters-array['date_start','date_end','snapshot_id']) is distinct from (prior.filters-array['date_start','date_end','snapshot_id']) or new.document->'comparison'->>'snapshotId' is distinct from ps.id::text or new.document->'comparison'->>'scopeHash' is distinct from prior.scope_hash or jsonb_array_length(new.document->'comparison'->'metrics') is distinct from 3 then raise check_violation;end if;
 comparable=ps.date_end<=s.date_start and ps.date_end-ps.date_start=s.date_end-s.date_start and ps.policy_version=s.policy_version and ps.economic_schema_version=s.economic_schema_version and (select coalesce(jsonb_agg(distinct (z-'id') order by (z-'id')),'[]') from jsonb_array_elements(ps.input_manifest->'models') z)=(select coalesce(jsonb_agg(distinct (z-'id') order by (z-'id')),'[]') from jsonb_array_elements(s.input_manifest->'models') z);
 if new.document->'comparison'->>'status' is distinct from (case when comparable then 'available' else 'not_comparable' end) then raise check_violation;end if;
 for m in select value from jsonb_array_elements(new.document->'comparison'->'metrics') loop v=public.brief_metric(new.tenant_id,prior.id,m->>'kind');x=public.brief_metric(new.tenant_id,b.id,m->>'kind');delta=null;if comparable and v->>'amountMinor' is not null and x->>'amountMinor' is not null then delta=((x->>'amountMinor')::numeric-(v->>'amountMinor')::numeric)::text;end if;if m->>'previousAmountMinor' is distinct from v->>'amountMinor' or m->>'currentAmountMinor' is distinct from x->>'amountMinor' or m->>'deltaMinor' is distinct from delta or m->>'currency' is distinct from b.filters->>'currency' or m->'exponent' is distinct from b.filters->'exponent' then raise check_violation;end if;end loop;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':briefs:'||new.snapshot_id::text,0));select brief_id into head from public.brief_heads where tenant_id=new.tenant_id and binding_id=new.binding_id;if new.previous_id is distinct from head or new.version<>(select coalesce(max(version),0)+1 from public.weekly_briefs where tenant_id=new.tenant_id and snapshot_id=new.snapshot_id) then raise check_violation;end if;
 new.created_at=clock_timestamp();new.updated_at=new.created_at;return new;
end $$;
revoke all on function public.brief_guard() from public,anon,authenticated,service_role,vexa_backend;
create trigger brief_guard before insert or update or delete on public.weekly_briefs for each row execute function public.brief_guard();
create policy brief_browser on public.weekly_briefs as restrictive for select to authenticated using(brief_schema is null);
create policy brief_backend on public.weekly_briefs as restrictive for select to vexa_backend using(brief_schema is null or public.brief_visible(tenant_id,id));
create function public.brief_control_guard() returns trigger language plpgsql security definer set search_path='' as $$declare b public.weekly_briefs;begin
 if tg_op='DELETE' or (tg_table_name='brief_requests' and tg_op='UPDATE') then raise check_violation;end if;
 if current_setting('vexa.action',true) is distinct from 'import' or public.brief_member(new.tenant_id,auth.uid(),array['owner','analyst']) is not true then raise insufficient_privilege;end if;
 select * into b from public.weekly_briefs where tenant_id=new.tenant_id and id=new.brief_id and brief_schema='brief-v1';if b.id is null or public.brief_visible(new.tenant_id,b.id) is not true then raise check_violation;end if;
 if tg_table_name='brief_heads' then
 if new.binding_id<>b.binding_id then raise check_violation;end if;
 if tg_op='UPDATE' then if new.tenant_id<>old.tenant_id or new.binding_id<>old.binding_id or b.previous_id is distinct from old.brief_id then raise check_violation;end if;elsif b.previous_id is not null then raise check_violation;end if;
 else if new.actor_id is distinct from auth.uid() then raise insufficient_privilege;end if;new.created_at=clock_timestamp();end if;return new;end $$;
revoke all on function public.brief_control_guard() from public,anon,authenticated,service_role,vexa_backend;
create trigger brief_heads_guard before insert or update or delete on public.brief_heads for each row execute function public.brief_control_guard();
create trigger brief_requests_guard before insert or update or delete on public.brief_requests for each row execute function public.brief_control_guard();
alter table public.brief_heads enable row level security;alter table public.brief_heads force row level security;
alter table public.brief_requests enable row level security;alter table public.brief_requests force row level security;
revoke all on public.brief_heads,public.brief_requests from public,anon,authenticated,service_role,vexa_backend;
grant select,insert,update on public.brief_heads to vexa_backend;grant select,insert on public.brief_requests to vexa_backend;
create policy backend_read on public.brief_heads for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id) and current_setting('vexa.action',true) in('read','import'));
create policy backend_insert on public.brief_heads for insert to vexa_backend with check(public.brief_member(tenant_id,auth.uid(),array['owner','analyst']) and current_setting('vexa.action',true)='import');
create policy backend_update on public.brief_heads for update to vexa_backend using(public.brief_member(tenant_id,auth.uid(),array['owner','analyst']) and current_setting('vexa.action',true)='import') with check(public.brief_member(tenant_id,auth.uid(),array['owner','analyst']) and current_setting('vexa.action',true)='import');
create policy backend_read on public.brief_requests for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id) and current_setting('vexa.action',true) in('read','import'));
create policy backend_insert on public.brief_requests for insert to vexa_backend with check(public.brief_member(tenant_id,auth.uid(),array['owner','analyst']) and current_setting('vexa.action',true)='import');
commit;
