import {createHash,timingSafeEqual} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest();
/** Authenticated tenant-free scheduler endpoint. Runtime closes even when work or cleanup fails. */
export function createExtractionHostedHandler({runtime,secret}={}){
 let active=false;
 return async request=>{
  const reply=(code,status)=>Response.json({code},{status,headers:{'Cache-Control':'private, no-store'}});
  if(typeof secret!=='string'||secret.length<32||typeof runtime!=='function')return reply('EXTRACTION_CONFIGURATION_REQUIRED',503);
  if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
  if(!timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+secret)))return reply('UNAUTHORIZED',401);
  const body=await request.text();if(new URL(request.url).search||!['','{}'].includes(body))return reply('BODY_NOT_ALLOWED',400);
  if(active)return reply('CHUNK_BUSY',409);active=true;let worker;
  try{worker=await runtime();if(worker.idle)return reply('IDLE',200);return Response.json({data:await worker.extraction.tick()},{headers:{'Cache-Control':'private, no-store'}});}
  catch{return reply('EXTRACTION_WORKER_UNAVAILABLE',503);}
  finally{try{await worker?.close();}finally{active=false;}}
 };
}
