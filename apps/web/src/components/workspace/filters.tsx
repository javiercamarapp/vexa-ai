import type { Scope } from '../../lib/workspace/contracts';
export function Filters({scope}:{scope:Scope}){return <form className="workspace-filters" method="get" aria-label="Filtros compartidos">
 <label>Desde (UTC)<input type="date" name="date_start" defaultValue={scope.date_start.slice(0,10)} required/></label>
 <label>Hasta, exclusivo (UTC)<input type="date" name="date_end" defaultValue={scope.date_end.slice(0,10)} required/></label>
 <label>Moneda<input name="currency" defaultValue={scope.currency} pattern="[A-Z]{3}" maxLength={3} required/></label>
 <label>Fecha de<select name="date_basis" defaultValue={scope.date_basis}><option value="order">Orden</option><option value="conversation">Conversación</option><option value="refund_settlement">Reembolso liquidado</option></select></label>
 <label>SKU<input name="sku" defaultValue={scope.sku[0]??''}/></label>{scope.sku.slice(1).map(s=><input key={s} type="hidden" name="sku" value={s}/>)}
 <label>Fuentes<select name="source" multiple defaultValue={scope.source} size={4}><option value="hubspot">HubSpot</option><option value="zendesk">Zendesk</option><option value="csv">CSV</option><option value="excel">Excel</option></select></label>
 <label>Snapshot (opcional)<input name="snapshot_id" defaultValue={scope.snapshot_id??''} placeholder="Último publicado"/></label>
 <input type="hidden" name="timezone" value="UTC"/><button type="submit">Aplicar alcance</button><small>Los cambios reinician la paginación. Sin fuentes seleccionadas: todas.</small>
 </form>;}
