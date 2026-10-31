// Lógica PURA de la presentación del Brief (sin red, base ni React). Una sola fuente de verdad para titular, cifras,
// prioridades, «Qué hacer» y «Qué vigilar»: todo sale de las prioridades (top3) y de la selección registrada en el documento.
// Honestidad: desconocido no es 0; un subtotal conocido se rotula «no es el total»; sin registros elegibles es «Sin cobertura».
import {etiquetaCategoria} from './categorias.mjs';
import {idiomaDe} from './trad.mjs';
const entero=v=>typeof v==='string'&&/^-?\d+$/.test(v);
/** Cómo se muestra una cifra del brief. tipo: exacta | subtotal | sin_cobertura | desconocida. `valor` es el importe o null. */
export function cifraBrief(metric){
 const known=metric?.coverage?.known_n,eligible=metric?.coverage?.eligible_n;
 if(entero(metric?.amount_minor))return {tipo:'exacta',valor:metric.amount_minor,rotulo:null};
 if(eligible===0)return {tipo:'sin_cobertura',valor:null,rotulo:'Sin registros elegibles en este alcance; no es cero.'};
 if(entero(metric?.known_subtotal)&&(known===undefined||known>0))return {tipo:'subtotal',valor:metric.known_subtotal,rotulo:'Subtotal conocido; no es el total.'};
 if(known===0)return {tipo:'sin_cobertura',valor:null,rotulo:'Ningún registro con importe conocido; no es cero.'};
 return {tipo:'desconocida',valor:null,rotulo:'Total desconocido.'};
}
/** Cifra con la que abre el brief: la exposición exacta, si no la primera cifra exacta, si no el primer subtotal conocido (rotulado). */
export function cifraTitular(metrics){
 const ms=metrics??[],porTipo=t=>ms.map(m=>({m,c:cifraBrief(m)})).filter(x=>x.c.tipo===t);
 const exacta=porTipo('exacta').find(x=>x.m.kind==='exposure')??porTipo('exacta')[0];
 if(exacta)return {...exacta,tipo:'exacta'};
 const sub=porTipo('subtotal')[0];
 return sub?{...sub,tipo:'subtotal'}:null;
}
const BASE='Orden por cantidad de evidencia, sin estimación de riesgo';
export const etiquetaBase=p=>p.rankingBasis==='published_priority'?'Prioridad publicada':BASE;
/** «Qué hacer»: la acción registrada para la prioridad de mayor rango (mismo problema = mismo título). null si ninguna acción corresponde a las prioridades. */
export function accionPrincipal(top3,actions){
 for(const p of top3??[]){const a=(actions??[]).find(x=>x.title===p.title);if(a)return {accion:a,problema:p};}
 return null;
}
/** «Qué vigilar»: total de grupos con revisión crítica según la selección registrada y cuántos se detallan; sin selección (briefs antiguos) solo los listados. */
export function resumenVigilar(doc){
 const sel=doc?.selection,listados=(doc?.critical??[]).length;
 const total=Number.isSafeInteger(sel?.criticalCandidates)?sel.criticalCandidates:null;
 return {total,listados,omitidos:total!==null?Math.max(0,total-listados):null};
}
/** A6: la cifra del brief es la de SU momento (la selección guardada), no un conteo en vivo: se rotula «al guardarse el brief, <fecha>» y remite a Problemas, que cuenta con la definición única (critico.mjs). */
export function fraseVigilar(vig,fechaCorte,fraseGrupos){
 const al=fechaCorte?`Al guardarse este brief (${fechaCorte})`:'Al guardarse este brief';
 if(vig.total===null)return `${al} se listan ${fraseGrupos(vig.listados)}.`;
 return `${al} había ${fraseGrupos(vig.total)} (sin contar las notificaciones automáticas ocultas, mismo criterio que Problemas); este brief detalla los ${vig.listados} con más citas. Problemas recalcula con los datos de hoy y puede mostrar otra cifra.`;
}
/** Problemas críticos que NO están ya entre las prioridades (se muestran como lista breve, sin repetir tarjetas). */
export function criticosAparte(doc){
 const ya=new Set((doc?.top3??[]).map(p=>p.id));
 return {nuevos:(doc?.critical??[]).filter(p=>!ya.has(p.id)),repetidos:(doc?.critical??[]).filter(p=>ya.has(p.id))};
}
export const ESTADO_ACCION={proposed:'Propuesta',dismissed:'Descartada',draft:'Borrador',approved:'Aprobada',executing:'En ejecución',closed:'Cerrada',cancelled:'Cancelada'};
const ESTADO_ACCION_EN={proposed:'Proposed',dismissed:'Dismissed',draft:'Draft',approved:'Approved',executing:'In progress',closed:'Closed',cancelled:'Canceled'};
export const estadoAccion=(s,t=null)=>(idiomaDe(t)==='en'?ESTADO_ACCION_EN:ESTADO_ACCION)[s]??s;
export const tituloEs=(titulo,t=null)=>etiquetaCategoria(titulo,t);
