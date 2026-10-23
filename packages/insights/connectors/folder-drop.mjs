// Importación PROGRAMADA desde una carpeta compartida (local, red o carpeta sincronizada de OneDrive/Drive): detecta archivos CSV/XLSX nuevos de pedidos, reembolsos y Tracker,
// los identifica por reglas de nombre, los deduplica por SHA-256 (un recibo por contenido) y los entrega a un `importer` inyectado (la vía existente: economic_batch_import / loader del Tracker).
// Seguridad: solo lee la carpeta indicada (sin seguir enlaces simbólicos ni salir de ella), espera a que el archivo deje de crecer (`settleMs`) y NUNCA imprime contenido.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

/** Reglas de nombre por defecto -> {source, kind}. El primer acierto manda; sin acierto el archivo se ignora y se reporta como `unmatched`. */
export const DEFAULT_RULES = Object.freeze([
  {re: /^pedidos[-_ ]amazon.*\.csv$/i, source: 'amazon-pedidos', kind: 'order'}, {re: /^pedidos[-_ ]walmart.*\.csv$/i, source: 'walmart-pedidos', kind: 'order'},
  {re: /^pedidos[-_ ]mirakl[-_ ]us.*\.csv$/i, source: 'mirakl-us-pedidos', kind: 'order'}, {re: /^pedidos[-_ ]mirakl[-_ ]ca.*\.csv$/i, source: 'mirakl-ca-pedidos', kind: 'order'},
  {re: /^devoluciones[-_ ]amazon.*\.csv$/i, source: 'amazon-devoluciones', kind: 'refund'}, {re: /^devoluciones[-_ ]walmart.*\.csv$/i, source: 'walmart-devoluciones', kind: 'refund'},
  {re: /^devoluciones[-_ ]mirakl[-_ ]us.*\.csv$/i, source: 'mirakl-us-devoluciones', kind: 'refund'}, {re: /^devoluciones[-_ ]mirakl[-_ ]ca.*\.csv$/i, source: 'mirakl-ca-devoluciones', kind: 'refund'},
  {re: /^pedidos[-_ ]shopify.*\.csv$/i, source: 'shopify-pedidos', kind: 'order'}, {re: /^reembolsos[-_ ]shopify.*\.csv$/i, source: 'shopify-reembolsos', kind: 'refund'},
  {re: /tracker.*\.xlsx$/i, source: 'tracker', kind: 'tracker'},
]);
const ext = f => path.extname(f).toLowerCase();
export const classify = (name, rules = DEFAULT_RULES) => { const r = rules.find(x => x.re.test(name)); return r ? {source: r.source, kind: r.kind} : null; };

/** Recibos en memoria (pruebas) o en un archivo JSON (producción local). Un recibo = contenido ya importado con éxito. */
export function memoryReceipts() { const m = new Map(); return {async has(h) { return m.has(h); }, async add(h, meta) { m.set(h, meta); }, all: () => [...m.entries()]}; }
export function fileReceipts(file) {
  const load = async () => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return {}; } };
  return {async has(h) { return Object.hasOwn(await load(), h); }, async add(h, meta) { const d = await load(); d[h] = meta; await fs.mkdir(path.dirname(file), {recursive: true}); const tmp = file + '.tmp'; await fs.writeFile(tmp, JSON.stringify(d)); await fs.rename(tmp, file); }};
}
/** Lista archivos nuevos y estables (no recibidos). No lee fuera de `dir`. */
export async function scanFolder({dir, rules = DEFAULT_RULES, receipts, settleMs = 5000, now = Date.now, extensions = ['.csv', '.xlsx']}) {
  const root = await fs.realpath(dir), found = [], unmatched = [], unsettled = [], seen = new Set();
  for (const ent of await fs.readdir(root, {withFileTypes: true})) {
    if (!ent.isFile() || ent.isSymbolicLink() || ent.name.startsWith('.') || ent.name.startsWith('~$') || !extensions.includes(ext(ent.name))) continue;
    const full = path.join(root, ent.name), st = await fs.stat(full), c = classify(ent.name, rules);
    if (!c) { unmatched.push(ent.name); continue; }
    if (now() - st.mtimeMs < settleMs) { unsettled.push(ent.name); continue; }
    const bytes = await fs.readFile(full), sha256 = createHash('sha256').update(bytes).digest('hex');
    if ((receipts && await receipts.has(sha256)) || seen.has(sha256)) continue; // mismo contenido ya recibido o repetido en esta pasada
    seen.add(sha256);
    found.push({...c, name: ent.name, sha256, size: st.size, mtimeMs: st.mtimeMs, read: async () => bytes});
  }
  found.sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name)); // orden de recepción: el último manda
  return {found, unmatched, unsettled};
}
/**
 * Una pasada: escanea, importa en orden y anota recibo SOLO si el importador terminó bien. Un fallo detiene la pasada (no se importa un archivo posterior sobre uno fallido),
 * registra el error y deja el archivo para reintentar en la siguiente corrida. `record` anota source_sync_state con método file_drop.
 */
export async function runFolderImport({dir, importer, receipts, record = async () => {}, rules, settleMs, now = Date.now, extensions}) {
  const t0 = now(), res = {imported: [], failed: null, unmatched: [], unsettled: []};
  try {
    const scan = await scanFolder({dir, rules, receipts, settleMs, now, extensions});
    res.unmatched = scan.unmatched; res.unsettled = scan.unsettled;
    for (const f of scan.found) {
      try { const r = await importer(f); await receipts.add(f.sha256, {name: f.name, source: f.source, at: new Date(now()).toISOString(), result: r?.summary ?? null}); res.imported.push({name: f.name, source: f.source, sha256: f.sha256}); }
      catch (e) { res.failed = {name: f.name, code: String(e?.code ?? 'IMPORT_FAILED').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64).toUpperCase()}; break; }
    }
    await record({source: 'file_drop:' + path.basename(dir).toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 60), method: 'file_drop', ok: !res.failed, newRecords: res.imported.length, error: res.failed?.code ?? null, latencyMs: now() - t0});
  } catch (e) {
    res.failed = {name: null, code: String(e?.code ?? 'SCAN_FAILED').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64).toUpperCase()};
    await record({source: 'file_drop', method: 'file_drop', ok: false, error: res.failed.code, latencyMs: now() - t0}).catch(() => {});
  }
  return res;
}
