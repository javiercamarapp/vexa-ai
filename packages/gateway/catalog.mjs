import {createHash} from 'node:crypto';
const URL='https://openrouter.ai/api/v1/models';
const MAX_AGE=86400000;
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const text=x=>typeof x==='string'&&x.length>0&&x.length<=200;
/** Public catalog describes model capabilities, never endpoint privacy eligibility. */
export function validCatalog(c,now=Date.now()){
 try{
  const start=Date.parse(c.fetchedAt),end=Date.parse(c.expiresAt);
  if(!Number.isFinite(now)||!text(c.version)||!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now||end<=start||end-start>MAX_AGE||!Array.isArray(c.models)||!c.models.length||c.models.length>10000)return false;
  const ids=new Set();
  return c.models.every(m=>text(m.id)&&!ids.has(m.id)&&!!ids.add(m.id)&&integer(m.contextTokens,1,10000000)&&Array.isArray(m.supportedParameters)&&m.supportedParameters.length<=100&&m.supportedParameters.every(text));
 }catch{return false;}
}
export function catalogModel(c,id,now=Date.now()){
 if(!validCatalog(c,now))return null;
 const row=c.models.find(m=>m.id===id);
 return row&&row.supportedParameters.includes('response_format')?structuredClone(row):null;
}
/** Caller stores this immutable version alongside policy; no inferred rates or ZDR. */
export function parseModelCatalog(body,{fetchedAt=Date.now(),ttlMs=3600000}={}){
 if(!integer(ttlMs,1,MAX_AGE)||!Number.isSafeInteger(fetchedAt)||!Array.isArray(body?.data))throw Error('CATALOG_INVALID');
 const models=body.data.map(m=>({id:m.id,contextTokens:m.context_length,supportedParameters:m.supported_parameters}));
 const catalog={version:createHash('sha256').update(JSON.stringify(models)).digest('hex'),fetchedAt:new Date(fetchedAt).toISOString(),expiresAt:new Date(fetchedAt+ttlMs).toISOString(),models};
 if(!validCatalog(catalog,fetchedAt))throw Error('CATALOG_INVALID');
 return catalog;
}
/** Explicit read-only catalog fetch; no API key, inference, redirects or implicit refresh. */
export async function fetchModelCatalog({fetch:transport=globalThis.fetch,clock=Date.now,ttlMs=3600000,timeoutMs=5000}={}){
 if(typeof window!=='undefined'||typeof transport!=='function'||!integer(timeoutMs,1,30000))throw Error('CATALOG_UNAVAILABLE');
 const fetchedAt=clock(),controller=new AbortController();let timer,reader;
 try{
  return await Promise.race([(async()=>{
   const response=await transport(URL,{method:'GET',redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
   if(!response.ok||!response.body?.getReader)throw Error('CATALOG_UNAVAILABLE');
   reader=response.body.getReader();let bytes=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>10000000)throw Error('CATALOG_UNAVAILABLE');chunks.push(value);}
   const result=parseModelCatalog(JSON.parse(Buffer.concat(chunks).toString('utf8')),{fetchedAt,ttlMs});
   if(!validCatalog(result,clock()))throw Error('CATALOG_UNAVAILABLE');
   return result;
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('CATALOG_UNAVAILABLE'));},timeoutMs);})]);
 }catch{throw Error('CATALOG_UNAVAILABLE');}
 finally{clearTimeout(timer);controller.abort();if(reader)reader.cancel().catch(()=>{});}
}
