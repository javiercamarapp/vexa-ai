'use client';
// /setup (Configuración): estado honesto de la configuración de la organización PARA EL ROL de quien mira. Solo lectura: no escribe nada.
// Los pasos salen del catálogo (lib/onboarding/asistente.mjs); el estado, de señales baratas del servidor (/api/onboarding/setup) y del estado de los avisos push.
import {useEffect,useMemo,useState} from 'react';
import {useLocaleIntl,useT} from '../i18n/proveedor';
import {useJson} from '../ui/use-json';
import {normalizarSenales} from '../../lib/onboarding/prerrequisitos.mjs';
import {calcularAsistente,datosHojaSoporte,indicadorConciliacion} from '../../lib/onboarding/asistente.mjs';
import {useOnboarding} from './contexto';
import {SetupVista} from './setup-piezas';
import {TOPE_LECTURA_MS} from './checklist';
import './onboarding.css';
import './setup.css';

type Setup={rol:string;senales:Record<string,boolean>|null;consultadas:string[];conciliacion:{resumen:string;pedidos:number|null;refreshedAt:string|null}};
type Push={configured:boolean;devices:number};
/** Forma estricta de /api/onboarding/setup: cualquier otra cosa se rechaza entera (nunca se inventa un «hecho»). */
export function aceptarSetup(json:unknown):Setup|null{
 const d=(json as {data?:Record<string,unknown>})?.data;if(!d||typeof d!=='object'||typeof d.rol!=='string')return null;
 const c=d.conciliacion as Record<string,unknown>|undefined;if(!c||typeof c!=='object'||typeof c.resumen!=='string')return null;
 const senales=d.senales&&typeof d.senales==='object'?Object.fromEntries(Object.entries(d.senales as Record<string,unknown>).map(([k,v])=>[k,v===true])):null;
 const consultadas=Array.isArray(d.consultadas)?d.consultadas.filter((x):x is string=>typeof x==='string'):[];
 return {rol:d.rol,senales,consultadas,conciliacion:{resumen:c.resumen,pedidos:typeof c.pedidos==='number'?c.pedidos:null,refreshedAt:typeof c.refreshedAt==='string'?c.refreshedAt:null}};
}
/** /api/notifications/push: solo interesa si el servidor lo tiene configurado y cuántos dispositivos hay. */
export function aceptarPush(json:unknown):Push|null{
 const d=(json as {data?:{configured?:unknown;devices?:unknown}})?.data;
 return d&&typeof d.configured==='boolean'&&Array.isArray(d.devices)?{configured:d.configured,devices:d.devices.length}:null;
}

export function SetupPantalla(){
 const c=useOnboarding(),t=useT(),locale=useLocaleIntl();
 const pista=c?.pista??null;
 const conLista=pista==='propietario'||pista==='analista'||pista==='operador'||pista==='lector';
 // Sin lista (soporte, plataforma, sin pista) no se pide nada: cero lecturas.
 const setup=useJson<Setup>(conLista?'/api/onboarding/setup':null,aceptarSetup);
 const push=useJson<Push>(conLista?'/api/notifications/push':null,aceptarPush);
 const senales=useMemo(()=>setup.data?.senales?normalizarSenales(setup.data.senales):null,[setup.data]);
 const lista=useMemo(()=>conLista&&pista?calcularAsistente(pista,{senales,consultadas:setup.data?.consultadas??[],push:push.data?{configurado:push.data.configured,dispositivos:push.data.devices}:null}):null,[conLista,pista,senales,setup.data,push.data]);
 const esperandoLectura=conLista&&((setup.busy&&!setup.data)||(push.busy&&!push.data)),[vencido,setVencido]=useState(false);
 useEffect(()=>{
  if(!esperandoLectura)return;
  const id=setTimeout(()=>setVencido(true),TOPE_LECTURA_MS);
  return()=>{clearTimeout(id);setVencido(false);};
 },[esperandoLectura]);
 const hoja=useMemo(()=>pista==='propietario'&&c?datosHojaSoporte({tenantId:c.datos.tenantId,organizacion:c.datos.organizacion}):null,[pista,c]);
 if(!c||!c.listo)return <SetupVista t={t} locale={locale} pista={null} rolEtiqueta="" soporteTerminado={false} cargando errorDeLectura={false} lista={{items:[],progreso:{hechos:0,total:0},siguiente:null}} conciliacion={null} fechaResumen={null} hoja={null}/>;
 // Nunca «Calculando tu avance…» para siempre: pasado el tope se muestra el error con «Reintentar» y los pasos quedan en «no se pudo comprobar».
 const cargando=esperandoLectura&&!vencido;
 const verDinero=pista==='propietario'||pista==='analista';
 const fecha=setup.data?.conciliacion.refreshedAt?new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(setup.data.conciliacion.refreshedAt)):null;
 const conc=verDinero&&!cargando?indicadorConciliacion(setup.data?{pedidos:setup.data.conciliacion.pedidos,resumen:setup.data.conciliacion.resumen,refreshedAt:setup.data.conciliacion.refreshedAt,ligadas:senales?senales.pedidos_ligados:null}:{resumen:'unavailable'}):null;
 return <SetupVista t={t} locale={locale} pista={pista} rolEtiqueta={c.datos.rolEtiqueta} soporteTerminado={c.soporteTerminado} cargando={cargando} errorDeLectura={Boolean((setup.error&&!setup.data)||(vencido&&esperandoLectura))} reintentar={()=>{setVencido(false);setup.reload();push.reload();}} lista={lista} conciliacion={conc} fechaResumen={fecha} hoja={hoja}/>;
}
