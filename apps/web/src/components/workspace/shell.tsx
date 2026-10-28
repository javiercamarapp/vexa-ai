'use client';
import Link from './navigation-lifecycle';
import {useEffect,useState,type ReactNode} from 'react';
import {Drawer} from '../ui/overlay';
import {BarraInferior,Monograma,SelectorEmpresa,SelectorTema,useTeclado,type Theme} from './movil';
import {RovaqLogo} from '../rovaq-logo';
import {usePathname} from 'next/navigation';
import {Navigation,tituloTraducido,workspaceIconName} from './navigation';
import {useT} from '../i18n/proveedor';
import {SelectorIdioma} from '../i18n/selector-idioma';
import {WorkspaceIcon} from './icon';
import {NotificationNavigationLink} from '../notifications/navigation-link';
import {AccesoProvider} from './access';
import {RestaurarVista} from './restaurar-vista';
import {DatosNuevos} from './datos-nuevos';
import './encabezado.css';
import {esRutaCopiloto} from '../../lib/copiloto/modos.mjs';
import {fijarTenant,limpiarTodo} from '../../lib/workspace/swr.mjs';
import {OnboardingRaiz} from '../onboarding/contexto';
import {GuiaBoton,GuiaPaneles} from '../onboarding/guia';
import {almacenDelNavegador,limpiarEstadoOnboarding} from '../../lib/onboarding/estado';
import type {Pista} from '../../lib/onboarding/catalogo.mjs';
type Organization={id:string;name:string};
const ROLES=['owner','analyst','operator','viewer'] as const;
export function WorkspaceShell({children,brand,organizations,tenant,role,platformAccess=false,onboarding}:{children:ReactNode;brand:ReactNode;organizations:Organization[];tenant:string;role:string;platformAccess?:boolean;onboarding?:{pista:Pista|null;userId:string};today?:{iso:string;label:string}}){
 // La caché de lecturas se aísla por organización: fijarla antes de que los hijos lean (purga lo de otra organización).
 fijarTenant(tenant);
 const t=useT();
 const rol=(ROLES as readonly string[]).includes(role)?t(('shell.rol.'+role) as 'shell.rol.owner'):role;
 const pathname=usePathname();
 const [collapsed,setCollapsed]=useState(false),[mobileOpen,setMobileOpen]=useState(false),[theme,setTheme]=useState<Theme|null>(null);
 useTeclado();
 useEffect(()=>{try{if(window.localStorage.getItem('vexa-sidebar-collapsed')==='true'){const frame=requestAnimationFrame(()=>setCollapsed(true));return()=>cancelAnimationFrame(frame);}}catch{/* Storage is optional. */}},[]);
 // El tema ya lo pintó el script de <head> (app/layout.tsx) antes del primer render: aquí solo se lee la preferencia para marcar el selector y reaccionar a cambios.
 useEffect(()=>{let stored:Theme='light';try{const v=window.localStorage.getItem('vexa-theme');if(v==='light'||v==='system'||v==='dark')stored=v;}catch{/* Preferences are optional. */}const frame=requestAnimationFrame(()=>setTheme(stored));return()=>cancelAnimationFrame(frame);},[]);
 useEffect(()=>{if(theme===null)return;const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{const dark=theme==='dark'||(theme==='system'&&media.matches);document.documentElement.dataset.theme=dark?'dark':'light';document.querySelectorAll('meta[name=theme-color]').forEach(m=>m.setAttribute('content',dark?'#0e0e10':'#ffffff'));};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[theme]);
 function chooseTheme(value:Theme){setTheme(value);try{window.localStorage.setItem('vexa-theme',value);}catch{/* The choice still applies to this session. */}}
 const close=()=>setMobileOpen(false);
 const open=()=>setMobileOpen(true);
 const organization=organizations.find(o=>o.id===tenant)?.name??t('shell.organizacion');
 function toggle(){setCollapsed(value=>{const next=!value;try{window.localStorage.setItem('vexa-sidebar-collapsed',String(next));}catch{/* Storage is optional. */}return next;});}
 function sidebar(mobile=false){return <>
   {!mobile&&<div className="sidebar-brand"><Link href="/overview" aria-label={t('shell.logoResumen')} className="sidebar-logo">{brand}</Link><button className="icon-button" type="button" aria-label={collapsed?t('shell.expandir'):t('shell.contraer')} aria-expanded={!collapsed} onClick={toggle}><WorkspaceIcon name={collapsed?'expand':'collapse'}/></button></div>}
   <div className="sidebar-navigation"><Navigation role={role} interno={platformAccess} collapsed={!mobile&&collapsed} onNavigate={mobile?close:undefined}/></div>
   <div className="sidebar-footer">
    {!mobile&&(organizations.length>1?<form className="organization-switch" action="/auth/organization" method="post" onSubmit={()=>limpiarTodo()}><label className="nav-caption" htmlFor="workspace-org">{t('shell.organizacion')}</label><div className="organization-controls"><select id="workspace-org" name="tenant_id" defaultValue={tenant}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button type="submit" title={t('shell.cambiarOrg')} aria-label={t('shell.cambiarOrg')}>{t('shell.ir')} <span aria-hidden="true">↗</span></button></div></form>:<div className="workspace-context"><span className="nav-caption">{t('shell.espacioCliente')}</span><strong>{organization}</strong></div>)}
    <div className="sidebar-notifications"><NotificationNavigationLink/></div>
    {platformAccess&&<Link className="workspace-platform-link" href="/platform" aria-label={t('shell.admin')} title={mobile?undefined:t('shell.admin')} onClick={mobile?close:undefined}><WorkspaceIcon name="settings"/><span className="platform-link-label">{t('shell.admin')}</span></Link>}
    <SelectorTema valor={theme??'light'} onChange={chooseTheme} nombre={mobile?'mobile-theme':'workspace-theme'} etiquetas={mobile}/>
    <SelectorIdioma/>
    <div className="sidebar-account"><Monograma nombre={organization}/><div className="account-copy"><strong title={mobile?undefined:organization}>{organization}</strong><span>{rol}</span></div><form action="/auth/logout" method="post" onSubmit={()=>{limpiarTodo();limpiarEstadoOnboarding(almacenDelNavegador());}}><button className="icon-button logout-button" title={mobile?undefined:t('shell.cerrarSesion')} aria-label={t('shell.cerrarSesion')}><WorkspaceIcon name="logout"/><span className="logout-label">{t('shell.salir')}</span></button></form></div>
   </div>
  </>;}
 // «Pregúntale a tus datos» lives inside the normal shell (same sidebar) but has NO page header and no global scope bar: the content starts at the cover.
 const sinEncabezado=esRutaCopiloto(pathname);
 return <OnboardingRaiz datos={{pista:onboarding?.pista??null,userId:onboarding?.userId??'',tenantId:tenant,organizacion:organization,rolEtiqueta:rol,rol:role}}><div className={'workspace workspace-shell'+(collapsed?' sidebar-collapsed':'')+(sinEncabezado?' workspace-chat':'')}>
   <a className="skip-link workspace-skip" href="#workspace-contenido">{t('shell.saltar')}</a><aside className="workspace-sidebar">{sidebar()}</aside>
   <div className="workspace-frame"><header className={'workspace-header'+(sinEncabezado?' workspace-header-chat':'')}><Link href="/overview" className="header-logo" aria-label={t('shell.irInicio')}><RovaqLogo variante="horizontal" ancho={100} espacioLibre={false}/></Link><div className="header-empresa"><SelectorEmpresa organizations={organizations} tenant={tenant}/></div><div className="header-campana"><NotificationNavigationLink compact/></div><button type="button" className="icon-button mobile-menu-button" aria-label={t('shell.abrirMenu')} aria-haspopup="dialog" onClick={open}><WorkspaceIcon name="menu" size={20}/></button><span className="workspace-heading"><WorkspaceIcon name={workspaceIconName(pathname)}/>{tituloTraducido(pathname,t)}</span><DatosNuevos/><GuiaBoton/></header><div className="workspace-content" id="workspace-contenido" tabIndex={-1}><RestaurarVista/><AccesoProvider value={{role,interno:platformAccess}}>{children}</AccesoProvider></div></div>
   <Drawer side="bottom" className="hoja-mas" title={t('shell.mas')} subtitle={t('shell.masSub')} open={mobileOpen} onClose={close}><div className="mobile-sidebar">{sidebar(true)}</div></Drawer>
   <BarraInferior role={role}/>
   <GuiaPaneles/>
 </div></OnboardingRaiz>;
}
