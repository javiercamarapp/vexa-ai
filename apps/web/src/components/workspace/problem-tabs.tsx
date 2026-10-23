'use client';
import Link from './navigation-lifecycle';
import {usePathname,useSearchParams} from 'next/navigation';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
/** «Gestionar problemas» ya no es un destino aparte del menú: es la segunda vista de Problemas (la ruta /problems/manage sigue funcionando). */
const VISTAS=[['/problems','Prioridades','Lo que más pesa, con su evidencia'],['/problems/manage','Gestionar','Estado, responsable y seguimiento']] as const;
export function ProblemTabs(){
 const pathname=usePathname(),query=consultaAlcance(useSearchParams().toString());
 return <nav className="tabs" aria-label="Vistas de problemas">{VISTAS.map(([href,label,hint])=><Link key={href} className="tab-link" href={href+(query?'?'+query:'')} title={hint} aria-current={pathname===href?'page':undefined}>{label}</Link>)}</nav>;
}
