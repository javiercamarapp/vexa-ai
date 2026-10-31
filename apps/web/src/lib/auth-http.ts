import { NextRequest, NextResponse } from 'next/server';
import { AccessError, authClient, config, PRIVATE_HEADERS } from './auth';
import { reportAccess } from '@vexa/platform/session';
import { COOKIE_IDIOMA, resolverIdioma, type Idioma } from './i18n/idioma';
export function requestAuth(request:NextRequest) {
  const updates:Parameters<NextResponse['cookies']['set']>[]=[];
  const client=authClient({getAll:()=>request.cookies.getAll(),set:(name,value,options)=>{request.cookies.set(name,value);updates.push([name,value,options]);}});
  function finish(response:NextResponse){for(const args of updates)response.cookies.set(...args);for(const [key,value] of Object.entries(PRIVATE_HEADERS))response.headers.set(key,value);return response;}
  return {client,finish};
}
// El middleware no puede cargar el diccionario completo (límite de tamaño del borde): los dos únicos mensajes viajan aquí por idioma. El `code` estable NO cambia.
export const MENSAJES_ACCESO:Record<Idioma,{denegado:string;noValidado:string;limite:string;soporte:string}>={es:{denegado:'Acceso denegado.',noValidado:'No se pudo validar el acceso.',limite:'Demasiadas solicitudes. Intenta de nuevo en unos segundos.',soporte:'Modo soporte: solo lectura.'},en:{denegado:'Access denied.',noValidado:'Could not verify access.',limite:'Too many requests. Try again in a few seconds.',soporte:'Support mode: read-only.'}};
/** Idioma de la petición para los mensajes del middleware (solo la cookie). */
export const idiomaDelMiddleware=(request:Pick<NextRequest,'cookies'>):Idioma=>resolverIdioma({cookie:request.cookies.get(COOKIE_IDIOMA)?.value});
export function mensajeAcceso(status:number,idioma:Idioma) {return status===403?MENSAJES_ACCESO[idioma].denegado:MENSAJES_ACCESO[idioma].noValidado;}
export function failure(error:unknown,request?:Pick<NextRequest,'cookies'>) {
  if(error instanceof AccessError)reportAccess(error);
  const status=error instanceof AccessError?error.status:503;
  const code=error instanceof AccessError?error.code:'identity_unavailable';
  return NextResponse.json({error:{code,message:mensajeAcceso(status,resolverIdioma({cookie:request?.cookies.get(COOKIE_IDIOMA)?.value})),retryable:status===503}},{status,headers:PRIVATE_HEADERS});
}
export function localRedirect(path:string) {
  const c=config(); if(!c)throw new AccessError(503,'auth_not_configured');
  return NextResponse.redirect(new URL(path,c.origin),303);
}
