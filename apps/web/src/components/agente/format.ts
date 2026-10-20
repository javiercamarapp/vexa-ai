import type {Answer,Block,Coverage} from './types';
import {CLASS_LABELS} from '../../../../../packages/agent-datos/contract.mjs';
const nf=new Intl.NumberFormat('es-MX');
export const fmtCell=(kind:string,v:string|number|null)=>v===null||v===undefined?'—':typeof v==='number'?nf.format(v):v;
export const coverageText=(c:Coverage)=>c.eligible_n===null?`Cobertura: ${c.note??'sin total esperado'}`:`Cobertura: ${nf.format(c.known_n)} de ${nf.format(c.eligible_n)}${c.eligible_n>0?` (${(Math.round(c.known_n*1000/c.eligible_n)/10).toLocaleString('es-MX')} %)`:''}`;
export const safeInternal=(href?:string)=>href&&href.startsWith('/')&&!href.startsWith('//')?href:null;
/** What «Copiar» puts in the clipboard: the answer, each table as TSV (pastes into Excel), and the sources. */
export function copyText(a:Answer):string{
 const parts=[a.text.trim()];
 for(const b of a.blocks)parts.push([b.title,b.columns.map(c=>c.label).join('\t'),...b.rows.map(r=>b.columns.map(c=>String(r[c.key]??'')).join('\t'))].join('\n'));
 if(a.sources.length)parts.push('Fuentes: '+a.sources.map(s=>s.label).join('; '));
 return parts.filter(Boolean).join('\n\n');
}
export const classLabel=(b:Block)=>b.class==='mixed'?'Clase por fila':CLASS_LABELS[b.class];
export const PARAM_LABELS:Record<string,string>={month:'Mes',months:'Meses',limit:'Máximo',kind:'Medida',a:'Mes base',b:'Mes comparado',fuente:'Fuente',problema:'Problema'};
export function paramValue(key:string,v:unknown):string{
 if(key==='kind')return v==='refund'?'Reembolsos liquidados':v==='order'?'Pedidos registrados':String(v);
 if((key==='month'||key==='a'||key==='b')&&typeof v==='string'&&/^\d{4}-\d{2}$/.test(v))return new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(v+'-01T00:00:00Z'));
 return String(v);
}
export function download(name:string,text:string,type:string){
 try{const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);return true;}catch{return false;}
}
