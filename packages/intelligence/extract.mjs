/** Server-owned configuration; runtime remains explicitly disabled at the gateway by default. */
export function createExtractionService({repository,gatewayFor,taxonomy,redactionPolicy}){
 if(typeof repository?.prepare!=='function'||typeof repository?.complete!=='function'||typeof gatewayFor!=='function')throw Error('EXTRACTION_CONFIGURATION_REQUIRED');
 const config=structuredClone({taxonomy,policy:redactionPolicy});
 return Object.freeze({async extract({conversationId,jobId,taskKey}){
  const prepared=await repository.prepare({conversationId,jobId,taskKey,...config});
  if(!prepared.acquired)return {...prepared,reason:prepared.status==='running'?'reconciliation_required':'already_completed'};
  let result;try{const gateway=await gatewayFor({jobId});result=await gateway.extract(prepared.input);}catch{result={ok:false,error:{code:'extraction_failed'},billingState:'uncertain'};}
  return repository.complete({runId:prepared.runId,result});
 }});
}
