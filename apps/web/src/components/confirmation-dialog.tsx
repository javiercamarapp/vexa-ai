'use client';
import {useId,useRef,useState} from 'react';
type Props={triggerLabel:string;title:string;description:string;confirmLabel:string;disabled?:boolean;onConfirm:()=>void|Promise<void>};
/** Native modal keeps keyboard focus contained; only the explicit confirm action invokes the captured operation. */
export function ConfirmationDialog({triggerLabel,title,description,confirmLabel,disabled=false,onConfirm}:Props){
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLButtonElement>(null),action=useRef<Props['onConfirm']|null>(null),pending=useRef(false);const [working,setWorking]=useState(false);
 function open(){if(disabled||pending.current)return;action.current=onConfirm;dialog.current?.showModal();cancel.current?.focus();}
 function close(){action.current=null;dialog.current?.close();}
 async function confirm(){if(disabled||pending.current||!action.current)return;const operation=action.current;pending.current=true;setWorking(true);close();try{await operation();}finally{pending.current=false;setWorking(false);}}
 return <><button type="button" ref={trigger} disabled={disabled||working} onClick={open}>{triggerLabel}</button><dialog className="confirmation-dialog" ref={dialog} aria-labelledby={id+'-title'} aria-describedby={id+'-description'} onCancel={()=>{action.current=null;}} onClose={()=>{action.current=null;trigger.current?.focus();}} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();}}}>
   <div className="confirmation-heading"><span className="confirmation-mark" aria-hidden="true">?</span><h2 id={id+'-title'}>{title}</h2></div><p id={id+'-description'}>{description}</p><div className="confirmation-actions"><button type="button" className="confirmation-cancel" ref={cancel} onClick={close}>Cancelar</button><button type="button" disabled={disabled||working} onClick={()=>void confirm()}>{confirmLabel}</button></div>
  </dialog></>;
}
