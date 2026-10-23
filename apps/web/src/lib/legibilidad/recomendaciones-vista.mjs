// Presentación de las recomendaciones (sin red, sin React). NO modifica lo guardado: solo traduce etiquetas de la taxonomía en pantalla cuando es seguro
// (coincidencia exacta con una categoría conocida) y deriva el siguiente paso del estado real de la recomendación.
import {CATEGORIAS} from './categorias.mjs';
const PARES=Object.entries(CATEGORIAS).sort((a,b)=>b[0].length-a[0].length);
const escapa=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const RE=new RegExp('(?<![\\p{L}\\p{N}])('+PARES.map(([en])=>escapa(en)).join('|')+')(?![\\p{L}\\p{N}])','gu');
/** Reemplaza etiquetas inglesas EXACTAS de la taxonomía («Order: Spare Parts») por su etiqueta en español. El resto del texto queda intacto. */
export function traducirTaxonomia(texto){
 if(typeof texto!=='string'||!texto)return texto;
 return texto.replace(RE,m=>CATEGORIAS[m]??m);
}
const PRIORIDAD_URGENTE='critical';
/** Siguiente paso concreto según el estado real (no inventa fechas ni responsables). */
export function siguientePaso(item){
 if(!item)return null;
 if(item.status==='dismissed')return 'Descartada: reábrela solo si el problema reaparece.';
 if(item.stale)return 'Pedir una propuesta vigente: el problema o su evidencia cambió.';
 const tipos=new Set((item.flow?.events??[]).map(e=>e.kind));
 if(tipos.has('resolved'))return 'Resultado registrado: revisa la comparación si existe y cierra el seguimiento.';
 if(tipos.has('started'))return 'Registrar el resultado cuando la acción termine.';
 if(tipos.has('approved'))return 'Revisar los borradores de la acción, enviarlos por tu cuenta y marcar en curso.';
 if(item.flow?.available&&item.canMutate)return 'Decidir: Proceder, Ajustar o Descartar.';
 if(item.drafts?.length>0)return 'Revisar el borrador de intervención y aprobar su plan.';
 if(!item.canMutate)return 'Consulta: un analista, operador o propietario debe decidir.';
 return item.ownerId?'Crear una intervención borrador a partir de esta recomendación.':'Asignar un responsable y crear una intervención borrador.';
}
export const responsable=item=>item?.ownerId?'Asignado':'Sin asignar';
/** Resumen superior: propuestas, descartadas y críticas (revisión humana urgente) sobre las vigentes. */
export function resumenRecomendaciones(items){
 const l=Array.isArray(items)?items:[];
 const propuestas=l.filter(i=>i.status==='proposed'),descartadas=l.filter(i=>i.status==='dismissed');
 return {total:l.length,propuestas:propuestas.length,descartadas:descartadas.length,criticas:propuestas.filter(i=>i.priority===PRIORIDAD_URGENTE).length,sinResponsable:propuestas.filter(i=>!i.ownerId).length,conBorrador:propuestas.filter(i=>i.drafts?.length>0).length};
}

const CAUSAL_ES={unassessed:'sin evaluar',hypothesis:'causa probable, no confirmada',confirmed:'causa confirmada',retracted:'causa retractada',candidate:'candidata',supported:'con respaldo',unsupported:'sin respaldo',insufficient:'evidencia insuficiente'};
/** «unassessed» -> «Sin evaluar». Un estado desconocido se muestra tal cual (no se inventa una traducción). */
export function etiquetaCausal(estado){const e=CAUSAL_ES[estado];return e?e.charAt(0).toUpperCase()+e.slice(1):estado;}
/** Versión del generador vigente: las recomendaciones guardadas con otra son inmutables y se pueden regenerar (flujo de propuesta, con aprobación). */
export const GENERADOR_VIGENTE='conditioned-rules-v2';
export const esDeGeneradorAnterior=item=>!!item?.generatorVersion&&item.generatorVersion!==GENERADOR_VIGENTE;
// Plantillas del generador v1 (guardadas, inmutables): la lista completa de categorías ya está en «Evidencia», así que en la frase se resume. Solo se reescribe lo que
// calza EXACTO con la plantilla; cualquier otro texto (incluido el editado por una persona) pasa intacto salvo la taxonomía.
const LISTA='[\\s\\S]{1,2500}?';
const PLANTILLAS_V1=[
 [new RegExp('indicios de '+LISTA+' con una inspección operacional independiente','u'),'indicios citados con una inspección operativa independiente'],
 [new RegExp('incidencia de '+LISTA+'\\.(?=\\s|$)','u'),'incidencia.'],
 [new RegExp('las citas de '+LISTA+' con registros operacionales independientes','u'),'las citas con registros operativos independientes'],
 [new RegExp('indicios de '+LISTA+' sin atribuir','u'),'indicios citados sin atribuir'],
 [new RegExp('en (\\d+) categorías \\('+LISTA+'\\)\\.','u'),'en $1 categorías (las más frecuentes están en «Evidencia»).'],
];
const ESTADO_RE=/Estado causal:? (unassessed|hypothesis|confirmed|retracted|candidate|supported|unsupported|insufficient)\b:?\.?/gu;
/** Texto de una recomendación o brief listo para leer: taxonomía en español, plantillas v1 resumidas y estados causales traducidos. NO modifica lo guardado. */
export function textoLegible(texto){
 if(typeof texto!=='string'||!texto)return texto;
 let t=traducirTaxonomia(texto);
 for(const [re,por] of PLANTILLAS_V1)t=t.replace(re,por);
 t=t.replace(ESTADO_RE,(_,e)=>'Estado causal: '+(CAUSAL_ES[e]??e)+'.').replace(/(Estado causal: [^.]+\.) los /u,'$1 Los ');
 return t;
}
