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
export function submitBlock(config:{ready:boolean;enabled:boolean},canConfigure:boolean,hasSelection:boolean):string|null{
 if(!config.ready)return canConfigure?'Falta definir o actualizar los límites de consumo de IA. Ábrelos en «Límites y conciliación» (botón de esta pantalla) y guarda un límite global y otro de extracción.':'Los límites de consumo de IA de este espacio necesitan una revisión y solo un administrador puede hacerla. Pídesela al administrador del espacio; mientras tanto no se pueden pedir análisis nuevos y los ya terminados siguen disponibles.';
 if(!config.enabled)return canConfigure?'El proveedor de IA está desactivado. Actívalo en «Límites y conciliación» solo después de autorizar la política y el consumo.':'El proveedor de IA está desactivado por el administrador del espacio; los análisis ya terminados siguen disponibles.';
 if(!hasSelection)return 'Elige una conversación para solicitar el análisis.';
 return null;
}
