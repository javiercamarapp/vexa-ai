'use client';
import {ConMarca} from '../ui/brand-mark';
import type {ReactNode} from 'react';
import {useIdioma,useT} from '../i18n/proveedor';
import {motivoEtiqueta} from '../../lib/legibilidad/motivos';
import type {FugaVista,SkuFila} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {Chip} from '../ui/chip';
import {DataTable,type Column} from '../ui/data-table';
import {Button,Download} from '../ui/button';
import {BarraApilada,color} from '../ui/mini-charts';
import {Leyenda,ListaBarras,Vacio} from '../dinero/partes';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import {NoDisponible,estadoTxt,hojaTxt,noSeSabeTxt} from './fuga-partes';
import {NOMBRE,frasesCambios,excluidosTexto,mesCorto,num,pct,usd} from './fuga-modelo.mjs';
import {datosSku} from './fuga-archivos.mjs';

const big=(m:string)=>Number(BigInt(m)/100n);
export const corto=(n:number)=>n>=1_000_000?`US$${(n/1_000_000).toFixed(2)}M`:n>=1000?`US$${Math.round(n/1000)}k`:`US$${n}`;
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
 const t=useT();
 if(v.skus.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 const top:SkuFila[]=v.skus.status==='ok'?v.skus.top:[];
 if(!top.length)return <Vacio>{t('tr.fuga.sinReembSku')}</Vacio>;
 const max=Math.max(1,...top.map(r=>big(r.usdBrutoMinor)));
 return <div className="dg-fill"><ListaBarras c={2} vw max={max} label={t('fuga.tablaSkusAria')} items={top.map(r=>({key:r.sku,etiqueta:`${r.pos}. ${r.sku}`,sub:r.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${num(c.n)}`).join(' · '),valor:big(r.usdBrutoMinor),texto:corto(big(r.usdBrutoMinor)),sub2:t('tr.fuga.acumulado',{pct:pct(r.acumPct)})}))}/>
  {v.skus.status==='ok'&&v.skus.top.length>0&&<p className="dg-nota">{t('tr.fuga.paretoNota',{a:top.length,b:num(v.skus.total??top.length)})}</p>}</div>;
}

// ---- Intensidad por canal (columnas finas por canal)
export function IntensidadCanales({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 const t=useT(),i=v.intensidad;
 if(i.status!=='ok')return <NoDisponible texto={t('tr.fuga.intensNoDisp')} onRetry={onReintentar}/>;
 const canales=Object.entries(i.canales);
 const todos=canales.flatMap(([,b])=>b.meses).filter(m=>!m.ultimo&&m.calidad!=='posible_hueco'&&m.intensidadPct!==null);
 const max=Math.max(1,...todos.map(m=>m.intensidadPct??0));
 const w=i.walmartSinCancelados,a=[...(i.canales.amazon?.meses??[])].reverse().find(m=>m.calidad==='completo'&&m.intensidadPct!==null);
 return <div className="dg-fill">
  <Leyenda items={[...canales.map(([c])=>({label:NOMBRE[c]??c,c:cc(c),integracion:c})),{label:t('tr.fuga.mesParcial'),hatch:true}]}/>
  {canales.map(([c,b])=>{const meses=b.meses.filter(m=>!m.ultimo);
   return <div key={c} style={{marginBottom:10,flex:'1 1 auto',display:'flex',flexDirection:'column'}}><p className="dg-lab" style={{margin:'0 0 4px'}}><b><ConMarca marca={c}>{NOMBRE[c]??c}</ConMarca></b></p>
    {!meses.length?<Vacio>{t('tr.fuga.sinMeses')}</Vacio>:
    <div className="dg-meses" style={{height:'auto',minHeight:120,flex:'1 1 auto',gridTemplateColumns:`repeat(${meses.length},minmax(0,1fr))`}} role="img" aria-label={t('tr.fuga.intensMensualAria',{canal:NOMBRE[c]??c,lista:meses.map(m=>`${mesCorto(m.mes)} ${m.intensidadPct===null?t('brechas.sinDato'):pct(m.intensidadPct)}`).join(', ')})}>
     {meses.map(m=><div key={m.mes} className="dg-mes" style={{gridTemplateRows:'14px 1fr 16px'}} data-q={m.calidad} title={t('tr.fuga.mesTitulo',{mes:mesCorto(m.mes),n:num(m.reembolsos),l:num(m.lineas),v:m.intensidadPct===null?t('brechas.sinDato'):pct(m.intensidadPct),extra:m.calidad==='parcial'?t('tr.fuga.extraParcial'):m.calidad==='posible_hueco'?t('tr.fuga.extraHueco'):''})}>
      <span className="dg-mes-v">{m.calidad==='posible_hueco'?'?':''}</span>
      <span className="dg-mes-a">{m.calidad!=='posible_hueco'&&m.intensidadPct!==null&&<i style={{height:Math.max(3,m.intensidadPct*100/max)+'%',background:color(cc(c)-1)}}/>}</span>
      <span className="dg-mes-m" style={{paddingTop:0}}>{mesCorto(m.mes).slice(0,3)}<small className="mv-valor">{m.calidad==='posible_hueco'||m.intensidadPct===null?t('tr.fuga.sd'):Math.round(m.intensidadPct)+'%'}</small></span></div>)}</div>}</div>;})}
  <p className="dg-nota">{w&&w.conPct!==null?t('tr.fuga.notaWalmart',{a:Math.round(w.conPct),l:100,pct:pct(w.sinPct),c:num(w.cancelados)}):''}{a?t('tr.fuga.notaAmazon',{a:Math.round(a.intensidadPct as number),mes:mesCorto(a.mes)}):''}{t('tr.fuga.notaFinal')}</p></div>;
}

// ---- Tabla top 10 con selector de expediente
export function TablaTop({v,sel,onSel,onPaquete}:{v:FugaVista;sel:string;onSel:(s:string)=>void;onPaquete:(s:string)=>void}){
 const t=useT(),top:SkuFila[]=v.skus.status==='ok'?v.skus.top:[];
 const lineasOk=v.skus.status==='ok'&&v.skus.lineasStatus==='ok';
 const cols:Column<SkuFila>[]=[
  {key:'p',header:'#',width:'44px',render:r=>r.pos},
  {key:'s',header:t('fuga.thSku'),render:r=><button type="button" className="dg-sku ui-reset" aria-pressed={sel===r.sku} aria-label={t('tr.fuga.verExpediente',{sku:r.sku})} onClick={()=>onSel(r.sku)}>{r.sku}</button>},
  {key:'c',header:t('fuga.thCanal'),render:r=><span style={{display:'inline-flex',gap:4,flexWrap:'wrap'}}>{r.canales.map(c=><Chip key={c.canal} categoria={cc(c.canal)}><ConMarca marca={c.canal}>{NOMBRE[c.canal]??c.canal}</ConMarca></Chip>)}</span>},
  {key:'d',header:t('tr.fuga.thDevuelto'),align:'num',render:r=>usd(r.usdBrutoMinor)},
  {key:'n',header:t('fuga.thReemb'),align:'num',render:r=>num(r.n)},
  {key:'l',header:t('fuga.thLineas'),align:'num',render:r=>r.lineas===null?'—':<>{num(r.lineas)}{r.n>r.lineas&&<> <Chip tone="warn">{t('fuga.revisar')}</Chip></>}</>},
  {key:'a',header:t('fuga.thAcum'),align:'num',render:r=>pct(r.acumPct)},
  {key:'x',header:t('tr.fuga.thExpediente'),render:r=><Button size="sm" variant={sel===r.sku?'primary':'secondary'} onClick={()=>onSel(r.sku)}>{sel===r.sku?t('tr.fuga.abierto'):t('tr.fuga.ver')}</Button>},
 ];
 void onPaquete;
 return <div className="dg-fill"><DataTable caption={t('fuga.tablaSkusAria')} columns={cols} rows={top} rowKey={r=>r.sku} maxHeight="none" empty={<Vacio>{t('tr.fuga.sinReembSku')}</Vacio>}/>
  <p className="dg-nota">{lineasOk?t('tr.fuga.notaRevisar'):t('fuga.pieLineasNo')}</p></div>;
}

// ---- Expediente: qué se sabe | qué no se sabe
const orden=(o:Record<string,number>)=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
export function Expediente({v,sku,onPaquete}:{v:FugaVista;sku:string;onPaquete:(s:string)=>void}){
 const t=useT(),{fila,meses,tr}=datosSku(v,sku);
 if(!fila)return <Vacio>{t('tr.fuga.eligeSku')}</Vacio>;
 const lineasOk=v.skus.status==='ok'&&v.skus.lineasStatus==='ok';
 const sabe:ReactNode[]=[
  <>{num(fila.n)} {t('tr.fuga.reembPor')} <b>{usd(fila.usdBrutoMinor)}</b> {t('tr.fuga.brutosSin',{neto:usd(fila.usdNetoMinor),lista:fila.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${num(c.n)}`).join(' · ')})}</>,
  lineasOk&&fila.lineas!==null?<>{t('tr.fuga.lineasVentana',{n:num(fila.lineas),canales:''})} {fila.n>fila.lineas?t('tr.fuga.masReembB'):t('tr.fuga.ventanasDist')}</>:<>{t('tr.fuga.lineasNoDisp')}</>,
 ];
 if(tr){
  sabe.push(<>{t('tr.fuga.trackerFilas',{n:num(Object.values(tr.hojas).reduce((a,n)=>a+n,0)),hojas:orden(tr.hojas).map(([h,n])=>`${hojaTxt(t,h)} ${num(n)}`).join(' · ')})}</>);
  if(Object.keys(tr.motivos).length)sabe.push(<>{t('tr.fuga.motivoContacto',{lista:orden(tr.motivos).slice(0,4).map(([k,n])=>`${motivoEtiqueta(k,t)} ${num(n)}`).join(' · ')})}.</>);
  if(Object.keys(tr.estados).length)sabe.push(<>{t('tr.fuga.estadoSolicB',{lista:orden(tr.estados).map(([k,n])=>`${estadoTxt(t,k)} ${num(n)}`).join(' · ')})}</>);
  sabe.push(<>{t('tr.fuga.convAsoc',{x:tr.vinculadas>0?t('tr.fuga.vincNB',{n:num(tr.vinculadas)}):t('tr.fuga.vincNingB')})}</>);
 } else sabe.push(v.tracker.status==='unavailable'?<>{t('fuga.trackerNoDisp')}</>:<>{t('tr.fuga.trackerSinSkuB')}</>);
 const maxM=Math.max(1,...meses.map(m=>big(m.usdBrutoMinor)));
 return <div className="dg-fill">
  <div className="dg-dos">
   <div className="dg-caja"><h3>{t('fuga.queSabe')}</h3><ul>{sabe.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
   <div className="dg-caja" data-t="no"><h3>{t('fuga.queNoSabe')}</h3><ul>{noSeSabeTxt(t).slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
  </div>
  {meses.length>0&&<div style={{marginTop:12}}><p className="dg-lab" style={{margin:'0 0 4px'}}><b>{t('fuga.reembMes')}</b></p>
   <ListaBarras c={2} vw max={maxM} label={t('tr.fuga.reembDeSku',{sku})} items={meses.slice(-6).map(m=>({key:m.mes+m.canal,c:cc(m.canal),etiqueta:`${mesCorto(m.mes)} · ${NOMBRE[m.canal]??m.canal}`,valor:big(m.usdBrutoMinor),texto:usd(m.usdBrutoMinor),sub2:t('tr.fuga.nReembolsos',{n:num(m.n)})}))}/></div>}
  <div style={{marginTop:'auto',paddingTop:12}}><Button variant="primary" size="sm" icon={<Download/>} onClick={()=>onPaquete(sku)}>{t('fuga.paqueteProv')}</Button></div>
 </div>;
}

// ---- Tracker: dinero negado o atorado
export function PanelTracker({v,onCola,onReintentar}:{v:FugaVista;onCola:()=>void;onReintentar:()=>void}){
 const tx=useT(),t=v.tracker;
 if(t.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(t.status!=='ok')return <Vacio>{tx('tr.fuga.sinFilasTrk')}</Vacio>;
 const e=t.estados,ks=['reembolsado','vencido','no_reembolsable','rechazado','enviado','otro','sin_estado'].filter(k=>(e[k]??0)>0);
 return <div className="dg-fill">
  <BarraApilada label={tx('tr.fuga.estadoSolic')} items={ks.map(k=>({label:estadoTxt(tx,k),value:e[k]}))}/>
  <ListaBarras c={4} label={tx('tr.fuga.motivosNegadas')} apilado max={Math.max(1,...t.porMotivo.map(m=>m.n))} items={[...t.porMotivo].sort((a,b)=>b.negados-a.negados).slice(0,4).map(m=>({key:m.motivo,etiqueta:motivoEtiqueta(m.motivo,tx),sub:tx('tr.fuga.negadasDe',{a:num(m.negados),b:num(m.n)}),valor:m.n,texto:num(m.n),sub2:m.montoMinor!==0?usd(m.montoMinor):undefined}))}/>
  <div style={{marginTop:'auto',paddingTop:10}}><Button size="sm" icon={<Download/>} onClick={onCola}>{tx('fuga.colaVencidos')}</Button></div></div>;
}

// ---- Contacto repetido
export function PanelRepetido({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 const t=useT(),c=v.contactoRepetido;
 if(c.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(c.status==='not_computed')return <Vacio>{c.note??t('fuga.repNoCalc')}</Vacio>;
 if(c.status!=='ok')return <Vacio>{t('fuga.repSinTickets')}</Vacio>;
 return <div className="dg-fill">
  <ListaBarras c={7} vw max={100} label={t('tr.fuga.contactosRepiten')} items={[{key:'a',etiqueta:t('tr.fuga.vecesEn',{k:2,d:90}),sub:t('tr.fuga.deContactos',{a:num(c.contactosDosOMas90),b:num(c.contactos)}),valor:c.pctDosOMas,texto:pct(c.pctDosOMas)},{key:'b',etiqueta:t('tr.fuga.masVeces',{k:3}),sub:t('tr.fuga.nContactos',{n:num(c.contactosTresOMas90)}),valor:c.pctTresOMas,texto:pct(c.pctTresOMas)}]}/>
  {c.porCategoria.length>0&&<ListaBarras c={7} apilado label={t('fuga.repCategorias')} max={Math.max(1,...c.porCategoria.map(x=>x.pct??0))} items={c.porCategoria.slice(0,4).map(x=>({key:x.categoria,etiqueta:<span>{etiquetaCategoria(x.categoria,t)}</span>,sub:t('tr.fuga.deClientes',{a:num(x.repiten),b:num(x.clientes)}),valor:x.pct,texto:pct(x.pct)}))}/>}
  <p className="dg-pie">{t('tr.fuga.repPie',{fecha:String(c.refreshedAt).slice(0,10)})}</p></div>;
}

// ---- Qué cambió
export function PanelCambios({v}:{v:FugaVista}){
 const t=useT(),idioma=useIdioma(),fr=frasesCambios(v,idioma),ex=excluidosTexto(v,idioma);
 if(!fr.length)return <Vacio>{t('fuga.cambiosVacio')}</Vacio>;
 return <div className="dg-fill"><ul className="ui-reset" style={{listStyle:'none',margin:0,padding:0,display:'grid',gap:8,flex:'1 1 auto',gridAutoRows:'1fr'}}>{fr.map((f,i)=><li key={f.clave} className="dg-caja" style={{borderLeft:`3px solid ${color(i%2?1:2)}`,display:'flex',alignItems:'center'}}><span className="dg-lab"><small style={{color:'var(--ink)',fontSize:13}}>{f.texto}</small></span></li>)}</ul>
  {ex.length>0&&<p className="dg-pie">{t('fuga.noSeUsan',{x:ex.join('; ')})}</p>}</div>;
}
