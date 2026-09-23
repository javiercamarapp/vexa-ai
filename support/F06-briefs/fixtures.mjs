// SYN-BRIEF291: accepted financial/detail fixture, real authorized extraction and snapshots.
import {randomUUID} from 'node:crypto';
import {seedDetail,scope,order,detailQuery,detailReport} from '../F06-detail/fixtures.mjs';
export {scope,detailQuery};export {createReader} from '../F06-recommendations/fixtures.mjs';
export const previousScope={...scope,start:'2026-08-13T00:00:00.000Z',end:'2026-09-01T00:00:00.000Z'};
export async function seedBriefs(h){
 const f=await seedDetail(h,{beforeSnapshot:async f=>{
  f.critical=await f.factory.problem(h.A,{label:'SYN battery <img src=x onerror=alert(1)>',category:'safety',severity:'high',messages:[{conversation:'SYN-BRIEF-SMOKE',message:'SYN-BRIEF-SMOKE-M',customerKey:'C1',text:'SYN La batería echó humo al cargarla; requiere revisión humana y no prueba una causa.'}]});
  await f.ledger({operation:'link',problemId:f.critical.id,ledgerRowId:f.o1.rowId,expectedVersion:0,active:true,report:detailReport,attested:true});
  f.unknown=await f.ledger(order(f.src,'SYN-BRIEF-UNKNOWN',null));
  f.previousOrder=await f.ledger(order(f.src,'SYN-BRIEF-PREVIOUS','40000',{effectiveAt:'2026-08-20T12:00:00.000Z'}));
  for(const problemId of [f.p1.id,f.p2.id,f.critical.id])await f.ledger({operation:'link',problemId,ledgerRowId:f.previousOrder.rowId,expectedVersion:0,active:true,report:detailReport,attested:true});
  for(const [row,sku] of [[f.o1,'SKU-X'],[f.o2,'SKU-Y'],[f.unknown,'SKU-Z'],[f.previousOrder,'SKU-X']])await f.ok(h.request(h.A,'/api/workspace/mappings',{ledgerRowId:row.rowId,expectedVersion:0,skus:[sku],source:'csv',active:true,report:detailReport,attested:true}));
  for(const s of [scope,previousScope]){const {dateBasis:_dateBasis,...query}=s;const view=await f.ok(h.request(h.A,'/api/economics?'+new URLSearchParams(query)));await f.ledger({operation:'relationCoverage',scope:s,expectedInputHash:view.exposure.inputHash,expectedVersion:view.exposure.coverage?.version??0,complete:true,report:detailReport,attested:true});}
  const draft=await f.ok(h.request(h.A,'/api/economic-snapshots',{operation:'stage',scope:previousScope}));f.previousSnapshot=await f.ok(h.request(h.A,'/api/economic-snapshots',{operation:'publish',snapshotId:draft.id,expectedContentHash:draft.contentHash}));
 }});
 const query=detailQuery(f.snapshot),workspace=await f.ok(h.request(h.A,'/api/workspace?'+query+'&resource=problems'));query.set('scope_hash',workspace.meta.scope_hash);
 const skuQuery=new URLSearchParams(query);skuQuery.delete('scope_hash');skuQuery.append('sku','SKU-X');const skuView=await f.ok(h.request(h.A,'/api/workspace?'+skuQuery+'&resource=problems'));skuQuery.set('scope_hash',skuView.meta.scope_hash);
 f.recommendation=await f.ok(h.request(h.A,'/api/recommendations',{operation:'generate',query:query.toString(),problemId:f.p1.id,requestKey:randomUUID()}));f.intervention=await f.ok(h.request(h.A,'/api/recommendations/'+f.recommendation.id+'/interventions',{expectedVersion:f.recommendation.version,requestKey:randomUUID()}));
 return {...f,query,skuQuery,workspace,skuView};
}
