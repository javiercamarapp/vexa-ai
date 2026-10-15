import {createMetadataRepository} from './repository.mjs';
import {fetchMetadataBatch,normalizeMetadataBatch,unavailable} from './normalize.mjs';
import {compiledRuntimeCode,validRuntimeCode} from '../candidates/runtime-code.mjs';
export function createMetadataRuntime({database,resolveTemplate,runtimeCode,fetch,clock=Date.now}){
 const code=runtimeCode??compiledRuntimeCode(),repo=createMetadataRepository({database,clock});
 return Object.freeze({async tick(){
  if(!validRuntimeCode(code))unavailable();const tenantId=await database.transaction('read',s=>s.tenantId),template=resolveTemplate(tenantId),lease=await repo.claim({tenantId,templateHash:template.hash});if(!lease)return{state:'idle'};
  try{const batch=normalizeMetadataBatch({batch:await fetchMetadataBatch({fetch,clock}),template,runtimeCode:code});const result=await repo.publish({tenantId,templateHash:template.hash,leaseToken:lease.leaseToken,batch});return{state:'ready',...result};}
  catch(error){const failure=error?.metadataFailure??{kind:'incomplete',reasonCode:'snapshot_invalid',receipts:[]};await repo.fail({tenantId,templateHash:template.hash,leaseToken:lease.leaseToken,failure});return{state:failure.kind==='blocked'?'blocked':'unavailable',code:failure.reasonCode};}
 }});
}
