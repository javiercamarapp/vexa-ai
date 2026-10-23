'use client';
import Link from '../workspace/navigation-lifecycle';
import {useSearchParams} from 'next/navigation';
import {consultaAlcance} from '../../lib/workspace/alcance.mjs';
export type VistaAcciones='por-decidir'|'en-curso'|'resultados';
/** Vista elegida en /interventions (?vista=en-curso|resultados); sin valor = todas las intervenciones. */
export const vistaDe=(raw:string|null|undefined):VistaAcciones|null=>{const v=new URLSearchParams(raw??'').get('vista');return v==='en-curso'||v==='resultados'?v:null;};
export const ESTADOS_VISTA:Record<'en-curso'|'resultados',readonly string[]>={'en-curso':['draft','approved','active','measuring'],resultados:['closed']};
/** Un solo ciclo en tres vistas: Por decidir (recomendaciones) -> En curso -> Resultados (intervenciones). */
export function AccionesTabs({actual}:{actual:VistaAcciones|null}){
 const q=consultaAlcance(useSearchParams().toString()),con=(r:string)=>r+(q?'?'+q:''),conVista=(v:string)=>'/interventions?'+new URLSearchParams(q).toString()+(q?'&':'')+'vista='+v;
 const tabs:[VistaAcciones,string,string][]=[['por-decidir','Por decidir',con('/recommendations')],['en-curso','En curso',conVista('en-curso')],['resultados','Resultados',conVista('resultados')]];
 return <nav aria-label="Etapas del ciclo de acciones" className="toolbar" style={{display:'flex',gap:8,flexWrap:'wrap'}}>{tabs.map(([k,t,href])=><Link key={k} href={href} className={'btn btn-sm '+(actual===k?'btn-primary':'btn-secondary')} aria-current={actual===k?'page':undefined}>{t}</Link>)}</nav>;
}
