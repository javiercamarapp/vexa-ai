'use client';
import {useId,useState} from 'react';
import type {BrechasVista,Recomendacion} from '../../../../../packages/workspace-service/brechas.mjs';
import {recomendacionDeBrecha} from '../../../../../packages/workspace-service/brechas-recomendacion.mjs';
import {Button,LinkButton,Arrow} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {Vacio,NoDisponible} from '../refunds/fuga-partes';
import {Campo} from '../refunds/fuga-estimador';
import {TIPO_REC,estimar,formulaA,porcentaje,usd,usdNum} from './gaps-modelo.mjs';
import '../refunds/fuga.css';
import './gaps.css';

/** Clave donde se deja el borrador para el flujo de recomendaciones (mismo navegador, solo en esta pestaña). */
export type Supuesto={id:string;texto:string};
export const CLAVE_BORRADOR='vexa:borrador-recomendacion';

function Tarjeta({r,supuestos}:{r:Recomendacion;supuestos:string[]}){
 const [b,setB]=useState<ReturnType<typeof recomendacionDeBrecha>|null>(null),[aviso,setAviso]=useState('');
 const preparar=()=>{
  const x=recomendacionDeBrecha(r,{generadoEn:new Date().toISOString(),supuestos});
  setB(x);
  try{sessionStorage.setItem(CLAVE_BORRADOR,JSON.stringify(x));}catch{/* sin almacenamiento: el texto sigue a la vista */}
  setAviso('Texto preparado. No se envió nada ni se creó ninguna recomendación todavía.');
 };
 const copiar=async()=>{if(!b)return;try{await navigator.clipboard.writeText(b.cuerpo);setAviso('Texto copiado.');}catch{setAviso('No se pudo copiar: selecciona el texto y cópialo a mano.');}};
 return <li id={`rec-${r.id}`} className="gp-rec" data-tipo={r.tipo}>
  <div className="gp-rec-top"><span className="gp-rec-tipo">{TIPO_REC[r.tipo]??r.tipo}</span><KindBadge kind="inferred" hint="Regla aplicada a datos observados; no es un hecho registrado ni una estimación."/></div>
  <h3>{r.titulo}</h3>
  <p><b>Qué hacer:</b> {r.accion}</p>
  <p><b>Por qué:</b> {r.porque}</p>
  <ul aria-label="Evidencia">{r.evidencia.map((e,i)=><li key={i}>{e}</li>)}</ul>
  <p className="fg-sm">Cobertura: {r.cobertura}</p>
  <p className="gp-rec-imp"><KindBadge kind={r.impacto.clase}/> {r.impacto.texto}</p>
  <div className="gp-rec-acc"><Button size="sm" variant="primary" icon={<Arrow/>} onClick={preparar} aria-expanded={b?true:false}>Pasar a recomendación</Button></div>
  {b&&<div className="gp-borrador" role="region" aria-label={`Texto preparado: ${r.titulo}`}>
   <pre>{b.cuerpo}</pre>
   <div className="gp-rec-acc"><Button size="sm" icon={<Icon name="copy" size={14}/>} onClick={copiar}>Copiar texto</Button><LinkButton size="sm" href="/recommendations" icon={<Arrow/>}>Ir a Recomendaciones</LinkButton></div>
  </div>}
  <p className="fg-sm" role="status" aria-live="polite">{aviso}</p>
 </li>;
}

/** Estimador con candado (mismos campos y reglas que «Fuga de reembolsos»): sin supuestos tecleados no hay número. La base es el dinero devuelto observado de la recomendación elegida. */
function EstimadorBrecha({recs,onSupuestos}:{recs:Recomendacion[];onSupuestos:(s:Supuesto|null)=>void}){
 const [sel,setSel]=useState(''),[pP,setPP]=useState(''),[pR,setPR]=useState('');
 const id=useId(),elegidas=recs.filter(r=>r.impacto.usdMinor&&r.tipo!=='cross_sell'&&r.tipo!=='empujar'),r0=elegidas.find(r=>r.id===sel)??elegidas[0]??null;
 const e={pP:porcentaje(pP),pR:porcentaje(pR)};
 const est=estimar({baseUsdMinor:r0?.baseMinor??null,ticketsRepiten:null,pctProveedor:e.pP,pctRecuperable:e.pR,costoContacto:{vacio:true},pctEvitable:{vacio:true}});
 return <div className="fg-est">
  <p className="fg-intro">Rovaq no propone supuestos: tú los escribes. Sin ellos no se muestra ningún número. Nada de lo que escribas se guarda ni se envía; solo se agrega al texto si pasas la recomendación a Recomendaciones.</p>
  {elegidas.length===0?<Vacio>Ninguna recomendación de revisión tiene una base de dinero devuelto observada para estimar.</Vacio>:<>
   <fieldset className="fg-bloque"><legend>Dinero recuperable por reclamo al proveedor o al canal</legend>
    <div className="fg-campo"><label htmlFor={id}>Dinero devuelto observado a considerar</label>
     <select id={id} value={r0?.id??''} onChange={ev=>{setSel(ev.target.value);onSupuestos(null);}}>{elegidas.map(r=><option key={r.id} value={r.id}>{r.titulo} ({usd(r.baseMinor)})</option>)}</select></div>
    <Campo etiqueta="% atribuible a defecto del proveedor o del canal" ayuda="Del dinero devuelto, qué parte crees que no es culpa del cliente." valor={pP} onChange={v=>{setPP(v);onSupuestos(null);}} sufijo="%" modo="decimal" entrada={e.pP as {error?:string}}/>
    <Campo etiqueta="% recuperable con un reclamo" ayuda="De esa parte, cuánto crees que te devolverían." valor={pR} onChange={v=>{setPR(v);onSupuestos(null);}} sufijo="%" modo="decimal" entrada={e.pR as {error?:string}}/>
   </fieldset>
   <div className="fg-est-out" role="status" aria-live="polite" data-lock={est.A?undefined:true}>
    {est.A?<><KindBadge kind="estimated" hint="Calculado con tus supuestos; no es un hecho registrado."/><p className="fg-est-t">Estimado con tus supuestos</p>
     <p><b className="fg-stat">{usdNum(est.A.valorUsd)}</b> de ingreso bruto recuperable <span className="fg-sm">= {formulaA(est.A)}</span></p>
     <p className="fg-sm">Supuestos tuyos, no hallazgos. Es ingreso, no utilidad: no hay costo por producto.</p>
     <Button size="sm" onClick={()=>onSupuestos({id:r0!.id,texto:`Base ${usd(r0!.baseMinor)} (${r0!.titulo}); ${pP} % atribuible; ${pR} % recuperable => ${usdNum(est.A!.valorUsd)} estimado de ingreso bruto.`})}>Incluir este estimado en el texto preparado</Button></>
     :<><Icon name="lock" size={18}/><p>Falta tu supuesto: completa los dos campos para ver el estimado.</p></>}
   </div></>}
 </div>;
}

export function SeccionRecomendaciones({v,onReintentar,supuesto,onSupuestos}:{v:BrechasVista;onReintentar:()=>void;supuesto:Supuesto|null;onSupuestos:(s:Supuesto|null)=>void}){
 const r=v.recomendaciones;
 if(r.status==='unavailable')return <NoDisponible onRetry={onReintentar}/>;
 return <div>
  {r.items.length===0?<Vacio>Ninguna regla se cumple con los datos de hoy. Eso no significa que no haya oportunidades: las reglas piden ingreso suficiente, meses completos y cruce de reembolsos con ingreso.</Vacio>
   :<ul className="gp-recs">{r.items.map(x=><Tarjeta key={x.id} r={x} supuestos={supuesto?.id===x.id?[supuesto.texto]:[]}/>)}</ul>}
  <h3 className="gp-sub">¿Cuánto podrías recuperar?</h3>
  <EstimadorBrecha recs={r.items} onSupuestos={onSupuestos}/>
 </div>;
}
