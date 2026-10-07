import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const candidate=process.env.VEXA_CANDIDATE;
assert.ok(candidate,'VEXA_CANDIDATE_REQUIRED');
const {createGateway}=await import(pathToFileURL(path.join(candidate,'packages/gateway/index.mjs')));
const {syntheticConfig}=await import(pathToFileURL(path.join(candidate,'support/F04-extraction/config-fixture.mjs')));
const current=new URL('./history-provider-preload.mjs',import.meta.url);
const previous=new URL('../../packages/history/tests/provider-preload.mjs',import.meta.url);
function fixture(file=current){
  const source=fs.readFileSync(file,'utf8'),anchor="import fs from 'node:fs';",records=[],escapes=[];
  assert.equal(source.split(anchor).length,2,'PRELOAD_IMPORT_UNIQUE');
  const context=vm.createContext({URL,Headers,Response,process:{env:{SYN_HISTORY_PROVIDER_LOG:'memory-only'}},fs:{appendFileSync:(_path,line)=>records.push(JSON.parse(line))},fetch:async input=>{escapes.push(String(input));throw Error('NO_NETWORK_IN_CALIBRATION');}});
  vm.runInContext(source.replace(anchor,''),context);
  return {transport:context.fetch,records,escapes};
}
async function extraction(file){
  const f=fixture(file),config=syntheticConfig('SYN-history-calibration');
  const budgetRepository={reserve:async()=>({acquired:true,reservationId:'SYN-memory'}),recordAttempt:async()=>{},finalize:async()=>{}};
  const gateway=createGateway({...config.gateway,apiKey:'SYN-only',runtime:'enabled',budgetRepository,fetch:f.transport});
  const result=await gateway.extract({tenantId:config.tenantId,taskKey:'SYN-history',role:'extraction',taxonomy:config.taxonomy,revisions:[{tenant_id:config.tenantId,message_revision_id:'SYN-revision',role:'customer',text:'SYN [PERSON_1] [EMAIL_1]: batería rota en pedido histórico 1000'}]});
  assert.equal(f.escapes.length,0);
  return {f,result};
}
test('old fixture reproduces EU transport failure before provider record',async()=>{
  const {f,result}=await extraction(previous);
  assert.equal(result.ok,false);assert.equal(result.error.code,'transport_error');assert.equal(f.records.length,0);
});
test('control EU fixture reaches real gateway validation with exact grounded citation',async()=>{
  const {f,result}=await extraction(current);
  assert.equal(result.ok,true);assert.equal(result.data.issues[0].evidence[0].quote,'batería rota');
  assert.match(result.data.issues[0].evidence[0].quote_hash,/^[0-9a-f]{64}$/);
  assert.equal(f.records.length,1);assert.equal(f.records[0].provider,'SYN-local-in-process-extraction');
});
test('EU embedding fixture returns bounded synthetic vectors locally',async()=>{
  const f=fixture(),response=await f.transport('https://eu.openrouter.ai/api/v1/embeddings',{method:'POST',redirect:'error',body:JSON.stringify({input:['SYN one','SYN two']})});
  const body=await response.json();assert.deepEqual(body.data,[{index:0,embedding:[1,0,0]},{index:1,embedding:[1,0,0]}]);
  assert.equal(f.records.length,1);assert.equal(f.records[0].provider,'SYN-local-in-process-embedding');assert.equal(f.escapes.length,0);
});
test('non-EU or external provider destinations remain rejected without fallback fetch',async()=>{
  const f=fixture();
  for(const url of ['https://openrouter.ai/api/v1/chat/completions','https://us.openrouter.ai/api/v1/embeddings','https://eu.openrouter.ai.attacker.invalid/api/v1/chat/completions','https://example.invalid/exfil','http://169.254.169.254/latest/meta-data/'])
    await assert.rejects(f.transport(url,{method:'POST',redirect:'error',body:'{}'}),/EXTERNAL_NETWORK_FORBIDDEN/);
  assert.equal(f.records.length,0);assert.equal(f.escapes.length,0);
});
test('EU transport rejects changed method, redirect mode, path or query',async()=>{
  const f=fixture(),base='https://eu.openrouter.ai';
  for(const [route,method,redirect] of [['/api/v1/chat/completions','GET','error'],['/api/v1/chat/completions','POST','follow'],['/other','POST','error'],['/api/v1/embeddings?target=other','POST','error']])
    await assert.rejects(f.transport(base+route,{method,redirect,body:'{}'}),/SYN_PROVIDER_ROUTE_REQUIRED/);
  assert.equal(f.records.length,0);assert.equal(f.escapes.length,0);
});
test('raw PII stays forbidden even at the correct EU endpoint',async()=>{
  const f=fixture(),body={messages:[{role:'user',content:JSON.stringify({revisions:[{text:'Ana Pérez ana@example.test: batería rota',message_revision_id:'SYN'}]})}]};
  await assert.rejects(f.transport('https://eu.openrouter.ai/api/v1/chat/completions',{method:'POST',redirect:'error',body:JSON.stringify(body)}),/RAW_PII_REACHED_SYN_PROVIDER/);
  assert.equal(f.records.length,0);assert.equal(f.escapes.length,0);
});
