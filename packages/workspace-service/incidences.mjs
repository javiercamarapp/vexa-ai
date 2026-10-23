// Series de INCIDENCIAS para las gráficas del Resumen y del detalle de un problema. Solo lectura, acotado al tenant, bajo la sesión y la RLS del usuario.
//  (a) categories(): incidencias por categoría (issues.category, clasificación de la IA) en el alcance del tenant, con total y nº de categorías.
//  (b) monthly({problemId?}): incidencias por mes, para el total o para un problema (problem_embedding_members -> extraction_run_id -> issues).
// Vocabulario: «incidencias» = filas de issues (p. ej. 9,614); «problemas agrupados» = filas de problems (p. ej. 398). Nunca se mezclan ni se convierten entre sí.
// Fecha de una incidencia = fecha de su conversación: conversations.started_at o, si es nulo (≈99 % de las cargas históricas), el primer mensaje (messages.occurred_at).
// Rendimiento: una sola sentencia agregada por llamada, sin recorrer el libro ni verificar evidencia por corrida; tope local de statement_timeout. Si lo supera,
// responde status «timeout» (la vista dice «no disponible ahora») en vez de un 503. Funciona con los índices existentes (issues(tenant_id,extraction_run_id),
// messages(tenant_id,conversation_id)); la migración propuesta 20261023000000 solo los acelera y NO es necesaria.
import {WorkspaceError,uuid} from './contracts.mjs';
import {monthWindow,guarded} from './trends.mjs';
import {completitud} from '../metrics/complete-months.mjs';
export const INCIDENCE_TIMEOUT_MS=2500,MAX_CATEGORIES=100,INCIDENCE_MONTHS=12;
const SOURCE='Incidencias extraídas de las conversaciones y clasificadas por la IA (issues.category)';
const num=v=>Number(v??0);
/** Una sola pasada: filas por categoría + fila de total (is_total=1: incidencias y corridas distintas). */
export const CATEGORIES_SQL=`SELECT category,count(*) AS n,count(DISTINCT extraction_run_id) AS runs,grouping(category) AS is_total
 FROM public.issues WHERE tenant_id=$1 GROUP BY GROUPING SETS ((category),()) ORDER BY is_total DESC,n DESC,category LIMIT ${MAX_CATEGORIES + 2}`;
/** SQL de la serie mensual. $1 tenant, $2/$3 ventana, $4 problema (NULL = total). La fecha se resuelve UNA vez por conversación, no por incidencia. */
export const MONTHLY_SQL=`WITH scoped AS (
  SELECT r.conversation_id,count(*) AS n
  FROM public.issues i JOIN public.extraction_runs r ON r.tenant_id=i.tenant_id AND r.id=i.extraction_run_id
  WHERE i.tenant_id=$1 AND ($4::uuid IS NULL OR i.extraction_run_id IN (SELECT extraction_run_id FROM public.problem_embedding_members WHERE tenant_id=$1 AND problem_id=$4::uuid))
  GROUP BY r.conversation_id),
 dated AS (
  SELECT s.n,coalesce(c.started_at,fm.first_at) AS d
  FROM scoped s JOIN public.conversations c ON c.tenant_id=$1 AND c.id=s.conversation_id AND c.deleted_at IS NULL
  LEFT JOIN LATERAL (SELECT min(m.occurred_at) AS first_at FROM public.messages m WHERE m.tenant_id=$1 AND m.conversation_id=c.id AND m.deleted_at IS NULL) fm ON c.started_at IS NULL)
 SELECT CASE WHEN d>=$2 AND d<$3 THEN to_char(d AT TIME ZONE 'UTC','YYYY-MM') END AS month,sum(n) AS n,count(*) AS convs,max(d) AS last_at,sum(n) FILTER (WHERE d IS NULL) AS undated,
  (SELECT count(DISTINCT extraction_run_id) FROM public.problem_embedding_members WHERE tenant_id=$1 AND problem_id=$4::uuid) AS linked_runs
 FROM dated GROUP BY 1`;
/** Normaliza las filas del GROUPING SETS: la fila con is_total=1 trae el total y las corridas distintas. */
export function shapeCategories(raw){
 const total=raw.find(r=>num(r.is_total)===1),all=raw.filter(r=>num(r.is_total)!==1).map(r=>({category:r.category,count:num(r.n),runs:num(r.runs)}));
 const rows=all.slice(0,MAX_CATEGORIES);
 return {rows,totals:{incidences:total?num(total.n):all.reduce((a,r)=>a+r.count,0),categories:all.length,runs:total?num(total.runs):null},truncated:all.length>MAX_CATEGORIES};
}
/** Serie de 12 meses (ceros explícitos: es un conteo de incidencias detectadas) + fuera de ventana + sin fecha. */
export function shapeMonthly(raw,win){
 const by=new Map(raw.filter(r=>r.month).map(r=>[r.month,num(r.n)])),byConv=new Map(raw.filter(r=>r.month).map(r=>[r.month,num(r.convs)]));
 const nullRows=raw.filter(r=>!r.month),undated=raw.reduce((a,r)=>a+num(r.undated),0);
 return {series:win.list.map(m=>({month:m,count:by.get(m)??0,conversations:byConv.get(m)??0})),outsideWindow:nullRows.reduce((a,r)=>a+num(r.n),0)-nullRows.reduce((a,r)=>a+num(r.undated),0),undated,total:raw.reduce((a,r)=>a+num(r.n),0)};
}
export function createIncidencesRepository({database,now=()=>new Date(),timeoutMs=INCIDENCE_TIMEOUT_MS}){
 return {
  async categories(){
   return database.transaction('read',async s=>{
    const raw=await guarded(s,async()=>(await s.query(CATEGORIES_SQL,[s.tenantId])).rows,timeoutMs);
    const base={generatedAt:now().toISOString(),class:'inferred',unit:'incidencias',source:SOURCE,
     note:'Cuenta incidencias (filas de issues), no problemas agrupados. Las categorías las asigna la IA: son Inferido, no un hecho observado.'};
    if(raw===null)return {...base,status:'timeout',rows:[],totals:null,truncated:false};
    const shaped=shapeCategories(raw);
    return {...base,status:shaped.totals.incidences===0?'empty':'ok',...shaped};
   });
  },
  async monthly({problemId=null,months=INCIDENCE_MONTHS}={}){
   if(problemId!==null&&!uuid(problemId))throw new WorkspaceError('incidences_input_invalid',400);
   if(!Number.isInteger(months)||months<1||months>24)throw new WorkspaceError('incidences_input_invalid',400);
   const win=monthWindow(now(),months);
   return database.transaction('read',async s=>{
    const raw=await guarded(s,async()=>(await s.query(MONTHLY_SQL,[s.tenantId,win.start.toISOString(),win.end.toISOString(),problemId])).rows,timeoutMs);
    const base={generatedAt:now().toISOString(),scope:problemId?'problem':'total',problemId,class:'inferred',unit:'incidencias',definition:'started_at_or_first_message',source:SOURCE,
     window:{start:win.start.toISOString().slice(0,10),end:win.end.toISOString().slice(0,10),months},
     note:problemId?'Incidencias de las corridas de extracción vinculadas a este problema, por mes de su conversación (inicio o primer mensaje). Una corrida puede aportar incidencias de otras categorías; no es el volumen de clientes afectados ni una pérdida.'
      :'Incidencias por mes de su conversación (inicio o primer mensaje). No son problemas agrupados.'};
    if(raw===null)return {...base,status:'timeout',series:[],outsideWindow:null,undated:null,total:null,linkedRuns:null};
    const shaped=shapeMonthly(raw,win),linkedRuns=problemId?num(raw[0]?.linked_runs):null;
    // Meses completos: el último dato fechado del grupo dice hasta dónde llegan sus conversaciones (criterio único de packages/metrics/complete-months.mjs).
    const last=raw.map(r=>r.last_at).filter(Boolean).map(x=>Date.parse(x instanceof Date?x.toISOString():String(x))).filter(Number.isFinite),through=last.length?new Date(Math.max(...last)).toISOString():null;
    const completeness=completitud(shaped.series.map(p=>({month:p.month,count:p.conversations})),{dataThrough:through,ahora:now()});
    return {...base,status:shaped.total===0?'empty':'ok',...shaped,linkedRuns,completeness};
   });
  }
 };
}
