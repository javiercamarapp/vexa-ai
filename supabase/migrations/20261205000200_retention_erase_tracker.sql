-- LIFE-02 (cierre de seguridad 29-oct): tracker_row_revisions.cells y ticket_id (solo-INSERT) quedaban fuera de retention_erase.
-- Se parte de la definicion VIGENTE de retention_erase (20261130000100, LIFE-01/R2-01, aplicada en produccion el 28-oct) y solo se agrega el bloque
-- del Tracker. Ademas un disparador BEFORE INSERT vacia las filas nuevas del Tracker cuyo ticket ya fue borrado, para que una reingesta no lo reviva.
-- Reversion: restaurar retention_erase desde 20261130000100 y drop trigger/function tracker_tombstone_blank.
begin;
create or replace function public.retention_erase(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;c uuid:=(p->>'connectionId')::uuid;k text:=p->>'entityType';e text:=p->>'externalId';rid uuid:=(p->>'requestId')::uuid;
 pol public.retention_policies;prior public.retention_ledger;mid uuid[];cid uuid[];revs uuid[];import_ids uuid[];probs uuid[];m record;oldrow jsonb;newrow jsonb;redacted jsonb;count_raw integer;count_vectors integer;afids uuid[];aimps uuid[];ablobs uuid[];mext text[];cext text[];tkeys text[];begin
 if current_setting('vexa.action',true) is distinct from 'retain' or public.vexa_member(t,array['owner']) is not true then raise insufficient_privilege;end if;
 if p->>'confirmed' is distinct from 'true' or k not in('message','conversation','customer') or e is null or length(e) not between 1 and 512 or rid is null then raise check_violation;end if;
 select * into pol from public.retention_policies where tenant_id=t;if pol.tenant_id is null then raise check_violation using message='RETENTION_POLICY_REQUIRED';end if;
 if not exists(select 1 from public.connections where tenant_id=t and id=c) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text||':native-customer-associations',0));
 perform pg_advisory_xact_lock(hashtextextended(t::text||':'||c::text,0));
 afids=public.association_retention_facts(t,c,k,e);
 select coalesce(array_agg(distinct import_id),'{}') into aimps from public.import_rows where tenant_id=t and provenance->'result'->>'fact_id'=any(afids::text[]);
 select * into prior from public.retention_ledger where tenant_id=t and id=rid;
 if prior.id is not null and (prior.connection_id,prior.entity_type,prior.external_id) is distinct from(c,k,e) then raise unique_violation;end if;
 insert into public.retention_ledger(tenant_id,id,connection_id,entity_type,external_id,actor_id,policy_version) values(t,rid,c,k,e,auth.uid(),pol.version) on conflict do nothing;
 -- Broader source erasure includes descendants; aliases are resolved by canonical foreign keys, not display names.
 select coalesce(array_agg(id),'{}') into cid from public.conversations where tenant_id=t and connection_id=c and ((k='conversation' and external_id=e) or (k='customer' and customer_id in(select id from public.customers where tenant_id=t and connection_id=c and external_id=e)));
 select coalesce(array_agg(id),'{}') into mid from public.messages where tenant_id=t and connection_id=c and ((k='message' and external_id=e) or conversation_id=any(cid));
 select coalesce(array_agg(id),'{}') into revs from public.message_revisions where tenant_id=t and message_id=any(mid);
 select coalesce(array_agg(distinct i.import_id),'{}') into import_ids from public.import_rows i join public.message_revisions r on r.tenant_id=i.tenant_id and r.text_ref=i.payload_ref where i.tenant_id=t and r.id=any(revs);
 select coalesce(array_agg(distinct problem_id),'{}') into probs from public.problem_embedding_members where tenant_id=t and embedding_id in(select id from public.embeddings where tenant_id=t and message_revision_id=any(revs));
 for m in select 'message'::text as kind,id,external_id from public.messages where tenant_id=t and id=any(mid) union all select 'conversation',id,external_id from public.conversations where tenant_id=t and id=any(cid) loop
  insert into public.retention_ledger(tenant_id,id,connection_id,entity_type,external_id,actor_id,policy_version) values(t,gen_random_uuid(),c,m.kind,m.external_id,auth.uid(),pol.version) on conflict do nothing;
 end loop;
 delete from public.problem_embedding_members where tenant_id=t and embedding_id in(select id from public.embeddings where tenant_id=t and message_revision_id=any(revs));
 delete from public.embeddings where tenant_id=t and message_revision_id=any(revs);get diagnostics count_vectors=row_count;
 perform public.association_retention_erase(t,afids,rid);
 -- Authorize exact derived redactions with immutable full-row digests before updating.
 for m in select r.* from public.extraction_runs r where r.tenant_id=t and public.retention_redact_json(r.provenance,revs) is distinct from r.provenance for update loop
  oldrow=to_jsonb(m);redacted=public.retention_redact_json(m.provenance,revs);newrow=jsonb_set(oldrow,'{provenance}',redacted);
  insert into public.retention_redactions(tenant_id,request_id,table_name,row_id,before_hash,after_hash) values(t,rid,'extraction_runs',m.id,encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),encode(sha256(convert_to(newrow::text,'UTF8')),'hex')) on conflict do nothing;
  update public.extraction_runs set provenance=redacted where tenant_id=t and id=m.id;
 end loop;
 for m in select b.* from public.weekly_briefs b where b.tenant_id=t and public.retention_redact_json(b.document,revs) is distinct from b.document for update loop
  oldrow=to_jsonb(m);redacted=public.retention_redact_json(m.document,revs);newrow=jsonb_set(jsonb_set(oldrow,'{document}',redacted),'{canonical_document}',to_jsonb(redacted::text));
  insert into public.retention_redactions(tenant_id,request_id,table_name,row_id,before_hash,after_hash) values(t,rid,'weekly_briefs',m.id,encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),encode(sha256(convert_to(newrow::text,'UTF8')),'hex')) on conflict do nothing;
  update public.weekly_briefs set document=redacted,canonical_document=redacted::text where tenant_id=t and id=m.id;
 end loop;
 update public.redaction_maps set private_map='[]' where tenant_id=t and (original_revision_id=any(revs) or redacted_revision_id=any(revs));
 update public.message_revisions set redacted_text=null,text_ref='deleted:'||id::text,deleted_at=coalesce(deleted_at,clock_timestamp()),provenance=jsonb_build_object('retention',rid) where tenant_id=t and id=any(revs);
 update public.messages set deleted_at=coalesce(deleted_at,clock_timestamp()),provenance=jsonb_build_object('retention',rid) where tenant_id=t and id=any(mid);
 update public.conversations set deleted_at=coalesce(deleted_at,clock_timestamp()),provenance=jsonb_build_object('retention',rid) where tenant_id=t and id=any(cid);
 update public.customers set display_name=null,provenance=jsonb_build_object('retention',rid) where tenant_id=t and connection_id=c and k='customer' and external_id=e;
 update public.source_revisions set snapshot='[]',provenance=jsonb_build_object('retention',rid) where tenant_id=t and connection_id=c and (canonical_id=any(mid) or canonical_id=any(cid) or (k='customer' and entity_type=k and external_id=e));
 update public.sync_raw_objects set original='{}',normalized='{}',result=jsonb_build_object('status','erased') where tenant_id=t and connection_id=c and (public.retention_source_deleted_internal(t,c,original->'envelope'->>'entity_type',original->'envelope'->>'external_id') or public.retention_source_deleted_internal(t,c,normalized->'envelope'->>'entity_type',normalized->'envelope'->>'external_id'));get diagnostics count_raw=row_count;
 select coalesce(array_agg(distinct value),'{}') into import_ids from unnest(import_ids||aimps) value;
 -- Entire containing upload must be deleted; it cannot be safely edited in place.
 insert into public.retention_artifacts(tenant_id,connection_id,entity_type,source_key,class,object_path,expires_at,status) select t,c,k,e,'raw',object_path,clock_timestamp(),'pending' from public.imports where tenant_id=t and id=any(import_ids) and object_path is not null on conflict(tenant_id,object_path) do update set status='pending';
 update public.retention_artifacts a set status='pending' where a.tenant_id=t and a.connection_id=c and a.class<>'backup' and exists(select 1 from public.retention_ledger l where l.tenant_id=a.tenant_id and l.connection_id=a.connection_id and l.entity_type=a.entity_type and l.external_id=a.source_key);
 update public.problems set archived_at=coalesce(archived_at,clock_timestamp()) where tenant_id=t and id=any(probs);
 -- LIFE-01: los adjuntos (bytes en vexa-private/<tenant>/attachments/..) de lo borrado tambien se purgan.
 -- Se borran los vinculos del origen; el blob (direccionado por contenido y compartido) solo cuando ya no
 -- lo referencia ningun otro vinculo, y su objeto queda en retention_artifacts para la purga fisica.
 -- R2-01: los vinculos sin mensaje/conversacion resueltos (message_ambiguous, sin resolver) conservan en provenance el id de origen
 -- (message_id = external_id del mensaje, thread_id = external_id de la conversacion): se atribuyen por ese id, dentro del tenant.
 -- Las notas sin ninguna referencia no se pueden atribuir a un cliente y no se borran (nada se infiere).
 select coalesce(array_agg(external_id),'{}') into mext from public.messages where tenant_id=t and id=any(mid);
 select coalesce(array_agg(external_id),'{}') into cext from public.conversations where tenant_id=t and id=any(cid);
 select coalesce(array_agg(distinct blob_id),'{}') into ablobs from public.attachment_links where tenant_id=t and (message_id=any(mid) or conversation_id=any(cid) or (message_id is null and conversation_id is null and (provenance->>'message_id'=any(mext) or provenance->>'thread_id'=any(cext))));
 delete from public.attachment_links where tenant_id=t and (message_id=any(mid) or conversation_id=any(cid) or (message_id is null and conversation_id is null and (provenance->>'message_id'=any(mext) or provenance->>'thread_id'=any(cext))));
 insert into public.retention_artifacts(tenant_id,connection_id,entity_type,source_key,class,object_path,expires_at,status) select t,c,k,e,'raw',b.object_path,clock_timestamp(),'pending' from public.attachment_blobs b where b.tenant_id=t and b.id=any(ablobs) and b.object_path is not null and not exists(select 1 from public.attachment_links l where l.tenant_id=t and l.blob_id=b.id) on conflict(tenant_id,object_path) do update set status='pending';
 delete from public.attachment_blobs b where b.tenant_id=t and b.id=any(ablobs) and not exists(select 1 from public.attachment_links l where l.tenant_id=t and l.blob_id=b.id);
 -- LIFE-02: las celdas del Tracker (tracker_row_revisions: solo-INSERT, cells + ticket_id) de los tickets borrados tambien se vacian.
 -- El ticket del Tracker se identifica con el external_id de la conversacion, con o sin prefijo de proveedor ('hubspot:123' / '123').
 -- Se conserva la fila (hash, hoja, fila y observaciones: sin datos) para que los lotes ya ingeridos sigan siendo idempotentes; cells y las referencias al ticket quedan vacias.
 select coalesce(array_agg(distinct x),'{}') into tkeys from (select unnest(cext) x union select regexp_replace(unnest(cext),'^[a-z]+:','')) s;
 update public.tracker_row_revisions set cells='[]'::jsonb,ticket_id=null,ticket_cell=null,ticket_state='no_ticket' where tenant_id=t and ticket_id=any(tkeys);
 -- Fence related jobs before storage IO. This closes workers and prevents late commits.
 update public.jobs set state='cancelled',cancel_requested_at=clock_timestamp(),fencing_token=fencing_token+1,lease_until=null where tenant_id=t and state in('queued','running','partial') and (import_id=any(import_ids) or id in(select job_id from public.extraction_runs where tenant_id=t and conversation_id in(select conversation_id from public.messages where tenant_id=t and id=any(mid))) or id in(select job_id from public.problem_embedding_requests where tenant_id=t and extraction_run_id in(select id from public.extraction_runs where tenant_id=t and conversation_id in(select conversation_id from public.messages where tenant_id=t and id=any(mid)))));
 update public.attempts set state='cancelled',finished_at=clock_timestamp() where tenant_id=t and state='running' and job_id in(select id from public.jobs where tenant_id=t and state='cancelled');
 update public.outbox set state='cancelled',lease_until=null where tenant_id=t and job_id in(select id from public.jobs where tenant_id=t and state='cancelled');
 return jsonb_build_object('requestId',rid,'state','active_content_erased','messages',cardinality(mid),'vectors',count_vectors,'rawRows',count_raw,'storagePending',(select count(*) from public.retention_artifacts where tenant_id=t and status='pending'),'businessHistory','retained_authorized_audit','externalCopies','not_verified');
end $$;
-- Reingesta: una fila nueva del Tracker de un ticket en lapida entra VACIA (no se rechaza el lote entero de 250 filas).
create function public.tracker_tombstone_blank() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.ticket_id is not null and exists(select 1 from public.retention_ledger l where l.tenant_id=new.tenant_id and l.entity_type='conversation'
   and l.external_id in(new.ticket_id,'hubspot:'||new.ticket_id,'gorgias:'||new.ticket_id)) then
  new.cells='[]'::jsonb;new.ticket_id=null;new.ticket_cell=null;new.ticket_state='no_ticket';
 end if;
 return new;
end $$;
revoke all on function public.tracker_tombstone_blank() from public,anon,authenticated,service_role,vexa_backend;
create trigger tracker_tombstone_blank before insert on public.tracker_row_revisions for each row execute function public.tracker_tombstone_blank();
commit;
