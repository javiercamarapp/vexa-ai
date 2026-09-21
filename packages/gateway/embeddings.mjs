import {hash} from '../problems/contracts.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const money=x=>{if(!/^\d+$/.test(String(x)))fail('policy_blocked');return BigInt(x);};
export function createEmbeddingGateway({policy,candidate,catalog,apiKey,runtime='stub',budgetRepository,fetch:transport=globalThis.fetch}={}){
 const p=structuredClone(policy),c=structuredClone(candidate),catalogSnapshot=structuredClone(catalog);
 return {async embed({tenantId,taskKey,input,dimensions}){
 if(typeof window!=='undefined'||runtime!=='enabled')fail('runtime_disabled');if(typeof apiKey!=='string'||!apiKey.trim()||/[\r\n]/.test(apiKey))fail('missing_key');
 const now=Date.now(),model=catalogSnapshot?.models?.find(x=>x.id===c?.model);
 if(!p||p.authorized!==true||p.dataCollection!=='deny'||!p.allowedModels?.includes(c?.model)||!p.providers?.includes(c?.provider)||c.dataCollection!=='deny'||typeof p.requireZdr!=='boolean'||p.requireZdr&&!c.zdr||!p.residency||c.residency!==p.residency||c.privacyAttestation?.residencyEnforced!==true||!c.privacyAttestation.version||!(Date.parse(c.privacyAttestation.expiresAt)>now)||!model||model.dimensions!==dimensions||!catalogSnapshot.version||!(Date.parse(catalogSnapshot.fetchedAt)<=now&&Date.parse(catalogSnapshot.expiresAt)>now)||c.pricing?.allChargesIncluded!==true||!(Date.parse(c.pricing.validUntil)>now)||!c.pricing.version||!Number.isInteger(c.pricing.overheadTokens)||c.pricing.overheadTokens<1024||!Number.isInteger(p.timeoutMs)||p.timeoutMs<1||p.timeoutMs>15000||p.currency!=='USD'||p.exponent!==6||!p.window)fail('policy_blocked');
 if(!Array.isArray(input)||!input.length||input.length>32||input.some(x=>typeof x!=='string'||!x.length))fail('invalid_input');
 const body={model:c.model,input,dimensions,encoding_format:'float',provider:{only:[c.provider],allow_fallbacks:false,data_collection:'deny',...(p.requireZdr?{zdr:true}:{})}},serialized=JSON.stringify(body),bytes=Buffer.byteLength(serialized),tokens=bytes+c.pricing.overheadTokens;
 if(!Number.isInteger(p.maxInputBytes)||bytes>p.maxInputBytes||tokens>Math.min(model.contextTokens,c.contextTokens)||!Number.isInteger(p.maxResponseBytes)||p.maxResponseBytes<1||p.maxResponseBytes>1000000)fail('input_too_large');
 const ceiling=BigInt(tokens)*money(c.pricing.inputMicroUsdPerToken);if(ceiling<=0n||ceiling>money(p.maxCostPerCallMinor)||ceiling>money(p.maxCostPerTaskMinor))fail('budget_exceeded');
 const r=await budgetRepository.reserve({tenantId,taskKey,window:p.window,amountMinor:String(ceiling),tenantLimitMinor:p.tenantLimitMinor,currency:'USD',exponent:6,fingerprint:hash({body,policy:p,candidate:c,catalog:catalogSnapshot.version})});if(!r.acquired)fail(r.reason);
 const id=r.reservationId;await budgetRepository.recordAttempt(id,{index:0,state:'started',model:c.model,provider:c.provider,pricingVersion:c.pricing.version,ceilingMinor:String(ceiling)});
 let settled=false;try{
 const response=await transport('https://openrouter.ai/api/v1/embeddings',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:serialized,redirect:'error',signal:AbortSignal.timeout(p.timeoutMs)});
 const reader=response.body?.getReader();if(!reader)fail('invalid_output');let size=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>p.maxResponseBytes){await reader.cancel();fail('invalid_output');}parts.push(Buffer.from(value));}const data=JSON.parse(Buffer.concat(parts).toString('utf8'));
 const raw=String(data.usage?.cost??''),valid=/^\d{1,20}(\.\d{1,18})?$/.test(raw),[whole,fraction='']=raw.split('.'),cost=valid?BigInt(whole)*1000000n+BigInt((fraction+'000000').slice(0,6))+(/[1-9]/.test(fraction.slice(6))?1n:0n):null;
 const usage={};for(const key of ['prompt_tokens','total_tokens'])if(Number.isSafeInteger(data.usage?.[key])&&data.usage[key]>=0)usage[key]=data.usage[key];
 await budgetRepository.recordAttempt(id,{index:0,state:'received',httpStatus:response.status,reportedMinor:cost===null?null:String(cost),usage});
 await budgetRepository.finalize(id,{state:cost===null?'uncertain':'settled',actualMinor:cost===null?null:String(cost),reportedMinor:String(cost??0n)});settled=true;
 if(cost===null)fail('reconciliation_required');if(cost>ceiling)fail('cost_overrun');
 if(!response.ok||data.model!==c.model||!Array.isArray(data.data)||data.data.length!==input.length)fail('invalid_output');
 const vectors=[];for(let i=0;i<input.length;i++){const row=data.data.find(x=>x.index===i);if(!row||data.data.filter(x=>x.index===i).length!==1||!Array.isArray(row.embedding)||row.embedding.length!==dimensions||row.embedding.some(x=>!Number.isFinite(x))||!row.embedding.some(x=>x!==0))fail('invalid_output');vectors.push(row.embedding);}return vectors;
 }catch(e){if(!settled)await budgetRepository.finalize(id,{state:'uncertain',actualMinor:null,reportedMinor:'0'});throw e;}
 }};
}
