import 'server-only';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../../../../lib/imports/server';
import {createRuntime} from '../../../../../../../packages/jobs/durable/runtime.mjs';
import {createExtractionConfigResolver} from '../../../../../../../packages/intelligence/runtime.mjs';
import {createMetadataRuntime} from '../../../../../../../packages/intelligence/metadata/runtime.mjs';
import {createMetadataHostedHandler} from '../../../../../../../packages/intelligence/metadata/hosted.mjs';
export const runtime='nodejs';
export const maxDuration=30;
export const dynamic='force-dynamic';
const handler=createMetadataHostedHandler({secret:process.env.VEXA_WORKER_TRIGGER_SECRET,runtime:async({deadlineAt})=>{
 if(!Number.isSafeInteger(deadlineAt)||deadlineAt<=Date.now())throw new Error('METADATA_DEADLINE_INVALID');
 const worker=await createRuntime(process.env,{createDatabase,pool:serverPool(),deadlineAt,consumer:'metadata'});
 if(worker.idle)return worker;
 try{return {...worker,metadata:createMetadataRuntime({database:worker.database,resolveTemplate:createExtractionConfigResolver(process.env.VEXA_EXTRACTION_CONFIG_JSON??'[]')})};}
 catch(error){await worker.close();throw error;}
}});
export const GET=handler;
export const POST=handler;
