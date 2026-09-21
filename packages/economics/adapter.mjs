import {createHash} from 'node:crypto';
import {aggregateMoney, exposureForProblems, netRefunds} from './index.mjs';
export class LedgerAdapterError extends Error { constructor(code){super(code);this.name='LedgerAdapterError';this.code=code;} }
const requireValue=(ok,code)=>{if(!ok)throw new LedgerAdapterError(code);};
const text=x=>typeof x==='string'&&x.trim().length>0;
const utc=x=>{if(typeof x!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x)||!Number.isFinite(Date.parse(x)))return false;const normalized=x.includes('.')?x.replace(/\.(\d{1,3})Z$/,(_,n)=>'.'+n.padEnd(3,'0')+'Z'):x.replace('Z','.000Z');return new Date(x).toISOString()===normalized;};
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const sorted=rows=>[...new Map(rows.map(r=>[canonical(r),r])).values()].sort((a,b)=>canonical(a)<canonical(b)?-1:canonical(a)>canonical(b)?1:0);
const blank=()=>({amountMinor:'0',knownSubtotalMinor:'0',knownCount:0,totalCount:0,status:'complete'});
/** Pure boundary. authorization is supplied by a server-side current-membership check,
 * never accepted as authorization from an HTTP body. This module performs no I/O. */
export function adaptLedger(input){
 const {authorization:a,snapshot:s,scope:q}=input??{};
 requireValue(a&&text(a.tenantId)&&text(a.permissionsVersion),'AUTHORIZATION_REQUIRED');
 requireValue(s&&s.tenantId===a.tenantId,'TENANT_MISMATCH');
 requireValue(text(s.id)&&utc(s.asOf)&&Array.isArray(s.sources),'SNAPSHOT_INVALID');
 requireValue(q&&utc(q.start)&&utc(q.end)&&Date.parse(q.start)<Date.parse(q.end)&&text(q.timezone)&&q.dateBasis==='occurred_at'&&/^[A-Z]{3}$/.test(q.currency)&&Number.isInteger(q.exponent)&&q.exponent>=0&&q.exponent<=9&&text(q.basis),'SCOPE_INVALID');
 try{new Intl.DateTimeFormat('en',{timeZone:q.timezone});}catch{throw new LedgerAdapterError('TIMEZONE_INVALID');}
 const scope={start:q.start,end:q.end,timezone:q.timezone,dateBasis:q.dateBasis,currency:q.currency,exponent:q.exponent,basis:q.basis};
 const sources=new Map();for(const row of s.sources){requireValue(row&&text(row.sourceAccount)&&typeof row.complete==='boolean'&&(row.watermark===null||text(row.watermark)),'SOURCE_INVALID');requireValue(!sources.has(row.sourceAccount),'SOURCE_DUPLICATE');sources.set(row.sourceAccount,{sourceAccount:row.sourceAccount,watermark:row.watermark,complete:row.complete});}
 const issues=[],excluded={outsideWindow:0,otherCurrency:0,otherBasis:0,afterSnapshot:0,cancelled:0,pending:0};
 const issue=(code,entityType,id)=>issues.push({code,...(entityType?{entityType}:{}),...(id?{id}:{})});
 const incomplete=sources.size===0||[...sources.values()].some(x=>!x.complete||x.watermark===null);
 if(incomplete)issue('SOURCE_INCOMPLETE');
 const openWindow=Date.parse(scope.end)>Date.parse(s.asOf);if(openWindow)issue('WINDOW_INCOMPLETE');
 function records(rows,type){
  requireValue(Array.isArray(rows),'RECORDS_REQUIRED');
  const valid=rows.map(r=>{requireValue(r&&r.tenantId===a.tenantId,'TENANT_MISMATCH');requireValue(['id','sourceAccount','externalId','sourceRevision','evidenceRef','basis'].every(k=>text(r[k]))&&sources.has(r.sourceAccount),'PROVENANCE_REQUIRED');requireValue(['observed','approved_manual'].includes(r.provenance),'FINANCIAL_PROVENANCE_REQUIRED');requireValue(utc(r.occurredAt)&&utc(r.recordedAt)&&Date.parse(r.recordedAt)>=Date.parse(r.occurredAt),'RECORD_DATE_INVALID');requireValue(/^[A-Z]{3}$/.test(r.currency)&&Number.isInteger(r.exponent)&&r.exponent>=0&&r.exponent<=9,'MONEY_UNIT_REQUIRED');
   const statuses=type==='order'?['recorded','pending','cancelled','unknown']:['settled','pending','cancelled','unknown'];requireValue(statuses.includes(r.status),'STATUS_REQUIRED');
   if(type==='event'){requireValue(['refund','reversal'].includes(r.kind),'EVENT_KIND_INVALID');requireValue(r.kind==='reversal'?text(r.reversalOf):r.reversalOf==null,'REVERSAL_REFERENCE_INVALID');}
   const amount=r.amountMinor??null;requireValue(amount===null||typeof amount==='string'&&(type==='event'&&r.kind==='reversal'?/^(0|-[1-9]\d*)$/:/^(0|[1-9]\d*)$/).test(amount),'MINOR_UNITS_INVALID');
   return Object.fromEntries(Object.entries({id:r.id,tenantId:r.tenantId,sourceAccount:r.sourceAccount,externalId:r.externalId,sourceRevision:r.sourceRevision,evidenceRef:r.evidenceRef,basis:r.basis,provenance:r.provenance,occurredAt:r.occurredAt,recordedAt:r.recordedAt,currency:r.currency,exponent:r.exponent,status:r.status,amountMinor:amount,...(type==='event'?{kind:r.kind,reversalOf:r.reversalOf??null}:{})}));
  });
  const unique=sorted(valid),byId=new Map(),bySource=new Map();let conflict=false;
  for(const r of unique){for(const [map,key] of [[byId,r.id],[bySource,canonical([r.sourceAccount,r.externalId])]]){if(map.has(key)&&canonical(map.get(key))!==canonical(r)){conflict=true;issue('IDENTITY_CONFLICT',type,r.id);}else map.set(key,r);}}
  const selected=unique.filter(r=>{if(Date.parse(r.recordedAt)>Date.parse(s.asOf)){excluded.afterSnapshot++;return false;}if(r.currency!==scope.currency){excluded.otherCurrency++;return false;}if(r.basis!==scope.basis){excluded.otherBasis++;return false;}requireValue(r.exponent===scope.exponent,'EXPONENT_CONFLICT');if(Date.parse(r.occurredAt)<Date.parse(scope.start)||Date.parse(r.occurredAt)>=Date.parse(scope.end)){excluded.outsideWindow++;return false;}if(r.status==='cancelled'){excluded.cancelled++;return false;}if(r.status==='pending'){excluded.pending++;return false;}return true;});
  return {all:unique,selected,conflict};
 }
 const orders=records(input.orders,'order'),events=records(input.events,'event');
 requireValue(Array.isArray(input.links),'LINKS_REQUIRED');
 const links=sorted(input.links.map(l=>{requireValue(l&&l.tenantId===a.tenantId,'TENANT_MISMATCH');requireValue(['problemId','orderId','evidenceRef','relationVersion'].every(k=>text(l[k])),'LINK_PROVENANCE_REQUIRED');return {tenantId:l.tenantId,problemId:l.problemId,orderId:l.orderId,evidenceRef:l.evidenceRef,relationVersion:l.relationVersion};}));
 const orderIds=new Set(orders.all.map(x=>x.id)),selectedIds=new Set(orders.selected.map(x=>x.id));
 const missingLinks=links.filter(l=>!orderIds.has(l.orderId));for(const l of missingLinks)issue('LINK_ORDER_MISSING','order',l.orderId);
 const activeLinks=links.filter(l=>selectedIds.has(l.orderId));
 const orderReasons=[];if(orders.conflict)orderReasons.push('IDENTITY_CONFLICT');if(orders.selected.some(x=>x.status==='unknown'))orderReasons.push('STATUS_UNKNOWN');
 const refundReasons=[];if(events.conflict)refundReasons.push('IDENTITY_CONFLICT');if(events.selected.some(x=>x.status==='unknown'))refundReasons.push('STATUS_UNKNOWN');
 const metric=(raw,rows,reasons=[])=>{const missing=[...reasons,...(incomplete?['SOURCE_INCOMPLETE']:[]),...(openWindow?['WINDOW_INCOMPLETE']:[]),...(raw.amountMinor===null?['AMOUNT_UNKNOWN']:[])];const blocked=reasons.length>0;return {...raw,amountMinor:blocked||incomplete||openWindow?null:raw.amountMinor,knownSubtotalMinor:blocked?null:raw.knownSubtotalMinor,status:blocked?'unavailable':missing.length?'partial':'complete',currency:scope.currency,exponent:scope.exponent,basis:scope.basis,window:{start:scope.start,end:scope.end,dateBasis:scope.dateBasis,timezone:scope.timezone},missingReasons:[...new Set(missing)].sort(),evidenceRefs:[...new Set(rows.map(x=>x.evidenceRef))].sort()};};
 const orderKernel=orders.selected.map(r=>({id:r.id,currency:r.currency,amountMinor:r.amountMinor}));
 let allRaw={...blank(),totalCount:new Set(orders.selected.map(x=>x.id)).size},exposureRaw={global:{},byProblem:{}};
 if(!orders.conflict){allRaw=aggregateMoney(orderKernel)[scope.currency]??blank();exposureRaw=exposureForProblems(orderKernel,activeLinks);}
 const allOrders=metric(allRaw,orders.selected,orderReasons);
 const exposureReasons=[...orderReasons,...(missingLinks.length?['LINK_ORDER_MISSING']:[])];
 const byProblem=Object.create(null);for(const id of [...new Set(links.map(l=>l.problemId))].sort()){const relevant=activeLinks.filter(l=>l.problemId===id),ids=new Set(relevant.map(l=>l.orderId));byProblem[id]=metric(exposureRaw.byProblem[id]?.[scope.currency]??blank(),[...orders.selected.filter(o=>ids.has(o.id)),...relevant],exposureReasons);}
 const linkedIds=new Set(activeLinks.map(l=>l.orderId));const exposure={global:metric(exposureRaw.global[scope.currency]??blank(),[...orders.selected.filter(o=>linkedIds.has(o.id)),...activeLinks],exposureReasons),byProblem,problemRowsAreAdditive:false};
 let refundRaw={...blank(),totalCount:new Set(events.selected.filter(x=>x.kind==='refund').map(x=>x.id)).size};if(!refundReasons.length){try{refundRaw=netRefunds(events.selected.map(r=>({...r,amountMinor:r.amountMinor===null?null:r.kind==='reversal'?(-BigInt(r.amountMinor)).toString():r.amountMinor})))[scope.currency]??blank();}catch{refundReasons.push('REFUND_RECONCILIATION_REQUIRED');}}
 for(const code of orderReasons)issue(code,'order');for(const code of refundReasons)issue(code,'event');
 const refunds=metric(refundRaw,events.selected,refundReasons);
 const snapshot={tenantId:s.tenantId,id:s.id,asOf:s.asOf,sources:sorted([...sources.values()])};
 return {schemaVersion:'vexa-ledger-adapter-v1',tenantId:a.tenantId,snapshotId:s.id,scope,scopeHash:hash({authorization:{tenantId:a.tenantId,permissionsVersion:a.permissionsVersion},scope,sourceAccounts:[...sources.keys()].sort()}),inputHash:hash({authorization:{tenantId:a.tenantId,permissionsVersion:a.permissionsVersion},snapshot,scope,orders:orders.all,events:events.all,links}),metrics:{allOrders,exposure,refunds},issues:sorted(issues),excluded};
}
