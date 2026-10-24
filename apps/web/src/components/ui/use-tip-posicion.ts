'use client';
import {useLayoutEffect,type RefObject} from 'react';
import {colocarTooltip} from '../../lib/charts/escala.mjs';
export type Ancla={/** punto en coordenadas de VENTANA */ax:number;ay:number;modo?:'lado'|'arriba';sep?:number;/** esquina superior deseada (ventana) para el modo «lado» */ty?:number};
/** Coloca un tooltip `position:absolute` junto a un punto sin salirse del viewport (margen 8 px): lo mide ya pintado en el DOM, lo voltea a izquierda/derecha o arriba/abajo
 *  y escribe `left/top` relativos a su contenedor posicionado. Va en useLayoutEffect (antes de pintar: no hay parpadeo) y en cada render, así que sigue al cursor, al teclado y al redimensionar.
 *  En el celular el tooltip es una cinta en flujo (position:static): no se toca. Sin transform: el ancho lo fija el CSS (max-content con tope), nunca el espacio libre a la derecha del punto. */
export function useTipPosicion(ref:RefObject<HTMLElement|null>,activo:boolean,ancla:()=>Ancla|null){
 useLayoutEffect(()=>{
  const el=ref.current;if(!el||!activo)return;
  if(getComputedStyle(el).position==='static')return;
  const a=ancla();if(!a)return;
  const r=el.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=window.innerHeight;
  const p=colocarTooltip({ax:a.ax,ay:a.ay,w:r.width,h:r.height,vw,vh,modo:a.modo,sep:a.sep,ty:a.ty});
  if(getComputedStyle(el).position==='fixed'){el.style.left=Math.round(p.x*10)/10+'px';el.style.top=Math.round(p.y*10)/10+'px';el.dataset.side=p.lado==='izquierda'?'left':p.lado==='derecha'?'right':'center';return;}
  // Contenedor posicionado: left/top se miden desde su borde de relleno (borde interior + desplazamiento propio).
  const cb=el.offsetParent as HTMLElement|null,cr=cb&&cb!==document.body?cb.getBoundingClientRect():{left:-window.scrollX,top:-window.scrollY},bx=cb&&cb!==document.body?cb.clientLeft-cb.scrollLeft:0,by=cb&&cb!==document.body?cb.clientTop-cb.scrollTop:0;
  el.style.left=Math.round((p.x-cr.left-bx)*10)/10+'px';el.style.top=Math.round((p.y-cr.top-by)*10)/10+'px';el.style.right='auto';el.style.bottom='auto';el.style.transform='none';
  el.dataset.side=p.lado==='izquierda'?'left':p.lado==='derecha'?'right':'center';
 });
}
