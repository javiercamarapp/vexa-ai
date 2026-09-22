import {adaptLedger} from '../economics/adapter.mjs';
import {separateComponents} from '../metrics/components.mjs';
import {canonical,hash,check} from './contracts.mjs';
const uniq=x=>[...new Set(x)].sort(),iso=x=>new Date(x).toISOString();
export const detailId=value=>{const h=hash(value);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
export const financialEvent=r=>({id:r.id,entityId:r.entity_id,externalId:r.external_id,kind:r.kind,amount_minor:r.amount_minor===null?null:String(r.amount_minor),currency:r.currency,exponent:r.exponent,status:r.status,effectiveAt:iso(r.effective_at),orderId:r.order_id,reversalOf:r.reversal_of});
const raw=r=>({...financialEvent(r),id:r.entity_id,rowId:r.id,revision:r.revision,sourceId:r.source_id,externalId:r.external_id,amountMinor:r.amount_minor===null?null:String(r.amount_minor),effectiveAt:iso(r.effective_at),recordedAt:iso(r.recorded_at),basis:r.basis,details:r.details});
export function projectDetailGraph({tenantId,snapshot,binding,rows,identityLinks,rootKind,rootId}){
 const scope=snapshot.scope,asOf=snapshot.asOf,filters=binding.filters;
 const sources=rows.economic_source_versions.map(r=>({id:r.source_id,active:r.active,actorActive:true,evidenceType:r.evidence_type,complete:r.complete,windowStart:iso(r.window_start),windowEnd:iso(r.window_end),watermark:iso(r.watermark)}));
 const usable=new Set(sources.filter(s=>s.active).map(s=>s.id)),entries=rows.economic_ledger_entries.filter(r=>usable.has(r.source_id)),byId=new Map(entries.map(r=>[r.entity_id,r]));
 const aliases=new Map();let identityUnknown=false;for(const a of rows.economic_order_aliases.filter(a=>a.active)){const from=byId.get(a.alias_entity_id),to=byId.get(a.canonical_entity_id);if(!from||!to||from.id!==a.alias_row_id||to.id!==a.canonical_row_id||['currency','exponent','basis','amount_minor','status'].some(k=>String(from[k])!==String(to[k]))||iso(from.effective_at)!==iso(to.effective_at)){identityUnknown=true;continue;}aliases.set(a.alias_entity_id,a.canonical_entity_id);}
 const canonicalId=id=>{const seen=new Set();while(aliases.has(id)){check(!seen.has(id),'captured_alias_cycle',409);seen.add(id);id=aliases.get(id);}return id;};
 const allOrders=new Map();for(const e of entries.filter(e=>e.kind==='order')){const id=canonicalId(e.entity_id);if(byId.has(id))allOrders.set(id,byId.get(id));}
 const inWindow=r=>r.currency===scope.currency&&r.exponent===scope.exponent&&r.basis===scope.basis&&iso(r.effective_at)>=scope.start&&iso(r.effective_at)<scope.end&&iso(r.recorded_at)<=asOf&&!['pending','cancelled'].includes(r.status);
 const mappings=new Map(rows.dimensionMappings.map(r=>[r.ledger_row_id,r]));
 const dimensionState=r=>{const equivalents=entries.filter(e=>e.kind==='order'&&canonicalId(e.entity_id)===r.entity_id),declared=equivalents.map(e=>mappings.get(e.id)).filter(m=>m?.active);const sku=declared.filter(m=>m.skus!==null).map(m=>uniq(m.skus)),source=uniq(declared.map(m=>m.source).filter(x=>x!==null));const sk=sku.length&&new Set(sku.map(canonical)).size===1,so=source.length===1;const a=!filters.sku.length?true:sk?filters.sku.some(x=>sku[0].includes(x)):null,b=!filters.source.length?true:so?filters.source.includes(source[0]):null;return a===false||b===false?'excluded':a===null||b===null?'unknown':'included';};
 const customerKeys=new Map();for(const c of rows.economic_order_customers){if(c.customer_key===null)continue;const id=canonicalId(c.entity_id),keys=customerKeys.get(id)??new Set();keys.add(c.customer_key);customerKeys.set(id,keys);}
 const keyFor=id=>{const set=customerKeys.get(id);return set?.size===1?[...set][0]:null;};
 const identities=new Map(identityLinks.map(i=>[i.customer_key,i.customer_id]));
 const memberOrders=new Set(snapshot.exposure.membership.filter(l=>rootKind==='customer'||l.problemId===rootId).map(l=>l.orderId));
 const belongs=r=>rootKind==='problem'?memberOrders.has(r.entity_id):identities.get(keyFor(r.entity_id))===rootId;
 const eligible=[...allOrders.values()].filter(inWindow),rootOrders=eligible.filter(belongs),knownOrders=rootOrders.filter(r=>dimensionState(r)==='included'),unknownOrders=rootOrders.filter(r=>dimensionState(r)==='unknown');
 const selected=new Set(knownOrders.map(r=>r.entity_id)),unknown=new Set(unknownOrders.map(r=>r.entity_id));
 const baseRow=r=>({id:r.entity_id,tenantId,sourceAccount:r.source_id,externalId:r.external_id,sourceRevision:String(r.revision),occurredAt:iso(r.effective_at),recordedAt:iso(r.recorded_at),currency:r.currency,exponent:r.exponent,basis:r.basis,amountMinor:r.amount_minor===null?null:String(r.amount_minor),status:r.status,provenance:'approved_manual',evidenceRef:r.id});
 const family=type=>sources.filter(s=>s.evidenceType===type&&s.active).map(s=>({sourceAccount:s.id,watermark:s.watermark,complete:s.complete&&s.windowStart<=scope.start&&s.windowEnd>=scope.end&&s.watermark>=scope.end}));
 const links=snapshot.exposure.membership.filter(l=>selected.has(l.orderId)&&(rootKind==='customer'||l.problemId===rootId)).map(l=>({tenantId,problemId:l.problemId,orderId:l.orderId,evidenceRef:'snapshot:'+snapshot.id,relationVersion:'captured'}));
 const input={authorization:{tenantId,permissionsVersion:'captured'},snapshot:{tenantId,id:snapshot.id,asOf,sources:family('order_export')},scope,orders:knownOrders.map(baseRow),events:[],links};const economic=adaptLedger(input);
 const eventOrder=r=>{const seen=new Set();while(r&&!r.order_id&&r.kind==='reversal'&&r.reversal_of){if(seen.has(r.entity_id))return null;seen.add(r.entity_id);r=byId.get(r.reversal_of);}return r?.order_id?canonicalId(r.order_id):null;};
 const direct=new Set(rootKind==='problem'?rows.economic_problem_links.filter(l=>l.active&&l.problem_id===rootId).map(l=>l.entity_id):[]);
 const accepted=[],unallocated=[];for(const r of entries.filter(r=>r.kind!=='order'&&inWindow(r))){const order=eventOrder(r),directlyRelated=direct.has(r.entity_id)||r.kind==='reversal'&&direct.has(r.reversal_of);if(selected.has(order)||rootKind==='problem'&&directlyRelated&&!order&&!filters.sku.length&&!filters.source.length)accepted.push(r);else if(unknown.has(order)||rootKind==='problem'&&directlyRelated&&!order){unallocated.push(r);}else if(rootKind==='problem'&&directlyRelated&&allOrders.has(order)&&dimensionState(allOrders.get(order))==='included')accepted.push(r);}
 // Reversals carry their immutable original event in the drilldown, even when its date differs.
 const allEventIds=new Set(accepted.map(r=>r.entity_id));let changed=true;while(changed){changed=false;for(const r of entries.filter(r=>r.kind==='reversal')){if(allEventIds.has(r.entity_id)&&r.reversal_of&&!allEventIds.has(r.reversal_of)){allEventIds.add(r.reversal_of);changed=true;}if(allEventIds.has(r.reversal_of)&&inWindow(r)&&!allEventIds.has(r.entity_id)){allEventIds.add(r.entity_id);changed=true;}}}
 const events=entries.filter(r=>allEventIds.has(r.entity_id));
 const refundRows=events.filter(r=>['refund','reversal'].includes(r.kind));const refunds=adaptLedger({...input,snapshot:{...input.snapshot,sources:family('payment_ledger')},orders:[],links:[],events:refundRows.map(r=>({...baseRow(r),kind:r.kind,reversalOf:r.reversal_of}))}).metrics.refunds;
 if(!family('payment_ledger').length)refunds.knownSubtotalMinor=null;if(!family('order_export').length){economic.metrics.allOrders.knownSubtotalMinor=null;economic.metrics.exposure.global.knownSubtotalMinor=null;}
 const parts=separateComponents({entries:events.map(raw),sources,scope,asOf});
 const covered=rows.economic_relation_coverage.some(r=>r.complete&&r.input_hash===rows.exposureInputHash&&canonical(r.scope)===canonical(scope));
 const gate=(m,reason,hide=false)=>{m.amountMinor=null;if(hide)m.knownSubtotalMinor=null;m.status=m.knownSubtotalMinor===null?'unavailable':'partial';m.missingReasons=uniq([...(m.missingReasons??[]),reason]);};
 const metrics={exposure:economic.metrics.exposure.global,allOrders:economic.metrics.allOrders,refunds,replacement:parts.replacement,supportModel:parts.supportModel};
 if(!covered&&rootKind==='problem')for(const m of Object.values(metrics))gate(m,'relation_coverage_unconfirmed');
 for(const [key,m] of Object.entries(metrics)){if(unknownOrders.length||unallocated.some(e=>key==='refunds'?['refund','reversal'].includes(e.kind):key==='replacement'?e.kind==='replacement':key==='supportModel'?e.kind==='support_model':false))gate(m,'DIMENSION_MEMBERSHIP_UNKNOWN');if(identityUnknown)gate(m,'alias_identity_unavailable_or_conflicting',true);}
 const eventRows={exposure:knownOrders.filter(r=>memberOrders.has(r.entity_id)),allOrders:knownOrders,refunds:refundRows,replacement:events.filter(r=>r.kind==='replacement'),supportModel:events.filter(r=>r.kind==='support_model')};
 return {metrics,eventRows,orders:knownOrders,unknownOrders,unallocated,customerKeys:uniq(knownOrders.map(r=>keyFor(r.entity_id)).filter(Boolean)),customerKeyForOrder:keyFor,canonicalId,identityUnknown};
}
