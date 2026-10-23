import type {ReactNode} from 'react';
export type Kpi={key?:string;label:string;value:ReactNode;note?:ReactNode};
/** Tira de indicadores: rejilla uniforme (1/2/4 columnas). Acepta `items` simples o tarjetas StatCard como hijos. */
export function KpiStrip({items,children,label='Indicadores'}:{items?:Kpi[];children?:ReactNode;label?:string}){
 return <div className="ui-kpis" role="group" aria-label={label}>{items?items.map(k=><div key={k.key??k.label} className="ui-kpi"><span className="ui-kpi-label">{k.label}</span><strong className="ui-kpi-value">{k.value}</strong>{k.note&&<small className="ui-kpi-note">{k.note}</small>}</div>):children}</div>;
}
