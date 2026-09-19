import { AccessError } from '@vexa/platform/session';
import { UUID, makeCursor, pageCursor, scopeHash, type Bundle, type Context, type Resource, type Scope, type RecordView, type Metric, type Evidence } from './contracts';
export type ResolvedScope = Scope & {snapshot_id:string};
export interface ReadPort {resolveSnapshot(input:{tenant_id:string;scope:Scope}):Promise<unknown>;read(input:{tenant_id:string;resource:Resource;id:string|null;scope:ResolvedScope;scope_hash:string;limit:number;after:string|null}):Promise<unknown>}
function invalid():never{throw new AccessError(503,'workspace_contract_invalid');}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))invalid();return value as Record<string,unknown>;}
function str(value:unknown,max=4000):string{if(typeof value!=='string'||value.length>max)invalid();return value;}
function nullable(value:unknown){return value===null?null:str(value);}
function list(value:unknown,max:number):unknown[]{if(!Array.isArray(value)||value.length>max)invalid();return value;}
function id(value:unknown){const s=str(value,36);if(!UUID.test(s))invalid();return s;}
function minor(value:unknown){if(value===null)return null;const s=str(value,100);if(!/^-?(0|[1-9]\d*)$/.test(s))invalid();return s;}
function metric(value:unknown,currency:string):Metric{const m=object(value);if(m.currency!==currency||!Number.isInteger(m.exponent)||Number(m.exponent)<0||Number(m.exponent)>6)invalid();return {label:str(m.label,200),amount_minor:minor(m.amount_minor),currency,exponent:Number(m.exponent),kind:str(m.kind,200),source_ref:str(m.source_ref),known_subtotal:minor(m.known_subtotal)};}
function record(value:unknown,currency:string):RecordView{const r=object(value);if(!Number.isSafeInteger(r.version)||Number(r.version)<1)invalid();return {id:id(r.id),title:str(r.title,300),summary:str(r.summary),status:str(r.status,100),version:Number(r.version),owner:nullable(r.owner),customer_id:r.customer_id===null?null:id(r.customer_id),problem_id:r.problem_id===null?null:id(r.problem_id),metrics:list(r.metrics,30).map(m=>metric(m,currency)),evidence:list(r.evidence,50).map(e=>{const v=object(e);if(!['customer','agent','internal'].includes(String(v.role)))invalid();return {id:id(v.id),quote:str(v.quote),source_ref:str(v.source_ref),role:str(v.role)} as Evidence;}),details:list(r.details,30).map(d=>{const v=object(d);return {label:str(v.label,200),value:str(v.value)};})};}
export async function readWorkspace(port:ReadPort,context:Context,resource:Resource,request:{scope:Scope;limit:number;cursor:string|null},resourceId:string|null=null):Promise<Bundle>{
 if(resourceId&&!UUID.test(resourceId))throw new AccessError(404,'resource_not_found');
 // Resolve latest once; every subsequent read must pin this immutable snapshot.
 let snapshotId=request.scope.snapshot_id;
 if(!snapshotId){
  let resolved:unknown;try{resolved=await port.resolveSnapshot({tenant_id:context.active.tenant_id,scope:request.scope});}catch(error){if(error instanceof AccessError)throw error;throw new AccessError(503,'workspace_snapshot_unavailable');}
  const resolution=object(resolved);
  if(resolution.snapshot_id===null){
   if(!((resolution.state==='empty'&&resolution.reason==='no_data')||(resolution.state==='partial'&&resolution.reason==='processing_pending')))invalid();
   if(resourceId)throw new AccessError(404,'resource_not_found');
   const hash=scopeHash(context,request.scope);pageCursor(request.cursor,hash,resource);
   return {items:[],meta:{state:resolution.state,scope_hash:hash,snapshot_id:null,watermark:null,coverage:resolution.reason==='no_data'?'Sin datos publicados':'Publicación pendiente',next_cursor:null,critical_notice:null}};
  }
  snapshotId=id(resolution.snapshot_id);
 }
 const scope:ResolvedScope={...request.scope,snapshot_id:snapshotId};
 const hash=scopeHash(context,scope);const after=pageCursor(request.cursor,hash,resource);
 let raw:unknown;try{raw=await port.read({tenant_id:context.active.tenant_id,resource,id:resourceId,scope,scope_hash:hash,limit:request.limit,after});}catch(error){if(error instanceof AccessError)throw error;throw new AccessError(503,'workspace_unavailable');}
 const result=object(raw),meta=object(result.meta);
 if(meta.scope_hash!==hash||!['empty','partial','stale','ready'].includes(String(meta.state)))invalid();
 const snapshot_id=id(meta.snapshot_id);if(snapshot_id!==scope.snapshot_id)invalid();
 const items=list(result.items,request.limit).map(r=>record(r,request.scope.currency));
 if((meta.state==='empty'&&items.length)||(meta.state==='ready'&&!items.length))invalid();
 if(resourceId){if(items.length===0)throw new AccessError(404,'resource_not_found');if(items.length!==1||items[0].id!==resourceId)invalid();}
 if(new Set(items.map(i=>i.id)).size!==items.length)invalid();
 const watermark=str(meta.watermark,40);if(!Number.isFinite(Date.parse(watermark)))invalid();
 const next=meta.next_after===null?null:id(meta.next_after);
 if(next&&(!items.length||next!==items.at(-1)?.id))invalid();
 return {items,meta:{state:meta.state as Bundle['meta']['state'],scope_hash:hash,snapshot_id,coverage:str(meta.coverage,300),watermark,next_cursor:next?makeCursor(next,hash,resource):null,critical_notice:nullable(meta.critical_notice)}};
}
