import 'server-only';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../../../../lib/imports/server';
import {createRuntime} from '../../../../../../../packages/jobs/durable/runtime.mjs';
import {createExtractionRuntime,createExtractionConfigResolver} from '../../../../../../../packages/intelligence/runtime.mjs';
import {createExtractionHostedHandler} from '../../../../../../../packages/intelligence/hosted.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export const POST=createExtractionHostedHandler({secret:process.env.VEXA_WORKER_TRIGGER_SECRET,runtime:async()=>{
 const worker=await createRuntime(process.env,{createDatabase,pool:serverPool(),deadlineAt:Date.now()+40000,consumer:'extraction'});
 if(worker.idle)return worker;
 try{return {...worker,extraction:createExtractionRuntime({database:worker.database,storage:worker.storage,resolveConfig:createExtractionConfigResolver(process.env.VEXA_EXTRACTION_CONFIG_JSON??'[]'),runtime:process.env.VEXA_AI_RUNTIME,apiKey:process.env.OPENROUTER_API_KEY})};}
 catch(error){await worker.close();throw error;}
}});
