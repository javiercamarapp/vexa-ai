import { createHash } from 'node:crypto';
import { AccessError, type Membership } from '@vexa/platform/session';
export type Resource = 'metrics'|'problems'|'customers'|'recommendations'|'interventions'|'briefs'|'explorer';
export type Scope = {date_start:string;date_end:string;timezone:string;date_basis:string;currency:string;sku:string[];source:string[];snapshot_id:string|null};
export type Context = {user:{id:string};active:Membership};
export type Metric = {label:string;amount_minor:string|null;currency:string;exponent:number;kind:string;source_ref:string;known_subtotal:string|null};
export type Evidence = {id:string;quote:string;source_ref:string;role:string};
export type RecordView = {id:string;title:string;summary:string;status:string;version:number;owner:string|null;customer_id:string|null;problem_id:string|null;metrics:Metric[];evidence:Evidence[];details:{label:string;value:string}[]};
export type Bundle = {items:RecordView[];meta:{state:'empty'|'partial'|'stale'|'ready';snapshot_id:string|null;scope_hash:string;coverage:string;watermark:string|null;next_cursor:string|null;critical_notice:string|null}};
export const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function bad(code:string):never {throw new AccessError(400,code);}
export function parseScope(query:URLSearchParams, now=new Date()):{scope:Scope;limit:number;cursor:string|null} {
 const allowed=new Set(['date_start','date_end','timezone','date_basis','currency','sku','source','snapshot_id','limit','cursor']);
 for(const key of query.keys())if(!allowed.has(key))bad('unsupported_filter');
 for(const key of allowed)if(!['sku','source'].includes(key)&&query.getAll(key).length>1)bad('duplicate_filter');
 const month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
 const date=(key:string,fallback:Date)=>{const s=query.get(key)??fallback.toISOString().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)bad('invalid_date');return s+'T00:00:00.000Z';};
 const date_start=date('date_start',month),date_end=date('date_end',end);
 if(date_start>=date_end||Date.parse(date_end)-Date.parse(date_start)>366*86400000)bad('invalid_date_window');
 const currency=query.get('currency')??'USD';if(!/^[A-Z]{3}$/.test(currency)||!Intl.supportedValuesOf('currency').includes(currency))bad('invalid_currency');
 const timezone=query.get('timezone')??'UTC';if(timezone!=='UTC')bad('timezone_not_supported');
 const date_basis=query.get('date_basis')??'order';if(!['order','conversation','refund_settlement'].includes(date_basis))bad('invalid_date_basis');
 const values=(key:string)=>{const result=[...new Set(query.getAll(key).filter(Boolean))].sort();if(result.length>20||result.some(x=>x.length>100||/[\u0000-\u001f]/.test(x)))bad('invalid_filter');return result;};
 const source=values('source');if(source.some(x=>!['hubspot','zendesk','csv','excel'].includes(x)))bad('invalid_source');
 const snapshot_id=query.get('snapshot_id');if(snapshot_id&&!UUID.test(snapshot_id))bad('invalid_snapshot');
 const n=query.get('limit')??'25';if(!/^[1-9]\d?$/.test(n)||Number(n)>50)bad('invalid_limit');
 const cursor=query.get('cursor');if(cursor&&cursor.length>1500)bad('invalid_cursor');
 return {scope:{date_start,date_end,timezone,date_basis,currency,sku:values('sku'),source,snapshot_id},limit:Number(n),cursor};
}
export function scopeHash(context:Context,scope:Scope){return createHash('sha256').update(JSON.stringify({tenant:context.active.tenant_id,user:context.user.id,role:context.active.role,permissions_version:context.active.permissions_version,scope})).digest('hex');}
export function pageCursor(raw:string|null,hash:string,resource:Resource):string|null {
 if(!raw)return null;try{const value=JSON.parse(Buffer.from(raw,'base64url').toString());if(value.scope!==hash||value.resource!==resource||!UUID.test(value.after))bad('cursor_scope_mismatch');return value.after;}catch{bad('invalid_cursor');}
}
export function makeCursor(after:string,hash:string,resource:Resource){return Buffer.from(JSON.stringify({after,scope:hash,resource})).toString('base64url');}
export type Action='create'|'approve'|'transition'|'brief';
export function authorizeAction(context:Context,action:Action){
 const roles:Record<Action,string[]>={create:['owner','analyst','operator'],approve:['owner'],transition:['owner','operator'],brief:['owner','analyst','operator']};
 if(!roles[action].includes(context.active.role))throw new AccessError(403,'role_forbidden');
}
export function money(metric:Metric):string {
 if(metric.amount_minor===null)return 'Desconocido';
 const value=BigInt(metric.amount_minor),sign=value<0n?'-':'';
 const digits=(value<0n?-value:value).toString().padStart(metric.exponent+1,'0');
 return sign+(metric.exponent?digits.slice(0,-metric.exponent)+'.'+digits.slice(-metric.exponent):digits)+' '+metric.currency;
}
