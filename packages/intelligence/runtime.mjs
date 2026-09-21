import {sha256,extractionSchema} from './index.mjs';
import {redactText} from './redact.mjs';
import {createExtractionQueue} from './queue.mjs';
import {createExtractionRepository} from './extraction-repository.mjs';
import {createExtractionService} from './extract.mjs';
import {createGateway} from '../gateway/index.mjs';
import {createDurableBudgetRepository} from '../gateway/durable-budget.mjs';
const fail=()=>{throw Object.assign(Error('configuration_required'),{code:'configuration_required',status:503});};
/** Tenant config is supplied by the server; never accepted from a browser request. */
export function createExtractionConfigResolver(raw='[]'){
 let entries;try{entries=JSON.parse(raw);}catch{fail();}
 if(!Array.isArray(entries)||entries.length>1000)fail();const map=new Map();
 for(const entry of entries){
  if(!entry||typeof entry.tenantId!=='string'||! /^[a-f0-9-]{36}$/i.test(entry.tenantId)||map.has(entry.tenantId))fail();
  extractionSchema(entry.taxonomy,{modelOutput:true});redactText('',entry.redactionPolicy);
  const gateway=entry.gateway;if(!gateway||!gateway.policy||!gateway.modelsByRole||!gateway.catalog)fail();
  // At most 15 seconds transport plus two seconds Retry-After within a 45-second lease.
  if(!Number.isInteger(gateway.policy.timeoutMs)||gateway.policy.timeoutMs<1||!Number.isInteger(gateway.policy.maxAttempts)||gateway.policy.maxAttempts<1||gateway.policy.maxAttempts>3||gateway.policy.timeoutMs*gateway.policy.maxAttempts>15000)fail();
  const configuration=structuredClone({taxonomy:entry.taxonomy,redactionPolicy:entry.redactionPolicy,gateway});
  map.set(entry.tenantId,{...configuration,hash:sha256(JSON.stringify(configuration))});
 }
 return tenantId=>{const value=map.get(tenantId);if(!value)fail();return structuredClone(value);};
}
export function createExtractionRuntime({database,storage,resolveConfig,apiKey,runtime='stub',fetch,clock}={}){
 if(typeof resolveConfig!=='function')fail();
 const queue=createExtractionQueue({database});
 return Object.freeze({queue,async tick(){
  const claim=await queue.claim();if(!claim)return {state:'idle'};if(claim.recovered)return claim;
  let config;try{config=resolveConfig(claim.tenant_id);}catch{return queue.reject(claim,'configuration_required');}
  if(config.hash!==claim.configHash)return queue.reject(claim,'configuration_changed');
  const scoped=queue.scopedDatabase(claim);
  const repository=createExtractionRepository({database:scoped,storage});
  const service=createExtractionService({repository,taxonomy:config.taxonomy,redactionPolicy:config.redactionPolicy,gatewayFor:({jobId})=>createGateway({...config.gateway,runtime,apiKey,fetch,clock,budgetRepository:createDurableBudgetRepository({database:scoped,purpose:'extraction',jobId})})});
  try{
   const result=await service.extract({conversationId:claim.conversationId,jobId:claim.id,taskKey:'extraction:'+claim.id});
   if(result.reason==='reconciliation_required')return queue.reject(claim,'reconciliation_required');
   return await queue.complete(claim,result);
  }catch{
   // A persisted claim may have crossed the network boundary. No automatic inference replay.
   // If auth/lease has changed, rejecting also fails closed; the next worker reconciles status.
   return queue.reject(claim,'execution_failed');
  }
 }});
}
