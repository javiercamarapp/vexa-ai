import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const ID=/^[a-zA-Z0-9_-]{16,80}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const error=(code,status=400)=>Object.assign(Error(code),{code,status});
const check=(ok,code,status)=>{if(!ok)throw error(code,status);};
const text=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&x.trim()===x&&!/[\u0000-\u001f\u007f]/.test(x);
export function createCRMWebhookBindings(raw,origin){
 check(typeof window==='undefined','CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);
 let url,rows;try{url=new URL(origin);rows=JSON.parse(raw);}catch{throw error('CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);}
 check(url.origin===origin&&!url.username&&!url.password&&(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))&&typeof raw==='string'&&Buffer.byteLength(raw)<=1048576&&Array.isArray(rows)&&rows.length<=1000,'CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);
 const bindings=new Map(),connections=new Set(),zendeskSecrets=new Set();
 for(const row of rows){
  check(object(row)&&Object.keys(row).every(k=>['id','tenantId','connectionId','source','accountId','secret','appId'].includes(k))&&typeof row.id==='string'&&ID.test(row.id)&&UUID.test(row.tenantId)&&UUID.test(row.connectionId)&&['hubspot','zendesk'].includes(row.source)&&text(row.accountId,200)&&text(row.secret,1024)&&row.secret.length>=32,'CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);
  check(!bindings.has(row.id)&&!connections.has(row.connectionId),'CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);
  if(row.source==='hubspot')check(/^[1-9][0-9]{0,19}$/.test(row.accountId)&&/^[1-9][0-9]{0,19}$/.test(row.appId),'CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);
  else{check(row.appId===undefined&&!zendeskSecrets.has(row.secret),'CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);zendeskSecrets.add(row.secret);}
  bindings.set(row.id,Object.freeze({...row,url:origin+'/api/webhooks/crm/'+row.id}));connections.add(row.connectionId);
 }
 return Object.freeze({resolve(id){const row=bindings.get(id);if(!row)throw error('CRM_WEBHOOK_UNAUTHORIZED',401);return row;},origin});
}
function signature(bytes,provided){
 if(typeof provided!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(provided))return false;
 const actual=Buffer.from(provided,'base64');return actual.length===32&&timingSafeEqual(bytes,actual);
}
function accountId(x){return typeof x==='string'&&/^[1-9][0-9]{0,19}$/.test(x)?x:typeof x==='number'&&Number.isSafeInteger(x)&&x>0?String(x):null;}
export function verifyCRMWebhook({binding,body,headers,now=Date.now()}){
 check(Buffer.isBuffer(body)&&body.length>0&&body.length<=1048576&&Number.isSafeInteger(now),'CRM_WEBHOOK_INPUT_INVALID');
 let timestamp,stamp,expected;
 if(binding.source==='hubspot'){
  timestamp=headers.get('x-hubspot-request-timestamp');check(typeof timestamp==='string'&&/^[0-9]{13}$/.test(timestamp),'CRM_WEBHOOK_UNAUTHORIZED',401);stamp=Number(timestamp);
  // Fixed ASCII callback path with no query: provider URI decoding is unnecessary.
  expected=createHmac('sha256',binding.secret).update('POST'+binding.url).update(body).update(timestamp).digest();
  check(signature(expected,headers.get('x-hubspot-signature-v3')),'CRM_WEBHOOK_UNAUTHORIZED',401);
 }else if(binding.source==='zendesk'){
  timestamp=headers.get('x-zendesk-webhook-signature-timestamp');check(typeof timestamp==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(timestamp),'CRM_WEBHOOK_UNAUTHORIZED',401);stamp=Date.parse(timestamp);
  const normalized=timestamp.includes('.')?timestamp.replace(/\.(\d{1,3})Z$/,(_,s)=>'.'+s.padEnd(3,'0')+'Z'):timestamp.replace('Z','.000Z');check(Number.isFinite(stamp)&&new Date(stamp).toISOString()===normalized,'CRM_WEBHOOK_UNAUTHORIZED',401);
  expected=createHmac('sha256',binding.secret).update(timestamp).update(body).digest();check(signature(expected,headers.get('x-zendesk-webhook-signature')),'CRM_WEBHOOK_UNAUTHORIZED',401);
 }else throw error('CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);
 check(now-stamp<=300000&&stamp-now<=60000,'CRM_WEBHOOK_UNAUTHORIZED',401);
 let payload;try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{throw error('CRM_WEBHOOK_INPUT_INVALID');}
 if(binding.source==='hubspot')check(Array.isArray(payload)&&payload.length>0&&payload.length<=100&&payload.every(e=>object(e)&&accountId(e.portalId)===binding.accountId&&accountId(e.appId)===binding.appId),'CRM_WEBHOOK_ACCOUNT_MISMATCH',403);
 else check(object(payload),'CRM_WEBHOOK_INPUT_INVALID');
 // Only a request fingerprint survives validation, never provider content or credentials.
 return Object.freeze({digest:createHash('sha256').update(timestamp).update('\0').update(body).digest('hex')});
}
async function readBody(request,readTimeoutMs){
 const length=request.headers.get('content-length');check(length===null||/^(0|[1-9][0-9]*)$/.test(length),'CRM_WEBHOOK_INPUT_INVALID');check(length===null||Number(length)<=1048576,'CRM_WEBHOOK_BODY_LIMIT',413);
 check(request.body,'CRM_WEBHOOK_INPUT_INVALID');const reader=request.body.getReader();let timer,total=0;const chunks=[];
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('CRM_WEBHOOK_READ_TIMEOUT',408)),readTimeoutMs);});
 try{for(;;){const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;total+=value.byteLength;check(total<=1048576,'CRM_WEBHOOK_BODY_LIMIT',413);chunks.push(value);}return Buffer.concat(chunks,total);}
 catch(e){void reader.cancel().catch(()=>{});throw e;}finally{clearTimeout(timer);reader.releaseLock();}
}
export function createCRMWebhookHandler({bindings,record,clock=Date.now,readTimeoutMs=5000}={}){
 return async request=>{
  const reply=(code,status)=>Response.json({code},{status,headers:{'Cache-Control':'private, no-store','Content-Type':'application/json',...(status===429?{'Retry-After':'60'}:{}),...(status===405?{Allow:'POST'}:{})}});
  try{
   check(bindings&&typeof bindings.resolve==='function'&&typeof record==='function'&&Number.isSafeInteger(readTimeoutMs)&&readTimeoutMs>=10&&readTimeoutMs<=5000,'CRM_WEBHOOK_CONFIGURATION_REQUIRED',503);
   if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
   const url=new URL(request.url);check(!url.search&&!url.hash&&url.origin===bindings.origin,'CRM_WEBHOOK_INPUT_INVALID');
   const match=/^\/api\/webhooks\/crm\/([a-zA-Z0-9_-]{16,80})$/.exec(url.pathname);check(match,'CRM_WEBHOOK_UNAUTHORIZED',401);const binding=bindings.resolve(match[1]);
   check(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='application/json'&&(!request.headers.has('content-encoding')||request.headers.get('content-encoding')==='identity'),'CRM_WEBHOOK_MEDIA_TYPE',415);
   const body=await readBody(request,readTimeoutMs),verified=verifyCRMWebhook({binding,body,headers:request.headers,now:clock()});
   const result=await record({binding,digest:verified.digest});
   if(result?.status==='rate_limited')return reply('CRM_WEBHOOK_RATE_LIMIT',429);
   if(result?.status==='unavailable')return reply('CRM_WEBHOOK_UNAVAILABLE',503);
   check(result?.status==='accepted'||result?.status==='duplicate','CRM_WEBHOOK_UNAVAILABLE',503);
   return reply(result.status==='duplicate'?'CRM_WEBHOOK_DUPLICATE':'CRM_WEBHOOK_ACCEPTED',result.status==='duplicate'?200:202);
  }catch(e){const code=e?.code;return typeof code==='string'&&/^CRM_WEBHOOK_[A-Z_]+$/.test(code)&&[400,401,403,408,413,415,503].includes(e.status)?reply(code,e.status):reply('CRM_WEBHOOK_UNAVAILABLE',503);}
 };
}
