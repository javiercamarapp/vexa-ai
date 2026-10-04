import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGateway} from './index.mjs';
import {createEmbeddingGateway} from './embeddings.mjs';
// Synthetic transports only. No credentials, network, DB or provider inference.
const now=Date.now(),expiry=new Date(now+3600000).toISOString();
function config(residency){
 const policy={version:'SYN',authorized:true,allowedModels:['SYN/model'],providers:['SYN/provider'],dataCollection:'deny',requireZdr:true,residency,maxAttempts:1,timeoutMs:1000,maxOutputTokens:100,maxInputBytes:20000,maxResponseBytes:30000,maxCostPerCallMinor:'100000',maxCostPerTaskMinor:'100000',tenantLimitMinor:'20000000',window:'SYN',currency:'USD',exponent:6};
 const candidate={model:'SYN/model',provider:'SYN/provider',residency,structuredOutput:true,dataCollection:'deny',zdr:true,contextTokens:100000,pricing:{version:'SYN',validUntil:expiry,allChargesIncluded:true,inputMicroUsdPerToken:'1',outputMicroUsdPerToken:'2',overheadTokens:1024},...(residency==='unrestricted'?{}:{privacyAttestation:{version:'SYN',residencyEnforced:true,expiresAt:expiry}})};
 return {policy,candidate};
}
async function run(kind,settings,endpoint){
 let calls=[];
 const budgetRepository={reserve:async()=>({acquired:true,reservationId:'SYN'}),recordAttempt:async()=>{},finalize:async()=>{}};
 const catalog={version:'SYN',fetchedAt:new Date(now).toISOString(),expiresAt:expiry,models:[{id:'SYN/model',contextTokens:100000,dimensions:2,supportedParameters:['response_format']}]};
 const output={issues:[],sentiment:'unknown',intent:'unknown',urgency:'unknown',entities:[],abstention:{reason:'insufficient_evidence'}};
 const common={...settings,catalog,apiKey:'synthetic-test-only',runtime:'enabled',budgetRepository,fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body),redirect:init.redirect});return new Response(JSON.stringify(kind==='extraction'?{choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}],usage:{cost:'0.00001'}}:{model:'SYN/model',data:[{index:0,embedding:[1,0]}],usage:{cost:'0.00001'}}));}};
 let ok=false;
 if(kind==='extraction'){const r=await createGateway({...common,modelsByRole:{extraction:[settings.candidate]},endpoint}).extract({tenantId:'SYN',taskKey:'SYN',role:'extraction',taxonomy:['unknown'],revisions:[{tenant_id:'SYN',message_revision_id:'SYN',role:'customer',text:'synthetic'}]});ok=r.ok;}
 else {try{await createEmbeddingGateway(common).embed({tenantId:'SYN',taskKey:'SYN',input:['synthetic'],dimensions:2});ok=true;}catch(e){assert.equal(e.code,'policy_blocked');}}
 return {ok,calls};
}
for(const kind of ['extraction','embedding']){
 for(const [region,origin] of [['unrestricted','https://openrouter.ai'],['US','https://us.openrouter.ai'],['EU','https://eu.openrouter.ai'],['us','https://us.openrouter.ai'],['eu','https://eu.openrouter.ai']])test(`${kind}: explicit ${region} uses exact official route and retains privacy controls`,async()=>{
  const {ok,calls}=await run(kind,config(region));assert.equal(ok,true);assert.equal(calls.length,1);assert.equal(calls[0].url,origin+'/api/v1/'+(kind==='extraction'?'chat/completions':'embeddings'));assert.equal(calls[0].body.provider.zdr,true);assert.equal(calls[0].body.provider.data_collection,'deny');assert.equal(calls[0].body.provider.allow_fallbacks,false);assert.equal(calls[0].redirect,'error');
 });
 for(const [name,mutate] of [
  ['missing policy region',c=>delete c.policy.residency],
  ['unknown region',c=>{c.policy.residency='https://attacker.invalid';c.candidate.residency=c.policy.residency;}],
  ['regional mismatch',c=>c.candidate.residency='EU'],
  ['regional attestation missing',c=>delete c.candidate.privacyAttestation],
  ['regional attestation false',c=>c.candidate.privacyAttestation.residencyEnforced=false],
  ['regional attestation expired',c=>c.candidate.privacyAttestation.expiresAt='2000-01-01'],
  ['unauthorized',c=>c.policy.authorized=false],
  ['ZDR incompatible',c=>c.candidate.zdr=false],
  ['collection incompatible',c=>c.candidate.dataCollection='allow']
 ])test(`${kind}: ${name} blocks before transport`,async()=>{const c=config('US');mutate(c);const r=await run(kind,c);assert.equal(r.ok,false);assert.equal(r.calls.length,0);});
 test(`${kind}: unrestricted rejects fake enforced-residency claim`,async()=>{const c=config('unrestricted');c.candidate.privacyAttestation={version:'SYN',residencyEnforced:true,expiresAt:expiry};const r=await run(kind,c);assert.equal(r.ok,false);assert.equal(r.calls.length,0);});
}
for(const endpoint of ['https://attacker.invalid/api/v1/chat/completions','https://openrouter.ai/api/v1/chat/completions','https://eu.openrouter.ai/api/v1/chat/completions','https://us.openrouter.ai/api/v1/embeddings'])test('regional extraction refuses explicit incompatible endpoint '+endpoint,async()=>{const r=await run('extraction',config('US'),endpoint);assert.equal(r.ok,false);assert.equal(r.calls.length,0);});
