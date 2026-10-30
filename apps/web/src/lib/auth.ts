import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { AccessError, type IdentityPort, type Membership } from '@vexa/platform/session';
export { AccessError, assertOrigin, authorizeSelection, resolveSession, safeNext } from '@vexa/platform/session';
export const ACTIVE_ORG='vexa_active_org';
/** B-03 (auditoría 4): la librería usa 400 días por omisión. La cookie de sesión dura como máximo 30 días; el límite real de la sesión (tiempo total e inactividad) se fija además en Supabase Auth (APLICAR.md §6). */
export const SESSION_COOKIE_MAX_AGE=60*60*24*30;
/** @supabase/ssr fuerza su Max-Age de 400 días al escribir la sesión e ignora cookieOptions.maxAge: se acota aquí, sin tocar las cookies que se borran (Max-Age 0). */
export function acotarVigencia(options:CookieOptions):CookieOptions{const m=options?.maxAge;return typeof m==='number'&&m>SESSION_COOKIE_MAX_AGE?{...options,maxAge:SESSION_COOKIE_MAX_AGE}:options;}
/** Marca (no autoridad) de que hay una sesión de soporte en curso: permite a la capa HTTP rechazar escrituras sin consultar la base. La base y db.ts son la defensa real. */
export const SUPPORT_MARK='vexa_support';
// Same-origin POST navigations need a non-null Origin; external destinations receive no referrer.
export const PRIVATE_HEADERS={'Cache-Control':'private, no-store, max-age=0, must-revalidate','Pragma':'no-cache','Expires':'0','Referrer-Policy':'same-origin'};
export function config() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const site=process.env.NEXT_PUBLIC_SITE_URL;
  if (!url && !key && !site) return null;
  if (!url || !key || !site) throw new AccessError(503,'auth_configuration_incomplete');
  let api:URL, app:URL;
  try { api=new URL(url); app=new URL(site); } catch { throw new AccessError(503,'auth_configuration_invalid'); }
  for(const parsed of [api,app]) {
    if (parsed.username || parsed.password || parsed.search || parsed.hash ||
        (parsed.protocol!=='https:' && !(parsed.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))))
      throw new AccessError(503,'auth_configuration_invalid');
  }
  if(app.pathname!=='/') throw new AccessError(503,'auth_configuration_invalid');
  return {url:api.toString(),key,origin:app.origin,secure:app.protocol==='https:'};
}
export type CookieJar={getAll():{name:string;value:string}[];set(name:string,value:string,options:CookieOptions):unknown};
export function authClient(jar:CookieJar) {
  const c=config(); if(!c) throw new AccessError(503,'auth_not_configured');
  return createServerClient(c.url,c.key,{
    cookieOptions:{path:'/',httpOnly:true,sameSite:'lax',secure:c.secure,maxAge:SESSION_COOKIE_MAX_AGE},
    global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})},
    cookies:{getAll:()=>jar.getAll(),setAll:updates=>{for(const {name,value,options} of updates)jar.set(name,value,acotarVigencia(options));}},
  });
}
/** R2-13: tope por usuario con el sub ya verificado por Auth; lanza AccessError 429. Importación diferida: el módulo del límite es solo de servidor. */
export async function cupoDeUsuario(sub:string):Promise<void>{
  const {exigirCupoUsuario}=await import('./security/limite-servidor');await exigirCupoUsuario(sub);
}
export function identity(client:ReturnType<typeof authClient>):IdentityPort {
  return {
    async getUser(){const {data,error}=await client.auth.getUser();
      if(error) { if(error.status && error.status>=500) throw new AccessError(503,'auth_unavailable'); return null; }
      if(data.user){await cupoDeUsuario(data.user.id);return {id:data.user.id};}
      return null;
    },
    async memberships(userId){const {data,error}=await client.from('memberships').select('tenant_id,user_id,role,status,permissions_version').eq('user_id',userId).eq('status','active').order('tenant_id');
      if(error) throw new AccessError(503,'membership_unavailable');
      return data as Membership[];
    },
    /** «Ver como»: la base responde si ESTE administrador tiene una sesión de soporte vigente (require_admin + caducidad). Cualquier error = sin soporte. */
    async support(){
      const {data,error}=await client.rpc('platform_support',{p_input:{operation:'active'}});
      const s=data?.session;
      if(error||data?.active!==true||!s) return null;
      return {session_id:s.id,tenant_id:s.tenantId,tenant_name:s.tenantName,expires_at:s.expiresAt,reason:s.reason};
    },
  };
}
