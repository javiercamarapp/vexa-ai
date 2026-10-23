'use client';
import Link from './navigation-lifecycle';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {Navigation,navigationQuery,workspaceTitle,workspaceIconName} from './navigation';
import {WorkspaceIcon} from './icon';
import {GlobalBar,type Theme} from './global-bar';
import {AccesoProvider} from './access';
import {fijarTenant,limpiarTodo} from '../../lib/workspace/swr.mjs';
type Organization={id:string;name:string};
const roleLabel:Record<string,string>={owner:'Administrador del espacio',analyst:'Analista',operator:'Operador',viewer:'Lectura'};
export function WorkspaceShell({children,brand,organizations,tenant,role,platformAccess=false}:{children:ReactNode;brand:ReactNode;organizations:Organization[];tenant:string;role:string;platformAccess?:boolean;today?:{iso:string;label:string}}){
 // La caché de lecturas se aísla por organización: fijarla antes de que los hijos lean (purga lo de otra organización).
 fijarTenant(tenant);
 const pathname=usePathname(),query=navigationQuery(pathname,useSearchParams().toString());
 const [collapsed,setCollapsed]=useState(false),[mobileOpen,setMobileOpen]=useState(false),[theme,setTheme]=useState<Theme>('light');const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{try{if(window.localStorage.getItem('vexa-sidebar-collapsed')==='true'){const frame=requestAnimationFrame(()=>setCollapsed(true));return()=>cancelAnimationFrame(frame);}}catch{/* Storage is optional. */}},[]);
 useEffect(()=>{try{const stored=window.localStorage.getItem('vexa-theme');if(stored==='light'||stored==='system'||stored==='dark'){const frame=requestAnimationFrame(()=>setTheme(stored));return()=>cancelAnimationFrame(frame);}}catch{/* Preferences are optional. */}},[]);
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=theme==='dark'||(theme==='system'&&media.matches)?'dark':'light';};apply();media.addEventListener('change',apply);return()=>{media.removeEventListener('change',apply);delete document.documentElement.dataset.theme;};},[theme]);
 function chooseTheme(value:Theme){setTheme(value);try{window.localStorage.setItem('vexa-theme',value);}catch{/* The choice still applies to this session. */}}
 const close=()=>dialog.current?.close();
 const open=()=>{setMobileOpen(true);requestAnimationFrame(()=>dialog.current?.showModal());};
 const organization=organizations.find(o=>o.id===tenant)?.name??'Organización';
 function toggle(){setCollapsed(value=>{const next=!value;try{window.localStorage.setItem('vexa-sidebar-collapsed',String(next));}catch{/* Storage is optional. */}return next;});}
 function sidebar(mobile=false){return <>
   <div className="sidebar-brand"><Link href="/overview" aria-label="Rovaq AI, resumen" className="sidebar-logo">{brand}</Link><button className="icon-button" type="button" aria-label={mobile?'Cerrar menú':collapsed?'Expandir menú':'Contraer menú'} aria-expanded={mobile?undefined:!collapsed} onClick={mobile?close:toggle}><WorkspaceIcon name={mobile?'close':collapsed?'expand':'collapse'}/></button></div>
   <div className="sidebar-navigation"><Navigation role={role} interno={platformAccess} collapsed={!mobile&&collapsed} onNavigate={mobile?close:undefined}/></div>
   <div className="sidebar-footer">
    {platformAccess&&<Link className="workspace-platform-link" href="/platform" aria-label="Administración de Rovaq AI" title="Administración de Rovaq AI"><WorkspaceIcon name="settings"/><span className="platform-link-label">Administración de Rovaq AI</span></Link>}
    <div className="sidebar-account"><span className="account-avatar" aria-hidden="true">{organization.slice(0,1).toUpperCase()}</span><div className="account-copy"><strong title={organization}>{organization}</strong><span>{roleLabel[role]??role}</span></div><form action="/auth/logout" method="post" onSubmit={()=>limpiarTodo()}><button className="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión"><WorkspaceIcon name="logout"/></button></form></div>
   </div>
  </>;}
 // «Pregúntale a tus datos» is a full-screen chat with its own sidebar (conversations + the way back): no workspace header, sidebar or bottom bar.
 if(pathname==='/preguntale')return <div className="workspace workspace-shell workspace-bare"><a className="skip-link workspace-skip" href="#workspace-contenido">Saltar al contenido</a><div className="workspace-content" id="workspace-contenido" tabIndex={-1}>{children}</div></div>;
 return <div className={'workspace workspace-shell'+(collapsed?' sidebar-collapsed':'')}>
   <a className="skip-link workspace-skip" href="#workspace-contenido">Saltar al contenido</a><aside className="workspace-sidebar">{sidebar()}</aside>
   <div className="workspace-frame"><div className="workspace-top"><header className="workspace-header"><button type="button" className="icon-button mobile-menu-button" aria-label="Abrir menú" onClick={open}><WorkspaceIcon name="menu"/></button><span className="workspace-heading"><WorkspaceIcon name={workspaceIconName(pathname)}/>{workspaceTitle(pathname)}</span></header><GlobalBar organizations={organizations} tenant={tenant} theme={theme} onTheme={chooseTheme}/></div><div className="workspace-content" id="workspace-contenido" tabIndex={-1}><AccesoProvider value={{role,interno:platformAccess}}>{children}</AccesoProvider></div></div>
   <dialog className="workspace-mobile-dialog" ref={dialog} onClose={()=>setMobileOpen(false)} aria-label="Navegación de Rovaq AI" onClick={event=>{if(event.target===event.currentTarget)close();}}>{mobileOpen&&<div className="mobile-sidebar">{sidebar(true)}</div>}</dialog>
   <nav className="workspace-bottom-nav" aria-label="Navegación móvil">{[['/overview','Resumen','overview'],['/problems','Problemas','problems'],['/preguntale','Pregúntale','preguntale'],['/explorer','Explorador','explorer'],['/briefs','Brief','briefs']].map(([href,label,icon])=><Link key={href} href={href+(query?'?'+query:'')} aria-current={pathname===href?'page':undefined}><WorkspaceIcon name={icon}/><span>{label}</span></Link>)}<button type="button" onClick={open} aria-label="Más opciones de navegación"><WorkspaceIcon name="menu"/><span>Más</span></button></nav>
 </div>;
}
