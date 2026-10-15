import {createHash,timingSafeEqual} from 'node:crypto';
import {readTriggerInput} from '../../jobs/durable/trigger-input.mjs';
const hash=v=>createHash('sha256').update(v).digest();
export function createMetadataHostedHandler({runtime,secret}={}){
 let active=false;
 return async request=>{
  const started=performance.now(),deadlineAt=Date.now()+20000;
  const reply=(code,status)=>Response.json({code},{status,headers:{'Cache-Control':'private, no-store'}});
  if(typeof secret!=='string'||secret.length<32||typeof runtime!=='function')return reply('METADATA_CONFIGURATION_REQUIRED',503);
  if(!['GET','POST'].includes(request.method))return reply('METHOD_NOT_ALLOWED',405);
  if(!timingSafeEqual(hash(request.headers.get('authorization')??''),hash('Bearer '+secret)))return reply('UNAUTHORIZED',401);
  try{await readTriggerInput(request);}catch{return reply('BODY_NOT_ALLOWED',400);}
  if(active)return reply('METADATA_BUSY',409);active=true;
  let timer,expired=false;const work=(async()=>{let worker;try{worker=await runtime({deadlineAt});if(expired)return reply('METADATA_TIMEOUT',503);const data=worker.idle?{state:'idle'}:await worker.metadata.tick();if(expired)return reply('METADATA_TIMEOUT',503);return Response.json({data},{headers:{'Cache-Control':'private, no-store'}});}catch{return reply('METADATA_UNAVAILABLE',503);}finally{try{await worker?.close();}finally{active=false;}}})();
  try{return await Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>{expired=true;resolve(reply('METADATA_TIMEOUT',503));},Math.max(1,20000-(performance.now()-started)));})]);}catch{return reply('METADATA_UNAVAILABLE',503);}finally{clearTimeout(timer);}
  // A timed-out worker still owns single-flight until its finally/close settles.
 };
}
