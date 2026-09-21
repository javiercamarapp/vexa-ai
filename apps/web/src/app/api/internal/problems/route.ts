import 'server-only';
import {createHash,timingSafeEqual} from 'node:crypto';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../../../../lib/imports/server';
import {createRuntime} from '../../../../../../../packages/jobs/durable/runtime.mjs';
import {createProblemRuntime,createProblemConfigResolver} from '../../../../../../../packages/problems/runtime.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
const digest=(value:string)=>createHash('sha256').update(value).digest();
let active=false;
export async function POST(request:Request){
 const reply=(code:string,status:number)=>Response.json({code},{status,headers:{'Cache-Control':'private, no-store'}});
 const secret=process.env.VEXA_WORKER_TRIGGER_SECRET;
 if(!secret||secret.length<32)return reply('PROBLEMS_CONFIGURATION_REQUIRED',503);
 if(!timingSafeEqual(digest(request.headers.get('authorization')??''),digest('Bearer '+secret)))return reply('UNAUTHORIZED',401);
 const body=await request.text();if(new URL(request.url).search||!['','{}'].includes(body))return reply('BODY_NOT_ALLOWED',400);
 if(active)return reply('CHUNK_BUSY',409);active=true;let worker;
 try{
  worker=await createRuntime(process.env,{createDatabase,pool:serverPool(),deadlineAt:Date.now()+40000,consumer:'problems'});
  if(worker.idle)return reply('IDLE',200);
  const problems=createProblemRuntime({database:worker.database,resolveConfig:createProblemConfigResolver(process.env.VEXA_PROBLEMS_CONFIG_JSON??'[]'),runtime:process.env.VEXA_PROBLEMS_RUNTIME,apiKey:process.env.VEXA_OPENROUTER_API_KEY});
  return Response.json({data:await problems.tick()},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return reply('PROBLEMS_WORKER_UNAVAILABLE',503);}
 finally{try{await worker?.close();}finally{active=false;}}
}
