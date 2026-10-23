'use client';
import type {ReactNode} from 'react';
import type {FugaVista,SkuFila} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {Chip} from '../ui/chip';
import {DataTable,type Column} from '../ui/data-table';
import {Button,Download} from '../ui/button';
import {BarraApilada,color} from '../ui/mini-charts';
import {Leyenda,ListaBarras,Vacio} from '../dinero/partes';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {NoDisponible} from './fuga-partes';
import {ESTADO_TXT,HOJA_TXT,NOMBRE,frasesCambios,excluidosTexto,mesCorto,num,pct,usd} from './fuga-modelo.mjs';
import {datosSku,NO_SE_SABE} from './fuga-archivos.mjs';

const big=(m:string)=>Number(BigInt(m)/100n);
export const corto=(n:number)=>n>=1_000_000?`$${(n/1_000_000).toFixed(2)}M`:n>=1000?`$${Math.round(n/1000)}k`:`$${n}`;
const CANAL_C:Record<string,number>={amazon:1,walmart:5,bestbuy:4,shopify:3};
const cc=(c:string)=>CANAL_C[c]??8;

/** Serie mensual de reembolsos (todos los canales) para la mini-gráfica del KPI; vacía si la intensidad no respondió. */
export function serieReembolsos(v:FugaVista):number[]{
 const i=v.intensidad;if(i.status!=='ok')return [];
 const por=new Map<string,number>();
 for(const b of Object.values(i.canales))for(const m of b.meses)if(!m.ultimo&&m.calidad==='completo')por.set(m.mes,(por.get(m.mes)??0)+m.reembolsos);
 return [...por.entries()].sort((a,b)=>a[0]<b[0]?-1:1).map(e=>e[1]);
}

// ---- Pareto top 10
export function Pareto({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 if(v.skus.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 const top:SkuFila[]=v.skus.status==='ok'?v.skus.top:[];
 if(!top.length)return <Vacio>No hay reembolsos con SKU en este periodo.</Vacio>;
 const max=Math.max(1,...top.map(r=>big(r.usdBrutoMinor)));
 return <div className="dg-fill"><ListaBarras c={2} max={max} label="Los 10 SKUs con más dinero devuelto" items={top.map(r=>({key:r.sku,etiqueta:`${r.pos}. ${r.sku}`,sub:r.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${num(c.n)}`).join(' · '),valor:big(r.usdBrutoMinor),texto:corto(big(r.usdBrutoMinor)),sub2:`${pct(r.acumPct)} acumulado`}))}/>
  {v.skus.status==='ok'&&v.skus.top.length>0&&<p className="dg-nota">{top.length} de {num(v.skus.total??top.length)} SKUs. El % acumulado va en la segunda línea de cada valor; el dinero de Amazon sin monto no suma.</p>}</div>;
}

// ---- Intensidad por canal (columnas finas por canal)
export function IntensidadCanales({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 const i=v.intensidad;
 if(i.status!=='ok')return <NoDisponible texto="Las líneas vendidas no respondieron a tiempo: la intensidad no está disponible ahora. No es cero." onRetry={onReintentar}/>;
 const canales=Object.entries(i.canales);
 const todos=canales.flatMap(([,b])=>b.meses).filter(m=>!m.ultimo&&m.calidad!=='posible_hueco'&&m.intensidadPct!==null);
 const max=Math.max(1,...todos.map(m=>m.intensidadPct??0));
 const w=i.walmartSinCancelados,a=[...(i.canales.amazon?.meses??[])].reverse().find(m=>m.calidad==='completo'&&m.intensidadPct!==null);
 return <div className="dg-fill">
  <Leyenda items={[...canales.map(([c])=>({label:NOMBRE[c]??c,c:cc(c)})),{label:'Mes parcial',hatch:true}]}/>
  {canales.map(([c,b])=>{const meses=b.meses.filter(m=>!m.ultimo);
   return <div key={c} style={{marginBottom:10}}><p className="dg-lab" style={{margin:'0 0 4px'}}><b>{NOMBRE[c]??c}</b></p>
    {!meses.length?<Vacio>Sin meses con reembolsos registrados.</Vacio>:
    <div className="dg-meses" style={{height:132,gridTemplateColumns:`repeat(${meses.length},minmax(0,1fr))`}} role="img" aria-label={`Intensidad mensual de ${NOMBRE[c]??c}: ${meses.map(m=>`${mesCorto(m.mes)} ${m.intensidadPct===null?'sin dato':pct(m.intensidadPct)}`).join(', ')}`}>
     {meses.map(m=><div key={m.mes} className="dg-mes" style={{gridTemplateRows:'14px 1fr 16px'}} data-q={m.calidad} title={`${mesCorto(m.mes)}: ${num(m.reembolsos)} reembolsos / ${num(m.lineas)} líneas = ${m.intensidadPct===null?'sin dato':pct(m.intensidadPct)}${m.calidad==='parcial'?' · mes parcial':m.calidad==='posible_hueco'?' · posible hueco de exportación':''}`}>
      <span className="dg-mes-v">{m.calidad==='posible_hueco'?'?':''}</span>
      <span className="dg-mes-a">{m.calidad!=='posible_hueco'&&m.intensidadPct!==null&&<i style={{height:Math.max(3,m.intensidadPct*100/max)+'%',background:color(cc(c)-1)}}/>}</span>
      <span className="dg-mes-m" style={{paddingTop:0}}>{mesCorto(m.mes).slice(0,1)}</span></div>)}</div>}</div>;})}
  <p className="dg-nota">{w&&w.conPct!==null?`Walmart: ~${Math.round(w.conPct)} reembolsos por cada 100 líneas (${pct(w.sinPct)} sin los ${num(w.cancelados)} cancelados). `:''}{a?`Amazon: ~${Math.round(a.intensidadPct as number)} en ${mesCorto(a.mes)}. `:''}Intensidad, no tasa por cohorte; «?» = posible hueco de exportación.</p></div>;
}

// ---- Tabla top 10 con selector de expediente
export function TablaTop({v,sel,onSel,onPaquete}:{v:FugaVista;sel:string;onSel:(s:string)=>void;onPaquete:(s:string)=>void}){
 const top:SkuFila[]=v.skus.status==='ok'?v.skus.top:[];
 const lineasOk=v.skus.status==='ok'&&v.skus.lineasStatus==='ok';
 const cols:Column<SkuFila>[]=[
  {key:'p',header:'#',width:'44px',render:r=>r.pos},
  {key:'s',header:'SKU',render:r=><button type="button" className="dg-sku ui-reset" aria-pressed={sel===r.sku} aria-label={`Ver expediente de ${r.sku}`} onClick={()=>onSel(r.sku)}>{r.sku}</button>},
  {key:'c',header:'Canal',render:r=><span style={{display:'inline-flex',gap:4,flexWrap:'wrap'}}>{r.canales.map(c=><Chip key={c.canal} categoria={cc(c.canal)}>{NOMBRE[c.canal]??c.canal}</Chip>)}</span>},
  {key:'d',header:'Devuelto (USD bruto)',align:'num',render:r=>usd(r.usdBrutoMinor)},
  {key:'n',header:'Reembolsos',align:'num',render:r=>num(r.n)},
  {key:'l',header:'Líneas vendidas',align:'num',render:r=>r.lineas===null?'—':<>{num(r.lineas)}{r.n>r.lineas&&<> <Chip tone="warn">revisar</Chip></>}</>},
  {key:'a',header:'% acumulado',align:'num',render:r=>pct(r.acumPct)},
  {key:'x',header:'Expediente',render:r=><Button size="sm" variant={sel===r.sku?'primary':'secondary'} onClick={()=>onSel(r.sku)}>{sel===r.sku?'Abierto':'Ver'}</Button>},
 ];
 void onPaquete;
 return <div className="dg-fill"><DataTable caption="Los 10 SKUs con más dinero devuelto" columns={cols} rows={top} rowKey={r=>r.sku} maxHeight="none" empty={<Vacio>No hay reembolsos con SKU en este periodo.</Vacio>}/>
  <p className="dg-nota">{lineasOk?'«revisar» = más reembolsos que líneas vendidas: las ventanas no coinciden, es una señal y no una tasa.':'Las líneas vendidas no están disponibles ahora; el dinero devuelto sí.'}</p></div>;
}

// ---- Expediente: qué se sabe | qué no se sabe
const orden=(o:Record<string,number>)=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
export function Expediente({v,sku,onPaquete}:{v:FugaVista;sku:string;onPaquete:(s:string)=>void}){
 const {fila,meses,tr}=datosSku(v,sku);
 if(!fila)return <Vacio>Elige un SKU de la tabla para ver su expediente.</Vacio>;
 const lineasOk=v.skus.status==='ok'&&v.skus.lineasStatus==='ok';
 const sabe:ReactNode[]=[
  <>{num(fila.n)} reembolsos por <b>{usd(fila.usdBrutoMinor)}</b> brutos ({usd(fila.usdNetoMinor)} sin cancelados): {fila.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${num(c.n)}`).join(' · ')}.</>,
  lineasOk&&fila.lineas!==null?<>Líneas vendidas en la ventana: {num(fila.lineas)}. {fila.n>fila.lineas?'Hay más reembolsos que líneas: la ventana de pedidos empieza después. Señal para investigar, no una tasa.':'Ventanas distintas por canal: no es una tasa.'}</>:<>Líneas vendidas: no disponibles ahora.</>,
 ];
 if(tr){
  sabe.push(<>Tracker de Excel: {num(Object.values(tr.hojas).reduce((a,n)=>a+n,0))} filas ({orden(tr.hojas).map(([h,n])=>`${HOJA_TXT[h]??h} ${num(n)}`).join(' · ')}).</>);
  if(Object.keys(tr.motivos).length)sabe.push(<>Motivo de contacto: {orden(tr.motivos).slice(0,4).map(([k,n])=>`${k} ${num(n)}`).join(' · ')}.</>);
  if(Object.keys(tr.estados).length)sabe.push(<>Estado de los solicitados: {orden(tr.estados).map(([k,n])=>`${ESTADO_TXT[k]??k} ${num(n)}`).join(' · ')}.</>);
  sabe.push(<>Conversaciones asociadas: {tr.vinculadas>0?`${num(tr.vinculadas)} filas del Tracker con ticket vinculado.`:'ninguna fila del Tracker de este SKU tiene ticket vinculado.'}</>);
 } else sabe.push(v.tracker.status==='unavailable'?<>Tracker: no disponible ahora.</>:<>Este SKU no aparece en el Tracker: sin expediente aún, solo reembolsos del libro. No hay motivo registrado.</>);
 const maxM=Math.max(1,...meses.map(m=>big(m.usdBrutoMinor)));
 return <div className="dg-fill">
  <div className="dg-dos">
   <div className="dg-caja"><h3>Qué se sabe</h3><ul>{sabe.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
   <div className="dg-caja" data-t="no"><h3>Qué no se sabe</h3><ul>{NO_SE_SABE.slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
  </div>
  {meses.length>0&&<div style={{marginTop:12}}><p className="dg-lab" style={{margin:'0 0 4px'}}><b>Reembolsos por mes y canal</b></p>
   <ListaBarras c={2} max={maxM} label={`Reembolsos de ${sku} por mes`} items={meses.slice(-6).map(m=>({key:m.mes+m.canal,c:cc(m.canal),etiqueta:`${mesCorto(m.mes)} · ${NOMBRE[m.canal]??m.canal}`,valor:big(m.usdBrutoMinor),texto:usd(m.usdBrutoMinor),sub2:`${num(m.n)} reembolsos`}))}/></div>}
  <div style={{marginTop:'auto',paddingTop:12}}><Button variant="primary" size="sm" icon={<Download/>} onClick={()=>onPaquete(sku)}>Paquete de evidencia para proveedor</Button></div>
 </div>;
}

// ---- Tracker: dinero negado o atorado
export function PanelTracker({v,onCola,onReintentar}:{v:FugaVista;onCola:()=>void;onReintentar:()=>void}){
 const t=v.tracker;
 if(t.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(t.status!=='ok')return <Vacio>No hay filas de reembolsos del Tracker cargadas.</Vacio>;
 const e=t.estados,ks=['reembolsado','vencido','no_reembolsable','rechazado','enviado','otro','sin_estado'].filter(k=>(e[k]??0)>0);
 return <div className="dg-fill">
  <BarraApilada label="Estado de las solicitudes de reembolso" items={ks.map(k=>({label:ESTADO_TXT[k]??k,value:e[k]}))}/>
  <ListaBarras c={4} label="Motivos con más solicitudes negadas" apilado max={Math.max(1,...t.porMotivo.map(m=>m.n))} items={[...t.porMotivo].sort((a,b)=>b.negados-a.negados).slice(0,4).map(m=>({key:m.motivo,etiqueta:m.motivo,sub:`${num(m.negados)} negadas de ${num(m.n)}`,valor:m.n,texto:num(m.n),sub2:m.montoMinor!==0?usd(m.montoMinor):undefined}))}/>
  <div style={{marginTop:'auto',paddingTop:10}}><Button size="sm" icon={<Download/>} onClick={onCola}>Cola de vencidos o negados (CSV)</Button></div></div>;
}

// ---- Contacto repetido
export function PanelRepetido({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 const c=v.contactoRepetido;
 if(c.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(c.status==='not_computed')return <Vacio>{c.note??'El resumen de contacto repetido todavía no se ha calculado.'}</Vacio>;
 if(c.status!=='ok')return <Vacio>No hay contactos con tickets vinculados para calcular repeticiones.</Vacio>;
 return <div className="dg-fill">
  <ListaBarras c={7} max={100} label="Contactos que repiten" items={[{key:'a',etiqueta:'2 o más veces en 90 días',sub:`${num(c.contactosDosOMas90)} de ${num(c.contactos)} contactos`,valor:c.pctDosOMas,texto:pct(c.pctDosOMas)},{key:'b',etiqueta:'3 o más veces',sub:`${num(c.contactosTresOMas90)} contactos`,valor:c.pctTresOMas,texto:pct(c.pctTresOMas)}]}/>
  {c.porCategoria.length>0&&<ListaBarras c={7} apilado label="Categorías con más repetición" max={Math.max(1,...c.porCategoria.map(x=>x.pct??0))} items={c.porCategoria.slice(0,4).map(x=>({key:x.categoria,etiqueta:<span>{etiquetaCategoria(x.categoria)}</span>,sub:`${num(x.repiten)} de ${num(x.clientes)} clientes`,valor:x.pct,texto:pct(x.pct)}))}/>}
  <p className="dg-pie">Resumen del {String(c.refreshedAt).slice(0,10)}. Categorías de la IA, solo conversaciones con extracción.</p></div>;
}

// ---- Qué cambió
export function PanelCambios({v}:{v:FugaVista}){
 const fr=frasesCambios(v),ex=excluidosTexto(v);
 if(!fr.length)return <Vacio>Todavía no hay dos meses completos y comparables para decir qué cambió.</Vacio>;
 return <div className="dg-fill"><ul className="ui-reset" style={{listStyle:'none',margin:0,padding:0,display:'grid',gap:8}}>{fr.map((f,i)=><li key={f.clave} className="dg-caja" style={{borderLeft:`3px solid ${color(i%2?1:2)}`}}><span className="dg-lab"><small style={{color:'var(--ink)',fontSize:13}}>{f.texto}</small></span></li>)}</ul>
  {ex.length>0&&<p className="dg-pie">No se usan como señal: {ex.join('; ')}.</p>}</div>;
}
