import {randomUUID} from 'node:crypto';
import {fixtureFactory} from '../F04-causality/fixtures.mjs';
import {insert} from '../../tests/acceptance/support/F01-03/matrix.mjs';
import {q} from './harness.mjs';

// Seeds use real ingestion + extraction repositories and committed evidence.
// SQL only supplies a synthetic vector grouping of that authorized evidence.
export async function exposureFixture(h){
 h.database=a=>h.repository(a).database;
 h.job=a=>{const id=randomUUID();h.sql(`INSERT INTO jobs(id,tenant_id,type,state,input_ref,input_hash,version) VALUES(${q(id)},${q(a.tenant)},'extraction','running','SYN-EXPOSURE259',${q(randomUUID())},'SYN-v1')`);return id;};
 const extraction=await fixtureFactory(h);
 async function problem(a,label){
  const f=await extraction('customer',a);await f.complete();
  const id=randomUUID(),embeddingId=randomUUID();
  const snapshot={id,label,version:1,state:'active',outlier:true,modelId:'synthetic-3d',dimensions:3,embeddingVersion:'1',embeddingIds:[embeddingId],conversationIds:[f.conversationId],orderIds:[]};
  h.sql(`BEGIN;SELECT set_config('request.jwt.claim.sub',${q(a.id)},true),set_config('vexa.tenant_id',${q(a.tenant)},true),set_config('vexa.action','configure',true);`+
   insert('embeddings',{id:embeddingId,tenant_id:a.tenant,model_id:'synthetic-3d',dim:3,version:'1',content:'SYN operational exposure grouping',embedding:'[1,0,0]',message_revision_id:f.span.message_revision_id})+';'+
   insert('problems',{id,tenant_id:a.tenant,title:label,severity:'high',cause_status:'unknown',provenance:{kind:'vector-problem-v1'}})+';'+
   insert('problem_embedding_members',{tenant_id:a.tenant,embedding_id:embeddingId,problem_id:id,extraction_run_id:f.prepared.runId,conversation_id:f.conversationId})+';'+
   insert('problem_versions',{id:randomUUID(),tenant_id:a.tenant,problem_id:id,previous_version_id:null,version:1,title:label,rationale:'SYN independently reviewed grouping fixture',change_kind:'create',provenance:{kind:'vector-problem-v1',snapshot,actorId:a.id,operation:'create'}})+';COMMIT;');
  return {id,label,extraction:f};
 }
 return {problem};
}
