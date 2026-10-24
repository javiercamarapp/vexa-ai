import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_ORG, AccessError, SUPPORT_MARK, config as authConfig, identity, PRIVATE_HEADERS, resolveSession } from './lib/auth';
import { supportMarkActive, supportVerdict } from './lib/support-guard';
import { failure, localRedirect, requestAuth } from './lib/auth-http';
function authLinkHeaders(request:NextRequest,response:NextResponse) {
  if (/^\/auth\/(?:invitations|email)(?:\/|$)/.test(request.nextUrl.pathname)) response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
const protectedPathPrefix=(path:string)=>/^\/(overview|problems|customers|recommendations|explorer|preguntale|interventions|briefs|cfo)(\/|$)/.test(path);
export async function middleware(request:NextRequest) {
  try {
    const c=authConfig();
    const path=request.nextUrl.pathname;
    // «Ver como» (solo lectura): con la marca vigente se rechazan escrituras y exportaciones. Sin marca, las rutas /api siguen exactamente como antes.
    if(supportMarkActive(request.cookies.get(SUPPORT_MARK)?.value)&&(path.startsWith('/api/')||path==='/'||protectedPathPrefix(path))){
      const verdict=supportVerdict(request.method,path);
      if(!verdict.ok)return NextResponse.json({error:{code:verdict.code,message:'Modo soporte: solo lectura.',retryable:false}},{status:403,headers:PRIVATE_HEADERS});
    }
    if(path.startsWith('/api/'))return NextResponse.next();
    const platformRoute=path==='/platform'||path.startsWith('/platform/');
    const dataRoute=(platformRoute||path==='/cfo'||path.startsWith('/cfo/'))&&/\/data(\/|$)/.test(path);
    const identityRoute=path==='/seguridad'||path==='/sin-acceso';
    const protectedRoute=platformRoute||identityRoute||path==='/'||/^\/(overview|problems|customers|recommendations|explorer|preguntale|interventions|briefs|cfo)(\/|$)/.test(path);
    if(!c || !protectedRoute)return authLinkHeaders(request,NextResponse.next({headers:PRIVATE_HEADERS}));
    const {client,finish}=requestAuth(request);
    try {
      if(platformRoute||identityRoute){const verified=await client.auth.getUser();if(verified.error||!verified.data.user)throw new AccessError(401,'identity_required');}
      else {
        // Navegación de páginas: una cookie de organización revocada cae a una membresía válida (y se repara) en vez de dejar al usuario fuera.
        const session=await resolveSession(identity(client),request.cookies.get(ACTIVE_ORG)?.value,{fallback:true});
        // La petición en curso ya ve la organización reparada (así las lecturas del servidor no fallan una vez), y el navegador la recibe para las siguientes.
        if(session.fellBack)request.cookies.set(ACTIVE_ORG,session.active.tenant_id);
        const response=finish(NextResponse.next({request:{headers:request.headers}}));
        if(session.fellBack)response.cookies.set(ACTIVE_ORG,session.active.tenant_id,{httpOnly:true,secure:c.secure,sameSite:'lax',path:'/',maxAge:60*60*24*30});
        return response;
      }
      return finish(NextResponse.next({request:{headers:request.headers}}));
    } catch(error) {
      if(dataRoute&&error instanceof AccessError&&(error.status===401||error.status===403))return finish(failure(error));
      if(error instanceof AccessError && error.status===401)return finish(localRedirect('/login'));
      if(error instanceof AccessError && error.status===403)return finish(localRedirect('/sin-acceso'));
      return finish(failure(error));
    }
  } catch(error) {return authLinkHeaders(request,failure(error));}
}
export const config = { runtime: 'nodejs', matcher: ['/', '/seguridad', '/sin-acceso', '/api/:path*', '/platform', '/platform/:path*', '/cfo/:path*', '/login', '/auth/:path*', '/overview/:path*', '/problems/:path*', '/customers/:path*', '/recommendations/:path*', '/explorer/:path*', '/preguntale/:path*', '/interventions/:path*', '/briefs/:path*'] };
