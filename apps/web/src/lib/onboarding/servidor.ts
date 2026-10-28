import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {consultaDeSenales} from './senales-sql.mjs';
/**
 * GET /api/onboarding/estado: señales baratas (EXISTS) para el checklist de la organización activa y el rol real de la sesión.
 * Lectura pura: sin parámetros, sin escrituras, una sola transacción de lectura. En «Ver como» (rol efectivo lector) no consulta nada.
 */
export async function estadoOnboarding(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const data=await database.transaction('read',async scope=>{
   const consulta=consultaDeSenales(scope.role);
   if(!consulta)return {rol:scope.role,senales:null};
   const fila=(await scope.query<Record<string,boolean>>(consulta.texto,[scope.tenantId])).rows[0]??{};
   return {rol:scope.role,senales:Object.fromEntries(consulta.claves.map(k=>[k,fila[k]===true]))};
  });
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error as {status?:number};const status=[400,401,403,503].includes(e.status??0)?e.status!:503;
  return finish(NextResponse.json({error:{code:status===503?'onboarding_unavailable':'request_rejected'}},{status,headers:PRIVATE_HEADERS}));
 }
}
