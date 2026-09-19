import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_ORG, AccessError, config as authConfig, identity, PRIVATE_HEADERS, resolveSession } from './lib/auth';
import { failure, localRedirect, requestAuth } from './lib/auth-http';
export async function middleware(request:NextRequest) {
  try {
    const c=authConfig();
    const protectedRoute=request.nextUrl.pathname==='/'||/^\/(overview|problems|customers|recommendations|explorer|interventions|briefs)(\/|$)/.test(request.nextUrl.pathname);
    if(!c || !protectedRoute)return NextResponse.next({headers:PRIVATE_HEADERS});
    const {client,finish}=requestAuth(request);
    try {
      await resolveSession(identity(client),request.cookies.get(ACTIVE_ORG)?.value);
      return finish(NextResponse.next({request:{headers:request.headers}}));
    } catch(error) {
      if(error instanceof AccessError && (error.status===401 || error.status===403))return finish(localRedirect('/login?error=access_denied'));
      return finish(failure(error));
    }
  } catch(error) {return failure(error);}
}
export const config = { runtime: 'nodejs', matcher: ['/', '/login', '/auth/:path*', '/overview/:path*', '/problems/:path*', '/customers/:path*', '/recommendations/:path*', '/explorer/:path*', '/interventions/:path*', '/briefs/:path*'] };
