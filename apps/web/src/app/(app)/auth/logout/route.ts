import { NextRequest } from 'next/server';
import { ACTIVE_ORG, AccessError, SUPPORT_MARK, assertOrigin, config } from '../../../../lib/auth';
import { failure, localRedirect, requestAuth } from '../../../../lib/auth-http';
export async function POST(request:NextRequest) {
  try {
    const c=config();if(!c)throw new AccessError(503,'auth_not_configured');
    assertOrigin(request.headers.get('origin'),c.origin);
    const {client,finish}=requestAuth(request);
    // AUTH-05: la sesión de soporte («ver como») vive en la base por administrador, no por sesión de Auth. Se cierra ANTES de revocar los tokens
    // (después ya no hay JWT para autorizarlo). 'end' es idempotente; si el usuario no es administrador o falla, no bloquea el cierre de sesión.
    try {await Promise.race([client.rpc('platform_support',{p_input:{operation:'end'}}),new Promise(resolve=>setTimeout(resolve,2000))]);} catch {/* El cierre de sesión no depende de esto. */}
    const {error}=await client.auth.signOut({scope:'global'});
    // Never claim logout succeeded when Auth could not revoke refresh sessions.
    const response=finish(error ? failure(new AccessError(503,'logout_unavailable')) : localRedirect('/login'));
    for(const {name} of request.cookies.getAll()) {
      if(name===ACTIVE_ORG || name===SUPPORT_MARK || name==='vexa_push_device' || name.startsWith('sb-'))response.cookies.set(name,'',{httpOnly:true,secure:c.secure,sameSite:'lax',path:'/',maxAge:0});
    }
    response.cookies.set(ACTIVE_ORG,'',{path:'/',maxAge:0});
    response.cookies.set(SUPPORT_MARK,'',{httpOnly:true,secure:c.secure,sameSite:'lax',path:'/',maxAge:0});
    response.headers.set('Clear-Site-Data','"cache", "cookies", "storage"');
    return response;
  } catch(error) {return failure(error);}
}
