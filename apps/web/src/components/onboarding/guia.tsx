'use client';
// Botón «Guía» del encabezado y paneles del recorrido (tarjeta, invitación, menú). Sin librerías ni estilos en línea: todo se pinta con clases (onboarding.css).
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {useT} from '../i18n/proveedor';
import {OBJETIVOS} from '../../lib/onboarding/recorrido.mjs';
import {useOnboarding} from './contexto';
import {InvitacionRecorrido,MenuGuia,TarjetaRecorrido} from './paneles';
import './onboarding.css';

const visible=(el:Element)=>el instanceof HTMLElement&&el.getClientRects().length>0;
/** Primer elemento visible de los selectores del paso (el menú existe dos veces: escritorio y hoja móvil; solo una está visible). */
function primerVisible(selectores:readonly string[]):HTMLElement|null{
 for(const s of selectores){for(const el of Array.from(document.querySelectorAll(s)))if(visible(el))return el as HTMLElement;}
 return null;
}
export function GuiaBoton(){
 const c=useOnboarding(),t=useT();
 if(!c||!c.tieneRecorrido)return null;
 const {registrarBoton,menuAbierto,alternarMenu}=c;
 return <button ref={registrarBoton} id="onb-boton" type="button" className="onb-boton" aria-haspopup="true" aria-expanded={menuAbierto} aria-controls={menuAbierto?'onb-menu':undefined} aria-label={t('onb.ui.menuGuia')} onClick={alternarMenu}>
  <span className="onb-boton-signo" aria-hidden="true">?</span><span className="onb-boton-texto">{t('onb.ui.guia')}</span>{c.invitacionVisible&&<span className="onb-boton-punto" aria-hidden="true"/>}
 </button>;
}
export function GuiaPaneles(){
 const c=useOnboarding(),t=useT(),pathname=usePathname(),tarjeta=useRef<HTMLElement>(null),menu=useRef<HTMLDivElement>(null);
 const abierto=Boolean(c?.rec.abierto),pasoId=c?.paso?.id??null;
 // Foco: al abrir por la persona pasa a la tarjeta (una vez); después se queda donde está. Cambiar de ruta no lo toca.
 useEffect(()=>{if(abierto)tarjeta.current?.querySelector<HTMLElement>('[data-onb-primario]')?.focus();},[abierto]);
 useEffect(()=>{if(c?.menuAbierto)menu.current?.querySelector<HTMLElement>('button')?.focus();},[c?.menuAbierto]);
 // Cerrar el menú al hacer clic fuera.
 useEffect(()=>{if(!c?.menuAbierto)return;const cerrar=c.cerrarMenu;const fuera=(e:PointerEvent)=>{const n=e.target as Node;if(!menu.current?.contains(n)&&!document.getElementById('onb-boton')?.contains(n))cerrar();};document.addEventListener('pointerdown',fuera);return()=>document.removeEventListener('pointerdown',fuera);},[c?.menuAbierto,c?.cerrarMenu]);
 // Esc también cierra el recorrido si el foco quedó en la página (la tarjeta no atrapa el foco).
 useEffect(()=>{if(!abierto||!c)return;const despachar=c.despachar;const alTeclear=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented)despachar({tipo:'cerrar'});};document.addEventListener('keydown',alTeclear);return()=>document.removeEventListener('keydown',alTeclear);},[abierto,c]);
 // Resaltado: clase CSS + atributo sobre el elemento real. Si no existe (o no está visible) la tarjeta se degrada a sin resaltar. Se reintenta unos instantes por si la pantalla aún carga.
 useEffect(()=>{
  if(!abierto||!pasoId)return;
  const selectores=OBJETIVOS[pasoId]??[];let el:HTMLElement|null=null,intentos=0,reloj:ReturnType<typeof setInterval>|undefined;
  const reducido=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const aplicar=()=>{const nuevo=primerVisible(selectores);if(!nuevo)return false;el=nuevo;el.classList.add('onb-resaltado');el.setAttribute('data-tour-activo','true');if(typeof el.scrollIntoView==='function')el.scrollIntoView({block:'nearest',behavior:reducido?'auto':'smooth'});return true;};
  if(!aplicar())reloj=setInterval(()=>{if(aplicar()||++intentos>=15)clearInterval(reloj);},150);
  return()=>{if(reloj)clearInterval(reloj);if(el){el.classList.remove('onb-resaltado');el.removeAttribute('data-tour-activo');}};
 },[abierto,pasoId,pathname]);
 if(!c||!c.listo||!c.tieneRecorrido)return null;
 const total=c.pasos.length,n=c.rec.indice+1;
 return <>
  {c.menuAbierto&&<MenuGuia t={t} innerRef={menu} contexto={t('onb.ui.rolOrg',{organizacion:c.datos.organizacion,rol:c.datos.rolEtiqueta})} tienePaso={Boolean(c.local.paso)} mostrarChecklistOpcion={c.tieneChecklist} descartado={c.local.descartado}
   iniciar={()=>c.iniciar('inicio')} retomar={()=>c.iniciar('retomar')} mostrarChecklist={c.mostrarChecklist} abrirSetup={c.abrirSetup} noVolver={c.noVolver} cerrar={()=>{c.cerrarMenu();c.enfocarBoton();}}/>}
  {c.invitacionVisible&&<InvitacionRecorrido t={t} saltar={c.saltarInvitacion} empezar={()=>c.iniciar('inicio')}/>}
  {abierto&&c.paso&&<TarjetaRecorrido t={t} innerRef={tarjeta} titulo={c.paso.textos.titulo} cuerpo={c.paso.textos.cuerpo} n={n} total={total} alEvento={c.despachar} omitir={c.omitir}/>}
 </>;
}
