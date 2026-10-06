import {createEnvelope,validateContext,contentHash,IngestionError} from '../ingestion/index.mjs';
import {createTransport,ConnectorError} from './transport.mjs';
const fail=code=>{throw new ConnectorError(code);};
const id=v=>{if(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)return String(v);if(typeof v!=='string'||!v||v.length>1024||!(/^[A-Za-z0-9_-]+$/u.test(v)))fail('INVALID_REMOTE_ID');return v;};
const cursor=v=>{if(typeof v!=='string'||!v||v.length>4096||/[\u0000-\u001f]/u.test(v))fail('PROVIDER_SCHEMA');return v;};
const base='/conversations/v3/conversations/threads';
// Conversation collections sometimes percent-encode base64 padding in paging.next.after.
// Decode only that observed single layer; all other opaque cursor characters stay opaque.
const conversationCollection=path=>path===base||/^\/conversations\/v3\/conversations\/threads\/[A-Za-z0-9_-]+\/messages$/.test(path);
const conversationCursor=value=>/^[A-Za-z0-9+/_-]+(?:%3d){1,2}$/i.test(value)?value.replace(/%3d/gi,'='):value;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Observed administrative types. Unknown provider types remain quarantined.
const threadEventTypes=new Set(['ASSIGNMENT','THREAD_STATUS_CHANGE','THREAD_INBOX_CHANGE']);
export function createHubSpotAdapter(config){
 if(config?.version!=='v3')fail('CONTRACT_BLOCKED');
 const context=Object.freeze(validateContext(config.context));if(context.source!=='hubspot')fail('INVALID_CONFIG');
 if(!Array.isArray(config.scopes)||!config.scopes.includes('conversations.read'))fail('SCOPE_REQUIRED');
 const includeTickets=config.includeTickets??false,includeNotes=config.includeNotes??false;
 if(typeof includeTickets!=='boolean'||typeof includeNotes!=='boolean')fail('INVALID_CONFIG');
 if((includeTickets||includeNotes)&&!config.scopes.some(scope=>scope==='tickets'||scope==='crm.objects.tickets.read'))fail('SCOPE_REQUIRED');
 if(includeNotes&&!config.scopes.includes('crm.objects.contacts.read'))fail('SCOPE_REQUIRED');
 const archived=config.archived??false,bounded=config.bounded??false;if(typeof archived!=='boolean'||typeof bounded!=='boolean')fail('INVALID_CONFIG');
 const inbox=config.inboxId==null?null:id(config.inboxId),maxPages=config.maxPages??100,maxRecords=config.maxRecords??100000;
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>10000||!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>1000000)fail('INVALID_CONFIG');
 const threadIds=config.threadIds===undefined?null:config.threadIds;
 if(threadIds!==null&&(!Array.isArray(threadIds)||threadIds.length===0||threadIds.length>1000||threadIds.some(t=>typeof t!=='string')||new Set(threadIds).size!==threadIds.length))fail('INVALID_CONFIG');
 const selected=threadIds===null?null:Object.freeze(threadIds.map(id));
 const clock=config.clock??(()=>new Date()),transport=createTransport(bounded?{...config,maxRetries:0}:config);
 const scope=contentHash({context,version:'vexa-hubspot-v3',archived,inbox,includeTickets,includeNotes,selected});
 function url(path,params={}){const u=new URL(path,'https://api.hubapi.com');for(const[k,v]of Object.entries(params))if(v!==null)u.searchParams.set(k,k==='after'&&conversationCollection(path)?conversationCursor(String(v)):String(v));return u;}
 function nextOf(body,current){
  if(!object(body)||!Array.isArray(body.results))fail('PROVIDER_SCHEMA');
  if(body.paging!==undefined&&!object(body.paging))fail('PROVIDER_SCHEMA');
  const n=body.paging?.next;if(n==null)return null;if(!object(n))fail('PROVIDER_SCHEMA');const value=cursor(n.after);
  if(n.link!=null){if(typeof n.link!=='string'||/[\\\u0000-\u0020]/u.test(n.link))fail('UNSAFE_NEXT');let next;try{next=new URL(n.link,current);}catch{fail('UNSAFE_NEXT');}
   // Only observed conversation collections (same thread for messages) and note aliases.
   // Requests still use the original allowlisted route, never the provider's link.
   const noteAssociation=/^\/crm\/v4\/objects\/tickets\/[A-Za-z0-9_-]+\/associations\/notes$/.test(current.pathname);
   const samePath=next.pathname===current.pathname||(conversationCollection(current.pathname)&&next.pathname===current.pathname.replace('/conversations/v3/conversations/','/conversations/conversations/v3/'))||(noteAssociation&&next.pathname===current.pathname.replace('/crm/v4/objects/','/crm/objects/v4/'));
   if(next.origin!==current.origin||!samePath||next.username||next.password||next.hash)fail('UNSAFE_NEXT');
   for(const k of next.searchParams.keys())if(next.searchParams.getAll(k).length!==1||!['after',...current.searchParams.keys()].includes(k))fail('UNSAFE_NEXT');
   if(next.searchParams.get('after')!==(conversationCollection(current.pathname)?conversationCursor(value):value))fail('UNSAFE_NEXT');
   for(const[k,v]of current.searchParams)if(k!=='after'&&next.searchParams.has(k)&&next.searchParams.get(k)!==v)fail('UNSAFE_NEXT');
  }return value;
 }
 async function* collection(path,params={},initial=null){let after=initial;const cursorKey=value=>conversationCollection(path)?conversationCursor(value):value;const seen=new Set(after===null?[]:[cursorKey(after)]);for(let n=0;n<maxPages;n++){
  const target=url(path,{...params,after}),body=await transport.request(target),next=nextOf(body,target);
  // Keep raw checkpoint cursors/version/scope compatible; compare their wire meaning for loops.
  if(next!==null&&seen.has(cursorKey(next)))fail('CURSOR_LOOP');yield {body,next};if(next===null)return;seen.add(cursorKey(next));after=next;
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
 async function messageRecord(message,threadId,associations,observed_at){
  try{
   if(!object(message)||id(message.conversationsThreadId)!==threadId)fail('THREAD_MISMATCH');
   if(threadEventTypes.has(message.type))return {event:true,record:record(message,'thread_event',observed_at,{conversation_id:threadId,associations})};
   if(!['MESSAGE','COMMENT'].includes(message.type))fail('UNSUPPORTED_MESSAGE_TYPE');
   id(message.id);
  }catch(error){return {error};}
  let original=null;
  if(['TRUNCATED','TRUNCATED_TO_MOST_RECENT_REPLY'].includes(message.truncationStatus)){
   // Transport failure is not row quarantine and cannot advance a checkpoint.
   original=await transport.request(url(`${base}/${threadId}/messages/${id(message.id)}/original-content`));
   if(!object(original)||(typeof original.text!=='string'&&typeof original.richText!=='string'))fail('PROVIDER_SCHEMA');
  }
  try{
   const r=role(message),body=original===null?message.text:original.text;
   const text=typeof body==='string'?body.normalize('NFC'):null;
   const complete=text!==null&&(original!==null||message.truncationStatus==='NOT_TRUNCATED');
   // richText-only originals remain intact in payload and BODY_INCOMPLETE in the consumer.
   // Never fall back to truncated text or present HTML as clean text.
   return {event:false,record:record(message,'message',observed_at,{conversation_id:threadId,associations,role:r,visibility:r==='internal'?'internal':r!=='unknown'&&message.type==='MESSAGE'?'public':'unknown',text,body_complete:complete},original===null?message:{message,original_content:original})};
  }catch(error){return {error};}
 }
 // v2 keeps only provider cursors, IDs, counters and cursor hashes; never bodies or credentials.
 // A chunk is at most one provider row and two GETs (message + optional original content).
 function initialState(after=null){return {phase:'threads',legacyPrefix:false,after,threadId:null,ticketId:null,innerAfter:null,noteId:null,seen:{threads:[],messages:[],notes:[]},steps:{threads:0,messages:0,notes:0},totals:{records:0,rejected:0,missing:0,notesMissing:0}};}
 const checkpointBytes=2*1024*1024;
 const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
 const nullableCursor=value=>value===null||typeof value==='string'&&value.length>0&&value.length<=4096&&!/[\u0000-\u001f]/u.test(value);
 const safeId=value=>value===null||typeof value==='string'&&value.length>0&&value.length<=1024&&/^[A-Za-z0-9_-]+$/.test(value);
 const integer=value=>Number.isSafeInteger(value)&&value>=0;
 function readState(checkpoint){
  if(checkpoint===null)return initialState();
  if(!object(checkpoint)||checkpoint.scope!==scope)fail('CHECKPOINT_SCOPE');
  if(checkpoint.version===1){const after=cursor(checkpoint.cursor);if(selected!==null&&(!/^(0|[1-9][0-9]*)$/.test(after)||Number(after)>=selected.length))fail('CHECKPOINT_SCOPE');const state=initialState(after);state.legacyPrefix=true;state.seen.threads=[contentHash(conversationCursor(after))];return state;}
  if(!exact(checkpoint,['version','scope','state'])||checkpoint.version!==2||Buffer.byteLength(JSON.stringify(checkpoint))>checkpointBytes)fail('CHECKPOINT_SCOPE');
  const s=structuredClone(checkpoint.state);
  if(!exact(s,['phase','legacyPrefix','after','threadId','ticketId','innerAfter','noteId','seen','steps','totals'])||typeof s.legacyPrefix!=='boolean'||!['threads','messages','ticket','links','note'].includes(s.phase)||!nullableCursor(s.after)||!nullableCursor(s.innerAfter)||![s.threadId,s.ticketId,s.noteId].every(safeId)||!exact(s.seen,['threads','messages','notes'])||!exact(s.steps,['threads','messages','notes'])||!exact(s.totals,['records','rejected','missing','notesMissing']))fail('CHECKPOINT_SCOPE');
  for(const family of ['threads','messages','notes'])if(!Array.isArray(s.seen[family])||new Set(s.seen[family]).size!==s.seen[family].length||s.seen[family].some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h))||!integer(s.steps[family]))fail('CHECKPOINT_SCOPE');
  if(Object.values(s.totals).some(n=>!integer(n))||s.totals.rejected>s.totals.records||s.totals.missing>s.totals.records||s.totals.notesMissing>s.totals.records)fail('CHECKPOINT_SCOPE');
  if(s.phase==='threads'?(s.threadId!==null||s.ticketId!==null||s.innerAfter!==null||s.noteId!==null):s.threadId===null)fail('CHECKPOINT_SCOPE');
  if(s.phase!=='note'&&s.noteId!==null||s.phase==='note'&&s.noteId===null||['links','note'].includes(s.phase)&&(!includeNotes||s.ticketId===null)||s.phase==='ticket'&&(!includeTickets||s.ticketId===null||s.innerAfter!==null))fail('CHECKPOINT_SCOPE');
  if(s.phase==='threads'&&(s.steps.messages!==0||s.steps.notes!==0||s.seen.messages.length||s.seen.notes.length)||s.phase==='messages'&&(s.steps.notes!==0||s.seen.notes.length)||s.phase==='ticket'&&(s.steps.notes!==0||s.seen.notes.length))fail('CHECKPOINT_SCOPE');
  if(selected===null&&s.after!==null&&!s.seen.threads.includes(contentHash(conversationCursor(s.after))))fail('CHECKPOINT_SCOPE');
  if(s.innerAfter!==null&&!s.seen[s.phase==='messages'?'messages':'notes'].includes(contentHash(s.phase==='messages'?conversationCursor(s.innerAfter):s.innerAfter)))fail('CHECKPOINT_SCOPE');
  if(selected!==null){if(s.after!==null&&(!/^[1-9][0-9]*$/.test(s.after)||Number(s.after)>=selected.length))fail('CHECKPOINT_SCOPE');if(s.phase!=='threads'&&selected[s.after===null?selected.length-1:Number(s.after)-1]!==s.threadId)fail('CHECKPOINT_SCOPE');}
  return s;
 }
 async function* boundedPages(checkpoint){
  const state=readState(checkpoint);let done=false,recordCount=0;
  const finishThread=()=>{state.phase='threads';state.threadId=null;state.ticketId=null;state.innerAfter=null;state.noteId=null;state.seen.messages=[];state.seen.notes=[];state.steps.messages=0;state.steps.notes=0;done=state.after===null;};
  const afterMessages=()=>{state.innerAfter=null;if(state.ticketId!==null&&includeTickets)state.phase='ticket';else if(state.ticketId!==null&&includeNotes)state.phase='links';else finishThread();};
  async function page(path,params,after,family){
   const target=url(path,{...params,limit:1,after}),body=await transport.request(target),next=nextOf(body,target);
   // A provider ignoring the requested bound cannot create an oversized durable chunk.
   if(body.results.length>1)fail('PROVIDER_PAGE_LIMIT');
   const key=next===null?null:contentHash(family!=='notes'?conversationCursor(next):next);
   if(key!==null&&(state.seen[family].includes(key)||after!==null&&key===contentHash(family!=='notes'?conversationCursor(after):after)))fail('CURSOR_LOOP');
   if(!Number.isSafeInteger(state.steps[family]+1))fail('CHECKPOINT_LIMIT');state.steps[family]++;if(key!==null)state.seen[family].push(key);
   return {body,next};
  }
  for(let chunk=0;chunk<maxPages;chunk++){
   const observed_at=clock().toISOString(),records=[],errors=[];let threadCount=0,messageCount=0,eventCount=0,missing=0,notesMissing=0;
   function push(value){if(++recordCount>maxRecords)fail('RECORD_LIMIT');if(!Number.isSafeInteger(state.totals.records+1))fail('CHECKPOINT_LIMIT');state.totals.records++;records.push(value);}
   function rejected(payload,index,error){if(!(error instanceof ConnectorError||error instanceof IngestionError))throw error;if(++recordCount>maxRecords)fail('RECORD_LIMIT');if(!Number.isSafeInteger(state.totals.records+1))fail('CHECKPOINT_LIMIT');state.totals.records++;state.totals.rejected++;errors.push({index,code:error.code,field:error.field??null,payload,context,observed_at});}
   const associations=()=>state.ticketId===null?[]:[{entity_type:'ticket',external_id:state.ticketId}];
   if(state.phase==='threads'){
    let thread,next;
    if(selected===null){const result=await page(base,{archived,association:'TICKET',inboxId:inbox},state.after,'threads');thread=result.body.results[0];next=result.next;}
    else{if(!Number.isSafeInteger(state.steps.threads+1))fail('CHECKPOINT_LIMIT');const index=state.after===null?0:Number(state.after);thread=await transport.request(url(`${base}/${selected[index]}`,{archived,association:'TICKET'}));if(!object(thread)||thread.id!==selected[index])fail('THREAD_SCOPE_MISMATCH');next=index+1<selected.length?String(index+1):null;state.steps.threads++;}
    state.after=next;
    if(thread!==undefined){
     if(inbox!==null&&thread.inboxId!==inbox)fail('THREAD_SCOPE_MISMATCH');
     let row;
     try{state.threadId=id(thread?.id);state.ticketId=thread.threadAssociations?.associatedTicketId==null?null:id(thread.threadAssociations.associatedTicketId);row=record(thread,'thread',observed_at,{conversation_id:state.threadId,associations:associations()});}catch(error){rejected(thread,0,error);finishThread();}
     if(row){push(row);threadCount++;state.phase='messages';state.innerAfter=null;}
    }else if(next===null)done=true;
   }else if(state.phase==='messages'){
    const {body,next}=await page(`${base}/${state.threadId}/messages`,{archived},state.innerAfter,'messages');
    const message=body.results[0];
    if(message!==undefined){const result=await messageRecord(message,state.threadId,associations(),observed_at);if(result.error)rejected(message,0,result.error);else{push(result.record);if(result.event)eventCount++;else{messageCount++;if(!result.record.body_complete){missing++;state.totals.missing++;}}}}
    state.innerAfter=next;if(next===null)afterMessages();
   }else if(state.phase==='ticket'){
    const ticket=await transport.request(url(`/crm/v3/objects/tickets/${state.ticketId}`,{properties:'subject,content,hs_pipeline_stage',archived}));if(!object(ticket)||id(ticket.id)!==state.ticketId)fail('PROVIDER_SCHEMA');
    push(record(ticket,'ticket',observed_at,{associations:[{entity_type:'thread',external_id:state.threadId}]}));if(includeNotes)state.phase='links';else finishThread();
   }else if(state.phase==='links'){
    const {body,next}=await page(`/crm/v4/objects/tickets/${state.ticketId}/associations/notes`,{},state.innerAfter,'notes');const link=body.results[0];state.innerAfter=next;
    if(link!==undefined){state.noteId=id(link?.toObjectId);state.phase='note';}else if(next===null)finishThread();
   }else if(state.phase==='note'){
    const note=await transport.request(url(`/crm/v3/objects/notes/${state.noteId}`,{properties:'hs_note_body,hs_timestamp,hubspot_owner_id',archived}));if(!object(note)||id(note.id)!==state.noteId)fail('PROVIDER_SCHEMA');
    const noteText=typeof note.properties?.hs_note_body==='string'?note.properties.hs_note_body.normalize('NFC'):null;
    push(record(note,'note',observed_at,{role:'internal',visibility:'internal',text:noteText,text_format:'inert_html',body_complete:noteText!==null,associations:associations()}));if(noteText===null){notesMissing++;state.totals.notesMissing++;}
    state.noteId=null;if(state.innerAfter!==null)state.phase='links';else finishThread();
   }
   const checkpoint=done?null:{version:2,scope,state:structuredClone(state)};
   if(checkpoint!==null&&Buffer.byteLength(JSON.stringify(checkpoint))>checkpointBytes)fail('CHECKPOINT_LIMIT');
   const result={records,errors,checkpoint,done,adapter_version:'vexa-hubspot-v3',coverage:{objects_read:records.length+errors.length,accepted:records.length,rejected:errors.length,threads_read:threadCount,messages_read:messageCount,events_read:eventCount,bodies_missing:missing,messages_complete:done&&!state.legacyPrefix&&state.totals.missing===0&&state.totals.rejected===0,notes_bodies_missing:notesMissing,notes_complete:done&&!state.legacyPrefix&&includeNotes&&state.totals.notesMissing===0&&state.totals.rejected===0,tickets_complete:done&&!state.legacyPrefix&&includeTickets,archived,live_verified:false}};
   if(Buffer.byteLength(JSON.stringify(result))>8*1024*1024)fail('SYNC_PAGE_LIMIT');
   yield result;if(done)return;
  }
  fail('PAGE_LIMIT');
 }
 return Object.freeze({async *pages({checkpoint=null}={}){
  if(bounded){yield* boundedPages(checkpoint);return;}
  if(checkpoint!==null&&(!object(checkpoint)||checkpoint.version!==1||checkpoint.scope!==scope))fail('CHECKPOINT_SCOPE');
  const params={limit:100,archived,association:'TICKET',inboxId:inbox};let count=0;
  for await(const{body,next}of threads(params,checkpoint===null?null:cursor(checkpoint.cursor))){
   const observed_at=clock().toISOString(),records=[],errors=[];let missing=0,notesMissing=0,threadCount=0,messageCount=0,eventCount=0;
   function push(r){if(++count>maxRecords)fail('RECORD_LIMIT');records.push(r);}
   function rejected(payload,index,error){if(!(error instanceof ConnectorError||error instanceof IngestionError))throw error;if(++count>maxRecords)fail('RECORD_LIMIT');errors.push({index,code:error.code,field:error.field??null,payload,context,observed_at});}
   for(const[index,thread]of body.results.entries()){
    let t,threadId,associations;
    try{threadId=id(thread?.id);const ticket=thread.threadAssociations?.associatedTicketId;associations=ticket==null?[]:[{entity_type:'ticket',external_id:id(ticket)}];t=record(thread,'thread',observed_at,{conversation_id:threadId,associations});}catch(e){rejected(thread,index,e);continue;}
    push(t);threadCount++;
    for await(const{body:messages}of collection(`${base}/${threadId}/messages`,{limit:100,archived})){
     for(const[i,message]of messages.results.entries()){
      const result=await messageRecord(message,threadId,associations,observed_at);
      if(result.error){rejected(message,i,result.error);continue;}
      push(result.record);if(result.event)eventCount++;else{messageCount++;if(!result.record.body_complete)missing++;}
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
   yield {records,errors,checkpoint:next===null?null:{version:1,scope,cursor:next},done:next===null,adapter_version:'vexa-hubspot-v3',coverage:{objects_read:records.length+errors.length,accepted:records.length,rejected:errors.length,threads_read:threadCount,messages_read:messageCount,events_read:eventCount,bodies_missing:missing,messages_complete:missing===0&&errors.length===0,notes_bodies_missing:notesMissing,notes_complete:includeNotes&&notesMissing===0,tickets_complete:includeTickets,archived,live_verified:false}};
  }
 }});
}
