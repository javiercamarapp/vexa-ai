import {createHash} from 'node:crypto';
export class DomainError extends Error { constructor(code,status=409){super(code);this.code=code;this.status=status;} }
export function requireThat(ok,code,status=409){if(!ok)throw new DomainError(code,status);}
export function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  requireThat(value!==undefined,'undefined_not_serializable',400);return JSON.stringify(value);
}
export const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
export function stableId(value){const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export const sortedUnique=values=>[...new Set(values)].sort();
export function tenantRows(ctx,rows){for(const row of rows)requireThat(row.tenant_id===ctx.tenant_id,'resource_not_found',404);}
export function text(value,label){requireThat(typeof value==='string'&&value.trim().length>0,label+'_required',400);return value;}
export function instant(value){requireThat(typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*Z$/.test(value)&&Number.isFinite(Date.parse(value)),'invalid_timestamp',400);return Date.parse(value);}
/** resolve() MUST invoke platform resolveSession(identity, selectedOrg) afresh, server-side. */
export async function authorized(resolve,roles=['owner','analyst','operator','viewer']){
  requireThat(typeof resolve==='function','identity_binding_required',503);
  const s=await resolve();const m=s?.active;
  requireThat(s?.user?.id&&m?.user_id===s.user.id&&m.status==='active','membership_required',403);
  requireThat(roles.includes(m.role),'role_forbidden',403);
  return {tenant_id:m.tenant_id,user_id:s.user.id,role:m.role,permissions_version:m.permissions_version};
}
