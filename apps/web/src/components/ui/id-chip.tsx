'use client';
import {useState} from 'react';
/** Long identifiers (snapshot, scope hash, revision) never spill: shortened in place, full value in title and copyable. */
export function IdChip({value,label,head=8,tail=4,text:shown}:{value:string;label?:string;head?:number;tail?:number;text?:string}){
 const [copied,setCopied]=useState(false);
 const text=shown??(value.length>head+tail+1?value.slice(0,head)+'…'+value.slice(-tail):value);
 return <button type="button" className="id-chip" title={value} aria-label={(label?label+': ':'')+value+'. Copiar'} onClick={()=>{try{void navigator.clipboard?.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{/* copy is optional */}}}>{label&&<span className="id-chip-label">{label}</span>}<code>{text}</code><span className="id-chip-copy" aria-live="polite">{copied?'Copiado':'Copiar'}</span></button>;
}
