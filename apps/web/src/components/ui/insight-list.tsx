import type {Insight} from '../../lib/legibilidad/insights.mjs';
import {ConMarca} from './brand-mark';
import {KindBadge} from './kind-badge';
import s from './legibilidad.module.css';
/** **negritas** → <strong>; el resto es texto plano (nunca HTML). */
function Rich({texto}:{texto:string}){return <>{texto.split('**').map((p,i)=>i%2?<strong key={i}>{p}</strong>:<span key={i}>{p}</span>)}</>;}
/** Hasta 3 insights en lenguaje claro, cada uno con fuente, cobertura y clase. Sin dato: «Aún sin datos» + razón. */
export function InsightList({insights,label='Lo más importante'}:{insights:Insight[];label?:string}){
 const list=insights.slice(0,3);
 if(!list.length)return null;
 return <ul className={s.insights} aria-label={label}>{list.map(i=>i.vacio
  ?<li key={i.id} className={s.insight+' '+s.insightEmpty} data-insight={i.id}><p className={s.insightText}><span className={s.nodata}>Aún sin datos</span> {i.razon}</p><div className={s.insightMeta}><span>Fuente: <ConMarca marca={i.fuente}>{i.fuente}</ConMarca></span></div></li>
  :<li key={i.id} className={s.insight} data-insight={i.id}><p className={s.insightText}><Rich texto={i.texto}/></p><div className={s.insightMeta}><KindBadge kind={i.clase}/><span>Fuente: {i.fuente}</span><span>Cobertura: {i.cobertura}</span></div></li>)}</ul>;
}
