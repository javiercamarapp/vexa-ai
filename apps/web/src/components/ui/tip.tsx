'use client';
import type {KeyboardEvent,ReactNode} from 'react';
import {useId,useRef,useState} from 'react';
import {useHydrated} from './browser-state';
import {createPortal} from 'react-dom';
import {useTipPosicion} from './use-tip-posicion';
/** Tooltip corto: se muestra con hover y con foco de teclado (Esc lo cierra), enlazado por aria-describedby. Para algo largo usa un Popover.
 *  La burbuja vive en <body> (position:fixed) para que ni una tabla con scroll ni un overflow:hidden la recorten; se coloca sobre el objetivo
 *  (o debajo si arriba no cabe), acotada al viewport con 8 px de margen; ancho 160–280 px por contenido. Antes de montar se pinta en línea (oculta) para que el SSR conserve el aria-describedby. */
export function Tip({label,children,align='center'}:{label:string;children:ReactNode;align?:'start'|'center'|'end'}){
 const id=useId(),[abierto,setAbierto]=useState(false),montado=useHydrated(),bubble=useRef<HTMLSpanElement>(null),target=useRef<HTMLSpanElement>(null);
 useTipPosicion(bubble,abierto,()=>{const r=target.current?.getBoundingClientRect();return r?{ax:r.left+r.width/2,ay:r.top+r.height/2,modo:'arriba',sep:r.height/2+8}:null;});
 const burbuja=<span role="tooltip" id={id} ref={bubble} className="tip-bubble" data-abierto={abierto||undefined}>{label}</span>;
 return <span className="tip" data-align={align} onPointerEnter={()=>setAbierto(true)} onPointerLeave={()=>setAbierto(false)} onFocus={()=>setAbierto(true)} onBlur={()=>setAbierto(false)} onKeyDown={(e:KeyboardEvent)=>{if(e.key==='Escape')setAbierto(false);}}><span className="tip-target" ref={target} tabIndex={0} aria-describedby={id}>{children}</span>{montado?createPortal(burbuja,document.body):burbuja}</span>;
}
