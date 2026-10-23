'use client';
import {useState} from 'react';
import type {BrechasVista} from '../../../../../packages/workspace-service/brechas.mjs';
import {Button} from '../ui/button';
import {NoDisponible,Vacio} from '../refunds/fuga-partes';
import {Barra,GraficoMeses} from './gaps-graficos';
import {NOMBRE,dia,fraseConcentracionIngreso,fraseConcentracionReembolsos,frasesMesContraMes,mesLargo,mesesExcluidos,num,pct,usd,variacion} from './gaps-modelo.mjs';
import '../refunds/fuga.css';
import './gaps.css';

const big=(m:string)=>Number(BigInt(m)/100n);

// ---------------------------------------------------------------- 1. Dónde gano
export function SeccionGano({v,onReintentar}:{v:BrechasVista;onReintentar:()=>void}){
 const [mas,setMas]=useState(false);
 if(v.ingresos.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(v.ingresos.status!=='ok')return <Vacio>Todavía no hay pedidos en el libro. Carga el export de Amazon o Walmart para ver dónde ganas.</Vacio>;
 const ing=v.ingresos,items=v.ranking.items.slice(0,mas?25:10),max=Math.max(1,...items.map(r=>big(r.activoMinor)));
 const frase=fraseConcentracionIngreso(v),excl=mesesExcluidos(v),cmp=frasesMesContraMes(v);
 return <div>
  <h3 className="gp-sub gp-sub0">Ingreso bruto por mes y canal</h3>
  <GraficoMeses ing={ing}/>
  {excl.length>0&&<p className="gp-nota">Meses con trama, fuera de toda comparación mes contra mes: {excl.join('; ')}.</p>}
  <h3 className="gp-sub">Por canal</h3>
  <div className="fg-tabla-wrap" role="region" aria-label="Ingreso bruto por canal" tabIndex={0}>
   <table className="fg-tabla" aria-label="Ingreso bruto por canal">
    <thead><tr><th scope="col">Canal</th><th scope="col" className="fg-bar-col">Ingreso bruto (USD, sin cancelados)</th><th scope="col" className="fg-r gp-hide-sm">Líneas</th><th scope="col" className="fg-r gp-hide-sm">Desde</th></tr></thead>
    <tbody>{ing.canales.map((c,i)=><tr key={c.canal}><th scope="row">{NOMBRE[c.canal]??c.canal}</th>
     <td className="fg-bar-col"><Barra valor={big(c.activoMinor)} max={big(ing.canales[0].activoMinor)} etiqueta={`${usd(c.activoMinor)} · ${pct(c.participacionPct)}`} tono={i===0?'negro':'gris'} aria={`${NOMBRE[c.canal]??c.canal}: ${usd(c.activoMinor)}, ${pct(c.participacionPct)} del ingreso`}/></td>
     <td className="fg-r gp-hide-sm">{num(c.lineas)}</td><td className="fg-r gp-hide-sm" style={{whiteSpace:"nowrap"}}>{dia(c.desde)}</td></tr>)}</tbody>
   </table>
  </div>
  <h3 className="gp-sub">Los SKUs que más ingreso dejan</h3>
  {frase&&<p className="fg-frase" style={{marginTop:0}}>{frase}</p>}
  {v.ranking.status!=='ok'?<Vacio>No hay SKUs del vendedor en el libro de pedidos.</Vacio>:<>
  <div className="fg-tabla-wrap" role="region" aria-label="Ranking de SKUs por ingreso bruto" tabIndex={0}>
   <table className="fg-tabla" aria-label="Ranking de SKUs por ingreso bruto">
    <thead><tr><th scope="col" className="fg-n gp-hide-sm">#</th><th scope="col">SKU</th><th scope="col" className="fg-bar-col">Ingreso bruto (USD)</th><th scope="col" className="fg-r gp-hide-sm">% acumulado</th><th scope="col" className="fg-r">Mes contra mes</th></tr></thead>
    <tbody>{items.map(r=><tr key={r.sku}>
     <td className="fg-n gp-hide-sm">{r.pos}</td>
     <th scope="row"><b>{r.sku}</b><br/><small className="fg-sm">{r.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${usd(c.activoMinor)}`).join(' · ')}</small></th>
     <td className="fg-bar-col"><Barra valor={big(r.activoMinor)} max={max} etiqueta={`${usd(r.activoMinor)} · ${pct(r.participacionPct)}`} aria={`${r.sku}: ${usd(r.activoMinor)}, ${pct(r.participacionPct)} del ingreso total`}/></td>
     <td className="fg-r gp-hide-sm">{pct(r.acumPct)}</td>
     <td className="fg-r" style={{whiteSpace:"nowrap"}}>{r.crecimiento?<span className={r.crecimiento.pct>=0?'gp-up':'gp-down'} title={`${NOMBRE[r.crecimiento.canal]??r.crecimiento.canal}: ${mesLargo(r.crecimiento.previo)} a ${mesLargo(r.crecimiento.mes)}, meses completos`}>{variacion(r.crecimiento.pct)}<br/><small className="fg-sm">{NOMBRE[r.crecimiento.canal]??r.crecimiento.canal}</small></span>:<span className="fg-sm" title="Sin dos meses completos consecutivos con base suficiente">sin comparar</span>}</td></tr>)}</tbody>
   </table>
  </div>
  {v.ranking.items.length>10&&<div className="fg-fila-acc"><Button size="sm" onClick={()=>setMas(m=>!m)}>{mas?'Mostrar solo 10':`Mostrar ${Math.min(25,v.ranking.items.length)}`}</Button></div>}
  <p className="gp-nota">Participación y % acumulado se calculan sobre el ingreso total del libro (incluye canales sin SKU). {cmp.join(' ')} Un mes es «completo» si empieza el día 1-3, termina a menos de 3 días de su fin y no cae a menos de la mitad del mes previo (posible hueco de exportación).</p></>}
 </div>;
}

// ---------------------------------------------------------------- 2. Dónde pierdo
export function SeccionPierdo({v,onReintentar}:{v:BrechasVista;onReintentar:()=>void}){
 const r=v.perdidas.reembolsos,c=v.perdidas.cancelaciones,t=v.perdidas.tracker,i=v.intensidad;
 const filas=i.status==='ok'?i.filas.filter(f=>f.significativa).slice(0,12):[],omitidas=i.status==='ok'?i.filas.length-i.filas.filter(f=>f.significativa).length:0;
 const maxI=Math.max(1,...filas.map(f=>f.intensidadPct??0));
 return <div>
  <div className="gp-tarjetas">
   <article className="gp-tarjeta"><h3>Dinero devuelto (reembolsos)</h3>
    {r.status==='unavailable'?<NoDisponible onRetry={onReintentar}/>:r.status!=='ok'?<p>Sin reembolsos cargados.</p>:<>
     <b className="fg-stat" aria-label={`${usd(r.brutoMinor)} devueltos, brutos`}>{usd(r.brutoMinor)}</b>
     <p>{usd(r.activoMinor)} sin cancelados · {num(r.n)} reembolsos{r.sinMonto>0?` (${num(r.sinMonto)} sin monto, no suman dinero)`:''}.</p>
     <p>Ingreso bruto devuelto, USD. CAD y MXN no se suman.</p></>}
   </article>
   <article className="gp-tarjeta"><h3>Cancelaciones</h3>
    {c.status!=='ok'?<NoDisponible onRetry={onReintentar}/>:<>
     <b className="fg-stat">{usd(c.canceladoMinor)}</b>
     <p>{num(c.lineas)} líneas canceladas ({pct(c.pct)} de las líneas de pedido). Ingreso bruto que no se concretó.</p></>}
   </article>
   <article className="gp-tarjeta"><h3>Reembolsos negados o vencidos (Tracker)</h3>
    {t.status==='unavailable'?<NoDisponible onRetry={onReintentar}/>:t.status!=='ok'?<p>Sin Tracker cargado.</p>:<>
     <b className="fg-stat">{num(t.negados)} solicitudes</b>
     <p>{t.estados.vencido.n} con más de 180 días · {t.estados.no_reembolsable.n} no reembolsables · {t.estados.rechazado.n} rechazadas: {usd(t.negadosMinor)} que no se recuperó ({num(t.negadosConMonto)} con monto, supuesto USD).</p>
     <p>Es una muestra del Tracker de Excel, no el total.</p></>}
   </article>
  </div>
  <h3 className="gp-sub">Intensidad de reembolso por SKU y canal</h3>
  {i.status==='unavailable'?<NoDisponible onRetry={onReintentar}/>:filas.length===0?<Vacio>Aún no hay pares SKU-canal con suficiente ingreso y reembolsos en meses completos para medir intensidad.</Vacio>:<>
   <p className="fg-intro" style={{margin:'0 0 var(--sp-2)'}}><b>Intensidad, no tasa por cohorte:</b> reembolsos sin cancelados entre ingreso bruto del mismo SKU, canal y mes. {i.cobertura?`Cobertura del cruce: ${num(i.cobertura.reembolsosCruzados)} de ${num(i.cobertura.reembolsosTotales)} reembolsos (${pct(i.cobertura.pct)} del dinero devuelto); el resto cae en meses parciales o sin ingreso del mismo SKU.`:''}</p>
   <div className="fg-tabla-wrap" role="region" aria-label="Intensidad de reembolso por SKU y canal" tabIndex={0}>
    <table className="fg-tabla" aria-label="Intensidad de reembolso por SKU y canal">
     <thead><tr><th scope="col">SKU · canal</th><th scope="col" className="fg-r gp-hide-sm">Ingreso (meses con cruce)</th><th scope="col" className="fg-r gp-hide-sm">Devuelto</th><th scope="col" className="fg-bar-col">Intensidad (la raya es la mediana del canal)</th></tr></thead>
     <tbody>{filas.map(f=>{const med=i.medianaCanal?.[f.canal]??null,alta=med!==null&&med>0&&(f.intensidadPct??0)>=med*v.umbrales.multiplicadorMediana;
      return <tr key={f.sku+f.canal}><th scope="row"><b>{f.sku}</b><br/><small className="fg-sm">{NOMBRE[f.canal]??f.canal} · {f.meses} meses</small></th>
       <td className="fg-r gp-hide-sm">{usd(f.ingresoMinor)}</td><td className="fg-r gp-hide-sm">{usd(f.reembolsoMinor)}<br/><small className="fg-sm">{num(f.reembolsos)} reembolsos</small></td>
       <td className="fg-bar-col"><Barra valor={f.intensidadPct??0} max={maxI} marca={med} tono={alta?'rojo':'negro'} etiqueta={pct(f.intensidadPct)} aria={`${f.sku} en ${NOMBRE[f.canal]??f.canal}: intensidad ${pct(f.intensidadPct)}${med!==null?`, mediana del canal ${pct(med)}`:''}${alta?', más del doble de la mediana':''}`}/>
        {alta&&<small className="gp-hl">{((f.intensidadPct??0)/(med??1)).toFixed(1)}× la mediana</small>}</td></tr>;})}</tbody>
    </table>
   </div>
   <p className="gp-nota">{omitidas>0?`${num(omitidas)} ${omitidas===1?'par SKU-canal no se muestra':'pares SKU-canal no se muestran'} por tener poca señal (menos de ${num(v.umbrales.minLineasCruce)} líneas, ${num(v.umbrales.minReembolsosCruce)} reembolsos o ${usd(String(v.umbrales.minIngresoCruceUsd*100))} de ingreso en los meses con cruce). `:''}Mediana por canal: {Object.entries(i.medianaCanal??{}).map(([c,m])=>`${NOMBRE[c]??c} ${pct(m)}`).join(' · ')||'sin datos'}.</p></>}
 </div>;
}

// ---------------------------------------------------------------- 3. Por qué y dónde podría ganar más
export function SeccionPorQue({v,onReintentar,irA}:{v:BrechasVista;onReintentar:()=>void;irA:(id:string)=>void}){
 const t=v.perdidas.tracker,conc=fraseConcentracionReembolsos(v),recs=v.recomendaciones.items;
 const rev=recs.filter(r=>r.tipo==='revisar_proveedor'||r.tipo==='revisar_canal'),emp=recs.filter(r=>r.tipo==='empujar');
 const lista=(xs:typeof recs,vacio:string)=>xs.length===0?<p className="fg-sm">{vacio}</p>:<ul className="fg-rank">{xs.slice(0,5).map(r=><li key={r.id}><span><button type="button" className="btn btn-ghost btn-sm gp-lista-btn" onClick={()=>irA(r.id)}>{r.titulo}</button></span><b>{r.impacto.usdMinor?usd(r.impacto.usdMinor):'—'}</b><small>{r.porque}</small></li>)}</ul>;
 return <div>
  {conc?<p className="fg-frase" style={{marginTop:0}}>{conc}</p>:<NoDisponible onRetry={onReintentar}/>}
  <div className="fg-stats" style={{marginTop:'var(--sp-4)'}}>
   <div><h3 className="gp-sub gp-sub0">Candidatos a revisar con el canal o el proveedor</h3>{lista(rev,'Ningún SKU supera el doble de la intensidad típica de su canal con ingreso suficiente.')}</div>
   <div><h3 className="gp-sub gp-sub0">Candidatos a empujar</h3>{lista(emp,'Ningún SKU crece 10 % o más entre meses completos con devolución igual o menor a la mediana de su canal.')}</div>
  </div>
  <h3 className="gp-sub">Motivos de las solicitudes de reembolso (Tracker)</h3>
  {t.status==='unavailable'?<NoDisponible onRetry={onReintentar}/>:t.status!=='ok'?<Vacio>Sin Tracker cargado: no hay motivos que mostrar.</Vacio>:<>
   <div className="fg-tabla-wrap" role="region" aria-label="Motivos de las solicitudes de reembolso" tabIndex={0}>
    <table className="fg-tabla" aria-label="Motivos de las solicitudes de reembolso, del Tracker de Excel">
     <thead><tr><th scope="col">Motivo</th><th scope="col" className="fg-r">Solicitudes</th><th scope="col" className="fg-r gp-hide-sm">Reembolsadas</th><th scope="col" className="fg-r">Negadas o vencidas</th><th scope="col" className="fg-r gp-hide-sm">Monto no recuperado</th></tr></thead>
     <tbody>{t.motivos.slice(0,8).map(m=><tr key={m.motivo}><th scope="row">{m.etiqueta}</th><td className="fg-r">{num(m.n)}</td><td className="fg-r gp-hide-sm">{num(m.reembolsados)}</td><td className="fg-r">{num(m.negados)}{m.n>0?<small className="fg-sm"> ({pct(Math.round((m.negados*1000)/m.n)/10)})</small>:null}</td><td className="fg-r gp-hide-sm">{usd(m.negadosMinor)}</td></tr>)}</tbody>
    </table>
   </div>
   <p className="gp-nota">Motivos de un catálogo cerrado; el texto libre del Tracker no se muestra. Muestra de {num(t.total)} solicitudes, no el total de reembolsos. Monto sin moneda declarada: se supone USD. El motivo describe la solicitud, no prueba la causa.</p></>}
 </div>;
}
