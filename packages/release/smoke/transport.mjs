import {randomUUID} from 'node:crypto';
import {check,fail} from './contract.mjs';
export function transport(config,events,authorize){
 check(typeof authorize==='function','AUTHORIZATION_GUARD_REQUIRED');
 const request=async(account,route,{method='GET',body,upload=false}={})=>{
  authorize();
  const url=new URL(route,config.origin);check(url.origin===(upload?config.storageOrigin:config.origin),'OUTSIDE_ORIGIN_DENIED');check(!url.username&&!url.password&&!url.hash,'URL_INVALID');
  const headers=upload?{'content-type':'text/csv'}:{origin:config.origin,'content-type':'application/json','idempotency-key':randomUUID(),...(account?{cookie:account.cookies.map(c=>c.name+'='+c.value).join('; ')}:{})};
  let response;try{response=await fetch(url,{method,headers,body:body===undefined?undefined:upload?body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{fail('HTTP_TRANSPORT_FAILED');}
  if(response.status>=300&&response.status<400)fail('REDIRECT_DENIED');
  check(Number(response.headers.get('content-length')??0)<=4194304,'RESPONSE_TOO_LARGE');let size=0,chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>4194304)fail('RESPONSE_TOO_LARGE');chunks.push(chunk);}const bytes=Buffer.concat(chunks),text=bytes.toString('utf8');let data;try{data=JSON.parse(text);}catch{data=null;}
  const trace=data?.meta?.trace_id??response.headers.get('x-trace-id');events.push({method,path:upload?'signed-storage-upload':url.pathname,status:response.status,...(/^[a-f0-9-]{36}$/.test(trace??'')?{traceId:trace}:{})});
  return {status:response.status,data,bytes,headers:response.headers};
 };return request;
}
