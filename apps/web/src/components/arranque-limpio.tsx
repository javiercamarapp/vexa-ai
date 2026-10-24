'use client';
import {useEffect} from 'react';
import {hayCargaDePagina,suscribirCargaDePagina} from './rovaq-cargando';

/**
 * Suelta el logo de arranque (`html[data-arranque]`, puesto por un script inline antes del primer pintado) cuando la primera pantalla de página completa
 * dejó de cargar: sin carga de página activa durante un breve silencio (evita parpadeos entre cargas encadenadas) o, a más tardar, a los 15 s.
 */
export function ArranqueLimpio(){
  useEffect(()=>{
    const raiz=document.documentElement;
    if(!raiz.dataset.arranque)return;
    let temporizador:number|undefined;
    const soltar=()=>{window.clearTimeout(temporizador);window.clearTimeout(tope);desuscribir();delete raiz.dataset.arranque;};
    const evaluar=()=>{window.clearTimeout(temporizador);if(!hayCargaDePagina())temporizador=window.setTimeout(()=>{if(!hayCargaDePagina())soltar();},200);};
    const desuscribir=suscribirCargaDePagina(evaluar);
    const tope=window.setTimeout(soltar,15000);
    evaluar();
    return()=>{window.clearTimeout(temporizador);window.clearTimeout(tope);desuscribir();};
  },[]);
  return null;
}
