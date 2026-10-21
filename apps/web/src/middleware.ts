import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_ORG, AccessError, config as authConfig, identity, PRIVATE_HEADERS, resolveSession } from './lib/auth';
import { failure, localRedirect, requestAuth } from './lib/auth-http';
function authLinkHeaders(request:NextRequest,response:NextResponse) {
  if (/^\/auth\/(?:invitations|email)(?:\/|$)/.test(request.nextUrl.pathname)) response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
export async function middleware(request:NextRequest) {
  try {
    const c=authConfig();
    const path=request.nextUrl.pathname;
    const platformRoute=path==='/platform'||path.startsWith('/platform/');
    const dataRoute=(platformRoute||path==='/cfo'||path.startsWith('/cfo/'))&&/\/data(\/|$)/.test(path);
    const protectedRoute=platformRoute||path==='/'||/^\/(overview|problems|customers|recommendations|explorer|preguntale|interventions|briefs|cfo)(\/|$)/.test(path);
    if(!c || !protectedRoute)return authLinkHeaders(request,NextResponse.next({headers:PRIVATE_HEADERS}));
    const {client,finish}=requestAuth(request);
    try {
      if(platformRoute){const verified=await client.auth.getUser();if(verified.error||!verified.data.user)throw new AccessError(401,'identity_required');}
      else await resolveSession(identity(client),request.cookies.get(ACTIVE_ORG)?.value);
      return finish(NextResponse.next({request:{headers:request.headers}}));
    } catch(error) {
      if(dataRoute&&error instanceof AccessError&&(error.status===401||error.status===403))return finish(failure(error));
      if(error instanceof AccessError && error.status===401)return finish(localRedirect('/login'));
      if(error instanceof AccessError && error.status===403)return finish(localRedirect('/login?error=access_denied'));
      return finish(failure(error));
    }
  } catch(error) {return authLinkHeaders(request,failure(error));}
}
export const config = { runtime: 'nodejs', matcher: ['/', '/platform', '/platform/:path*', '/cfo/:path*', '/login', '/auth/:path*', '/overview/:path*', '/problems/:path*', '/customers/:path*', '/recommendations/:path*', '/explorer/:path*', '/preguntale/:path*', '/interventions/:path*', '/briefs/:path*'] };
