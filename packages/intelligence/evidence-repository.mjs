import {sha256,validateExtraction} from './index.mjs';
import {identityKey} from '../ingestion/index.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const fail=()=>{throw Object.assign(Error('EVIDENCE_UNAVAILABLE'),{code:'23514'});};
const one=async(s,sql,args)=>(await s.query(sql,args)).rows[0];
/** Read only the immutable redacted input manifest. Private PII maps are never queried. */
export function createEvidenceRepository({database}={}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function')fail();
 return Object.freeze({async get(runId){
  if(!uuid(runId))fail();
  return database.transaction('read',async s=>{
   const run=await one(s,'SELECT id,status,conversation_id,input_hash,provenance,model_id,created_at FROM public.extraction_runs WHERE tenant_id=$1 AND id=$2',[s.tenantId,runId]);
   if(!run||!['succeeded','abstained'].includes(run.status))fail();
   const manifest=run.provenance.input_manifest;
   if(!Array.isArray(manifest)||!manifest.length||manifest.length>500||new Set(manifest.map(x=>x?.message_revision_id)).size!==manifest.length||manifest.some(x=>!uuid(x?.message_revision_id)||!uuid(x?.original_revision_id)||! /^[a-f0-9]{64}$/.test(x?.hash??'')||!['customer','agent','internal'].includes(x?.role)))fail();
   const conversation=await one(s,`SELECT c.id,c.external_id,c.source,c.connection_id,c.deleted_at,n.account_id,n.status,h.state
    FROM public.conversations c JOIN public.connections n ON n.tenant_id=c.tenant_id AND n.id=c.connection_id
    LEFT JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id WHERE c.tenant_id=$1 AND c.id=$2`,[s.tenantId,run.conversation_id]);
   if(!conversation||conversation.deleted_at||conversation.status!=='active'||!['unique','selected','ambiguous'].includes(conversation.state))fail();
   const stored=(await s.query(`SELECT r.id,r.message_id,r.redacted_text,r.hash,r.deleted_at,r.redaction_version,r.provenance,
    original.id AS original_id,original.message_id AS original_message_id,original.deleted_at AS original_deleted,
    m.deleted_at AS message_deleted,m.connection_id,m.external_id,
    sr.snapshot,sr.canonical_id,sr.connection_id AS source_connection,
    current_source.message_revision_id AS current_revision,h.state AS head_state
    FROM public.message_revisions r JOIN public.message_revisions original ON original.tenant_id=r.tenant_id AND original.id::text=r.provenance->>'original_revision_id'
    JOIN public.messages m ON m.tenant_id=r.tenant_id AND m.id=r.message_id
    JOIN public.source_revisions sr ON sr.tenant_id=original.tenant_id AND sr.message_revision_id=original.id AND sr.entity_type='message'
    LEFT JOIN public.source_heads h ON h.tenant_id=m.tenant_id AND h.id=m.id
    LEFT JOIN public.source_revisions current_source ON current_source.tenant_id=h.tenant_id AND current_source.id=h.selected_revision_id
    WHERE r.tenant_id=$1 AND r.id=ANY($2::uuid[])`,[s.tenantId,manifest.map(x=>x.message_revision_id)])).rows;
   if(stored.length!==manifest.length||new Set(stored.map(x=>x.id)).size!==stored.length)fail();
   const byId=new Map(stored.map(x=>[x.id,x])),revisions=[],tombstoneKeys=[conversation.id,conversation.external_id];let historical=!['unique','selected'].includes(conversation.state),bytes=0;
   const key=(entityType,externalId)=>{const identity=identityKey({tenant_id:s.tenantId,connection_id:conversation.connection_id,source:conversation.source,source_account_id:conversation.account_id,entity_type:entityType,external_id:externalId});tombstoneKeys.push(identity,sha256(identity));};key('conversation',conversation.external_id);
   for(const input of manifest){
    const r=byId.get(input.message_revision_id),snapshots=r?.snapshot?.filter(x=>x.table==='messages'&&x.row?.id===r.message_id);
    if(!r||!['unique','selected','ambiguous'].includes(r.head_state)||r.deleted_at||r.original_deleted||r.message_deleted||!r.redaction_version||r.original_id!==input.original_revision_id||r.original_message_id!==r.message_id||r.canonical_id!==r.message_id||r.connection_id!==conversation.connection_id||r.source_connection!==conversation.connection_id||snapshots?.length!==1||snapshots[0].row.role!==input.role||snapshots[0].row.conversation_id!==run.conversation_id||typeof r.redacted_text!=='string'||r.hash!==input.hash||sha256(r.redacted_text)!==input.hash)fail();
    bytes+=Buffer.byteLength(r.redacted_text);if(bytes>1000000)fail();
    revisions.push({tenant_id:s.tenantId,message_revision_id:r.id,role:input.role,text:r.redacted_text});
    if(!['unique','selected'].includes(r.head_state)||r.current_revision!==r.original_id)historical=true;
    tombstoneKeys.push(r.id,r.original_id,r.message_id,r.external_id);key('message',r.external_id);
   }
   if(await one(s,'SELECT id FROM public.tombstones WHERE tenant_id=$1 AND (connection_id IS NULL OR connection_id=$2) AND deleted_source_key=ANY($3::text[]) LIMIT 1',[s.tenantId,conversation.connection_id,tombstoneKeys]))fail();
   if(sha256(JSON.stringify({revisions,policyHash:run.provenance.policy_hash,taxonomy:run.provenance.taxonomy}))!==run.input_hash)fail();
   const result=validateExtraction(run.provenance.result,revisions,{taxonomy:run.provenance.taxonomy,tenantId:s.tenantId});if(!result.ok)fail();
   return {runId:run.id,conversationId:run.conversation_id,state:historical?'historical':'current',status:run.status,model:run.model_id,createdAt:run.created_at,...result.data};
  });
 }});
}
