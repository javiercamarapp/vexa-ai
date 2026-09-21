import {createEnvelope,validateContext,contentHash,IngestionError} from '../ingestion/index.mjs';
import {createTransport,ConnectorError} from './transport.mjs';
const fail=code=>{throw new ConnectorError(code);};
const id=v=>{if(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)return String(v);if(typeof v!=='string'||!v||v.length>1024||!(/^[A-Za-z0-9_-]+$/u.test(v)))fail('INVALID_REMOTE_ID');return v;};
const cursor=v=>{if(typeof v!=='string'||!v||v.length>4096||/[\u0000-\u001f]/u.test(v))fail('PROVIDER_SCHEMA');return v;};
const base='/conversations/v3/conversations/threads';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function createHubSpotAdapter(config){
 if(config?.version!=='v3')fail('CONTRACT_BLOCKED');
 const context=Object.freeze(validateContext(config.context));if(context.source!=='hubspot')fail('INVALID_CONFIG');
 if(!Array.isArray(config.scopes)||!config.scopes.includes('conversations.read'))fail('SCOPE_REQUIRED');
 const includeTickets=config.includeTickets??false,includeNotes=config.includeNotes??false;
 if(typeof includeTickets!=='boolean'||typeof includeNotes!=='boolean')fail('INVALID_CONFIG');
 if((includeTickets||includeNotes)&&!config.scopes.includes('tickets'))fail('SCOPE_REQUIRED');
 if(includeNotes&&!config.scopes.includes('crm.objects.contacts.read'))fail('SCOPE_REQUIRED');
 const archived=config.archived??false;if(typeof archived!=='boolean')fail('INVALID_CONFIG');
 const inbox=config.inboxId==null?null:id(config.inboxId),maxPages=config.maxPages??100,maxRecords=config.maxRecords??100000;
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>10000||!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>1000000)fail('INVALID_CONFIG');
 const threadIds=config.threadIds===undefined?null:config.threadIds;
 if(threadIds!==null&&(!Array.isArray(threadIds)||threadIds.length===0||threadIds.length>1000||threadIds.some(t=>typeof t!=='string')||new Set(threadIds).size!==threadIds.length))fail('INVALID_CONFIG');
 const selected=threadIds===null?null:Object.freeze(threadIds.map(id));
 const clock=config.clock??(()=>new Date()),transport=createTransport(config);
 const scope=contentHash({context,version:'vexa-hubspot-v2',archived,inbox,includeTickets,includeNotes,selected});
 function url(path,params={}){const u=new URL(path,'https://api.hubapi.com');for(const[k,v]of Object.entries(params))if(v!==null)u.searchParams.set(k,String(v));return u;}
 function nextOf(body,current){
  if(!object(body)||!Array.isArray(body.results))fail('PROVIDER_SCHEMA');
  if(body.paging!==undefined&&!object(body.paging))fail('PROVIDER_SCHEMA');
  const n=body.paging?.next;if(n==null)return null;if(!object(n))fail('PROVIDER_SCHEMA');const value=cursor(n.after);
  if(n.link!=null){if(typeof n.link!=='string'||/[\\\u0000-\u0020]/u.test(n.link))fail('UNSAFE_NEXT');let next;try{next=new URL(n.link,current);}catch{fail('UNSAFE_NEXT');}
   if(next.origin!==current.origin||next.pathname!==current.pathname||next.username||next.password||next.hash)fail('UNSAFE_NEXT');
   for(const k of next.searchParams.keys())if(next.searchParams.getAll(k).length!==1||!['after',...current.searchParams.keys()].includes(k))fail('UNSAFE_NEXT');
   if(next.searchParams.get('after')!==value)fail('UNSAFE_NEXT');
   for(const[k,v]of current.searchParams)if(k!=='after'&&next.searchParams.has(k)&&next.searchParams.get(k)!==v)fail('UNSAFE_NEXT');
  }return value;
 }
 async function* collection(path,params={},initial=null){let after=initial;const seen=new Set(after===null?[]:[after]);for(let n=0;n<maxPages;n++){
  const target=url(path,{...params,after}),body=await transport.request(target),next=nextOf(body,target);
  if(next!==null&&seen.has(next))fail('CURSOR_LOOP');yield {body,next};if(next===null)return;seen.add(next);after=next;
 }fail('PAGE_LIMIT');}
 async function* threads(params,initial){
  if(selected===null){yield* collection(base,params,initial);return;}
  if(initial!==null&&(!/^(0|[1-9][0-9]*)$/.test(initial)||Number(initial)>=selected.length))fail('CHECKPOINT_SCOPE');
  const start=initial===null?0:Number(initial);
  for(let i=start,n=0;i<selected.length;i++,n++){
   if(n>=maxPages)fail('PAGE_LIMIT');
   const thread=await transport.request(url(`${base}/${selected[i]}`,{archived,association:'TICKET'}));
   if(!object(thread)||thread.id!==selected[i])fail('THREAD_SCOPE_MISMATCH');
   if(inbox!==null&&thread.inboxId!==inbox)fail('THREAD_SCOPE_MISMATCH');
   yield {body:{results:[thread]},next:i+1<selected.length?String(i+1):null};
  }
 }
 function record(payload,entity,observed_at,extra={},sourcePayload=payload){
  if(!object(payload))fail('INVALID_RECORD');const external=id(payload.id);
  return {envelope:createEnvelope(context,{entity_type:entity,external_id:external,occurred_at:payload.createdAt,observed_at,deleted_at:payload.archivedAt??null,payload_ref:`source:${contentHash([scope,entity,external,contentHash(sourcePayload)])}`},sourcePayload),payload:sourcePayload,provider_updated_at:payload.updatedAt??null,customer_id:null,sku:null,order_id:null,deleted:payload.archived===true,text:null,role:'unknown',visibility:'unknown',body_complete:false,conversation_id:null,associations:[],...extra};
 }
 function role(m){if(m.type==='COMMENT')return'internal';if(m.type!=='MESSAGE'||!Array.isArray(m.senders)||m.senders.length===0)return'unknown';const roles=m.senders.map(s=>/^A-.+/u.test(s?.actorId??'')?'agent':/^V-.+/u.test(s?.actorId??'')?'customer':'unknown');return roles.every(r=>r===roles[0])?roles[0]:'unknown';}
 return Object.freeze({async *pages({checkpoint=null}={}){
  if(checkpoint!==null&&(!object(checkpoint)||checkpoint.version!==1||checkpoint.scope!==scope))fail('CHECKPOINT_SCOPE');
  const params={limit:100,archived,association:'TICKET',inboxId:inbox};let count=0;
  for await(const{body,next}of threads(params,checkpoint===null?null:cursor(checkpoint.cursor))){
   const observed_at=clock().toISOString(),records=[],errors=[];let missing=0,notesMissing=0,threadCount=0,messageCount=0;
   function push(r){if(++count>maxRecords)fail('RECORD_LIMIT');records.push(r);}
   function rejected(payload,index,error){if(!(error instanceof ConnectorError||error instanceof IngestionError))throw error;if(++count>maxRecords)fail('RECORD_LIMIT');errors.push({index,code:error.code,field:error.field??null,payload,context,observed_at});}
   for(const[index,thread]of body.results.entries()){
    let t,threadId,associations;
    try{threadId=id(thread?.id);const ticket=thread.threadAssociations?.associatedTicketId;associations=ticket==null?[]:[{entity_type:'ticket',external_id:id(ticket)}];t=record(thread,'thread',observed_at,{conversation_id:threadId,associations});}catch(e){rejected(thread,index,e);continue;}
    push(t);threadCount++;
    for await(const{body:messages}of collection(`${base}/${threadId}/messages`,{limit:100,archived})){
     for(const[i,message]of messages.results.entries()){
      let result,original=null;
      // A failed original-content fetch aborts the entire page; it is not a malformed-row quarantine.
      if(object(message)&&['TRUNCATED','TRUNCATED_TO_MOST_RECENT_REPLY'].includes(message.truncationStatus)){
       const messageId=id(message.id);if(id(message.conversationsThreadId)!==threadId)fail('THREAD_MISMATCH');
       original=await transport.request(url(`${base}/${threadId}/messages/${messageId}/original-content`));
       if(!object(original)||typeof original.text!=='string')fail('PROVIDER_SCHEMA');
      }
      try{if(!object(message)||id(message.conversationsThreadId)!==threadId)fail('THREAD_MISMATCH');const r=role(message),text=typeof (original?.text??message.text)==='string'?(original?.text??message.text).normalize('NFC'):null;
       const complete=text!==null&&(original!==null||message.truncationStatus==='NOT_TRUNCATED');
       result=record(message,'message',observed_at,{conversation_id:threadId,associations,role:r,visibility:r==='internal'?'internal':r!=='unknown'&&message.type==='MESSAGE'?'public':'unknown',text,body_complete:complete},original===null?message:{message,original_content:original});
      }catch(e){rejected(message,i,e);continue;}
      push(result);messageCount++;if(!result.body_complete)missing++;
     }
    }
    for(const association of associations){
     const ticketId=association.external_id;
     if(includeTickets){const ticket=await transport.request(url(`/crm/v3/objects/tickets/${ticketId}`,{properties:'subject,content,hs_pipeline_stage',archived}));if(id(ticket.id)!==ticketId)fail('PROVIDER_SCHEMA');push(record(ticket,'ticket',observed_at,{associations:[{entity_type:'thread',external_id:threadId}]}));}
     if(includeNotes){for await(const{body:links}of collection(`/crm/v4/objects/tickets/${ticketId}/associations/notes`,{limit:100})){
      for(const link of links.results){const noteId=id(link?.toObjectId),note=await transport.request(url(`/crm/v3/objects/notes/${noteId}`,{properties:'hs_note_body,hs_timestamp,hubspot_owner_id',archived}));if(id(note.id)!==noteId)fail('PROVIDER_SCHEMA');
       // Notes are HTML stored inertly; never call it sanitized or execute it. No assumption of one thread per ticket.
       const noteText=typeof note.properties?.hs_note_body==='string'?note.properties.hs_note_body.normalize('NFC'):null;
       push(record(note,'note',observed_at,{role:'internal',visibility:'internal',text:noteText,text_format:'inert_html',body_complete:noteText!==null,associations:[association]}));if(noteText===null)notesMissing++;
      }
     }}
    }
   }
   yield {records,errors,checkpoint:next===null?null:{version:1,scope,cursor:next},done:next===null,adapter_version:'vexa-hubspot-v2',coverage:{objects_read:records.length+errors.length,accepted:records.length,rejected:errors.length,threads_read:threadCount,messages_read:messageCount,bodies_missing:missing,messages_complete:missing===0&&errors.length===0,notes_bodies_missing:notesMissing,notes_complete:includeNotes&&notesMissing===0,tickets_complete:includeTickets,archived,live_verified:false}};
  }
 }});
}
