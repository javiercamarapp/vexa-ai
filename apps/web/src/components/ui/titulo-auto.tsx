'use client';
import type {ProblemFacts} from '../../../../../packages/workspace-service/problem-facts.mjs';
import {tituloDescriptivo,rotuloAuto,avisoAuto} from '../../lib/legibilidad/titulo-descriptivo.mjs';
import {useJson} from './use-json';
import {useT} from '../i18n/proveedor';
const accept=(j:unknown)=>{const d=(j as {data?:ProblemFacts})?.data;return d&&typeof d.problemId==='string'?d:null;};
/** Subtítulo «descripción automática» (sin IA): categoría + 2 temas más frecuentes de las citas del grupo, con conteos. Si `temas` no se pasa, se leen del grupo (consulta acotada). */
export function TituloAuto({problemId,label,conversaciones=null,temas,className}:{problemId:string;label:string;conversaciones?:number|null;temas?:{category:string;count:number}[]|null;className?:string}){
 const r=useJson<ProblemFacts>(temas===undefined?'/api/problems/'+encodeURIComponent(problemId)+'/facts?parts=themes':null,accept);
 const tr=useT();
 const t=tituloDescriptivo({label,temas:temas??r.data?.themes??null,conversaciones:conversaciones??r.data?.conversations??null,t:tr});
 if(!t||t.temas.length===0)return null;
 return <small className={className} title={avisoAuto(tr)} data-auto-title style={{display:'block',color:'var(--muted)',overflowWrap:'anywhere'}}>{t.texto} · <em style={{fontStyle:'normal'}}>{rotuloAuto(tr)}</em></small>;
}
