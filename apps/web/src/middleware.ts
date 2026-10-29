import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_ORG, AccessError, SUPPORT_MARK, config as authConfig, identity, PRIVATE_HEADERS, resolveSession } from './lib/auth';
import { supportMarkActive, supportVerdict } from './lib/support-guard';
import { failure, localRedirect, requestAuth } from './lib/auth-http';
import { decidirHost, rutaConAutenticacion } from './lib/host-routing.mjs';
import { registrar } from './lib/security/registro';
function authLinkHeaders(request:NextRequest,response:NextResponse) {
  if (/^\/auth\/(?:invitations|email)(?:\/|$)/.test(request.nextUrl.pathname)) response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
const protectedPathPrefix=(path:string)=>/^\/(overview|problems|customers|recommendations|explorer|preguntale|interventions|briefs|cfo)(\/|$)/.test(path);
export async function middleware(request:NextRequest) {
  try {
    const path=request.nextUrl.pathname;
    // Ruta y método para el registro de seguridad aguas abajo (sin consulta). La IP y el agente se leen de las cabeceras originales.
    try{request.headers.set('x-vexa-route',request.method+' '+path);}catch{/* cabecera inmutable: el registro pierde la ruta, nada más */}
    // Host primero (decisión pura y probada en host-routing.mjs). Con las reglas por host de next.config (Fase A) rovaq.ai y www.rovaq.ai ya no llegan aquí: el matcher los excluye.
    // Lo que sigue sirve a app.rovaq.ai y a los hosts antiguos, y es también el respaldo (Fase B) si rovaq.ai volviera a pasar por el middleware.
    const decision=decidirHost({host:request.headers.get('x-forwarded-host')??request.headers.get('host')??request.nextUrl.host,pathname:path,search:request.nextUrl.search,produccion:process.env.VERCEL_ENV==='production'});
    if(decision.tipo==='reescribir')return NextResponse.rewrite(new URL(decision.destino+request.nextUrl.search,request.url));
    if(decision.tipo==='redirigir')return NextResponse.redirect(new URL(decision.url,request.url),decision.status);
    if(decision.tipo==='activo')return NextResponse.next();
    // El matcher ahora cubre todo menos estáticos; lo que antes no pasaba por aquí sigue sin tocarse.
    if(!rutaConAutenticacion(path))return NextResponse.next();
    const c=authConfig();
    // «Ver como» (solo lectura): con la marca vigente se rechazan escrituras y exportaciones. Sin marca, las rutas /api siguen exactamente como antes.
    if(supportMarkActive(request.cookies.get(SUPPORT_MARK)?.value)&&(path.startsWith('/api/')||path==='/'||protectedPathPrefix(path))){
      const verdict=supportVerdict(request.method,path,request.nextUrl.search);
      if(!verdict.ok){void registrar({kind:'support_blocked',route:path,method:request.method,ipRaw:request.headers.get('x-forwarded-for'),ua:request.headers.get('user-agent'),detail:{code:verdict.code}});}
      if(!verdict.ok)return NextResponse.json({error:{code:verdict.code,message:'Modo soporte: solo lectura.',retryable:false}},{status:403,headers:PRIVATE_HEADERS});
    }
    if(path.startsWith('/api/'))return NextResponse.next({request:{headers:request.headers}});
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
// Matcher (Fase B vigente): todo menos estáticos y activos públicos; rovaq.ai y www pasan por aquí y decidirHost los enruta. Fase A: añadir `missing: [{ type: 'header', key: 'host', value: '(www\\\\.)?rovaq\\\\.ai' }]`. Next exige que sea un literal estático:
// config/sitio/reglas-host.mjs guarda el mismo valor como MATCHER_MIDDLEWARE y una prueba los compara.
// En app.rovaq.ai, rutaConAutenticacion() conserva la lista anterior: lo demás no se toca.
export const config = { runtime: 'nodejs', matcher: [{ source: '/((?!_next/static|_next/image|fonts/|brand/|images/|vendor/|s/).*)' }] };
