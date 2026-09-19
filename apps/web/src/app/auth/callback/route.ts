import { NextRequest } from 'next/server';
import { AccessError, config, safeNext } from '../../../lib/auth';
import { failure, localRedirect, requestAuth } from '../../../lib/auth-http';
export async function GET(request:NextRequest) {
  try {
    const c=config();if(!c)throw new AccessError(503,'auth_not_configured');
    const {client,finish}=requestAuth(request);
    try {
      const code=request.nextUrl.searchParams.get('code');
      const tokenHash=request.nextUrl.searchParams.get('token_hash');
      // PKCE code works with OAuth and email PKCE. Token-hash OTP is local-only.
      const local=['localhost','127.0.0.1','[::1]'].includes(new URL(c.url).hostname);
      if(code && tokenHash)throw new AccessError(400,'ambiguous_callback');
      const result=code ? await client.auth.exchangeCodeForSession(code)
        : tokenHash && local && request.nextUrl.searchParams.get('type')==='email'
          ? await client.auth.verifyOtp({token_hash:tokenHash,type:'email'}) : null;
      if(!result || result.error)throw new AccessError(401,'invalid_callback');
      const verified=await client.auth.getUser();
      if(verified.error || !verified.data.user)throw new AccessError(401,'invalid_callback');
      return finish(localRedirect(safeNext(request.nextUrl.searchParams.get('next'),c.origin)));
    } catch(error) {return finish(failure(error));}
  } catch(error) {return failure(error);}
}
