// Read-only coverage band and citation -> origin chain (row -> file -> hash).
// Every statement is tenant-scoped, runs under the caller's RLS session (action "read") and is bounded:
// coverage aggregates only the small `imports` table (never message/conversation tables, which cost a policy call per row).
import {WorkspaceError,uuid} from './contracts.mjs';
const SOURCE_LABELS={hubspot:'HubSpot',zendesk:'Zendesk',csv:'Archivo CSV',excel:'Archivo Excel'};
// Sources the product is meant to incorporate. A source with no import is reported as "not loaded", never as zero loaded.
export const EXPECTED_SOURCES=Object.freeze([
 {key:'hubspot',label:'HubSpot (conversaciones, contactos, asociaciones)'},
 {key:'csv',label:'Archivos CSV (marketplaces, Shopify)'},
 {key:'excel',label:'Excel (Tracker)'},
 {key:'zendesk',label:'Zendesk'}]);
const n=v=>Number(v??0),short=h=>typeof h==='string'?h.slice(0,12):null;
export function createProvenanceRepository({database}){
 return {
  /** Coverage per source: rows accepted+duplicate (incorporated), rejected, pending, plus declared-but-absent sources. */
  async coverage(){return database.transaction('read',async s=>{
   const rows=(await s.query(`SELECT coalesce(c.source,'sin_conexion') AS source,count(*) AS imports,
     count(*) FILTER (WHERE i.state IN ('running','queued','mapping','uploaded','reserved','partial')) AS open_imports,
     coalesce(sum(i.total),0) AS total,coalesce(sum(i.accepted),0) AS accepted,coalesce(sum(i.duplicates),0) AS duplicates,coalesce(sum(i.rejected),0) AS rejected,coalesce(sum(i.pending),0) AS pending,
     max(i.updated_at) AS last_update
     FROM public.imports i LEFT JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id
     WHERE i.tenant_id=$1 GROUP BY 1 ORDER BY 1 LIMIT 50`,[s.tenantId])).rows;
   const present=new Map(rows.map(r=>[r.source,r]));
   const sources=[...EXPECTED_SOURCES.map(e=>e.key),...rows.map(r=>r.source).filter(k=>!EXPECTED_SOURCES.some(e=>e.key===k))].map(key=>{
    const r=present.get(key),label=EXPECTED_SOURCES.find(e=>e.key===key)?.label??SOURCE_LABELS[key]??key;
    if(!r)return {key,label,loaded:false,imports:0,openImports:0,total:0,incorporated:0,rejected:0,pending:0,lastUpdate:null};
    return {key,label,loaded:true,imports:n(r.imports),openImports:n(r.open_imports),total:n(r.total),incorporated:n(r.accepted)+n(r.duplicates),rejected:n(r.rejected),pending:n(r.pending),lastUpdate:r.last_update?new Date(r.last_update).toISOString():null};});
   return {generatedAt:new Date().toISOString(),basis:'imports',note:'Cuenta filas de importaciones registradas. Lo que nunca se importó aparece como «Sin cargar»; no se estima su tamaño.',sources};
  });},
  /** Origin of a quoted message revision: revision hash -> source row -> import file hash. Absent links are reported, never invented. */
  async origin({messageRevisionId}){if(!uuid(messageRevisionId))throw new WorkspaceError('origin_input_invalid',400);
   return database.transaction('read',async s=>{
    const rev=(await s.query('SELECT id,hash,revision,occurred_at FROM public.message_revisions WHERE tenant_id=$1 AND id=$2',[s.tenantId,messageRevisionId])).rows[0];
    if(!rev)throw new WorkspaceError('origin_not_found',404);
    const src=(await s.query(`SELECT r.entity_type,r.external_id,r.content_hash,r.mapping_version,r.provenance->>'payload_ref' AS payload_ref,c.source,c.account_id
      FROM public.source_revisions r LEFT JOIN public.connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
      WHERE r.tenant_id=$1 AND r.message_revision_id=$2 ORDER BY r.created_at LIMIT 1`,[s.tenantId,messageRevisionId])).rows[0];
    let row=null;
    if(src?.payload_ref)row=(await s.query(`SELECT w.row_ref,w.row_hash,w.state,i.file_hash,i.mapping_version,i.created_at AS imported_at
      FROM public.import_rows w JOIN public.imports i ON i.tenant_id=w.tenant_id AND i.id=w.import_id
      WHERE w.tenant_id=$1 AND w.payload_ref=$2 AND w.state IN ('accepted','duplicate') ORDER BY w.created_at LIMIT 1`,[s.tenantId,src.payload_ref])).rows[0]??null;
    const chain=[{step:'message_revision',label:'Cita en el mensaje',hash:rev.hash,hashShort:short(rev.hash),detail:'Revisión '+rev.revision}];
    if(src)chain.push({step:'source_record',label:(SOURCE_LABELS[src.source]??src.source??'Fuente')+' · '+src.entity_type,hash:src.content_hash,hashShort:short(src.content_hash),detail:src.external_id});
    if(row)chain.push({step:'import_row',label:'Fila del archivo',hash:row.row_hash,hashShort:short(row.row_hash),detail:row.row_ref});
    if(row)chain.push({step:'import_file',label:'Archivo importado',hash:row.file_hash,hashShort:short(row.file_hash),detail:'Importado '+new Date(row.imported_at).toISOString().slice(0,10)});
    const complete=!!row;
    return {messageRevisionId,complete,chain,gap:complete?null:src?'Esta revisión llegó por sincronización directa de la fuente: no hay fila de archivo que enlazar.':'No hay registro de fuente enlazado a esta revisión con tu acceso.'};
   });}
 };
}
