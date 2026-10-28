'use client';
import Link from './navigation-lifecycle';
import {usePathname,useSearchParams} from 'next/navigation';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
import {useT} from '../i18n/proveedor';
/** «Gestionar problemas» ya no es un destino aparte del menú: es la segunda vista de Problemas (la ruta /problems/manage sigue funcionando). */
const VISTAS=[['/problems','prob.tabPrioridades','prob.tabPrioridadesHint'],['/problems/manage','prob.tabGestionar','prob.tabGestionarHint']] as const;
export function ProblemTabs(){
 const t=useT(),pathname=usePathname(),query=consultaAlcance(useSearchParams().toString());
 return <nav className="tabs" aria-label={t('prob.tabsLabel')}>{VISTAS.map(([href,label,hint])=><Link key={href} className="tab-link" href={href+(query?'?'+query:'')} title={t(hint)} aria-current={pathname===href?'page':undefined}>{t(label)}</Link>)}</nav>;
}
