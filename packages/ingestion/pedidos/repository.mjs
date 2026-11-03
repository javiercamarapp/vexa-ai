// Repositorio SQL de 20261210000000_order_links. `s` = sesión de createDatabase (s.query, s.tenantId); el llamador abre
// database.transaction('import', ...) por lote. El tenant sale SIEMPRE de la sesión autorizada, nunca de los datos del archivo.
import {shipmentBatches} from './speedship.mjs';
import {ticketOrderRef} from './link.mjs';
import {createHash} from 'node:crypto';

const snake = x => ({carrier: x.carrier, tracking: x.tracking, ship_date: x.shipDate, created_date: x.createdDate, reason: x.reason, sku: x.sku, order_key: x.orderKey, order_format: x.orderFormat, order_source: x.orderSource, retailer: x.retailer, retailer_basis: x.retailerBasis, row_hash: x.rowHash});
export const ticketRefRow = (payload) => {
  const r = ticketOrderRef(payload);
  const row = {ticket_external_id: r.ticketId, order_key: r.orderKey, retailer: r.retailer, purchase_date: /^\d{4}-\d{2}-\d{2}$/.test(r.purchaseDate ?? '') ? r.purchaseDate : null, sku: r.sku, tool_family: r.toolFamily, country: r.country, contact_reason: r.contactReason};
  return {...row, row_hash: createHash('sha256').update(JSON.stringify(row)).digest('hex')};
};
export class OrderLinksRepository {
  constructor(s) { this.s = s; }
  async ingestShipments(shipments) {
    const total = {inserted: 0, updated: 0, unchanged: 0};
    for (const b of shipmentBatches(shipments)) { const r = (await this.s.query('SELECT public.order_shipments_ingest($1::jsonb) AS r', [JSON.stringify(b.map(snake))])).rows[0].r; for (const k of Object.keys(total)) total[k] += r[k]; }
    return total;
  }
  async ingestTicketRefs(ticketPayloads) {
    const rows = ticketPayloads.map(ticketRefRow).filter(r => r.ticket_external_id), total = {inserted: 0, updated: 0, unchanged: 0};
    for (let i = 0; i < rows.length; i += 250) { const r = (await this.s.query('SELECT public.ticket_order_refs_ingest($1::jsonb) AS r', [JSON.stringify(rows.slice(i, i + 250))])).rows[0].r; for (const k of Object.keys(total)) total[k] += r[k]; }
    return total;
  }
  /** Cobertura visible: ligados/total por retailer y entidad; cobertura NULL = sin denominador (nunca 0 %). */
  async coverage() {
    return (await this.s.query('SELECT retailer,entidad,total,ligados,sin_id,sin_ligar,cobertura,con_ticket,con_envio,candidatos FROM public.order_link_coverage WHERE tenant_id=$1 ORDER BY retailer,entidad', [this.s.tenantId])).rows;
  }
}
