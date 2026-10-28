'use client';
import {useT} from '../i18n/proveedor';
import {RovaqCargando} from '../rovaq-cargando';
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
 const tx=useT(),sp=useSearchParams(),f=useFuga(endpointFuga(sp?.toString()));
 const per=f.data?periodoDelTitular(f.data):null;
 const [sel,setSel]=useState<string>(''),[aviso,setAviso]=useState('');
 const v=f.data;
 const top:SkuFila[]=v&&v.skus.status==='ok'?v.skus.top:[];
 const skuSel=sel&&top.some(r=>r.sku===sel)?sel:top[0]?.sku??'';
 const paquete=(sku:string)=>{
  if(!v)return;const p=paqueteEvidencia(v,sku);
  if(!p){setAviso(tx('fuga.noPaquete'));return;}
  bajar(p.html);setTimeout(()=>bajar(p.csv),400);
  setAviso(tx('fuga.paqueteDesc',{sku,html:p.html.nombre,csv:p.csv.nombre}));
 };
 const lista=()=>{if(!v)return;const l=listaWalmart(v);bajar(l);setAviso(tx('fuga.listaDesc',{n:num(l.total),nombre:l.nombre}));};
 const cola=()=>{if(!v)return;const c=colaVencidos(v);bajar(c);setAviso(tx('fuga.colaDesc',{n:num(c.total),nombre:c.nombre}));};
 const t=v?.titular.status==='ok'?v.titular:null,tr=v?.tracker.status==='ok'?v.tracker:null,cr=v?.contactoRepetido.status==='ok'?v.contactoRepetido:null;
 const big=(m:string)=>Number(BigInt(m)/100n);
 const negMonto=tr?(tr.montoPorEstado.vencido??0)+(tr.montoPorEstado.no_reembolsable??0)+(tr.montoPorEstado.rechazado??0):0;
 const kpis:Kpi[]=v?[
  {label:tx('fuga.kDevuelto'),c:2,value:t?corto(big(t.usdBrutoMinor)):'—',spark:serieReembolsos(v),note:t?<><MiniPct c={2} p={t.usdBrutoMinor!=='0'?big(t.usdNetoMinor)*100/Math.max(1,big(t.usdBrutoMinor)):null} label={tx('fuga.parteSinCancel')}/><span>{tx('fuga.sinCancelados',{x:usd(t.usdNetoMinor)})}</span></>:tx('fuga.noDisp')},
  {label:tx('fuga.kReembolsos'),c:2,value:t?num(t.n):'—',note:t?<><MiniPct c={2} p={t.n?(t.n-t.sinMonto)*100/t.n:null} label={tx('fuga.reembConMonto')}/><span>{tx('fuga.sinMontoAmazon',{n:num(t.sinMonto)})}</span></>:tx('fuga.noDisp')},
  {label:tx('fuga.kAtorado'),c:4,value:tr?corto(negMonto/100):'—',note:tr?<><MiniPct c={4} p={tr.filasReembolsos?tr.negados*100/tr.filasReembolsos:null} label={tx('fuga.negadasAria')}/><span>{tx('fuga.solSinReemb',{a:num(tr.negados),b:num(tr.filasReembolsos)})}</span></>:tx('fuga.sinTracker')},
  {label:tx('fuga.kRepeticion'),c:7,value:cr?pct(cr.pctDosOMas):'—',note:cr?<><MiniPct c={7} p={cr.pctDosOMas} label={tx('fuga.contactosAria')}/><span>{tx('fuga.contactos90',{a:num(cr.contactosDosOMas90),b:num(cr.contactos)})}</span></>:tx('fuga.noCalculado')},
 ]:[];
 const titular=v&&t&&per?tx('fuga.titular',{usd:usd(t.usdBrutoMinor),periodo:per.etiqueta.charAt(0).toLowerCase()+per.etiqueta.slice(1),frase:fraseConcentracion(v)?'. '+fraseConcentracion(v):'.'}):null;
 const acciones=v&&<><Button variant="primary" icon={<Download/>} disabled={!skuSel} onClick={()=>paquete(skuSel)}>{tx('fuga.generarPaquete')}</Button>
  <Popover label={tx('fuga.masArchivos')} align="end" width={280} triggerClassName="btn btn-secondary" trigger={<><Download/><span className="btn-label">{tx('fuga.exportar')}</span></>}>
   <MenuList>
    <li><Button size="sm" icon={<Download/>} disabled={v.skus.status!=='ok'} onClick={lista}>{tx('fuga.skusWalmart')}</Button></li>
    <li><Button size="sm" icon={<Download/>} disabled={!tr} onClick={cola}>{tx('fuga.colaVencidos')}</Button></li></MenuList></Popover></>;
 const cabecera=embebido?<header className="fg-embebido-head"><p className="cn-eyebrow">{tx('fuga.embEyebrow')}</p><h1 className="cn-titular">{tx('fuga.titulo')}</h1><p className="cn-fuente">{tx('fuga.embDesc')}</p></header>
  :<PageHeader eyebrow={tx('fuga.eyebrow')+(organization?tx('fuga.sintetico'):'')} title={tx('fuga.titulo')} description={tx('fuga.desc')} actions={acciones}/>;
 if(!v&&f.busy)return <RovaqCargando mensaje=""/>;
 return <div className="dg-page">
  {cabecera}
  {!v&&f.busy&&<Card><Loading message={f.segundos<8?tx('fuga.calculando'):tx('fuga.calculandoLento',{s:f.segundos})}/></Card>}
  {!v&&!f.busy&&f.error&&<Card><ErrorState title={f.error.code==='acceso'?tx('vista.sinAcceso'):tx('vista.noDisponible')} body={f.error.texto} onRetry={f.error.code==='acceso'?undefined:()=>f.reload()}/></Card>}
  {v&&<>
   {v.titular.status==='unavailable'?<NoDisponible onRetry={()=>f.reload()}/>:titular?<p className="dg-titular">{titular}</p>:<Vacio>{tx('fuga.sinLibro')}</Vacio>}
   <KpiStrip items={kpis} label={tx('fuga.kpisAria')}/>
   <Fila split="8-4">
    <Card title={tx('fuga.cDonde')} description={tx('fuga.cDondeD')} actions={<KindBadge kind="observed"/>}><Pareto v={v} onReintentar={()=>f.reload()}/></Card>
    <Card title={tx('fuga.cIntensidad')} description={tx('fuga.cIntensidadD')} actions={<KindBadge kind="observed"/>}><IntensidadCanales v={v} onReintentar={()=>f.reload()}/></Card>
   </Fila>
   <Card title={tx('fuga.cTop')} description={tx('fuga.cTopD')} actions={<KindBadge kind="observed"/>}><TablaTop v={v} sel={skuSel} onSel={setSel} onPaquete={paquete}/></Card>
   {skuSel&&<Fila split="6-6">
    <Card title={tx('fuga.cExpediente',{sku:skuSel})} description={tx('fuga.cExpedienteD')} actions={<KindBadge kind="observed"/>}><Expediente v={v} sku={skuSel} onPaquete={paquete}/></Card>
    <Card title={tx('fuga.cRecuperar')} description={tx('fuga.cRecuperarD')} actions={<KindBadge kind="estimated"/>}><Estimador v={v}/></Card>
   </Fila>}
   <Fila split="4-4-4">
    <Card title={tx('fuga.cNegado')} description={tx('fuga.cNegadoD')} actions={<KindBadge kind="observed"/>}><PanelTracker v={v} onCola={cola} onReintentar={()=>f.reload()}/></Card>
    <Card title={tx('fuga.cRepetido')} description={tx('fuga.cRepetidoD')} actions={<KindBadge kind="observed"/>}><PanelRepetido v={v} onReintentar={()=>f.reload()}/></Card>
    <Card title={tx('fuga.cCambio')} description={tx('fuga.cCambioD')} actions={<KindBadge kind="observed"/>}><PanelCambios v={v}/></Card>
   </Fila>
   <Card title={tx('fuga.cComo')} description={tx('fuga.corte',{rango:v.scope.dateStart||v.scope.dateEnd?tx('fuga.rangoDe',{a:v.scope.dateStart??tx('fuga.inicio'),b:v.scope.dateEnd??tx('fuga.hoy')}):tx('fuga.todoCargado'),fecha:v.generatedAt.slice(0,10)})}>
    <ul style={{margin:0,paddingLeft:18,fontSize:13,lineHeight:1.55,color:'var(--ui-secondary)',columns:2,columnGap:32}}>
     {per&&<li>{tx('fuga.periodoL',{p:per.etiqueta})}{per.ventanas.length>0?tx('fuga.ventanaCanal',{v:per.ventanas.join(' · ')}):''}.</li>}
     {per?.nota&&<li>{per.nota}</li>}
     {per?.acumulado&&<li>{per.acumulado.texto}</li>}
     {per?.acumuladoOmitido&&<li>{tx('fuga.acumOmitido')} <a href="/refunds">{tx('fuga.verTodoLibro')}</a></li>}
     <li>{lineaCobertura(v)}</li>
     <li>{lineaVentanas(v)}</li>
     {proveniencia(v).map((x,i)=><li key={i}>{x}</li>)}
     <li>{tx('fuga.dineroDevuelto')}</li>
     <li>{tx('fuga.noCalcula')}</li></ul>
    <p className="dg-nota" role="status" aria-live="polite">{aviso}</p></Card>
  </>}
 </div>;
}
