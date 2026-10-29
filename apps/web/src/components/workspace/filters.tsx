import type { Scope } from '../../lib/workspace/contracts';
import { traductor } from '../../lib/i18n';
import { idiomaActual } from '../../lib/i18n/servidor';
export async function Filters({scope}:{scope:Scope}){const tx=traductor(await idiomaActual());return <form className="workspace-filters" method="get" aria-label={tx('tr.ws.flAria')}>
 <label>{tx('tr.ws.flDesde')}<input type="date" name="date_start" defaultValue={scope.date_start.slice(0,10)} required/></label>
 <label>{tx('tr.ws.flHasta')}<input type="date" name="date_end" defaultValue={scope.date_end.slice(0,10)} required/></label>
 <label>{tx('tr.ws.flMoneda')}<input name="currency" defaultValue={scope.currency} pattern="[A-Z]{3}" maxLength={3} required/></label>
 <label>{tx('tr.ws.flFechaDe')}<select name="date_basis" defaultValue={scope.date_basis}><option value="order">{tx('tr.ws.flOrden')}</option><option value="conversation">{tx('tr.ws.flConv')}</option><option value="refund_settlement">{tx('tr.ws.flReemb')}</option></select></label>
 <label>SKU<input name="sku" defaultValue={scope.sku[0]??''}/></label>{scope.sku.slice(1).map(s=><input key={s} type="hidden" name="sku" value={s}/>)}
 <label>{tx('tr.ws.flFuentes')}<select name="source" multiple defaultValue={scope.source} size={4}><option value="hubspot">HubSpot</option><option value="zendesk">Zendesk</option><option value="csv">CSV</option><option value="excel">Excel</option></select></label>
 <label>{tx('tr.ws.flPublicacion')}<input name="snapshot_id" defaultValue={scope.snapshot_id??''} placeholder={tx('tr.ws.flUltimo')}/></label>
 <input type="hidden" name="timezone" value="UTC"/><button type="submit">{tx('tr.ws.flAplicar')}</button><small>{tx('tr.ws.flNota')}</small>
 </form>;}
