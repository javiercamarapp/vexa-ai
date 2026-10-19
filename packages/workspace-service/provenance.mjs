// Read-only coverage band and citation -> origin chain (row -> file -> hash).
// Every statement is tenant-scoped, runs under the caller's RLS session (action "read") and is bounded:
// coverage aggregates only the small `imports` table (never message/conversation tables, which cost a policy call per row).
import {WorkspaceError,uuid} from './contracts.mjs';
import {guarded} from './trends.mjs';
const SOURCE_LABELS={hubspot:'HubSpot',zendesk:'Zendesk',csv:'Archivo CSV',excel:'Archivo Excel'};
// Sources the product is meant to incorporate. A source with no import is reported as "not loaded", never as zero loaded.
export const EXPECTED_SOURCES=Object.freeze([
 {key:'hubspot',label:'HubSpot (conversaciones, contactos)'},
 {key:'associations',label:'Asociaciones ticket–contacto (HubSpot)'},
 {key:'csv',label:'Archivos CSV (importaciones)'},
 {key:'ledger',label:'Marketplaces y Shopify (libro de registros)'},
 {key:'excel',label:'Excel (Tracker)'},
 {key:'attachments',label:'Adjuntos (archivos)'},
 {key:'zendesk',label:'Zendesk'}]);
// Bounded tallies. RLS runs vexa_member() per row (~30 µs), so every table is probed with LIMIT cap+1 first: small tables are counted exactly
// (class observed); larger ones use a 10 % Bernoulli sample scaled x10 and are labelled "estimated". A statement timeout reports "timeout", never a number.
export const EXACT_CAP=3000,SAMPLE_PERCENT=10,STEP_TIMEOUT_MS=3500,TOTAL_BUDGET_MS=9000;
const ENTITY={message:'mensaje',conversation:'conversación',customer:'cliente',order:'pedido',product:'producto'};
const n=v=>Number(v??0),short=h=>typeof h==='string'?h.slice(0,12):null;
export function createProvenanceRepository({database}){
 return {
  /** Coverage per source: import rows (accepted+duplicate / rejected / pending) plus the sources that never create `imports` rows
   *  (Tracker, attachments, the economic ledger, HubSpot associations) read from their own tables with bounded queries. */
  async coverage(){return database.transaction('read',async s=>{
   const started=Date.now(),left=()=>Math.max(500,Math.min(STEP_TIMEOUT_MS,TOTAL_BUDGET_MS-(Date.now()-started)));
   const over=()=>Date.now()-started>=TOTAL_BUDGET_MS;
   const g=(work)=>over()?Promise.resolve(null):guarded(s,work,left());
   // Probe then exact-or-sample tally of `group` over `table` for this tenant.
   const tally=async({table,alias='t',where='true',group,cap=EXACT_CAP,extraSelect='',join=''})=>{
    const probe=await g(async()=>Number((await s.query(`SELECT count(*) AS n FROM (SELECT 1 FROM ${table} ${alias} WHERE ${alias}.tenant_id=$1 AND ${where} LIMIT ${cap+1}) p`,[s.tenantId])).rows[0].n));
    if(probe===null)return null;if(probe===0)return {rows:[],exact:true};
    const exact=probe<=cap,sample=exact?'':` TABLESAMPLE BERNOULLI (${SAMPLE_PERCENT}) REPEATABLE (7)`,factor=exact?1:100/SAMPLE_PERCENT;
    const rows=await g(async()=>(await s.query(`${extraSelect}SELECT ${group} AS g,count(*) AS n FROM ${table} ${alias}${sample} ${join} WHERE ${alias}.tenant_id=$1 AND ${where} GROUP BY 1 LIMIT 200`,[s.tenantId])).rows);
    return rows===null?null:{rows:rows.map(r=>({g:r.g,n:Math.round(Number(r.n)*factor)})),exact};
   };
   const base=(key,extra)=>({key,label:EXPECTED_SOURCES.find(e=>e.key===key).label,loaded:true,status:'ok',class:'observed',imports:0,openImports:0,total:0,incorporated:0,rejected:0,pending:0,lastUpdate:null,detail:[],...extra});
   const none=(key,status='empty')=>base(key,{loaded:false,status});
   // 1. Import rows per connection source (small table, always exact).
   const rows=(await s.query(`SELECT coalesce(c.source,'sin_conexion') AS source,count(*) AS imports,
     count(*) FILTER (WHERE i.state IN ('running','queued','mapping','uploaded','reserved','partial')) AS open_imports,
     coalesce(sum(i.total),0) AS total,coalesce(sum(i.accepted),0) AS accepted,coalesce(sum(i.duplicates),0) AS duplicates,coalesce(sum(i.rejected),0) AS rejected,coalesce(sum(i.pending),0) AS pending,
     max(i.updated_at) AS last_update
     FROM public.imports i LEFT JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id
     WHERE i.tenant_id=$1 GROUP BY 1 ORDER BY 1 LIMIT 50`,[s.tenantId])).rows;
   const present=new Map(rows.map(r=>[r.source,r]));
   const fromImports=(key)=>{const r=present.get(key);if(!r)return none(key);return base(key,{imports:n(r.imports),openImports:n(r.open_imports),total:n(r.total),incorporated:n(r.accepted)+n(r.duplicates),rejected:n(r.rejected),pending:n(r.pending),lastUpdate:r.last_update?new Date(r.last_update).toISOString():null});};
   const by=Object.fromEntries(['hubspot','csv','zendesk'].map(k=>[k,fromImports(k)]));
   // 2. Tracker: own tables (no imports rows). Version that rules = highest rank; current rows = its observations.
   let excel=fromImports('excel');
   const versions=await g(async()=>(await s.query('SELECT id,label,rank,file_sha256 FROM public.tracker_versions WHERE tenant_id=$1 ORDER BY rank DESC LIMIT 20',[s.tenantId])).rows);
   if(versions===null)excel=none('excel','timeout');
   else if(versions.length){const top=versions[0];
    const rowsCurrent=await g(async()=>Number((await s.query('SELECT count(*) AS n FROM (SELECT 1 FROM public.tracker_row_observations WHERE tenant_id=$1 AND version_id=$2 LIMIT 100001) x',[s.tenantId,top.id])).rows[0].n));
    const rejected=await g(async()=>Number((await s.query('SELECT count(*) AS n FROM (SELECT 1 FROM public.tracker_row_rejections WHERE tenant_id=$1 LIMIT 100001) x',[s.tenantId])).rows[0].n));
    const sheets=await g(async()=>(await s.query("SELECT count(*) AS total,count(*) FILTER (WHERE state='closed') AS closed FROM public.tracker_sheet_jobs WHERE tenant_id=$1",[s.tenantId])).rows[0]);
    if(rowsCurrent===null||rejected===null||sheets===null)excel=none('excel','timeout');
    else excel=base('excel',{imports:versions.length,total:rowsCurrent+rejected,incorporated:rowsCurrent,rejected,
     detail:[`Versión que manda: ${top.label??'rango '+top.rank} · ${String(top.file_sha256).slice(0,8)} (mayor rango de ${versions.length})`,`${rowsCurrent.toLocaleString('es-MX')} filas vigentes · ${rejected.toLocaleString('es-MX')} rechazadas · ${n(sheets.closed)}/${n(sheets.total)} hojas cerradas`],
     sheets:{closed:n(sheets.closed),total:n(sheets.total)},topVersion:{label:top.label,rank:n(top.rank),sha:String(top.file_sha256).slice(0,8)}});}
   // 3. Attachments: blobs by state (index tenant_id,state).
   let attachments=none('attachments');
   const blobs=await tally({table:'public.attachment_blobs',alias:'b',group:'b.state',cap:20000});
   if(blobs===null)attachments=none('attachments','timeout');
   else if(blobs.rows.length){const c=Object.fromEntries(blobs.rows.map(r=>[r.g,r.n])),k=x=>c[x]??0,total=blobs.rows.reduce((a,r)=>a+r.n,0);
    attachments=base('attachments',{class:blobs.exact?'observed':'estimated',total,incorporated:k('verified')+k('uploaded'),rejected:k('failed'),pending:k('planned')+k('metadata_only'),
     detail:[`${k('verified').toLocaleString('es-MX')} verificados · ${k('uploaded').toLocaleString('es-MX')} subidos · ${k('metadata_only').toLocaleString('es-MX')} solo metadatos · ${k('planned').toLocaleString('es-MX')} planificados · ${k('failed').toLocaleString('es-MX')} fallidos`].concat(blobs.exact?[]:[`Estimado con una muestra del ${SAMPLE_PERCENT} %.`])});}
   // 4. Economic ledger: entities per source name x currency x kind (counts only; currencies are never added together).
   let ledger=none('ledger');
   const ledgerProbe=await g(async()=>Number((await s.query('SELECT count(*) AS n FROM (SELECT 1 FROM public.economic_ledger_entries WHERE tenant_id=$1 LIMIT 20001) p',[s.tenantId])).rows[0].n));
   if(ledgerProbe===null)ledger=none('ledger','timeout');
   else if(ledgerProbe>0){const exact=ledgerProbe<=20000,factor=exact?1:100/SAMPLE_PERCENT;
    const lrows=await g(async()=>(await s.query(`WITH src AS (SELECT DISTINCT ON(source_id) source_id,name FROM public.economic_source_versions WHERE tenant_id=$1 ORDER BY source_id,version DESC)
      SELECT coalesce(src.name,'Fuente sin nombre') AS name,e.currency AS currency,e.kind AS kind,count(DISTINCT e.entity_id) AS n
      FROM public.economic_ledger_entries e${exact?'':` TABLESAMPLE BERNOULLI (${SAMPLE_PERCENT}) REPEATABLE (7)`} LEFT JOIN src ON src.source_id=e.source_id WHERE e.tenant_id=$1 GROUP BY 1,2,3 ORDER BY 1,2,3 LIMIT 60`,[s.tenantId])).rows);
    if(lrows===null)ledger=none('ledger','timeout');
    else{const groups=new Map();for(const r of lrows){const k=r.name+' · '+r.currency,o=groups.get(k)??{orders:0,refunds:0,other:0};const v=Math.round(Number(r.n)*factor);if(r.kind==='order')o.orders+=v;else if(r.kind==='refund')o.refunds+=v;else o.other+=v;groups.set(k,o);}
     const total=[...groups.values()].reduce((a,o)=>a+o.orders+o.refunds+o.other,0),lines=[...groups.entries()].slice(0,6).map(([k,o])=>`${k}: ${o.orders.toLocaleString('es-MX')} pedidos · ${o.refunds.toLocaleString('es-MX')} reembolsos${o.other?` · ${o.other.toLocaleString('es-MX')} otros`:''}`);
     ledger=base('ledger',{class:exact?'observed':'estimated',total,incorporated:total,detail:[...lines,...(groups.size>6?[`y ${groups.size-6} grupos más`]:[]),'Conteo de registros por fuente y moneda; las monedas no se suman.',...(exact?[]:[`Estimado con una muestra del ${SAMPLE_PERCENT} %.`])]});}}
   // 5. HubSpot ticket-contact associations: facts by state and active bindings (links).
   let associations=none('associations');
   const facts=await tally({table:'public.native_customer_associations',alias:'f',group:'f.resolution_state'});
   if(facts===null)associations=none('associations','timeout');
   else if(facts.rows.length){const links=await tally({table:'public.conversation_customer_association_bindings',alias:'b',where:'b.active',group:"'links'"});
    const c=Object.fromEntries(facts.rows.map(r=>[r.g,r.n])),total=facts.rows.reduce((a,r)=>a+r.n,0),linkCount=links&&links.rows[0]?links.rows[0].n:links===null?null:0,exact=facts.exact&&(links===null||links.exact);
    associations=base('associations',{class:exact?'observed':'estimated',total,incorporated:total,
     detail:[`${total.toLocaleString('es-MX')} hechos (resueltos ${(c.resolved??0).toLocaleString('es-MX')} · pendientes ${(c.pending??0).toLocaleString('es-MX')} · por revisar ${(c.blocked??0).toLocaleString('es-MX')} · retenidos ${(c.retained??0).toLocaleString('es-MX')})`,linkCount===null?'Vínculos: no disponible ahora':`${linkCount.toLocaleString('es-MX')} vínculos activos conversación–cliente`].concat(exact?[]:[`Estimado con una muestra del ${SAMPLE_PERCENT} %.`])});}
   const sources=[by.hubspot,associations,by.csv,ledger,excel,attachments,by.zendesk];
   for(const r of rows)if(!EXPECTED_SOURCES.some(e=>e.key===r.source))sources.push({...fromImports(r.source),label:SOURCE_LABELS[r.source]??r.source,key:r.source});
   return {generatedAt:new Date().toISOString(),basis:'imports+tables',note:'Importaciones registradas más las fuentes que no pasan por importaciones (Tracker, adjuntos, libro de registros, asociaciones), leídas con consultas acotadas; una cifra con «Estimado» viene de una muestra rotulada. Lo que nunca se cargó aparece como «Sin cargar»; no se estima su tamaño.',sources};
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
    if(src)chain.push({step:'source_record',label:(SOURCE_LABELS[src.source]??src.source??'Fuente')+' · '+(ENTITY[src.entity_type]??src.entity_type),hash:src.content_hash,hashShort:short(src.content_hash),detail:src.external_id});
    if(row)chain.push({step:'import_row',label:'Fila del archivo',hash:row.row_hash,hashShort:short(row.row_hash),detail:row.row_ref});
    if(row)chain.push({step:'import_file',label:'Archivo importado',hash:row.file_hash,hashShort:short(row.file_hash),detail:'Importado '+new Date(row.imported_at).toISOString().slice(0,10)});
    const complete=!!row;
    return {messageRevisionId,complete,chain,gap:complete?null:src?'Esta revisión llegó por sincronización directa de la fuente: no hay fila de archivo que enlazar.':'No hay registro de fuente enlazado a esta revisión con tu acceso.'};
   });}
 };
}
