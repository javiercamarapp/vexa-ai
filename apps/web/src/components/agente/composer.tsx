'use client';
import {useEffect,useRef,type ChangeEvent,type FormEvent,type KeyboardEvent} from 'react';
import {ADJUNTO_ACCEPT} from './attachments';
import {Icon} from './icons';
import {useT} from '../i18n/proveedor';
/** Enter sends, Shift+Enter adds a line; while a turn runs, send becomes Stop. */
export function Composer({value,onChange,onSend,onStop,sending,disabled,placeholder,maxChars,inputId,onAttach,attachError}:{value:string;onChange:(v:string)=>void;onSend:()=>void;onStop:()=>void;sending:boolean;disabled:boolean;placeholder:string;maxChars:number;inputId:string;onAttach:(file:File)=>void;attachError:string|null}){
 const tx=useT();
 const ref=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const el=ref.current;if(!el)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,144)+'px';},[value]);
 const picker=useRef<HTMLInputElement>(null);
 const pick=(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];e.target.value='';if(f)onAttach(f);};
 const empty=value.trim().length===0;
 const submit=(e:FormEvent)=>{e.preventDefault();if(!sending&&!empty&&!disabled)onSend();};
 const key=(e:KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!sending&&!empty&&!disabled)onSend();}};
 return <form className="agente-composer" onSubmit={submit} aria-label={tx('ag.cForm')}>
  <label htmlFor={inputId} className="sr-only">{tx('ag.cPregunta')}</label>
  <textarea id={inputId} ref={ref} rows={1} value={value} maxLength={maxChars} disabled={disabled} onChange={e=>onChange(e.target.value)} onKeyDown={key} placeholder={placeholder}/>
  <div className="agente-composer-bar">
   <span className="agente-composer-start">
    <input ref={picker} type="file" accept={ADJUNTO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} data-testid="agente-adjunto-input"/>
    <button type="button" className="ctl ctl-icon agente-round agente-attach-btn" aria-label={tx('ag.cAdjuntar')} title={tx('ag.cAdjuntarTip')} disabled={disabled||sending} onClick={()=>picker.current?.click()}><Icon name="clip" size={16}/></button>
   </span>
   <span className="agente-composer-end">
    {value.length>=Math.floor(maxChars*0.8)&&<span className="agente-count" aria-live="polite">{value.length}/{maxChars}</span>}
    {sending?<button type="button" className="ctl ctl-icon ctl-pill ctl-solid agente-round agente-send" aria-label={tx('ag.cDetener')} onClick={onStop}><Icon name="stop" size={12}/></button>:<button type="submit" className="ctl ctl-icon ctl-pill ctl-solid agente-round agente-send" aria-label={tx('ag.cEnviar')} disabled={empty||disabled}><Icon name="send" size={16}/></button>}
   </span>
  </div>
  {attachError&&<p role="alert" className="agente-inline-error agente-attach-error">{attachError}</p>}
 </form>;
}
