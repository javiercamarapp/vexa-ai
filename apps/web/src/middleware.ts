import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_ORG, AccessError, SUPPORT_MARK, config as authConfig, identity, PRIVATE_HEADERS, resolveSession } from './lib/auth';
import { supportMarkActive, supportVerdict } from './lib/support-guard';
import { failure, localRedirect, requestAuth } from './lib/auth-http';
import { decidirHost, rutaConAutenticacion } from './lib/host-routing.mjs';
import { registrar } from './lib/security/registro';
import { evaluarLimite } from './lib/security/limite-servidor';
import { espejoDeRuta, mapaEspejos } from './lib/sitio/espejos.mjs';
import manifestSitio from '../public/s/manifest.json';
// Espejos Markdown del sitio por ruta pública (negociación Accept: text/markdown en rovaq.ai). Se arma una vez al cargar el módulo.
const espejos=mapaEspejos((manifestSitio as {md?:Record<string,{url:string}>}).md??{});
const espejoDe=espejoDeRuta(espejos);
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
    // H-01: límite general por clase de endpoint, por IP y por sesión (contador compartido en la base). Va antes de leer cuerpos ni validar firmas (M-01, B-07).
    const exceso=evaluarLimite(request,path,request.nextUrl.search);
    if(exceso){
      void registrar({kind:'rate_limited',route:path,method:request.method,ipRaw:request.headers.get('x-forwarded-for'),ua:request.headers.get('user-agent'),detail:{class:exceso.clase,scope:exceso.por}});
      return NextResponse.json({error:{code:'rate_limited',message:'Demasiadas solicitudes. Intenta de nuevo en unos segundos.',retryable:true}},{status:429,headers:{...PRIVATE_HEADERS,'Retry-After':String(exceso.reintentarEn)}});
    }
    // Host primero (decisión pura y probada en host-routing.mjs). Con las reglas por host de next.config (Fase A) rovaq.ai y www.rovaq.ai ya no llegan aquí: el matcher los excluye.
    // Lo que sigue sirve a app.rovaq.ai y a los hosts antiguos, y es también el respaldo (Fase B) si rovaq.ai volviera a pasar por el middleware.
    const decision=decidirHost({host:request.headers.get('x-forwarded-host')??request.headers.get('host')??request.nextUrl.host,pathname:path,search:request.nextUrl.search,produccion:process.env.VERCEL_ENV==='production',accept:request.method==='GET'||request.method==='HEAD'?request.headers.get('accept')??'':null,espejoDe});
    if(decision.tipo==='reescribir'&&decision.markdown){
      // Mismo URL, representación Markdown (negociada por Accept). Las cabeceras de los archivos .md no corren para la URL original: se fijan aquí.
      const respuesta=NextResponse.rewrite(new URL(decision.destino,request.url));
      respuesta.headers.set('Content-Type','text/markdown; charset=utf-8');respuesta.headers.set('Vary','Accept');respuesta.headers.set('X-Robots-Tag','noindex');respuesta.headers.set('Cache-Control','public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
      respuesta.headers.set('Link','<'+(espejos.get(path)?.canonica??'https://rovaq.ai')+'>; rel="canonical"');
      return respuesta;
    }
    if(decision.tipo==='reescribir'){
      // 404 con HTML completo: una ruta desconocida, o una página del registro que aún no es publicable (no tiene espejo), se sirve desde el segmento __404 con estado 404.
      // (Con notFound() de Next el HTML sin JavaScript es el cascarón de error: sin lang, sin h1 y con el cuerpo vacío.)
      const publicable=!decision.noEncontrada&&(path==='/'||path==='/en'||espejoDe(path)!==null);
      if(!publicable){
        const destino=decision.noEncontrada?decision.destino:(path==='/en'||path.startsWith('/en/')?'/sitio/en/__404':'/sitio/es/__404');
        return NextResponse.rewrite(new URL(destino,request.url),{status:404});
      }
      const respuesta=NextResponse.rewrite(new URL(decision.destino+request.nextUrl.search,request.url));
      // Next fija su propio Vary en las páginas prerenderizadas, así que Vary: Accept no sale en el HTML; la caché no se mezcla porque el middleware corre antes de ella y el destino de la reescritura (HTML o .md) es la clave.
      return respuesta;
    }
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
      if(dataRoute&&error instanceof AccessError&&(error.status===401||error.status===403))return finish(failure(error,request));
      if(error instanceof AccessError && error.status===401)return finish(localRedirect('/login'));
      if(error instanceof AccessError && error.status===403)return finish(localRedirect('/sin-acceso'));
      return finish(failure(error,request));
    }
  } catch(error) {return authLinkHeaders(request,failure(error,request));}
}
// Matcher (Fase B vigente): todo menos estáticos y activos públicos; rovaq.ai y www pasan por aquí y decidirHost los enruta. Fase A: añadir `missing: [{ type: 'header', key: 'host', value: '(www\\\\.)?rovaq\\\\.ai' }]`. Next exige que sea un literal estático:
// config/sitio/reglas-host.mjs guarda el mismo valor como MATCHER_MIDDLEWARE y una prueba los compara.
// En app.rovaq.ai, rutaConAutenticacion() conserva la lista anterior: lo demás no se toca.
export const config = { runtime: 'nodejs', matcher: [{ source: '/((?!_next/static|_next/image|fonts/|brand/|images/|vendor/|s/).*)' }] };
