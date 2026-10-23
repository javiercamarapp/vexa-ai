// Contrato común de conectores de fuentes (Amazon SP-API, Walmart, Mirakl, Shopify, Zendesk...).
//   init(ctx)                      -> verifica configuración y devuelve {ok, scopes?}; sin llamar a nada real si el transporte está apagado
//   backfill(ctx, {from, to, cursor}) -> {records, cursor, done}      histórico acotado por ventana, reanudable por cursor
//   incremental(ctx, {cursor})     -> {records, cursor, done}         solo lo nuevo desde el cursor (el cursor es opaco)
//   toLedger(record)               -> [candidato de libro] | []       mapeo a libro económico: external_id, sku, quantity, kind, currency, amountMinor, effectiveAt, status
// Los candidatos NO se escriben aquí: salen hacia la vía de importación económica existente (economic_batch_import: reporte atestiguado, hash, ventana). Este módulo solo valida y registra el estado.
import {assertSecretRef} from './secrets.mjs';
export const METHODS = Object.freeze(['api_poll', 'webhook', 'file_drop', 'sheet_sync', 'manual_upload', 'stub']);
export const KINDS = Object.freeze(['order', 'refund']);
const fail = code => { throw Object.assign(Error(code), {code}); };
/** Valida un candidato de libro. Devuelve el candidato normalizado o lanza LEDGER_CANDIDATE_INVALID:<campo>. */
export function validateCandidate(c) {
  const bad = f => fail('LEDGER_CANDIDATE_INVALID:' + f);
  if (!c || typeof c !== 'object') bad('shape');
  if (typeof c.externalId !== 'string' || !/^[^\s].{2,300}$/.test(c.externalId)) bad('externalId');
  if (!KINDS.includes(c.kind)) bad('kind');
  if (typeof c.sku !== 'string' || !c.sku.trim() || c.sku.length > 80) bad('sku');
  if (!Number.isInteger(c.quantity) || c.quantity < 1 || c.quantity > 100000) bad('quantity');
  if (!/^[A-Z]{3}$/.test(c.currency)) bad('currency');
  if (c.amountMinor !== null && !/^-?\d+$/.test(String(c.amountMinor))) bad('amountMinor');
  if (!Number.isFinite(Date.parse(c.effectiveAt))) bad('effectiveAt');
  if (!['recorded', 'pending', 'cancelled', 'settled', 'unknown'].includes(c.status)) bad('status');
  return {...c, sku: c.sku.trim(), amountMinor: c.amountMinor === null ? null : String(c.amountMinor), effectiveAt: new Date(c.effectiveAt).toISOString()};
}
/** Define un conector validando su forma. `secretRef` es obligatorio y solo una referencia. */
export function defineConnector(def) {
  for (const f of ['key', 'channel', 'method']) if (typeof def[f] !== 'string' || !def[f]) fail('CONNECTOR_INVALID:' + f);
  if (!/^[a-z0-9_.:-]{1,80}$/.test(def.key) || !METHODS.includes(def.method)) fail('CONNECTOR_INVALID:key_method');
  for (const f of ['init', 'backfill', 'incremental', 'toLedger']) if (typeof def[f] !== 'function') fail('CONNECTOR_INVALID:' + f);
  if (def.secretRef !== undefined) assertSecretRef(def.secretRef);
  return Object.freeze({...def});
}
/**
 * Una corrida: incremental si hay cursor, si no backfill de la ventana; mapea, valida y devuelve candidatos + cursor nuevo; registra source_sync_state (éxito o fallo).
 * Nunca lanza por un fallo del proveedor: devuelve {ok:false, code}. Un candidato inválido se cuenta en `rejected` (no detiene la corrida).
 */
export async function runConnector(connector, {ctx, cursor = null, window = null, record = async () => {}, now = Date.now, maxPages = 20} = {}) {
  const t0 = now(); const out = {ok: true, candidates: [], rejected: 0, cursor, pages: 0, done: false};
  try {
    await connector.init(ctx);
    if (!cursor && !window) fail('RUN_WINDOW_REQUIRED');
    const useIncremental = Boolean(cursor);
    let cur = cursor;
    while (out.pages < maxPages) {
      const page = useIncremental ? await connector.incremental(ctx, {cursor: cur}) : await connector.backfill(ctx, {...window, cursor: cur});
      out.pages++;
      for (const r of page.records ?? []) for (const raw of connector.toLedger(r)) { try { out.candidates.push(validateCandidate(raw)); } catch { out.rejected++; } }
      const moved = page.cursor != null && page.cursor !== cur;
      cur = page.cursor ?? cur; out.cursor = cur;
      if (page.done) { out.done = true; break; }
      if (!moved) break; // sin avance de cursor no se insiste (evita bucles)
    }
    await record({source: connector.key, method: connector.method, ok: true, newRecords: out.candidates.length, latencyMs: now() - t0});
  } catch (e) {
    out.ok = false; out.code = String(e?.code ?? 'SYNC_FAILED').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64).toUpperCase();
    await record({source: connector.key, method: connector.method, ok: false, error: out.code, latencyMs: now() - t0}).catch(() => {});
  }
  return out;
}
