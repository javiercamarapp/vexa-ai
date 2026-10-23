'use client';
import {useId,useState} from 'react';
import type {Recomendacion} from '../../../../../packages/workspace-service/brechas.mjs';
import {Button} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {Vacio} from '../refunds/fuga-partes';
import {Campo} from '../refunds/fuga-estimador';
import {estimar,formulaA,porcentaje,usd,usdNum} from './gaps-modelo.mjs';
import '../dinero/dinero.css';

/** Clave donde se deja el borrador para el flujo de recomendaciones (mismo navegador, solo en esta pestaña). */
export type Supuesto={id:string;texto:string};
export const CLAVE_BORRADOR='vexa:borrador-recomendacion';

/** Estimador con candado (mismos campos y reglas que «Fuga de reembolsos»): sin supuestos tecleados no hay número. La base es el dinero devuelto observado de la recomendación elegida. */
export function EstimadorBrecha({recs,onSupuestos}:{recs:Recomendacion[];onSupuestos:(s:Supuesto|null)=>void}){
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

