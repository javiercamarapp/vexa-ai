import {createExtractionConfigResolver} from '../intelligence/runtime.mjs';
import {createProblemConfigResolver} from '../problems/runtime.mjs';
export function historyConfig(env=process.env){return tenant=>{try{const extraction=createExtractionConfigResolver(env.VEXA_EXTRACTION_CONFIG_JSON??'[]')(tenant),embedding=createProblemConfigResolver(env.VEXA_PROBLEMS_CONFIG_JSON??'[]')(tenant);return{ready:true,enabled:env.VEXA_AI_RUNTIME==='enabled'&&env.VEXA_PROBLEMS_RUNTIME==='enabled',extractionHash:extraction.hash,embeddingHash:embedding.hash};}catch{return{ready:false,enabled:false};}};}
