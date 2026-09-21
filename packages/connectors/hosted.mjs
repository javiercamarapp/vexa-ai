import {createHash,timingSafeEqual} from 'node:crypto';
const digest=x=>createHash('sha256').update(x).digest();
/** Same authenticated, tenant-free HTTP protocol as the durable import scheduler. */
export function createCRMHostedHandler({runtime,secret,timeoutMs=15000}={}){
 let active=false;
 return async request=>{
  const reply=(code,status)=>Response.json({code},{status,headers:{'Cache-Control':'private, no-store'}});
  if(typeof secret!=='string'||secret.length<32||typeof runtime!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>20000)return reply('CRM_CONFIGURATION_REQUIRED',503);
  if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
  if(!timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+secret)))return reply('UNAUTHORIZED',401);
  const body=await request.text();if(new URL(request.url).search||!['','{}'].includes(body))return reply('BODY_NOT_ALLOWED',400);
  if(active)return reply('CHUNK_BUSY',409);active=true;let state;
  try{state=await runtime();if(state.idle)return reply('IDLE',200);const result=await state.crm.tick({deadlineMs:timeoutMs,maxPages:1});return Response.json({data:result},{headers:{'Cache-Control':'private, no-store'}});}
  catch{return reply('CRM_WORKER_UNAVAILABLE',503);}
  finally{try{await state?.close();}finally{active=false;}}
 };
}
