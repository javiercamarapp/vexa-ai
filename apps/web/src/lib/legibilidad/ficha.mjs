// Lógica PURA de la ficha de problema (sin red, sin React). Honestidad: lo desconocido es null y nunca se convierte en 0.
import {etiquetaCategoria} from './categorias.mjs';
const nf=new Intl.NumberFormat('es-MX');
export const IMPACTO_NO_DISPONIBLE='Impacto económico: No disponible. Aparece cuando se conecten pedidos con clientes.';
const INTERVENCION={draft:'Borrador',approved:'Plan aprobado',active:'En ejecución',measuring:'En medición',closed:'Medición cerrada',cancelled:'Cancelada'};
const RECOMENDACION={proposed:'Propuesta',dismissed:'Descartada',accepted:'Aceptada',implemented:'Implementada'};
export const etiquetaIntervencion=s=>s?INTERVENCION[s]??String(s):null;
export const etiquetaRecomendacion=s=>RECOMENDACION[s]??String(s??'');
/** Estado de intervención de una recomendación: «Sin intervención» solo cuando la parte respondió y no hay ninguna; null no se inventa. */
export const estadoIntervencion=rec=>!rec?null:rec.intervention?etiquetaIntervencion(rec.intervention):'Sin intervención';
const CLASES=[['imagen','imagen','imágenes'],['video','video','videos'],['audio','audio','audios'],['documento','documento','documentos'],['otro','otro','otros']];
/** Adjuntos asociados a las conversaciones del grupo: cifra, desglose por clase y la cobertura global del enlace (cuántos adjuntos de conversación están enlazados a alguna). */
export function resumenAdjuntos(att){
 if(!att||att.state!=='ok')return {valor:null,detalle:'No disponible ahora',nota:null};
 const partes=CLASES.filter(([k])=>att.porClase?.[k]>0).map(([k,uno,varios])=>`${nf.format(att.porClase[k])} ${att.porClase[k]===1?uno:varios}`);
 const nota=att.cobertura&&att.cobertura.total>0?`Solo ${nf.format(att.cobertura.enlazados)} de ${nf.format(att.cobertura.total)} adjuntos de conversación están enlazados a una conversación; la cifra no incluye el resto.`:null;
 return {valor:att.total,detalle:att.total>0?partes.join(' · ')+` en ${nf.format(att.conversaciones)} ${att.conversaciones===1?'conversación':'conversaciones'}`:'Ninguno enlazado a las conversaciones de este grupo',nota};
}
/** Serie mensual de conversaciones del grupo para la gráfica; los meses incompletos (completeness.partialMonths) quedan rotulados y NO entran en la comparación. */
export function serieConversaciones(vista){
 if(!vista||vista.status!=='ok'||!Array.isArray(vista.series))return null;
 const parciales=new Set(vista.completeness?.partialMonths??[]);
 return vista.series.map(p=>({month:p.month,value:Number.isFinite(p.conversations)?p.conversations:null,partial:parciales.has(p.month)}));
}
/** Cambio entre los dos últimos meses COMPLETOS con datos: null si no hay base honesta. */
export function cambioMensual(serie){
 const c=(serie??[]).filter(p=>!p.partial&&p.value!==null);
 if(c.length<2)return null;
 const a=c[c.length-2],b=c[c.length-1];
 if(a.value<=0)return {de:a,a:b,pct:null};
 return {de:a,a:b,pct:Math.round((b.value-a.value)*1000/a.value)/10};
}
/** Encabezado: categoría en español, grupo, severidad y motivo de la revisión crítica. */
export function encabezadoFicha(f,etiquetaMotivo){
 if(!f)return null;
 const cat=etiquetaCategoria(f.label),g=f.grupo&&f.grupo.de>1?`Grupo ${f.grupo.n} de ${f.grupo.de}`:f.grupo?'Único grupo':null;
 return {categoria:cat,grupo:g,
  critico:f.critical==null?null:f.critical.critical,
  motivo:f.critical?.critical?etiquetaMotivo?.(f.critical.reason)??null:null,
  senales:f.critical?.critical?f.critical.signals:null};
}
