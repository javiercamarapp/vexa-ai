'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {Navigation,navigationQuery,workspaceTitle,workspaceIconName} from './navigation';
import {WorkspaceIcon} from './icon';
import {NotificationNavigationLink} from '../notifications/navigation-link';
type Organization={id:string;name:string};
type Theme='light'|'system'|'dark';
const roleLabel:Record<string,string>={owner:'Administrador del espacio',analyst:'Analista',operator:'Operador',viewer:'Lectura'};
export function WorkspaceShell({children,brand,organizations,tenant,role,today,platformAccess=false}:{children:ReactNode;brand:ReactNode;organizations:Organization[];tenant:string;role:string;platformAccess?:boolean;today:{iso:string;label:string}}){
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
   <div className="sidebar-brand"><Link href="/overview" aria-label="VEXA AI, resumen" className="sidebar-logo">{brand}</Link><button className="icon-button" type="button" aria-label={mobile?'Cerrar menú':collapsed?'Expandir menú':'Contraer menú'} aria-expanded={mobile?undefined:!collapsed} onClick={mobile?close:toggle}><WorkspaceIcon name={mobile?'close':collapsed?'expand':'collapse'}/></button></div>
   <div className="sidebar-navigation"><Navigation collapsed={!mobile&&collapsed} onNavigate={mobile?close:undefined}/></div>
   <div className="sidebar-footer">
    {organizations.length>1?<form className="organization-switch" action="/auth/organization" method="post"><label className="nav-caption" htmlFor={mobile?'mobile-workspace-org':'workspace-org'}>Organización</label><div className="organization-controls"><select id={mobile?'mobile-workspace-org':'workspace-org'} name="tenant_id" defaultValue={tenant}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button type="submit" title="Cambiar organización" aria-label="Cambiar organización">Ir <span aria-hidden="true">↗</span></button></div></form>:<div className="workspace-context"><span className="nav-caption">Espacio de cliente</span><strong>{organization}</strong></div>}
    {platformAccess&&<Link className="workspace-platform-link" href="/platform" aria-label="Administración de VEXA" title="Administración de VEXA"><WorkspaceIcon name="settings"/><span className="platform-link-label">Administración de VEXA</span></Link>}
    <fieldset className="theme-selector"><legend className="sr-only">Tema de la interfaz</legend>{([['light','Claro','☀'],['system','Sistema','▣'],['dark','Oscuro','☾']] as const).map(([value,label,icon])=><label key={value} title={'Tema '+label.toLowerCase()}><input type="radio" className="sr-only" name={mobile?'mobile-theme':'workspace-theme'} value={value} checked={theme===value} onChange={()=>chooseTheme(value)}/><span aria-hidden="true">{icon}</span><span className="sr-only">{label}</span></label>)}</fieldset>
    <div className="sidebar-account"><span className="account-avatar" aria-hidden="true">{organization.slice(0,1).toUpperCase()}</span><div className="account-copy"><strong title={organization}>{organization}</strong><span>{roleLabel[role]??role}</span></div><form action="/auth/logout" method="post"><button className="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión"><WorkspaceIcon name="logout"/></button></form></div>
   </div>
  </>;}
 return <div className={'workspace workspace-shell'+(collapsed?' sidebar-collapsed':'')}>
   <a className="skip-link workspace-skip" href="#workspace-contenido">Saltar al contenido</a><aside className="workspace-sidebar">{sidebar()}</aside>
   <div className="workspace-frame"><header className="workspace-header"><button type="button" className="icon-button mobile-menu-button" aria-label="Abrir menú" onClick={open}><WorkspaceIcon name="menu"/></button><span className="workspace-heading"><WorkspaceIcon name={workspaceIconName(pathname)}/>{workspaceTitle(pathname)}</span><div className="workspace-header-actions"><NotificationNavigationLink compact/><time className="workspace-date" dateTime={today.iso} title="Fecha en UTC"><WorkspaceIcon name="calendar"/>{today.label}</time></div></header><div className="workspace-content" id="workspace-contenido" tabIndex={-1}>{children}</div></div>
   <dialog className="workspace-mobile-dialog" ref={dialog} onClose={()=>setMobileOpen(false)} aria-label="Navegación de VEXA" onClick={event=>{if(event.target===event.currentTarget)close();}}>{mobileOpen&&<div className="mobile-sidebar">{sidebar(true)}</div>}</dialog>
   <nav className="workspace-bottom-nav" aria-label="Navegación móvil">{[['/overview','Resumen','overview'],['/problems','Problemas','problems'],['/explorer','Explorador','explorer'],['/briefs','Brief','briefs']].map(([href,label,icon])=><Link key={href} href={href+(query?'?'+query:'')} aria-current={pathname===href?'page':undefined}><WorkspaceIcon name={icon}/><span>{label}</span></Link>)}<button type="button" onClick={open} aria-label="Más opciones de navegación"><WorkspaceIcon name="menu"/><span>Más</span></button></nav>
 </div>;
}
