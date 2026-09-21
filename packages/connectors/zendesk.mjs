import {createEnvelope,validateContext,contentHash,IngestionError} from '../ingestion/index.mjs';
import {createZendeskTransport,ConnectorError} from './transport.mjs';
const fail=code=>{throw new ConnectorError(code);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>{if(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)return String(v);if(typeof v!=='string'||!v||v.length>1024||!/^[A-Za-z0-9_-]+$/.test(v))fail('INVALID_REMOTE_ID');return v;};
const cursor=v=>{if(typeof v!=='string'||!v||v.length>4096||/[\u0000-\u001f]/u.test(v))fail('PROVIDER_SCHEMA');return v;};
const base='/api/v2/incremental/tickets/cursor.json';
export function createZendeskAdapter(config){
 const context=Object.freeze(validateContext(config?.context));if(context.source!=='zendesk')fail('INVALID_CONFIG');
 const transport=createZendeskTransport(config),origin=`https://${config.subdomain}.zendesk.com`,clock=config.clock??(()=>new Date());
 const startTime=config.startTime,maxPages=config.maxPages??100,maxRecords=config.maxRecords??100000;
 if(!Number.isSafeInteger(startTime)||startTime<0||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>10000||!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>1000000)fail('INVALID_CONFIG');
 const scope=contentHash({context,origin,startTime,version:'vexa-zendesk-v2'});
 const url=(path,params={})=>{const u=new URL(path,origin);for(const[k,v]of Object.entries(params))if(v!==null)u.searchParams.set(k,String(v));return u;};
 function nextURL(link,current,key,value){
  if(link==null)return;
  if(typeof link!=='string'||/[\\\u0000-\u0020]/u.test(link))fail('UNSAFE_NEXT');
  let next;try{next=new URL(link,current);}catch{fail('UNSAFE_NEXT');}
  // Zendesk documents equivalent .json and extensionless routes. No other path changes.
  if(next.origin!==origin||next.pathname.replace(/\.json$/,'')!==current.pathname.replace(/\.json$/,'')||next.username||next.password||next.hash)fail('UNSAFE_NEXT');
  const allowed=key==='cursor'?['cursor','per_page']:['page[after]','page[size]'];
  for(const k of next.searchParams.keys())if(!allowed.includes(k)||next.searchParams.getAll(k).length!==1)fail('UNSAFE_NEXT');
  if(next.searchParams.get(key)!==value)fail('UNSAFE_NEXT');
  for(const k of allowed)if(k!==key&&next.searchParams.has(k)&&next.searchParams.get(k)!==current.searchParams.get(k))fail('UNSAFE_NEXT');
 }
 async function* comments(ticketId){let after=null;const seen=new Set();for(let n=0;n<maxPages;n++){
  const target=url(`/api/v2/tickets/${ticketId}/comments.json`,{'page[size]':100,'page[after]':after}),body=await transport.request(target);
  if(!object(body)||!Array.isArray(body.comments)||!object(body.meta)||typeof body.meta.has_more!=='boolean')fail('PROVIDER_SCHEMA');
  if(body.links!==undefined&&!object(body.links))fail('PROVIDER_SCHEMA');
  const next=body.meta.has_more?cursor(body.meta.after_cursor):null;
  // Even a terminal supplied link must be safe; never silently ignore an external URL.
  if(body.links?.next!=null)nextURL(body.links.next,target,'page[after]',cursor(body.meta.after_cursor));
  if(next!==null&&seen.has(next))fail('CURSOR_LOOP');
  yield body.comments;if(next===null)return;seen.add(next);after=next;
 }fail('PAGE_LIMIT');}
 function record(payload,entity,observed_at,extra={},sourcePayload=payload){
  if(!object(payload))fail('INVALID_RECORD');const external=id(payload.id),deleted=entity==='ticket'&&payload.status==='deleted';
  return {envelope:createEnvelope(context,{entity_type:entity,external_id:external,occurred_at:payload.created_at,observed_at,deleted_at:deleted?payload.deleted_at??null:null,payload_ref:`source:${contentHash([scope,entity,external,contentHash(sourcePayload)])}`},sourcePayload),payload:sourcePayload,provider_updated_at:payload.updated_at??null,customer_id:null,sku:null,order_id:null,deleted,tombstone:deleted,text:null,role:'unknown',visibility:'unknown',body_complete:false,conversation_id:null,associations:[],...extra};
 }
 return Object.freeze({async *pages({checkpoint=null}={}){
  if(checkpoint!==null&&(!object(checkpoint)||checkpoint.version!==1||checkpoint.scope!==scope))fail('CHECKPOINT_SCOPE');
  let after=checkpoint===null?null:cursor(checkpoint.cursor),count=0;
  if(after===null&&startTime>=Math.floor(clock().getTime()/1000)-60)fail('INVALID_START_TIME');
  const seen=new Set(after===null?[]:[after]),roles=new Map();
  async function author(comment){
   if(comment.public===false)return {role:'internal',evidence:null};
   if(comment.author_id==null)return {role:'unknown',evidence:null};
   const authorId=id(comment.author_id);
   if(!roles.has(authorId)){
    const data=await transport.request(url(`/api/v2/users/${authorId}.json`));
    if(!object(data)||!object(data.user)||id(data.user.id)!==authorId)fail('PROVIDER_SCHEMA');
    const providerRole=typeof data.user.role==='string'?data.user.role:null;
    roles.set(authorId,{role:providerRole==='end-user'?'customer':['agent','admin'].includes(providerRole)?'agent':'unknown',evidence:{user_id:authorId,provider_role:providerRole}});
   }return roles.get(authorId);
  }
  for(let n=0;n<maxPages;n++){
   const target=url(base,{per_page:100,...(after===null?{start_time:startTime}:{cursor:after})}),body=await transport.request(target);
   if(!object(body)||!Array.isArray(body.tickets)||typeof body.end_of_stream!=='boolean')fail('PROVIDER_SCHEMA');
   const next=cursor(body.after_cursor);nextURL(body.after_url,target,'cursor',next);
   if(!body.end_of_stream&&seen.has(next))fail('CURSOR_LOOP');
   const records=[],errors=[],observed_at=clock().toISOString();let missing=0,ticketCount=0,commentCount=0,deletedCount=0;
   const consume=()=>{if(++count>maxRecords)fail('RECORD_LIMIT');};
   const rejected=(payload,index,error)=>{if(!(error instanceof ConnectorError||error instanceof IngestionError))throw error;consume();errors.push({index,code:error.code,field:error.field??null,payload,context,observed_at});};
   for(const[index,ticket]of body.tickets.entries()){
    let t,ticketId;try{ticketId=id(ticket?.id);t=record(ticket,'ticket',observed_at,{conversation_id:ticketId});}catch(error){rejected(ticket,index,error);continue;}
    consume();records.push(t);ticketCount++;if(t.deleted){deletedCount++;continue;}
    for await(const batch of comments(ticketId))for(const[i,comment]of batch.entries()){
     // Validate row before I/O; transport/access failures abort the page, never become quarantine success.
     try{if(!object(comment))fail('INVALID_RECORD');id(comment.id);if(comment.author_id!=null)id(comment.author_id);if(comment.public!==undefined&&typeof comment.public!=='boolean')fail('INVALID_RECORD');}catch(error){rejected(comment,i,error);continue;}
     const identity=await author(comment);let r;
     try{const originalText=typeof comment.plain_body==='string'?comment.plain_body:typeof comment.body==='string'?comment.body:null;
      const text=originalText===null?null:originalText.normalize('NFC');
      const truncated=['plain_body','body','html_body'].some(key=>typeof comment[key]==='string'&&Buffer.byteLength(comment[key],'utf8')>=65536);
      const complete=originalText!==null&&!truncated&&comment.type!=='VoiceComment';
      r=record(comment,'message',observed_at,{conversation_id:ticketId,associations:[{entity_type:'ticket',external_id:ticketId}],role:identity.role,role_evidence:identity.evidence,visibility:comment.public===true?'public':comment.public===false?'internal':'unknown',text,body_complete:complete},{comment,author_role:identity.evidence});
     }catch(error){rejected(comment,i,error);continue;}
     consume();records.push(r);commentCount++;if(!r.body_complete)missing++;
    }
   }
   yield {records,errors,checkpoint:{version:1,scope,cursor:next},done:body.end_of_stream,adapter_version:'vexa-zendesk-v2',coverage:{objects_read:records.length+errors.length,accepted:records.length,rejected:errors.length,tickets_read:ticketCount,comments_read:commentCount,messages_read:commentCount,deleted_tickets:deletedCount,bodies_missing:missing,messages_complete:missing===0&&errors.length===0,live_verified:false}};
   if(body.end_of_stream)return;seen.add(next);after=next;
  }fail('PAGE_LIMIT');
 }});
}
