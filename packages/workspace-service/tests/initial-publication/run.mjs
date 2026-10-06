import test from 'node:test';
import assert from 'node:assert/strict';
import {initialOverviewScope} from '../../initial-publication.mjs';
import {createWorkspaceService} from '../../index.mjs';
import {parseWorkspaceQuery} from '../../contracts.mjs';
import {publicationQuery,pinWorkspaceQuery,latestWorkspaceQuery,snapshotOverviewUrl} from '../../navigation.mjs';
import {buildCfoModel,kpiHeadline} from '../../../../apps/web/src/components/workspace/cfo-model.mjs';
const tenant='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',id='20000000-0000-4000-8000-000000000001',older='20000000-0000-4000-8000-000000000002';
const scope={start:'2026-08-01T00:00:00.000Z',end:'2026-10-06T00:00:00.000Z',timezone:'UTC',dateBasis:'occurred_at',currency:'USD',exponent:2,basis:'gross_order_including_tax_shipping'};
const snapshot=(patch={})=>({id,tenant_id:tenant,status:'published',economic_schema_version:'economic-snapshot-v1',published_at:'2026-10-06T12:00:00.000Z',as_of:'2026-10-06T11:00:00.000Z',created_by:'SYN-owner',published_by:'SYN-owner',scope_hash:'a'.repeat(64),input_hash:'b'.repeat(64),content_hash:'c'.repeat(64),policy_version:'SYN-policy',component_count:0,input_manifest:{refs:[],models:[],watermarks:[]},provenance:{scope,exposure:{membership:[]}},...patch});
function authorizedScope(records=[snapshot()],options={}){
 const calls=[];
 return {tenantId:tenant,userId:'SYN-owner',role:'owner',calls,async query(sql,args){
  calls.push({sql,args});assert.equal(args[0],tenant,'all repository reads bind authorized tenant');
  if(options.fail)throw Error('SYN database unavailable');
  if(sql.startsWith('SELECT id FROM public.metric_snapshots')){
   assert.match(sql,/tenant_id=\$1 AND status='published' AND economic_schema_version='economic-snapshot-v1' ORDER BY published_at DESC,id DESC LIMIT 1$/);
   return {rows:records.filter(r=>r.tenant_id===args[0]&&r.status==='published'&&r.economic_schema_version==='economic-snapshot-v1').sort((a,b)=>b.published_at.localeCompare(a.published_at)||b.id.localeCompare(a.id)).slice(0,1).map(r=>({id:r.id}))};
  }
  if(sql.startsWith('SELECT * FROM public.metric_snapshots'))return {rows:records.filter(r=>r.tenant_id===args[0]&&r.id===args[1]&&r.economic_schema_version===args[2])};
  if(sql.includes('economic_contributor_active'))return {rows:options.denied?[]:[{ok:1}]};
  if(sql.startsWith('SELECT * FROM public.components'))return {rows:[]};
  if(sql.includes('economic_snapshot_digest'))return {rows:[{hash:options.corrupt?'d'.repeat(64):'c'.repeat(64)}]};
  throw Error('Unexpected SYN SQL: '+sql);
 }};
}
test('bare overview adopts exact latest tenant publication only after existing repository authorization',async()=>{
 const db=authorizedScope([snapshot({id:older,published_at:'2026-10-05T12:00:00.000Z'}),snapshot(),snapshot({id:'30000000-0000-4000-8000-000000000001',tenant_id:other,published_at:'2026-10-07T12:00:00.000Z'})]);
 const result=await initialOverviewScope(db,new URLSearchParams('resource=metrics'));
 assert.deepEqual(result,parseWorkspaceQuery(publicationQuery({id,scope})).scope);
 assert.ok(db.calls.some(c=>c.sql.includes('economic_contributor_active')));
 assert.ok(db.calls.some(c=>c.sql.includes('economic_snapshot_digest')));
 assert.equal(result.snapshot_id,id);assert.equal(result.exponent,2);assert.equal(result.basis,scope.basis);
});
test('empty URL and equal publication timestamps use latest deterministic id',async()=>{const db=authorizedScope([snapshot(),snapshot({id:older})]);assert.equal((await initialOverviewScope(db,new URLSearchParams())).snapshot_id,older);});
for(const explicit of ['date_start=2026-09-01','date_end=2026-10-01','timezone=UTC','date_basis=occurred_at','currency=USD','exponent=2','basis=net','sku=SYN-SKU','source=csv','snapshot_id='+id,'scope_hash='+'a'.repeat(64),'cursor=SYN-cursor','limit=10','format=json','resource=problems'])test('explicit query is never reinterpreted: '+explicit,async()=>{const db=authorizedScope();assert.equal(await initialOverviewScope(db,new URLSearchParams(explicit)),null);assert.equal(db.calls.length,0);});
test('already parsed scope is not treated as an unfiltered overview',async()=>{const db=authorizedScope();assert.equal(await initialOverviewScope(db,parseWorkspaceQuery(new URLSearchParams())),null);assert.equal(db.calls.length,0);});
test('other tenant, draft and unsupported schema do not become fallback publications',async()=>{const db=authorizedScope([snapshot({tenant_id:other}),snapshot({status:'draft'}),snapshot({economic_schema_version:'SYN-other'})]);assert.equal(await initialOverviewScope(db,new URLSearchParams()),null);assert.equal(db.calls.length,1);});
test('inaccessible latest fails closed without searching previous publication',async()=>{const db=authorizedScope([snapshot(),snapshot({id:older,published_at:'2026-10-05T00:00:00.000Z'})],{denied:true});await assert.rejects(initialOverviewScope(db,new URLSearchParams()),e=>e.status===403);assert.equal(db.calls.filter(c=>c.sql.startsWith('SELECT id')).length,1);});
test('integrity and database failures never turn into empty scope',async()=>{await assert.rejects(initialOverviewScope(authorizedScope(undefined,{corrupt:true}),new URLSearchParams()),/snapshot_integrity_failed/);await assert.rejects(initialOverviewScope(authorizedScope(undefined,{fail:true}),new URLSearchParams()),/SYN database unavailable/);});
test('unrepresentable timestamp rejects rather than silently truncating published scope',async()=>{const s={...scope,start:'2026-08-01T12:00:00.000Z'};assert.equal(snapshotOverviewUrl({id,scope:s}),null);await assert.rejects(initialOverviewScope(authorizedScope([snapshot({provenance:{scope:s,exposure:{membership:[]}}})]),new URLSearchParams()),/snapshot_scope_unrepresentable/);});
test('organization change between preparation and final authorized read fails closed',async()=>{let reads=0;const db={async transaction(action,work){assert.equal(action,'read');reads++;return work({tenantId:reads===1?tenant:other,role:'owner',async query(){return {rows:[]};}});}};await assert.rejects(createWorkspaceService({database:db}).query(new URLSearchParams('resource=metrics')),e=>e.status===403&&e.code==='tenant_changed');assert.equal(reads,2);});
test('no publications retains existing empty result and defaults',async()=>{const db={async transaction(action,work){assert.equal(action,'read');return work({tenantId:tenant,role:'owner',async query(){return {rows:[]};}});}};const result=await createWorkspaceService({database:db}).query(new URLSearchParams('resource=metrics'));assert.equal(result.meta.state,'empty');assert.equal(result.meta.snapshot_id,null);assert.equal(result.meta.scope.basis,'net');});
const resolved=()=>({snapshot_id:id,scope_hash:'e'.repeat(64),scope:{...parseWorkspaceQuery(publicationQuery({id,scope})).scope,date_start:scope.start,date_end:scope.end}});
test('initial URL pin contains every exact filter and survives reload and export query parsing',()=>{const pinned=pinWorkspaceQuery('',resolved());const parsed=parseWorkspaceQuery(pinned);assert.equal(parsed.scope.snapshot_id,id);assert.equal(parsed.scope.scope_hash,'e'.repeat(64));assert.equal(parsed.scope.date_start,'2026-08-01');assert.equal(parsed.scope.date_end,'2026-10-06');assert.equal(parsed.scope.basis,scope.basis);assert.equal(parsed.scope.currency,'USD');assert.equal(parsed.scope.exponent,2);assert.equal(parsed.scope.timezone,'UTC');assert.equal(parsed.scope.date_basis,'occurred_at');assert.deepEqual([...pinWorkspaceQuery(pinned,resolved())],[...pinned]);});
test('pinning preserves every explicit filter, cursor and identities',()=>{const original=new URLSearchParams('date_start=2026-09-01&date_end=2026-10-01&currency=MXN&exponent=2&basis=net&timezone=UTC&date_basis=occurred_at&sku=SYN-A&sku=SYN-B&source=csv&snapshot_id='+older+'&scope_hash='+'f'.repeat(64)+'&cursor=SYN-cursor&limit=10');const pinned=pinWorkspaceQuery(original,resolved());assert.deepEqual([...pinned],[...original]);assert.deepEqual([...original],[...pinned]);});
test('latest button removes only publication identity and cursor, preserving explicit scope and dimensions',()=>{const pinned=pinWorkspaceQuery('sku=SYN-A&source=csv&cursor=SYN-cursor&limit=10',resolved());const latest=latestWorkspaceQuery(pinned);for(const key of ['snapshot_id','scope_hash','cursor'])assert.equal(latest.has(key),false);for(const key of ['date_start','date_end','currency','basis','exponent','timezone','date_basis','sku','source','limit'])assert.deepEqual(latest.getAll(key),pinned.getAll(key));assert.equal(pinned.has('snapshot_id'),true);});
test('snapshot publication link pins full base scope without confusing base and derived hashes',()=>{const link=snapshotOverviewUrl({id,scope,scopeHash:'a'.repeat(64)}),url=new URL(link,'https://syn.invalid');assert.equal(url.pathname,'/overview');assert.deepEqual([...url.searchParams],[...publicationQuery({id,scope})]);assert.equal(url.searchParams.has('scope_hash'),false);});
const row=(patch={})=>buildCfoModel([{id:'SYN',title:'SYN metric',version:1,metrics:[{label:'SYN orders',kind:'allOrders',amount_minor:null,known_subtotal:'12345',currency:'USD',exponent:2,coverage:{known_n:3,eligible_n:5},...patch}]}]);
test('documented subtotal becomes headline while total and comparison bars remain unavailable',()=>{const model=row(),headline=kpiHeadline(model.rows[0]);assert.equal(headline.label,'Subtotal documentado');assert.equal(headline.value,model.rows[0].subtotal);assert.equal(headline.note,'Total desconocido · Cobertura parcial');assert.equal(model.rows[0].amount,null);assert.equal(model.rows[0].display,'No disponible');assert.equal(model.bars[0].bps,null);assert.equal(model.maximum,null);});
for(const patch of [{known_subtotal:'0',coverage:{known_n:0,eligible_n:0}},{coverage:{known_n:0,eligible_n:5}},{coverage:undefined},{coverage:{known_n:5,eligible_n:3}},{known_subtotal:'1.25'},{currency:'bad'}])test('unknown/unverified subtotal cannot become headline: '+JSON.stringify(patch),()=>{assert.equal(kpiHeadline(row(patch).rows[0]).label,null);});
test('known zero with positive evidence is a documented subtotal, not an inferred 0/0',()=>{assert.equal(kpiHeadline(row({known_subtotal:'0',coverage:{known_n:1,eligible_n:1}}).rows[0]).label,'Subtotal documentado');});
test('published known total remains the headline',()=>{const model=row({amount_minor:'99999'});assert.equal(kpiHeadline(model.rows[0]).value,model.rows[0].display);assert.equal(kpiHeadline(model.rows[0]).label,null);assert.equal(model.bars[0].bps,10000);});

test('empty snapshot and scope identity values normalize to absent before pinning and reload',()=>{
 for(const raw of ['snapshot_id=','scope_hash=','snapshot_id=&scope_hash=','snapshot_id='+id+'&scope_hash=']){
  const pinned=pinWorkspaceQuery(raw,resolved());
  const reloaded=parseWorkspaceQuery(pinned);
  assert.equal(reloaded.scope.snapshot_id,id);
  assert.equal(reloaded.scope.scope_hash,'e'.repeat(64));
  assert.equal(reloaded.scope.date_start,'2026-08-01');
  assert.equal(reloaded.scope.basis,scope.basis);
  assert.deepEqual([...pinWorkspaceQuery(pinned,resolved())],[...pinned]);
 }
 const noSnapshot=pinWorkspaceQuery('snapshot_id=&scope_hash=&currency=USD',{...resolved(),snapshot_id:null,scope_hash:null});
 assert.equal(noSnapshot.has('snapshot_id'),false);assert.equal(noSnapshot.has('scope_hash'),false);assert.equal(noSnapshot.get('currency'),'USD');
});
