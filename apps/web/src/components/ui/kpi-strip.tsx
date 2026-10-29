import type {ReactNode} from 'react';
import {useT} from '../i18n/proveedor';
import {Sparkline} from './sparkline';
import {MovilContenido} from './movil-contenido';
export type Kpi={key?:string;/** 1..8 acento de color */c?:number;/** valores para el sparkline en color */spark?:number[];label:string;value:ReactNode;note?:ReactNode};
/** Tira de indicadores: rejilla uniforme (1/2/4 columnas). Acepta `items` simples o tarjetas StatCard como hijos. */
export function KpiStrip({items,children,label}:{items?:Kpi[];children?:ReactNode;label?:string}){
 const t=useT();
 return <div className="ui-kpis" role="group" aria-label={label??t('tr.ui.indicadores')}><MovilContenido solo="cifras"/>{items?items.map(k=><div key={k.key??k.label} className="ui-kpi" data-c={k.c} style={k.c?{['--cat' as string]:`var(--chart-${((k.c-1)%8)+1})`}:undefined}><span className="ui-kpi-label">{k.label}</span><div className="ui-kpi-row"><strong className="ui-kpi-value">{k.value}</strong>{k.spark&&k.spark.length>1&&<Sparkline data={k.spark} label={t('tr.ui.tendenciaDe',{x:k.label})} color={k.c}/>}</div>{k.note&&<small className="ui-kpi-note">{k.note}</small>}</div>):children}</div>;
}
