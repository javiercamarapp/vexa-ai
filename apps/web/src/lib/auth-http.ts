import { NextRequest, NextResponse } from 'next/server';
import { AccessError, authClient, config, PRIVATE_HEADERS } from './auth';
export function requestAuth(request:NextRequest) {
  const updates:Parameters<NextResponse['cookies']['set']>[]=[];
  const client=authClient({getAll:()=>request.cookies.getAll(),set:(name,value,options)=>{request.cookies.set(name,value);updates.push([name,value,options]);}});
  function finish(response:NextResponse){for(const args of updates)response.cookies.set(...args);for(const [key,value] of Object.entries(PRIVATE_HEADERS))response.headers.set(key,value);return response;}
  return {client,finish};
}
export function failure(error:unknown) {
  const status=error instanceof AccessError?error.status:503;
  const code=error instanceof AccessError?error.code:'identity_unavailable';
  return NextResponse.json({error:{code,message:status===403?'Acceso denegado.':'No se pudo validar el acceso.',retryable:status===503}},{status,headers:PRIVATE_HEADERS});
}
export function localRedirect(path:string) {
  const c=config(); if(!c)throw new AccessError(503,'auth_not_configured');
  return NextResponse.redirect(new URL(path,c.origin),303);
}
