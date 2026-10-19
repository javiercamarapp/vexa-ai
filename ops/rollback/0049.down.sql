-- ROLLBACK de 0049. Generado a partir del texto exacto de la migracion anterior; verificado por ops/rollback/test.mjs
-- (huella pg_dump --schema-only del esquema con la migracion revertida == esquema sin la migracion).
-- Restaura association_candidates y association_row_guard a 0045 y elimina el indice conversations_tenant_external_idx.
-- Reversible, sin perdida de datos. Ejecutar DESPUES de 0054.down.sql (si 0054 sigue aplicada, la funcion se reemplaza de todos modos por la de 0045).
begin;
create or replace function public.association_candidates(t uuid,ids uuid[],owner_choice boolean) returns table(fact_id uuid,kind text,id uuid,connection_id uuid,external_id text,revision_id uuid,head_version bigint,proof jsonb) language sql stable security definer set search_path='' as $$
 with facts as materialized(select f.*,coalesce((select ir.provenance->'result'->'evidence' from public.import_rows ir where ir.tenant_id=t and ir.provenance->'result'->>'fact_id'=f.id::text and ir.provenance->'result'->>'evidence_hash'=f.selected_evidence_hash order by ir.id limit 1),f.immutable_evidence) ev from public.native_customer_associations f where f.tenant_id=t and f.id=any(ids) and f.resolution_state<>'retained'),
 origins as materialized(select * from public.association_origins(t)),
 endpoint_rows as(
 select f.id fact_id,'customer'::text kind,c.id,c.connection_id,c.external_id,r.id revision_id,h.version::bigint head_version,o.approval_id,o.version,o.entry_hash,i.id import_id,ir.id row_id
 from facts f join public.customers c on c.tenant_id=t and c.external_id=f.contact_id and (owner_choice or c.connection_id=f.source_connection_id)
 join public.connections cn on cn.tenant_id=t and cn.id=c.connection_id and cn.status='active' and cn.source='csv'
 join public.source_heads h on h.tenant_id=t and h.id=c.id and h.connection_id=c.connection_id and h.entity_type='customer' and h.external_id=c.external_id and h.state in('unique','selected')
 join public.source_revisions r on r.tenant_id=t and r.id=h.selected_revision_id and r.canonical_id=c.id and r.customer_id=c.id and r.connection_id=c.connection_id and r.entity_type='customer' and r.external_id=c.external_id and r.provenance->>'adapter_version'='csv-customer-v1' and r.provenance->>'ingestion_profile'='hubspot-contact-csv-v1' and r.provenance->>'account_id'=cn.account_id
 join public.import_rows ir on ir.tenant_id=t and ir.payload_ref=r.provenance->>'payload_ref' and ir.state in('accepted','duplicate') and ir.provenance->'result'->>'canonical_id'=c.id::text
 join public.imports i on i.tenant_id=t and i.id=ir.import_id and i.connection_id=c.connection_id and i.mapping_version=r.mapping_version and i.provenance->'mapping'->>'profile'='hubspot-contact-csv-v1'
 join origins o on o.entry->>'importId'=i.id::text and o.entry->>'fileHash'=i.file_hash and o.entry->>'mappingVersion'=i.mapping_version and o.entry->>'connectionId'=i.connection_id::text and o.entry->>'portalId'=f.portal_id and o.entry->>'namespace'='hubspot-contact'
 where not public.retention_source_deleted_internal(t,c.connection_id,'customer',c.external_id)
 union all
 select f.id,'conversation',c.id,c.connection_id,c.external_id,cr.id,ch.version::bigint,o.approval_id,o.version,o.entry_hash,i.id,ir.id
 from facts f join public.conversations c on c.tenant_id=t and (owner_choice or c.connection_id=f.source_connection_id) and (c.external_id='hubspot:'||f.ticket_id or c.external_id='gorgias:'||(f.ev->'bridge'->'property'->>'value') or owner_choice and exists(select 1 from jsonb_array_elements(f.ev->'bridge'->'notes') n where c.external_id='gorgias:'||(n->>'gorgiasId')))
 join public.connections cn on cn.tenant_id=t and cn.id=c.connection_id and cn.status='active' and cn.source='csv'
 join public.source_heads ch on ch.tenant_id=t and ch.id=c.id and ch.connection_id=c.connection_id and ch.entity_type='conversation' and ch.external_id=c.external_id and ch.state in('unique','selected')
 join public.source_revisions cr on cr.tenant_id=t and cr.id=ch.selected_revision_id and cr.canonical_id=c.id and cr.conversation_id=c.id and cr.connection_id=c.connection_id and cr.entity_type='conversation' and cr.source_revision='csv-container-v1' and cr.provenance->>'account_id'=cn.account_id
 join public.messages m on m.tenant_id=t and m.connection_id=c.connection_id and m.conversation_id=c.id and m.deleted_at is null
 join public.source_heads mh on mh.tenant_id=t and mh.id=m.id and mh.entity_type='message' and mh.connection_id=c.connection_id and mh.state in('unique','selected')
 join public.source_revisions mr on mr.tenant_id=t and mr.id=mh.selected_revision_id and mr.canonical_id=m.id and mr.message_id=m.id and mr.related_conversation_id=c.id and mr.connection_id=c.connection_id and mr.entity_type='message' and mr.provenance->>'adapter_version'='csv-message-v1'
 join public.import_rows ir on ir.tenant_id=t and ir.payload_ref=mr.provenance->>'payload_ref' and ir.state in('accepted','duplicate') and ir.provenance->'result'->>'canonical_id'=m.id::text
 join public.imports i on i.tenant_id=t and i.id=ir.import_id and i.connection_id=c.connection_id and i.mapping_version=mr.mapping_version
 join origins o on o.entry->>'importId'=i.id::text and o.entry->>'fileHash'=i.file_hash and o.entry->>'mappingVersion'=i.mapping_version and o.entry->>'connectionId'=i.connection_id::text and o.entry->>'portalId'=f.portal_id and o.entry->>'namespace'=case when c.external_id like 'hubspot:%' then 'hubspot-ticket' else 'gorgias-ticket' end
 where c.deleted_at is null and not public.retention_source_deleted_internal(t,c.connection_id,'conversation',c.external_id) and not public.retention_source_deleted_internal(t,m.connection_id,'message',m.external_id)
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
create or replace function public.association_row_guard() returns trigger language plpgsql set search_path='' as $$
declare owner_name text;begin
 select pg_get_userbyid(proowner) into owner_name from pg_proc where oid='public.association_resolve(jsonb)'::regprocedure;
 if tg_table_name='audit_events' then
  if (case when tg_op='DELETE' then old.action else new.action end) not in('association_origin_approved','association_origin_revoked','association_resolve') then return case when tg_op='DELETE' then old else new end;end if;
 elsif tg_table_name='import_rows' then
  if not (case when tg_op='DELETE' then old.provenance else new.provenance end)->'result' ? 'fact_id' and (tg_op='INSERT' or not old.provenance->'result' ? 'fact_id') then return case when tg_op='DELETE' then old else new end;end if;
 end if;
 if current_user<>owner_name then raise insufficient_privilege;end if;
 if tg_op='DELETE' then raise insufficient_privilege;end if;
 if tg_table_name='import_rows' then
  if new.provenance->'result' ? 'fact_id' and not exists(select 1 from public.native_customer_associations f join public.imports i on i.tenant_id=f.tenant_id and i.id=new.import_id and i.connection_id=f.source_connection_id where f.tenant_id=new.tenant_id and f.id::text=new.provenance->'result'->>'fact_id') then raise check_violation;end if;
 elsif tg_table_name='native_customer_associations' then
  if tg_op='UPDATE' then
   if (row(new.id,new.tenant_id,new.source_connection_id,new.provider,new.portal_id,new.ticket_id,new.contact_id,new.first_evidence_hash,new.first_import_row_id,new.source_version_hash) is distinct from row(old.id,old.tenant_id,old.source_connection_id,old.provider,old.portal_id,old.ticket_id,old.contact_id,old.first_evidence_hash,old.first_import_row_id,old.source_version_hash) or (new.immutable_evidence is distinct from old.immutable_evidence and (new.resolution_state<>'retained' or new.immutable_evidence is distinct from '{"retained":true}'::jsonb))) then raise check_violation;end if;
  end if;
 end if;
 return new;
end $$;
drop index if exists public.conversations_tenant_external_idx;
commit;
