// Piezas visuales del recorrido, sin hooks de Next ni estado: se pueden renderizar y revisar solas (pruebas de marcado).
import type {KeyboardEvent,Ref} from 'react';
import type {Traductor,Clave} from '../../lib/i18n';
import {eventoDeTecla,type EventoRecorrido} from '../../lib/onboarding/recorrido.mjs';
const texto=(t:Traductor,k:string,v?:Record<string,string|number>)=>t(k as Clave,v);

export function TarjetaRecorrido({t,innerRef,titulo,cuerpo,n,total,alEvento,omitir}:{t:Traductor;innerRef?:Ref<HTMLElement>;titulo:string;cuerpo:string;n:number;total:number;alEvento:(e:EventoRecorrido)=>void;omitir:()=>void}){
 const tit=texto(t,titulo);
 function alTeclear(e:KeyboardEvent<HTMLElement>){const ev=eventoDeTecla(e.key,(e.target as HTMLElement).tagName);if(ev){e.preventDefault();alEvento(ev);}}
 return <section ref={innerRef} className="onb-tarjeta" role="dialog" aria-labelledby="onb-t-titulo" aria-describedby="onb-t-cuerpo" onKeyDown={alTeclear}>
  <p className="onb-contador" aria-hidden="true">{t('onb.ui.paso',{n,total})}</p>
  <h2 id="onb-t-titulo">{tit}</h2>
  <p id="onb-t-cuerpo">{texto(t,cuerpo)}</p>
  <div className="onb-acciones">
   <button type="button" className="onb-btn-sec" onClick={omitir}>{t('onb.ui.omitir')}</button>
   {n>1&&<button type="button" className="onb-btn-sec" onClick={()=>alEvento({tipo:'anterior'})}>{t('onb.ui.anterior')}</button>}
   <button type="button" className="onb-btn" data-onb-primario onClick={()=>alEvento({tipo:'siguiente'})}>{n===total?t('onb.ui.terminar'):t('onb.ui.siguiente')}</button>
  </div>
  {/* «Paso n de N» se anuncia una sola vez por paso: la línea visible de arriba está oculta a lectores de pantalla. */}
  <p className="sr-only" role="status">{t('onb.ui.avisoPasos',{n,total,titulo:tit})}</p>
 </section>;
}
export function InvitacionRecorrido({t,saltar,empezar}:{t:Traductor;saltar:()=>void;empezar:()=>void}){
 return <section className="onb-invitacion" aria-labelledby="onb-inv-titulo">
  <h2 id="onb-inv-titulo">{t('onb.ui.invitacionTitulo')}</h2><p>{t('onb.ui.invitacionCuerpo')}</p>
  <div className="onb-acciones"><button type="button" className="onb-btn-sec" onClick={saltar}>{t('onb.ui.saltar')}</button><button type="button" className="onb-btn" onClick={empezar}>{t('onb.ui.empezar')}</button></div>
 </section>;
}
export function MenuGuia({t,innerRef,contexto,tienePaso,mostrarChecklistOpcion,descartado,iniciar,retomar,mostrarChecklist,abrirSetup,noVolver,cerrar}:{t:Traductor;innerRef?:Ref<HTMLDivElement>;contexto:string;tienePaso:boolean;mostrarChecklistOpcion:boolean;descartado:boolean;iniciar:()=>void;retomar:()=>void;mostrarChecklist:()=>void;abrirSetup?:()=>void;noVolver:()=>void;cerrar:()=>void}){
 return <div ref={innerRef} id="onb-menu" className="onb-menu" role="group" aria-label={t('onb.ui.menuGuia')} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();cerrar();}}}>
  <p className="onb-menu-ctx">{contexto}</p>
  <button type="button" onClick={iniciar}>{t('onb.ui.reabrir')}</button>
  {tienePaso&&<button type="button" onClick={retomar}>{t('onb.ui.retomar')}</button>}
  {mostrarChecklistOpcion&&descartado&&<button type="button" onClick={mostrarChecklist}>{t('onb.ui.mostrarChecklist')}</button>}
  {abrirSetup&&<button type="button" onClick={abrirSetup}>{t('onb.setup.verTodo')}</button>}
  {!descartado&&<button type="button" onClick={noVolver}>{t('onb.ui.noVolver')}</button>}
 </div>;
}
