'use client';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import type {SkuFila} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {PageHeader} from '../ui/page-header';
import {Button,Download} from '../ui/button';
import {Card} from '../ui/card';
import {KpiStrip,type Kpi} from '../ui/kpi-strip';
import {MenuList,Popover} from '../ui/overlay';
import {ErrorState} from '../ui/error-state';
import {Loading} from '../ui/loading';
import {KindBadge} from '../ui/kind-badge';
import {Fila,MiniPct,Vacio} from '../dinero/partes';
import {NoDisponible} from './fuga-partes';
import {Estimador} from './fuga-estimador';
import {Expediente,IntensidadCanales,Pareto,PanelCambios,PanelRepetido,PanelTracker,TablaTop,corto,serieReembolsos} from './fuga-bloques';
import {endpointFuga,useFuga} from './use-fuga';
import {colaVencidos,listaWalmart,paqueteEvidencia,proveniencia,type Archivo} from './fuga-archivos.mjs';
import {fraseConcentracion,lineaCobertura,lineaVentanas,num,pct,periodoDelTitular,usd} from './fuga-modelo.mjs';
import '../dinero/dinero.css';
import './fuga.css';

/** Descarga local (Blob): no hay ninguna petición de red. */
export function bajar(a:Archivo){
 const url=URL.createObjectURL(new Blob([a.contenido],{type:a.mime})),el=document.createElement('a');
 el.href=url;el.download=a.nombre;el.rel='noopener';document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}

/** Pantalla «Fuga de reembolsos»: titular del periodo, KPI en color, Pareto top 10 con tabla, expediente por SKU (qué se sabe | qué no se sabe), Tracker, contacto repetido, qué cambió y estimador con supuestos. */
export function FugaPantalla({organization,embebido=false}:{organization?:string;/** Dentro del copiloto de negocio: sin PageHeader del espacio de trabajo; el h1 es el titular de la pantalla. */embebido?:boolean}){
 const sp=useSearchParams(),f=useFuga(endpointFuga(sp?.toString()));
 const per=f.data?periodoDelTitular(f.data):null;
 const [sel,setSel]=useState<string>(''),[aviso,setAviso]=useState('');
 const v=f.data;
 const top:SkuFila[]=v&&v.skus.status==='ok'?v.skus.top:[];
 const skuSel=sel&&top.some(r=>r.sku===sel)?sel:top[0]?.sku??'';
 const paquete=(sku:string)=>{
  if(!v)return;const p=paqueteEvidencia(v,sku);
  if(!p){setAviso('No se pudo armar el paquete de este SKU.');return;}
  bajar(p.html);setTimeout(()=>bajar(p.csv),400);
  setAviso(`Paquete de ${sku} descargado en tu equipo: ${p.html.nombre} y ${p.csv.nombre}. No se envió nada.`);
 };
 const lista=()=>{if(!v)return;const l=listaWalmart(v);bajar(l);setAviso(`Lista descargada: ${num(l.total)} SKUs de Walmart (${l.nombre}). No se envió nada.`);};
 const cola=()=>{if(!v)return;const c=colaVencidos(v);bajar(c);setAviso(`Cola descargada: ${num(c.total)} solicitudes (${c.nombre}). No se envió nada.`);};
 const t=v?.titular.status==='ok'?v.titular:null,tr=v?.tracker.status==='ok'?v.tracker:null,cr=v?.contactoRepetido.status==='ok'?v.contactoRepetido:null;
 const big=(m:string)=>Number(BigInt(m)/100n);
 const negMonto=tr?(tr.montoPorEstado.vencido??0)+(tr.montoPorEstado.no_reembolsable??0)+(tr.montoPorEstado.rechazado??0):0;
 const kpis:Kpi[]=v?[
  {label:'Dinero devuelto (periodo)',c:2,value:t?corto(big(t.usdBrutoMinor)):'—',spark:serieReembolsos(v),note:t?<><MiniPct c={2} p={t.usdBrutoMinor!=='0'?big(t.usdNetoMinor)*100/Math.max(1,big(t.usdBrutoMinor)):null} label="Parte sin reembolsos cancelados"/><span>Sin cancelados: {usd(t.usdNetoMinor)}</span></>:'No disponible ahora'},
  {label:'Reembolsos',c:2,value:t?num(t.n):'—',note:t?<><MiniPct c={2} p={t.n?(t.n-t.sinMonto)*100/t.n:null} label="Reembolsos con monto"/><span>{num(t.sinMonto)} sin monto (Amazon): cuentan, no suman</span></>:'No disponible ahora'},
  {label:'Dinero atorado',c:4,value:tr?corto(negMonto/100):'—',note:tr?<><MiniPct c={4} p={tr.filasReembolsos?tr.negados*100/tr.filasReembolsos:null} label="Solicitudes negadas o vencidas"/><span>{num(tr.negados)} de {num(tr.filasReembolsos)} solicitudes sin reembolsar</span></>:'Sin Tracker cargado'},
  {label:'Repetición de contacto',c:7,value:cr?pct(cr.pctDosOMas):'—',note:cr?<><MiniPct c={7} p={cr.pctDosOMas} label="Contactos que escriben 2 o más veces"/><span>{num(cr.contactosDosOMas90)} de {num(cr.contactos)} contactos en 90 días</span></>:'No calculado todavía'},
 ]:[];
 const titular=v&&t&&per?`${usd(t.usdBrutoMinor)} devueltos en ${per.etiqueta.charAt(0).toLowerCase()+per.etiqueta.slice(1)}${fraseConcentracion(v)?'. '+fraseConcentracion(v):'.'}`:null;
 const acciones=v&&<><Button variant="primary" icon={<Download/>} disabled={!skuSel} onClick={()=>paquete(skuSel)}>Generar paquete</Button>
  <Popover label="Más archivos" align="end" width={280} triggerClassName="btn btn-secondary" trigger={<><Download/><span className="btn-label">Exportar</span></>}>
   <MenuList>
    <li><Button size="sm" icon={<Download/>} disabled={v.skus.status!=='ok'} onClick={lista}>SKUs de Walmart (CSV)</Button></li>
    <li><Button size="sm" icon={<Download/>} disabled={!tr} onClick={cola}>Cola de vencidos o negados (CSV)</Button></li></MenuList></Popover></>;
 const cabecera=embebido?<header className="fg-embebido-head"><p className="cn-eyebrow">Dinero · tu copiloto de reembolsos</p><h1 className="cn-titular">Fuga de reembolsos</h1><p className="cn-fuente">Dónde se concentra el dinero devuelto y qué llevarte al proveedor o a Walmart.</p></header>
  :<PageHeader eyebrow={'Dinero'+(organization?' · datos sintéticos de demostración':'')} title="Fuga de reembolsos" description="Dónde se concentra el dinero devuelto, cuánto está atorado y qué llevarte a la reunión." actions={acciones}/>;
 return <div className="dg-page">
  {cabecera}
  {!v&&f.busy&&<Card><Loading message={f.segundos<8?'Calculando fuga…':`Calculando… ${f.segundos} s. Está tardando más de lo normal.`}/></Card>}
  {!v&&!f.busy&&f.error&&<Card><ErrorState title={f.error.code==='acceso'?'Tu rol no tiene acceso a este panel':'No disponible ahora'} body={f.error.texto} onRetry={f.error.code==='acceso'?undefined:()=>f.reload()}/></Card>}
  {v&&<>
   {v.titular.status==='unavailable'?<NoDisponible onRetry={()=>f.reload()}/>:titular?<p className="dg-titular">{titular}</p>:<Vacio>Sin libro de reembolsos cargado para este periodo. Carga el export de Amazon o Walmart para ver este número.</Vacio>}
   <KpiStrip items={kpis} label="Indicadores de fuga de reembolsos"/>
   <Fila split="8-4">
    <Card title="Dónde se fuga: los 10 SKUs" description="Dinero devuelto por SKU base, con % acumulado" actions={<KindBadge kind="observed"/>}><Pareto v={v} onReintentar={()=>f.reload()}/></Card>
    <Card title="Intensidad por canal" description="Reembolsos entre líneas vendidas, por mes" actions={<KindBadge kind="observed"/>}><IntensidadCanales v={v} onReintentar={()=>f.reload()}/></Card>
   </Fila>
   <Card title="Top 10 en detalle" description="Elige un SKU para abrir su expediente" actions={<KindBadge kind="observed"/>}><TablaTop v={v} sel={skuSel} onSel={setSel} onPaquete={paquete}/></Card>
   {skuSel&&<Fila split="6-6">
    <Card title={`Expediente de ${skuSel}`} description="Lo que se sabe y lo que no; nada se envía a nadie" actions={<KindBadge kind="observed"/>}><Expediente v={v} sku={skuSel} onPaquete={paquete}/></Card>
    <Card title="¿Cuánto podrías recuperar?" description="Estimador con candado: tú tecleas los supuestos" actions={<KindBadge kind="estimated"/>}><Estimador v={v}/></Card>
   </Fila>}
   <Fila split="4-4-4">
    <Card title="Dinero negado o atorado" description="Solicitudes del Tracker por estado" actions={<KindBadge kind="observed"/>}><PanelTracker v={v} onCola={cola} onReintentar={()=>f.reload()}/></Card>
    <Card title="Contacto repetido" description="Clientes que vuelven a escribir en 90 días" actions={<KindBadge kind="observed"/>}><PanelRepetido v={v} onReintentar={()=>f.reload()}/></Card>
    <Card title="Qué cambió" description="Solo meses completos y comparables" actions={<KindBadge kind="observed"/>}><PanelCambios v={v}/></Card>
   </Fila>
   <Card title="Cómo se calculó" description={`Corte: ${v.scope.dateStart||v.scope.dateEnd?`${v.scope.dateStart??'inicio'} a ${v.scope.dateEnd??'hoy'}`:'todo lo cargado'} · consulta del ${v.generatedAt.slice(0,10)}`}>
    <ul style={{margin:0,paddingLeft:18,fontSize:13,lineHeight:1.55,color:'var(--ui-secondary)',columns:2,columnGap:32}}>
     {per&&<li>Periodo: {per.etiqueta}{per.ventanas.length>0?` · Ventana por canal: ${per.ventanas.join(' · ')}`:''}.</li>}
     {per?.nota&&<li>{per.nota}</li>}
     {per?.acumulado&&<li>{per.acumulado.texto}</li>}
     {per?.acumuladoOmitido&&<li>El acumulado de todo el libro no se muestra junto a un periodo elegido. <a href="/refunds">Ver todo el libro</a></li>}
     <li>{lineaCobertura(v)}</li>
     <li>{lineaVentanas(v)}</li>
     {proveniencia(v).map((x,i)=><li key={i}>{x}</li>)}
     <li>Dinero devuelto: reembolsos del libro, última revisión de cada uno, en USD. «Bruto» incluye reembolsos cancelados. CAD y MXN nunca se suman.</li>
     <li>Lo que no se puede calcular hoy: tasa de reembolso por SKU o cohorte, margen o pérdida neta, causa raíz. Faltan cantidad por línea, un identificador común de pedido en Walmart y costo por SKU.</li></ul>
    <p className="dg-nota" role="status" aria-live="polite">{aviso}</p></Card>
  </>}
 </div>;
}
