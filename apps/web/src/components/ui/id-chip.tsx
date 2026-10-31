'use client';
import {useState} from 'react';
import {useT} from '../i18n/proveedor';
/** Long identifiers (snapshot, scope hash, revision) never spill: shortened in place, full value in title and copyable. */
export function IdChip({value,label,head=8,tail=4,text:shown}:{value:string;label?:string;head?:number;tail?:number;text?:string}){
 const t=useT(),[copied,setCopied]=useState(false);
 const text=shown??(value.length>head+tail+1?value.slice(0,head)+'…'+value.slice(-tail):value);
 return <button type="button" className="id-chip" title={value} aria-label={(label?label+': ':'')+value+'. '+t('tr.ui.copiar')} onClick={()=>{try{void navigator.clipboard?.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{/* copy is optional */}}}>{label&&<span className="id-chip-label">{label}</span>}<code>{text}</code><span className="id-chip-copy" aria-live="polite">{copied?t('tr.ui.copiado'):t('tr.ui.copiar')}</span></button>;
}
