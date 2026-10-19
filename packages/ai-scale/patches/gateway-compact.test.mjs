import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,extractionPromptHash} from './index.mjs';
import {InMemoryBudgetRepository} from './budget.mjs';
import {candidate,policy} from './gateway.test.mjs';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
const input=n=>({tenantId:'tenant-a',taskKey:'task-'+n,role:'extraction',taxonomy:['entrega','producto','indeterminable'],revisions:[{tenant_id:'tenant-a',message_revision_id:'r1',role:'customer',text:'Hola, mi taladro X20 llegó roto'},{tenant_id:'tenant-a',message_revision_id:'r2',role:'agent',text:'Lamentamos el problema'}]});
function setup(p,content){const now=Date.now();const catalog={version:'SYN',fetchedAt:new Date(now).toISOString(),expiresAt:new Date(now+3600000).toISOString(),models:['synthetic/model'].map(id=>({id,contextTokens:100000,supportedParameters:['response_format']}))};
  const repo=new InMemoryBudgetRepository({budgets:[{tenantId:'tenant-a',window:policy.window,limitMinor:'500000'}]});const calls=[];
  return{calls,gateway:createGateway({catalog,runtime:'enabled',apiKey:'k'.repeat(30),budgetRepository:repo,modelsByRole:{extraction:[candidate]},policy:p,fetch:async(u,i)=>{calls.push(JSON.parse(i.body));return response({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{cost:'0.00001',prompt_tokens:10,completion_tokens:5}});}})};}
const good={issues:[{category:'producto',severity:'medium',evidence:['r0s0']}],sentiment:'negative',intent:'complaint',urgency:'normal',entities:[{type:'product_mention',value:'taladro X20',evidence:['r0s0']}],abstention:null};
test('compacto: carga sin available_values ni quote duplicado, mismo promptHash, cita resuelta por el servidor',async()=>{
  const full=setup(policy,good),comp=setup({...policy,extractionPayload:'compact'},good);
  const a=await full.gateway.extract(input(1)),b=await comp.gateway.extract(input(2));
  assert.equal(b.ok,true);assert.equal(b.data.issues[0].evidence[0].quote,'Hola, mi taladro X20 llegó roto');assert.equal(b.data.entities[0].value,'taladro X20');
  assert.equal(b.meta.promptHash,a.meta.promptHash);assert.equal(b.meta.schemaHash,a.meta.schemaHash);
  const payload=JSON.parse(comp.calls[0].messages[1].content);assert.deepEqual(payload.revisions[0].available_evidence,['r0s0']);assert.equal(payload.revisions[0].available_values,undefined);
  assert.ok(Buffer.byteLength(comp.calls[0].messages[1].content)<Buffer.byteLength(full.calls[0].messages[1].content));
});
test('compacto: esquema constante entre conversaciones (prefijo cacheable)',async()=>{
  const comp=setup({...policy,extractionPayload:'compact'},good);await comp.gateway.extract(input(1));
  const two={...input(2),revisions:input(2).revisions.slice(0,1)};await comp.gateway.extract(two);
  assert.equal(JSON.stringify(comp.calls[0].response_format),JSON.stringify(comp.calls[1].response_format));
});
test('compacto: sigue rechazando refs inventadas, valores no literales y spans ajenos',async()=>{
  for(const bad of [{...good,issues:[{...good.issues[0],evidence:['r9s0']}]},{...good,entities:[{...good.entities[0],value:'martillo'}]},{...good,issues:[{...good.issues[0],evidence:[{message_revision_id:'foreign',start:0,end:1,quote:'x',role:'customer'}]}]}]){
    const s=setup({...policy,extractionPayload:'compact'},bad);const r=await s.gateway.extract(input(3));assert.equal(r.ok,false);assert.equal(r.error.code,'invalid_output');}
});
test('compacto + semántica no se permite',async()=>{const s=setup({...policy,extractionPayload:'compact',extractionSemantics:{}},good);const r=await s.gateway.extract(input(4));assert.equal(r.ok,false);});
