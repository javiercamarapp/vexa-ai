'use client';
import {useEffect,useMemo,useState} from 'react';
import {useLocaleIntl,useT} from '../i18n/proveedor';
import type {Clave} from '../../lib/i18n';
import {identidadReclamo,reconciliarBorrador,type BorradorReclamo} from './reclamo-borrador';
import {useReducedMotion} from '../ui/browser-state';
import type {FugaVista} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {Drawer} from '../ui/overlay';
import {Button,LinkButton,Arrow,Download} from '../ui/button';
import {Icon} from '../agente/icons';
import {RovaqMark} from '../agente/rovaq-mark';
import {datosSku,mensajeReclamo,paqueteEvidencia} from '../refunds/fuga-archivos.mjs';

type Archivo={nombre:string;mime:string;contenido:string};
const bajar=(a:Archivo)=>{const url=URL.createObjectURL(new Blob([a.contenido],{type:a.mime})),el=document.createElement('a');el.href=url;el.download=a.nombre;el.rel='noopener';document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);};
const PASOS:Clave[]=['tr.hoy.paso1','tr.hoy.paso2','tr.hoy.paso3','tr.hoy.paso4','tr.hoy.paso5'];

/** «Preparar paquete» hecho de verdad: al abrir, el sistema arma solo el paquete de evidencia y el borrador del mensaje; la persona revisa, descarga y envía (nada se envía desde aquí). */
export function PaqueteReclamo({open,onClose,fuga,sku}:{open:boolean;onClose:()=>void;fuga:FugaVista|null;sku:string}){
 const tx=useT(),loc=useLocaleIntl(),[paso,setPaso]=useState(0),[copiado,setCopiado]=useState(false),[aviso,setAviso]=useState('');
 const reducido=useReducedMotion(),listo=reducido||paso>=PASOS.length;
 const [apertura,setApertura]=useState(open);
 if(apertura!==open){setApertura(open);setPaso(0);setCopiado(false);setAviso('');}
 useEffect(()=>{if(!open||reducido)return;
  const id=setInterval(()=>setPaso(p=>{if(p+1>=PASOS.length){clearInterval(id);return PASOS.length;}return p+1;}),520);return()=>clearInterval(id);},[open,reducido]);
 const datos=useMemo(()=>fuga?{p:paqueteEvidencia(fuga,sku),m:mensajeReclamo(fuga,sku),d:datosSku(fuga,sku)}:null,[fuga,sku]);
 const cuerpo=datos?.m?.cuerpo??'';
 const identidad=identidadReclamo(sku,fuga?.scope??null,cuerpo);
 const [borrador,setBorrador]=useState<BorradorReclamo|null>(null);
 const vigente=reconciliarBorrador(borrador,identidad);
 if(vigente!==borrador)setBorrador(vigente);
 const texto=vigente?.texto??cuerpo;
 const setTexto=(texto:string)=>setBorrador({identidad,texto});
 const fila=datos?.d.fila;
 const usd=(m:number|string|bigint)=>new Intl.NumberFormat(loc,{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(m)/100);
 const copiar=async()=>{if(!datos?.m)return;try{await navigator.clipboard.writeText(`${tx('tr.ui.asunto')}: ${datos.m.asunto}\n\n${texto}`);setCopiado(true);setTimeout(()=>setCopiado(false),1800);}catch{setAviso(tx('tr.hoy.noCopio'));}};
 const descargar=()=>{if(!datos?.p)return;bajar(datos.p.html);bajar(datos.p.csv);setAviso(tx('tr.hoy.descargados',{a:datos.p.html.nombre,b:datos.p.csv.nombre}));};
 return <Drawer open={open} onClose={onClose} size="lg" title={tx('tr.hoy.pqTitulo',{sku})} subtitle={tx('tr.hoy.pqSub')}
  footer={<>{aviso&&<span className="ov-foot-note" role="status">{aviso}</span>}<LinkButton href="/refunds#fg-acciones" variant="ghost" icon={<Arrow/>}>{tx('tr.hoy.pqExpediente')}</LinkButton><Button variant="primary" icon={<Download/>} disabled={!listo||!datos?.p} onClick={descargar}>{tx('tr.hoy.pqDescargar')}</Button></>}>
  {!datos||!fila?<p className="state" role="status">{tx('tr.hoy.pqSinDatos')}</p>:<>
   {!listo?<ol className="trace-list pq-pasos" aria-label={tx('tr.hoy.pqProgreso')}>{PASOS.map((p,i)=><li key={p} className="trace-step" data-done={i<paso} style={{display:i<=paso?undefined:'none'}}>
    <span className="trace-icon" aria-hidden="true">{i<paso?<Icon name="check" size={12}/>:<span className="agente-dot"/>}</span><div className="trace-body"><p className="trace-title">{tx(p)}{i<paso?'':'…'}</p></div></li>)}</ol>
    :<p className="pq-listo" role="status"><Icon name="check" size={14}/>{tx('tr.hoy.pqListo',{n:PASOS.length})}</p>}
   {listo&&<>
    <dl className="pq-kpis"><div><dt>{tx('tr.hoy.pqBruto')}</dt><dd>{usd(fila.usdBrutoMinor)}</dd></div><div><dt>{tx('res.reembolsos')}</dt><dd>{fila.n.toLocaleString(loc)}</dd></div><div><dt>{tx('tr.hoy.pqSinCancel')}</dt><dd>{usd(fila.usdNetoMinor)}</dd></div><div><dt>{tx('tr.hoy.pqPosicion')}</dt><dd>#{fila.pos}</dd></div></dl>
    <section className="pq-sec" aria-label={tx('tr.hoy.pqVista')}><h3>{tx('tr.hoy.pqVista')}</h3><iframe title={tx('tr.hoy.pqVistaDe',{sku})} sandbox="" srcDoc={datos.p?.html.contenido} className="pq-previa"/></section>
    <section className="pq-sec" aria-label={tx('tr.hoy.pqBorrador')}><h3>{tx('tr.hoy.pqBorrador')}</h3><p className="pq-asunto"><span>{tx('tr.hoy.pqAsunto')}</span> {datos.m?.asunto}</p>
     <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={11} aria-label={tx('tr.hoy.pqCuerpo')} className="pq-texto"/>
     <div className="pq-acciones"><Button size="sm" icon={<Icon name={copiado?'check':'copy'} size={14}/>} onClick={()=>void copiar()}>{copiado?tx('tr.hoy.pqCopiado'):tx('tr.hoy.pqCopiar')}</Button><span className="pq-nota"><RovaqMark size={12}/> {tx('tr.hoy.pqNota')}</span></div></section>
   </>}
  </>}
 </Drawer>;
}
