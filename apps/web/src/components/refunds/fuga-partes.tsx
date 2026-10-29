'use client';
import {ConMarca} from '../ui/brand-mark';
import {useIdioma,useT} from '../i18n/proveedor';
import type {Clave,Traductor} from '../../lib/i18n';
import {Fragment,useId} from 'react';
import type {ReactNode} from 'react';
import type {FugaVista,SkuFila} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {KindBadge} from '../ui/kind-badge';
import {Button,Download,Refresh} from '../ui/button';
import {Icon} from '../ui/icons';
import {ESTADO_TXT,HOJA_TXT,NOMBRE,frasesCambios,excluidosTexto,mesCorto,num,pct,usd} from './fuga-modelo.mjs';
import {datosSku,NO_SE_SABE} from './fuga-archivos.mjs';
import {etiquetaCategoria} from '../../lib/legibilidad/categorias.mjs';
import './fuga.css';

type Kind='observed'|'estimated'|'inferred';
const ESTADO_CLAVE:Record<string,Clave>={reembolsado:'tr.fuga.estReembolsado',vencido:'tr.fuga.estVencido',no_reembolsable:'tr.fuga.estNoReemb',rechazado:'tr.fuga.estRechazado',enviado:'tr.fuga.estEnviado',otro:'tr.fuga.estOtro',sin_estado:'tr.fuga.estSin'};
const HOJA_CLAVE:Record<string,Clave>={reembolsos:'fuga.thReemb',garantiaHerramientas:'tr.fuga.hojaGarHerr',garantiaPartes:'tr.fuga.hojaGarPartes',etiquetas:'tr.fuga.hojaEtiq'};
const NSS_CLAVE:Clave[]=['tr.fuga.nss0','tr.fuga.nss1','tr.fuga.nss2','tr.fuga.nss3','tr.fuga.nss4'];
/** Etiqueta del estado de un reembolso del Tracker en el idioma activo (los días del vencimiento entran por variable). */
export const estadoTxt=(t:Traductor,k:string)=>ESTADO_CLAVE[k]?t(ESTADO_CLAVE[k],{n:180}):(ESTADO_TXT[k]??k);
export const hojaTxt=(t:Traductor,h:string)=>HOJA_CLAVE[h]?t(HOJA_CLAVE[h]):(HOJA_TXT[h]??h);
/** «Qué no se sabe»: mismas frases que NO_SE_SABE (el español lo verifica una prueba), en el idioma activo. */
export const noSeSabeTxt=(t:Traductor)=>NO_SE_SABE.map((x:string,i:number)=>NSS_CLAVE[i]?t(NSS_CLAVE[i]):x);
/** Sección con título, clase de la cifra y una línea de contexto. */
export function Seccion({id,titulo,kind,intro,children,accion}:{id:string;titulo:string;kind?:Kind;intro?:ReactNode;children:ReactNode;accion?:ReactNode}){
 return <section className="card fg-sec" aria-labelledby={id}>
  <div className="card-head"><div><h2 id={id}>{titulo}</h2>{intro&&<p className="card-lead fg-intro">{intro}</p>}</div><div className="fg-head-r">{kind&&<KindBadge kind={kind}/>}{accion}</div></div>
  {children}
 </section>;
}
/** Una parte que no respondió: nunca un 0. */
export function NoDisponible({texto,onRetry}:{texto?:string;onRetry?:()=>void}){
 const tx=useT();
 return <div className="fg-vacio" role="status"><Icon name="clock" size={18}/><p>{texto??tx('vista.ndTexto')}</p>{onRetry&&<Button size="sm" icon={<Refresh/>} onClick={onRetry}>{tx('vista.reintentar')}</Button>}</div>;
}
export const Vacio=({children}:{children:ReactNode})=><div className="fg-vacio" role="status"><Icon name="info" size={18}/><p>{children}</p></div>;

const CANAL_VAR:Record<string,string>={walmart:'var(--fg-walmart)',amazon:'var(--fg-amazon)',shopify:'var(--fg-otro)',bestbuy:'var(--fg-otro)'};
export function LeyendaCanales({canales}:{canales:string[]}){
 const tx=useT();
 return <ul className="fg-leyenda" aria-label={tx('fuga.canales')}>{canales.map(c=><li key={c}><i style={{background:CANAL_VAR[c]??'var(--fg-otro)'}}/><ConMarca marca={c}>{NOMBRE[c]??c}</ConMarca></li>)}</ul>;
}

// ---- S2: tabla SKU × canal con expediente en la fila ----
export function TablaSkus({v,abierto,onAbrir,onPaquete}:{v:FugaVista;abierto:string|null;onAbrir:(s:string|null)=>void;onPaquete:(sku:string)=>void}){
 const tx=useT();
 const top:SkuFila[]=v.skus.status==='ok'?v.skus.top:[];
 const max=Math.max(1,...top.map(r=>Number(BigInt(r.usdBrutoMinor)/100n)));
 const canales=[...new Set(top.flatMap(r=>r.canales.map(c=>c.canal)))];
 const lineasOk=v.skus.status==='ok'&&v.skus.lineasStatus==='ok';
 const uid=useId();
 return <div>
  <LeyendaCanales canales={canales}/>
  <div className="fg-tabla-wrap" role="region" aria-label={tx('fuga.tablaSkusRegion')} tabIndex={0}>
   <table className="fg-tabla" aria-label={tx('fuga.tablaSkusAria')}>
    <thead><tr><th scope="col" className="fg-n fg-hide-sm">#</th><th scope="col">{tx('fuga.thSku')}</th><th scope="col" className="fg-bar-col">{tx('fuga.thDinero')}</th><th scope="col" className="fg-r fg-hide-sm">{tx('fuga.thReemb')}</th><th scope="col" className="fg-r fg-hide-sm">{tx('fuga.thLineas')}</th><th scope="col" className="fg-r fg-hide-sm">{tx('fuga.thAcum')}</th></tr></thead>
    <tbody>{top.map(r=>{
     const abre=abierto===r.sku,rid=`${uid}-${r.pos}`,usdN=Number(BigInt(r.usdBrutoMinor)/100n);
     const masReembolsosQueLineas=r.lineas!==null&&r.n>r.lineas;
     return <Fragment key={r.sku}>
      <tr data-open={abre||undefined}>
       <td className="fg-n fg-hide-sm">{r.pos}</td>
       <th scope="row"><button type="button" className="fg-sku" aria-expanded={abre} aria-controls={rid} onClick={()=>onAbrir(abre?null:r.sku)}><Icon name={abre?'chevron-down':'chevron-right'} size={14}/><span><b>{r.sku}</b><small>{r.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${num(c.n)}`).join(' · ')}</small></span></button></th>
       <td className="fg-bar-col"><div className="fg-bar" role="img" aria-label={tx('tr.fuga.barraAria',{sku:r.sku,usd:usd(r.usdBrutoMinor),lista:r.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${usd(c.usdBrutoMinor)}`).join(', ')})}>
         <span className="fg-bar-track"><span className="fg-bar-fill" style={{width:Math.max(1.5,usdN*100/max)+'%'}}>{r.canales.map(c=><i key={c.canal} style={{flexGrow:Number(BigInt(c.usdBrutoMinor)/100n)||1,background:CANAL_VAR[c.canal]??'var(--fg-otro)'}}/>)}</span></span><b>{usd(r.usdBrutoMinor)}</b></div></td>
       <td className="fg-r fg-hide-sm">{num(r.n)}</td>
       <td className="fg-r fg-hide-sm">{r.lineas===null?<span title={tx('vista.noDisponible')}>—</span>:<>{num(r.lineas)}{masReembolsosQueLineas&&<span className="fg-senal" title={tx('fuga.revisarTip')}>{tx('fuga.revisar')}</span>}</>}</td>
       <td className="fg-r fg-hide-sm">{pct(r.acumPct)}</td>
      </tr>
      {abre&&<tr className="fg-exp" id={rid}><td colSpan={6}><Expediente v={v} sku={r.sku} lineasOk={lineasOk} onPaquete={onPaquete}/></td></tr>}
     </Fragment>;})}</tbody>
   </table>
  </div>
  <p className="fg-pie">{lineasOk?tx('fuga.pieLineasOk'):tx('fuga.pieLineasNo')}</p>
 </div>;
}

function Lista({titulo,items,tono}:{titulo:string;items:ReactNode[];tono?:'no'}){
 return <div className="fg-lista" data-tono={tono}><h4>{titulo}</h4><ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul></div>;
}
const orden=(o:Record<string,number>)=>Object.entries(o).sort((a,b)=>b[1]-a[1]);

// ---- S5: expediente del SKU ----
export function Expediente({v,sku,lineasOk,onPaquete}:{v:FugaVista;sku:string;lineasOk:boolean;onPaquete:(sku:string)=>void}){
 const tx=useT();
 const {fila,meses,tr}=datosSku(v,sku);
 if(!fila)return null;
 const trackerEstado=v.tracker.status;
 const sabe:ReactNode[]=[
  <>{num(fila.n)} {tx('tr.fuga.reembPor')} <b>{usd(fila.usdBrutoMinor)}</b> {tx('tr.fuga.brutosSin',{neto:usd(fila.usdNetoMinor),lista:fila.canales.map(c=>`${NOMBRE[c.canal]??c.canal} ${num(c.n)}`).join(' · ')})}</>,
  lineasOk&&fila.lineas!==null?<>{tx('tr.fuga.lineasVentana',{n:num(fila.lineas),canales:fila.canales.length>1?fila.canales.map(c=>c.lineas===null?'':` · ${NOMBRE[c.canal]??c.canal} ${num(c.lineas)}`).join(''):''})} {fila.n>fila.lineas?tx('tr.fuga.masReembP'):tx('tr.fuga.ventanasDist')}</>:<>{tx('tr.fuga.lineasNoDisp')}</>,
 ];
 if(tr){
  sabe.push(<>{tx('tr.fuga.trackerFilas',{n:num(Object.values(tr.hojas).reduce((a,n)=>a+n,0)),hojas:orden(tr.hojas).map(([h,n])=>`${hojaTxt(tx,h)} ${num(n)}`).join(' · ')})}</>);
  if(Object.keys(tr.motivos).length)sabe.push(<>{tx('tr.fuga.motivoContacto',{lista:orden(tr.motivos).slice(0,4).map(([k,n])=>`${k} ${num(n)}`).join(' · ')})}{Object.keys(tr.submotivos).length?tx('tr.fuga.subrazon',{lista:orden(tr.submotivos).slice(0,3).map(([k,n])=>`${k} ${num(n)}`).join(' · ')}):''}.</>);
  if(Object.keys(tr.estados).length)sabe.push(<>{tx('tr.fuga.estadoSolicP',{lista:orden(tr.estados).map(([k,n])=>`${estadoTxt(tx,k)} ${num(n)}`).join(' · ')})}</>);
  sabe.push(<>{tx('tr.fuga.convAsoc',{x:tr.vinculadas>0?tx('tr.fuga.vincNP',{n:num(tr.vinculadas)}):tx('tr.fuga.vincNingP')})}</>);
 } else sabe.push(trackerEstado==='unavailable'?<>{tx('fuga.trackerNoDisp')}</>:<>{tx('fuga.trackerSinSku')}</>);
 return <div className="fg-exped">
  <div className="fg-exped-head"><div><h3>{tx('fuga.expedienteDe',{sku})}</h3><p>{tx('fuga.expedienteSub')}</p></div>
   <Button variant="primary" size="sm" icon={<Download/>} onClick={()=>onPaquete(sku)}>{tx('fuga.paqueteProv')}</Button></div>
  <div className="fg-exped-grid">
   <Lista titulo={tx('fuga.queSabe')} items={sabe}/>
   <Lista titulo={tx('fuga.queNoSabe')} tono="no" items={noSeSabeTxt(tx).slice(0,4)}/>
  </div>
  {meses.length>0&&<details className="fg-mini"><summary>{tx('fuga.reembMes')}</summary><table aria-label={tx('fuga.reembMes')}><thead><tr><th scope="col">{tx('fuga.thMes')}</th><th scope="col">{tx('fuga.thCanal')}</th><th scope="col" className="fg-r">{tx('fuga.thReemb')}</th><th scope="col" className="fg-r">{tx('fuga.thUsdBruto')}</th></tr></thead>
   <tbody>{meses.map(m=><tr key={m.mes+m.canal}><td>{mesCorto(m.mes)}</td><td>{NOMBRE[m.canal]??m.canal}</td><td className="fg-r">{num(m.n)}</td><td className="fg-r">{usd(m.usdBrutoMinor)}</td></tr>)}</tbody></table></details>}
 </div>;
}

// ---- S4: dinero negado o atorado (Tracker) ----
const ESTADO_COLOR:Record<string,string>={reembolsado:'var(--kind-observed)',vencido:'var(--cov-rej)',no_reembolsable:'var(--fg-neg-2)',rechazado:'var(--fg-neg-3)',enviado:'var(--cov-pen)',otro:'var(--fg-otro)',sin_estado:'var(--fg-otro)'};
export function SeccionTracker({v,onCola,onReintentar}:{v:FugaVista;onCola:()=>void;onReintentar:()=>void}){
 const tx=useT();
 const t=v.tracker;
 if(t.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(t.status!=='ok')return <Vacio>{tx('fuga.sinFilasTracker')}</Vacio>;
 const e=t.estados,total=t.filasReembolsos,negMonto=(t.montoPorEstado.vencido??0)+(t.montoPorEstado.no_reembolsable??0)+(t.montoPorEstado.rechazado??0);
 const orden2=['reembolsado','vencido','no_reembolsable','rechazado','enviado','otro','sin_estado'].filter(k=>(e[k]??0)>0);
 return <div className="fg-tracker">
  <p className="fg-frase">{tx('tr.fuga.hayA')} <b>{num(t.negados)}</b> {tx('tr.fuga.hayB',{total:num(total),venc:num(e.vencido),d:180,nr:num(e.no_reembolsable),rech:num(e.rechazado)})} <b>{usd(negMonto,{decimals:false}).replace(/^/,'')}</b> {tx('tr.fuga.hayC')}</p>
  <div className="fg-seg" role="img" aria-label={orden2.map(k=>`${estadoTxt(tx,k)} ${e[k]}`).join(', ')}>{orden2.map(k=><i key={k} style={{flexGrow:e[k],background:ESTADO_COLOR[k]}} title={`${estadoTxt(tx,k)}: ${e[k]}`}/>)}</div>
  <ul className="fg-leyenda fg-leyenda-n">{orden2.map(k=><li key={k}><i style={{background:ESTADO_COLOR[k]}}/>{estadoTxt(tx,k)} <b>{num(e[k])}</b></li>)}</ul>
  <div className="fg-tabla-wrap" role="region" aria-label={tx('fuga.motivoRegion')} tabIndex={0}>
   <table className="fg-tabla fg-tabla-t" aria-label={tx('fuga.motivoTabla')}><thead><tr><th scope="col">{tx('fuga.thMotivo')}</th><th scope="col" className="fg-r">{tx('fuga.thSolicitudes')}</th><th scope="col" className="fg-r">{tx('fuga.thReembolsadas')}</th><th scope="col" className="fg-r">{tx('fuga.thNegadas')}</th><th scope="col" className="fg-r">{tx('fuga.thMonto')}</th></tr></thead>
    <tbody>{t.porMotivo.map(m=><tr key={m.motivo}><th scope="row">{m.motivo}</th><td className="fg-r">{num(m.n)}</td><td className="fg-r">{num(m.reembolsados)}</td><td className="fg-r">{num(m.negados)}</td><td className="fg-r">{usd(m.montoMinor)}{m.sinMonto>0&&<small className="fg-sm">{tx('fuga.sinMontoN',{n:num(m.sinMonto)})}</small>}</td></tr>)}</tbody></table>
  </div>
  <div className="fg-fila-acc"><Button size="sm" icon={<Download/>} onClick={onCola}>{tx('fuga.colaBtn')}</Button><span className="fg-sm">{tx('fuga.filasCsv',{n:num(t.negados)})}</span></div>
  <p className="fg-pie">{t.nota} {tx('tr.fuga.soloHoja')}</p>
 </div>;
}

// ---- S6: contacto repetido ----
export function SeccionRepetido({v,onReintentar}:{v:FugaVista;onReintentar:()=>void}){
 const tx=useT();
 const c=v.contactoRepetido;
 if(c.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 if(c.status==='not_computed')return <Vacio>{c.note??tx('fuga.repNoCalc')} {tx('fuga.repCuando')}</Vacio>;
 if(c.status!=='ok')return <Vacio>{tx('fuga.repSinTickets')}</Vacio>;
 return <div>
  <div className="fg-stats">
   <div><b className="fg-stat">{pct(c.pctDosOMas)}</b><span>{tx('tr.fuga.statDos',{k:2,d:90,a:num(c.contactosDosOMas90),b:num(c.contactos)})}</span></div>
   <div><b className="fg-stat">{pct(c.pctTresOMas)}</b><span>{tx('tr.fuga.statTres',{k:3,n:num(c.contactosTresOMas90)})}</span></div>
   <div><b className="fg-stat">{num(c.ticketsQueRepiten90)}</b><span>{tx('tr.fuga.statTickets',{d:90})}</span></div>
  </div>
  {c.porCategoria.length>0&&<><h3 className="fg-h3">{tx('fuga.repCategorias')}</h3><ul className="fg-rank">{c.porCategoria.map(x=><li key={x.categoria}><span>{etiquetaCategoria(x.categoria,tx)}</span><b>{pct(x.pct)}</b><small>{tx('tr.fuga.deClientes',{a:num(x.repiten),b:num(x.clientes)})}</small></li>)}</ul></>}
  <p className="fg-pie">{c.pctSinVincular!==null?tx('tr.fuga.sinVincular',{pct:pct(c.pctSinVincular)}):''}{tx('tr.fuga.resumenCalc',{fecha:String(c.refreshedAt).slice(0,10),periodo:tx('tr.fuga.periodoExtr',{anio:2026})})}</p>
 </div>;
}

// ---- S7: qué cambió ----
export function SeccionCambios({v}:{v:FugaVista}){
 const tx=useT(),idioma=useIdioma();
 const fr=frasesCambios(v,idioma),ex=excluidosTexto(v,idioma);
 if(!fr.length)return <Vacio>{tx('fuga.cambiosVacio')}</Vacio>;
 return <div><ul className="fg-cambios">{fr.map(f=><li key={f.clave}>{f.texto}</li>)}</ul>
  {ex.length>0&&<p className="fg-pie">{tx('fuga.noSeUsan',{x:ex.join('; ')})}</p>}</div>;
}
