import {closed,isHash,unavailable,receiptValid} from './normalize.mjs';
const reasons=['transport','timeout','response_limit','parse','observation_invalid','model_unavailable','endpoint_unavailable','zdr_unavailable','capabilities_incompatible','pricing_incompatible','snapshot_invalid'];
export function createMetadataRepository({database,clock=Date.now}){
 const tx=async(action,input,work,scope)=>{const run=async s=>{if(s.tenantId!==input.tenantId)unavailable();await s.query("SELECT set_config('statement_timeout',least(5000,coalesce(nullif((SELECT setting::bigint FROM pg_settings WHERE name='statement_timeout'),0),5000))::text,true),set_config('transaction_timeout',least(5000,coalesce(nullif((SELECT setting::bigint FROM pg_settings WHERE name='transaction_timeout'),0),5000))::text,true)");return work(s);};return scope?run(scope):database.transaction(action,run);};
 const rpc=async(name,input,action,scope)=>tx(action,input,async s=>{if(!isHash(input.templateHash))unavailable();const value=(await s.query('SELECT public.extraction_metadata_'+name+'($1::jsonb) AS value',[JSON.stringify(input)])).rows[0]?.value;if(Buffer.byteLength(JSON.stringify(value??null))>131072)unavailable();return value;},scope);
 return Object.freeze({
 configure:input=>rpc('configure',input,'configure'),claim:input=>rpc('claim',input,'materialize'),
 publish:input=>{if(!input.batch||Buffer.byteLength(JSON.stringify(input.batch))>98304||Date.parse(input.batch.expiresAt)<=clock())unavailable();return rpc('publish',input,'materialize');},
 fail:input=>{const f=input.failure;if(!closed(f,['kind','reasonCode','receipts'])||!['incomplete','blocked'].includes(f.kind)||!reasons.includes(f.reasonCode)||!Array.isArray(f.receipts)||f.receipts.length>4||!f.receipts.every(receiptValid)||Buffer.byteLength(JSON.stringify(f.receipts))>8192||f.kind==='blocked'&&f.receipts.length!==4)unavailable();return rpc('fail',input,'materialize');},
 read:(input,scope)=>rpc('read',{...input,configHash:input.configHash??null},'read',scope),admit:(input,scope)=>rpc('admit',input,'read',scope)
 });
}
