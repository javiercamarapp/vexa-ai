begin;
set local lock_timeout='1000ms';
-- association_candidates joined every message of each staged conversation with
-- its import rows, imports and origin approvals and only then collapsed them
-- with DISTINCT ON, so the cost grew with the number of messages of conversations
-- reached through the exact `gorgias:` keys (a 250-fact batch exceeded the 10 s
-- statement limit). Collapse the message lineage to one row per (fact,
-- conversation, import) BEFORE the origin join. The origin predicates depend only
-- on the conversation and the import (never on the import row), and the final
-- dedup still orders by (approval_id,row_id), so the result set is identical.
-- Same signature, security definer, stable, search_path and grants as 0049.
create or replace function public.association_candidates(t uuid,ids uuid[],owner_choice boolean) returns table(fact_id uuid,kind text,id uuid,connection_id uuid,external_id text,revision_id uuid,head_version bigint,proof jsonb) language sql stable security definer set search_path='' as $$
 with facts as materialized(select f.*,coalesce((select ir.provenance->'result'->'evidence' from public.import_rows ir where ir.tenant_id=t and ir.provenance->'result'->>'fact_id'=f.id::text and ir.provenance->'result'->>'evidence_hash'=f.selected_evidence_hash order by ir.id limit 1),f.immutable_evidence) ev from public.native_customer_associations f where f.tenant_id=t and f.id=any(ids) and f.resolution_state<>'retained'),
 origins as materialized(select * from public.association_origins(t)),
 cust_stage as materialized(
 select f.id fact_id,f.portal_id,c.id,c.connection_id,c.external_id,r.id revision_id,h.version::bigint head_version,r.mapping_version,r.provenance->>'payload_ref' payload_ref
 from facts f join public.customers c on c.tenant_id=t and c.external_id=f.contact_id and (owner_choice or c.connection_id=f.source_connection_id)
 join public.connections cn on cn.tenant_id=t and cn.id=c.connection_id and cn.status='active' and cn.source='csv'
 join public.source_heads h on h.tenant_id=t and h.id=c.id and h.connection_id=c.connection_id and h.entity_type='customer' and h.external_id=c.external_id and h.state in('unique','selected')
 join public.source_revisions r on r.tenant_id=t and r.id=h.selected_revision_id and r.canonical_id=c.id and r.customer_id=c.id and r.connection_id=c.connection_id and r.entity_type='customer' and r.external_id=c.external_id and r.provenance->>'adapter_version'='csv-customer-v1' and r.provenance->>'ingestion_profile'='hubspot-contact-csv-v1' and r.provenance->>'account_id'=cn.account_id
 where not public.retention_source_deleted_internal(t,c.connection_id,'customer',c.external_id)),
 conv_stage as materialized(
 select f.id fact_id,f.portal_id,c.id,c.connection_id,c.external_id,cr.id revision_id,ch.version::bigint head_version
 from facts f cross join lateral (select 'hubspot:'||f.ticket_id k union select 'gorgias:'||(f.ev->'bridge'->'property'->>'value') union select 'gorgias:'||(n->>'gorgiasId') from jsonb_array_elements(f.ev->'bridge'->'notes') n where owner_choice) keys
 join public.conversations c on c.tenant_id=t and c.external_id=keys.k and (owner_choice or c.connection_id=f.source_connection_id)
 join public.connections cn on cn.tenant_id=t and cn.id=c.connection_id and cn.status='active' and cn.source='csv'
 join public.source_heads ch on ch.tenant_id=t and ch.id=c.id and ch.connection_id=c.connection_id and ch.entity_type='conversation' and ch.external_id=c.external_id and ch.state in('unique','selected')
 join public.source_revisions cr on cr.tenant_id=t and cr.id=ch.selected_revision_id and cr.canonical_id=c.id and cr.conversation_id=c.id and cr.connection_id=c.connection_id and cr.entity_type='conversation' and cr.source_revision='csv-container-v1' and cr.provenance->>'account_id'=cn.account_id
 where c.deleted_at is null and not public.retention_source_deleted_internal(t,c.connection_id,'conversation',c.external_id)),
 endpoint_rows as(
 select s.fact_id,'customer'::text kind,s.id,s.connection_id,s.external_id,s.revision_id,s.head_version,o.approval_id,o.version,o.entry_hash,i.id import_id,ir.id row_id
 from cust_stage s join public.import_rows ir on ir.tenant_id=t and ir.payload_ref=s.payload_ref and ir.state in('accepted','duplicate') and ir.provenance->'result'->>'canonical_id'=s.id::text
 join public.imports i on i.tenant_id=t and i.id=ir.import_id and i.connection_id=s.connection_id and i.mapping_version=s.mapping_version and i.provenance->'mapping'->>'profile'='hubspot-contact-csv-v1'
 join origins o on o.entry->>'importId'=i.id::text and o.entry->>'fileHash'=i.file_hash and o.entry->>'mappingVersion'=i.mapping_version and o.entry->>'connectionId'=i.connection_id::text and o.entry->>'portalId'=s.portal_id and o.entry->>'namespace'='hubspot-contact'
 union all
 select s.fact_id,'conversation',s.id,s.connection_id,s.external_id,s.revision_id,s.head_version,o.approval_id,o.version,o.entry_hash,p.import_id,p.row_id
 from (select distinct on(s.fact_id,s.id,i.id) s.fact_id,s.id,s.portal_id,s.external_id,s.connection_id,i.id import_id,i.file_hash,i.mapping_version,ir.id row_id
 from conv_stage s join public.messages m on m.tenant_id=t and m.connection_id=s.connection_id and m.conversation_id=s.id and m.deleted_at is null
 join public.source_heads mh on mh.tenant_id=t and mh.id=m.id and mh.entity_type='message' and mh.connection_id=s.connection_id and mh.state in('unique','selected')
 join public.source_revisions mr on mr.tenant_id=t and mr.id=mh.selected_revision_id and mr.canonical_id=m.id and mr.message_id=m.id and mr.related_conversation_id=s.id and mr.connection_id=s.connection_id and mr.entity_type='message' and mr.provenance->>'adapter_version'='csv-message-v1'
 join public.import_rows ir on ir.tenant_id=t and ir.payload_ref=mr.provenance->>'payload_ref' and ir.state in('accepted','duplicate') and ir.provenance->'result'->>'canonical_id'=m.id::text
 join public.imports i on i.tenant_id=t and i.id=ir.import_id and i.connection_id=s.connection_id and i.mapping_version=mr.mapping_version
 where not public.retention_source_deleted_internal(t,m.connection_id,'message',m.external_id)
 order by s.fact_id,s.id,i.id,ir.id) p
 join conv_stage s on s.fact_id=p.fact_id and s.id=p.id
 join origins o on o.entry->>'importId'=p.import_id::text and o.entry->>'fileHash'=p.file_hash and o.entry->>'mappingVersion'=p.mapping_version and o.entry->>'connectionId'=p.connection_id::text and o.entry->>'portalId'=p.portal_id and o.entry->>'namespace'=case when p.external_id like 'hubspot:%' then 'hubspot-ticket' else 'gorgias-ticket' end
 ), dedup as(select distinct on(fact_id,kind,id) * from endpoint_rows order by fact_id,kind,id,approval_id,row_id)
 select fact_id,kind,id,connection_id,external_id,revision_id,head_version,jsonb_build_object('approvalId',approval_id,'approvalVersion',version,'entryHash',entry_hash,'importId',import_id,'importRowId',row_id,'canonicalId',id,'revisionId',revision_id,'headVersion',head_version) from dedup
 union all
 select f.id,'conversation',c.id,c.connection_id,c.external_id,r.id,h.version::bigint,jsonb_build_object('native',true,'source','hubspot','accountId',cn.account_id,'connectionId',cn.id,'canonicalId',c.id,'revisionId',r.id,'headVersion',h.version)
 from facts f join public.conversations c on owner_choice and c.tenant_id=t and c.external_id=f.ticket_id and c.source='hubspot' and c.deleted_at is null
 join public.connections cn on cn.tenant_id=t and cn.id=c.connection_id and cn.status='active' and cn.source='hubspot' and cn.account_id=f.portal_id
 join public.source_heads h on h.tenant_id=t and h.id=c.id and h.entity_type='conversation' and h.connection_id=c.connection_id and h.external_id=c.external_id and h.state in('unique','selected')
 join public.source_revisions r on r.tenant_id=t and r.id=h.selected_revision_id and r.canonical_id=c.id and r.conversation_id=c.id and r.entity_type='conversation' and r.connection_id=c.connection_id and r.provenance->>'source'='hubspot' and r.provenance->>'account_id'=f.portal_id
 where not public.retention_source_deleted_internal(t,c.connection_id,'conversation',c.external_id)
$$;
commit;
