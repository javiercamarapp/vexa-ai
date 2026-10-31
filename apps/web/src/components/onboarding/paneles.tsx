// Piezas visuales del recorrido, sin hooks de Next ni estado: se pueden renderizar y revisar solas (pruebas de marcado).
// El teclado vive a nivel de documento (contexto.tsx): la tarjeta no atrapa el foco ni intercepta teclas.
import type {Ref} from 'react';
import type {Traductor} from '../../lib/i18n';
import {Ilustracion} from './ilustraciones';

export type LadoEtiqueta='arriba'|'abajo'|'izq'|'der';
export interface RutaTour {nombres:string[];actual:number}
export interface PropsTarjeta {
 t:Traductor;innerRef?:Ref<HTMLElement>;tipo:'ir'|'info'|'cierre';titulo:string;cuerpo:string;ilu:string;
 n:number;total:number;grupoN:number;grupoTotal:number;ruta:RutaTour;hayAnterior?:boolean;
 centrada?:boolean;sinObjetivo?:boolean;mostrarSetup?:boolean;
 anterior:()=>void;omitir:()=>void;primario:()=>void;irSetup?:()=>void;
}
/** Ruta del recorrido en una ventana corta alrededor de la pantalla actual: «… · Fuentes · Problemas · Acciones · …». */
export function ventanaRuta(nombres:string[],actual:number,ancho=5){
 const desde=Math.max(0,Math.min(actual-1,nombres.length-ancho)),hasta=Math.min(nombres.length,desde+ancho);
 return {items:nombres.slice(desde,hasta).map((nombre,i)=>({nombre,actual:desde+i===actual})),antes:desde>0,despues:hasta<nombres.length};
}
export function TarjetaRecorrido({t,innerRef,tipo,titulo,cuerpo,ilu,n,total,grupoN,grupoTotal,ruta,centrada,sinObjetivo,mostrarSetup,hayAnterior,anterior,omitir,primario,irSetup}:PropsTarjeta){
 const v=ventanaRuta(ruta.nombres,ruta.actual),cierre=tipo==='cierre';
 return <section ref={innerRef} className="onb-tarjeta" role="dialog" aria-labelledby="onb-t-titulo" aria-describedby="onb-t-cuerpo" data-tipo={tipo} data-centrada={centrada||undefined}>
  <div className="onb-ilu-marco" key={ilu}><Ilustracion tipo={ilu}/></div>
  <div className="onb-cab" aria-hidden="true"><p className="onb-contador">{t('onb.ui.paso',{n:n,total:total})}</p>{!cierre&&<p className="onb-contador">{t('onb.tour.pantalla',{n:grupoN,total:grupoTotal})}</p>}</div>
  <progress className="onb-avance" max={total} value={n} aria-label={t('onb.tour.progresoAria')}/>
  <h2 id="onb-t-titulo">{titulo}</h2>
  <p id="onb-t-cuerpo">{cuerpo}</p>
  {sinObjetivo&&<p className="onb-nota">{t('onb.tour.noEncontrado')}</p>}
  {ruta.nombres.length>0&&<ol className="onb-ruta" aria-label={t('onb.tour.rutaAria')}>
   {v.antes&&<li className="onb-ruta-mas" aria-hidden="true">…</li>}
   {v.items.map(i=><li key={i.nombre} aria-current={i.actual&&!cierre?'step':undefined} data-actual={i.actual&&!cierre||undefined}>{i.nombre}</li>)}
   {v.despues&&<li className="onb-ruta-mas" aria-hidden="true">…</li>}
  </ol>}
  <div className="onb-acciones">
   {!cierre&&<button type="button" className="onb-btn-sec" onClick={omitir}>{t('onb.ui.omitir')}</button>}
   {(hayAnterior??n>1)&&<button type="button" className="onb-btn-sec" onClick={anterior}>{t('onb.ui.anterior')}</button>}
   {cierre&&mostrarSetup&&irSetup&&<button type="button" className="onb-btn-sec" onClick={irSetup}>{t('onb.tour.cierre.setup')}</button>}
   <button type="button" className="onb-btn" data-onb-primario onClick={primario}>{cierre?t('onb.ui.terminar'):t('onb.ui.siguiente')}</button>
  </div>
  {/* «Paso n de N» se anuncia una sola vez por paso: la línea visible de arriba está oculta a lectores de pantalla. */}
  <p className="sr-only" role="status">{t('onb.ui.avisoPasos',{n:n,total:total,titulo:titulo})}</p>
 </section>;
}
/** Etiqueta flotante con flecha junto al elemento real («Haz clic aquí: Problemas»). Decorativa para lectores de pantalla: la tarjeta dice lo mismo. */
export function EtiquetaObjetivo({texto,innerRef}:{texto:string;innerRef?:Ref<HTMLDivElement>}){
 return <div ref={innerRef} className="onb-etiqueta" aria-hidden="true"><span className="onb-etq-in">
  <svg className="onb-etq-flecha" viewBox="0 0 16 16" focusable="false"><path d="M8 13 V3 M3.5 7.5 L8 3 L12.5 7.5"/></svg><span>{texto}</span></span></div>;
}
/** Capa que atenúa la pantalla y deja iluminado el elemento (el recorte se posiciona con CSSOM desde guia.tsx). Nunca recibe clics. */
export function CapaFoco({innerRef,scrim}:{innerRef?:Ref<HTMLDivElement>;scrim?:boolean}){
 return <div ref={innerRef} className="onb-capa" aria-hidden="true" data-sin-foco="" data-scrim={scrim||undefined}><div className="onb-foco"/></div>;
}
/** Con `corto` (hay versión reducida) se elige al empezar: «Recorrido corto» (pasos esenciales del rol) o «Recorrido completo». Sin `corto` queda el botón único. */
export interface OpcionesRecorrido {corto:number;completo:number}
export function InvitacionRecorrido({t,saltar,empezar,opciones}:{t:Traductor;saltar:()=>void;empezar:(modo?:'corto'|'completo')=>void;opciones?:OpcionesRecorrido}){
 return <section className="onb-invitacion" aria-labelledby="onb-inv-titulo">
  <h2 id="onb-inv-titulo">{t('onb.ui.invitacionTitulo')}</h2><p>{opciones?t('onb.ui.invitacionElige'):t('onb.ui.invitacionCuerpo')}</p>
  <div className="onb-acciones">
   <button type="button" className="onb-btn-sec" onClick={saltar}>{t('onb.ui.saltar')}</button>
   {opciones?<>
    <button type="button" className="onb-btn-sec" data-onb-modo="completo" onClick={()=>empezar('completo')}>{t('onb.ui.recorridoCompleto',{n:opciones.completo})}</button>
    <button type="button" className="onb-btn" data-onb-modo="corto" onClick={()=>empezar('corto')}>{t('onb.ui.recorridoCorto',{n:opciones.corto})}</button>
   </>:<button type="button" className="onb-btn" onClick={()=>empezar()}>{t('onb.ui.empezar')}</button>}
  </div>
 </section>;
}
export interface PantallaMenu {href:string;nombre:string;actual:boolean}
export function MenuGuia({t,innerRef,contexto,tienePaso,mostrarChecklistOpcion,descartado,iniciar,opciones,retomar,mostrarChecklist,abrirSetup,noVolver,cerrar,pantallas,irAPantalla}:{t:Traductor;innerRef?:Ref<HTMLDivElement>;contexto:string;tienePaso:boolean;mostrarChecklistOpcion:boolean;descartado:boolean;iniciar:(modo?:'corto'|'completo')=>void;opciones?:OpcionesRecorrido;retomar:()=>void;mostrarChecklist:()=>void;abrirSetup?:()=>void;noVolver:()=>void;cerrar:()=>void;pantallas?:PantallaMenu[];irAPantalla?:(href:string)=>void}){
 return <div ref={innerRef} id="onb-menu" className="onb-menu" role="group" aria-label={t('onb.ui.menuGuia')} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();cerrar();}}}>
  <p className="onb-menu-ctx">{contexto}</p>
  {opciones?<>
   <button type="button" data-onb-modo="corto" onClick={()=>iniciar('corto')}>{t('onb.ui.recorridoCorto',{n:opciones.corto})}</button>
   <button type="button" data-onb-modo="completo" onClick={()=>iniciar('completo')}>{t('onb.ui.recorridoCompleto',{n:opciones.completo})}</button>
  </>:<button type="button" onClick={()=>iniciar()}>{t('onb.ui.reabrir')}</button>}
  {tienePaso&&<button type="button" onClick={retomar}>{t('onb.ui.retomar')}</button>}
  {pantallas&&pantallas.length>0&&irAPantalla&&<div className="onb-menu-pantallas" role="group" aria-label={t('onb.tour.menu.pantallasAria')}>
   <p className="onb-menu-sub">{t('onb.tour.menu.pantallas')}</p>
   {pantallas.map(p=><button key={p.href} type="button" aria-current={p.actual?'step':undefined} onClick={()=>irAPantalla(p.href)}>{p.nombre}</button>)}
  </div>}
  {mostrarChecklistOpcion&&descartado&&<button type="button" onClick={mostrarChecklist}>{t('onb.ui.mostrarChecklist')}</button>}
  {abrirSetup&&<button type="button" onClick={abrirSetup}>{t('onb.setup.verTodo')}</button>}
  {!descartado&&<button type="button" onClick={noVolver}>{t('onb.ui.noVolver')}</button>}
 </div>;
}
