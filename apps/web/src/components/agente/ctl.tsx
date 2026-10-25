'use client';
import Link from '../workspace/navigation-lifecycle';
import type {AnchorHTMLAttributes,ButtonHTMLAttributes,ReactNode} from 'react';
/** Controles compactos y unificados (una-pagina.css): 32 px en escritorio / 36 px en celular, zona táctil de 44 px por área invisible, radio 8,
 *  13 px/600, borde de 1 px y ≥ 8 px entre vecinos. `soft` = primario suave del sistema (--btn-soft-*), `ghost` = terciario, `pill` = el botón de enviar. */
export type CtlVariant='default'|'soft'|'ghost'|'solid';
const cls=(v:CtlVariant,extra?:string)=>['ctl',v==='default'?'':'ctl-'+v,extra??''].filter(Boolean).join(' ');
export function Ctl({variant='default',icon,solo,children,className,type='button',...rest}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:CtlVariant;icon?:ReactNode;/** En celular se ve solo el icono (el texto sigue siendo el nombre accesible). */solo?:boolean}){
 return <button {...(solo&&typeof children==='string'?{'aria-label':children}:{})} {...rest} type={type} className={cls(variant,(solo?'ctl-solo ':'')+(className??''))}>{icon}<span className="ctl-label">{children}</span></button>;
}
export function CtlLink({href,variant='default',icon,solo,children,className,download,...rest}:{href:string;variant?:CtlVariant;icon?:ReactNode;solo?:boolean;children:ReactNode;className?:string;download?:string}&Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'|'className'|'download'>){
 const c=cls(variant,(solo?'ctl-solo ':'')+(className??''));
 if(download!==undefined)return <a {...(solo&&typeof children==='string'?{'aria-label':children}:{})} {...rest} href={href} download={download} className={c}>{icon}<span className="ctl-label">{children}</span></a>;
 return <Link {...(solo&&typeof children==='string'?{'aria-label':children}:{})} {...rest} href={href} className={c}>{icon}<span className="ctl-label">{children}</span></Link>;
}
