'use client';
import {Fragment,useId} from 'react';
import type {ReactNode} from 'react';
import type {FugaVista,SkuFila} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {KindBadge} from '../ui/kind-badge';
import {Button,Download,Refresh} from '../ui/button';
import {Icon} from '../ui/icons';
import {ESTADO_TXT,HOJA_TXT,NOMBRE,frasesCambios,excluidosTexto,mesCorto,num,pct,usd} from './fuga-modelo.mjs';
import {datosSku,NO_SE_SABE} from './fuga-archivos.mjs';
import './fuga.css';

type Kind='observed'|'estimated'|'inferred';
/** Sección con título, clase de la cifra y una línea de contexto. */
export function Seccion({id,titulo,kind,intro,children,accion}:{id:string;titulo:string;kind?:Kind;intro?:ReactNode;children:ReactNode;accion?:ReactNode}){
 return <section className="card fg-sec" aria-labelledby={id}>
  <div className="card-head"><div><h2 id={id}>{titulo}</h2>{intro&&<p className="card-lead fg-intro">{intro}</p>}</div><div className="fg-head-r">{kind&&<KindBadge kind={kind}/>}{accion}</div></div>
  {children}
 </section>;
}
/** Una parte que no respondió: nunca un 0. */
export function NoDisponible({texto='No disponible ahora. No es cero: la consulta no respondió a tiempo.',onRetry}:{texto?:string;onRetry?:()=>void}){
 return <div className="fg-vacio" role="status"><Icon name="clock" size={18}/><p>{texto}</p>{onRetry&&<Button size="sm" icon={<Refresh/>} onClick={onRetry}>Reintentar</Button>}</div>;
}
export const Vacio=({children}:{children:ReactNode})=><div className="fg-vacio" role="status"><Icon name="info" size={18}/><p>{children}</p></div>;

const CANAL_VAR:Record<string,string>={walmart:'var(--fg-walmart)',amazon:'var(--fg-amazon)',shopify:'var(--fg-otro)',bestbuy:'var(--fg-otro)'};
export function LeyendaCanales({canales}:{canales:string[]}){
 return <ul className="fg-leyenda" aria-label="Canales">{canales.map(c=><li key={c}><i style={{background:CANAL_VAR[c]??'var(--fg-otro)'}}/>{NOMBRE[c]??c}</li>)}</ul>;
}

// ---- S2: tabla SKU × canal con expediente en la fila ----
export function TablaSkus({v,abierto,onAbrir,onPaquete}:{v:FugaVista;abierto:string|null;onAbrir:(s:string|null)=>void;onPaquete:(sku:string)=>void}){
 const top:SkuFila[]=v.skus.status==='ok'?v.skus.top:[];
 const max=Math.max(1,...top.map(r=>Number(BigInt(r.usdBrutoMinor)/100n)));
 const canales=[...new Set(top.flatMap(r=>r.canales.map(c=>c.canal)))];
 const lineasOk=v.skus.status==='ok'&&v.skus.lineasStatus==='ok';
 const uid=useId();
 return <div>
  <LeyendaCanales canales={canales}/>
  <div className="fg-tabla-wrap" role="region" aria-label="Los 10 SKUs que concentran el dinero devuelto" tabIndex={0}>
   <table className="fg-tabla">
    <thead><tr><th scope="col" className="fg-n fg-hide-sm">#</th><th scope="col">SKU</th><th scope="col" className="fg-bar-col">Dinero devuelto (USD bruto)</th><th scope="col" className="fg-r fg-hide-sm">Reembolsos</th><th scope="col" className="fg-r fg-hide-sm">Líneas vendidas</th><th scope="col" className="fg-r fg-hide-sm">% acumulado</th></tr></thead>
    <tbody>{top.map(r=>{
     const abre=abierto===r.sku,rid=`${uid}-${r.pos}`,usdN=Number(BigInt(r.usdBrutoMinor)/100n);
     const masReembolsosQueLineas=r.lineas!==null&&r.n>r.lineas;
     return <Fragment key={r.sku}>
      <tr data-open={abre||undefined}>
       <td className="fg-n fg-hide-sm">{r.pos}</td>
       <th scope="row"><button type="button" className="fg-sku" aria-expanded={abre} aria-controls={rid} onClick={()=>onAbrir(abre?null:r.sku)}><Icon name={abre?'chevron-down':'chevron-right'} size={14}/><span><b>{r.sku}</b><small>{r.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${num(c.n)}`).join(' · ')}</small></span></button></th>
       <td className="fg-bar-col"><div className="fg-bar" role="img" aria-label={`${r.sku}: ${usd(r.usdBrutoMinor)} en ${r.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${usd(c.usdBrutoMinor)}`).join(', ')}`}>
         <span className="fg-bar-track"><span className="fg-bar-fill" style={{width:Math.max(1.5,usdN*100/max)+'%'}}>{r.canales.map(c=><i key={c.canal} style={{flexGrow:Number(BigInt(c.usdBrutoMinor)/100n)||1,background:CANAL_VAR[c.canal]??'var(--fg-otro)'}}/>)}</span></span><b>{usd(r.usdBrutoMinor)}</b></div></td>
       <td className="fg-r fg-hide-sm">{num(r.n)}</td>
       <td className="fg-r fg-hide-sm">{r.lineas===null?<span title="No disponible ahora">—</span>:<>{num(r.lineas)}{masReembolsosQueLineas&&<span className="fg-senal" title="Hay más reembolsos que líneas vendidas en la ventana: las ventanas son distintas, es una señal para investigar, no una tasa.">revisar</span>}</>}</td>
       <td className="fg-r fg-hide-sm">{pct(r.acumPct)}</td>
      </tr>
      {abre&&<tr className="fg-exp" id={rid}><td colSpan={6}><Expediente v={v} sku={r.sku} lineasOk={lineasOk} onPaquete={onPaquete}/></td></tr>}
     </Fragment>;})}</tbody>
   </table>
  </div>
  <p className="fg-pie">{lineasOk?'Líneas vendidas = filas de pedidos del mismo SKU en la ventana de cada canal. La marca «revisar» indica más reembolsos que líneas: las ventanas no coinciden, no es una tasa.':'Las líneas vendidas no están disponibles ahora; el dinero devuelto sí.'}</p>
 </div>;
}

function Lista({titulo,items,tono}:{titulo:string;items:ReactNode[];tono?:'no'}){
 return <div className="fg-lista" data-tono={tono}><h4>{titulo}</h4><ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul></div>;
}
const orden=(o:Record<string,number>)=>Object.entries(o).sort((a,b)=>b[1]-a[1]);

// ---- S5: expediente del SKU ----
export function Expediente({v,sku,lineasOk,onPaquete}:{v:FugaVista;sku:string;lineasOk:boolean;onPaquete:(sku:string)=>void}){
 const {fila,meses,tr}=datosSku(v,sku);
 if(!fila)return null;
 const trackerEstado=v.tracker.status;
 const sabe:ReactNode[]=[
  <>{num(fila.n)} reembolsos por <b>{usd(fila.usdBrutoMinor)}</b> brutos ({usd(fila.usdNetoMinor)} sin cancelados): {fila.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${num(c.n)}`).join(' · ')}.</>,
  lineasOk&&fila.lineas!==null?<>Líneas vendidas en la ventana: {num(fila.lineas)}{fila.canales.length>1?fila.canales.map(c=>c.lineas===null?'':` · ${NOMBRE[c.canal]??c.canal} ${num(c.lineas)}`).join(''):''}. {fila.n>fila.lineas?'Hay más reembolsos que líneas: la ventana de pedidos empieza después que la de reembolsos. Es una señal para investigar, no una tasa.':'Ventanas distintas por canal: no es una tasa.'}</>:<>Líneas vendidas: no disponibles ahora.</>,
 ];
 if(tr){
  sabe.push(<>Tracker de Excel: {num(Object.values(tr.hojas).reduce((a,n)=>a+n,0))} filas ({orden(tr.hojas).map(([h,n])=>`${HOJA_TXT[h]??h} ${num(n)}`).join(' · ')}).</>);
  if(Object.keys(tr.motivos).length)sabe.push(<>Motivo de contacto: {orden(tr.motivos).slice(0,4).map(([k,n])=>`${k} ${num(n)}`).join(' · ')}{Object.keys(tr.submotivos).length?`. Subrazón: ${orden(tr.submotivos).slice(0,3).map(([k,n])=>`${k} ${num(n)}`).join(' · ')}`:''}.</>);
  if(Object.keys(tr.estados).length)sabe.push(<>Estado de los reembolsos solicitados: {orden(tr.estados).map(([k,n])=>`${ESTADO_TXT[k]??k} ${num(n)}`).join(' · ')}.</>);
  sabe.push(<>Conversaciones asociadas: {tr.vinculadas>0?`${num(tr.vinculadas)} filas del Tracker tienen un ticket vinculado a una conversación.`:'ninguna fila del Tracker de este SKU tiene un ticket vinculado.'}</>);
 } else sabe.push(trackerEstado==='unavailable'?<>Tracker: no disponible ahora.</>:<>Este SKU no aparece en el Tracker; solo hay reembolsos del libro. No hay motivo registrado.</>);
 return <div className="fg-exped">
  <div className="fg-exped-head"><div><h3>Expediente de {sku}</h3><p>Lo que se sabe y lo que no. Todo es consulta de lo cargado; nada se envía a nadie.</p></div>
   <Button variant="primary" size="sm" icon={<Download/>} onClick={()=>onPaquete(sku)}>Paquete de evidencia para proveedor</Button></div>
  <div className="fg-exped-grid">
   <Lista titulo="Qué se sabe" items={sabe}/>
   <Lista titulo="Qué no se sabe" tono="no" items={NO_SE_SABE.slice(0,4)}/>
  </div>
  {meses.length>0&&<details className="fg-mini"><summary>Reembolsos por mes y canal</summary><table><thead><tr><th scope="col">Mes</th><th scope="col">Canal</th><th scope="col" className="fg-r">Reembolsos</th><th scope="col" className="fg-r">USD bruto</th></tr></thead>
   <tbody>{meses.map(m=><tr key={m.mes+m.canal}><td>{mesCorto(m.mes)}</td><td>{NOMBRE[m.canal]??m.canal}</td><td className="fg-r">{num(m.n)}</td><td className="fg-r">{usd(m.usdBrutoMinor)}</td></tr>)}</tbody></table></details>}
 </div>;
}

// ---- S4: dinero negado o atorado (Tracker) ----
const ESTADO_COLOR:Record<string,string>={reembolsado:'var(--kind-observed)',vencido:'var(--cov-rej)',no_reembolsable:'var(--fg-neg-2)',rechazado:'var(--fg-neg-3)',enviado:'var(--cov-pen)',otro:'var(--fg-otro)',sin_estado:'var(--fg-otro)'};
export function SeccionTracker({v,onCola,onReintentar}:{v:FugaVista;onCola:()=>void;onReintentar:()=>void}){
 const t=v.tracker;
 if(t.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(t.status!=='ok')return <Vacio>No hay filas de reembolsos del Tracker de Excel cargadas. Carga el libro del Tracker para ver aquí los reembolsos negados o vencidos.</Vacio>;
 const e=t.estados,total=t.filasReembolsos,negMonto=(t.montoPorEstado.vencido??0)+(t.montoPorEstado.no_reembolsable??0)+(t.montoPorEstado.rechazado??0);
 const orden2=['reembolsado','vencido','no_reembolsable','rechazado','enviado','otro','sin_estado'].filter(k=>(e[k]??0)>0);
 return <div className="fg-tracker">
  <p className="fg-frase">Hay <b>{num(t.negados)}</b> solicitudes de {num(total)} sin reembolsar: {num(e.vencido)} con más de 180 días, {num(e.no_reembolsable)} no reembolsables y {num(e.rechazado)} rechazadas, por <b>{usd(negMonto,{decimals:false}).replace(/^/,'')}</b> (monto supuesto en USD).</p>
  <div className="fg-seg" role="img" aria-label={orden2.map(k=>`${ESTADO_TXT[k]} ${e[k]}`).join(', ')}>{orden2.map(k=><i key={k} style={{flexGrow:e[k],background:ESTADO_COLOR[k]}} title={`${ESTADO_TXT[k]}: ${e[k]}`}/>)}</div>
  <ul className="fg-leyenda fg-leyenda-n">{orden2.map(k=><li key={k}><i style={{background:ESTADO_COLOR[k]}}/>{ESTADO_TXT[k]} <b>{num(e[k])}</b></li>)}</ul>
  <div className="fg-tabla-wrap" role="region" aria-label="Solicitudes de reembolso por motivo" tabIndex={0}>
   <table className="fg-tabla fg-tabla-t"><thead><tr><th scope="col">Motivo</th><th scope="col" className="fg-r">Solicitudes</th><th scope="col" className="fg-r">Reembolsadas</th><th scope="col" className="fg-r">Negadas</th><th scope="col" className="fg-r">Monto (USD supuesto)</th></tr></thead>
    <tbody>{t.porMotivo.map(m=><tr key={m.motivo}><th scope="row">{m.motivo}</th><td className="fg-r">{num(m.n)}</td><td className="fg-r">{num(m.reembolsados)}</td><td className="fg-r">{num(m.negados)}</td><td className="fg-r">{usd(m.montoMinor)}{m.sinMonto>0&&<small className="fg-sm"> · {num(m.sinMonto)} sin monto</small>}</td></tr>)}</tbody></table>
  </div>
  <div className="fg-fila-acc"><Button size="sm" icon={<Download/>} onClick={onCola}>Cola de reembolsos vencidos o negados</Button><span className="fg-sm">{num(t.negados)} filas en CSV, sin nombres.</span></div>
  <p className="fg-pie">{t.nota} Solo la hoja «Reembolsos» (la de «Reembolsos solicitados» se solapa); la última revisión de cada fila.</p>
 </div>;
}

// ---- S6: contacto repetido ----
export function SeccionRepetido({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 const c=v.contactoRepetido;
 if(c.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(c.status==='not_computed')return <Vacio>{c.note??'El resumen de contacto repetido todavía no se ha calculado.'} Cuando exista, aquí verás qué parte de los clientes vuelve a escribir.</Vacio>;
 if(c.status!=='ok')return <Vacio>No hay contactos con tickets vinculados para calcular repeticiones.</Vacio>;
 return <div>
  <div className="fg-stats">
   <div><b className="fg-stat">{pct(c.pctDosOMas)}</b><span>de los contactos escribió 2 o más veces en 90 días ({num(c.contactosDosOMas90)} de {num(c.contactos)})</span></div>
   <div><b className="fg-stat">{pct(c.pctTresOMas)}</b><span>escribió 3 o más veces ({num(c.contactosTresOMas90)})</span></div>
   <div><b className="fg-stat">{num(c.ticketsQueRepiten90)}</b><span>tickets repiten un contacto de los 90 días previos</span></div>
  </div>
  {c.porCategoria.length>0&&<><h3 className="fg-h3">Categorías con más repetición</h3><ul className="fg-rank">{c.porCategoria.map(x=><li key={x.categoria}><span>{x.categoria}</span><b>{pct(x.pct)}</b><small>{num(x.repiten)} de {num(x.clientes)} clientes</small></li>)}</ul></>}
  <p className="fg-pie">{c.pctSinVincular!==null?`${pct(c.pctSinVincular)} de los tickets no está vinculado a un contacto: puede subestimar o inflar. `:''}Resumen calculado el {String(c.refreshedAt).slice(0,10)}. Las categorías son de la IA y solo cubren las conversaciones con extracción (jul-sep 2026); excluye avisos automáticos de marketplaces.</p>
 </div>;
}

// ---- S7: qué cambió ----
export function SeccionCambios({v}:{v:FugaVista}){
 const fr=frasesCambios(v),ex=excluidosTexto(v);
 if(!fr.length)return <Vacio>Todavía no hay dos meses completos y comparables para decir qué cambió.</Vacio>;
 return <div><ul className="fg-cambios">{fr.map(f=><li key={f.clave}>{f.texto}</li>)}</ul>
  {ex.length>0&&<p className="fg-pie">No se usan como señal: {ex.join('; ')}.</p>}</div>;
}
