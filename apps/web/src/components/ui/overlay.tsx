'use client';
import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type MouseEvent,type ReactNode,type SyntheticEvent} from 'react';
import {Icon} from './icons';
/** Native <dialog> (top layer): focus is trapped and Esc closes without extra code. We add backdrop-click close and focus restore. */
function useDialog(open:boolean,onClose:()=>void){
 const ref=useRef<HTMLDialogElement>(null),from=useRef<Element|null>(null);
 useEffect(()=>{const d=ref.current;if(!d)return;
  if(open&&!d.open){from.current=document.activeElement;d.showModal();}
  if(!open&&d.open){d.close();(from.current as HTMLElement|null)?.focus?.();}
 },[open]);
 return {ref,onCancel:(e:SyntheticEvent)=>{e.preventDefault();onClose();},onMouseDown:(e:MouseEvent<HTMLDialogElement>)=>{if(e.target===e.currentTarget)onClose();}};
}
export function Drawer({open,onClose,title,subtitle,children,footer,width=480}:{open:boolean;onClose:()=>void;title:string;subtitle?:ReactNode;children:ReactNode;footer?:ReactNode;width?:number}){
 const props=useDialog(open,onClose),id=useId();
 return <dialog {...props} className="drawer" aria-labelledby={id} style={{'--drawer-w':width+'px'} as CSSProperties}>
  {open&&<div className="drawer-panel"><header className="overlay-head"><div><h2 id={id}>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={16}/></button></header><div className="overlay-body">{children}</div>{footer&&<footer className="overlay-foot">{footer}</footer>}</div>}
 </dialog>;
}
export function Modal({open,onClose,title,children,footer,width=440}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;footer?:ReactNode;width?:number}){
 const props=useDialog(open,onClose),id=useId();
 return <dialog {...props} className="modal" aria-labelledby={id} style={{'--modal-w':width+'px'} as CSSProperties}>
  {open&&<div className="modal-panel"><header className="overlay-head"><h2 id={id}>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={16}/></button></header><div className="overlay-body">{children}</div>{footer&&<footer className="overlay-foot">{footer}</footer>}</div>}
 </dialog>;
}
/** Anchored panel (non-modal): opens under its trigger, closes on Esc / outside click, stays inside the viewport, restores focus. */
export function Popover({trigger,children,label,align='start',width=300,triggerClassName='btn btn-secondary'}:{triggerClassName?:string;trigger:ReactNode;children:ReactNode|((close:()=>void)=>ReactNode);label:string;align?:'start'|'end';width?:number}){
 const [open,setOpen]=useState(false),box=useRef<HTMLDivElement>(null),btn=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
 const close=useCallback(()=>setOpen(false),[]),was=useRef(false);
 useEffect(()=>{if(was.current&&!open)btn.current?.focus();was.current=open;},[open]);
 useEffect(()=>{if(!open)return;const down=(e:globalThis.MouseEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();close();}};document.addEventListener('mousedown',down);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',down);document.removeEventListener('keydown',key);};},[open,close]);
 useLayoutEffect(()=>{const p=panel.current;if(!open||!p)return;p.style.transform='';const r=p.getBoundingClientRect(),vw=document.documentElement.clientWidth;let dx=0;if(r.right>vw-12)dx=vw-12-r.right;if(r.left+dx<12)dx=12-r.left;if(dx)p.style.transform=`translateX(${dx}px)`;p.querySelector<HTMLElement>('input,select,textarea,button,a[href]')?.focus({preventScroll:true});},[open]);
 return <div className="popover" ref={box}><button ref={btn} type="button" className={triggerClassName} aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={()=>setOpen(o=>!o)}>{trigger}</button>
  {open&&<div ref={panel} id={id} role="dialog" aria-label={label} className="popover-panel" data-align={align} style={{width:`min(${width}px,calc(100vw - 32px))`}}>{typeof children==='function'?children(close):children}</div>}</div>;
}
