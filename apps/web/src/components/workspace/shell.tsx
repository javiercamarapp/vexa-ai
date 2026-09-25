'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {Navigation,navigationQuery,workspaceTitle} from './navigation';
import {WorkspaceIcon} from './icon';
import {NotificationNavigationLink} from '../notifications/navigation-link';
type Organization={id:string;name:string};
export function WorkspaceShell({children,brand,organizations,tenant,role,today}:{children:ReactNode;brand:ReactNode;organizations:Organization[];tenant:string;role:string;today:{iso:string;label:string}}){
 const pathname=usePathname(),query=navigationQuery(pathname,useSearchParams().toString());
 const [collapsed,setCollapsed]=useState(false),[mobileOpen,setMobileOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{try{if(window.localStorage.getItem('vexa-sidebar-collapsed')==='true'){const frame=requestAnimationFrame(()=>setCollapsed(true));return()=>cancelAnimationFrame(frame);}}catch{/* Storage is optional. */}},[]);
 const close=()=>dialog.current?.close();
 const open=()=>{setMobileOpen(true);requestAnimationFrame(()=>dialog.current?.showModal());};
 const organization=organizations.find(o=>o.id===tenant)?.name??'Organización';
 function toggle(){setCollapsed(value=>{const next=!value;try{window.localStorage.setItem('vexa-sidebar-collapsed',String(next));}catch{/* Storage is optional. */}return next;});}
 function sidebar(mobile=false){return <>
   <div className="sidebar-brand"><Link href="/overview" aria-label="VEXA AI, resumen" className="sidebar-logo">{brand}</Link><button className="icon-button" type="button" aria-label={mobile?'Cerrar menú':collapsed?'Expandir menú':'Contraer menú'} aria-expanded={mobile?undefined:!collapsed} onClick={mobile?close:toggle}><WorkspaceIcon name={mobile?'close':collapsed?'expand':'collapse'}/></button></div>
   <form className="organization-switch" action="/auth/organization" method="post"><label className="nav-caption" htmlFor={mobile?'mobile-workspace-org':'workspace-org'}>Organización activa</label><select id={mobile?'mobile-workspace-org':'workspace-org'} name="tenant_id" defaultValue={tenant}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button type="submit">Cambiar organización</button></form>
   <div className="sidebar-navigation"><Navigation collapsed={!mobile&&collapsed} onNavigate={mobile?close:undefined}/></div>
   <div className="sidebar-account"><span className="account-avatar" aria-hidden="true">{organization.slice(0,1).toUpperCase()}</span><div className="account-copy"><strong title={organization}>{organization}</strong><span>Rol: {role}</span></div><form action="/auth/logout" method="post"><button className="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión"><WorkspaceIcon name="logout"/></button></form></div>
  </>;}
 return <div className={'workspace workspace-shell'+(collapsed?' sidebar-collapsed':'')}>
   <a className="skip-link workspace-skip" href="#workspace-contenido">Saltar al contenido</a><aside className="workspace-sidebar">{sidebar()}</aside>
   <div className="workspace-frame"><header className="workspace-header"><button type="button" className="icon-button mobile-menu-button" aria-label="Abrir menú" onClick={open}><WorkspaceIcon name="menu"/></button><span className="workspace-heading">{workspaceTitle(pathname)}</span><div className="workspace-header-actions"><NotificationNavigationLink compact/><time className="workspace-date" dateTime={today.iso} title="Fecha en UTC">{today.label}</time></div></header><div className="workspace-content" id="workspace-contenido" tabIndex={-1}>{children}</div></div>
   <dialog className="workspace-mobile-dialog" ref={dialog} onClose={()=>setMobileOpen(false)} aria-label="Navegación de VEXA" onClick={event=>{if(event.target===event.currentTarget)close();}}>{mobileOpen&&<div className="mobile-sidebar">{sidebar(true)}</div>}</dialog>
   <nav className="workspace-bottom-nav" aria-label="Navegación móvil">{[['/overview','Resumen','overview'],['/problems','Problemas','problems'],['/explorer','Explorador','explorer'],['/briefs','Brief','briefs']].map(([href,label,icon])=><Link key={href} href={href+(query?'?'+query:'')} aria-current={pathname===href?'page':undefined}><WorkspaceIcon name={icon}/><span>{label}</span></Link>)}<button type="button" onClick={open} aria-label="Más opciones de navegación"><WorkspaceIcon name="menu"/><span>Más</span></button></nav>
 </div>;
}
