import {randomUUID} from 'node:crypto';
import {sha256,extractionSchema,validateExtraction} from './index.mjs';
import {redactText} from './redact.mjs';
import {createExtractionSourceReader} from './source-reader.mjs';
import {identityKey} from '../ingestion/index.mjs';
import {extractionPromptHash} from '../gateway/index.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fail=code=>{throw Object.assign(Error(code),{code:'23514'});};
const one=async(s,sql,args)=>(await s.query(sql,args)).rows[0];
const derivedId=(source,policy)=>{const h=sha256('vexa-redaction-v1:'+source+':'+policy);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
async function currentSources(s,conversationId){
 const c=await one(s,`SELECT c.*,n.account_id,n.status AS connection_status,h.state AS head_state FROM public.conversations c
  JOIN public.connections n ON n.tenant_id=c.tenant_id AND n.id=c.connection_id
  LEFT JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id
  WHERE c.tenant_id=$1 AND c.id=$2`,[s.tenantId,conversationId]);
 if(!c||c.deleted_at||c.connection_status!=='active'||!['unique','selected'].includes(c.head_state))fail('EXTRACTION_CONVERSATION_UNAVAILABLE');
 const rows=(await s.query(`SELECT m.id AS message_id,m.role,m.external_id,m.connection_id,r.id,r.text_ref,r.hash,r.provenance,r.deleted_at,h.state AS head_state
  FROM public.messages m LEFT JOIN public.source_heads h ON h.tenant_id=m.tenant_id AND h.id=m.id
  LEFT JOIN public.source_revisions sr ON sr.tenant_id=h.tenant_id AND sr.id=h.selected_revision_id
  LEFT JOIN public.message_revisions r ON r.tenant_id=sr.tenant_id AND r.id=sr.message_revision_id
  WHERE m.tenant_id=$1 AND m.conversation_id=$2 AND m.deleted_at IS NULL ORDER BY m.id LIMIT 501`,[s.tenantId,conversationId])).rows;
 if(!rows.length||rows.length>500||rows.some(r=>!r.id||r.deleted_at||!['unique','selected'].includes(r.head_state)))fail('EXTRACTION_REVISION_UNAVAILABLE');
 const keys=[c.id,c.external_id];
 for(const row of [{...c,message_id:c.id,id:c.id,entity_type:'conversation'},...rows.map(r=>({...r,entity_type:'message'}))]){
  const identity=identityKey({tenant_id:s.tenantId,connection_id:c.connection_id,source:c.source,source_account_id:c.account_id,entity_type:row.entity_type,external_id:row.external_id});keys.push(row.id,row.message_id,row.external_id,identity,sha256(identity));
 }
 if(await one(s,'SELECT id FROM public.tombstones WHERE tenant_id=$1 AND (connection_id IS NULL OR connection_id=$2) AND deleted_source_key=ANY($3::text[]) LIMIT 1',[s.tenantId,c.connection_id,keys]))fail('EXTRACTION_TOMBSTONED');
 return rows;
}
/** Server-owned repository; original content and redaction maps never leave this boundary. */
export function createExtractionRepository({database,storage,sourceReader=createExtractionSourceReader({storage}),ownerToken=randomUUID()}={}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function'||typeof sourceReader!=='function'||!uuid(ownerToken))fail('EXTRACTION_CONFIGURATION_REQUIRED');
 return Object.freeze({
  async prepare({conversationId,jobId,taskKey,taxonomy,policy}){
   if(!uuid(conversationId)||!uuid(jobId)||typeof taskKey!=='string'||!taskKey||taskKey.length>200)fail('EXTRACTION_INPUT_INVALID');
   const config=structuredClone({taxonomy,policy}),schema=extractionSchema(config.taxonomy,{modelOutput:true}),policyHash=redactText('',config.policy).policyHash;
   const requestHash=sha256(JSON.stringify({conversationId,jobId,taxonomy:config.taxonomy,policyHash}));
   return database.transaction('import',async s=>{
    await s.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenantId+':extraction:'+taskKey]);
    const previous=await one(s,`SELECT r.id,r.status,r.provenance FROM public.extraction_claims c JOIN public.extraction_runs r ON r.tenant_id=c.tenant_id AND r.id=c.run_id WHERE c.tenant_id=$1 AND c.task_key=$2`,[s.tenantId,taskKey]);
    if(previous){if(previous.provenance.request_hash!==requestHash)fail('EXTRACTION_TASK_CONFLICT');return {acquired:false,runId:previous.id,status:previous.status};}
    const job=await one(s,"SELECT id FROM public.jobs WHERE tenant_id=$1 AND id=$2 AND type='extraction' AND state='running' AND cancel_requested_at IS NULL",[s.tenantId,jobId]);if(!job)fail('EXTRACTION_JOB_UNAVAILABLE');
    const originals=await currentSources(s,conversationId),revisions=[],mapIds=[],inputManifest=[];let bytes=0;
    for(const original of originals){
     const raw=await sourceReader(s,original);bytes+=typeof raw==='string'?Buffer.byteLength(raw):1000001;if(bytes>1000000)fail('EXTRACTION_INPUT_TOO_LARGE');
     const redacted=redactText(raw,config.policy),id=derivedId(original.id,policyHash);
     await s.query(`INSERT INTO public.message_revisions(id,tenant_id,message_id,revision,text_ref,redacted_text,hash,redaction_version,provenance)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,[id,s.tenantId,original.message_id,'redacted:'+original.id+':'+policyHash,'redacted:'+id,redacted.text,redacted.hash,redacted.redactionVersion,JSON.stringify({original_revision_id:original.id,policy_hash:policyHash,offsets:'unicode_code_points'})]);
     const stored=await one(s,'SELECT hash,redacted_text FROM public.message_revisions WHERE tenant_id=$1 AND id=$2',[s.tenantId,id]);if(stored?.hash!==redacted.hash||stored.redacted_text!==redacted.text)fail('EXTRACTION_REDACTION_CONFLICT');
     await s.query(`INSERT INTO public.redaction_maps(tenant_id,original_revision_id,redacted_revision_id,policy_hash,private_map) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,original_revision_id,policy_hash) DO NOTHING`,[s.tenantId,original.id,id,policyHash,JSON.stringify(redacted.privateMap)]);
     const map=await one(s,'SELECT id FROM public.redaction_maps WHERE tenant_id=$1 AND original_revision_id=$2 AND policy_hash=$3',[s.tenantId,original.id,policyHash]);mapIds.push(map.id);
     revisions.push({tenant_id:s.tenantId,message_revision_id:id,role:original.role,text:redacted.text});
     inputManifest.push({message_revision_id:id,original_revision_id:original.id,hash:redacted.hash,role:original.role});
    }
    // Recheck authority after source IO; no original text is passed to the gateway.
    const latest=await currentSources(s,conversationId);if(JSON.stringify(latest.map(r=>r.id))!==JSON.stringify(originals.map(r=>r.id)))fail('EXTRACTION_SOURCE_CHANGED');
    const runId=randomUUID(),inputHash=sha256(JSON.stringify({revisions,policyHash,taxonomy:config.taxonomy}));
    await s.query(`INSERT INTO public.extraction_runs(id,tenant_id,model_id,prompt_hash,schema_hash,input_hash,status,conversation_id,job_id,provenance)
     VALUES($1,$2,'unattempted',$3,$4,$5,'running',$6,$7,$8)`,[runId,s.tenantId,extractionPromptHash,sha256(JSON.stringify(schema)),inputHash,conversationId,jobId,JSON.stringify({request_hash:requestHash,policy_hash:policyHash,taxonomy:config.taxonomy,input_manifest:inputManifest,offsets:'unicode_code_points'})]);
    await s.query('INSERT INTO public.extraction_claims(tenant_id,run_id,job_id,task_key,actor_id,owner_token) VALUES($1,$2,$3,$4,$5,$6)',[s.tenantId,runId,jobId,taskKey,s.userId,ownerToken]);
    for(const id of mapIds)await s.query('INSERT INTO public.extraction_inputs(tenant_id,run_id,redaction_id) VALUES($1,$2,$3)',[s.tenantId,runId,id]);
    return {acquired:true,runId,input:{tenantId:s.tenantId,role:'extraction',taskKey,taxonomy:config.taxonomy,revisions}};
   });
  },
  async complete({runId,result}){
   if(!uuid(runId))fail('EXTRACTION_RUN_INVALID');const value=structuredClone(result);
   return database.transaction('import',async s=>{
    const run=await one(s,`SELECT r.*,c.owner_token,c.actor_id FROM public.extraction_runs r JOIN public.extraction_claims c ON c.tenant_id=r.tenant_id AND c.run_id=r.id WHERE r.tenant_id=$1 AND r.id=$2 FOR UPDATE OF r`,[s.tenantId,runId]);
    if(!run||run.status!=='running'||run.owner_token!==ownerToken||run.actor_id!==s.userId)fail('EXTRACTION_STALE_OWNER');
    const current=await currentSources(s,run.conversation_id),allowed=new Map(current.map(r=>[r.id,r]));
    const saved=(await s.query(`SELECT m.original_revision_id,r.id,r.redacted_text,r.hash FROM public.extraction_inputs i
     JOIN public.redaction_maps m ON m.tenant_id=i.tenant_id AND m.id=i.redaction_id
     JOIN public.message_revisions r ON r.tenant_id=m.tenant_id AND r.id=m.redacted_revision_id WHERE i.tenant_id=$1 AND i.run_id=$2 ORDER BY m.original_revision_id`,[s.tenantId,runId])).rows;
    const unchanged=saved.length===current.length&&saved.every(r=>allowed.has(r.original_revision_id)&&sha256(r.redacted_text)===r.hash);
    const revisions=saved.map(r=>({tenant_id:s.tenantId,message_revision_id:r.id,role:allowed.get(r.original_revision_id)?.role,text:r.redacted_text}));
    const valid=value?.ok===true&&unchanged&&validateExtraction(value.data,revisions,{taxonomy:run.provenance.taxonomy,tenantId:s.tenantId}).ok;
    const meta=value?.meta;const metadataValid=meta?.promptHash===run.prompt_hash&&meta?.schemaHash===run.schema_hash&&typeof meta?.model==='string'&&meta.model.length<=200;
    let status=valid&&metadataValid?(value.data.abstention?'abstained':'succeeded'):'failed';
    if(value?.ok===false&&['policy_blocked','runtime_disabled','missing_key'].includes(value.error?.code))status='policy_blocked';
    const allowedReasons=['invalid_output','policy_blocked','runtime_disabled','missing_key','budget_exceeded','budget_unavailable','timeout','transport_error','provider_error','cost_overrun','retry_deferred','duplicate_task','idempotency_conflict','input_too_large','invalid_input'];
    const reason=!unchanged?'source_changed':valid&&metadataValid?(value.data.abstention?.reason??null):value?.ok===true?'invalid_output':allowedReasons.includes(value?.error?.code)?value.error.code:'extraction_failed';
    const provenance={...run.provenance,reason,quarantined:status==='failed',billing_state:['uncertain','settled'].includes(value?.billingState)?value.billingState:'unknown'};
    if(valid&&metadataValid)provenance.result=value.data;
    const usage=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].filter(k=>Number.isSafeInteger(meta?.usage?.[k])&&meta.usage[k]>=0).map(k=>[k,meta.usage[k]]));
    await s.query("SELECT set_config('vexa.extraction_owner_token',$1,true)",[ownerToken]);
    await s.query('UPDATE public.extraction_runs SET status=$3,model_id=$4,usage=$5,provenance=$6,updated_at=now() WHERE tenant_id=$1 AND id=$2',[s.tenantId,runId,status,metadataValid?meta.model:'unattempted',JSON.stringify(usage),JSON.stringify(provenance)]);
    if(valid&&metadataValid)for(const issue of value.data.issues){const issueId=randomUUID();await s.query('INSERT INTO public.issues(id,tenant_id,category,severity,sentiment,intent,urgency,extraction_run_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[issueId,s.tenantId,issue.category,issue.severity,value.data.sentiment,value.data.intent,value.data.urgency,runId]);for(const span of issue.evidence)await s.query('INSERT INTO public.evidence_spans(tenant_id,"start","end",quote_hash,message_revision_id,issue_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7)',[s.tenantId,span.start,span.end,span.quote_hash,span.message_revision_id,issueId,JSON.stringify({role:span.role,offsets:'unicode_code_points'})]);}
    return {runId,status,reason};
   });
  }
 });
}
