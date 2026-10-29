import {mensajeError} from './i18n/errores-api';
import type {Idioma} from './i18n/idioma';
// Presentación de /analysis: los trabajos de una misma conversación se agrupan (una tarjeta, todas las evidencias) y el motivo por el que no se
// puede solicitar un análisis se dice con su salida (quién puede actuar y dónde).
export type AnalysisJob={id:string;runId:string|null;conversationId:string;state:string;runStatus:string|null;reason:string|null};
export type JobGroup={conversationId:string;jobs:AnalysisJob[];runIds:string[];state:string};
// Más urgente primero: lo que requiere acción o está en curso gana sobre lo terminado.
const PRIORITY=['failed','running','queued','succeeded','cancelled'];
export function groupJobs(jobs:AnalysisJob[]):JobGroup[]{
 const by=new Map<string,AnalysisJob[]>();
 for(const job of jobs)by.set(job.conversationId,[...(by.get(job.conversationId)??[]),job]);
 return [...by.entries()].map(([conversationId,list])=>({conversationId,jobs:list,runIds:list.filter(j=>j.runId&&['succeeded','abstained'].includes(j.runStatus??'')).map(j=>j.runId as string),state:[...list].sort((a,b)=>PRIORITY.indexOf(a.state)-PRIORITY.indexOf(b.state))[0].state}));
}
/** Motivo (con salida) por el que «Solicitar análisis» está deshabilitado; null si se puede solicitar. */
export function submitBlock(config:{ready:boolean;enabled:boolean},canConfigure:boolean,hasSelection:boolean,idioma:Idioma='es'):string|null{
 const m=(c:Parameters<typeof mensajeError>[1])=>mensajeError(idioma,c);
 if(!config.ready)return canConfigure?m('tr.err.iaLimitesFaltan'):m('tr.err.iaLimitesAdmin');
 if(!config.enabled)return canConfigure?m('tr.err.iaProveedorOff'):m('tr.err.iaProveedorOffAdmin');
 if(!hasSelection)return m('tr.err.iaEligeConv');
 return null;
}
