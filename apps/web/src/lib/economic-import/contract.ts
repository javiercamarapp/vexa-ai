import type {EconomicEntry,EconomicScope,EconomicSource,EntryInput,SourceInput} from '../../../../../packages/metrics/repository.mjs';
import type {CurrencyInput,CurrencyVersion} from '../../../../../packages/metrics/money-repository.mjs';
export const MAX_BYTES=8*1024*1024;
export const MAX_ENTRIES=2000;
export const MAX_SOURCES=20;
export type ImportCurrency=Omit<CurrencyInput,'attested'>;
export type ImportSource=Omit<SourceInput,'attested'|'sourceId'|'evidenceType'>&{sourceId:string;evidenceType:'order_export'|'payment_ledger'};
export type ImportEntry=Omit<EntryInput,'attested'|'kind'>&{kind:'order'|'refund'};
export type EconomicImport={schema:'rovaq-economic-import-v1';tenantId:string;scope:EconomicScope;currencyConfiguration:ImportCurrency;sources:ImportSource[];entries:ImportEntry[]};
export type ImportSummary={orders:number;refunds:number;orderKnownMinor:string;refundKnownMinor:string;unknownAmounts:number;refundStatuses:Record<string,number>;incompleteSources:number};
export type ImportSnapshot={tenantId:string;canWrite:boolean;sources:EconomicSource[];entries:EconomicEntry[];currencies:CurrencyVersion[]};
export class EconomicImportError extends Error {constructor(public code:string,message:string,public accessLost=false){super(message);this.name='EconomicImportError';}}
function fail(condition:unknown,code:string,message:string):asserts condition{if(!condition)throw new EconomicImportError(code,message);}
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
const text=(x:unknown,max:number,min=1):x is string=>typeof x==='string'&&x.trim().length>=min&&x.length<=max;
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function keys(x:unknown,names:string[],label:string):asserts x is Record<string,unknown>{fail(object(x)&&Object.keys(x).length===names.length&&names.every(k=>Object.hasOwn(x,k)), 'shape',`Estructura no admitida: ${label}.`);}
const instant=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
export function validateImport(value:unknown,tenantId:string,now=new Date()):EconomicImport{
 keys(value,['schema','tenantId','scope','currencyConfiguration','sources','entries'],'archivo');
 fail(uuid(tenantId)&&value.tenantId===tenantId,'tenant','El archivo no corresponde al espacio de trabajo actual.');
 fail(value.schema==='rovaq-economic-import-v1','schema','El formato del archivo no está admitido.');
 const s=value.scope;keys(s,['start','end','timezone','dateBasis','currency','exponent','basis'],'alcance');
 fail(instant(s.start)&&instant(s.end)&&s.start<s.end&&s.start.endsWith('T00:00:00.000Z')&&s.end.endsWith('T00:00:00.000Z')&&s.end<=now.toISOString()&&s.timezone==='UTC'&&s.dateBasis==='occurred_at'&&s.currency==='USD'&&s.exponent===2&&s.basis==='gross_order_including_tax_shipping','scope','El alcance requiere fechas UTC cerradas, USD con 2 decimales y base bruta con impuestos y envío.');
 const c=value.currencyConfiguration;keys(c,['currency','exponent','expectedVersion','active','source','reference','date','report'],'moneda');
 fail(c.currency===s.currency&&c.exponent===s.exponent&&c.expectedVersion===0&&c.active===true&&text(c.source,200)&&text(c.reference,500)&&typeof c.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(c.date)&&instant(c.date+'T00:00:00.000Z')&&c.date<=now.toISOString().slice(0,10)&&text(c.report,4000,20),'currency','La configuración monetaria o su evidencia no es válida.');
 fail(Array.isArray(value.sources)&&value.sources.length>0&&value.sources.length<=MAX_SOURCES,'sources','El archivo debe incluir entre 1 y 20 fuentes.');
 const sources=new Map<string,Record<string,unknown>>();
 for(const [index,source] of value.sources.entries()){
  keys(source,['sourceId','expectedVersion','name','evidenceType','active','complete','windowStart','windowEnd','watermark','report'],`fuente ${index+1}`);
  fail(uuid(source.sourceId)&&!sources.has(source.sourceId)&&source.expectedVersion===0&&text(source.name,200)&&['order_export','payment_ledger'].includes(String(source.evidenceType))&&source.active===true&&source.complete===false&&instant(source.windowStart)&&instant(source.windowEnd)&&source.windowStart<=s.start&&source.windowEnd>=s.end&&instant(source.watermark)&&source.watermark<=now.toISOString()&&text(source.report,8000,20),'source',`La fuente ${index+1} es inválida o repite una identidad.`);
  sources.set(source.sourceId,source);
 }
 fail(Array.isArray(value.entries)&&value.entries.length>0&&value.entries.length<=MAX_ENTRIES,'entries','El archivo debe incluir entre 1 y 2000 registros.');
 const identities=new Set<string>();
 for(const [index,e] of value.entries.entries()){
  keys(e,['sourceId','sourceVersion','expectedRevision','externalId','kind','effectiveAt','currency','exponent','basis','amountMinor','status','orderId','reversalOf','details','report'],`registro ${index+1}`);
  const source=sources.get(String(e.sourceId));
  fail(source&&e.sourceVersion===Number(source.expectedVersion)+1&&e.expectedRevision===0&&text(e.externalId,200)&&['order','refund'].includes(String(e.kind))&&source.evidenceType===(e.kind==='order'?'order_export':'payment_ledger')&&instant(e.effectiveAt)&&e.effectiveAt>=s.start&&e.effectiveAt<s.end&&e.currency===s.currency&&e.exponent===s.exponent&&e.basis===s.basis&&(e.amountMinor===null||typeof e.amountMinor==='string'&&/^(0|[1-9][0-9]{0,36})$/.test(e.amountMinor))&&(e.kind==='order'?['recorded','pending','cancelled','unknown']:['settled','pending','cancelled','unknown']).includes(String(e.status))&&(e.orderId===null||uuid(e.orderId))&&(e.kind!=='order'||e.orderId===null)&&e.reversalOf===null&&object(e.details)&&Object.keys(e.details).length===0&&text(e.report,8000,20),'entry',`El registro ${index+1} contiene campos incompatibles o evidencia insuficiente.`);
  const key=identityKey(e);fail(!identities.has(key),'duplicate',`El registro ${index+1} repite una identidad económica.`);identities.add(key);
 }
 // A single POST has a stricter server bound than the complete file.
 for(const input of [c,...value.sources,...value.entries])fail(new TextEncoder().encode(JSON.stringify({...input,operation:'currency',attested:true})).length<=32768,'record_size','Un registro supera el límite de la API.');
 return value as unknown as EconomicImport;
}
export function parseImport(content:string,tenantId:string,now=new Date()):EconomicImport{
 fail(new TextEncoder().encode(content).length<=MAX_BYTES,'size','El archivo supera 8 MiB.');
 let input:unknown;try{input=JSON.parse(content);}catch{throw new EconomicImportError('json','El archivo no contiene JSON válido.');}
 return validateImport(input,tenantId,now);
}
export function summarizeImport(doc:EconomicImport):ImportSummary{
 const summary:ImportSummary={orders:0,refunds:0,orderKnownMinor:'0',refundKnownMinor:'0',unknownAmounts:0,refundStatuses:{},incompleteSources:doc.sources.filter(s=>!s.complete).length};
 for(const e of doc.entries){if(e.kind==='order')summary.orders++;else{summary.refunds++;summary.refundStatuses[e.status]=(summary.refundStatuses[e.status]??0)+1;}if(e.amountMinor===null)summary.unknownAmounts++;else if(e.kind==='order')summary.orderKnownMinor=String(BigInt(summary.orderKnownMinor)+BigInt(e.amountMinor));else summary.refundKnownMinor=String(BigInt(summary.refundKnownMinor)+BigInt(e.amountMinor));}
 return summary;
}
export const identityKey=(entry:{sourceId?:unknown;kind?:unknown;externalId?:unknown})=>JSON.stringify([entry.sourceId,entry.kind,entry.externalId]);
export const sameFields=(a:Record<string,unknown>,b:Record<string,unknown>,fields:string[])=>fields.every(key=>JSON.stringify(a[key])===JSON.stringify(b[key]));
export const sourceFields=['name','evidenceType','active','complete','windowStart','windowEnd','watermark','report'];
export const currencyFields=['currency','exponent','active','source','reference','date','report'];
export const entryFields=['sourceId','externalId','kind','effectiveAt','currency','exponent','basis','amountMinor','status','orderId','reversalOf','details','report'];
export async function entryIdentity(tenantId:string,e:ImportEntry):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify([tenantId,e.sourceId,e.kind,e.externalId]));const digest=await crypto.subtle.digest('SHA-256',bytes);const h=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
}
export function readSnapshot(value:unknown,tenantId:string):ImportSnapshot{
 fail(object(value)&&object(value.data),'response','No se pudo verificar la respuesta del ledger.');const data=value.data;
 fail(object(data.bundle)&&data.bundle.tenantId===tenantId,'tenant','El espacio de trabajo cambió. Recarga la página antes de continuar.');
 fail(data.canWrite===true,'owner','Se requiere un owner vigente para importar.');
 fail(Array.isArray(data.sources)&&Array.isArray(data.entries)&&object(data.monetary)&&Array.isArray(data.monetary.currencyVersions),'response','La respuesta del ledger está incompleta.');
 for(const item of [...data.sources,...data.entries,...data.monetary.currencyVersions])fail(object(item),'response','El ledger contiene una respuesta no verificable.');
 return {tenantId,canWrite:true,sources:data.sources as EconomicSource[],entries:data.entries as EconomicEntry[],currencies:data.monetary.currencyVersions as CurrencyVersion[]};
}
export type ImportPlan={currency:ImportCurrency|null;sources:ImportSource[];entries:ImportEntry[];existingEntries:number};
export async function reconcileImport(doc:EconomicImport,snapshot:ImportSnapshot):Promise<ImportPlan>{
 fail(snapshot.tenantId===doc.tenantId&&snapshot.canWrite,'tenant','El acceso o el espacio de trabajo cambió.');
 const currency=snapshot.currencies.filter(c=>c.currency===doc.scope.currency);fail(currency.length<=1,'conflict','La moneda tiene versiones ambiguas.');
 if(currency[0])fail(currency[0].valid===true&&currency[0].version===doc.currencyConfiguration.expectedVersion+1&&sameFields(currency[0] as unknown as Record<string,unknown>,doc.currencyConfiguration,currencyFields),'conflict','La moneda existente difiere del archivo. No se cambiará su configuración.');else fail(doc.currencyConfiguration.expectedVersion===0,'conflict','La versión monetaria esperada no existe.');
 const missingSources:ImportSource[]=[];
 for(const source of doc.sources){const rows=snapshot.sources.filter(s=>s.id===source.sourceId);fail(rows.length<=1,'conflict','Hay fuentes ambiguas.');if(rows[0])fail(rows[0].version===source.expectedVersion+1&&sameFields(rows[0] as unknown as Record<string,unknown>,source,sourceFields),'conflict','Una fuente existente difiere del archivo. No se creará otra versión.');else{fail(source.expectedVersion===0,'conflict','Una fuente esperada no existe.');missingSources.push(source);}}
 const missing:ImportEntry[]=[];const existing=new Map<string,EconomicEntry>();
 for(const entry of snapshot.entries){const key=identityKey(entry);fail(!existing.has(key),'conflict','El ledger contiene identidades duplicadas.');existing.set(key,entry);}
 const orderIds=new Map<string,{currency:string;exponent:number;basis:string}>();
 for(const e of snapshot.entries.filter(e=>e.kind==='order'))orderIds.set(e.id,e);
 for(const e of doc.entries.filter(e=>e.kind==='order'))orderIds.set(await entryIdentity(doc.tenantId,e),e);
 for(const e of doc.entries){const row=existing.get(identityKey(e));if(row)fail(row.revision===1&&row.id===await entryIdentity(doc.tenantId,e)&&sameFields(row as unknown as Record<string,unknown>,e,entryFields),'conflict','Un registro existente difiere del archivo o tiene otra revisión.');else missing.push(e);
  if(e.orderId){const order=orderIds.get(e.orderId);fail(order&&order.currency===e.currency&&order.exponent===e.exponent&&order.basis===e.basis,'order_reference','Un reembolso apunta a una orden ausente o incompatible.');}}
 return {currency:currency.length?null:doc.currencyConfiguration,sources:missingSources,entries:[...missing.filter(e=>e.kind==='order'),...missing.filter(e=>e.kind==='refund')],existingEntries:doc.entries.length-missing.length};
}
