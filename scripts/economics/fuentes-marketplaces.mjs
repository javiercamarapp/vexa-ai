// Lectura verificada de los 8 CSV (hash y tamaño antes/después; solo lectura) y mapeo completo. Sin red, sin base.
import {readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {MARKETPLACE_FILES, mapMarketplaceFile, mergeOrderIndexes, sha256hex} from '../../packages/economics/marketplace-map.mjs';

export const DEFAULT_ROOT = path.join(process.env.HOME, 'vexa/private/clientex-integration-20261005/received-20261005/VEXA');
export const CLIENTEX_TENANT = '00000000-0000-4000-8000-000000000000';

export function readVerified(root, spec) {
  const p = path.join(root, spec.rel);
  const bytes = readFileSync(p);
  const sha = sha256hex(bytes);
  if (sha !== spec.sha256) throw new Error(`HASH_DISTINTO ${spec.key}: ${sha.slice(0, 12)}… != ${spec.sha256.slice(0, 12)}…`);
  return {bytes, text: bytes.toString('utf8'), sha, size: statSync(p).size};
}

/** Devuelve {perFile:[{spec,source,items,rejected,stats}], items, rejected, sources}. Orden: pedidos primero, luego devoluciones. */
export function mapAllMarketplaces({root = DEFAULT_ROOT, tenantId = CLIENTEX_TENANT, unknownCurrency = 'rechazar', now = new Date(), readFile = readVerified} = {}) {
  const perFile = [], indexes = [];
  for (const spec of MARKETPLACE_FILES.filter(s => s.kind === 'order')) {
    const f = readFile(root, spec);
    const r = mapMarketplaceFile({spec: {...spec, sha256: f.sha}, text: f.text, tenantId, now, unknownCurrency});
    indexes.push(r.orderIndexOut); perFile.push({spec, ...r, fileSha: f.sha});
  }
  const orderIndex = mergeOrderIndexes(indexes);
  for (const spec of MARKETPLACE_FILES.filter(s => s.kind === 'refund')) {
    const f = readFile(root, spec);
    const r = mapMarketplaceFile({spec: {...spec, sha256: f.sha}, text: f.text, tenantId, now, unknownCurrency, orderIndex});
    perFile.push({spec, ...r, fileSha: f.sha});
  }
  const items = perFile.flatMap(p => p.items.map(it => ({sourceId: p.source.sourceId, ...it})));
  return {perFile, items, rejected: perFile.flatMap(p => p.rejected), sources: perFile.filter(p => p.source).map(p => p.source)};
}
