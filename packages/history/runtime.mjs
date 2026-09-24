import {createExtractionQueue} from '../intelligence/queue.mjs';
import {createProblemRepository,evidence} from '../problems/repository.mjs';
import {key,requireThat,trustedDatabase} from './contracts.mjs';
const one=async(s,q,a)=>(await s.query(q,a)).rows[0];
const terminal=['succeeded','failed','cancelled'];
export function createHistoryRuntime({database,resolveConfig,chunkSize=25,afterCommit}={}){
 requireThat(Number.isInteger(chunkSize)&&chunkSize>=1&&chunkSize<=25,'history_chunk_invalid',400);
 const db=trustedDatabase(database);
 return {async tick(){const result=await db.transaction('import',async s=>{
 requireThat(s.role==='analyst'&&(await one(s,'SELECT public.history_worker($1) AS ok',[s.tenantId]))?.ok,'worker_disabled',403);
 const b=await one(s,"SELECT * FROM public.history_batches WHERE tenant_id=$1 AND state='active' ORDER BY last_tick NULLS FIRST,created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",[s.tenantId]);if(!b)return{state:'idle'};
 const auth=await one(s,'SELECT public.history_batch_authorized($1) AS ok',[b.id]);
 const c=await resolveConfig(s.tenantId,s),reason=!auth?.ok?'authorization_revoked':!c.ready||!c.enabled?'runtime_disabled':c.extractionHash!==b.extraction_hash||c.embeddingHash!==b.embedding_hash?'configuration_changed':null;
 if(reason){await s.query("UPDATE public.history_batches SET state='paused',reason=$3,version=version+1,last_tick=clock_timestamp() WHERE tenant_id=$1 AND id=$2",[s.tenantId,b.id,reason]);return{state:'paused',id:b.id,reason};}
 const scoped={transaction:async(_,work)=>work(s)},extraction=createExtractionQueue({database:scoped}),problems=createProblemRepository({database:scoped});
 if(!b.enumerated){const sources=(await s.query("SELECT c.id FROM public.conversations c JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id WHERE c.tenant_id=$1 AND c.connection_id=$2 AND c.deleted_at IS NULL AND c.created_at<=$3 AND h.state IN ('unique','selected') AND ($4::uuid IS NULL OR c.id>$4) ORDER BY c.id LIMIT $5",[s.tenantId,b.connection_id,b.cutoff,b.cursor,chunkSize])).rows;
 for(const row of sources)await s.query('INSERT INTO public.history_items(tenant_id,batch_id,conversation_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[s.tenantId,b.id,row.id]);
 b.enumerated=sources.length<chunkSize;b.cursor=sources.at(-1)?.id??b.cursor;
 await s.query('UPDATE public.history_batches SET cursor=$3,enumerated=$4 WHERE tenant_id=$1 AND id=$2',[s.tenantId,b.id,b.cursor,b.enumerated]);}
 const items=(await s.query("SELECT * FROM public.history_items WHERE tenant_id=$1 AND batch_id=$2 AND state IN ('pending','extracting','grouping') ORDER BY last_checked NULLS FIRST,conversation_id LIMIT $3 FOR UPDATE",[s.tenantId,b.id,chunkSize])).rows;
 for(const item of items){let state=item.state,itemReason=null,extractionJob=item.extraction_job,embeddingJob=item.embedding_job;
 // A savepoint isolates a rejected source; infrastructure failures still roll back the chunk.
 await s.query('SAVEPOINT history_item');
 try{
 if(state==='pending'){const j=await extraction.submit({conversationId:item.conversation_id,requestKey:key(b.id,item.conversation_id,b.extraction_hash,'extraction'),configHash:b.extraction_hash});extractionJob=j.id;state='extracting';}
 else if(state==='extracting'){const j=await one(s,'SELECT j.state,j.provenance,e.id AS run_id,e.status AS run_status FROM public.jobs j LEFT JOIN public.extraction_runs e ON e.tenant_id=j.tenant_id AND e.job_id=j.id WHERE j.tenant_id=$1 AND j.id=$2',[s.tenantId,extractionJob]);
 if(terminal.includes(j?.state)){if(j.state==='succeeded'&&j.run_status==='succeeded'){await evidence(s,j.run_id);const g=await problems.submit({extractionRunId:j.run_id,requestKey:key(b.id,item.conversation_id,b.embedding_hash,'embedding'),configHash:b.embedding_hash});embeddingJob=g.id;state='grouping';}else{state=j?.run_status==='abstained'?'skipped':'failed';itemReason=j?.run_status==='abstained'?'extraction_abstained':'extraction_failed';}}}
 else{const j=await one(s,'SELECT state FROM public.jobs WHERE tenant_id=$1 AND id=$2',[s.tenantId,embeddingJob]);if(terminal.includes(j?.state)){state=j.state==='succeeded'?'completed':'failed';itemReason=j.state==='succeeded'?null:'grouping_failed';}}
 await s.query('RELEASE SAVEPOINT history_item');
 }catch(error){await s.query('ROLLBACK TO SAVEPOINT history_item');await s.query('RELEASE SAVEPOINT history_item');if(!['source_unavailable','EVIDENCE_UNAVAILABLE','source_changed'].includes(error.message))throw error;state='failed';itemReason='source_unavailable';}
 await s.query('UPDATE public.history_items SET state=$4,reason=$5,extraction_job=$6,embedding_job=$7,last_checked=clock_timestamp() WHERE tenant_id=$1 AND batch_id=$2 AND conversation_id=$3',[s.tenantId,b.id,item.conversation_id,state,itemReason,extractionJob,embeddingJob]);
 }
 const remaining=await one(s,"SELECT count(*)::integer AS n FROM public.history_items WHERE tenant_id=$1 AND batch_id=$2 AND state IN ('pending','extracting','grouping')",[s.tenantId,b.id]);const state=b.enumerated&&remaining.n===0?'completed':'active';
 await s.query('UPDATE public.history_batches SET state=$3,last_tick=clock_timestamp(),version=version+CASE WHEN state<>$3 THEN 1 ELSE 0 END WHERE tenant_id=$1 AND id=$2',[s.tenantId,b.id,state]);return{id:b.id,state,processed:items.length,enumerated:b.enumerated};
 });await afterCommit?.(result);return result;}};
}
