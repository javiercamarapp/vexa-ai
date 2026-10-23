'use client';
import {useId,useState} from 'react';
import type {FugaVista} from '../../../../../packages/workspace-service/fuga-reembolsos.mjs';
import {KindBadge} from '../ui/kind-badge';
import {Icon} from '../ui/icons';
import {dinero,estimar,formulaA,formulaB,num,porcentaje,usd,usdNum} from './fuga-modelo.mjs';
import './fuga.css';

export function Campo({etiqueta,ayuda,valor,onChange,sufijo,modo,entrada}:{etiqueta:string;ayuda:string;valor:string;onChange:(v:string)=>void;sufijo:string;modo:'decimal'|'numeric';entrada:{error?:string}}){
 const id=useId();
 return <div className="fg-campo"><label htmlFor={id}>{etiqueta}</label>
  <div className="fg-campo-in"><input id={id} inputMode={modo} autoComplete="off" value={valor} onChange={e=>onChange(e.target.value)} aria-describedby={id+'-a'} aria-invalid={entrada.error?true:undefined} placeholder="Escribe tu supuesto"/><span aria-hidden="true">{sufijo}</span></div>
  <p id={id+'-a'} className={entrada.error?'fg-campo-err':'fg-sm'}>{entrada.error??ayuda}</p></div>;
}
/** Estimador con candado: sin supuestos tecleados NO hay número; con ellos, «Estimado con tus supuestos» y la cuenta a la vista. Nada se guarda ni se envía. */
export function Estimador({v}:{v:FugaVista}){
 const [sel,setSel]=useState<string>('top10');
 const [pP,setPP]=useState(''),[pR,setPR]=useState(''),[cc,setCC]=useState(''),[pE,setPE]=useState('');
 const top=v.skus.status==='ok'?v.skus.top:[];
 const baseMinor=v.titular.status==='ok'&&top.length?(sel==='top10'?String(top.reduce((a,r)=>a+BigInt(r.usdNetoMinor),0n)):top.find(r=>r.sku===sel)?.usdNetoMinor??null):null;
 const rep=v.contactoRepetido.status==='ok'?v.contactoRepetido.ticketsQueRepiten90:null;
 const e={pP:porcentaje(pP),pR:porcentaje(pR),cc:dinero(cc),pE:porcentaje(pE)};
 const r=estimar({baseUsdMinor:baseMinor,ticketsRepiten:rep,pctProveedor:e.pP,pctRecuperable:e.pR,costoContacto:e.cc,pctEvitable:e.pE});
 const hay=r.A||r.B;
 return <div className="fg-est">
  <p className="fg-intro">Rovaq no propone supuestos: tú los escribes. Sin ellos no se muestra ningún número. Nada de lo que escribas se guarda ni se envía.</p>
  <div className="fg-est-grid">
   <fieldset className="fg-bloque"><legend>Dinero recuperable por reclamo al proveedor</legend>
    <div className="fg-campo"><label htmlFor="fg-base">Dinero devuelto observado a considerar</label>
     <select id="fg-base" value={sel} onChange={ev=>setSel(ev.target.value)}>{top.length>0&&<option value="top10">Los 10 SKUs ({usd(String(top.reduce((a,x)=>a+BigInt(x.usdNetoMinor),0n)))} sin cancelados)</option>}{top.map(x=><option key={x.sku} value={x.sku}>{x.sku} ({usd(x.usdNetoMinor)})</option>)}</select></div>
    <Campo etiqueta="% atribuible a defecto de proveedor" ayuda="Del dinero devuelto, qué parte crees que es culpa del proveedor." valor={pP} onChange={setPP} sufijo="%" modo="decimal" entrada={e.pP as {error?:string}}/>
    <Campo etiqueta="% recuperable con un reclamo" ayuda="De esa parte, cuánto crees que el proveedor te devolvería." valor={pR} onChange={setPR} sufijo="%" modo="decimal" entrada={e.pR as {error?:string}}/>
   </fieldset>
   <fieldset className="fg-bloque"><legend>Costo del contacto repetido evitable</legend>
    <p className="fg-sm">{rep!==null?`Base observada: ${num(rep)} tickets que repiten un contacto de los 90 días previos.`:'Base no disponible: falta el resumen de contacto repetido.'}</p>
    <Campo etiqueta="Costo por contacto" ayuda="Lo que le cuesta a tu equipo atender un ticket, en dólares." valor={cc} onChange={setCC} sufijo="USD" modo="decimal" entrada={e.cc as {error?:string}}/>
    <Campo etiqueta="% de esos tickets que sería evitable" ayuda="Qué parte se evitaría resolviendo la causa." valor={pE} onChange={setPE} sufijo="%" modo="decimal" entrada={e.pE as {error?:string}}/>
   </fieldset>
  </div>
  <div className="fg-est-out" role="status" aria-live="polite" data-lock={hay?undefined:true}>
   {hay?<>
    <KindBadge kind="estimated" hint="Calculado con tus supuestos; no es un hecho registrado."/><p className="fg-est-t">Estimado con tus supuestos</p>
    {r.A&&<p><b className="fg-stat">{usdNum(r.A.valorUsd)}</b> recuperable por reclamo <span className="fg-sm">= {formulaA(r.A)}</span></p>}
    {r.B&&<p><b className="fg-stat">{usdNum(r.B.valorUsd)}</b> de costo evitable <span className="fg-sm">= {formulaB(r.B)}</span></p>}
    <p className="fg-sm">Supuestos tuyos, no hallazgos. Cambia o borra un campo y el número desaparece.</p></>
   :<><Icon name="lock" size={18}/><p>Falta tu supuesto: completa los campos de un bloque para ver su estimado.</p></>}
  </div>
 </div>;
}
