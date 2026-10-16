import {ASSOCIATION_PROFILE,validateAssociationRecord} from './profile.mjs';
import {fail} from '../../jobs/durable/error.mjs';
const one=async(s,q,p=[])=>(await s.query(q,p)).rows[0];
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const normalizeFact=f=>({...f,version:Number(f.version)});
const normalizeCandidate=c=>({...c,headVersion:Number(c.headVersion)});
const bounded=v=>{if(Buffer.byteLength(JSON.stringify(v))>131072)fail('ASSOCIATION_RESPONSE_LIMIT',413);return v;};
function homogeneous(records){if(!Array.isArray(records)||!records.length||records.length>500||records.some(r=>r?.profile!==ASSOCIATION_PROFILE))fail('ASSOCIATION_RECORDS_INVALID',422);}
async function source(s,importId){
 const r=await one(s,'SELECT i.*,c.status AS connection_status FROM public.imports i JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id WHERE i.tenant_id=$1 AND i.id=$2',[s.tenantId,importId]);
 if(!r)fail('IMPORT_NOT_FOUND',404);if(r.provenance?.mapping?.profile!==ASSOCIATION_PROFILE)fail('SOURCE_SCOPE_MISMATCH',403);if(r.connection_status!=='active')fail('CONNECTION_REVOKED',403);return r;
}
export async function lockAssociationChunk(s,{jobId,records}){
 homogeneous(records);const j=await one(s,'SELECT import_id FROM public.jobs WHERE tenant_id=$1 AND id=$2',[s.tenantId,jobId]);if(!j)fail('JOB_NOT_FOUND',404);
 const i=await source(s,j.import_id);
 await s.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenantId+':native-customer-associations']);
 await s.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenantId+':'+i.connection_id]);
}
export async function persistAssociationChunk(s,{importId,records}){
 homogeneous(records);const i=await source(s,importId);
 for(const r of records)if(!r.validation_error){try{validateAssociationRecord(r,{tenantId:s.tenantId,connectionId:i.connection_id,fileHash:i.file_hash,mappingVersion:i.mapping_version});}catch{fail('ASSOCIATION_RECORD_INVALID',422);}}
 const input=JSON.stringify({importId,records});if(Buffer.byteLength(input)>20*1024*1024)fail('ASSOCIATION_CHUNK_LIMIT',413);
 return (await one(s,'SELECT public.association_commit_batch($1::jsonb) AS result',[input])).result;
}
const visible=`b.active AND f.resolution_state='resolved' AND f.version=b.fact_version AND f.selected_evidence_hash=b.evidence_hash
 AND EXISTS(SELECT 1 FROM public.source_heads h JOIN public.connections c ON c.tenant_id=h.tenant_id AND c.id=h.connection_id WHERE h.tenant_id=b.tenant_id AND h.id=b.conversation_id AND h.selected_revision_id=b.conversation_revision_id AND h.version=b.conversation_head_version AND h.state IN ('unique','selected') AND c.status='active' AND NOT public.retention_source_deleted(h.tenant_id,h.connection_id,h.entity_type,h.external_id))
 AND EXISTS(SELECT 1 FROM public.source_heads h JOIN public.connections c ON c.tenant_id=h.tenant_id AND c.id=h.connection_id WHERE h.tenant_id=b.tenant_id AND h.id=b.customer_id AND h.selected_revision_id=b.customer_revision_id AND h.version=b.customer_head_version AND h.state IN ('unique','selected') AND c.status='active' AND NOT public.retention_source_deleted(h.tenant_id,h.connection_id,h.entity_type,h.external_id))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b.provenance->'originProofs') p WHERE p ? 'approvalId' AND NOT EXISTS(SELECT 1 FROM public.audit_events a WHERE a.tenant_id=b.tenant_id AND a.resource=p->>'approvalId' AND a.action='association_origin_approved' AND a.provenance->>'version'=p->>'approvalVersion' AND a.provenance->'entryHashes' ? (p->>'entryHash') AND EXISTS(SELECT 1 FROM public.import_rows ir JOIN public.imports i ON i.tenant_id=ir.tenant_id AND i.id=ir.import_id JOIN public.source_revisions sr ON sr.tenant_id=ir.tenant_id AND sr.provenance->>'payload_ref'=ir.payload_ref AND sr.canonical_id::text=ir.provenance->'result'->>'canonical_id' AND sr.connection_id=i.connection_id AND sr.mapping_version=i.mapping_version JOIN public.source_heads mh ON mh.tenant_id=sr.tenant_id AND mh.id=sr.canonical_id AND mh.selected_revision_id=sr.id AND mh.state IN ('unique','selected') WHERE ir.tenant_id=b.tenant_id AND ir.id::text=p->>'importRowId' AND i.id::text=p->>'importId' AND ir.state IN ('accepted','duplicate') AND ((sr.entity_type='customer' AND sr.canonical_id=b.customer_id) OR (sr.entity_type='message' AND sr.related_conversation_id=b.conversation_id)) AND NOT public.retention_source_deleted(sr.tenant_id,sr.connection_id,sr.entity_type,sr.external_id)) AND NOT EXISTS(SELECT 1 FROM public.audit_events rv WHERE rv.tenant_id=a.tenant_id AND rv.resource=a.resource AND rv.action='association_origin_revoked')))`;
const candidateSQL=`with facts as materialized(select f.*,coalesce((select ir.provenance->'result'->'evidence' from public.import_rows ir where ir.tenant_id=$1::uuid and ir.provenance->'result'->>'fact_id'=f.id::text and ir.provenance->'result'->>'evidence_hash'=f.selected_evidence_hash order by ir.id limit 1),f.immutable_evidence) ev from public.native_customer_associations f where f.tenant_id=$1::uuid and f.id=any(ARRAY[$2::uuid]) and f.resolution_state<>'retained'),
 origins as materialized(select * from (select resource::uuid approval_id,(provenance->>'version')::bigint version, entry_hash,entry from (select distinct on(resource) resource,provenance from public.audit_events where tenant_id=$1::uuid and action in('association_origin_approved','association_origin_revoked') order by resource,(provenance->>'version')::bigint desc) latest cross join lateral jsonb_array_elements(provenance->'entries') entry cross join lateral (select (provenance->'entryHashes'->> (idx.ord-1)::int) entry_hash from jsonb_array_elements(provenance->'entries') with ordinality idx(v,ord) where idx.v=entry limit 1) hashes where provenance->>'state'='approved') origins_inline),
 endpoint_rows as(
 select f.id fact_id,'customer'::text kind,c.id,c.connection_id,c.external_id,r.id revision_id,h.version::bigint head_version,o.approval_id,o.version,o.entry_hash,i.id import_id,ir.id row_id
 from facts f join public.customers c on c.tenant_id=$1::uuid and c.external_id=f.contact_id and (true or c.connection_id=f.source_connection_id)
 join public.connections cn on cn.tenant_id=$1::uuid and cn.id=c.connection_id and cn.status='active' and cn.source='csv'
 join public.source_heads h on h.tenant_id=$1::uuid and h.id=c.id and h.connection_id=c.connection_id and h.entity_type='customer' and h.external_id=c.external_id and h.state in('unique','selected')
 join public.source_revisions r on r.tenant_id=$1::uuid and r.id=h.selected_revision_id and r.canonical_id=c.id and r.customer_id=c.id and r.connection_id=c.connection_id and r.entity_type='customer' and r.external_id=c.external_id and r.provenance->>'adapter_version'='csv-customer-v1' and r.provenance->>'ingestion_profile'='hubspot-contact-csv-v1' and r.provenance->>'account_id'=cn.account_id
 join public.import_rows ir on ir.tenant_id=$1::uuid and ir.payload_ref=r.provenance->>'payload_ref' and ir.state in('accepted','duplicate') and ir.provenance->'result'->>'canonical_id'=c.id::text
 join public.imports i on i.tenant_id=$1::uuid and i.id=ir.import_id and i.connection_id=c.connection_id and i.mapping_version=r.mapping_version and i.provenance->'mapping'->>'profile'='hubspot-contact-csv-v1'
 join origins o on o.entry->>'importId'=i.id::text and o.entry->>'fileHash'=i.file_hash and o.entry->>'mappingVersion'=i.mapping_version and o.entry->>'connectionId'=i.connection_id::text and o.entry->>'portalId'=f.portal_id and o.entry->>'namespace'='hubspot-contact'
 where not public.retention_source_deleted($1::uuid,c.connection_id,'customer',c.external_id)
 union all
 select f.id,'conversation',c.id,c.connection_id,c.external_id,cr.id,ch.version::bigint,o.approval_id,o.version,o.entry_hash,i.id,ir.id
 from facts f join public.conversations c on c.tenant_id=$1::uuid and (true or c.connection_id=f.source_connection_id) and (c.external_id='hubspot:'||f.ticket_id or c.external_id='gorgias:'||(f.ev->'bridge'->'property'->>'value') or true and exists(select 1 from jsonb_array_elements(f.ev->'bridge'->'notes') n where c.external_id='gorgias:'||(n->>'gorgiasId')))
 join public.connections cn on cn.tenant_id=$1::uuid and cn.id=c.connection_id and cn.status='active' and cn.source='csv'
 join public.source_heads ch on ch.tenant_id=$1::uuid and ch.id=c.id and ch.connection_id=c.connection_id and ch.entity_type='conversation' and ch.external_id=c.external_id and ch.state in('unique','selected')
 join public.source_revisions cr on cr.tenant_id=$1::uuid and cr.id=ch.selected_revision_id and cr.canonical_id=c.id and cr.conversation_id=c.id and cr.connection_id=c.connection_id and cr.entity_type='conversation' and cr.source_revision='csv-container-v1' and cr.provenance->>'account_id'=cn.account_id
 join public.messages m on m.tenant_id=$1::uuid and m.connection_id=c.connection_id and m.conversation_id=c.id and m.deleted_at is null
 join public.source_heads mh on mh.tenant_id=$1::uuid and mh.id=m.id and mh.entity_type='message' and mh.connection_id=c.connection_id and mh.state in('unique','selected')
 join public.source_revisions mr on mr.tenant_id=$1::uuid and mr.id=mh.selected_revision_id and mr.canonical_id=m.id and mr.message_id=m.id and mr.related_conversation_id=c.id and mr.connection_id=c.connection_id and mr.entity_type='message' and mr.provenance->>'adapter_version'='csv-message-v1'
 join public.import_rows ir on ir.tenant_id=$1::uuid and ir.payload_ref=mr.provenance->>'payload_ref' and ir.state in('accepted','duplicate') and ir.provenance->'result'->>'canonical_id'=m.id::text
 join public.imports i on i.tenant_id=$1::uuid and i.id=ir.import_id and i.connection_id=c.connection_id and i.mapping_version=mr.mapping_version
 join origins o on o.entry->>'importId'=i.id::text and o.entry->>'fileHash'=i.file_hash and o.entry->>'mappingVersion'=i.mapping_version and o.entry->>'connectionId'=i.connection_id::text and o.entry->>'portalId'=f.portal_id and o.entry->>'namespace'=case when c.external_id like 'hubspot:%' then 'hubspot-ticket' else 'gorgias-ticket' end
 where c.deleted_at is null and not public.retention_source_deleted($1::uuid,c.connection_id,'conversation',c.external_id) and not public.retention_source_deleted($1::uuid,m.connection_id,'message',m.external_id)
 ), dedup as(select distinct on(fact_id,kind,id) * from endpoint_rows order by fact_id,kind,id,approval_id,row_id)
 select fact_id,kind,id,connection_id,external_id,revision_id,head_version,jsonb_build_object('approvalId',approval_id,'approvalVersion',version,'entryHash',entry_hash,'importId',import_id,'importRowId',row_id,'canonicalId',id,'revisionId',revision_id,'headVersion',head_version) AS proof from dedup
 union all
 select f.id,'conversation',c.id,c.connection_id,c.external_id,r.id,h.version::bigint,jsonb_build_object('native',true,'source','hubspot','accountId',cn.account_id,'connectionId',cn.id,'canonicalId',c.id,'revisionId',r.id,'headVersion',h.version) AS proof
 from facts f join public.conversations c on true and c.tenant_id=$1::uuid and c.external_id=f.ticket_id and c.source='hubspot' and c.deleted_at is null
 join public.connections cn on cn.tenant_id=$1::uuid and cn.id=c.connection_id and cn.status='active' and cn.source='hubspot' and cn.account_id=f.portal_id
 join public.source_heads h on h.tenant_id=$1::uuid and h.id=c.id and h.entity_type='conversation' and h.connection_id=c.connection_id and h.external_id=c.external_id and h.state in('unique','selected')
 join public.source_revisions r on r.tenant_id=$1::uuid and r.id=h.selected_revision_id and r.canonical_id=c.id and r.conversation_id=c.id and r.entity_type='conversation' and r.connection_id=c.connection_id and r.provenance->>'source'='hubspot' and r.provenance->>'account_id'=f.portal_id
 where not public.retention_source_deleted($1::uuid,c.connection_id,'conversation',c.external_id)`;
const summary=`f.id,f.source_connection_id,f.provider,f.portal_id,f.ticket_id,f.contact_id,f.first_evidence_hash,f.source_version_hash,f.resolution_state,f.reason,f.version,f.selected_evidence_hash,f.created_at,f.updated_at,f.retained_at`;
function pagination(p){if(p.limit!==undefined&&p.limit!==25)fail('ASSOCIATION_INPUT_INVALID',400);for(const k of ['cursor','conversationId','customerId'])if(p[k]!=null&&!uuid(p[k]))fail('ASSOCIATION_INPUT_INVALID',400);}
export function createAssociationRepository({database}){
 if(!database?.transaction)fail('ASSOCIATION_CONFIGURATION_REQUIRED',503);
 const read=fn=>database.transaction('read',fn),write=p=>database.transaction('import',async s=>{if(s.role!=='owner')fail('OWNER_REQUIRED',403);return bounded((await one(s,'SELECT public.association_resolve($1::jsonb) AS result',[JSON.stringify(p)])).result);});
 return Object.freeze({
  async list(p={}){pagination(p);if(p.state!=null&&!['pending','resolved','blocked','retained'].includes(p.state))fail('ASSOCIATION_INPUT_INVALID',400);return read(async s=>{
   const rows=(await s.query(`SELECT ${summary} FROM public.native_customer_associations f WHERE f.tenant_id=$1 AND ($2::text IS NULL OR f.resolution_state=$2) AND ($3::uuid IS NULL OR f.id>$3) AND (($4::uuid IS NULL AND $5::uuid IS NULL) OR EXISTS(SELECT 1 FROM public.conversation_customer_association_bindings b WHERE b.tenant_id=f.tenant_id AND b.fact_id=f.id AND ($4::uuid IS NULL OR b.conversation_id=$4) AND ($5::uuid IS NULL OR b.customer_id=$5))) ORDER BY f.id LIMIT 26`,[s.tenantId,p.state??null,p.cursor??null,p.conversationId??null,p.customerId??null])).rows;
   return bounded({items:rows.slice(0,25).map(normalizeFact),nextCursor:rows.length>25?rows[24].id:null,canResolve:s.role==='owner'});
  });},
  async get({factId,evidenceCursor=null,candidateCursor=null}){if(!uuid(factId)||(evidenceCursor!==null&&!uuid(evidenceCursor))||(candidateCursor!==null&&!uuid(candidateCursor)))fail('ASSOCIATION_INPUT_INVALID',400);return read(async s=>{
   const found=await one(s,`SELECT ${summary} FROM public.native_customer_associations f WHERE f.tenant_id=$1 AND f.id=$2`,[s.tenantId,factId]);if(!found)fail('ASSOCIATION_NOT_FOUND',404);const fact=normalizeFact(found);
   const candidates=(await s.query(`WITH candidates AS (${candidateSQL}) SELECT kind,id,connection_id AS "connectionId",external_id AS "externalId",head_version AS "headVersion",revision_id AS "revisionId",proof FROM candidates WHERE ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT 26`,[s.tenantId,factId,candidateCursor])).rows;
   fact.candidates={conversations:candidates.slice(0,25).filter(x=>x.kind==='conversation').map(row=>{const x={...row};delete x.kind;return normalizeCandidate(x);}),customers:candidates.slice(0,25).filter(x=>x.kind==='customer').map(row=>{const x={...row};delete x.kind;return normalizeCandidate(x);}),nextCursor:candidates.length>25?candidates[24].id:null};
   const rows=(await s.query(`SELECT r.id,r.import_id,r.row_ref,r.state,r.provenance->'result' AS result,NOT public.association_raw_available(r.import_id) AS "sharedRawUnavailable" FROM public.import_rows r WHERE r.tenant_id=$1 AND r.provenance->'result'->>'fact_id'=$2 AND ($3::uuid IS NULL OR r.id>$3) ORDER BY r.id LIMIT 26`,[s.tenantId,factId,evidenceCursor])).rows;
   const bindings=(await s.query(`SELECT b.*,${visible} AS current FROM public.conversation_customer_association_bindings b JOIN public.native_customer_associations f ON f.tenant_id=b.tenant_id AND f.id=b.fact_id WHERE b.tenant_id=$1 AND b.fact_id=$2 AND ${visible} ORDER BY b.id LIMIT 33`,[s.tenantId,factId])).rows;if(bindings.length>32)fail('ASSOCIATION_BINDING_PAGE_LIMIT',413);
   const shared=!!(await one(s,"SELECT EXISTS(SELECT 1 FROM public.import_rows WHERE tenant_id=$1 AND provenance->'result'->>'fact_id'=$2 AND NOT public.association_raw_available(import_id)) AS value",[s.tenantId,factId])).value;
   const out={fact,evidence:{items:[],nextCursor:null},bindings,canResolve:s.role==='owner',sharedRawUnavailable:shared};
   for(const r of rows.slice(0,25)){out.evidence.items.push(r);if(Buffer.byteLength(JSON.stringify(out))>130000){out.evidence.items.pop();if(!out.evidence.items.length)fail('ASSOCIATION_EVIDENCE_LIMIT',413);break;}}
   if(rows.length>out.evidence.items.length)out.evidence.nextCursor=out.evidence.items.at(-1).id;return bounded(out);
  });},
  async edges(p={}){pagination(p);if(p.provenanceCursor!=null&&(!uuid(p.provenanceCursor)||!p.conversationId||!p.customerId))fail('ASSOCIATION_INPUT_INVALID',400);return read(async s=>{
   const rows=(await s.query(`WITH edges AS (SELECT b.conversation_id,b.customer_id,min(b.id::text)::uuid AS id FROM public.conversation_customer_association_bindings b JOIN public.native_customer_associations f ON f.tenant_id=b.tenant_id AND f.id=b.fact_id WHERE b.tenant_id=$1 AND ${visible} AND ($2::uuid IS NULL OR b.conversation_id=$2) AND ($3::uuid IS NULL OR b.customer_id=$3) GROUP BY b.conversation_id,b.customer_id), page AS (SELECT * FROM edges WHERE ($4::uuid IS NULL OR id>$4) ORDER BY id LIMIT 26) SELECT e.id,e.conversation_id AS "conversationId",e.customer_id AS "customerId",ARRAY(SELECT DISTINCT b.fact_id FROM public.conversation_customer_association_bindings b JOIN public.native_customer_associations f ON f.tenant_id=b.tenant_id AND f.id=b.fact_id WHERE b.tenant_id=$1 AND b.conversation_id=e.conversation_id AND b.customer_id=e.customer_id AND ${visible} AND ($5::uuid IS NULL OR b.fact_id>$5) ORDER BY b.fact_id LIMIT 26) AS facts FROM page e ORDER BY e.id`,[s.tenantId,p.conversationId??null,p.customerId??null,p.cursor??null,p.provenanceCursor??null])).rows;
   return bounded({items:rows.slice(0,25).map(r=>({conversationId:r.conversationId,customerId:r.customerId,factIds:r.facts.slice(0,25),provenanceCursor:r.facts.length>25?r.facts[24]:null})),nextCursor:rows.length>25?rows[24].id:null});
  });},
  resolve(p){return write({operation:'resolve',...p});},
  approveOrigin(p){return write({operation:'approve_origin',...p});},
  revokeOrigin(p){return write({operation:'revoke_origin',...p});},
  async origins(p={}){pagination(p);return read(async s=>{
   const rows=(await s.query(`WITH current AS (SELECT DISTINCT ON(resource) id,resource,reason,created_at,provenance FROM public.audit_events WHERE tenant_id=$1 AND action IN ('association_origin_approved','association_origin_revoked') ORDER BY resource,(provenance->>'version')::bigint DESC) SELECT resource::uuid AS id,resource AS "approvalId",(provenance->>'version')::bigint AS version,provenance->>'state' AS state,provenance->>'manifestHash' AS "manifestHash",provenance->'entries' AS entries,provenance->'entryHashes' AS "entryHashes",reason,created_at AS "createdAt" FROM current WHERE ($2::uuid IS NULL OR resource::uuid>$2) ORDER BY resource::uuid LIMIT 26`,[s.tenantId,p.cursor??null])).rows;
   const result={items:[],nextCursor:null,canApprove:s.role==='owner'};
   for(const row of rows.slice(0,25)){result.items.push({...row,version:Number(row.version)});if(Buffer.byteLength(JSON.stringify(result))>130000){result.items.pop();if(!result.items.length)fail('ASSOCIATION_ORIGIN_LIMIT',413);break;}}
   if(rows.length>result.items.length)result.nextCursor=result.items.at(-1).id;return bounded(result);
  });}
 });
}
