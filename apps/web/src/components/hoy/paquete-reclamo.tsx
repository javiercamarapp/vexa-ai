'use client';
import {useEffect,useMemo,useState} from 'react';
import type {FugaVista} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {Drawer} from '../ui/overlay';
import {Button,LinkButton,Arrow,Download} from '../ui/button';
import {Icon} from '../agente/icons';
import {RovaqMark} from '../agente/rovaq-mark';
import {datosSku,mensajeReclamo,paqueteEvidencia} from '../refunds/fuga-archivos.mjs';

type Archivo={nombre:string;mime:string;contenido:string};
const bajar=(a:Archivo)=>{const url=URL.createObjectURL(new Blob([a.contenido],{type:a.mime})),el=document.createElement('a');el.href=url;el.download=a.nombre;el.rel='noopener';document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);};
const PASOS=['Reuniendo los reembolsos del SKU','Separando por canal y por mes','Sumando las filas del Tracker','Verificando que las cifras cuadren','Redactando el mensaje para el proveedor'];

/** «Preparar paquete» hecho de verdad: al abrir, el sistema arma solo el paquete de evidencia y el borrador del mensaje; la persona revisa, descarga y envía (nada se envía desde aquí). */
export function PaqueteReclamo({open,onClose,fuga,sku}:{open:boolean;onClose:()=>void;fuga:FugaVista|null;sku:string}){
 const [paso,setPaso]=useState(0),[copiado,setCopiado]=useState(false),[aviso,setAviso]=useState('');
 const listo=paso>=PASOS.length;
 useEffect(()=>{if(!open){setPaso(0);setCopiado(false);setAviso('');return;}
  const lento=!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(!lento){setPaso(PASOS.length);return;}
  const id=setInterval(()=>setPaso(p=>{if(p+1>=PASOS.length){clearInterval(id);return PASOS.length;}return p+1;}),520);return()=>clearInterval(id);},[open]);
 const datos=useMemo(()=>fuga?{p:paqueteEvidencia(fuga,sku),m:mensajeReclamo(fuga,sku),d:datosSku(fuga,sku)}:null,[fuga,sku]);
 const [texto,setTexto]=useState('');
 useEffect(()=>{setTexto(datos?.m?.cuerpo??'');},[datos]);
 const fila=datos?.d.fila;
 const usd=(m:number|string|bigint)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(m)/100);
 const copiar=async()=>{if(!datos?.m)return;try{await navigator.clipboard.writeText(`Asunto: ${datos.m.asunto}\n\n${texto}`);setCopiado(true);setTimeout(()=>setCopiado(false),1800);}catch{setAviso('No se pudo copiar; selecciona el texto y cópialo.');}};
 const descargar=()=>{if(!datos?.p)return;bajar(datos.p.html);bajar(datos.p.csv);setAviso(`Descargados ${datos.p.html.nombre} y ${datos.p.csv.nombre}. No se envió nada.`);};
 return <Drawer open={open} onClose={onClose} size="lg" title={`Paquete de reclamo · ${sku}`} subtitle="Se arma solo a partir del libro y del Tracker; tú lo revisas y lo envías."
  footer={<>{aviso&&<span className="ov-foot-note" role="status">{aviso}</span>}<LinkButton href="/refunds#fg-acciones" variant="ghost" icon={<Arrow/>}>Abrir expediente completo</LinkButton><Button variant="primary" icon={<Download/>} disabled={!listo||!datos?.p} onClick={descargar}>Descargar paquete</Button></>}>
  {!datos||!fila?<p className="state" role="status">No hay datos suficientes de este SKU para armar el paquete.</p>:<>
   <ol className="trace-list pq-pasos" aria-label="Progreso del paquete">{PASOS.map((t,i)=><li key={t} className="trace-step" data-done={i<paso} style={{display:i<=paso||listo?undefined:'none'}}>
    <span className="trace-icon" aria-hidden="true">{i<paso?<Icon name="check" size={12}/>:<span className="agente-dot"/>}</span><div className="trace-body"><p className="trace-title">{t}{i<paso?'':'…'}</p></div></li>)}</ol>
   {listo&&<>
    <dl className="pq-kpis"><div><dt>Devuelto (bruto)</dt><dd>{usd(fila.usdBrutoMinor)}</dd></div><div><dt>Reembolsos</dt><dd>{fila.n.toLocaleString('es-MX')}</dd></div><div><dt>Sin cancelados</dt><dd>{usd(fila.usdNetoMinor)}</dd></div><div><dt>Posición</dt><dd>#{fila.pos}</dd></div></dl>
    <section className="pq-sec" aria-label="Vista previa del paquete"><h3>Vista previa del paquete</h3><iframe title={`Vista previa del paquete de ${sku}`} sandbox="" srcDoc={datos.p?.html.contenido} className="pq-previa"/></section>
    <section className="pq-sec" aria-label="Borrador del mensaje"><h3>Borrador del mensaje</h3><p className="pq-asunto"><span>Asunto</span> {datos.m?.asunto}</p>
     <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={11} aria-label="Cuerpo del mensaje" className="pq-texto"/>
     <div className="pq-acciones"><Button size="sm" icon={<Icon name={copiado?'check':'copy'} size={14}/>} onClick={()=>void copiar()}>{copiado?'Copiado':'Copiar mensaje'}</Button><span className="pq-nota"><RovaqMark size={12}/> Solo cifras observadas, sin datos de clientes ni causa del defecto.</span></div></section>
   </>}
  </>}
 </Drawer>;
}
