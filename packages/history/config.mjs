import {createExtractionConfigResolver} from '../intelligence/runtime.mjs';
import {createManagedExtractionResolver} from '../intelligence/candidates/resolve.mjs';
import {createProblemConfigResolver} from '../problems/runtime.mjs';
import {extractionReadiness} from '../gateway/index.mjs';
export function historyConfig(env=process.env,database,runtimeCode){return async(tenant,scope,expectedConfigHash=null)=>{try{const base=createExtractionConfigResolver(env.VEXA_EXTRACTION_CONFIG_JSON??'[]'),resolver=createManagedExtractionResolver({database,baseResolver:base,env,runtimeCode}),extraction=await resolver(tenant,scope,expectedConfigHash),embedding=createProblemConfigResolver(env.VEXA_PROBLEMS_CONFIG_JSON??'[]')(tenant);return{ready:extractionReadiness(extraction.gateway),enabled:env.VEXA_AI_RUNTIME==='enabled'&&env.VEXA_PROBLEMS_RUNTIME==='enabled',extractionHash:extraction.hash,embeddingHash:embedding.hash};}catch{return{ready:false,enabled:false};}};}
