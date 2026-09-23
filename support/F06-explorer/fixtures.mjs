// SYN-EXPLORER280: real ingestion/extraction and ledger; synthetic vector grouping only.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {order} from '../F05-snapshots/fixtures.mjs';
import {seedWorkspace,scope} from '../F06-workspace/fixtures.mjs';
import {insert} from '../../tests/acceptance/support/F01-03/matrix.mjs';
import {q} from './harness.mjs';
export {scope};export {createReader} from '../F06-recommendations/fixtures.mjs';
export async function seedExplorer(h){
 const ids=[];const f=await seedWorkspace(h,async({src,p1,p2,o1,o2,ledger,ok})=>{
  const unknown=await ledger(order(src,'SYN-EXPLORER-UNKNOWN',null));for(const [row,sku] of [[o1,'SKU-X'],[o2,'SKU-Y'],[unknown,'SKU-Z']])await ok(h.request(h.A,'/api/workspace/mappings',{ledgerRowId:row.rowId,expectedVersion:0,skus:[sku],source:'csv',active:true,report:'SYN owner attests order SKU and operational source for scoped Explorer references.',attested:true}));ids.push(p1.id,p2.id);const e=p1.extraction;
  for(let i=0;i<99;i++){
   const id=randomUUID(),embeddingId=randomUUID(),version='SYN-explorer280-'+i,label=p1.label;
   const snapshot={id,label,version:1,state:'active',outlier:true,modelId:'synthetic-3d',dimensions:3,embeddingVersion:version,embeddingIds:[embeddingId],conversationIds:[e.conversationId],orderIds:[]};
   h.sql(`BEGIN;SELECT set_config('request.jwt.claim.sub',${q(h.A.id)},true),set_config('vexa.tenant_id',${q(h.A.tenant)},true),set_config('vexa.action','configure',true);`+
    insert('embeddings',{id:embeddingId,tenant_id:h.A.tenant,model_id:'synthetic-3d',dim:3,version,content:'SYN Explorer pagination grouping',embedding:'[1,0,0]',message_revision_id:e.span.message_revision_id})+';'+
    insert('problems',{id,tenant_id:h.A.tenant,title:label,severity:'high',cause_status:'unknown',provenance:{kind:'vector-problem-v1'}})+';'+
    insert('problem_embedding_members',{tenant_id:h.A.tenant,embedding_id:embeddingId,problem_id:id,extraction_run_id:e.prepared.runId,conversation_id:e.conversationId})+';'+
    insert('problem_versions',{id:randomUUID(),tenant_id:h.A.tenant,problem_id:id,previous_version_id:null,version:1,title:label,rationale:'SYN pagination grouping of authorized captured evidence',change_kind:'create',provenance:{kind:'vector-problem-v1',snapshot,actorId:h.A.id,operation:'create'}})+';COMMIT;');
   await ledger({operation:'link',problemId:id,ledgerRowId:o1.rowId,expectedVersion:0,active:true,report:'SYN owner attests authorized grouping linked to the same observed order; never additive across groups.',attested:true});ids.push(id);
  }
 const {dateBasis:_dateBasis,...economicQuery}=scope;const exposure=await ok(h.request(h.A,'/api/economics?'+new URLSearchParams(economicQuery)));await ledger({operation:'relationCoverage',scope,expectedInputHash:exposure.exposure.inputHash,expectedVersion:exposure.exposure.coverage?.version??0,complete:true,report:'SYN owner confirms exhaustive fixture relationship review: two linked orders and one deliberately unrelated order, all 101 problem links inspected.',attested:true});
 });assert.equal(new Set(ids).size,101);return {...f,ids};
}
