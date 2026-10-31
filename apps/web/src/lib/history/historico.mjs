import {idiomaDe} from '../legibilidad/trad.mjs';
// Textos de cliente para Histórico: estado del procesamiento y vínculos ticket–contacto en español claro. Los códigos internos nunca se muestran tal cual.
export const ESTADO_VINCULO=Object.freeze({pending:'Sin identificar',resolved:'Vinculado',blocked:'Requiere revisión',retained:'Datos sujetos a retención'});
export const FILTROS_VINCULO=Object.freeze([{value:'',label:'Todos'},{value:'pending',label:'Sin identificar'},{value:'resolved',label:'Vinculados'},{value:'blocked',label:'Por revisar'},{value:'retained',label:'Retenidos'}]);
const MOTIVOS=Object.freeze({
 UNIQUE_EXPLICIT_BRIDGE:'Vinculado con certeza: el ticket cita de forma explícita un único contacto.',
 ENDPOINT_UNRESOLVED:'Sin identificar: todavía no se encuentra el cliente o la conversación a la que apunta.',
 EVIDENCE_CONFLICT:'La evidencia se contradice: necesita la revisión del administrador del espacio.',
 OWNER_DECISION:'Decidido por el administrador del espacio tras revisar la evidencia.',
 SOURCE_RETAINED:'El archivo de origen está retenido y no se puede volver a comprobar.',
 RETENTION_POLICY_REQUIRED:'Falta una política de retención para poder decidir.',
 RETENTION_SCOPE_LIMIT:'Queda fuera del alcance de retención configurado.'});
const MOTIVOS_EN=Object.freeze({
 UNIQUE_EXPLICIT_BRIDGE:'Linked with certainty: the ticket explicitly cites a single contact.',
 ENDPOINT_UNRESOLVED:'Not identified: the customer or conversation it points to has not been found yet.',
 EVIDENCE_CONFLICT:'The evidence contradicts itself: it needs the workspace administrator to review it.',
 OWNER_DECISION:'Decided by the workspace administrator after reviewing the evidence.',
 SOURCE_RETAINED:'The source file is retained and cannot be checked again.',
 RETENTION_POLICY_REQUIRED:'A retention policy is missing, so a decision cannot be made.',
 RETENTION_SCOPE_LIMIT:'It falls outside the configured retention scope.'});
/** Código interno -> frase en el idioma del traductor `t` (español sin traductor). Un código desconocido no se muestra crudo: se dice que hay un motivo registrado. */
export function motivoVinculo(codigo,t=null){if(!codigo)return '';const en=idiomaDe(t)==='en';return (en?MOTIVOS_EN:MOTIVOS)[codigo]??(en?'Reason recorded by the system (see the technical detail).':'Motivo registrado por el sistema (consulta el detalle técnico).');}
/** «117,719 hechos (resueltos 15,189 · pendientes 102,530 · por revisar 0 · retenidos 0)» -> vocabulario de cliente. */
export function detalleAsociaciones(texto,t=null){
 if(idiomaDe(t)==='en')return String(texto??'').replace(/\bhechos\b/g,'relations').replace(/\bresueltos\b/g,'linked').replace(/\bpendientes\b/g,'unidentified').replace(/\bpor revisar\b/g,'to review').replace(/\bretenidos\b/g,'held').replace(/\bvínculos activos\b/g,'active links').replace(/\bmuestra\b/g,'sample');
 return String(texto??'').replace(/\bhechos\b/g,'relaciones').replace(/\bresueltos\b/g,'vinculadas').replace(/\bpendientes\b/g,'sin identificar').replace(/\bpor revisar\b/g,'por revisar').replace(/\bretenidos\b/g,'retenidas').replace(/\bvínculos activos\b/g,'vínculos activos');
}
/**
 * Estado del procesamiento histórico en lenguaje claro. `lista` = el servicio está configurado y habilitado (capacidad real de autorizar).
 * Sin lotes no es una alarma: es «aún no se ha procesado». Solo se advierte si hay lotes que no pueden continuar.
 * @returns {{tone:'info'|'warn'|'ok',titulo:string,texto:string,puedeAutorizar:boolean}}
 */
export function estadoProcesamiento({lotes,lista},t=null){
 const puedeAutorizar=Boolean(lista);
 if(idiomaDe(t)==='en'){
  if(lotes===0)return lista
   ?{tone:'info',titulo:'The history has not been processed yet.',texto:'Once the workspace administrator authorizes it, the historical conversations will be analyzed in batches and will appear here.',puedeAutorizar}
   :{tone:'info',titulo:'History analysis is not enabled in this workspace yet.',texto:'It does not affect the ticket–customer links below, which are already loaded.',puedeAutorizar};
  return lista
   ?{tone:'ok',titulo:'History processing is available.',texto:'Batches move forward on their own; you can see their progress here.',puedeAutorizar}
   :{tone:'warn',titulo:'History processing is paused.',texto:'The service is not enabled right now, so batches in progress do not move forward until it is enabled.',puedeAutorizar};
 }
 if(lotes===0)return lista
  ?{tone:'info',titulo:'Aún no se ha procesado el histórico.',texto:'Cuando el administrador del espacio lo autorice, las conversaciones históricas se analizarán por lotes y aparecerán aquí.',puedeAutorizar}
  :{tone:'info',titulo:'El análisis del histórico todavía no está activado en este espacio.',texto:'No afecta a los vínculos entre tickets y clientes de abajo, que ya están cargados.',puedeAutorizar};
 return lista
  ?{tone:'ok',titulo:'El procesamiento del histórico está disponible.',texto:'Los lotes avanzan por su cuenta; aquí ves su avance.',puedeAutorizar}
  :{tone:'warn',titulo:'El procesamiento del histórico está en pausa.',texto:'El servicio no está habilitado ahora, así que los lotes en curso no avanzan hasta que se active.',puedeAutorizar};
}
const MESES_EN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
/** «Lote del 18 oct 2026»; sin fecha válida, «Lote sin fecha». El id del lote va aparte, en el detalle técnico. */
export function tituloLote(createdAt,tr=null){
 const t=Date.parse(createdAt??''),en=idiomaDe(tr)==='en';if(Number.isNaN(t))return en?'Batch with no date':'Lote sin fecha';
 const d=new Date(t);if(en)return `Batch of ${MESES_EN[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;return `Lote del ${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
