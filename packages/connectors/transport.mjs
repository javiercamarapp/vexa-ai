export class ConnectorError extends Error {
  constructor(code, { status = null, retryable = false, retryAfterMs = null } = {}) {
    super(code); this.name = 'ConnectorError'; this.code = code;
    this.status = status; this.retryable = retryable; this.retryAfterMs = retryAfterMs; this.state=code==='RECONNECT_REQUIRED'?'reconnect_required':'error';
  }
}
const fail = (code, details) => { throw new ConnectorError(code, details); };
export function createTransport(config) {
 return scopedTransport(config,{origin:'https://api.hubapi.com',source:'hubspot'});
}
export function createZendeskTransport(config) {
 if(typeof config.subdomain!=='string'||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(config.subdomain))fail('INVALID_CONFIG');
 return scopedTransport(config,{origin:`https://${config.subdomain}.zendesk.com`,source:'zendesk'});
}
function scopedTransport(config,provider) {
 const {token}=config;
 if(typeof token!=='string'||!token||/[\r\n]/.test(token))fail('INVALID_CONFIG');
 const fetcher=config.fetch??globalThis.fetch, sleep=config.sleep??(ms=>new Promise(r=>setTimeout(r,ms))), clock=config.clock??(()=>new Date());
 if(typeof fetcher!=='function'||typeof sleep!=='function'||typeof clock!=='function')fail('INVALID_CONFIG');
 const limits={timeoutMs:15000,maxRetries:2,maxDelayMs:30000,maxResponseBytes:8*1024*1024,...Object.fromEntries(['timeoutMs','maxRetries','maxDelayMs','maxResponseBytes'].filter(k=>config[k]!==undefined).map(k=>[k,config[k]]))};
 for(const [key,value] of Object.entries(limits))if(!Number.isSafeInteger(value)||value<(key==='maxRetries'?0:1))fail('INVALID_CONFIG');
 if(limits.maxRetries>5||limits.timeoutMs>60000||limits.maxDelayMs>60000||limits.maxResponseBytes>64*1024*1024)fail('INVALID_CONFIG');
 const deadline=config.deadlineMs??clock().getTime()+900000;
 if(!Number.isSafeInteger(deadline))fail('INVALID_CONFIG');
 const remaining=()=>{const n=deadline-clock().getTime();if(n<=0)fail('DEADLINE_EXCEEDED',{retryable:true});return n;};
 let blocked=false;
  async function requestOnce(url) {
    const controller=new AbortController();let reader,timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();if(reader)void reader.cancel().catch(()=>{});reject(new ConnectorError('TIMEOUT',{retryable:true}));},Math.min(limits.timeoutMs, remaining()));});
    const operation=(async()=>{
      let response;
      try{response=await fetcher(url.href,{method:'GET',redirect:'manual',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:controller.signal});}
      catch{if(controller.signal.aborted)fail('TIMEOUT',{retryable:true});fail('NETWORK_ERROR',{retryable:true});}
      if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});fail('TIMEOUT',{retryable:true});}
      if(response.redirected || (response.status>=300&&response.status<400)) {void response.body?.cancel().catch(()=>{});fail('REDIRECT_BLOCKED');}
      if(response.url) {let actual;try{actual=new URL(response.url);}catch{fail('REDIRECT_BLOCKED');}if(actual.origin!==provider.origin||actual.pathname!==url.pathname)fail('REDIRECT_BLOCKED');}
      if(response.status===401||response.status===403){blocked=true;void response.body?.cancel().catch(()=>{});fail('RECONNECT_REQUIRED',{status:response.status});}
      if(!response.ok){
        const retryable=response.status===429||(response.status>=500&&response.status<=599);
        let retryAfterMs=null;const header=response.headers.get('retry-after');
        if(header!==null) {if(/^\d+$/.test(header.trim()))retryAfterMs=Number(header)*1000;else {const date=Date.parse(header);if(Number.isFinite(date))retryAfterMs=Math.max(0,date-clock().getTime());}}
        void response.body?.cancel().catch(()=>{});
        fail(retryable?'HTTP_RETRY':'HTTP_ERROR',{status:response.status,retryable,retryAfterMs});
      }
      if(!response.body)fail('PROVIDER_SCHEMA');
      reader=response.body.getReader();let size=0;const chunks=[];
      try {
        while(true) {
          let chunk;
          try { chunk=await reader.read(); }
          catch { fail(controller.signal.aborted?'TIMEOUT':'NETWORK_ERROR',{retryable:true}); }
          const {value,done}=chunk;
          if(done)break;
          size+=value.byteLength;
          if(size>limits.maxResponseBytes)fail('RESPONSE_LIMIT');
          chunks.push(value);
        }
      }
      finally{void reader.cancel().catch(()=>{});}
      try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{fail('PROVIDER_SCHEMA');}
    })();
    try{return await Promise.race([operation,timeout]);}catch(error){if(error instanceof ConnectorError)throw error;fail('TRANSPORT_ERROR');}finally{clearTimeout(timer);}
  }
  async function request(url) {
    if(blocked)fail('RECONNECT_REQUIRED');
    remaining();
    for(let attempt=0;;attempt++) {
      try{return await requestOnce(url);}catch(error){
        if(!(error instanceof ConnectorError)||!error.retryable)throw error;
        if(error.retryAfterMs!==null&&error.retryAfterMs>limits.maxDelayMs)fail('RETRY_DEFERRED',{status:error.status,retryable:true,retryAfterMs:error.retryAfterMs});
        if(attempt>=limits.maxRetries){if(error.code==='HTTP_RETRY')fail('HTTP_RETRY_EXHAUSTED',{status:error.status,retryable:true});throw error;}
        const delay=error.retryAfterMs??Math.min(limits.maxDelayMs,250*2**attempt+Math.floor(Math.random()*100));
        if(delay>=remaining())fail('DEADLINE_EXCEEDED',{retryable:true});
        await sleep(delay);
        remaining();
      }
    }
  }
 return {request:async url=>{
 if(!(url instanceof URL)||url.origin!==provider.origin||url.username||url.password||url.hash)fail('UNSAFE_URL');
 const allowed=provider.source==='zendesk'?/^\/api\/v2\/(?:incremental\/tickets\/cursor|tickets\/[A-Za-z0-9_-]+\/comments|users\/[A-Za-z0-9_-]+)(?:\.json)?$/:/^\/conversations\/v3\/conversations\/threads(?:\/[A-Za-z0-9_-]+(?:\/messages(?:\/[A-Za-z0-9_-]+\/original-content)?)?)?$|^\/crm\/v3\/objects\/(?:tickets|notes)\/[A-Za-z0-9_-]+$|^\/crm\/v4\/objects\/tickets\/[A-Za-z0-9_-]+\/associations\/notes$/;
 if(!allowed.test(url.pathname))fail('UNSAFE_URL');
 return request(url);
 }};
}
