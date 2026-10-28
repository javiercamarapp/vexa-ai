'use client';
import {createContext,useCallback,useContext,useMemo,useState,type ReactNode} from 'react';
import {useT} from '../i18n/proveedor';
import {Drawer} from '../ui/overlay';
import {Icon} from '../ui/icons';
import {ConMarca} from '../ui/brand-mark';
import {KindBadge} from '../ui/kind-badge';
import type {EntradaComo} from '../hoy/hoy-modelo.mjs';
import './confianza.css';
/** Panel «Cómo se calculó»: UNO por pantalla (el proveedor lo pinta una sola vez); cada cifra solo trae su botón ⓘ. */
const Ctx=createContext<((e:EntradaComo)=>void)|null>(null);
export function ComoSeCalculoProvider({children}:{children:ReactNode}){
 const tx=useT();
 const [entrada,setEntrada]=useState<EntradaComo|null>(null),[abierto,setAbierto]=useState(false);
 const abrir=useCallback((e:EntradaComo)=>{setEntrada(e);setAbierto(true);},[]);
 const valor=useMemo(()=>abrir,[abrir]);
 return <Ctx.Provider value={valor}>{children}
  <Drawer open={abierto} onClose={()=>setAbierto(false)} title={entrada?tx('conf.comoDe',{titulo:entrada.titulo}):tx('conf.comoTit')} subtitle={entrada&&<KindBadge kind={entrada.clase}/>} size="sm">
   {entrada&&<>
    <div className="ov-block"><h3 className="ov-block-title">{tx('conf.comoCalcula')}</h3><p className="ov-formula">{entrada.formula}</p></div>
    <dl className="ov-kv"><dt>{tx('conf.deDonde')}</dt><dd><ConMarca marca={entrada.fuente}>{entrada.fuente}</ConMarca></dd>{entrada.periodo&&<><dt>{tx('conf.periodo')}</dt><dd>{entrada.periodo}</dd></>}{entrada.cobertura&&<><dt>{tx('conf.cobertura')}</dt><dd>{entrada.cobertura}</dd></>}</dl>
    <div className="ov-block"><h3 className="ov-block-title">{tx('conf.cNoSab')}</h3><ul className="cc-no-sabemos">{entrada.noSabemos.map((t,i)=><li key={i}>{t}</li>)}</ul></div>
    <p className="ov-seal">{tx('conf.claseDato')} <KindBadge kind={entrada.clase}/></p>
   </>}
  </Drawer></Ctx.Provider>;
}
export function ComoSeCalculoBoton({entrada}:{entrada:EntradaComo|null}){
 const tx=useT();
 const abrir=useContext(Ctx);
 if(!entrada||!abrir)return null;
 return <button type="button" className="dc-info" aria-label={tx('conf.comoDe',{titulo:entrada.titulo})} onClick={()=>abrir(entrada)}><Icon name="info" size={14}/></button>;
}
