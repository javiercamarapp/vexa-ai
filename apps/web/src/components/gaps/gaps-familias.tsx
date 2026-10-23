'use client';
import type {BrechasVista} from '../../../../../packages/workspace-service/brechas.mjs';
import {EmptyState} from '../ui/empty-state';
import {NoDisponible} from '../refunds/fuga-partes';
import {Barra} from './gaps-graficos';
import {num,pct,textoAvance,usd} from './gaps-modelo.mjs';
import '../refunds/fuga.css';
import './gaps.css';

/** Barra de avance del análisis del histórico (role=progressbar). */
export function Avance({f}:{f:BrechasVista['familias']}){
 const p=f.progreso,val=p?.avancePct??null;
 return <div className="gp-prog">
  <div className="gp-prog-track" role="progressbar" aria-label="Avance del análisis del histórico" aria-valuemin={0} aria-valuemax={100} aria-valuenow={val??undefined} aria-valuetext={textoAvance(f)}><span className="gp-prog-fill" data-cero={!val||undefined} style={{width:`${val??0}%`}}/></div>
  <p className="fg-sm">{textoAvance(f)}</p>
 </div>;
}

/** «Ventas vs quejas por familia de producto»: ingreso (negro) frente a conversaciones de soporte por cada 100 líneas vendidas (gris; rojo si dobla la mediana). Solo familias con mapa a SKU. */
export function SeccionFamilias({v,onReintentar}:{v:BrechasVista;onReintentar:()=>void}){
 const f=v.familias;
 if(f.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(f.status==='pendiente')return <EmptyState art="search" title="El análisis del histórico aún no termina: disponible cuando se complete" compact
  body={<>Para cruzar ventas con quejas por producto, la IA lee cada conversación y anota qué producto menciona. Todavía no hay conversaciones con esa lectura, así que no se muestra ninguna cifra (no es cero).</>}
  secondary={<Avance f={f}/>}/>;
 const filas=f.filas,maxIng=Math.max(1,...filas.map(x=>Number(BigInt(x.ingresoMinor)/100n))),tasas=filas.map(x=>x.por100).filter((x):x is number=>x!==null).sort((a,b)=>a-b);
 const med=tasas.length?tasas[tasas.length>>1]:null,maxT=Math.max(1,...tasas);
 return <div>
  {f.status==='parcial'&&<div className="fg-aviso" role="note"><Avance f={f}/><p className="fg-sm" style={{marginTop:6}}>El análisis sigue corriendo: estas cifras son parciales y cambiarán. Las conversaciones se cuentan por familia mencionada.</p></div>}
  <div className="fg-tabla-wrap" role="region" aria-label="Ingreso y conversaciones de soporte por familia de producto" tabIndex={0}>
   <table className="fg-tabla" aria-label="Ingreso y conversaciones de soporte por familia de producto">
    <thead><tr><th scope="col">Familia</th><th scope="col" className="fg-bar-col">Ingreso bruto (USD)</th><th scope="col" className="fg-r gp-hide-sm">Líneas</th><th scope="col" className="fg-r gp-hide-sm">Conversaciones</th><th scope="col" className="fg-bar-col">Por cada 100 líneas vendidas</th><th scope="col" className="fg-r gp-hide-sm">Lugar en ingreso / en quejas</th></tr></thead>
    <tbody>{filas.map(x=>{const alta=med!==null&&x.por100!==null&&med>0&&x.por100>=med*2;
     return <tr key={x.familia}><th scope="row"><b>{x.etiqueta}</b><br/><small className="fg-sm">{num(x.skus)} SKUs</small></th>
      <td className="fg-bar-col"><Barra valor={Number(BigInt(x.ingresoMinor)/100n)} max={maxIng} etiqueta={usd(x.ingresoMinor)} aria={`${x.etiqueta}: ${usd(x.ingresoMinor)} de ingreso bruto`}/></td>
      <td className="fg-r gp-hide-sm">{num(x.lineas)}</td><td className="fg-r gp-hide-sm">{num(x.conversaciones)}</td>
      <td className="fg-bar-col">{x.por100===null?<span className="fg-sm" title="Menos de 30 líneas en los meses comparados">poca base</span>:<Barra valor={x.por100} max={maxT} marca={med} tono={alta?'rojo':'gris'} etiqueta={String(x.por100)} aria={`${x.etiqueta}: ${x.por100} conversaciones por cada 100 líneas vendidas${alta?', más del doble de la mediana de las familias':''}`}/>}</td>
      <td className="fg-r gp-hide-sm gp-rank">#{x.posIngreso} / #{x.posQuejas}</td></tr>;})}</tbody>
   </table>
  </div>
  <p className="gp-nota">«Quejas» = conversaciones de soporte que mencionan la familia (no todas son quejas). Se comparan con las líneas vendidas de la misma familia en los meses con análisis y con el libro completo. Familia = prefijo del SKU (p. ej. SKUP); la raya marca la mediana. {f.cobertura?`Cobertura: ${pct(f.cobertura.conFamiliaPct)} de las ${num(f.cobertura.analizadas)} conversaciones analizadas mencionan alguna familia; ${pct(f.cobertura.ingresoConMapaPct)} del ingreso por SKU está en familias con mapa. `:''}No es una tasa por cliente ni prueba causa.</p>
  {(f.sinMapa?.length??0)>0&&<p className="gp-nota">Líneas mencionadas en conversaciones sin SKUs con ese prefijo en las ventas (no se cruzan): {f.sinMapa!.slice(0,6).map(x=>`${x.etiqueta} (${num(x.conversaciones)})`).join(', ')}.</p>}
  {f.categorias.length>0&&<><h3 className="gp-sub">Categorías mencionadas (sin cruce con ventas)</h3>
   <p className="fg-sm" style={{marginBottom:8}}>No existe un catálogo que relacione categorías con SKUs, así que estas menciones no se cruzan con ingreso ni se mezclan con las líneas.</p>
   <ul className="fg-rank">{f.categorias.slice(0,8).map(c=><li key={c.familia}><span>{c.etiqueta}</span><b>{num(c.conversaciones)}</b></li>)}</ul></>}
 </div>;
}
