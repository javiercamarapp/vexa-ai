import https from 'node:https';
import {createHash} from 'node:crypto';
import {check,uuid,strict} from './contracts.mjs';
const hosts=new Set(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com']);
const key=(v,n)=>typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v)&&Buffer.from(v,'base64url').length===n&&Buffer.from(v,'base64url').toString('base64url')===v;
export function copyPushSubscription(input){
 const v=structuredClone(input);check(v&&typeof v.endpoint==='string'&&v.endpoint.length<=4096&&!/[\s\\]/.test(v.endpoint));
 let u;try{u=new URL(v.endpoint);}catch{check(false);}
 check(u.protocol==='https:'&&hosts.has(u.hostname)&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.pathname.length>1&&u.href===v.endpoint);
 check(key(v.keys?.p256dh,65)&&Buffer.from(v.keys.p256dh,'base64url')[0]===4&&key(v.keys?.auth,16));
 return {endpoint:v.endpoint,keys:{p256dh:v.keys.p256dh,auth:v.keys.auth}};
}
export function pushConfiguration(env=process.env){
 const v={subject:env.VEXA_PUSH_SUBJECT,publicKey:env.VEXA_PUSH_PUBLIC_KEY,privateKey:env.VEXA_PUSH_PRIVATE_KEY};
 if(!key(v.publicKey,65)||!key(v.privateKey,32)||typeof v.subject!=='string')return null;
 try{const u=new URL(v.subject);if(!['https:','mailto:'].includes(u.protocol)||u.username||u.password||/[\r\n]/.test(v.subject))return null;}catch{return null;}
 return Object.freeze(v);
}
export async function availablePushConfiguration(env=process.env){
 const configuration=pushConfiguration(env);if(!configuration)return null;
 try{const m=await import('web-push');return typeof (m.default??m).generateRequestDetails==='function'?configuration:null;}catch{return null;}
}
const call=(s,name,value)=>s.query(`SELECT public.${name}($1::jsonb) AS result`,[JSON.stringify(value)]).then(r=>r.rows[0]?.result);
export function createPushRepository({database,sessionId}){
 check(database&&typeof database.transaction==='function','push_database_required',503);
 return Object.freeze({
  list:()=>database.transaction('read',s=>call(s,'push_own',{op:'list',sessionId})),
  async register(input,{deviceId,sessionId,expiresAt}){
   check(strict(input,['consent','subscription'])&&input.consent===true&&uuid(deviceId)&&uuid(sessionId)&&Number.isSafeInteger(expiresAt));
   const saved=copyPushSubscription(input.subscription);
   return database.transaction('notify',s=>call(s,'push_own',{op:'register',consent:true,deviceId,sessionId,expiresAt,endpoint:saved.endpoint,p256dh:saved.keys.p256dh,auth:saved.keys.auth}));
  },
  revoke(id){check(uuid(id));return database.transaction('notify',s=>call(s,'push_own',{op:'revoke',id,sessionId}));},
  revokeSession({global=false,deviceId}={}){check(global||uuid(deviceId));return database.transaction('notify',s=>call(s,'push_own',global?{op:'logout',sessionId}:{op:'scope',deviceId,sessionId}));},
 });
}
export function retryAfter(value,now=Date.now()){
 if(value===undefined)return 60000;const str=String(value);const ms=/^\d+$/.test(str)?Number(str)*1000:Date.parse(str)-now;
 return Number.isFinite(ms)&&ms>=0&&ms<=86400000?Math.ceil(ms):null;
}
/** SDK standard web-push; same exact validated copy is passed to SDK. No custom encryption. */
export function createWebPushSender({sdk,vapid,timeoutMs=5000,clock=Date.now,request=https.request}={}){
 let config;try{config=pushConfiguration({VEXA_PUSH_SUBJECT:vapid?.subject,VEXA_PUSH_PUBLIC_KEY:vapid?.publicKey,VEXA_PUSH_PRIVATE_KEY:vapid?.privateKey});}catch{config=null;}
 const configured=()=>!!config&&typeof sdk?.generateRequestDetails==='function'&&Number.isSafeInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=8000;
 return Object.freeze({configured,async send({subscription,idempotencyKey,signal,deliveryScope}){
  let saved;try{saved=copyPushSubscription(subscription);}catch{return {kind:'blocked'};}
  if(!configured()||signal?.aborted||!uuid(deliveryScope?.subscriptionId)||!Number.isSafeInteger(deliveryScope?.version)||deliveryScope.version<1)return {kind:'blocked'};
  const scope={subscriptionId:deliveryScope.subscriptionId,version:deliveryScope.version};
  const options={vapidDetails:{...config},TTL:300,urgency:'normal',contentEncoding:'aes128gcm',topic:createHash('sha256').update(String(idempotencyKey)).digest('base64url').slice(0,32)};
  let details;
  try{details=sdk.generateRequestDetails(saved,JSON.stringify({title:'VEXA',body:'Tienes avisos disponibles en VEXA.',href:'/notifications',...scope}),options);if(details.endpoint!==saved.endpoint||details.method!=='POST'||!Buffer.isBuffer(details.body))return {kind:'blocked'};}catch{return {kind:'blocked'};}
  if(signal?.aborted)return {kind:'blocked'};
  // SDK supplies standard encryption/VAPID. Native HTTPS supplies a real abortable deadline and never follows redirects.
  const controller=new AbortController();let req,timer;
  const abort=()=>{controller.abort();req?.destroy();};signal?.addEventListener('abort',abort,{once:true});
  try{return await new Promise(resolve=>{
   let settled=false;const done=outcome=>{if(settled)return;settled=true;resolve(outcome);};
   timer=setTimeout(()=>{abort();done({kind:'uncertain'});},timeoutMs);
   try{
    req=request(saved.endpoint,{method:'POST',headers:{...details.headers},agent:false,signal:controller.signal},res=>{
     const status=res.statusCode;let outcome;
     if(status>=200&&status<300)outcome={kind:'accepted'};
     else if(status===410)outcome={kind:'permanent',revoke:true};
     else if(status===429){const ms=retryAfter(res.headers?.['retry-after'],clock());outcome=ms===null?{kind:'permanent'}:{kind:'retry',retryAfterMs:ms};}
     else if([401,403].includes(status))outcome={kind:'blocked'};
     else if(status>=400&&status<500&&![408,409].includes(status))outcome={kind:'permanent'};
     else outcome={kind:'uncertain'};
     // Only status/Retry-After are retained; do not buffer arbitrary provider responses.
     done(outcome);res.destroy();
    });
    req.once('error',()=>done({kind:'uncertain'}));
    if(controller.signal.aborted){req.destroy();done({kind:'uncertain'});}else req.end(details.body);
   }catch{done({kind:'uncertain'});}
  });}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);req?.destroy();}
 }});
}
/** Per-device durable attempts protect partial fanout: only definite 429 can retry. */
export function createPushTransport({database,sdk,vapid,timeoutMs=5000,request}={}){
 const sender=createWebPushSender({sdk,vapid,timeoutMs,request});
 const operation=p=>database.transaction('import',s=>call(s,'push_worker',p));
 return Object.freeze({configured:sender.configured,
 async resolveRecipient(identity){const saved=structuredClone(identity);check(uuid(saved.tenantId)&&uuid(saved.userId)&&saved.channel==='push');const ids=await operation({...saved,op:'resolve'});return {...saved,consent:Array.isArray(ids)&&ids.length>0,subscriptionIds:ids};},
 async send({recipient,idempotencyKey,signal}){
  let r;try{r=structuredClone(recipient);}catch{return {kind:'blocked'};}
  if(!sender.configured()||!r||r.channel!=='push'||r.consent!==true||!uuid(r.tenantId)||!uuid(r.userId)||!Array.isArray(r.subscriptionIds)||!r.subscriptionIds.length||r.subscriptionIds.some(x=>!uuid(x))||! /^[0-9a-f]{64}$/.test(idempotencyKey))return {kind:'blocked'};
  const outcomes=await Promise.all([...new Set(r.subscriptionIds)].map(async subscriptionId=>{
   const p={tenantId:r.tenantId,userId:r.userId,subscriptionId,key:idempotencyKey};
   try{
    if(signal?.aborted)return {kind:'uncertain'};
    const begin=await operation({...p,op:'begin'});if(begin?.kind!=='ready')return begin??{kind:'uncertain'};
    const outcome=await sender.send({subscription:begin.subscription,idempotencyKey,signal,deliveryScope:begin.deliveryScope});
    // A configuration race after durable sending cannot be retried automatically.
    const saved=outcome.kind==='blocked'?{kind:'uncertain'}:outcome;
    await operation({...p,op:'finish',attempt:begin.attempt,...saved});return saved;
   }catch{return {kind:'uncertain'};}
  }));
  if(outcomes.some(o=>o.kind==='uncertain'))return {kind:'uncertain'};
  const retries=outcomes.filter(o=>o.kind==='retry');if(retries.length)return {kind:'retry',retryAfterMs:Math.max(...retries.map(o=>o.retryAfterMs??60000))};
  if(outcomes.some(o=>o.kind==='accepted'))return {kind:'accepted',providerId:'push_local_'+idempotencyKey};
  return {kind:'permanent'};
 }
 });
}
