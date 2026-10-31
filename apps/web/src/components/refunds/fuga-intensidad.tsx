'use client';
import {ConMarca} from '../ui/brand-mark';
import {useIdioma,useT} from '../i18n/proveedor';
import type {FugaVista,MesIntensidad} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {NOMBRE,mesCorto,num,pct} from './fuga-modelo.mjs';
import {NoDisponible,Vacio} from './fuga-partes';
import './fuga.css';

const COLOR:Record<string,string>={walmart:'var(--fg-walmart)',amazon:'var(--fg-amazon)'};
/** Columnas mensuales de intensidad (reembolsos del mes / líneas del mes) de un canal. Parcial = rayado; posible hueco = sin columna y marca «?». */
function Canal({canal,todos,max}:{canal:string;todos:MesIntensidad[];max:number}){
 const t=useT(),idioma=useIdioma();
 // El último mes con datos puede estar cortado (pocas líneas, mucha intensidad aparente): no se dibuja, pero sigue en la tabla.
 const meses=todos.filter(m=>!m.ultimo);
 const ultimoCompleto=[...meses].reverse().find(m=>m.calidad==='completo'&&m.intensidadPct!==null);
 const pico=meses.filter(m=>m.calidad==='completo'&&m.intensidadPct!==null).sort((a,b)=>(b.intensidadPct??0)-(a.intensidadPct??0))[0];
 if(!meses.length)return <div className="fg-canal"><h3><ConMarca marca={canal}>{NOMBRE[canal]}</ConMarca></h3><Vacio>{t('tr.fuga.sinMeses')}</Vacio></div>;
 return <div className="fg-canal"><h3><ConMarca marca={canal}>{NOMBRE[canal]??canal}</ConMarca></h3>
  <div className="fg-cols" style={{gridTemplateColumns:`repeat(${meses.length},minmax(0,1fr))`}} role="img" aria-label={t('tr.fuga.intensMensualAria',{canal:NOMBRE[canal]??canal,lista:meses.map(m=>`${mesCorto(m.mes,idioma)} ${m.intensidadPct===null?t('brechas.sinDato'):pct(m.intensidadPct)}${m.calidad==='completo'?'':m.calidad==='parcial'?t('tr.fuga.parcialAria'):t('tr.fuga.huecoAria')}`).join(', ')})}>
   {meses.map(m=>{
    const h=m.intensidadPct===null?0:Math.max(2,(m.intensidadPct/max)*100),etiqueta=m===ultimoCompleto||m===pico;
    return <div key={m.mes} className="fg-col" data-q={m.calidad} title={t('tr.fuga.mesTitulo',{mes:mesCorto(m.mes,idioma),n:num(m.reembolsos),l:num(m.lineas),v:m.intensidadPct===null?t('brechas.sinDato'):pct(m.intensidadPct),extra:m.calidad==='parcial'?t('tr.fuga.extraParcial'):m.calidad==='posible_hueco'?t('tr.fuga.extraHueco'):''})}>
     <span className="fg-col-v">{m.calidad==='posible_hueco'?'?':etiqueta&&m.intensidadPct!==null?pct(m.intensidadPct):''}</span>
     <span className="fg-col-area">{m.calidad!=='posible_hueco'&&<i style={{height:h+'%',background:COLOR[canal]??'var(--fg-otro)'}}/>}</span>
     <span className="fg-col-m">{mesCorto(m.mes,idioma).slice(0,3)}{m.mes.endsWith('-01')||m===meses[0]?<small>{m.mes.slice(2,4)}</small>:null}</span>
    </div>;})}
  </div>
  {todos.length>meses.length&&<p className="fg-sm">{t('tr.fuga.noDibuja',{mes:mesCorto(todos.at(-1)!.mes,idioma)})}</p>}
  <details className="fg-mini"><summary>{t('tr.fuga.verNumeros',{canal:NOMBRE[canal]??canal})}</summary>
   <table aria-label={t('tr.fuga.tablaMesCanal')}><thead><tr><th scope="col">{t('fuga.thMes')}</th><th scope="col" className="fg-r">{t('fuga.thReemb')}</th><th scope="col" className="fg-r">{t('tr.fuga.thLineasC')}</th><th scope="col" className="fg-r">{t('tr.fuga.thIntensidad')}</th><th scope="col">{t('tr.fuga.thCalidad')}</th></tr></thead>
    <tbody>{todos.map(m=><tr key={m.mes}><td>{mesCorto(m.mes,idioma)}</td><td className="fg-r">{num(m.reembolsos)}</td><td className="fg-r">{num(m.lineas)}</td><td className="fg-r">{pct(m.intensidadPct)}</td><td>{m.calidad==='completo'?t('tr.fuga.calCompleto'):m.calidad==='parcial'?t('tr.fuga.calParcial'):t('tr.fuga.calHueco')}</td></tr>)}</tbody></table></details>
 </div>;
}
export function SeccionIntensidad({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 const t=useT(),idioma=useIdioma(),i=v.intensidad;
 if(i.status!=='ok')return <NoDisponible texto={t('tr.fuga.intensNoDisp2')} onRetry={onReintentar}/>;
 const todos=Object.values(i.canales).flatMap(c=>c.meses).filter(m=>!m.ultimo&&m.calidad!=='posible_hueco'&&m.intensidadPct!==null);
 const max=Math.max(1,...todos.map(m=>m.intensidadPct??0));
 const w=i.walmartSinCancelados;
 const ultW=(i.canales.walmart?.meses??[]).filter(m=>!m.ultimo);
 return <div>
  {(()=>{
   const a=[...(i.canales.amazon?.meses??[])].reverse().find(m=>m.calidad==='completo'&&m.intensidadPct!==null);
   const partes:string[]=[];
   if(ultW.length&&w&&w.conPct!==null)partes.push(t('tr.fuga.walmartFrase',{a:mesCorto(ultW[0].mes,idioma),b:mesCorto(ultW[ultW.length-1].mes,idioma),l:100,n:Math.round(w.conPct),pct:pct(w.sinPct),c:num(w.cancelados)}));
   if(a)partes.push(t(partes.length?'tr.fuga.amazonSig':'tr.fuga.amazonPrim',{n:Math.round(a.intensidadPct as number),mes:mesCorto(a.mes,idioma)}));
   return partes.length?<p className="fg-frase">{partes.join('; ')}.</p>:null;})()}
  <ul className="fg-leyenda"><li><i style={{background:COLOR.walmart}}/><ConMarca marca="walmart">Walmart</ConMarca></li><li><i style={{background:COLOR.amazon}}/><ConMarca marca="amazon">Amazon</ConMarca></li><li><i className="fg-hatch"/>{t('tr.fuga.mesParcial')}</li><li><b>?</b> {t('tr.fuga.huecoSinCol')}</li></ul>
  <div className="fg-canales">{Object.entries(i.canales).map(([c,b])=><Canal key={c} canal={c} todos={b.meses} max={max}/>)}</div>
  <p className="fg-aviso">{t('tr.fuga.avisoIntens')}{i.bestBuy.reembolsosEnElLibro===0?t('tr.fuga.bestBuyNo'):''}</p>
 </div>;
}
