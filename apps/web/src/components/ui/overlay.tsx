'use client';
import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type MouseEvent,type PointerEvent as ReactPointerEvent,type ReactNode,type SyntheticEvent} from 'react';
import {Icon} from './icons';
import {RovaqLogo} from '../rovaq-logo';
/* Sistema único de overlays (Drawer lateral, Modal centrado, Popover anclado). Todo panel flotante del software se construye aquí;
   los estilos viven en components/ui/overlay.css. Misma anatomía: cabecera compacta (título + descripción + cerrar 28 px),
   cuerpo con scroll (padding 16) y pie fijo con acciones a la derecha (secundario + primario suave, 32 px). */

/** Anchos del Drawer: 420 (lectura / formularios cortos), 480 (formularios largos), 640 (tablas y evidencia). */
export const DRAWER_SIZES={sm:420,md:480,lg:640} as const;
/** Anchos del Modal: 440 (confirmaciones y formularios cortos) y 560 (formularios largos). */
export const MODAL_SIZES={sm:440,md:560} as const;
export type DrawerSize=keyof typeof DRAWER_SIZES;
export type ModalSize=keyof typeof MODAL_SIZES;
/** Compatibilidad: los llamadores que aún pasan un ancho en px caen en el tamaño estándar más cercano por arriba. */
const drawerPx=(size?:DrawerSize,width?:number)=>size?DRAWER_SIZES[size]:width===undefined?DRAWER_SIZES.sm:width<=DRAWER_SIZES.sm?DRAWER_SIZES.sm:width<=DRAWER_SIZES.md+80?DRAWER_SIZES.md:DRAWER_SIZES.lg;
const modalPx=(size?:ModalSize,width?:number)=>size?MODAL_SIZES[size]:width!==undefined&&width>MODAL_SIZES.sm?MODAL_SIZES.md:MODAL_SIZES.sm;

/** <dialog> nativo (capa superior): foco atrapado y Esc cierran sin código extra. Añadimos cierre por clic fuera, foco inicial y retorno de foco. */
function useDialog(open:boolean,onClose:()=>void){
 const ref=useRef<HTMLDialogElement>(null),from=useRef<Element|null>(null);
 useEffect(()=>{const d=ref.current;if(!d)return;
  if(open&&!d.open){from.current=document.activeElement;d.showModal();
   // Foco inicial: lo marcado como data-autofocus (p. ej. «Cancelar» en confirmaciones) o el primer campo del cuerpo; si no, el botón cerrar.
   const target=d.querySelector<HTMLElement>('[data-autofocus]')??d.querySelector<HTMLElement>('.overlay-body :is(input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea):not(:disabled)');
   target?.focus({preventScroll:true});}
  if(!open&&d.open){d.close();(from.current as HTMLElement|null)?.focus?.();}
 },[open]);
 return {ref,onCancel:(e:SyntheticEvent)=>{e.preventDefault();onClose();},onMouseDown:(e:MouseEvent<HTMLDialogElement>)=>{if(e.target===e.currentTarget)onClose();}};
}
function Head({id,title,subtitle,onClose}:{id:string;title:string;subtitle?:ReactNode;onClose:()=>void}){
 return <header className="overlay-head"><div className="overlay-titles"><h2 id={id}>{title}</h2>{subtitle&&<p className="overlay-sub">{subtitle}</p>}</div>
  <button type="button" className="icon-btn overlay-close" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={14}/></button></header>;
}
type DrawerProps={open:boolean;onClose:()=>void;title:string;subtitle?:ReactNode;children:ReactNode;footer?:ReactNode;
 /** sm 420 · md 480 · lg 640. */size?:DrawerSize;/** @deprecated usa `size`; se redondea al tamaño estándar más cercano. */width?:number;
 /** Lado de entrada. «bottom» es la hoja inferior del celular (grabber, X de 44 px, 90 dvh máx.); «left» queda para usos heredados. */side?:'right'|'left'|'bottom';/** id del <dialog> (para aria-controls del disparador). */id?:string;
 /** Sin cabecera ni pie propios (el contenido los trae); exige `label`. */bare?:boolean;label?:string;className?:string};
/** Agarradera de la hoja inferior: arrastrar hacia abajo (> 80 px) o tocar la cabecera con el dedo la cierra. Un solo nivel: la hoja no abre otra encima. */
function useArrastre(onClose:()=>void){
 const y0=useRef<number|null>(null),panel=useRef<HTMLElement|null>(null);
 return {
  onPointerDown:(e:ReactPointerEvent<HTMLElement>)=>{y0.current=e.clientY;panel.current=e.currentTarget.closest('.drawer-panel');e.currentTarget.setPointerCapture?.(e.pointerId);},
  onPointerMove:(e:ReactPointerEvent<HTMLElement>)=>{if(y0.current===null||!panel.current)return;const dy=Math.max(0,e.clientY-y0.current);panel.current.style.transform=dy?`translateY(${dy}px)`:'';panel.current.style.transition='none';},
  onPointerUp:(e:ReactPointerEvent<HTMLElement>)=>{if(y0.current===null)return;const dy=e.clientY-y0.current;y0.current=null;if(panel.current){panel.current.style.transition='';panel.current.style.transform='';}if(dy>80)onClose();},
  onPointerCancel:()=>{y0.current=null;if(panel.current){panel.current.style.transition='';panel.current.style.transform='';}},
 };
}
/** Panel lateral derecho (pantalla completa en móvil) o, con side=«bottom», hoja inferior. Si el contenido es corto el panel no se estira: el pie queda pegado al contenido. */
export function Drawer({open,onClose,title,subtitle,children,footer,size,width,side='right',bare=false,label,className,id:domId}:DrawerProps){
 const props=useDialog(open,onClose),id=useId(),px=drawerPx(size,width),arrastre=useArrastre(onClose);
 return <dialog {...props} id={domId} className={'drawer'+(className?' '+className:'')} data-side={side} data-bare={bare||undefined} aria-labelledby={bare?undefined:id} aria-label={bare?label:undefined} style={{'--drawer-w':px+'px'} as CSSProperties}>
  {open&&(bare?<div className="drawer-panel">{children}</div>:<div className="drawer-panel">{side==='bottom'&&<div className="sheet-grabber" {...arrastre} aria-hidden="true"><i/></div>}<Head id={id} title={title} subtitle={subtitle} onClose={onClose}/><div className="overlay-body">{children}</div>{footer&&<footer className="overlay-foot">{footer}</footer>}<div className="drawer-marca" aria-hidden="true"><RovaqLogo variante="horizontal" ancho={64} decorativo espacioLibre={false}/></div></div>)}
 </dialog>;
}
type ModalProps={open:boolean;onClose:()=>void;title:string;subtitle?:ReactNode;children:ReactNode;footer?:ReactNode;size?:ModalSize;/** @deprecated usa `size`. */width?:number;
 /** Confirmación que interrumpe: role=alertdialog y descripción enlazada. */alert?:boolean;className?:string;describedBy?:string};
/** Diálogo centrado (440 / 560). Con `alert` se anuncia como confirmación. */
export function Modal({open,onClose,title,subtitle,children,footer,size,width,alert=false,className,describedBy}:ModalProps){
 const props=useDialog(open,onClose),id=useId(),px=modalPx(size,width);
 return <dialog {...props} className={'modal'+(className?' '+className:'')} role={alert?'alertdialog':undefined} aria-labelledby={id} aria-describedby={describedBy} style={{'--modal-w':px+'px'} as CSSProperties}>
  {open&&<div className="modal-panel"><Head id={id} title={title} subtitle={subtitle} onClose={onClose}/><div className="overlay-body">{children}</div>{footer&&<footer className="overlay-foot">{footer}</footer>}</div>}
 </dialog>;
}
/** Sección de un formulario dentro de un overlay: título de 12 px y filete superior; agrupa campos relacionados sin zonas vacías. */
export function OverlaySection({title,children,description}:{title:string;children:ReactNode;description?:ReactNode}){
 const id=useId();
 return <section className="ov-section" aria-labelledby={id}><h3 id={id} className="ov-section-title">{title}</h3>{description&&<p className="ov-section-desc">{description}</p>}<div className="ov-section-body">{children}</div></section>;
}
/** Lista de acciones dentro de un Popover (exportar, menús): filas de 32 px, una acción por fila. */
export function MenuList({children,label}:{children:ReactNode;label?:string}){return <ul className="ov-menu" aria-label={label}>{children}</ul>;}
/** Panel anclado (no modal): se abre bajo su disparador, cierra con Esc / clic fuera, se mantiene dentro de la ventana y devuelve el foco. */
export function Popover({trigger,children,label,align='start',width=300,triggerClassName='btn btn-secondary'}:{triggerClassName?:string;trigger:ReactNode;children:ReactNode|((close:()=>void)=>ReactNode);label:string;align?:'start'|'end';width?:number}){
 const [open,setOpen]=useState(false),box=useRef<HTMLDivElement>(null),btn=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
 const close=useCallback(()=>setOpen(false),[]),was=useRef(false);
 useEffect(()=>{if(was.current&&!open)btn.current?.focus();was.current=open;},[open]);
 useEffect(()=>{if(!open)return;const down=(e:globalThis.MouseEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();close();}};document.addEventListener('mousedown',down);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',down);document.removeEventListener('keydown',key);};},[open,close]);
 useLayoutEffect(()=>{const p=panel.current;if(!open||!p)return;p.style.transform='';const r=p.getBoundingClientRect(),vw=document.documentElement.clientWidth;let dx=0;if(r.right>vw-12)dx=vw-12-r.right;if(r.left+dx<12)dx=12-r.left;if(dx)p.style.transform=`translateX(${dx}px)`;p.querySelector<HTMLElement>('input,select,textarea,button,a[href]')?.focus({preventScroll:true});},[open]);
 return <div className="popover" ref={box}><button ref={btn} type="button" className={triggerClassName} aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={()=>setOpen(o=>!o)}>{trigger}</button>
  {open&&<div ref={panel} id={id} role="dialog" aria-label={label} className="popover-panel" data-align={align} style={{width:`min(${width}px,calc(100vw - 32px))`}}>{typeof children==='function'?children(close):children}</div>}</div>;
}
