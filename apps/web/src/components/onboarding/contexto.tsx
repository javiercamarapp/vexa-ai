'use client';
// Estado y comportamiento del recorrido, compartidos entre el botón «Guía» (encabezado) y los paneles (tarjeta, foco, invitación, menú),
// que viven FUERA del encabezado porque este usa backdrop-filter y atraparía a los elementos fixed.
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {pasosDe,type Pista} from '../../lib/onboarding/catalogo.mjs';
import {estadoInicial,eventoDeTecla,reducir,teclasPropias,type EstadoRecorrido,type EventoRecorrido} from '../../lib/onboarding/recorrido.mjs';
import {construirTour,gruposDe,type ModoTour,type PasoTour} from '../../lib/onboarding/tour.mjs';
import {enPantalla} from '../../lib/onboarding/ruta.mjs';
import {armadoTras,type EventoViaje} from '../../lib/onboarding/viaje.mjs';
import {hrefConAlcance} from '../../lib/workspace/alcance.mjs';
import {actualizarEstado,almacenDelNavegador,claveEstado,ESTADO_VACIO,leerEstado,type EstadoLocal} from '../../lib/onboarding/estado';
import {abrirGrupoDelMenu,primerVisible} from './objetivo';
/** rol = rol efectivo de la sesión en la organización (en «Ver como» es lector); ausente en la consola de plataforma. */
export interface DatosOnboarding {pista:Pista|null;userId:string;tenantId:string;organizacion:string;rolEtiqueta:string;rol?:string}
export interface Controlador {
 datos:DatosOnboarding;pista:Pista|null;listo:boolean;local:EstadoLocal;tieneRecorrido:boolean;pasos:PasoTour[];pantallas:{href:string;grupo:number;desde:number}[];tieneChecklist:boolean;
 rec:EstadoRecorrido;paso:PasoTour|null;menuAbierto:boolean;invitacionVisible:boolean;soporteTerminado:boolean;ruta:string;
 registrarBoton:(el:HTMLButtonElement|null)=>void;enfocarBoton:()=>void;
 alternarMenu:()=>void;cerrarMenu:()=>void;
 modo:ModoTour;hayModoCorto:boolean;pasosCorto:number;pasosCompleto:number;
 abrirSetup:()=>void;iniciar:(modo:'inicio'|'retomar',recorrido?:ModoTour)=>void;irAPantalla:(href:string)=>void;despachar:(e:EventoRecorrido)=>void;siguiente:()=>void;llevame:()=>void;viajeAutomatico:()=>boolean;registrarViaje:(ctl:ControlViaje|null)=>void;terminarEIrASetup:()=>void;
 omitir:()=>void;noVolver:()=>void;saltarInvitacion:()=>void;mostrarChecklist:()=>void;ocultarChecklist:()=>void;
}
/** Conductor del viaje automático del paso «ir» (lo crea guia.tsx; el estado y las reglas viven en lib/onboarding/viaje.mjs). */
export interface ControlViaje {enviar:(e:EventoViaje)=>unknown}
/** Pasos que cuenta la persona: los saltos de menú («ir») no cuentan, solo las pantallas y el cierre. */
export const contarPasos=(lista:readonly {tipo:string}[])=>lista.filter(p=>p.tipo!=='ir').length;
const Contexto=createContext<Controlador|null>(null);
export const useOnboarding=()=>useContext(Contexto);
export function OnboardingRaiz({datos,children}:{datos:DatosOnboarding;children:ReactNode}){
 const {pista,userId,tenantId}=datos,router=useRouter(),pathname=usePathname(),consulta=useSearchParams()?.toString()??'';
 const tieneRecorrido=Boolean(pista&&pista!=='soporte');
 // Si la sesión de soporte termina con la pantalla abierta (la pista deja de ser «soporte»), se avisa en vez de cambiar la vista sin decir nada.
 const [pistaAnterior,setPistaAnterior]=useState(pista),[soporteTerminado,setSoporteTerminado]=useState(false);
 if(pistaAnterior!==pista){setPistaAnterior(pista);setSoporteTerminado(pistaAnterior==='soporte'&&pista!=='soporte');}
 // El recorrido se construye del catálogo y del menú real del rol: mismas pantallas que ve, nada más. «Corto» = solo lo esencial del rol (tour.mjs, ESENCIALES).
 const [modo,setModo]=useState<ModoTour>('completo');
 const completo=useMemo(()=>tieneRecorrido&&pista?construirTour(pista,'completo'):[],[tieneRecorrido,pista]);
 const corto=useMemo(()=>tieneRecorrido&&pista?construirTour(pista,'corto'):[],[tieneRecorrido,pista]);
 const hayModoCorto=corto.length>0&&corto.length<completo.length;
 const pasos=modo==='corto'&&hayModoCorto?corto:completo;
 const pantallas=useMemo(()=>gruposDe(pasos),[pasos]);
 const tieneChecklist=Boolean(tieneRecorrido&&pista&&pasosDe(pista,'checklist').length>0);
 const clave=useMemo(()=>tieneRecorrido&&pista?claveEstado(userId,tenantId,pista):null,[tieneRecorrido,pista,userId,tenantId]);
 const [listo,setListo]=useState(false),[local,setLocal]=useState<EstadoLocal>(ESTADO_VACIO),[rec,setRec]=useState<EstadoRecorrido>(estadoInicial()),[menuAbierto,setMenuAbierto]=useState(false);
 const [boton,setBoton]=useState<HTMLButtonElement|null>(null),abiertoAntes=useRef(false),rutaRef=useRef(pathname);
 useEffect(()=>{rutaRef.current=pathname;},[pathname]);
 // Lo guardado se lee tras montar (el servidor no ve el navegador): evita diferencias de hidratación. Al cambiar de rol u organización cambia la clave.
 // Si el recorrido estaba abierto al recargar, se retoma en el mismo paso.
 useEffect(()=>{const frame=requestAnimationFrame(()=>{
  const leido=clave?leerEstado(almacenDelNavegador(),clave):ESTADO_VACIO,elegido:ModoTour=leido.modo==='corto'&&corto.length>0&&corto.length<completo.length?'corto':'completo',lista=elegido==='corto'?corto:completo;
  const indice=leido.activo&&!leido.descartado?lista.findIndex(p=>p.id===leido.paso):-1;
  setModo(elegido);setLocal(leido);setRec(indice>=0?reducir(estadoInicial(),{tipo:'abrir',indice},lista.length,lista,rutaRef.current):estadoInicial());setListo(true);
 });return()=>cancelAnimationFrame(frame);},[clave,corto,completo]);
 const guardar=useCallback((parche:Partial<EstadoLocal>)=>{setLocal(previo=>clave?actualizarEstado(almacenDelNavegador(),clave,{...previo,...parche}):{...previo,...parche});},[clave]);
 // Todo cambio del recorrido nace de una acción de la persona (o de que llegue a la pantalla a la que se le mandó): aquí se aplica y se guarda el paso.
 // Si el paso cae en otra pantalla distinta de la actual (volver atrás, retomar, saltar), se la lleva; un paso «ir» no navega: te dice qué apretar.
 // `viaje` marca que el paso actual lo alcanzó AVANZANDO por una acción de la persona (Siguiente, flecha derecha, Empezar, Retomar, elegir pantalla): solo entonces un paso «ir» la lleva solo.
 // Anterior, cerrar, un cambio de ruta y un recorrido restaurado al recargar nunca viajan solos (armadoTras, lib/onboarding/viaje.mjs).
 const viaje=useRef(false),viajeCtl=useRef<ControlViaje|null>(null);
 const aplicar=useCallback((sig:EstadoRecorrido,navegar:boolean,lista:PasoTour[]=pasos)=>{
  setRec(sig);
  if(sig.abierto){const p=lista[sig.indice];if(p){guardar({paso:p.id,visto:true,activo:true});if(navegar&&p.tipo!=='ir'&&p.pantalla&&!enPantalla(pathname,p.pantalla))router.push(hrefConAlcance(p.pantalla,consulta));}}
  else if(sig.terminado)guardar({paso:null,visto:true,omitido:false,activo:false});
  else guardar({activo:false});
 },[consulta,guardar,pasos,pathname,router]);
 const despachar=useCallback((e:EventoRecorrido)=>{viaje.current=armadoTras(e.tipo);aplicar(reducir(rec,e,pasos.length,pasos,pathname),e.tipo!=='clic'&&e.tipo!=='ruta');},[aplicar,rec,pasos,pathname]);
 // Llegar a la pantalla a la que te mandaba un paso «ir» (por clic, «Llévame», atrás del navegador…) lo completa. Un cambio de ruta ajeno no abre, cierra ni mueve nada.
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{const sig=reducir(rec,{tipo:'ruta',ruta:pathname},pasos.length,pasos,pathname);if(sig!==rec){viaje.current=armadoTras('ruta');aplicar(sig,false);}});
  return()=>cancelAnimationFrame(frame);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al cambio de ruta
 },[pathname]);
 const paso=rec.abierto?(pasos[rec.indice]??null):null;
 // Al cerrar (Esc, Omitir, Terminar) el foco vuelve al disparador: el botón Guía.
 useEffect(()=>{if(abiertoAntes.current&&!rec.abierto)boton?.focus();abiertoAntes.current=rec.abierto;},[rec.abierto,boton]);
 // «inicio» empieza de cero; «retomar» sigue en el paso guardado. `recorrido` elige corto o completo (se guarda); sin él se usa el último elegido.
 const iniciar=useCallback((como:'inicio'|'retomar',recorrido?:ModoTour)=>{
  const elegido:ModoTour=recorrido&&(recorrido==='completo'||hayModoCorto)?recorrido:modo,lista=elegido==='corto'?corto:completo;
  const desde=como==='retomar'?lista.findIndex(p=>p.id===local.paso):-1;
  viaje.current=armadoTras('abrir');setMenuAbierto(false);setModo(elegido);guardar({omitido:false,modo:elegido});aplicar(reducir(rec,{tipo:'abrir',indice:desde>=0?desde:0},lista.length,lista,pathname),false,lista);
 },[aplicar,completo,corto,guardar,hayModoCorto,local.paso,modo,pathname,rec]);
 const irAPantalla=useCallback((href:string)=>{
  const g=pantallas.find(x=>x.href===href);if(!g)return;
  viaje.current=armadoTras('abrir');setMenuAbierto(false);guardar({omitido:false});aplicar(reducir(rec,{tipo:'abrir',indice:g.desde},pasos.length,pasos,pathname),false);
 },[aplicar,guardar,pantallas,pasos,pathname,rec]);
 const abrirSetup=useCallback(()=>{setMenuAbierto(false);router.push('/setup');},[router]);
 // Viaje de un paso «ir» (lo dispara el conductor del viaje: la cuenta regresiva, «Siguiente», la flecha derecha o «Ir a …»): hace el clic real en el elemento (así viaja con el alcance del menú); si no está a la vista, navega directo.
 // El paso «ir» NO se completa aquí: se completa cuando llega la ruta (efecto de `pathname`); si no llega, el conductor lo saca por «No pude abrir esta pantalla».
 const llevame=useCallback(()=>{
  const p=rec.abierto?pasos[rec.indice]:null;
  if(!p||p.tipo!=='ir'||!p.href)return;
  abrirGrupoDelMenu(p.objetivos);
  const el=primerVisible(p.objetivos);
  if(el){el.click();return;}
  router.push(hrefConAlcance(p.href,consulta));
 },[consulta,pasos,rec.abierto,rec.indice,router]);
 // Siguiente en un paso «ir» pasa por el conductor: si la cuenta ya viaja o ya viajó, no dispara un segundo viaje.
 const siguiente=useCallback(()=>{if(paso?.tipo==='ir'){if(viajeCtl.current)viajeCtl.current.enviar({tipo:'siguiente'});else llevame();}else despachar({tipo:'siguiente'});},[despachar,llevame,paso?.tipo]);
 const registrarViaje=useCallback((ctl:ControlViaje|null)=>{viajeCtl.current=ctl;},[]);
 const terminarEIrASetup=useCallback(()=>{despachar({tipo:'siguiente'});router.push('/setup');},[despachar,router]);
 const omitir=useCallback(()=>{guardar({omitido:true,visto:true,paso:null,activo:false});setRec(reducir(rec,{tipo:'cerrar'},pasos.length,pasos,pathname));},[guardar,pasos,pathname,rec]);
 const noVolver=useCallback(()=>{setMenuAbierto(false);guardar({descartado:true,omitido:true,visto:true,paso:null,activo:false});setRec(reducir(rec,{tipo:'cerrar'},pasos.length,pasos,pathname));},[guardar,pasos,pathname,rec]);
 const saltarInvitacion=useCallback(()=>guardar({omitido:true,visto:true}),[guardar]);
 const mostrarChecklist=useCallback(()=>{setMenuAbierto(false);guardar({descartado:false});router.push('/overview');},[guardar,router]);
 const ocultarChecklist=useCallback(()=>guardar({descartado:true}),[guardar]);
 // Teclado a nivel de documento mientras el recorrido está abierto: las flechas avanzan SIEMPRE (también tras navegar a otra pantalla),
 // salvo dentro de campos de texto, listas, pestañas o con modificadores. Esc siempre sale. Enter solo cuenta dentro de la tarjeta.
 const abierto=rec.abierto;
 useEffect(()=>{
  if(!abierto)return;
  const alTeclear=(e:KeyboardEvent)=>{
   if(e.defaultPrevented)return;
   const objetivo=e.target instanceof HTMLElement?e.target:null;
   const ev=eventoDeTecla(e.key,objetivo?.tagName??'',{propias:teclasPropias(objetivo),modificador:e.altKey||e.ctrlKey||e.metaKey||e.shiftKey});
   if(!ev)return;
   if(e.key==='Enter'&&!objetivo?.closest('.onb-tarjeta'))return;
   e.preventDefault();
   if(ev.tipo==='siguiente')siguiente();else despachar(ev);
  };
  document.addEventListener('keydown',alTeclear);return()=>document.removeEventListener('keydown',alTeclear);
 },[abierto,siguiente,despachar]);
 const invitacionVisible=listo&&tieneRecorrido&&!rec.abierto&&!local.visto&&!local.omitido&&!local.descartado;
 const valor:Controlador={datos,pista,listo,local,tieneRecorrido,pasos,modo,hayModoCorto,pasosCorto:contarPasos(corto),pasosCompleto:contarPasos(completo),pantallas,tieneChecklist,rec,paso,menuAbierto,invitacionVisible,soporteTerminado,ruta:pathname,registrarBoton:setBoton,enfocarBoton:()=>boton?.focus(),
  alternarMenu:()=>setMenuAbierto(v=>!v),cerrarMenu:()=>setMenuAbierto(false),abrirSetup,iniciar,irAPantalla,despachar,siguiente,llevame,viajeAutomatico:()=>viaje.current,registrarViaje,terminarEIrASetup,omitir,noVolver,saltarInvitacion,mostrarChecklist,ocultarChecklist};
 return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
