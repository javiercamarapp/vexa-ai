import 'server-only';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {createRuntime} from '../../../../../packages/jobs/durable/runtime.mjs';
import {createPainPointsRepository} from '../../../../../packages/workspace-service/pain-points.mjs';
import {createPainAiStore} from '../../../../../packages/workspace-service/pain-points-ia-store.mjs';
import {createWeeklyService,limpiarTexto} from '../../../../../packages/workspace-service/pain-points-semanal.mjs';
import {entregaDesdeEntorno} from '../../../../../packages/notifications/weekly-send.mjs';

const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** Organizaciones del reporte: VEXA_WEEKLY_TENANTS (UUID separados por coma, máx. 20). Sin configurar: el disparador responde 503, no recorre «todas». */
export function tenantsSemanales(env:NodeJS.ProcessEnv=process.env){
 const ids=(env.VEXA_WEEKLY_TENANTS??'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!ids.length||ids.length>20||!ids.every(x=>UUID.test(x)))throw new Error('WEEKLY_CONFIGURATION_REQUIRED');
 return [...new Set(ids)];
}
/**
 * ACTOR DE SISTEMA: la identidad del worker (VEXA_WORKER_USER_ID, miembro del tenant) abre una sesión por organización con createRuntime (mismo camino que /api/internal/crm y /worker);
 * el reporte lee con 'read' y registra con 'import'. NO se usa el servicio de IA: solo se leen las lecturas ya guardadas. El envío real queda apagado salvo VEXA_WEEKLY_SEND=enabled.
 */
export async function ejecutarSemanal({deadlineAt}:{deadlineAt:number}){
 const tenants=tenantsSemanales();
 const entregar=await entregaDesdeEntorno(process.env);
 const resultados:unknown[]=[];
 for(const tenant of tenants){
  const worker=await createRuntime({...process.env,VEXA_WORKER_DISPATCHER:'disabled',VEXA_WORKER_TENANT:tenant},{createDatabase,pool:serverPool(),deadlineAt:Math.min(deadlineAt,Date.now()+40000),consumer:'notifications'});
  try{
   if(worker.idle)continue;
   const db=worker.database;
   let nombre:string|null=null;
   try{nombre=limpiarTexto((await db.transaction('read',(s:{tenantId:string;query:(t:string,v:unknown[])=>Promise<{rows:{name:string}[]}>})=>s.query('SELECT name FROM public.organizations WHERE id=$1',[s.tenantId]))).rows[0]?.name,40);}catch{nombre=null;}
   const svc=createWeeklyService({database:db,tenantId:tenant,vista:()=>createPainPointsRepository({database:db}).get(),store:createPainAiStore({database:db}),entregar,enviarActivo:Boolean(entregar),
    secret:process.env.VEXA_UNSUBSCRIBE_SECRET,appOrigin:process.env.VEXA_APP_ORIGIN??'',nombreEspacio:nombre??'tu espacio'});
   resultados.push({tenant,...await svc.ejecutar()});
  }finally{await worker.close();}
 }
 return resultados;
}
