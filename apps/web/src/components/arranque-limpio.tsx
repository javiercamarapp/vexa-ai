'use client';
import {useEffect} from 'react';
import {hayCargaDePagina,suscribirCargaDePagina} from './rovaq-cargando';

/**
 * Gobierna la ÚNICA capa de carga a pantalla completa (`#arranque-logo`, visible mientras `html[data-arranque]`): logo centrado sobre un solo color (`--carga-fondo`),
 * sin sidebar, encabezados ni contenido. Cubre tres casos con las mismas reglas:
 *  1. Carga/recarga: un script inline pone `data-arranque` antes del primer pintado; aquí se suelta cuando TODO está listo.
 *  2. Navegación interna y cambios de organización/cliente: si un cargador de página completa (`RovaqCargando`) sigue montado pasados {@link RETARDO_NAVEGACION_MS},
 *     se activa la misma capa (en navegaciones rápidas nunca aparece); una vez visible permanece al menos {@link MINIMO_VISIBLE_MS} para no destellar.
 *  3. Seguro: pasados {@link TOPE_MS} se suelta y `html[data-carga-tope]` convierte el cargador en línea en una capa de pantalla completa del mismo color.
 *
 * CONDICIÓN LEÍDA DEL DOM, no del registro de React. Con respuestas lentas el servidor entrega el HTML por partes: el cargador `loading.tsx` llega dentro de una
 * frontera Suspense aún pendiente y React NO la hidrata, así que su `RovaqCargando` no se registra; el DOM sí lo tiene (HTML del servidor con `aria-busy`).
 * Se suelta cuando, de forma CONTINUA durante {@link VENTANA_ESTABLE_MS}: (a) el documento terminó de llegar, (b) no hay cargador de página completa en el DOM
 * (en la carga inicial tampoco `main [aria-busy="true"]`) y (c) ninguno está registrado en el cliente.
 */
export const VENTANA_ESTABLE_MS = 600;
export const VENTANA_NAVEGACION_MS = 150;
export const RETARDO_NAVEGACION_MS = 250;
export const MINIMO_VISIBLE_MS = 400;
export const TOPE_MS = 45000;
const PAGINA = '.rovaq-cargando:not(.rovaq-cargando-compacto)';
const PENDIENTE = PAGINA + ', main [aria-busy="true"]:not(.rovaq-cargando-compacto):not([aria-hidden="true"])';
const hayPendiente = (inicial: boolean) => document.readyState === 'loading' || hayCargaDePagina() || document.querySelector(inicial ? PENDIENTE : PAGINA) !== null;
const SIN_CAPA = /^\/(login|auth)(\/|$)/;

export function ArranqueLimpio(){
  useEffect(()=>{
    const raiz=document.documentElement,w=window as unknown as {__arranqueVivo?:boolean};
    w.__arranqueVivo=true;
    let inicial=!!raiz.dataset.arranque,activa=inicial,desde=Date.now(),tope:number|undefined,espera:number|undefined,aparicion:number|undefined,programado=false,vivo=true;
    const armarTope=()=>{window.clearTimeout(tope);tope=window.setTimeout(()=>{if(!vivo||!activa)return;activa=false;raiz.dataset.cargaTope='1';delete raiz.dataset.arranque;},TOPE_MS);};
    const soltar=()=>{window.clearTimeout(tope);activa=false;inicial=false;delete raiz.dataset.arranque;};
    const evaluar=()=>{
      if(!vivo)return;
      if(raiz.dataset.cargaTope&&!hayPendiente(false))delete raiz.dataset.cargaTope;
      if(activa){
        window.clearTimeout(aparicion);window.clearTimeout(espera);
        if(hayPendiente(inicial))return;
        const ventana=inicial?VENTANA_ESTABLE_MS:Math.max(VENTANA_NAVEGACION_MS,MINIMO_VISIBLE_MS-(Date.now()-desde));
        espera=window.setTimeout(()=>{if(vivo&&!hayPendiente(inicial))soltar();},ventana);
        return;
      }
      window.clearTimeout(aparicion);
      if(SIN_CAPA.test(location.pathname)||raiz.dataset.cargaTope||!hayPendiente(false)||document.readyState==='loading')return;
      aparicion=window.setTimeout(()=>{if(!vivo||activa||!hayPendiente(false))return;activa=true;inicial=false;desde=Date.now();raiz.dataset.arranque='1';armarTope();},RETARDO_NAVEGACION_MS);
    };
    // Las mutaciones llegan en ráfagas durante la hidratación: se evalúa una vez por ráfaga.
    const alCambiar=()=>{if(programado)return;programado=true;queueMicrotask(()=>{programado=false;evaluar();});};
    const observador=new MutationObserver(alCambiar);
    observador.observe(raiz,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-busy','class']});
    document.addEventListener('readystatechange',alCambiar);
    const baja=suscribirCargaDePagina(alCambiar);
    if(activa)armarTope();
    evaluar();
    return()=>{vivo=false;window.clearTimeout(tope);window.clearTimeout(espera);window.clearTimeout(aparicion);observador.disconnect();document.removeEventListener('readystatechange',alCambiar);baja();};
  },[]);
  return null;
}
