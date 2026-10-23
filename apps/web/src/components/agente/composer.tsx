'use client';
import {useEffect,useRef,type ChangeEvent,type FormEvent,type KeyboardEvent} from 'react';
import {ADJUNTO_ACCEPT} from './attachments';
import {Button} from '../ui/button';
import {Icon} from './icons';
/** Enter sends, Shift+Enter adds a line; while a turn runs, send becomes Stop. «Consulta» opens the category cards (like Atiende). */
export function Composer({value,onChange,onSend,onStop,onConsult,sending,disabled,placeholder,maxChars,categoriesId,categoriesOpen,inputId,onAttach,attachError}:{value:string;onChange:(v:string)=>void;onSend:()=>void;onStop:()=>void;onConsult:()=>void;sending:boolean;disabled:boolean;placeholder:string;maxChars:number;categoriesId:string;categoriesOpen:boolean;inputId:string;onAttach:(file:File)=>void;attachError:string|null}){
 const ref=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const el=ref.current;if(!el)return;el.style.height='auto';el.style.height=Math.min(el.scrollHeight,144)+'px';},[value]);
 const picker=useRef<HTMLInputElement>(null);
 const pick=(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];e.target.value='';if(f)onAttach(f);};
 const empty=value.trim().length===0;
 const submit=(e:FormEvent)=>{e.preventDefault();if(!sending&&!empty&&!disabled)onSend();};
 const key=(e:KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!sending&&!empty&&!disabled)onSend();}};
 return <form className="agente-composer" onSubmit={submit} aria-label="Preguntar a tus datos">
  <label htmlFor={inputId} className="sr-only">Tu pregunta</label>
  <textarea id={inputId} ref={ref} rows={1} value={value} maxLength={maxChars} disabled={disabled} onChange={e=>onChange(e.target.value)} onKeyDown={key} placeholder={placeholder}/>
  <div className="agente-composer-bar">
   <span className="agente-composer-start">
    <input ref={picker} type="file" accept={ADJUNTO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} data-testid="agente-adjunto-input"/>
    <Button size="sm" className="agente-attach-btn" icon={<Icon name="clip"/>} aria-label="Adjuntar archivo para analizar en este navegador" title="Adjuntar CSV, TXT o JSON (hasta 1 MB). Se analiza solo en tu navegador: no se envía ni se guarda." disabled={disabled} onClick={()=>picker.current?.click()}>Adjuntar</Button>
    <Button size="sm" aria-expanded={categoriesOpen} aria-controls={categoriesId} disabled={sending||disabled} icon={<Icon name="search"/>} onClick={onConsult}>Consulta</Button>
   </span>
   <span className="agente-composer-end">
    {value.length>=Math.floor(maxChars*0.8)&&<span className="agente-count" aria-live="polite">{value.length}/{maxChars}</span>}
    {sending?<Button variant="primary" size="sm" icon={<Icon name="stop"/>} onClick={onStop}>Detener</Button>:<Button type="submit" variant="primary" size="sm" disabled={empty||disabled} icon={<Icon name="send"/>}>Enviar</Button>}
   </span>
  </div>
  {attachError&&<p role="alert" className="agente-inline-error agente-attach-error">{attachError}</p>}
 </form>;
}
