// Fuente del Tracker de Excel. Interfaz común `TrackerSource`:
//   id                         texto estable de la fuente (sin secretos)
//   describe()                 -> {kind, method, location}        para source_sync_state / pantalla
//   listVersions()             -> [{label, sha256, receivedAt, read():Promise<Uint8Array>}]  orden ascendente de recepción: la ÚLTIMA manda (igual que VERSIONS de loader.mjs)
// Implementación real y probada: carpeta local/compartida (incluye carpetas sincronizadas de OneDrive/Drive). Google Sheets y OneDrive/Graph: contrato con transporte inyectable,
// apagado por defecto (sin llamadas reales; secreto solo por referencia). El resultado alimenta el cargador existente (packages/ingestion/tracker/loader.mjs) vía un `importer`.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertSecretRef, createSecretResolver, transportApagado} from './secrets.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
export function folderTrackerSource({dir, pattern = /tracker.*\.xlsx$/i, id = 'tracker-folder'}) {
  return Object.freeze({
    id, describe: () => ({kind: 'folder', method: 'file_drop', location: path.basename(dir)}),
    async listVersions() {
      const root = await fs.realpath(dir), out = [];
      for (const ent of await fs.readdir(root, {withFileTypes: true})) {
        if (!ent.isFile() || ent.isSymbolicLink() || ent.name.startsWith('~$') || ent.name.startsWith('.') || !pattern.test(ent.name)) continue;
        const full = path.join(root, ent.name), st = await fs.stat(full), bytes = await fs.readFile(full);
        out.push({label: ent.name, sha256: sha(bytes), receivedAt: new Date(st.mtimeMs).toISOString(), read: async () => new Uint8Array(bytes)});
      }
      const seen = new Set();
      return out.sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || a.label.localeCompare(b.label)).filter(v => (seen.has(v.sha256) ? false : seen.add(v.sha256)));
    },
  });
}
function remoteSource({kind, method, id, service, secretRef, secrets, transport = transportApagado, fileId, listOp, readOp}) {
  assertSecretRef(secretRef);
  const resolver = secrets ? createSecretResolver(secrets) : null;
  const call = async (operation, params) => transport.request({service, operation, params, credential: resolver ? await resolver.resolve(secretRef) : undefined});
  return Object.freeze({
    id, describe: () => ({kind, method, location: kind + ':' + String(fileId).slice(0, 8) + '…'}),
    async listVersions() {
      const revs = await call(listOp, {fileId}); // [{id, modifiedTime}] en cualquier orden
      return (revs?.items ?? []).map(r => ({label: String(r.label ?? r.id), receivedAt: new Date(r.modifiedTime).toISOString(), sha256: String(r.sha256 ?? ''), read: async () => new Uint8Array(await call(readOp, {fileId, revisionId: r.id}))}))
        .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
    },
  });
}
/** Google Sheets/Drive: exporta el libro como .xlsx (Drive API files.export). `secretRef` apunta a la credencial de servicio en el almacén. */
export const googleSheetsTrackerSource = o => remoteSource({kind: 'google_sheets', method: 'sheet_sync', id: o.id ?? 'tracker-gsheets', service: 'google-drive', listOp: 'revisions.list', readOp: 'files.export.xlsx', ...o});
/** OneDrive/SharePoint (Microsoft Graph): versiones del archivo y contenido .xlsx. */
export const oneDriveTrackerSource = o => remoteSource({kind: 'onedrive', method: 'sheet_sync', id: o.id ?? 'tracker-onedrive', service: 'microsoft-graph', listOp: 'driveItem.versions', readOp: 'driveItem.version.content', ...o});

/** Una pasada de sincronización del Tracker: importa solo versiones no recibidas, en orden. Misma semántica de recibos que runFolderImport. */
export async function syncTracker({source, importer, receipts, record = async () => {}, now = Date.now}) {
  const t0 = now(), res = {imported: [], failed: null};
  try {
    for (const v of await source.listVersions()) {
      if (v.sha256 && await receipts.has(v.sha256)) continue;
      const bytes = await v.read(), hash = v.sha256 || sha(bytes);
      if (await receipts.has(hash)) continue;
      try { await importer({label: v.label, sha256: hash, receivedAt: v.receivedAt, bytes}); await receipts.add(hash, {label: v.label, at: new Date(now()).toISOString()}); res.imported.push({label: v.label, sha256: hash}); }
      catch (e) { res.failed = {label: v.label, code: String(e?.code ?? 'IMPORT_FAILED').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64).toUpperCase()}; break; }
    }
  } catch (e) { res.failed = {label: null, code: String(e?.code ?? 'SOURCE_FAILED').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64).toUpperCase()}; }
  const d = source.describe();
  await record({source: 'tracker', method: d.method, ok: !res.failed, newRecords: res.imported.length, error: res.failed?.code ?? null, latencyMs: now() - t0}).catch(() => {});
  return res;
}
