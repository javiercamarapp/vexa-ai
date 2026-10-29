/** Request-scoped identity only. Implementations must verify Auth and query DB without caching. */
export type Membership = { tenant_id: string; user_id: string; role: 'owner'|'analyst'|'operator'|'viewer'; status: 'active'|'invited'|'revoked'; permissions_version: number };
/** Sesión de soporte («ver como»): lectura de UNA organización, con motivo y caducidad, concedida por la plataforma. NO es una membresía. */
export interface SupportGrant { session_id:string; tenant_id:string; tenant_name?:string; expires_at:string; reason:string }
export interface IdentityPort { getUser(): Promise<{id:string}|null>; memberships(userId:string): Promise<Membership[]>; support?(userId:string): Promise<SupportGrant|null> }
export interface ResolveOptions {
  /** Navegación de páginas: si la organización elegida ya no es válida (cookie revocada), cae a la primera membresía válida en vez de 403. Las rutas de datos y escrituras NO lo usan. */
  fallback?: boolean;
  /** false desactiva la consulta de sesión de soporte (por defecto se consulta solo si no hay membresía que coincida). */
  support?: boolean;
}
const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export class AccessError extends Error {
  status:number; code:string; reported=false;
  constructor(status:number, code:string) { super(code); this.status=status; this.code=code; }
}
/** Registro de eventos de seguridad (auditoría 3). El paquete no conoce la aplicación: usa el ayudante que ella publica en globalThis y nunca lanza.
 * Una sola vez por error (`reported`) aunque lo atrapen varias capas (sesión, base, manejador). */
export function reportAccess(error:AccessError):AccessError {
  try {
    if (error.reported) return error;
    if (error.status!==401 && error.status!==403) return error;
    error.reported=true;
    const kind=error.status===401 ? 'auth_401' : error.code==='csrf_rejected' ? 'csrf_rejected' : /^support_(read_only|export_blocked)$/.test(error.code) ? 'support_blocked' : 'forbidden_403';
    (globalThis as {__vexaSecuritySink?:(e:unknown)=>void}).__vexaSecuritySink?.({kind,detail:{code:error.code,status:error.status}});
  } catch { /* el registro nunca rompe la petición */ }
  return error;
}
export function safeNext(value:string|null, origin:string):string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]|%2f|%5c/i.test(value)) return '/';
  try { const url=new URL(value,origin); const path=url.pathname+url.search;
    return url.origin===origin && !path.startsWith('//') ? path : '/';
  } catch { return '/'; }
}
export function assertOrigin(value:string|null, origin:string):void {
  if (value!==origin) throw reportAccess(new AccessError(403,'csrf_rejected'));
}
export async function resolveSession(port:IdentityPort, selected?:string, options:ResolveOptions={}) {
  const user=await port.getUser();
  if (!user) throw reportAccess(new AccessError(401,'authentication_required'));
  const memberships=(await port.memberships(user.id)).filter(m=>m.user_id===user.id && m.status==='active');
  let active:Membership|undefined=selected ? memberships.find(m=>m.tenant_id===selected) : memberships[0];
  let support:SupportGrant|null=null, fellBack=false;
  if (!active && options.support!==false && port.support && (!selected || UUID.test(selected))) {
    // Solo se pregunta cuando no hay membresía que sirva. Cualquier fallo del puerto = sin soporte (falla cerrado). La autoridad es la base, no la cookie.
    const grant=await port.support(user.id).catch(()=>null);
    if (grant && UUID.test(grant.tenant_id) && Date.parse(grant.expires_at)>Date.now() && (!selected || selected===grant.tenant_id)) {
      support=grant; active={tenant_id:grant.tenant_id,user_id:user.id,role:'viewer',status:'active',permissions_version:0};
    }
  }
  if (!active && selected && options.fallback && memberships[0]) { active=memberships[0]; fellBack=true; }
  if (!active) throw reportAccess(new AccessError(403,'organization_not_authorized'));
  return {user,memberships,active,support,fellBack};
}
export async function authorizeSelection(port:IdentityPort, tenant:string) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(tenant)) throw new AccessError(403,'organization_not_authorized');
  return (await resolveSession(port,tenant)).active;
}
