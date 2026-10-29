import {LOCALES} from '../formato/idioma.mjs';
// Lógica PURA del Explorador de evidencia (sin red, sin React): citas repetidas, aviso de datos de terceros, textos de la fila y del importe.
// Honestidad: lo desconocido es null y nunca se convierte en 0.
/** Aviso fijo del panel de evidencia. La redacción en base cubre correos, teléfonos y números largos; en pantalla se ocultan además patrones estructurales frecuentes de nombres y direcciones (enmascarar-terceros.mjs); NO es detección completa. */
export const AVISO_TERCEROS='El texto está redactado de correos, teléfonos y números largos. Se ocultan patrones frecuentes de nombres y direcciones, pero el texto puede seguir conteniendo datos de terceros: no lo compartas fuera de tu organización.';
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
export const textoConversaciones=n=>Number.isFinite(n)?`${new Intl.NumberFormat(LOCALES.es).format(n)} ${n===1?'conversación':'conversaciones'}`:null;
export const textoCitas=n=>Number.isFinite(n)?`${new Intl.NumberFormat(LOCALES.es).format(n)} ${n===1?'cita distinta':'citas distintas'}`:null;
/** Línea de resultados tras buscar/filtrar: dónde está el resultado sin tener que buscarlo. */
export function resumenResultados({total,texto='',estado='all'}){
 const filtros=[texto?`«${texto}»`:'',estado!=='all'?({ready:'cobertura completa',partial:'cobertura parcial',stale:'corte anterior'}[estado]??estado):''].filter(Boolean);
 const n=new Intl.NumberFormat(LOCALES.es).format(total);
 return `${n} ${total===1?'problema coincide':'problemas coinciden'}${filtros.length?' con '+filtros.join(' y '):''}.`;
}
