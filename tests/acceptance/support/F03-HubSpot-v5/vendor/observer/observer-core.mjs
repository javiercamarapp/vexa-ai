// PRIVATE PROTOTYPE. No live gate, auth configuration, reference builder or HMAC.
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
export const LIMITS=Object.freeze({responseBytes:8*1024*1024,retainedBytes:64*1024*1024,records:10000,requests:250,requestMs:10000,totalMs:240000});
const own=(x,k)=>Object.hasOwn(x,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export class ObserverError extends Error {constructor(code){super(code);this.name='ObserverError';this.code=code;}}
const error=code=>new ObserverError(code);
const check=(yes,code)=>{if(!yes)throw error(code);};
function id(value){check(typeof value==='string'&&/^[A-Za-z0-9_-]{1,1024}$/.test(value),'OBS_ID');return value;}
const hashText=s=>createHash('sha256').update(s,'utf8').digest('hex');
const key=(thread,message)=>JSON.stringify([thread,message]);
function role(message){if(message.type==='COMMENT')return'internal';const senders=message.senders;if(message.type!=='MESSAGE'||!Array.isArray(senders)||!senders.length)return'unknown';const roles=senders.map(s=>/^A-.+/.test(s?.actorId??'')?'agent':/^V-.+/.test(s?.actorId??'')?'customer':'unknown');return roles.every(x=>x===roles[0])?roles[0]:'unknown';}
const eventTypes=new Set(['ASSIGNMENT','THREAD_STATUS_CHANGE','THREAD_INBOX_CHANGE']);
const cursorValue=x=>{check(typeof x==='string'&&x.length>0&&x.length<=4096&&!/[\u0000-\u001f]/.test(x),'OBS_CURSOR');return x;};
const wireCursor=x=>typeof x==='string'&&/^[A-Za-z0-9+/_-]+(?:%3d){1,2}$/i.test(x)?x.replace(/%3d/gi,'='):x;
function routeOf(input,wanted){let u;try{u=new URL(input);}catch{throw error('OBS_ROUTE');}check(u.origin==='https://api.hubapi.com'&&!u.username&&!u.password&&!u.hash,'OBS_ROUTE');const m=/^\/conversations\/v3\/conversations\/threads\/([A-Za-z0-9_-]+)(?:\/(messages)(?:\/([A-Za-z0-9_-]+)\/(original-content))?)?$/.exec(u.pathname);check(m&&wanted.has(m[1]),'OBS_SCOPE');for(const name of u.searchParams.keys())check(u.searchParams.getAll(name).length===1,'OBS_QUERY_DUPLICATE');return {url:u,thread:m[1],kind:m[4]?'original':m[2]?'messages':'thread',message:m[3]??null,after:u.searchParams.has('after')?wireCursor(cursorValue(u.searchParams.get('after'))):null};}
// The core accepts an explicitly supplied already-captured transport for SYN tests.
// native-observer.mjs binds fetch at module evaluation, before product import.
export function createObserverCore({capturedFetch,threadIds,signal,projectRich=null,limits:overrides={}}){
 check(typeof capturedFetch==='function','OBS_FETCH');check(Array.isArray(threadIds)&&threadIds.length>0&&threadIds.length<=1000,'OBS_THREADS');
 const wanted=new Set(threadIds.map(id));check(wanted.size===threadIds.length,'OBS_THREADS');
 const limits={...LIMITS};for(const[k,v]of Object.entries(overrides)){check(own(limits,k)&&Number.isSafeInteger(v)&&v>0&&v<=LIMITS[k],'OBS_LIMIT_CONFIG');limits[k]=v;}
 check(projectRich===null||typeof projectRich==='function','OBS_PROJECTION');
 const started=performance.now(),deadline=started+limits.totalMs;
 const entries=new Map(),threads=new Map(),scopes=new Set();let retained=0,peak=0,requests=0,successfulPages=0,closed=false,fatal=null,sourceRecords=0,verified=0;
 const counters={nonSuccess:0,transportFailures:0,attemptAborts:0};
 function poison(code){fatal??=error(code);return fatal;}
 function ensure(){if(fatal)throw fatal;check(!closed,'OBS_CLOSED');if(signal?.aborted)throw poison('OBS_ABORTED');if(performance.now()>=deadline)throw poison('OBS_DEADLINE');}
 function reserve(bytes){check(Number.isSafeInteger(bytes)&&bytes>=0,'OBS_ACCOUNTING');if(bytes>limits.retainedBytes-retained)throw poison('OBS_RETAINED_LIMIT');retained+=bytes;peak=Math.max(peak,retained);let live=true;return()=>{if(live){live=false;retained-=bytes;}};}
 const indexReleases=[];const sourceEntries=entries,sourceThreads=threads;
 function retainEntry(bytes){const release=reserve(bytes);indexReleases.push(release);}
 function proofJSON(value){
  // Streaming canonical digest: do not build an unaccounted whole serialized copy.
  const digest=createHash('sha256');let bytes=0;
  function token(s){bytes+=Buffer.byteLength(s,'utf8');check(bytes<=limits.responseBytes,'OBS_JSON_LIMIT');digest.update(s,'utf8');}
  function quoted(s){check(s.length<=limits.responseBytes,'OBS_JSON_LIMIT');const release=reserve(s.length*6+16);try{token(JSON.stringify(s));}finally{release();}}
  function visit(x,depth=0){
   check(depth<=64,'OBS_JSON_DEPTH');
   if(typeof x==='string'){quoted(x);return;}
   if(x===null||typeof x==='boolean'){token(JSON.stringify(x));return;}
   if(typeof x==='number'){check(Number.isFinite(x),'OBS_JSON_NUMBER');token(JSON.stringify(x));return;}
   if(Array.isArray(x)){check(x.length<=limits.responseBytes,'OBS_JSON_LIMIT');token('[');for(let i=0;i<x.length;i++){if(i)token(',');visit(x[i],depth+1);}token(']');return;}
   check(object(x),'OBS_JSON_TYPE');const keys=Object.keys(x);const release=reserve(keys.length*16);try{keys.sort();token('{');for(let i=0;i<keys.length;i++){if(i)token(',');quoted(keys[i]);token(':');visit(x[keys[i]],depth+1);}token('}');}finally{release();}
  }
  visit(value);return digest.digest('hex');
 }
 function proofText(value){if(typeof value!=='string')return null;check(Buffer.byteLength(value,'utf8')<=limits.responseBytes,'OBS_TEXT_LIMIT');const release=reserve(value.length*6+16);try{return hashText(value.normalize('NFC'));}finally{release();}}

 function richProof(rich,identity){
  if(typeof rich!=='string')return null;
  const release=reserve(Buffer.byteLength(rich,'utf8')*2);try{
   ensure();if(projectRich===null)return {sourceRichDigest:hashText(rich),projectionDigest:null};
   const result=projectRich(Object.freeze({...identity,richText:rich}));if(result&&typeof result.then==='function'){void Promise.resolve(result).catch(()=>{});throw error('OBS_ASYNC_PROJECTION');}ensure();return {sourceRichDigest:hashText(rich),projectionDigest:proofJSON(result)};
  }finally{release();}
 }
 function stageIngest(route,body,checkTime){
  // No successful-source state becomes visible until this attempt transfers its
  // bounded body on time. Aborted attempts discard their complete delta.
  const entryChanges=new Map(),threadChanges=new Map(),persistent=[],temporary=[];
  const globalEntries=sourceEntries,globalThreads=sourceThreads;let deltaRecords=0,deltaPages=0,settled=false,applied=false;const baseThread=globalThreads.get(route.thread),originalKey=key(route.thread,route.message),baseOriginal=route.kind==='original'?globalEntries.get(originalKey):null;
  function retainEntry(bytes){persistent.push(reserve(bytes));}
  const entries={
   has:k=>entryChanges.has(k)||globalEntries.has(k),
   get(k){if(entryChanges.has(k))return entryChanges.get(k);const old=globalEntries.get(k);if(!old)return undefined;temporary.push(reserve(1024));const copy={...old};entryChanges.set(k,copy);return copy;},
   set:(k,v)=>entryChanges.set(k,v),
  };
  const threads={
   has:k=>threadChanges.has(k)||globalThreads.has(k),
   get(k){if(threadChanges.has(k))return threadChanges.get(k);const old=globalThreads.get(k);if(!old)return undefined;temporary.push(reserve(512+old.cursors.size*256));const copy={...old,cursors:new Set(old.cursors)};threadChanges.set(k,copy);return copy;},
   set:(k,v)=>threadChanges.set(k,v),
  };
 function addEntry(thread,message,expected){
  const k=key(thread,message);if(entries.has(k))throw poison(entries.get(k).rawDigest===expected.rawDigest?'OBS_DUPLICATE_RECORD':'OBS_CONTRADICTORY_RECORD');
  if(sourceRecords+(++deltaRecords)>limits.records)throw poison('OBS_RECORD_LIMIT');
  retainEntry(1024+4*(thread.length+message.length));entries.set(k,{...expected,thread,message,verified:false});
 }

  function apply(){
  ensure();check(object(body),'OBS_SOURCE_SCHEMA');
  if(route.kind==='thread'){
   check(body.id===route.thread,'OBS_THREAD_ID');if(threads.has(route.thread))throw poison('OBS_DUPLICATE_THREAD');
   const ticket=body.threadAssociations?.associatedTicketId;const associations=ticket==null?[]:[{entity_type:'ticket',external_id:id(typeof ticket==='number'&&Number.isSafeInteger(ticket)?String(ticket):ticket)}];
   retainEntry(1024+4*route.thread.length);threads.set(route.thread,{associations,next:null,started:false,terminal:false,cursors:new Set(),pages:0});
   addEntry(route.thread,route.thread,{entity:'thread',rawDigest:proofJSON(body),associations,role:'unknown',visibility:'unknown',textDigest:null,bodyComplete:false});return;
  }
  const state=threads.get(route.thread);check(state,'OBS_THREAD_NOT_OBSERVED');
  if(route.kind==='original'){
   const e=entries.get(key(route.thread,route.message));check(e&&e.entity==='message'&&e.needsOriginal,'OBS_ORIGINAL_SCOPE');check(!e.originalDigest,'OBS_DUPLICATE_ORIGINAL');
   // original-content normally has no identity; any supplied identity must still agree.
   check((body.id===undefined||body.id===route.message)&&(body.conversationsThreadId===undefined||body.conversationsThreadId===route.thread),'OBS_ORIGINAL_ID');
   check(typeof body.text==='string','OBS_ORIGINAL_TEXT_REQUIRED');e.originalDigest=proofJSON(body);e.textDigest=proofText(body.text);e.rich=richProof(body.richText,{thread:route.thread,id:route.message});e.bodyComplete=true;return;
  }
  check(Array.isArray(body.results),'OBS_SOURCE_SCHEMA');check(!state.terminal,'OBS_PAGE_AFTER_TERMINAL');
  check(route.after===(state.started?state.next:null),'OBS_CURSOR_CHAIN');
  const pageId=route.after===null?'first':route.after;check(!state.cursors.has(pageId),'OBS_CURSOR_LOOP');
  const next=body.paging?.next;check(body.paging===undefined||object(body.paging),'OBS_CURSOR');check(next===undefined||next===null||object(next),'OBS_CURSOR');
  const after=next==null?null:wireCursor(cursorValue(next.after));
  check(after===null||(after!==route.after&&!state.cursors.has(after)),'OBS_CURSOR_LOOP');
  if(next?.link!==undefined){const link=new URL(next.link,route.url);const allowedPath=route.url.pathname;check(link.origin===route.url.origin&&!link.username&&!link.password&&!link.hash&&[allowedPath,allowedPath.replace('/conversations/v3/conversations/','/conversations/conversations/v3/')].includes(link.pathname),'OBS_NEXT_LINK');check(wireCursor(link.searchParams.get('after'))===after,'OBS_NEXT_LINK');}
  if(state.pages>=Math.max(20,wanted.size))throw poison('OBS_PAGE_LIMIT');
  retainEntry(256+4*String(pageId).length);state.cursors.add(pageId);state.started=true;state.next=after;state.terminal=after===null;state.pages++;deltaPages++;
  for(const m of body.results){
   check(object(m)&&m.conversationsThreadId===route.thread,'OBS_MESSAGE_SCOPE');const mid=id(m.id);const event=eventTypes.has(m.type);check(event||['MESSAGE','COMMENT'].includes(m.type),'OBS_MESSAGE_TYPE');
   const r=event?'unknown':role(m),needsOriginal=!event&&['TRUNCATED','TRUNCATED_TO_MOST_RECENT_REPLY'].includes(m.truncationStatus);
   const complete=!event&&!needsOriginal&&m.truncationStatus==='NOT_TRUNCATED'&&typeof m.text==='string';
   addEntry(route.thread,mid,{entity:event?'thread_event':'message',rawDigest:proofJSON(m),associations:state.associations,role:r,visibility:event?'unknown':r==='internal'?'internal':r!=='unknown'?'public':'unknown',needsOriginal,originalDigest:null,textDigest:complete?proofText(m.text):null,bodyComplete:complete,rich:complete?richProof(m.richText,{thread:route.thread,id:mid}):null});
  }
  }
  function discard(){
   if(settled)return;settled=true;
   if(applied){for(const k of entryChanges.keys()){if(route.kind==='original'&&k===originalKey&&baseOriginal)globalEntries.set(k,baseOriginal);else globalEntries.delete(k);}if(baseThread)globalThreads.set(route.thread,baseThread);else globalThreads.delete(route.thread);}
   for(const release of [...persistent,...temporary])release();entryChanges.clear();threadChanges.clear();
  }
  try{checkTime();apply();checkTime();}catch(e){discard();throw e;}
  return {discard,publish(transfer){
   if(settled)throw error('OBS_ATTEMPT_SETTLED');checkTime();
   if(sourceRecords+deltaRecords>limits.records)throw poison('OBS_RECORD_LIMIT');
   if(globalThreads.get(route.thread)!==baseThread)throw poison('OBS_ATTEMPT_CONFLICT');
   try{
    applied=true;
    for(const[k,v]of entryChanges){checkTime();globalEntries.set(k,v);}
    for(const[k,v]of threadChanges){checkTime();globalThreads.set(k,v);}
    checkTime();transfer();checkTime();
    sourceRecords+=deltaRecords;successfulPages+=deltaPages;
    indexReleases.push(...persistent);for(const release of temporary)release();settled=true;entryChanges.clear();threadChanges.clear();
   }catch(e){discard();throw e;}
  }};
 }

 function makeScope(callerSignal){
  const controller=new AbortController();const end=Math.min(deadline,performance.now()+limits.requestMs);let finished=false,timer,reader=null,streamController=null,releaseBody=null;
  const globalAbort=()=>abort('OBS_ABORTED',true),callerAbort=()=>abort('OBS_ABORTED',false);
  const scope={controller,get end(){return end;},get reader(){return reader;},set reader(x){reader=x;},set streamController(x){streamController=x;},set releaseBody(x){releaseBody=x;},finish,abort,checkTime};scopes.add(scope);
  function checkTime(){
   if(controller.signal.aborted)throw controller.signal.reason??error('OBS_ABORTED');
   if(performance.now()>=end){const global=end===deadline;const code=global?'OBS_DEADLINE':'OBS_TIMEOUT';abort(code,global);throw error(code);}
  }
  function finish(){if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',globalAbort);callerSignal?.removeEventListener('abort',callerAbort);releaseBody?.();releaseBody=null;scopes.delete(scope);}
  function abort(code,global=false){if(finished)return;if(global)poison(code);controller.abort(error(code));try{streamController?.error(error(code));}catch{};void reader?.cancel().catch(()=>{});finish();}
  signal?.addEventListener('abort',globalAbort,{once:true});callerSignal?.addEventListener('abort',callerAbort,{once:true});
  timer=setTimeout(()=>abort(end===deadline?'OBS_DEADLINE':'OBS_TIMEOUT',end===deadline),Math.max(0,Math.ceil(end-performance.now())));
  if(signal?.aborted)globalAbort();else if(callerSignal?.aborted)callerAbort();
  return scope;
 }
 function awaitAbort(p,scope,late){return new Promise((resolve,reject)=>{
  let settled=false;const abort=()=>{if(settled)return;settled=true;reject(scope.controller.signal.reason??error('OBS_ABORTED'));};
  scope.controller.signal.addEventListener('abort',abort,{once:true});if(scope.controller.signal.aborted)abort();
  Promise.resolve(p).then(value=>{scope.controller.signal.removeEventListener('abort',abort);if(settled){late?.(value);return;}settled=true;resolve(value);},reason=>{scope.controller.signal.removeEventListener('abort',abort);if(!settled){settled=true;reject(reason);}});
 });}
 function responseView(original,body){
  const target=new Response(body,{status:original.status,statusText:original.statusText,headers:original.headers});
  return new Proxy(target,{get(t,k){if(k==='url'||k==='redirected'||k==='type')return original[k];if(k==='clone')return()=>{throw poison('OBS_CLONE_FORBIDDEN');};const value=Reflect.get(t,k,t);return typeof value==='function'?value.bind(t):value;}});
 }
 function bufferedView(original,bytes,release,scope,stage){
  let buffer=bytes;scope.releaseBody=()=>{buffer=null;stage?.discard();release();};
  const stream=new ReadableStream({start(c){scope.streamController=c;},pull(c){
   try{scope.checkTime();const transfer=()=>{scope.checkTime();const value=buffer;buffer=null;if(value?.byteLength)c.enqueue(value);scope.checkTime();c.close();};if(stage)stage.publish(transfer);else transfer();scope.finish();}
   catch(e){scope.abort(e instanceof ObserverError?e.code:'OBS_STREAM_ERROR');}
  },cancel(){scope.finish();}},{highWaterMark:0});
  return responseView(original,stream);
 }
 function nonSuccessView(original,scope){
  counters.nonSuccess++;
  if(!original.body){scope.finish();return responseView(original,null);}
  const reader=original.body.getReader();scope.reader=reader;let bytes=0;
  const stream=new ReadableStream({start(c){scope.streamController=c;},async pull(c){try{scope.checkTime();const result=await awaitAbort(reader.read(),scope);scope.checkTime();if(result.done){c.close();scope.finish();return;}bytes+=result.value.byteLength;if(bytes>limits.responseBytes)throw poison('OBS_RESPONSE_LIMIT');const release=reserve(result.value.byteLength);try{c.enqueue(result.value);}finally{release();}}catch(e){scope.abort(e instanceof ObserverError?e.code:'OBS_STREAM_ERROR');}},cancel(){void reader.cancel().catch(()=>{});scope.finish();}},{highWaterMark:0});
  return responseView(original,stream);
 }
 async function observedFetch(input,init={}){
  ensure();check(init.method==='GET'&&init.redirect==='manual','OBS_METHOD');const route=routeOf(input,wanted);if(++requests>limits.requests)throw poison('OBS_REQUEST_LIMIT');
  const scope=makeScope(init.signal);let releases=[],total=0,stage=null;
  try{
   scope.checkTime();
   const response=await awaitAbort(capturedFetch(route.url.href,{...init,signal:scope.controller.signal}),scope,r=>{void r.body?.cancel().catch(()=>{});});
   try{scope.checkTime();}catch(e){void response.body?.cancel().catch(()=>{});throw e;}
   // Leave header-driven reconnect/retry/redirect classification to the existing adapter.
   if(!response.ok||response.redirected||(response.status>=300&&response.status<400))return nonSuccessView(response,scope);
   if(response.url){const final=new URL(response.url);if(final.origin!==route.url.origin||final.pathname!==route.url.pathname)return nonSuccessView(response,scope);}
   if(!response.body){poison('OBS_SOURCE_SCHEMA');scope.finish();return responseView(response,null);}
   const reader=response.body.getReader();scope.reader=reader;const chunks=[];
   while(true){scope.checkTime();const {done,value}=await awaitAbort(reader.read(),scope);scope.checkTime();if(done)break;check(value instanceof Uint8Array,'OBS_STREAM_CHUNK');total+=value.byteLength;if(total>limits.responseBytes)throw poison('OBS_RESPONSE_LIMIT');const release=reserve(value.byteLength);releases.push(release);chunks.push(value);}
   const rawRelease=reserve(total);releases.push(rawRelease);const raw=new Uint8Array(total);let offset=0;for(const chunk of chunks){scope.checkTime();raw.set(chunk,offset);offset+=chunk.byteLength;}chunks.length=0;for(const release of releases.slice(0,-1))release();releases=[rawRelease];
   // Account temporary decoded UTF-16/JSON/canonicalization envelopes separately.
   // These are conservative byte charges, NOT a promise of a JavaScript RSS ceiling.
   let parseRelease;
   try{
    parseRelease=reserve(total*6+1024);const decoded=new TextDecoder('utf-8',{fatal:true}).decode(raw);const parsed=JSON.parse(decoded);
    try{stage=stageIngest(route,parsed,scope.checkTime);}catch(e){if(['OBS_TIMEOUT','OBS_ABORTED','OBS_DEADLINE'].includes(e?.code))throw e;throw poison(e instanceof ObserverError?e.code:'OBS_SOURCE_SCHEMA');}
   }catch(e){if(['OBS_TIMEOUT','OBS_ABORTED','OBS_DEADLINE'].includes(e?.code))throw e;if(e instanceof ObserverError)poison(e.code);else poison('OBS_SOURCE_SCHEMA');}
   finally{parseRelease?.();}
   scope.checkTime();
   // Even invalid JSON is delivered byte-exactly; adapter keeps PROVIDER_SCHEMA behavior.
   const view=bufferedView(response,raw,rawRelease,scope,stage);releases=[];return view;
  }catch(e){stage?.discard();for(const release of releases)release();const code=e instanceof ObserverError?e.code:scope.controller.signal.aborted?(scope.controller.signal.reason?.code??'OBS_ABORTED'):'OBS_STREAM_ERROR';if(['OBS_RESPONSE_LIMIT','OBS_RETAINED_LIMIT'].includes(code))poison(code);if(['OBS_ABORTED','OBS_TIMEOUT','OBS_DEADLINE'].includes(code))counters.attemptAborts++;else counters.transportFailures++;scope.abort(code);throw error(code);}
 }
 function verifyRecord(record){
  ensure();try{
   check(object(record)&&object(record.envelope),'OBS_PRODUCT_RECORD');const thread=id(record.conversation_id),mid=id(record.envelope.external_id),e=entries.get(key(thread,mid));check(e,'OBS_UNOBSERVED_RECORD');check(!e.verified,'OBS_DUPLICATE_EMISSION');check(record.envelope.entity_type===e.entity,'OBS_ENTITY_MISMATCH');
   check(record.role===e.role&&record.visibility===e.visibility,'OBS_ROLE_VISIBILITY');check(proofJSON(record.associations)===proofJSON(e.associations),'OBS_ASSOCIATIONS');
   if(e.needsOriginal){check(e.originalDigest,'OBS_ORIGINAL_MISSING');check(object(record.payload)&&Object.keys(record.payload).sort().join(',')==='message,original_content','OBS_PAYLOAD_SHAPE');check(proofJSON(record.payload.message)===e.rawDigest&&proofJSON(record.payload.original_content)===e.originalDigest,'OBS_PAYLOAD_MISMATCH');}
   else check(proofJSON(record.payload)===e.rawDigest,'OBS_PAYLOAD_MISMATCH');
   check(record.body_complete===e.bodyComplete,'OBS_BODY_COMPLETE');check(e.entity!=='message'||e.bodyComplete,'OBS_SOURCE_INCOMPLETE');check(proofText(record.text)===e.textDigest&&(e.textDigest!==null||record.text===null),'OBS_TEXT_MISMATCH');e.verified=true;verified++;
   return Object.freeze({sourceTextExactNfc:true,payloadExact:true,richProjectionDigest:e.rich?.projectionDigest??null});
  }catch(e){throw poison(e instanceof ObserverError?e.code:'OBS_PRODUCT_RECORD');}
 }
 function assertComplete(uiInventory){
  ensure();check(scopes.size===0,'OBS_BODY_UNCONSUMED');check(threads.size===wanted.size,'OBS_THREAD_MISSING');for(const s of threads.values())check(s.started&&s.terminal&&s.next===null,'OBS_CURSOR_PENDING');
  check(Array.isArray(uiInventory),'OBS_UI_INVENTORY');const ui=new Set();for(const m of uiInventory){check(object(m),'OBS_UI_INVENTORY');const k=key(id(m.thread),id(m.id));check(wanted.has(m.thread)&&!ui.has(k),'OBS_UI_DUPLICATE');ui.add(k);}
  const source=new Set([...entries].filter(([,e])=>e.entity==='message').map(([k])=>k));check(source.size===ui.size&&[...source].every(k=>ui.has(k)),'OBS_UI_INVENTORY_MISMATCH');
  check([...entries.values()].every(e=>e.verified),'OBS_EMISSION_MISSING');check([...entries.values()].every(e=>!e.needsOriginal||e.originalDigest),'OBS_ORIGINAL_MISSING');
  return Object.freeze({providerPlainFidelity:true,threads:threads.size,messages:source.size,records:sourceRecords,requests,successfulPages,uiRichReconciled:false});
 }
 function stats(){return Object.freeze({requests,sourceRecords,verified,successfulPages,retainedBytes:retained,peakAccountedBytes:peak,activeBodies:scopes.size,fatalCode:fatal?.code??null,closed,...counters});}
 function close(){if(closed)return;closed=true;for(const scope of [...scopes])scope.abort('OBS_CLOSED');for(const release of indexReleases)release();indexReleases.length=0;entries.clear();threads.clear();}
 return Object.freeze({fetch:observedFetch,verifyRecord,assertComplete,stats,close});
}
