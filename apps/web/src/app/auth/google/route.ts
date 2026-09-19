import { NextRequest, NextResponse } from 'next/server';
import { AccessError, assertOrigin, config } from '../../../lib/auth';
import { failure, requestAuth } from '../../../lib/auth-http';
export async function POST(request:NextRequest) {
  try {
    const c=config();if(!c)throw new AccessError(503,'auth_not_configured');
    assertOrigin(request.headers.get('origin'),c.origin);
    if(process.env.VEXA_GOOGLE_AUTH_ENABLED!=='true')throw new AccessError(503,'google_not_configured');
    const {client,finish}=requestAuth(request);
    try {
      const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('/auth/callback',c.origin).href,skipBrowserRedirect:true}});
      if(error || !data.url)throw new AccessError(503,'google_unavailable');
      return finish(NextResponse.redirect(data.url,303));
    } catch(error) {return finish(failure(error));}
  } catch(error) {return failure(error);}
}
