import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { AccessError, type IdentityPort, type Membership } from '@vexa/platform/session';
export { AccessError, assertOrigin, authorizeSelection, resolveSession, safeNext } from '@vexa/platform/session';
export const ACTIVE_ORG='vexa_active_org';
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
    cookieOptions:{path:'/',httpOnly:true,sameSite:'lax',secure:c.secure},
    global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})},
    cookies:{getAll:()=>jar.getAll(),setAll:updates=>{for(const {name,value,options} of updates)jar.set(name,value,options);}},
  });
}
export function identity(client:ReturnType<typeof authClient>):IdentityPort {
  return {
    async getUser(){const {data,error}=await client.auth.getUser();
      if(error) { if(error.status && error.status>=500) throw new AccessError(503,'auth_unavailable'); return null; }
      return data.user ? {id:data.user.id} : null;
    },
    async memberships(userId){const {data,error}=await client.from('memberships').select('tenant_id,user_id,role,status,permissions_version').eq('user_id',userId).eq('status','active').order('tenant_id');
      if(error) throw new AccessError(503,'membership_unavailable');
      return data as Membership[];
    },
  };
}
