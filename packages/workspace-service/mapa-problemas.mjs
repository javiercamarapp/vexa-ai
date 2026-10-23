// «Mapa de problemas»: casos por ESTADO (EE. UU. y México), por tipo de caso, por motivo y por retailer.
// Fuente PROVISIONAL: el Tracker de Excel (columnas de dirección en texto libre). Los pedidos y tickets cargados no traen ubicación.
// Privacidad: el servicio lee la dirección EN MEMORIA, deriva el estado y descarta el texto. Nunca guarda ni devuelve direcciones, calles, nombres ni ciudades.
// k-anonimato: ninguna celda con menos de K_MIN casos sale al cliente; se agrupa en «Otros» y, si ese grupo queda por debajo de K_MIN, se funde con la celda visible más pequeña.
// Solo lectura, acotada al tenant, bajo la sesión y la RLS del usuario, con tope de tiempo en SAVEPOINT. Si no responde: {status:'unavailable'} (jamás 0).
import {guarded} from './catalog-overview.mjs';
import {estadoDeDireccion, claveEstado, nombreEstado} from './geo-estado.mjs';
import {motivoDe, retailerDe} from './fuga-reembolsos.mjs';

export const K_MIN = 5;
export const MAPA_BUDGET_MS = Object.freeze({tracker: 12000});
export const HOJAS_ESPEJO = Object.freeze(['WTR', 'WPR']); // espejos de Warranty Tools / Parts: contarlos duplicaría casos
const TIPOS = new Map([['Warranty Tools', 'Garantía de herramientas'], ['Warranty Parts', 'Garantía de piezas'], ['Refunds', 'Reembolsos'], ['Refunds Requests', 'Solicitudes de reembolso'], ['Return Labels', 'Etiquetas de devolución'],
  ['Quotes', 'Cotizaciones'], ['Waitlist', 'Lista de espera'], ['B&S', 'B&S'], ['RMA', 'RMA'], ['Cancellations', 'Cancelaciones'], ['Cancel Subscriptions', 'Cancelar suscripciones']]);
export const tipoDeHoja = hoja => TIPOS.get(hoja) ?? 'Otro';
export const NOMBRE_RETAILER = Object.freeze({amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy', tienda: 'Tienda CLIENTEX', lowes: "Lowe's", homedepot: 'Home Depot', otro: 'Otro'});

const claveCol = s => String(s ?? '').toLowerCase().replace(/[\s_]+/g, ' ').trim();
/** Dirección de una fila (objeto nombre-de-columna -> texto): la corregida por el cliente manda sobre la de envío y esta sobre la original de Shopify. Solo vive en memoria. */
export function direccionDeFila(o) {
  const por = new Map(Object.entries(o ?? {}).map(([k, v]) => [claveCol(k), v]));
  for (const k of ['corrected address (confirmed by customer)', 'customer address', 'original address (from shopify)']) if (por.get(k)) return String(por.get(k));
  return null;
}
/** Fila cruda -> fila categórica sin texto libre: {hoja, tipo, tieneDireccion, estado, motivo, retailer}. La dirección NO sale de esta función. */
export function filaGeo(sheet, o) {
  const dir = direccionDeFila(o), est = dir ? estadoDeDireccion(dir) : null;
  const motivo = motivoDe(o?.Contact_reason ?? o?.['Contact Reason'] ?? null), ret = retailerDe(o?.Retailer ?? null);
  return {hoja: sheet, tipo: tipoDeHoja(sheet), tieneDireccion: Boolean(dir), estado: claveEstado(est), motivo, retailer: ret};
}

/** Agrupa {etiqueta: n}; lo que queda bajo K_MIN va a «Otros». Si «Otros» queda con 1..K_MIN-1, se funde con el menor visible para que no se pueda restar. */
export function suprimirCeldas(conteos, k = K_MIN) {
  const vis = Object.entries(conteos).filter(([, n]) => n >= k).map(([etiqueta, n]) => ({etiqueta, n})).sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta));
  let otros = Object.entries(conteos).filter(([, n]) => n < k).reduce((a, [, n]) => a + n, 0);
  if (otros > 0 && otros < k && vis.length) otros += vis.pop().n;
  if (otros > 0 && otros < k) return {items: [], otros: 0, ocultoTodo: true};
  return {items: vis, otros, ocultoTodo: false};
}
const contar = (xs, f) => { const m = {}; for (const x of xs) { const k = f(x); if (k) m[k] = (m[k] ?? 0) + 1; } return m; };

/** filas = filaGeo(...)[]. Devuelve cobertura y estados con n >= K_MIN (con sus desgloses k-anónimos). */
export function agregarGeo(filas, k = K_MIN) {
  const conDir = filas.filter(f => f.tieneDireccion), interp = conDir.filter(f => f.estado);
  const porEstado = new Map();
  for (const f of interp) { const a = porEstado.get(f.estado) ?? []; a.push(f); porEstado.set(f.estado, a); }
  const estados = [];
  let suprimidos = 0, casosSuprimidos = 0;
  for (const [clave, fs] of porEstado) {
    if (fs.length < k) { suprimidos++; casosSuprimidos += fs.length; continue; }
    estados.push({clave, pais: clave.slice(0, 2), codigo: clave.slice(3), nombre: nombreEstado(clave), n: fs.length,
      tipos: suprimirCeldas(contar(fs, f => f.tipo), k), motivos: suprimirCeldas(contar(fs, f => f.motivo ?? 'Sin motivo en la hoja'), k),
      retailers: suprimirCeldas(contar(fs, f => (f.retailer ? NOMBRE_RETAILER[f.retailer] : 'Sin retailer')), k)});
  }
  estados.sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
  const pct = (a, b) => (b > 0 ? Math.round((a * 1000) / b) / 10 : null);
  return {
    cobertura: {filas: filas.length, conDireccion: conDir.length, interpretables: interp.length, pctInterpretablesDeDireccion: pct(interp.length, conDir.length), pctInterpretablesDeFilas: pct(interp.length, filas.length),
      pais: {US: interp.filter(f => f.estado.startsWith('US-')).length, MX: interp.filter(f => f.estado.startsWith('MX-')).length}},
    estados, ocultos: {estados: suprimidos, casos: casosSuprimidos, minimo: k},
  };
}

/**
 * Contrato que consumirá el mapa real cuando se conecten Amazon, Walmart y Shopify (ver docs/MAPA.md).
 * @typedef {{orderId:string, canal:'amazon'|'walmart'|'shopify'|'bestbuy', estado:string|null, ciudad?:string|null, mes:string}} GeoPedido   estado = 'US-TX' | 'MX-JAL'
 * @typedef {{orderId:string|null}} ConversacionDePedido
 */
/** Quejas por cada 100 pedidos por estado. queja = pedido con al menos una conversación asociada (se cuenta el pedido una vez). Solo estados con >= minPedidos pedidos; el resto: «No disponible». */
export function quejasPor100Pedidos(pedidos, conversaciones, {minPedidos = 30, k = K_MIN} = {}) {
  const conQueja = new Set((conversaciones ?? []).map(c => c?.orderId).filter(Boolean));
  const vistos = new Set(), por = new Map();
  for (const p of pedidos ?? []) {
    if (!p?.orderId || !p.estado || vistos.has(p.orderId)) continue;
    vistos.add(p.orderId);
    const e = por.get(p.estado) ?? {pedidos: 0, quejas: 0}; e.pedidos++; if (conQueja.has(p.orderId)) e.quejas++; por.set(p.estado, e);
  }
  const salida = [];
  for (const [clave, e] of por) {
    const ok = e.pedidos >= Math.max(minPedidos, k);
    salida.push({clave, nombre: nombreEstado(clave), pedidos: ok ? e.pedidos : null, quejas: ok ? e.quejas : null, por100: ok ? Math.round((e.quejas * 1000) / e.pedidos) / 10 : null,
      nota: ok ? null : `No disponible: menos de ${Math.max(minPedidos, k)} pedidos en el estado.`});
  }
  return salida.sort((a, b) => (b.por100 ?? -1) - (a.por100 ?? -1) || String(a.clave).localeCompare(String(b.clave)));
}

export const NOTA_PROVISIONAL = 'Provisional: la fuente es el Tracker de Excel, no todos los tickets ni todos los pedidos. Cada fila cuenta como un caso; el mismo cliente puede aparecer en más de una hoja.';

export function createGeoMapRepository({database, now = () => new Date(), budgets = MAPA_BUDGET_MS}) {
  return {
    async get() {
      const hoy = now();
      return database.transaction('read', async s => {
        const filasCrudas = await guarded(s, Date.now() + budgets.tracker, 'mapa_tracker', async () => (await s.query(
          `WITH hdr AS (SELECT DISTINCT sheet_name, (c->>'col')::int AS col, c->>'v' AS name FROM public.tracker_row_revisions r, jsonb_array_elements(r.cells) c
              WHERE r.tenant_id=$1 AND r.ticket_state='header' AND r.sheet_name <> ALL($2::text[]) AND (c->>'v' ILIKE '%address%' OR c->>'v' IN ('Contact_reason','Contact Reason','Retailer'))),
            hojas AS (SELECT DISTINCT sheet_name FROM hdr WHERE name ILIKE '%address%'),
            latest AS (SELECT DISTINCT ON (sheet_name,row_number) sheet_name,row_number,cells FROM public.tracker_row_revisions
              WHERE tenant_id=$1 AND ticket_state<>'header' AND sheet_name IN (SELECT sheet_name FROM hojas) ORDER BY sheet_name,row_number,created_at DESC)
           SELECT l.sheet_name AS sheet, bool_or(btrim(coalesce(c->>'v',''))<>'') AS tiene,
             jsonb_object_agg(h.name, btrim(c->>'v')) FILTER (WHERE h.name IS NOT NULL AND btrim(coalesce(c->>'v',''))<>'') AS o
           FROM latest l CROSS JOIN LATERAL jsonb_array_elements(l.cells) c LEFT JOIN hdr h ON h.sheet_name=l.sheet_name AND h.col=(c->>'col')::int
           GROUP BY l.sheet_name, l.row_number LIMIT 30000`, [s.tenantId, HOJAS_ESPEJO])).rows);
        const base = {generatedAt: hoy.toISOString(), class: 'observed', provisional: true, fuente: 'Tracker de Excel', nota: NOTA_PROVISIONAL, minimoPorCelda: K_MIN};
        if (!filasCrudas) return {...base, status: 'unavailable', mapa: {status: 'unavailable'}};
        // Las direcciones viven solo dentro de este bucle; filaGeo devuelve categorías y descarta el texto.
        const filas = [];
        for (const r of filasCrudas) if (r.tiene) filas.push(filaGeo(r.sheet, r.o ?? {}));
        const a = agregarGeo(filas);
        return {...base, status: a.cobertura.interpretables > 0 ? 'ok' : 'empty', ...a};
      });
    },
  };
}
