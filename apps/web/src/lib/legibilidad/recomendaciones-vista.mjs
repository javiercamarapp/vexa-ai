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
