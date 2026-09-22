'use client';
import type {FormEvent} from 'react';
import type {Scope} from '../../lib/workspace/contracts';

/** Form values describe the requested view; a published snapshot is resolved by the server. */
export function SharedFilters({scope,onApply}:{scope:Scope & {basis?:string;exponent?:number};onApply:(query:URLSearchParams)=>void}){
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();const data=new FormData(event.currentTarget),query=new URLSearchParams();
  for(const key of ['date_start','date_end','currency','date_basis','timezone','snapshot_id','basis','exponent']){
   const value=String(data.get(key)??'').trim();if(value)query.set(key,value);
  }
  for(const sku of [...new Set(String(data.get('sku_lines')??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].sort())query.append('sku',sku);
  for(const source of data.getAll('source').map(String).sort())query.append('source',source);
  onApply(query);
 };
 return <form className="workspace-filters" aria-label="Filtros compartidos" onSubmit={submit}>
  <label>Desde (UTC)<input type="date" name="date_start" defaultValue={scope.date_start.slice(0,10)} required/></label>
  <label>Hasta, exclusivo (UTC)<input type="date" name="date_end" defaultValue={scope.date_end.slice(0,10)} required/></label>
  <label>Moneda<input name="currency" defaultValue={scope.currency} pattern="[A-Z]{3}" maxLength={3} required/></label>
  <label>Base de los importes<input name="basis" defaultValue={scope.basis??'net'} required maxLength={200}/></label>
  <label>Decimales de la moneda<input name="exponent" type="number" min="0" max="4" defaultValue={scope.exponent}/></label>
  <label>Fecha de referencia<input value="Fecha efectiva del evento (UTC)" readOnly/></label>
  <input type="hidden" name="date_basis" value={scope.date_basis}/>
  <label>SKU, uno por línea<textarea name="sku_lines" defaultValue={scope.sku.join('\n')} rows={3}/></label>
  <label>Fuentes<select name="source" multiple defaultValue={scope.source} size={4}><option value="hubspot">HubSpot</option><option value="zendesk">Zendesk</option><option value="csv">CSV</option><option value="excel">Excel</option></select></label>
  <label>Snapshot (opcional)<input name="snapshot_id" defaultValue={scope.snapshot_id??''} placeholder="Último publicado"/></label>
  <input type="hidden" name="timezone" value="UTC"/><button type="submit">Aplicar alcance</button>
  <small>Los cambios reinician la paginación. Sin fuentes seleccionadas: todas. El filtro SKU identifica órdenes que contienen el producto; no representa ventas por línea.</small>
 </form>;
}
