'use client';
import {createContext,useContext,type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {LinkButton,Arrow} from '../ui/button';
import {PageHeader} from '../ui/page-header';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
import {useT} from '../i18n/proveedor';
/** Lo que el shell sabe de quien mira: solo sirve para decidir qué ofrecerle. La autorización real sigue en el servidor. */
type Acceso={role:string;interno:boolean};
const AccesoContext=createContext<Acceso>({role:'viewer',interno:false});
export const AccesoProvider=({value,children}:{value:Acceso;children:ReactNode})=><AccesoContext.Provider value={value}>{children}</AccesoContext.Provider>;
export const useAcceso=()=>useContext(AccesoContext);
/** Pantallas de aseguramiento de calidad interno: a un cliente que llega por URL se le explica y se le devuelve al Resumen, en vez de enseñarle herramientas vacías con jerga. */
export function SoloInterno({children}:{children:ReactNode}){
 const tx=useT(),{interno}=useAcceso(),query=consultaAlcance(useSearchParams().toString());
 if(interno)return <>{children}</>;
 return <section className="task-page stack" aria-label={tx('tr.ws.acAria')}><PageHeader eyebrow={tx('nav.grupo.interno')} title={tx('tr.ws.acTitulo')} description={tx('tr.ws.acDesc')} actions={<LinkButton href={'/overview'+(query?'?'+query:'')} variant="primary" icon={<Arrow/>}>{tx('det.irAHoy')}</LinkButton>}/></section>;
}
