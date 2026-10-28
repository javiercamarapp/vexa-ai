import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS} from '../auth';
import {requestAuth} from '../auth-http';
import {attempt} from '../../../../../packages/workspace-service/summaries.mjs';
import {consultaDeSenales,SENALES_SETUP_POR_ROL} from './senales-sql.mjs';
/** Roles que ven el indicador de conciliación (el dinero es de propietario y analista, como Hoy). */
const ROLES_DINERO=['owner','analyst'];
/**
 * GET /api/onboarding/setup: todo lo que necesita /setup en UN viaje de lectura: señales baratas (EXISTS) del rol y, para propietario y analista,
 * el total de pedidos del libro leído de un resumen PRECALCULADO (economic_ledger_counts); el libro no se cuenta ni se agrupa en esta ruta.
 * Solo lectura, sin parámetros. En «Ver como» (rol efectivo lector) no consulta nada.
 */
export async function setupOnboarding(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if(!config())throw new AccessError(503,'configuration_required');
  if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
  const auth=requestAuth(request);finish=auth.finish;
  const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:request.cookies.get(ACTIVE_ORG)?.value});
  const data=await database.transaction('read',async scope=>{
   const consulta=consultaDeSenales(scope.role,SENALES_SETUP_POR_ROL);
   let senales:Record<string,boolean>|null=null;
   if(consulta){
    const fila=(await scope.query<Record<string,boolean>>(consulta.texto,[scope.tenantId])).rows[0]??{};
    senales=Object.fromEntries(consulta.claves.map(k=>[k,fila[k]===true]));
   }
   let conciliacion:{resumen:string;pedidos:number|null;refreshedAt:string|null}={resumen:'no_aplica',pedidos:null,refreshedAt:null};
   if(ROLES_DINERO.includes(scope.role)){
    const r=await attempt(scope,async()=>{
     const estado=(await scope.query<{refreshed_at:Date|string}>("SELECT refreshed_at FROM public.summary_refresh_state WHERE tenant_id=$1 AND summary='ledger_counts' ORDER BY refreshed_at DESC LIMIT 1",[scope.tenantId])).rows[0];
     if(!estado)return null;
     const suma=(await scope.query<{n:string|null}>("SELECT COALESCE(sum(entities),0)::text AS n FROM public.economic_ledger_counts WHERE tenant_id=$1 AND kind='order'",[scope.tenantId])).rows[0];
     return {pedidos:Number(suma?.n??0),refreshedAt:new Date(estado.refreshed_at).toISOString()};
    });
    if(r.timeout)conciliacion={resumen:'timeout',pedidos:null,refreshedAt:null};
    else if(r.unavailable)conciliacion={resumen:'unavailable',pedidos:null,refreshedAt:null};
    else if(!r.value)conciliacion={resumen:'absent',pedidos:null,refreshedAt:null};
    else conciliacion={resumen:'ready',pedidos:r.value.pedidos,refreshedAt:r.value.refreshedAt};
   }
   return {rol:scope.role,senales,consultadas:consulta?.claves??[],conciliacion};
  });
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){
  const e=error as {status?:number};const status=[400,401,403,503].includes(e.status??0)?e.status!:503;
  return finish(NextResponse.json({error:{code:status===503?'setup_unavailable':'request_rejected'}},{status,headers:PRIVATE_HEADERS}));
 }
}
