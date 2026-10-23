'use client';
import {createContext,useCallback,useContext,useMemo,useState,type ReactNode} from 'react';
import {Drawer} from '../ui/overlay';
import {Icon} from '../ui/icons';
import {KindBadge} from '../ui/kind-badge';
import type {EntradaComo} from '../hoy/hoy-modelo.mjs';
import './confianza.css';
/** Panel «Cómo se calculó»: UNO por pantalla (el proveedor lo pinta una sola vez); cada cifra solo trae su botón ⓘ. */
const Ctx=createContext<((e:EntradaComo)=>void)|null>(null);
export function ComoSeCalculoProvider({children}:{children:ReactNode}){
 const [entrada,setEntrada]=useState<EntradaComo|null>(null),[abierto,setAbierto]=useState(false);
 const abrir=useCallback((e:EntradaComo)=>{setEntrada(e);setAbierto(true);},[]);
 const valor=useMemo(()=>abrir,[abrir]);
 return <Ctx.Provider value={valor}>{children}
  <Drawer open={abierto} onClose={()=>setAbierto(false)} title={entrada?'Cómo se calculó: '+entrada.titulo:'Cómo se calculó'} subtitle={entrada&&<KindBadge kind={entrada.clase}/>} width={440}>
   {entrada&&<div className="cc-body">
    <section><h3>Cómo se calcula</h3><p>{entrada.formula}</p></section>
    <section><h3>De dónde sale</h3><p>{entrada.fuente}{entrada.periodo?' · '+entrada.periodo:''}</p></section>
    {entrada.cobertura&&<section><h3>Cobertura</h3><p>{entrada.cobertura}</p></section>}
    <section><h3>Qué no sabemos</h3><ul>{entrada.noSabemos.map((t,i)=><li key={i}>{t}</li>)}</ul></section>
   </div>}
  </Drawer></Ctx.Provider>;
}
export function ComoSeCalculoBoton({entrada}:{entrada:EntradaComo|null}){
 const abrir=useContext(Ctx);
 if(!entrada||!abrir)return null;
 return <button type="button" className="cc-btn" aria-label={'Cómo se calculó: '+entrada.titulo} onClick={()=>abrir(entrada)}><Icon name="info" size={14}/></button>;
}
