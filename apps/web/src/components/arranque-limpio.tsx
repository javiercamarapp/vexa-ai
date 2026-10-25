'use client';
import {useEffect} from 'react';
import {hayCargaDePagina} from './rovaq-cargando';

/**
 * Suelta el logo de arranque (`html[data-arranque]`, puesto por un script inline antes del primer pintado) cuando la primera pantalla de página completa
 * ya está lista: todo a la vez, sin pasos intermedios visibles.
 *
 * CONDICIÓN LEÍDA DEL DOM, no del registro de React. Con respuestas lentas el servidor entrega el HTML por partes: el cargador `loading.tsx` llega dentro de una
 * frontera Suspense aún pendiente y React NO la hidrata (no monta su fallback), así que su `RovaqCargando` nunca se registra y `hayCargaDePagina()` daba `false`
 * justo después de hidratar: el arranque se soltaba a los 200 ms y se veía el espacio de trabajo (sidebar, encabezado) con el logo en el área de contenido.
 * El DOM sí lo tiene (el HTML del servidor trae el cargador con `aria-busy`), por eso se observa el DOM.
 *
 * Se suelta cuando, de forma CONTINUA durante {@link VENTANA_ESTABLE_MS}: (a) el documento terminó de llegar (`readyState` ≠ `loading`; sin fronteras pendientes),
 * (b) no hay ningún cargador de página completa en el DOM (ni `[aria-busy="true"]` de página) y (c) ninguno está registrado en el cliente. El seguro final es
 * {@link TOPE_MS}. La navegación interna no pasa por aquí: el componente vive en el layout raíz y solo evalúa en la primera carga.
 */
export const VENTANA_ESTABLE_MS = 600;
export const TOPE_MS = 20000;
const PENDIENTE = '.rovaq-cargando:not(.rovaq-cargando-compacto), main [aria-busy="true"]:not(.rovaq-cargando-compacto):not([aria-hidden="true"])';
const hayPendiente = () => document.readyState === 'loading' || hayCargaDePagina() || document.querySelector(PENDIENTE) !== null;

export function ArranqueLimpio(){
  useEffect(()=>{
    const raiz=document.documentElement;
    if(!raiz.dataset.arranque)return;
    let temporizador:number|undefined,programado=false,vivo=true;
    const soltar=()=>{if(!vivo)return;limpiar();delete raiz.dataset.arranque;};
    const evaluar=()=>{window.clearTimeout(temporizador);if(!vivo||hayPendiente())return;temporizador=window.setTimeout(()=>{if(!hayPendiente())soltar();},VENTANA_ESTABLE_MS);};
    // Las mutaciones llegan en ráfagas durante la hidratación: se evalúa una vez por ráfaga.
    const alCambiar=()=>{if(programado)return;programado=true;queueMicrotask(()=>{programado=false;evaluar();});};
    const observador=new MutationObserver(alCambiar);
    observador.observe(raiz,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-busy','class']});
    document.addEventListener('readystatechange',alCambiar);
    const tope=window.setTimeout(soltar,TOPE_MS);
    const limpiar=()=>{vivo=false;window.clearTimeout(temporizador);window.clearTimeout(tope);observador.disconnect();document.removeEventListener('readystatechange',alCambiar);};
    evaluar();
    return limpiar;
  },[]);
  return null;
}
