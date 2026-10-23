'use client';
import {createContext,useContext,type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {LinkButton,Arrow} from '../ui/button';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
/** Lo que el shell sabe de quien mira: solo sirve para decidir qué ofrecerle. La autorización real sigue en el servidor. */
type Acceso={role:string;interno:boolean};
const AccesoContext=createContext<Acceso>({role:'viewer',interno:false});
export const AccesoProvider=({value,children}:{value:Acceso;children:ReactNode})=><AccesoContext.Provider value={value}>{children}</AccesoContext.Provider>;
export const useAcceso=()=>useContext(AccesoContext);
/** Pantallas de aseguramiento de calidad interno: a un cliente que llega por URL se le explica y se le devuelve al Resumen, en vez de enseñarle herramientas vacías con jerga. */
export function SoloInterno({children}:{children:ReactNode}){
 const {interno}=useAcceso(),query=consultaAlcance(useSearchParams().toString());
 if(interno)return <>{children}</>;
 return <section className="task-page stack" aria-label="Sección de uso interno"><h1>Esta sección es de uso interno</h1><article className="task-card stack"><p>Aquí el equipo de Rovaq AI revisa la calidad de los datos y de los modelos. No hay nada que tengas que hacer en esta pantalla.</p><div className="btn-group"><LinkButton href={'/overview'+(query?'?'+query:'')} variant="primary" size="sm" icon={<Arrow/>}>Ir a Hoy</LinkButton></div></article></section>;
}
