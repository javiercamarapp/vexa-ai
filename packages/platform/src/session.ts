/** Request-scoped identity only. Implementations must verify Auth and query DB without caching. */
export type Membership = { tenant_id: string; user_id: string; role: 'owner'|'analyst'|'operator'|'viewer'; status: 'active'|'invited'|'revoked'; permissions_version: number };
export interface IdentityPort { getUser(): Promise<{id:string}|null>; memberships(userId:string): Promise<Membership[]> }
export class AccessError extends Error {
  status:number; code:string;
  constructor(status:number, code:string) { super(code); this.status=status; this.code=code; }
}
export function safeNext(value:string|null, origin:string):string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]|%2f|%5c/i.test(value)) return '/';
  try { const url=new URL(value,origin); const path=url.pathname+url.search;
    return url.origin===origin && !path.startsWith('//') ? path : '/';
  } catch { return '/'; }
}
export function assertOrigin(value:string|null, origin:string):void {
  if (value!==origin) throw new AccessError(403,'csrf_rejected');
}
export async function resolveSession(port:IdentityPort, selected?:string) {
  const user=await port.getUser();
  if (!user) throw new AccessError(401,'authentication_required');
  const memberships=(await port.memberships(user.id)).filter(m=>m.user_id===user.id && m.status==='active');
  const active=selected ? memberships.find(m=>m.tenant_id===selected) : memberships[0];
  if (!active) throw new AccessError(403,'organization_not_authorized');
  return {user,memberships,active};
}
export async function authorizeSelection(port:IdentityPort, tenant:string) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tenant)) throw new AccessError(403,'organization_not_authorized');
  return (await resolveSession(port,tenant)).active;
}
