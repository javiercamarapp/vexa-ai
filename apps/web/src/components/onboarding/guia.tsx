'use client';
// Botón «Guía» del encabezado y paneles del recorrido (foco con atenuación, etiqueta «haz clic aquí», tarjeta, invitación, menú). Sin librerías ni estilos en línea:
// todo se pinta con clases (onboarding.css) y la posición del recorte se escribe por CSSOM (style.setProperty), que la CSP permite.
import {useEffect,useRef,useState} from 'react';
import {useT} from '../i18n/proveedor';
import {etiquetaItem} from '../../lib/i18n/menu';
import {todosLosItems} from '../../lib/workspace/menu.mjs';
import {pasosDe} from '../../lib/onboarding/catalogo.mjs';
import {enPantalla} from '../../lib/onboarding/ruta.mjs';
import {reducir,teclasPropias} from '../../lib/onboarding/recorrido.mjs';
import {crearViaje,estadoViajeInicial,type EstadoViaje} from '../../lib/onboarding/viaje.mjs';
import {cancelarConTecla,planDelPaso,puedeTomarFoco,punteroFueraDeTarjeta,reiniciarAlSalir} from '../../lib/onboarding/cableado.mjs';
import type {Clave} from '../../lib/i18n';
import {contarPasos,useOnboarding} from './contexto';
import {CapaFoco,EtiquetaObjetivo,InvitacionRecorrido,MenuGuia,TarjetaRecorrido,type LadoEtiqueta} from './paneles';
import {abrirGrupoDelMenu,enCampo,esperarObjetivo,hayFormularioSucio,nombreDe,pantallaEstrecha,reducirMovimiento} from './objetivo';
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
 const abierto=Boolean(c?.rec.abierto),paso=c?.paso??null,ruta=c?.ruta??'';
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
 // 3) Viaje de un paso «ir». Las reglas (cuándo se arma, cuenta de 3 s, cancelar, un solo disparo, salida por fallo) viven en lib/onboarding/viaje.mjs; aquí solo se conecta con el DOM.
 // El clic real en el elemento (el de la persona o el del propio viaje) deja el paso esperando la ruta: se completa al LLEGAR a la pantalla (contexto.tsx), no al hacer clic.
 const tipo=paso?.tipo;
 const llevame=c?.llevame,viajeAutomatico=c?.viajeAutomatico,registrarViaje=c?.registrarViaje,llevarRef=useRef(llevame),viajeRef=useRef(viajeAutomatico);
 const ctlRef=useRef<ReturnType<typeof crearViaje>|null>(null),[viaje,setViaje]=useState<EstadoViaje>(estadoViajeInicial);
 useEffect(()=>{llevarRef.current=llevame;viajeRef.current=viajeAutomatico;});
 useEffect(()=>{
  const ctl=crearViaje({alCambiar:setViaje,alViajar:()=>llevarRef.current?.()});
  ctlRef.current=ctl;registrarViaje?.(ctl);
  return()=>{ctl.destruir();ctlRef.current=null;registrarViaje?.(null);};
 },[registrarViaje]);
 useEffect(()=>{
  if(!el||tipo!=='ir')return;
  const alClic=()=>{ctlRef.current?.enviar({tipo:'clic'});};
  el.addEventListener('click',alClic,true);return()=>el.removeEventListener('click',alClic,true);
 },[el,tipo]);
 // Al cambiar de paso (o cerrar) nada del viaje anterior queda vivo: ni la cuenta ni el plazo.
 useEffect(()=>reiniciarAlSalir(()=>ctlRef.current),[pasoId]);
 // Con el elemento ya resuelto (existe, o no existe: menú plegado o cajón móvil) se decide si viaja: solo si se llegó avanzando, sin movimiento reducido, sin foco en un campo ni formulario modificado.
 useEffect(()=>{
  if(tipo!=='ir'||el===undefined)return;
  ctlRef.current?.enviar({tipo:'planear',plan:planDelPaso({tipo,armado:viajeRef.current?.()??false,el,sensores:{reducirMovimiento,enCampo:()=>enCampo(document.activeElement),hayFormularioSucio:()=>hayFormularioSucio()}})});
 },[el,tipo,pasoId]);
 // Mientras corre la cuenta, Escape, Tab, un clic fuera de la tarjeta o tocar un campo la cancelan. Escape SOLO cancela el viaje (queda «Ir a …»); un segundo Escape cierra la guía.
 const faseViaje=viaje.fase;
 useEffect(()=>{
  if(faseViaje!=='cuenta')return;
  const cancelar=(motivo:string)=>{ctlRef.current?.enviar({tipo:'cancelar',motivo});};
  const alTecla=(e:KeyboardEvent)=>{if(ctlRef.current)cancelarConTecla(ctlRef.current,e);};
  const alPuntero=(e:PointerEvent)=>{if(punteroFueraDeTarjeta(e.target,tarjeta.current))cancelar('clic-fuera');};
  const alCampo=(e:Event)=>{if(e.target instanceof HTMLElement&&teclasPropias(e.target))cancelar('campo');};
  document.addEventListener('keydown',alTecla,true);document.addEventListener('pointerdown',alPuntero,true);document.addEventListener('focusin',alCampo,true);document.addEventListener('input',alCampo,true);
  return()=>{document.removeEventListener('keydown',alTecla,true);document.removeEventListener('pointerdown',alPuntero,true);document.removeEventListener('focusin',alCampo,true);document.removeEventListener('input',alCampo,true);};
 },[faseViaje]);
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
  if(puedeTomarFoco({activo:document.activeElement,cuerpo:document.body,tarjeta:tarjeta.current,menu:menu.current}))tarjeta.current?.querySelector<HTMLElement>('[data-onb-primario]')?.focus({preventScroll:true});
 },[abierto,pasoId]);
 // 6) Lector de pantalla en modo exploración (no dispara Tab): al aparecer la cuenta el foco pasa a «Quedarme aquí», que es lo único que hay que alcanzar en 3 s;
 // si la persona está en un campo o en la página, no se le quita. Al cancelarla, «Quedarme aquí» desaparece y el foco pasa a «Ir a …» (no se pierde en el documento).
 const faseAntes=useRef(faseViaje);
 useEffect(()=>{
  const antes=faseAntes.current;faseAntes.current=faseViaje;
  const quien=faseViaje==='cuenta'?'[data-onb-quedarme]':antes==='cuenta'&&faseViaje==='manual'?'[data-onb-manual]':null;
  if(!quien||!puedeTomarFoco({activo:document.activeElement,cuerpo:document.body,tarjeta:tarjeta.current,menu:menu.current}))return;
  tarjeta.current?.querySelector<HTMLElement>(quien)?.focus({preventScroll:true});
 },[faseViaje]);
 if(!c||!c.listo||!c.tieneRecorrido)return null;
 const nombrePantalla=(href:string|null)=>{
  if(!href)return '';
  const item=todosLosItems().find(x=>x.item.href===href)?.item;if(item)return etiquetaItem(t,item);
  const p=pasosDe('plataforma').find(x=>x.href===href);return p?t(p.textos.titulo as Clave):href;
 };
 const opciones=c.hayModoCorto?{corto:c.pasosCorto,completo:c.pasosCompleto}:undefined;
 // El contador no cuenta los saltos de menú («ir»): solo las pantallas y el cierre. En un salto muestra el paso al que se va.
 const nombres=c.pantallas.map(g=>nombrePantalla(g.href)),total=Math.max(1,contarPasos(c.pasos)),antes=contarPasos(c.pasos.slice(0,c.rec.indice+1)),n=Math.max(1,antes+(paso?.tipo==='ir'?1:0));
 let tarjetaUi=null,etiquetaUi=null;
 if(abierto&&paso){
  const cierre=paso.tipo==='cierre',pantalla=nombrePantalla(paso.pantalla),nombreEl=el?nombreDe(el):'';
  const titulo=cierre?t(paso.titulo as Clave):paso.tipo==='ir'?t('onb.tour.ir.titulo',{pantalla}):paso.titulo?t(paso.titulo as Clave):pantalla;
  // El cuerpo del paso «ir» solo promete el viaje si va a viajar (cuenta en marcha); tras recargar, con movimiento reducido o al cancelar dice cómo ir a mano.
  const viaja=viaje.fase==='cuenta'||(viaje.fase==='inactivo'&&Boolean(c.viajeAutomatico())&&!reducirMovimiento());
  const cuerpo=cierre||paso.tipo==='info'?t(paso.cuerpo as Clave):t(viaja?'onb.tour.ir.cuerpoViaja':'onb.tour.ir.cuerpo',{nombre:pantalla});
  const centrada=cierre||el===null;
  tarjetaUi=<TarjetaRecorrido t={t} innerRef={tarjeta} tipo={paso.tipo} titulo={titulo} cuerpo={cuerpo} ilu={paso.ilu} n={n} total={total} grupoN={Math.min(paso.grupo+1,nombres.length)} grupoTotal={nombres.length}
   hayAnterior={reducir(c.rec,{tipo:'anterior'},c.pasos.length,c.pasos,c.ruta).indice!==c.rec.indice} ruta={{nombres:cierre?[]:nombres,actual:paso.grupo}} centrada={centrada} sinObjetivo={!cierre&&paso.tipo!=='ir'&&el===null} mostrarSetup={c.pista!=='plataforma'}
   viaje={paso.tipo==='ir'?{fase:viaje.fase,restan:viaje.restan,nombre:pantalla,quedarme:()=>ctlRef.current?.enviar({tipo:'cancelar',motivo:'quedarme'}),irManual:()=>ctlRef.current?.enviar({tipo:'manual'}),continuar:()=>c.despachar({tipo:'siguiente'})}:undefined}
   anterior={()=>c.despachar({tipo:'anterior'})} omitir={c.omitir} primario={cierre?()=>c.despachar({tipo:'siguiente'}):c.siguiente} irSetup={c.terminarEIrASetup}/>;
  // En un paso «ir» título, cuerpo y etiqueta dicen lo mismo: el rótulo del menú (etiquetaItem), nunca el title del enlace ni su texto interno.
  if(el&&((paso.tipo==='ir'&&pantalla)||(nombreEl&&esControl(el))))etiquetaUi=<EtiquetaObjetivo innerRef={etiqueta} texto={paso.tipo==='ir'?t('onb.tour.clic',{nombre:pantalla}):t('onb.tour.aqui',{nombre:nombreEl})}/>;
 }
 return <>
  {c.menuAbierto&&<MenuGuia t={t} innerRef={menu} contexto={t('onb.ui.rolOrg',{organizacion:c.datos.organizacion,rol:c.datos.rolEtiqueta})} tienePaso={c.pasos.some(p=>p.id===c.local.paso)} mostrarChecklistOpcion={c.tieneChecklist} descartado={c.local.descartado}
   iniciar={m=>c.iniciar('inicio',m)} opciones={opciones} retomar={()=>c.iniciar('retomar')} mostrarChecklist={c.mostrarChecklist} abrirSetup={c.pista==='plataforma'?undefined:c.abrirSetup} noVolver={c.noVolver} cerrar={()=>{c.cerrarMenu();c.enfocarBoton();}}
   pantallas={c.pantallas.map((g,i)=>({href:g.href,nombre:nombres[i],actual:abierto&&paso?.grupo===g.grupo}))} irAPantalla={c.irAPantalla}/>}
  {c.invitacionVisible&&<InvitacionRecorrido t={t} saltar={c.saltarInvitacion} empezar={m=>c.iniciar('inicio',m)} opciones={opciones}/>}
  {abierto&&paso&&<CapaFoco innerRef={capa} scrim={paso.tipo==='cierre'||el===null}/>}
  {etiquetaUi}{tarjetaUi}
 </>;
}
