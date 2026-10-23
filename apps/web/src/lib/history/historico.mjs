// Textos de cliente para Histórico: estado del procesamiento y vínculos ticket–contacto en español claro. Los códigos internos nunca se muestran tal cual.
export const ESTADO_VINCULO=Object.freeze({pending:'Sin identificar',resolved:'Vinculado',blocked:'Requiere revisión',retained:'Datos sujetos a retención'});
export const FILTROS_VINCULO=Object.freeze([{value:'',label:'Todos'},{value:'pending',label:'Sin identificar'},{value:'resolved',label:'Vinculados'},{value:'blocked',label:'Por revisar'},{value:'retained',label:'Retenidos'}]);
const MOTIVOS=Object.freeze({
 UNIQUE_EXPLICIT_BRIDGE:'Vinculado con certeza: el ticket cita de forma explícita un único contacto.',
 ENDPOINT_UNRESOLVED:'Sin identificar: todavía no se encuentra el cliente o la conversación a la que apunta.',
 EVIDENCE_CONFLICT:'La evidencia se contradice: necesita la revisión del propietario.',
 OWNER_DECISION:'Decidido por el propietario tras revisar la evidencia.',
 SOURCE_RETAINED:'El archivo de origen está retenido y no se puede volver a comprobar.',
 RETENTION_POLICY_REQUIRED:'Falta una política de retención para poder decidir.',
 RETENTION_SCOPE_LIMIT:'Queda fuera del alcance de retención configurado.'});
/** Código interno -> frase en español. Un código desconocido no se muestra crudo: se dice que hay un motivo registrado. */
export function motivoVinculo(codigo){if(!codigo)return '';return MOTIVOS[codigo]??'Motivo registrado por el sistema (consulta el detalle técnico).';}
/** «117,719 hechos (resueltos 15,189 · pendientes 102,530 · por revisar 0 · retenidos 0)» -> vocabulario de cliente. */
export function detalleAsociaciones(texto){
 return String(texto??'').replace(/\bhechos\b/g,'relaciones').replace(/\bresueltos\b/g,'vinculadas').replace(/\bpendientes\b/g,'sin identificar').replace(/\bpor revisar\b/g,'por revisar').replace(/\bretenidos\b/g,'retenidas').replace(/\bvínculos activos\b/g,'vínculos activos');
}
/**
 * Estado del procesamiento histórico en lenguaje claro. `lista` = el servicio está configurado y habilitado (capacidad real de autorizar).
 * Sin lotes no es una alarma: es «aún no se ha procesado». Solo se advierte si hay lotes que no pueden continuar.
 * @returns {{tone:'info'|'warn'|'ok',titulo:string,texto:string,puedeAutorizar:boolean}}
 */
export function estadoProcesamiento({lotes,lista}){
 const puedeAutorizar=Boolean(lista);
 if(lotes===0)return lista
  ?{tone:'info',titulo:'Aún no se ha procesado el histórico.',texto:'Cuando el propietario lo autorice, las conversaciones históricas se analizarán por lotes y aparecerán aquí.',puedeAutorizar}
  :{tone:'info',titulo:'El análisis del histórico todavía no está activado en este espacio.',texto:'No afecta a los vínculos entre tickets y clientes de abajo, que ya están cargados.',puedeAutorizar};
 return lista
  ?{tone:'ok',titulo:'El procesamiento del histórico está disponible.',texto:'Los lotes avanzan por su cuenta; aquí ves su avance.',puedeAutorizar}
  :{tone:'warn',titulo:'El procesamiento del histórico está en pausa.',texto:'El servicio no está habilitado ahora, así que los lotes en curso no avanzan hasta que se active.',puedeAutorizar};
}
const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
/** «Lote del 18 oct 2026»; sin fecha válida, «Lote sin fecha». El id del lote va aparte, en el detalle técnico. */
export function tituloLote(createdAt){
 const t=Date.parse(createdAt??'');if(Number.isNaN(t))return 'Lote sin fecha';
 const d=new Date(t);return `Lote del ${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
