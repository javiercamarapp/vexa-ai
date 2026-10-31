'use client';
// Botón «Guía» del encabezado y paneles del recorrido (foco con atenuación, etiqueta «haz clic aquí», tarjeta, invitación, menú). Sin librerías ni estilos en línea:
// todo se pinta con clases (onboarding.css) y la posición del recorte se escribe por CSSOM (style.setProperty), que la CSP permite.
import {useEffect,useRef,useState} from 'react';
import {useT} from '../i18n/proveedor';
import {etiquetaItem} from '../../lib/i18n/menu';
import {todosLosItems} from '../../lib/workspace/menu.mjs';
import {pasosDe} from '../../lib/onboarding/catalogo.mjs';
import {enPantalla} from '../../lib/onboarding/ruta.mjs';
import {reducir} from '../../lib/onboarding/recorrido.mjs';
import type {Clave} from '../../lib/i18n';
import {useOnboarding} from './contexto';
import {BannerPantalla,CapaFoco,EtiquetaObjetivo,InvitacionRecorrido,MenuGuia,TarjetaRecorrido,type LadoEtiqueta} from './paneles';
import {abrirGrupoDelMenu,esperarObjetivo,nombreDe,pantallaEstrecha,reducirMovimiento} from './objetivo';
import './onboarding.css';

export function GuiaBoton(){
 const c=useOnboarding(),t=useT();
 if(!c||!c.tieneRecorrido)return null;
 const {registrarBoton,menuAbierto,alternarMenu}=c;
 return <button ref={registrarBoton} id="onb-boton" type="button" className="onb-boton" aria-haspopup="true" aria-expanded={menuAbierto} aria-controls={menuAbierto?'onb-menu':undefined} aria-label={t('onb.ui.menuGuia')} onClick={alternarMenu}>
  <span className="onb-boton-signo" aria-hidden="true">?</span><span className="onb-boton-texto">{t('onb.ui.guia')}</span>{c.invitacionVisible&&<span className="onb-boton-punto" aria-hidden="true"/>}
 </button>;
}
const PAD=6,GAP=10,MARGEN=8;
/** Un control con nombre propio (botón, enlace, campo): solo a esos se les pone etiqueta «Aquí: …». */
const esControl=(el:HTMLElement)=>el.matches('a,button,summary,input,select,textarea,[role="button"],[role="link"]');
export function GuiaPaneles(){
 const c=useOnboarding(),t=useT(),tarjeta=useRef<HTMLElement>(null),menu=useRef<HTMLDivElement>(null),capa=useRef<HTMLDivElement>(null),etiqueta=useRef<HTMLDivElement>(null);
 const abierto=Boolean(c?.rec.abierto),paso=c?.paso??null,ruta=c?.ruta??'',despachar=c?.despachar;
 const clave=abierto&&paso&&paso.tipo!=='cierre'?paso.id+'|'+ruta:null;
 // Elemento real del paso: undefined = todavía buscando, null = no existe (la tarjeta se centra), elemento = iluminarlo. Un resultado de otro paso o de otra ruta se ignora.
 const [res,setRes]=useState<{clave:string;el:HTMLElement|null}|null>(null),[reintento,setReintento]=useState(0);
 const el=clave&&res&&res.clave===clave?res.el:undefined;
 // Cerrar el menú al hacer clic fuera.
 useEffect(()=>{if(!c?.menuAbierto)return;const cerrar=c.cerrarMenu;const fuera=(e:PointerEvent)=>{const n=e.target as Node;if(!menu.current?.contains(n)&&!document.getElementById('onb-boton')?.contains(n))cerrar();};document.addEventListener('pointerdown',fuera);return()=>document.removeEventListener('pointerdown',fuera);},[c?.menuAbierto,c?.cerrarMenu]);
 useEffect(()=>{if(c?.menuAbierto)menu.current?.querySelector<HTMLElement>('button')?.focus();},[c?.menuAbierto]);
 // 1) Esperar a que exista el elemento (tope 4 s; en un paso «ir» se despliega antes el grupo del menú que lo esconde). Un paso de otra pantalla no busca nada.
 useEffect(()=>{
  if(!clave||!paso)return;
  if(paso.tipo!=='ir'&&paso.pantalla&&!enPantalla(ruta,paso.pantalla)){const id=setTimeout(()=>setRes({clave,el:null}),0);return()=>clearTimeout(id);}
  if(paso.tipo==='ir')abrirGrupoDelMenu(paso.objetivos);
  return esperarObjetivo(paso.objetivos,e=>setRes({clave,el:e}),()=>setRes({clave,el:null}));
 // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave` ya resume paso y ruta
 },[clave,reintento]);
 // 2) Llevarlo a la vista (suave; instantáneo con «reducir movimiento»). En pantallas estrechas arriba, para no quedar bajo la tarjeta anclada abajo.
 const pasoId=paso?.id;
 useEffect(()=>{
  if(!el)return;
  const estrecha=pantallaEstrecha();
  if(estrecha)el.style.setProperty('scroll-margin-top','88px');
  if(typeof el.scrollIntoView==='function')el.scrollIntoView({behavior:reducirMovimiento()?'auto':'smooth',block:estrecha?'start':'center'});
  return()=>{el.style.removeProperty('scroll-margin-top');};
 },[el,pasoId]);
 // 3) El clic real en el elemento completa un paso «ir». No se impide la acción normal (ni navegación): solo se escucha.
 const tipo=paso?.tipo;
 useEffect(()=>{
  if(!el||tipo!=='ir'||!despachar)return;
  const alClic=()=>despachar({tipo:'clic'});
  el.addEventListener('click',alClic,true);return()=>el.removeEventListener('click',alClic,true);
 },[el,tipo,despachar]);
 // 3b) Un paso «ir» alcanzado por una acción de la persona (Siguiente, flecha derecha, Empezar) no se queda esperando otro botón: se señala el elemento
 // y, tras un instante, la guía lo pulsa sola y la lleva a la pantalla. Si el elemento no existe (menú plegado), navega directo. Un recorrido restaurado al recargar no viaja solo.
 const llevame=c?.llevame,viajeAutomatico=c?.viajeAutomatico,llevarRef=useRef(llevame),viajeRef=useRef(viajeAutomatico);
 useEffect(()=>{llevarRef.current=llevame;viajeRef.current=viajeAutomatico;});
 useEffect(()=>{
  if(tipo!=='ir'||el===undefined||!viajeRef.current?.())return;
  const id=setTimeout(()=>llevarRef.current?.(),el?1600:0);
  return()=>clearTimeout(id);
 },[el,tipo,pasoId]);
 // 4) Seguir al elemento (scroll, tamaño, animaciones): recorte, anillo y etiqueta por CSSOM. Si desaparece (cambio de pantalla) se vuelve a buscar.
 useEffect(()=>{
  const capaEl=capa.current;if(!capaEl)return;
  if(!el){capaEl.setAttribute('data-sin-foco','');etiqueta.current?.style.setProperty('visibility','hidden');tarjeta.current?.removeAttribute('data-lado');return;}
  let cuadro=0,ultima='',primera=true;
  const medir=()=>{
   cuadro=requestAnimationFrame(medir);
   if(!el.isConnected){cancelAnimationFrame(cuadro);capaEl.setAttribute('data-sin-foco','');setRes(null);setReintento(n=>n+1);return;}
   const r=el.getBoundingClientRect();
   if(r.width===0&&r.height===0){capaEl.setAttribute('data-sin-foco','');return;}
   const e=etiqueta.current,w=e?.offsetWidth??0,h=e?.offsetHeight??0,clav=[r.left,r.top,r.width,r.height,w,h,innerWidth,innerHeight].map(Math.round).join(',');
   if(clav===ultima)return;
   ultima=clav;
   capaEl.style.setProperty('--tour-x',Math.round(r.left-PAD)+'px');capaEl.style.setProperty('--tour-y',Math.round(r.top-PAD)+'px');
   capaEl.style.setProperty('--tour-w',Math.round(r.width+2*PAD)+'px');capaEl.style.setProperty('--tour-h',Math.round(r.height+2*PAD)+'px');
   capaEl.removeAttribute('data-sin-foco');
   if(primera){primera=false;requestAnimationFrame(()=>capaEl.setAttribute('data-animar',''));}
   if(e){
    const cx=r.left+r.width/2,cy=r.top+r.height/2;
    const cabe:Record<LadoEtiqueta,boolean>={abajo:r.bottom+PAD+GAP+h<innerHeight-MARGEN,arriba:r.top-PAD-GAP-h>MARGEN,der:r.right+PAD+GAP+w<innerWidth-MARGEN,izq:r.left-PAD-GAP-w>MARGEN};
    const lado=(['abajo','arriba','der','izq'] as LadoEtiqueta[]).find(l=>cabe[l])??'abajo';
    const x=lado==='der'?r.right+PAD+GAP:lado==='izq'?r.left-PAD-GAP-w:cx-w/2,y=lado==='abajo'?r.bottom+PAD+GAP:lado==='arriba'?r.top-PAD-GAP-h:cy-h/2;
    e.style.setProperty('--lab-x',Math.round(Math.max(MARGEN,Math.min(x,innerWidth-w-MARGEN)))+'px');e.style.setProperty('--lab-y',Math.round(Math.max(MARGEN,Math.min(y,innerHeight-h-MARGEN)))+'px');
    e.setAttribute('data-lado',lado);e.style.setProperty('visibility','visible');
   }
   // La tarjeta se ancla al lado contrario del elemento para no taparlo (en pantallas estrechas siempre va abajo).
   if(!pantallaEstrecha())tarjeta.current?.setAttribute('data-lado',r.left+r.width/2>innerWidth/2?'izq':'der');
  };
  medir();
  return()=>{cancelAnimationFrame(cuadro);};
 },[el]);
 // 5) Foco: si estaba en la tarjeta, en el menú o en el disparador (o en ningún sitio), pasa al botón principal del paso; si la persona está en la página, no se le quita.
 useEffect(()=>{
  if(!abierto)return;
  const a=document.activeElement;
  if(!a||a===document.body||tarjeta.current?.contains(a)||menu.current?.contains(a)||a.id==='onb-boton')tarjeta.current?.querySelector<HTMLElement>('[data-onb-primario]')?.focus({preventScroll:true});
 },[abierto,pasoId]);
 if(!c||!c.listo||!c.tieneRecorrido)return null;
 const nombrePantalla=(href:string|null)=>{
  if(!href)return '';
  const item=todosLosItems().find(x=>x.item.href===href)?.item;if(item)return etiquetaItem(t,item);
  const p=pasosDe('plataforma').find(x=>x.href===href);return p?t(p.textos.titulo as Clave):href;
 };
 const opciones=c.hayModoCorto?{corto:c.pasosCorto,completo:c.pasosCompleto}:undefined;
 const nombres=c.pantallas.map(g=>nombrePantalla(g.href)),total=c.pasos.length,n=c.rec.indice+1;
 let tarjetaUi=null,etiquetaUi=null,bannerUi=null;
 if(abierto&&paso){
  const cierre=paso.tipo==='cierre',pantalla=nombrePantalla(paso.pantalla),nombreEl=el?nombreDe(el):'';
  const titulo=cierre?t(paso.titulo as Clave):paso.tipo==='ir'?t('onb.tour.ir.titulo',{pantalla}):paso.titulo?t(paso.titulo as Clave):pantalla;
  const cuerpo=cierre||paso.tipo==='info'?t(paso.cuerpo as Clave):t('onb.tour.ir.cuerpo',{nombre:nombreEl||pantalla});
  const centrada=cierre||el===null;
  tarjetaUi=<TarjetaRecorrido t={t} innerRef={tarjeta} tipo={paso.tipo} titulo={titulo} cuerpo={cuerpo} ilu={paso.ilu} n={n} total={total} grupoN={Math.min(paso.grupo+1,nombres.length)} grupoTotal={nombres.length}
   hayAnterior={reducir(c.rec,{tipo:'anterior'},c.pasos.length,c.pasos,c.ruta).indice!==c.rec.indice} ruta={{nombres,actual:cierre?-1:paso.grupo}} centrada={centrada} sinObjetivo={!cierre&&paso.tipo!=='ir'&&el===null} resumen={cierre?t('onb.tour.cierre.resumen',{n:nombres.length,lista:nombres.join(' · ')}):undefined} mostrarSetup={c.pista!=='plataforma'}
   anterior={()=>c.despachar({tipo:'anterior'})} omitir={c.omitir} primario={cierre?()=>c.despachar({tipo:'siguiente'}):c.siguiente} irSetup={c.terminarEIrASetup}/>;
  if(el&&nombreEl&&(paso.tipo==='ir'||esControl(el)))etiquetaUi=<EtiquetaObjetivo innerRef={etiqueta} texto={paso.tipo==='ir'?t('onb.tour.clic',{nombre:nombreEl}):t('onb.tour.aqui',{nombre:nombreEl})}/>;
  if(paso.clave==='que')bannerUi=<BannerPantalla t={t} pantalla={pantalla}/>;
 }
 return <>
  {c.menuAbierto&&<MenuGuia t={t} innerRef={menu} contexto={t('onb.ui.rolOrg',{organizacion:c.datos.organizacion,rol:c.datos.rolEtiqueta})} tienePaso={c.pasos.some(p=>p.id===c.local.paso)} mostrarChecklistOpcion={c.tieneChecklist} descartado={c.local.descartado}
   iniciar={m=>c.iniciar('inicio',m)} opciones={opciones} retomar={()=>c.iniciar('retomar')} mostrarChecklist={c.mostrarChecklist} abrirSetup={c.abrirSetup} noVolver={c.noVolver} cerrar={()=>{c.cerrarMenu();c.enfocarBoton();}}
   pantallas={c.pantallas.map((g,i)=>({href:g.href,nombre:nombres[i],actual:abierto&&paso?.grupo===g.grupo}))} irAPantalla={c.irAPantalla}/>}
  {c.invitacionVisible&&<InvitacionRecorrido t={t} saltar={c.saltarInvitacion} empezar={m=>c.iniciar('inicio',m)} opciones={opciones}/>}
  {abierto&&paso&&<CapaFoco innerRef={capa} scrim={paso.tipo==='cierre'||el===null}/>}
  {etiquetaUi}{tarjetaUi}{bannerUi}
 </>;
}
