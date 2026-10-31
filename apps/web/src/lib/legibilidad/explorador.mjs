import {LOCALES} from '../formato/idioma.mjs';
import {idiomaDe} from './trad.mjs';
// Lógica PURA del Explorador de evidencia (sin red, sin React): citas repetidas, aviso de datos de terceros, textos de la fila y del importe.
// Honestidad: lo desconocido es null y nunca se convierte en 0.
/** Aviso fijo del panel de evidencia. La redacción en base cubre correos, teléfonos y números largos; en pantalla se ocultan además patrones estructurales frecuentes de nombres y direcciones (enmascarar-terceros.mjs); NO es detección completa. */
export const AVISO_TERCEROS='El texto está redactado de correos, teléfonos y números largos. Se ocultan patrones frecuentes de nombres y direcciones, pero el texto puede seguir conteniendo datos de terceros: no lo compartas fuera de tu organización.';
const AVISO_TERCEROS_EN='The text has had emails, phone numbers and long numbers redacted. Frequent name and address patterns are hidden, but the text may still contain third-party data: do not share it outside your organization.';
const AVISO_IMPORTE_EN='The amount per problem is unknown in this snapshot (there are no problem–order links), not zero. It will appear here when the snapshot includes them.';
/** Avisos en el idioma del traductor `t` (español sin traductor). */
export const avisoTerceros=(t=null)=>idiomaDe(t)==='en'?AVISO_TERCEROS_EN:AVISO_TERCEROS;
export const avisoImporte=(t=null)=>idiomaDe(t)==='en'?AVISO_IMPORTE_EN:AVISO_IMPORTE;
/** Una cita idéntica (mismo mensaje y mismo hash del texto) que la IA registró en varias corridas se muestra UNA vez con «×N». Orden estable: el de llegada. */
export const claveCita=c=>(c.messageRevisionId??'')+':'+(c.quoteHash??c.quote??'');
export function agruparCitas(citas){
 const por=new Map();
 for(const c of citas??[]){const k=claveCita(c),a=por.get(k);if(a)a.veces++;else por.set(k,{...c,veces:1});}
 return [...por.values()];
}
/** Cuántas citas distintas hay (misma regla que agruparCitas); null si no se sabe. */
export const citasDistintas=citas=>Array.isArray(citas)?agruparCitas(citas).length:null;
/** ¿Algún problema de la página trae un importe conocido? Si no, el importe se avisa UNA vez en lugar de repetir «Desconocido» en cada fila. */
export const hayImporteConocido=items=>(items??[]).some(i=>(i.metrics??[]).some(m=>m&&m.amount_minor!==null&&m.amount_minor!==undefined));
export const AVISO_IMPORTE='El importe por problema es desconocido en este corte (no hay vínculos problema–pedido), no cero. Se verá aquí cuando el corte los incluya.';
/** «Conversación» / «conversaciones» con su cifra, o null cuando no se conoce. */
export const textoConversaciones=(n,t=null)=>{if(!Number.isFinite(n))return null;const en=idiomaDe(t)==='en';return `${new Intl.NumberFormat(en?LOCALES.en:LOCALES.es).format(n)} ${en?(n===1?'conversation':'conversations'):(n===1?'conversación':'conversaciones')}`;};
export const textoCitas=(n,t=null)=>{if(!Number.isFinite(n))return null;const en=idiomaDe(t)==='en';return `${new Intl.NumberFormat(en?LOCALES.en:LOCALES.es).format(n)} ${en?(n===1?'distinct quote':'distinct quotes'):(n===1?'cita distinta':'citas distintas')}`;};
/** Línea de resultados tras buscar/filtrar: dónde está el resultado sin tener que buscarlo. */
export function resumenResultados({total,texto='',estado='all'},t=null){
 if(idiomaDe(t)==='en'){const f=[texto?`"${texto}"`:'',estado!=='all'?({ready:'complete coverage',partial:'partial coverage',stale:'previous snapshot'}[estado]??estado):''].filter(Boolean);return `${new Intl.NumberFormat(LOCALES.en).format(total)} ${total===1?'problem matches':'problems match'}${f.length?' with '+f.join(' and '):''}.`;}
 const filtros=[texto?`«${texto}»`:'',estado!=='all'?({ready:'cobertura completa',partial:'cobertura parcial',stale:'corte anterior'}[estado]??estado):''].filter(Boolean);
 const n=new Intl.NumberFormat(LOCALES.es).format(total);
 return `${n} ${total===1?'problema coincide':'problemas coinciden'}${filtros.length?' con '+filtros.join(' y '):''}.`;
}
