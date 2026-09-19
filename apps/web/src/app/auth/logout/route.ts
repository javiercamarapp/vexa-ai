import { NextRequest } from 'next/server';
import { ACTIVE_ORG, AccessError, assertOrigin, config } from '../../../lib/auth';
import { failure, localRedirect, requestAuth } from '../../../lib/auth-http';
export async function POST(request:NextRequest) {
  try {
    const c=config();if(!c)throw new AccessError(503,'auth_not_configured');
    assertOrigin(request.headers.get('origin'),c.origin);
    const {client,finish}=requestAuth(request);
    const {error}=await client.auth.signOut({scope:'global'});
    // Never claim logout succeeded when Auth could not revoke refresh sessions.
    const response=finish(error ? failure(new AccessError(503,'logout_unavailable')) : localRedirect('/login'));
    for(const {name} of request.cookies.getAll()) {
      if(name===ACTIVE_ORG || name.startsWith('sb-'))response.cookies.set(name,'',{httpOnly:true,secure:c.secure,sameSite:'lax',path:'/',maxAge:0});
    }
    response.cookies.set(ACTIVE_ORG,'',{path:'/',maxAge:0});
    response.headers.set('Clear-Site-Data','"cache", "cookies", "storage"');
    return response;
  } catch(error) {return failure(error);}
}
