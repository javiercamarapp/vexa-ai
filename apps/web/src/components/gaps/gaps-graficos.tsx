'use client';
import type {BrechasVista} from '../../../../../packages/workspace-service/brechas.mjs';
import {CALIDAD_TXT,NOMBRE,mesCorto,mesLargo,num,usd} from './gaps-modelo.mjs';
import '../refunds/fuga.css';
import './gaps.css';

const SERIE:Record<string,string>={amazon:'var(--gp-s1)',walmart:'var(--gp-s2)'};
const colorCanal=(c:string)=>SERIE[c]??'var(--gp-s3)';
type Ing=Extract<BrechasVista['ingresos'],{status:'ok'}>;
const corto=(minor:string)=>{const v=Number(BigInt(minor)/100n);return v>=1_000_000?`$${(v/1_000_000).toFixed(1)}M`:v>=1000?`$${Math.round(v/1000)}k`:`$${v}`;};

/** Columnas apiladas por mes: Amazon en negro, Walmart en gris, el resto en gris claro. Lo parcial o con hueco lleva trama. Con tabla equivalente debajo. */
export function GraficoMeses({ing}:{ing:Ing}){
 const max=Math.max(1,...ing.meses.map(m=>Number(BigInt(m.totalMinor)/100n)));
 const canales=[...new Set(ing.meses.flatMap(m=>Object.keys(m.canales)))].sort((a,b)=>(a==='amazon'?-2:a==='walmart'?-1:0)-(b==='amazon'?-2:b==='walmart'?-1:0));
 const resumen=ing.meses.map(m=>`${mesLargo(m.mes)} ${usd(m.totalMinor)}`).join(', ');
 return <div>
  <ul className="fg-leyenda" aria-label="Canales">{canales.map(c=><li key={c}><i className="gp-leyenda-i" style={{background:colorCanal(c)}}/>{NOMBRE[c]??c}</li>)}<li><i className="gp-leyenda-i fg-hatch"/>Mes parcial o con posible hueco</li></ul>
  <div className="gp-cols" style={{gridTemplateColumns:`repeat(${ing.meses.length},minmax(0,1fr))`}} role="img" aria-label={`Ingreso bruto por mes en dólares: ${resumen}. Los meses parciales o con posible hueco de exportación llevan trama.`}>
   {ing.meses.map(m=>{
    const peor=Object.values(m.canales).some(c=>c.calidad==='posible_hueco')?'posible_hueco':Object.values(m.canales).some(c=>c.calidad==='parcial')?'parcial':'completo';
    return <div key={m.mes} className="gp-col" data-q={peor}>
     <span className="gp-col-v">{corto(m.totalMinor)}</span>
     <span className="gp-col-area" style={{height:'100%'}}>{canales.filter(c=>m.canales[c]).map(c=><i key={c} style={{height:`${Math.max(1,Number(BigInt(m.canales[c].activoMinor)/100n)*100/max)}%`,background:colorCanal(c)}}/>)}</span>
     <span className="gp-col-m">{mesCorto(m.mes).split(' ')[0]}<small>{mesCorto(m.mes).split(' ')[1]}</small></span>
    </div>;})}
  </div>
  <details className="gp-tabla-det"><summary>Ver el gráfico como tabla</summary>
   <div className="fg-tabla-wrap" role="region" aria-label="Ingreso bruto por mes y canal, en tabla" tabIndex={0}>
    <table className="fg-tabla" aria-label="Ingreso bruto por mes y canal">
     <thead><tr><th scope="col">Mes</th>{canales.map(c=><th scope="col" className="fg-r" key={c}>{NOMBRE[c]??c}</th>)}<th scope="col" className="fg-r">Total</th><th scope="col">Calidad del mes</th></tr></thead>
     <tbody>{ing.meses.map(m=>{const peor=Object.values(m.canales).find(c=>c.calidad!=='completo')?.calidad??'completo';
      return <tr key={m.mes}><th scope="row">{mesLargo(m.mes)}</th>{canales.map(c=><td className="fg-r" key={c}>{m.canales[c]?usd(m.canales[c].activoMinor):'—'}</td>)}<td className="fg-r">{usd(m.totalMinor)}</td><td>{CALIDAD_TXT[peor]}</td></tr>;})}</tbody>
    </table>
   </div>
  </details>
 </div>;
}

/** Barra de una sola serie. tono: negro (principal), gris (comparativa) o rojo (resaltado). `marca` = posición 0-100 de una referencia (p. ej. la mediana del canal). */
export function Barra({valor,max,etiqueta,tono='negro',marca,aria}:{valor:number;max:number;etiqueta:string;tono?:'negro'|'gris'|'rojo';marca?:number|null;aria:string}){
 return <div className="gp-bar" role="img" aria-label={aria}>
  <span className="gp-bar-track" aria-hidden="true"><span className="gp-bar-fill" data-t={tono==='negro'?undefined:tono} style={{width:`${Math.max(1,Math.min(100,(valor*100)/Math.max(max,1e-9)))}%`}}/>{marca!==null&&marca!==undefined&&<span className="gp-bar-med" style={{left:`${Math.min(100,(marca*100)/Math.max(max,1e-9))}%`}}/>}</span>
  <b>{etiqueta}</b>
 </div>;
}
export const fmtLineas=num;
