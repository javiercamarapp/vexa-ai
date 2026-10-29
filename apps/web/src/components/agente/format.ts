import type {Answer,Block,Coverage} from './types';
import type {Clave,Traductor} from '../../lib/i18n';
import {traductor,type Idioma} from '../../lib/i18n';
import {CLASS_LABELS} from '../../../../../packages/agent-datos/contract.mjs';
import {nf,mesLargo} from '../../lib/formato/idioma.mjs';
export const fmtCell=(kind:string,v:string|number|null)=>v===null||v===undefined?'—':typeof v==='number'?nf.format(v):v;
export const coverageText=(c:Coverage,tx:Traductor)=>c.eligible_n===null?tx('tr.ag.cobNota',{nota:c.note??tx('tr.ag.cobSinTotal')}):c.eligible_n>0?tx('tr.ag.cobDePct',{a:nf.format(c.known_n),b:nf.format(c.eligible_n),pct:nf.format(Math.round(c.known_n*1000/c.eligible_n)/10)}):tx('tr.ag.cobDe',{a:nf.format(c.known_n),b:nf.format(c.eligible_n)});
export const safeInternal=(href?:string)=>href&&href.startsWith('/')&&!href.startsWith('//')?href:null;
/** What «Copiar» puts in the clipboard: the answer, each table as TSV (pastes into Excel), and the sources. */
export function copyText(a:Answer,tx?:Traductor):string{
 const parts=[a.text.trim()];
 for(const b of a.blocks)parts.push([b.title,b.columns.map(c=>c.label).join('\t'),...b.rows.map(r=>b.columns.map(c=>String(r[c.key]??'')).join('\t'))].join('\n'));
 if(a.sources.length)parts.push((tx?tx('ag.fuentes'):'Fuentes')+': '+a.sources.map(s=>s.label).join('; '));
 return parts.filter(Boolean).join('\n\n');
}
export const classLabel=(b:Block)=>b.class==='mixed'?'Clase por fila':CLASS_LABELS[b.class];
/** Clave traducida de cada parámetro de consulta (PARAM_LABELS conserva el español canónico). */
export const PARAM_CLAVES:Record<string,Clave>={month:'cfo.serie.mes',months:'tr.ag.pMeses',limit:'tr.ag.pMax',kind:'tr.ag.pMedida',a:'tr.ag.pMesBase',b:'tr.ag.pMesComp',fuente:'conf.hFuente',problema:'tr.ag.pProblema'};
export const PARAM_LABELS:Record<string,string>={month:'Mes',months:'Meses',limit:'Máximo',kind:'Medida',a:'Mes base',b:'Mes comparado',fuente:'Fuente',problema:'Problema'};
export function paramValue(key:string,v:unknown,idioma:Idioma='es'):string{
 if(key==='kind'){const tx=traductor(idioma);return v==='refund'?tx('tr.fm.kindRefund'):v==='order'?tx('tr.fm.kindOrder'):String(v);}
 if((key==='month'||key==='a'||key==='b')&&typeof v==='string'&&/^\d{4}-\d{2}$/.test(v))return mesLargo(v,idioma) as string;
 return String(v);
}
export function download(name:string,text:string,type:string){
 try{const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);return true;}catch{return false;}
}
/** Opens a standalone HTML report in a new tab (so «Imprimir» saves a PDF); if the browser blocks the pop-up, downloads it instead. */
export function openReport(name:string,html:string){
 try{const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const w=window.open(url,'_blank');if(w)w.opener=null;setTimeout(()=>URL.revokeObjectURL(url),60000);if(w)return true;URL.revokeObjectURL(url);}catch{/* falls back to download */}
 return download(name,html,'text/html;charset=utf-8');
}
