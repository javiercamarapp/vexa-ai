'use client';
import type {FugaVista,MesIntensidad} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {NOMBRE,mesCorto,num,pct} from './fuga-modelo.mjs';
import {NoDisponible,Vacio} from './fuga-partes';
import './fuga.css';

const COLOR:Record<string,string>={walmart:'var(--fg-walmart)',amazon:'var(--fg-amazon)'};
/** Columnas mensuales de intensidad (reembolsos del mes / líneas del mes) de un canal. Parcial = rayado; posible hueco = sin columna y marca «?». */
function Canal({canal,todos,max}:{canal:string;todos:MesIntensidad[];max:number}){
 // El último mes con datos puede estar cortado (pocas líneas, mucha intensidad aparente): no se dibuja, pero sigue en la tabla.
 const meses=todos.filter(m=>!m.ultimo);
 const ultimoCompleto=[...meses].reverse().find(m=>m.calidad==='completo'&&m.intensidadPct!==null);
 const pico=meses.filter(m=>m.calidad==='completo'&&m.intensidadPct!==null).sort((a,b)=>(b.intensidadPct??0)-(a.intensidadPct??0))[0];
 if(!meses.length)return <div className="fg-canal"><h3>{NOMBRE[canal]}</h3><Vacio>Sin meses con reembolsos registrados.</Vacio></div>;
 return <div className="fg-canal"><h3>{NOMBRE[canal]??canal}</h3>
  <div className="fg-cols" style={{gridTemplateColumns:`repeat(${meses.length},minmax(0,1fr))`}} role="img" aria-label={`Intensidad mensual de ${NOMBRE[canal]}: ${meses.map(m=>`${mesCorto(m.mes)} ${m.intensidadPct===null?'sin dato':pct(m.intensidadPct)}${m.calidad==='completo'?'':m.calidad==='parcial'?' (parcial)':' (posible hueco)'}`).join(', ')}`}>
   {meses.map(m=>{
    const h=m.intensidadPct===null?0:Math.max(2,(m.intensidadPct/max)*100),etiqueta=m===ultimoCompleto||m===pico;
    return <div key={m.mes} className="fg-col" data-q={m.calidad} title={`${mesCorto(m.mes)}: ${num(m.reembolsos)} reembolsos / ${num(m.lineas)} líneas = ${m.intensidadPct===null?'sin dato':pct(m.intensidadPct)}${m.calidad==='parcial'?' · mes parcial':m.calidad==='posible_hueco'?' · posible hueco de exportación':''}`}>
     <span className="fg-col-v">{m.calidad==='posible_hueco'?'?':etiqueta&&m.intensidadPct!==null?pct(m.intensidadPct):''}</span>
     <span className="fg-col-area">{m.calidad!=='posible_hueco'&&<i style={{height:h+'%',background:COLOR[canal]??'var(--fg-otro)'}}/>}</span>
     <span className="fg-col-m">{mesCorto(m.mes).slice(0,3)}{m.mes.endsWith('-01')||m===meses[0]?<small>{m.mes.slice(2,4)}</small>:null}</span>
    </div>;})}
  </div>
  {todos.length>meses.length&&<p className="fg-sm">No se dibuja {mesCorto(todos.at(-1)!.mes)}: es el último mes con datos y puede estar cortado.</p>}
  <details className="fg-mini"><summary>Ver los números de {NOMBRE[canal]}</summary>
   <table><thead><tr><th scope="col">Mes</th><th scope="col" className="fg-r">Reembolsos</th><th scope="col" className="fg-r">Líneas</th><th scope="col" className="fg-r">Intensidad</th><th scope="col">Calidad</th></tr></thead>
    <tbody>{todos.map(m=><tr key={m.mes}><td>{mesCorto(m.mes)}</td><td className="fg-r">{num(m.reembolsos)}</td><td className="fg-r">{num(m.lineas)}</td><td className="fg-r">{pct(m.intensidadPct)}</td><td>{m.calidad==='completo'?'Completo':m.calidad==='parcial'?'Parcial':'Posible hueco'}</td></tr>)}</tbody></table></details>
 </div>;
}
export function SeccionIntensidad({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 const i=v.intensidad;
 if(i.status!=='ok')return <NoDisponible texto="Las líneas vendidas no respondieron a tiempo, así que la intensidad no está disponible ahora. No es cero." onRetry={onReintentar}/>;
 const todos=Object.values(i.canales).flatMap(c=>c.meses).filter(m=>!m.ultimo&&m.calidad!=='posible_hueco'&&m.intensidadPct!==null);
 const max=Math.max(1,...todos.map(m=>m.intensidadPct??0));
 const w=i.walmartSinCancelados;
 const ultW=(i.canales.walmart?.meses??[]).filter(m=>!m.ultimo);
 return <div>
  {(()=>{
   const a=[...(i.canales.amazon?.meses??[])].reverse().find(m=>m.calidad==='completo'&&m.intensidadPct!==null);
   const partes:string[]=[];
   if(ultW.length&&w&&w.conPct!==null)partes.push(`Entre ${mesCorto(ultW[0].mes)} y ${mesCorto(ultW[ultW.length-1].mes)}, por cada 100 líneas vendidas en Walmart hubo ~${Math.round(w.conPct)} reembolsos (${pct(w.sinPct)} sin los ${num(w.cancelados)} cancelados)`);
   if(a)partes.push(`${partes.length?'en':'En'} Amazon, ~${Math.round(a.intensidadPct as number)} en ${mesCorto(a.mes)}`);
   return partes.length?<p className="fg-frase">{partes.join('; ')}.</p>:null;})()}
  <ul className="fg-leyenda"><li><i style={{background:COLOR.walmart}}/>Walmart</li><li><i style={{background:COLOR.amazon}}/>Amazon</li><li><i className="fg-hatch"/>Mes parcial</li><li><b>?</b> Posible hueco de exportación (sin columna)</li></ul>
  <div className="fg-canales">{Object.entries(i.canales).map(([c,b])=><Canal key={c} canal={c} todos={b.meses} max={max}/>)}</div>
  <p className="fg-aviso">Intensidad, no tasa por cohorte; ventanas parciales. {i.bestBuy.reembolsosEnElLibro===0?'Best Buy no aparece: su libro no trae reembolsos.':''}</p>
 </div>;
}
