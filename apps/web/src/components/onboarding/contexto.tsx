'use client';
// Estado y comportamiento del recorrido, compartidos entre el botón «Guía» (encabezado) y los paneles (tarjeta, invitación, menú),
// que viven FUERA del encabezado porque este usa backdrop-filter y atraparía a los elementos fixed.
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {pasosDe,type Pista,type PasoOnboarding} from '../../lib/onboarding/catalogo.mjs';
import {estadoInicial,reducir,type EstadoRecorrido,type EventoRecorrido} from '../../lib/onboarding/recorrido.mjs';
import {actualizarEstado,almacenDelNavegador,claveEstado,ESTADO_VACIO,leerEstado,reconciliar,type EstadoLocal} from '../../lib/onboarding/estado';
export interface DatosOnboarding {pista:Pista|null;userId:string;tenantId:string;organizacion:string;rolEtiqueta:string}
export interface Controlador {
 datos:DatosOnboarding;pista:Pista|null;listo:boolean;local:EstadoLocal;tieneRecorrido:boolean;pasos:PasoOnboarding[];tieneChecklist:boolean;
 rec:EstadoRecorrido;paso:PasoOnboarding|null;menuAbierto:boolean;invitacionVisible:boolean;
 registrarBoton:(el:HTMLButtonElement|null)=>void;enfocarBoton:()=>void;
 alternarMenu:()=>void;cerrarMenu:()=>void;
 iniciar:(modo:'inicio'|'retomar')=>void;despachar:(e:EventoRecorrido)=>void;omitir:()=>void;noVolver:()=>void;saltarInvitacion:()=>void;mostrarChecklist:()=>void;ocultarChecklist:()=>void;
}
const Contexto=createContext<Controlador|null>(null);
export const useOnboarding=()=>useContext(Contexto);
export function OnboardingRaiz({datos,children}:{datos:DatosOnboarding;children:ReactNode}){
 const {pista,userId,tenantId}=datos,router=useRouter(),pathname=usePathname();
 const tieneRecorrido=Boolean(pista&&pista!=='soporte');
 const pasos=useMemo(()=>tieneRecorrido&&pista?pasosDe(pista,'tour'):[],[tieneRecorrido,pista]);
 const tieneChecklist=Boolean(tieneRecorrido&&pista&&pasosDe(pista,'checklist').length>0);
 const clave=useMemo(()=>tieneRecorrido&&pista?claveEstado(userId,tenantId,pista):null,[tieneRecorrido,pista,userId,tenantId]);
 const [listo,setListo]=useState(false),[local,setLocal]=useState<EstadoLocal>(ESTADO_VACIO),[rec,setRec]=useState<EstadoRecorrido>(estadoInicial()),[menuAbierto,setMenuAbierto]=useState(false);
 const [boton,setBoton]=useState<HTMLButtonElement|null>(null),abiertoAntes=useRef(false);
 // Lo guardado se lee tras montar (el servidor no ve el navegador): evita diferencias de hidratación. Al cambiar de rol u organización cambia la clave y se reconcilia.
 useEffect(()=>{const frame=requestAnimationFrame(()=>{setLocal(clave?leerEstado(almacenDelNavegador(),clave):ESTADO_VACIO);setRec(estadoInicial());setListo(true);});return()=>cancelAnimationFrame(frame);},[clave]);
 const guardar=useCallback((parche:Partial<EstadoLocal>)=>{setLocal(previo=>clave?actualizarEstado(almacenDelNavegador(),clave,{...previo,...parche}):{...previo,...parche});},[clave]);
 // Todo cambio del recorrido nace de una acción de la persona: aquí se aplica, se guarda el paso y, si cambió de pantalla, se la lleva (un cambio de ruta ajeno nunca pasa por aquí).
 const aplicar=useCallback((sig:EstadoRecorrido)=>{
  setRec(sig);
  if(sig.abierto){const p=pasos[sig.indice];if(p){guardar({paso:p.id,visto:true});if(p.href&&p.href!==pathname)router.push(p.href);}}
  else if(sig.terminado)guardar({paso:null,visto:true,omitido:false});
 },[guardar,pasos,pathname,router]);
 const despachar=useCallback((e:EventoRecorrido)=>aplicar(reducir(rec,e,pasos.length)),[aplicar,rec,pasos.length]);
 const paso=rec.abierto?(pasos[rec.indice]??null):null;
 // Al cerrar (Esc, Omitir, Terminar) el foco vuelve al disparador: el botón Guía.
 useEffect(()=>{if(abiertoAntes.current&&!rec.abierto)boton?.focus();abiertoAntes.current=rec.abierto;},[rec.abierto,boton]);
 const iniciar=useCallback((modo:'inicio'|'retomar')=>{
  const desde=modo==='retomar'&&pista?reconciliar(local,pista).pasoActual:null;
  const indice=Math.max(0,pasos.findIndex(p=>p.id===desde));
  setMenuAbierto(false);guardar({omitido:false});aplicar(reducir(rec,{tipo:'abrir',indice:modo==='retomar'?indice:0},pasos.length));
 },[aplicar,guardar,local,pasos,pista,rec]);
 const omitir=useCallback(()=>{guardar({omitido:true,visto:true,paso:null});setRec(reducir(rec,{tipo:'cerrar'},pasos.length));},[guardar,pasos.length,rec]);
 const noVolver=useCallback(()=>{setMenuAbierto(false);guardar({descartado:true,omitido:true,visto:true,paso:null});setRec(reducir(rec,{tipo:'cerrar'},pasos.length));},[guardar,pasos.length,rec]);
 const saltarInvitacion=useCallback(()=>guardar({omitido:true,visto:true}),[guardar]);
 const mostrarChecklist=useCallback(()=>{setMenuAbierto(false);guardar({descartado:false});router.push('/overview');},[guardar,router]);
 const ocultarChecklist=useCallback(()=>guardar({descartado:true}),[guardar]);
 const invitacionVisible=listo&&tieneRecorrido&&!rec.abierto&&!local.visto&&!local.omitido&&!local.descartado;
 const valor:Controlador={datos,pista,listo,local,tieneRecorrido,pasos,tieneChecklist,rec,paso,menuAbierto,invitacionVisible,registrarBoton:setBoton,enfocarBoton:()=>boton?.focus(),
  alternarMenu:()=>setMenuAbierto(v=>!v),cerrarMenu:()=>setMenuAbierto(false),iniciar,despachar,omitir,noVolver,saltarInvitacion,mostrarChecklist,ocultarChecklist};
 return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
