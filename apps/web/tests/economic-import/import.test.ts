import test from 'node:test';
import assert from 'node:assert/strict';
import {parseImport,validateImport,summarizeImport,entryIdentity,MAX_BYTES,type EconomicImport,type ImportEntry} from '../../src/lib/economic-import/contract';
import {runEconomicImport,type ImportProgress} from '../../src/lib/economic-import/runner';
import {constrainEconomicTenant} from '../../src/lib/economic-import/tenant-guard';
import type {DatabaseAction,DatabaseScope} from '@vexa/platform/db';
const tenant='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999',orders='22222222-2222-4222-8222-222222222222',refunds='33333333-3333-4333-8333-333333333333';
const report='SYN evidence reviewed by the authorized owner.';
function fixture():EconomicImport{return {schema:'rovaq-economic-import-v1',tenantId:tenant,scope:{start:'2026-08-01T00:00:00.000Z',end:'2026-09-01T00:00:00.000Z',timezone:'UTC',dateBasis:'occurred_at',currency:'USD',exponent:2,basis:'gross_order_including_tax_shipping'},currencyConfiguration:{currency:'USD',exponent:2,expectedVersion:0,active:true,source:'SYN currency catalog',reference:'SYN catalog v1',date:'2026-08-01',report},sources:[{sourceId:orders,expectedVersion:0,name:'SYN orders',evidenceType:'order_export',active:true,complete:false,windowStart:'2026-08-01T00:00:00.000Z',windowEnd:'2026-09-01T00:00:00.000Z',watermark:'2026-09-02T00:00:00.753Z',report},{sourceId:refunds,expectedVersion:0,name:'SYN payments',evidenceType:'payment_ledger',active:true,complete:false,windowStart:'2026-08-01T00:00:00.000Z',windowEnd:'2026-09-01T00:00:00.000Z',watermark:'2026-09-02T00:00:00.753Z',report}],entries:[{sourceId:orders,sourceVersion:1,expectedRevision:0,externalId:'SYN-order-1',kind:'order',effectiveAt:'2026-08-02T00:00:00.000Z',currency:'USD',exponent:2,basis:'gross_order_including_tax_shipping',amountMinor:'19999',status:'recorded',orderId:null,reversalOf:null,details:{},report},{sourceId:refunds,sourceVersion:1,expectedRevision:0,externalId:'SYN-refund-1',kind:'refund',effectiveAt:'2026-08-03T00:00:00.000Z',currency:'USD',exponent:2,basis:'gross_order_including_tax_shipping',amountMinor:null,status:'unknown',orderId:null,reversalOf:null,details:{},report}]};}
type Row=Record<string,unknown>;
function ledger(){
 const currencies:Row[]=[],sources:Row[]=[],entries:Row[]=[],posts:Row[]=[];let reads=0;
 const state={tenant,currencies,sources,entries,posts,failRead:0,ambiguousRecord:false,failPost:0,onPost:undefined as undefined|(()=>void)};
 const fetcher:typeof fetch=async(input,init)=>{const url=String(input);if(init?.method==='POST'){
  assert.equal(url,'/api/economics');assert.equal((init.headers as Record<string,string>)['X-Economic-Import-Tenant'],tenant);
  const body=JSON.parse(String(init.body));posts.push(body);assert.equal(body.attested,true);assert.ok(['currency','source','record'].includes(body.operation));
  if(state.failPost)return Response.json({error:{}},{status:state.failPost});
  let row:Row;
  if(body.operation==='currency'){row={...body,id:'SYN-currency',version:1,valid:true};currencies.push(row);}
  else if(body.operation==='source'){row={...body,id:body.sourceId,version:1};sources.push(row);}
  else{row={...body,id:await entryIdentity(tenant,body as ImportEntry),revision:1};entries.push(row);if(state.ambiguousRecord){state.ambiguousRecord=false;throw new TypeError('SYN response lost after commit');}}
  state.onPost?.();return Response.json({data:row});
 }
 reads++;if(reads===state.failRead)throw new TypeError('SYN GET unavailable');return Response.json({data:{bundle:{tenantId:state.tenant},canWrite:true,sources,entries,monetary:{currencyVersions:currencies}}});};
 return {state,fetcher,get reads(){return reads;}};
}
async function run(doc:EconomicImport,store=ledger(),controller=new AbortController()){const progress:ImportProgress[]=[];const result=await runEconomicImport(doc,tenant,{fetch:store.fetcher,signal:controller.signal,onProgress:p=>progress.push(p)});return {result,progress,store};}

test('validates SYN contract including millisecond watermark and exact integer subtotals',()=>{const d=parseImport(JSON.stringify(fixture()),tenant);assert.equal(summarizeImport(d).orderKnownMinor,'19999');assert.equal(summarizeImport(d).refundKnownMinor,'0');assert.equal(summarizeImport(d).unknownAmounts,1);assert.equal(d.sources[0].watermark.endsWith('.753Z'),true);});
for(const [name,mutate] of [
 ['tenant mismatch',(d:EconomicImport)=>{d.tenantId=other;}],
 ['duplicate source',(d:EconomicImport)=>{d.sources.push(d.sources[0]);}],
 ['duplicate entry',(d:EconomicImport)=>{d.entries.push(d.entries[0]);}],
 ['decimal money',(d:EconomicImport)=>{d.entries[0].amountMinor='1.25';}],
 ['negative refund',(d:EconomicImport)=>{d.entries[1].amountMinor='-1';}],
 ['record outside window',(d:EconomicImport)=>{d.entries[0].effectiveAt=d.scope.end;}],
 ['invalid Gregorian date',(d:EconomicImport)=>{d.entries[0].effectiveAt='2026-08-32T00:00:00.000Z';}],
 ['unsupported reversal',(d:EconomicImport)=>{Object.assign(d.entries[0],{kind:'reversal'});}],
 ['supplied approval',(d:EconomicImport)=>{Object.assign(d.sources[0],{attested:true});}],
 ['unknown field',(d:EconomicImport)=>{Object.assign(d.entries[0],{tenantId:tenant});}],
 ['wrong source type',(d:EconomicImport)=>{d.entries[1].sourceId=orders;}],
 ['source version mismatch',(d:EconomicImport)=>{d.entries[0].sourceVersion=2;}],
 ['complete source with covering watermark',(d:EconomicImport)=>{d.sources[0].complete=true;}],
 ['source later version with matching entries',(d:EconomicImport)=>{d.sources[0].expectedVersion=1;d.entries[0].sourceVersion=2;}],
 ['currency later version',(d:EconomicImport)=>{d.currencyConfiguration.expectedVersion=1;}],
 ['incomplete coverage claimed',(d:EconomicImport)=>{d.sources[0].complete=true;d.sources[0].watermark=d.scope.start;}],
 ['models are forbidden',(d:EconomicImport)=>{d.entries[0].details={predicted:true};}],
] as const)test('prevalidation prevents every request: '+name,async()=>{const d=fixture();mutate(d);const {result,store}=await run(d);assert.notEqual(result.phase,'complete');assert.equal(store.state.posts.length,0);assert.equal(store.reads,0);});
test('rejects full-file and count limits before network',async()=>{assert.throws(()=>parseImport(' '.repeat(MAX_BYTES+1),tenant),/8 MiB/);const d=fixture();d.entries=Array.from({length:2001},(_,i)=>({...d.entries[0],externalId:'SYN-'+i}));assert.throws(()=>validateImport(d,tenant),/2000/);d.entries=fixture().entries;d.sources=Array.from({length:21},()=>d.sources[0]);assert.throws(()=>validateImport(d,tenant),/20 fuentes/);});
test('writes sequential currency/source/orders/refunds then verifies complete and replay sends nothing',async()=>{const d=fixture();d.entries[1].orderId=await entryIdentity(tenant,d.entries[0]);d.entries.reverse();const {result,store}=await run(d);assert.equal(result.phase,'complete');assert.equal(result.verifiedEntries,2);assert.deepEqual(store.state.posts.map(p=>p.operation),['currency','source','source','record','record']);assert.equal(store.state.posts[3].kind,'order');const count=store.state.posts.length;const repeat=await run(d,store);assert.equal(repeat.result.phase,'complete');assert.equal(store.state.posts.length,count);});
test('loss after committed POST stops; resume GET detects exact entry and never resends it',async()=>{const store=ledger();store.state.ambiguousRecord=true;const a=await run(fixture(),store);assert.equal(a.result.phase,'error');assert.equal(store.state.entries.length,1);const b=await run(fixture(),store);assert.equal(b.result.phase,'complete');assert.equal(store.state.posts.filter(x=>x.externalId==='SYN-order-1').length,1);assert.equal(store.reads,3);});
test('cancellation after one operation stops immediately; reselecting same file reconciles',async()=>{const store=ledger(),controller=new AbortController();store.state.onPost=()=>controller.abort();const a=await run(fixture(),store,controller);assert.equal(a.result.phase,'paused');assert.equal(store.state.posts.length,1);store.state.onPost=undefined;const b=await run(fixture(),store);assert.equal(b.result.phase,'complete');assert.equal(store.state.posts.filter(x=>x.operation==='currency').length,1);});
test('failed initial GET cannot be interpreted as empty',async()=>{const store=ledger();store.state.failRead=1;const {result}=await run(fixture(),store);assert.equal(result.phase,'error');assert.equal(store.state.posts.length,0);});
test('failed final GET leaves unverified partial result, resume reads before any new POST',async()=>{const store=ledger();store.state.failRead=2;const {result}=await run(fixture(),store);assert.equal(result.phase,'error');assert.equal(result.verifiedEntries,0);assert.equal(result.acknowledgedEntries,2);const count=store.state.posts.length;const b=await run(fixture(),store);assert.equal(b.result.phase,'complete');assert.equal(store.state.posts.length,count);});
for(const status of [401,403])test('authorization '+status+' clears progress and stops further writes',async()=>{const store=ledger();store.state.failPost=status;const {result}=await run(fixture(),store);assert.equal(result.phase,'unauthorized');assert.equal(result.totalEntries,0);assert.equal(store.state.posts.length,1);});
test('preflight checks ALL existing conflicts before even writing missing currency',async()=>{const store=ledger();store.state.sources.push({...fixture().sources[1],id:refunds,version:1,report:'SYN conflicting reviewed report'});const {result}=await run(fixture(),store);assert.equal(result.phase,'error');assert.equal(store.state.posts.length,0);});
test('metadata mismatch on resume never versions or overwrites existing currency/source/entry',async()=>{const store=ledger();await run(fixture(),store);const count=store.state.posts.length;store.state.entries[0].amountMinor='20000';const {result}=await run(fixture(),store);assert.equal(result.phase,'error');assert.equal(store.state.posts.length,count);});
test('dangling refund order is rejected before any POST',async()=>{const d=fixture();d.entries[1].orderId=other;const {result,store}=await run(d);assert.equal(result.phase,'error');assert.equal(store.state.posts.length,0);});
test('GET tenant changed stops without writing',async()=>{const store=ledger();store.state.tenant=other;const {result}=await run(fixture(),store);assert.equal(result.phase,'unauthorized');assert.equal(store.state.posts.length,0);});
test('tenant constraint checks actual authorized transaction scope before repository work',async()=>{
 let writes=0,seen:DatabaseAction|undefined;const scope:DatabaseScope={tenantId:other,userId:'SYN-owner',role:'owner',permissionsVersion:1,async query(){writes++;return {rows:[],rowCount:0};}};
 const database={async transaction<T>(action:DatabaseAction,work:(s:DatabaseScope)=>Promise<T>):Promise<T>{seen=action;return work(scope);}};
 await assert.rejects(constrainEconomicTenant(database,tenant).transaction('configure',async s=>s.query('SYN write')),error=>!!error&&typeof error==='object'&&'status' in error&&error.status===409);assert.equal(writes,0);assert.equal(seen,'configure');
 await constrainEconomicTenant(database,other).transaction('configure',async s=>s.query('SYN write'));assert.equal(writes,1);assert.equal(constrainEconomicTenant(database,null),database);assert.throws(()=>constrainEconomicTenant(database,'bad'));
});
