import {createHash} from 'node:crypto';
export class WorkspaceError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
export const check=(ok,code,status=400)=>{if(!ok)throw new WorkspaceError(code,status);};
export const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
export const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
export const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const unique=x=>[...new Set(x)].sort();
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
export function parseWorkspaceQuery(query,{now=new Date()}={}){
 const keys=['resource','date_start','date_end','timezone','date_basis','currency','basis','exponent','sku','source','snapshot_id','scope_hash','cursor','limit','format'];
 for(const key of query.keys())check(keys.includes(key)&&(['sku','source'].includes(key)||query.getAll(key).length===1),'unsupported_filter');
 const today=new Date(now);const end=query.get('date_end')??new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()+1,1)).toISOString().slice(0,10),start=query.get('date_start')??new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1)).toISOString().slice(0,10);
 check(date(start)&&date(end)&&start<end&&Date.parse(end)-Date.parse(start)<=366*86400000,'date_window_invalid');
 const timezone=query.get('timezone')??'UTC',dateBasis=query.get('date_basis')??'occurred_at',currency=query.get('currency')??'USD',basis=query.get('basis')??'net',ex=query.get('exponent');
 check(timezone==='UTC'&&dateBasis==='occurred_at'&&/^[A-Z]{3}$/.test(currency)&&basis.trim()===basis&&basis.length>0&&basis.length<=200&&(ex===null||/^[0-4]$/.test(ex)),'scope_invalid');
 const sku=unique(query.getAll('sku')),source=unique(query.getAll('source'));check(sku.length<=20&&sku.every(x=>x.trim()===x&&x.length>0&&x.length<=100&&!/[\u0000-\u001f\u007f]/.test(x))&&source.every(x=>['hubspot','zendesk','csv','excel'].includes(x)),'dimension_invalid');
 const snapshot_id=query.get('snapshot_id'),scope_hash=query.get('scope_hash'),resource=query.get('resource')??'metrics',limit=query.get('limit')??'25';
 check(!snapshot_id||uuid(snapshot_id),'snapshot_invalid');check(!scope_hash||snapshot_id&&/^[a-f0-9]{64}$/.test(scope_hash),'scope_hash_invalid');check(['metrics','problems'].includes(resource),'resource_unavailable');check(/^[1-9]\d?$/.test(limit)&&Number(limit)<=50,'limit_invalid');
 return {scope:{date_start:start,date_end:end,timezone,date_basis:dateBasis,currency,basis,exponent:ex===null?null:Number(ex),sku,source,snapshot_id,scope_hash},resource,limit:Number(limit),cursor:query.get('cursor')};
}
export function canonicalScopeHash({baseSnapshotId,baseScopeHash,filters,mappingIds,version,problemVersions=[]}){return hash({baseSnapshotId,baseScopeHash,filters:{...filters,sku:unique(filters.sku??[]),source:unique(filters.source??[])},mappingIds:unique(mappingIds),problemVersions:[...problemVersions].sort((a,b)=>a.problemId.localeCompare(b.problemId)),version});}
export const cursorAuthHash=(context,dataScopeHash,snapshotId)=>hash({tenantId:context.tenantId,userId:context.userId,role:context.role,permissionsVersion:String(context.permissionsVersion),dataScopeHash,snapshotId});
export const encodeCursor=q=>Buffer.from(canonical(q)).toString('base64url');
export function decodeCursor(raw,expected){if(!raw)return null;let q;try{check(typeof raw==='string'&&raw.length<=4096,'cursor_invalid');q=JSON.parse(Buffer.from(raw,'base64url').toString());}catch{throw new WorkspaceError('cursor_invalid');}check(q&&uuid(q.after)&&Object.keys(q).length===5&&Object.entries(expected).every(([k,v])=>q[k]===v),'cursor_scope_conflict');return q.after;}
