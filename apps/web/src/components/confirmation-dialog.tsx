'use client';
import {useId,useRef,useState,type RefObject} from 'react';
import {Modal} from './ui/overlay';
type Props={triggerLabel:string;title:string;description:string;confirmLabel:string;disabled?:boolean;tone?:'danger';returnFocusRef?:RefObject<HTMLElement|null>;onConfirm:()=>void|Promise<void>};
/** Confirmación sobre el Modal del sistema (foco contenido, Esc cierra, foco inicial en «Cancelar»); solo la acción explícita invoca la operación capturada. */
export function ConfirmationDialog({triggerLabel,title,description,confirmLabel,disabled=false,tone,returnFocusRef,onConfirm}:Props){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),action=useRef<Props['onConfirm']|null>(null),pending=useRef(false);const [working,setWorking]=useState(false),[isOpen,setIsOpen]=useState(false);
 function open(){if(disabled||pending.current)return;action.current=onConfirm;setIsOpen(true);}
 function close(){action.current=null;setIsOpen(false);}
 async function confirm(){if(disabled||pending.current||!action.current)return;const operation=action.current,source=trigger.current,fallback=returnFocusRef?.current;pending.current=true;setWorking(true);close();try{await operation();}finally{pending.current=false;setWorking(false);requestAnimationFrame(()=>{
   // The operation can remove this component. Retain connected DOM targets,
   // but never move focus after the user has already chosen another control.
   if(document.activeElement!==document.body)return;
   const target=source?.isConnected&&!source.disabled?source:fallback;
   if(target?.isConnected)target.focus();
  });}}
 return <><button type="button" ref={trigger} className={tone==='danger'?'btn btn-sm btn-danger-soft':undefined} disabled={disabled||working} onClick={open}>{triggerLabel}</button>
  <Modal alert open={isOpen} onClose={close} title={title} describedBy={id+'-description'} className="confirmation-dialog"
   footer={<><button type="button" className="btn btn-secondary confirmation-cancel" data-autofocus onClick={close}>Cancelar</button><button type="button" className="btn btn-primary confirmation-confirm" disabled={disabled||working} onClick={()=>void confirm()}>{confirmLabel}</button></>}>
   <p id={id+'-description'} className="confirmation-text">{description}</p>
  </Modal></>;
}
