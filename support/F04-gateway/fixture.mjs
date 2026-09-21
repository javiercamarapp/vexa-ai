import {randomUUID} from 'node:crypto';
export const instant=Date.parse('2026-09-20T20:00:00.000Z');
export const iso=offset=>new Date(instant+offset).toISOString();
export function setup(createGateway,{policy:policyDelta={},candidate:candidateDelta={},catalog:catalogDelta={},models:customModels,runtime='enabled',omitRuntime=false,hooks={}}={}){
 let now=instant;
 const candidate={model:'synthetic/model-a',provider:'synthetic-provider-eu',structuredOutput:true,dataCollection:'deny',zdr:true,residency:'eu',contextTokens:200000,privacyAttestation:{version:'SYN-attestation-1',residencyEnforced:true,expiresAt:iso(600000)},pricing:{version:'SYN-ceiling-1',validUntil:iso(600000),allChargesIncluded:true,inputMicroUsdPerToken:'1',outputMicroUsdPerToken:'1',overheadTokens:1024},...candidateDelta};
 const policy={authorized:true,version:'SYN-owner-policy-1',allowedModels:['synthetic/model-a','synthetic/model-b'],providers:['synthetic-provider-eu','synthetic-secondary-eu','synthetic-provider-us'],dataCollection:'deny',requireZdr:true,residency:'eu',maxAttempts:3,timeoutMs:1000,maxOutputTokens:256,maxInputBytes:100000,maxResponseBytes:100000,maxCostPerCallMinor:'1000000',maxCostPerTaskMinor:'3000000',tenantLimitMinor:'5000000',window:'SYN-2026-09',currency:'USD',exponent:6,...policyDelta};
 const catalog={version:'SYN-public-catalog-1',fetchedAt:iso(-1000),expiresAt:iso(60000),models:[{id:'synthetic/model-a',contextTokens:200000,supportedParameters:['response_format','temperature','max_tokens']},{id:'synthetic/model-b',contextTokens:200000,supportedParameters:['response_format','temperature','max_tokens']}],...catalogDelta};
 const modelsByRole={extraction:customModels??[candidate]};
 const state={fetches:[],reserved:[],attempts:[],settled:[]};
 const clock={now:()=>now,setTimeout,clearTimeout};
 const advance=ms=>{now+=ms;};
 const response=(status=200)=>new Response(JSON.stringify(status===200?{choices:[{finish_reason:'stop',message:{content:JSON.stringify({issues:[],sentiment:'unknown',intent:'unknown',urgency:'unknown',entities:[],abstention:{reason:'insufficient_evidence'}})}}],usage:{cost:'0'}}:{error:{message:'SYN retry only'},usage:{cost:'0'}}),{status});
 const budgetRepository={async reserve(value){state.reserved.push(value);await hooks.reserve?.({advance,policy,catalog,modelsByRole,state});return {acquired:true,reservationId:randomUUID()};},async recordAttempt(id,value){state.attempts.push(value);await hooks.attempt?.({advance,policy,catalog,modelsByRole,state,value});},async finalize(id,value){state.settled.push(value);}};
 const options={apiKey:'synthetic-'+randomUUID(),policy,catalog,modelsByRole,budgetRepository,clock,fetch:async(url,request)=>{const body=JSON.parse(request.body);state.fetches.push({url,body,redirect:request.redirect});return hooks.transport?hooks.transport({state,body,response,advance}):response();},...(!omitRuntime?{runtime}:{})};
 const gateway=createGateway(options);
 const input={tenantId:randomUUID(),taskKey:randomUUID(),role:'extraction',taxonomy:['SYN-support'],revisions:[]};input.revisions=[{tenant_id:input.tenantId,message_revision_id:'SYN-revision-'+randomUUID(),role:'customer',text:'SYNTHETIC redacted conversation for gateway policy tests.'}];
 return {gateway,input,state,options,policy,catalog,modelsByRole,advance,response,run:()=>gateway.extract(input)};
}
