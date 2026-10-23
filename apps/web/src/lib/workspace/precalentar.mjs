// Qué lecturas pide cada pantalla principal, con la MISMA URL que usa su panel (así la clave de la caché coincide y la visita siguiente es instantánea).
// Se usa para precalentar con prioridad baja: al pasar el cursor/foco por el menú y, tras cargar el Resumen, en inactividad.
import {precalentar} from './swr.mjs';
/** Consulta fijada de un corte (idéntica para Recomendaciones, Brief y Explorador). */
export function consultaFijada(scope,snapshotId,scopeHash){
 const q=new URLSearchParams({date_start:scope.date_start.slice(0,10),date_end:scope.date_end.slice(0,10),timezone:scope.timezone,date_basis:scope.date_basis,currency:scope.currency,basis:scope.basis??'net',snapshot_id:snapshotId,scope_hash:scopeHash});
 if(scope.exponent!==null&&scope.exponent!==undefined)q.set('exponent',String(scope.exponent));
 for(const sku of scope.sku)q.append('sku',sku);
 for(const source of scope.source)q.append('source',source);
 return q;
}
const sin=(valor,claves)=>{const q=new URLSearchParams(valor);for(const k of claves)q.delete(k);return q;};
export const LIMPIAR_RECOMENDACIONES=['problem_id','detail_hash','resource','format','cursor','limit','root_kind','root_id','component_id','event_id'];
export const LIMPIAR_BRIEFS=['resource','format','problem_id','detail_hash','root_kind','root_id','component_id','event_id','q','status','order'];
const validaBundle=j=>{const d=j?.data;return d&&Array.isArray(d.items)&&d.meta?.scope?j:null;};
const validaMeta=j=>j?.data?.meta?.scope?j:null;
const validaLista=j=>{const d=j?.data;return d&&Array.isArray(d.items)?j:null;};
const validaCfo=j=>{const d=j?.data;return d&&(d.status==='ok'||d.status==='empty'||d.status==='timeout')?j:null;};
/** Paso de fijación del alcance (publicación + hash) y, con su respuesta, la lectura de datos. */
const dosPasos=(limpiar,quitarCursor,rutaDatos,valida)=>consulta=>{
 const q=sin(consulta,limpiar);if(quitarCursor)q.delete('cursor');q.set('resource','problems');q.set('meta_only','1');
 return {url:'/api/workspace?'+q.toString(),valida:validaMeta,luego:json=>{const m=json?.data?.meta;return m?.scope&&m.snapshot_id&&m.scope_hash?[{url:rutaDatos+'?'+consultaFijada(m.scope,m.snapshot_id,m.scope_hash).toString(),valida}]:null;}};
};
/** Lecturas de una pantalla a partir de la consulta de alcance (la misma que el menú propaga). [] si la pantalla no se precalienta. */
export function lecturasDePantalla(ruta,consulta=''){
 switch(ruta){
  case '/problems':{const q=new URLSearchParams(consulta);q.delete('resource');q.delete('format');q.set('resource','problems');return [{url:'/api/workspace?'+q.toString(),valida:validaBundle}];}
  case '/recommendations':return [dosPasos(LIMPIAR_RECOMENDACIONES,false,'/api/recommendations',j=>j?.data&&Array.isArray(j.data.items)&&Array.isArray(j.data.problemOptions)?j:null)(consulta)];
  case '/briefs':{
   const q=sin(consulta,LIMPIAR_BRIEFS);
   if(q.get('snapshot_id')&&q.get('scope_hash'))return [{url:'/api/briefs?'+q.toString(),valida:validaLista}];
   q.delete('cursor');return [dosPasos(LIMPIAR_BRIEFS,true,'/api/briefs',validaLista)(consulta)];
  }
  case '/cfo':return [{url:'/cfo/data/report',valida:validaCfo}];
  default:return [];
 }
}
export const PANTALLAS_PRINCIPALES=['/problems','/recommendations','/briefs','/cfo'];
/** Precalienta (prioridad baja, máximo 2 a la vez, sin duplicar lo que ya está fresco o en vuelo). Devuelve cuántas lecturas puso en cola. */
export function precalentarPantallas(rutas,consulta='',opciones){
 return precalentar(rutas.flatMap(r=>lecturasDePantalla(r,consulta)),opciones);
}
/** Enlace del menú («/problems?date_start=…») -> precalienta esa pantalla. */
export function precalentarEnlace(href,opciones){
 const i=href.indexOf('?'),ruta=i<0?href:href.slice(0,i),consulta=i<0?'':href.slice(i+1);
 return precalentarPantallas([ruta],consulta,opciones);
}
