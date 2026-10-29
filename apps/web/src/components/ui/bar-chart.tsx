import {useT} from '../i18n/proveedor';
import {KindBadge} from './kind-badge';
import type {EpistemicKind} from '../../lib/epistemic.mjs';
export type BarDatum={key:string;label:string;value:number|null;display:string;kind:EpistemicKind;note?:string;href?:string};
/** Horizontal bars anchored at zero. Unknown values render a hatched "sin importe" track, never a zero bar. Table equivalent below. */
export function BarChart({title,unit,data,empty}:{title:string;unit:string;data:BarDatum[];empty?:string}){
 const t=useT(),max=Math.max(0,...data.map(d=>d.value??0));
 if(!data.length)return <p className="state">{empty??t('tr.ui.sinDatosGraficar')}</p>;
 return <figure className="chart" aria-label={title}>
  <figcaption className="chart-title">{title}<span>{unit}</span></figcaption>
  <ul className="bars">{data.map(d=><li key={d.key} className="bar-row"><div className="bar-label"><span className="bar-name" title={d.label}>{d.label}</span><KindBadge kind={d.kind}/></div>
   <div className="bar-track" data-unknown={d.value===null}>{d.value!==null&&max>0&&<span className={'bar-fill bar-'+d.kind} style={{width:Math.max(0.6,d.value*100/max)+'%'}} title={d.display}/>}</div>
   <span className="bar-value">{d.display}</span>{d.note&&<span className="bar-note">{d.note}</span>}</li>)}</ul>
 </figure>;
}
