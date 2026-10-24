'use client';
import type {FormEvent} from 'react';
import {OverlaySection} from '../ui/overlay';
import type {Scope} from '../../lib/workspace/contracts';

const SOURCES=[['hubspot','HubSpot'],['zendesk','Zendesk'],['csv','CSV'],['excel','Excel']] as const;
/** Form values describe the requested view; a published snapshot is resolved by the server. Lives inside the «Filtros» drawer. */
export function SharedFilters({scope,onApply,formId='scope-filters',onDone}:{scope:Scope & {basis?:string;exponent?:number};onApply:(query:URLSearchParams)=>void;formId?:string;onDone?:()=>void}){
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();const data=new FormData(event.currentTarget),query=new URLSearchParams();
  for(const key of ['date_start','date_end','currency','date_basis','timezone','snapshot_id','basis','exponent']){
   const value=String(data.get(key)??'').trim();if(value)query.set(key,value);
  }
  for(const sku of [...new Set(String(data.get('sku_lines')??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].sort())query.append('sku',sku);
  for(const source of data.getAll('source').map(String).sort())query.append('source',source);
  onApply(query);onDone?.();
 };
 return <form id={formId} className="ov-form" aria-label="Filtros compartidos" onSubmit={submit}>
  <OverlaySection title="Periodo"><div className="ov-pair">
   <label className="field">Desde (UTC)<input type="date" name="date_start" defaultValue={scope.date_start.slice(0,10)} required/></label>
   <label className="field">Hasta, exclusivo (UTC)<input type="date" name="date_end" defaultValue={scope.date_end.slice(0,10)} required/></label></div></OverlaySection>
  <OverlaySection title="Moneda y base"><div className="ov-pair">
   <label className="field">Moneda<input name="currency" defaultValue={scope.currency} pattern="[A-Z]{3}" maxLength={3} required/></label>
   <label className="field">Base<input name="basis" defaultValue={scope.basis??'net'} required maxLength={200}/></label></div></OverlaySection>
  <OverlaySection title="Fuentes"><fieldset className="field"><legend className="sr-only">Fuentes</legend><div className="check-row">{SOURCES.map(([value,label])=><label key={value} className="check-chip"><input type="checkbox" name="source" value={value} defaultChecked={scope.source.includes(value)}/><span>{label}</span></label>)}</div><small>Sin selección se incluyen todas.</small></fieldset></OverlaySection>
  <OverlaySection title="Producto (SKU)"><label className="field">SKU, uno por línea<textarea name="sku_lines" defaultValue={scope.sku.join('\n')} rows={3}/><small>Filtra órdenes que contienen el producto; no representa ventas por línea.</small></label></OverlaySection>
  <OverlaySection title="Avanzado"><div className="ov-pair">
   <label className="field">Decimales de la moneda<input name="exponent" type="number" min="0" max="4" defaultValue={scope.exponent}/></label>
   <label className="field">Publicación (opcional)<input name="snapshot_id" defaultValue={scope.snapshot_id??''} placeholder="Última publicada"/></label></div>
   <p className="ov-help">Cambiar filtros reinicia la paginación. La fecha de referencia es la fecha efectiva del evento (UTC).</p></OverlaySection>
  <input type="hidden" name="date_basis" value={scope.date_basis}/><input type="hidden" name="timezone" value="UTC"/>
 </form>;
}
