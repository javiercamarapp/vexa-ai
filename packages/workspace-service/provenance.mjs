// Read-only coverage band and citation -> origin chain (row -> file -> hash).
// Every statement is tenant-scoped, runs under the caller's RLS session (action "read") and is bounded:
// coverage aggregates only the small `imports` table (never message/conversation tables, which cost a policy call per row).
import {WorkspaceError,uuid} from './contracts.mjs';
import {guarded} from './trends.mjs';
import {readLedgerCounts,readAssociationCounts,summaryLabel,summaryMeta,attempt} from './summaries.mjs';
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
export const EXACT_CAP=3000,SAMPLE_PERCENT=10,STEP_TIMEOUT_MS=3500,EXACT_STEP_MS=2500,TOTAL_BUDGET_MS=9000;
const ENTITY={message:'mensaje',conversation:'conversación',customer:'cliente',order:'pedido',product:'producto'};
const n=v=>Number(v??0),short=h=>typeof h==='string'?h.slice(0,12):null;
/** Rejected rows are rows the validation rules leave out on purpose (so doubtful data never mixes with trusted data); they are not a load failure.
 *  Exact figures, no adjective about quality; pending rows are named separately because those ARE still to be processed. */
export function rejectionNote({total,incorporated,rejected,pending}){
 if(!(rejected>0)||!(total>0))return null;
 const f=x=>x.toLocaleString('es-MX'),share=Math.round(rejected*1000/total)/10;
 return `${f(incorporated)} de ${f(total)} filas están incorporadas. Las otras ${f(rejected)} (${share.toLocaleString('es-MX')} %) no cumplen las reglas de validación y se dejan fuera a propósito para no mezclar datos dudosos: no es una falla de la carga.${pending>0?` Aún hay ${f(pending)} pendientes de procesar.`:' No quedan filas pendientes.'}`;
}
/** Desglose de las rechazadas de HubSpot por error_code (agregado, sin cargar filas). "Solo metadatos" (ENTITY_METADATA_ONLY) son registros sin mensajes: no son conversaciones
 *  perdidas, así que el porcentaje se calcula SOLO sobre las filas con conversación (total - solo metadatos). Sin el agregado (tiempo agotado): status 'unavailable', nada inventado. */
export function rejectionBreakdown({total,incorporated,rejected,codes}){
 if(!codes||Object.keys(codes).length===0)return {status:'unavailable',metadataOnly:null,bodyIncomplete:null,roleAmbiguous:null,otherDefects:null,defects:null,conversationRows:null,conversationIncorporated:null,incorporatedShare:null};
 const c=k=>n(codes[k]),metadataOnly=Math.min(c('ENTITY_METADATA_ONLY'),Math.max(0,rejected)),defects=Math.max(0,rejected-metadataOnly),bodyIncomplete=Math.min(c('BODY_INCOMPLETE'),defects),roleAmbiguous=Math.min(c('ROLE_AMBIGUOUS'),defects-bodyIncomplete);
 const conversationRows=Math.max(0,total-metadataOnly);
 return {status:'ok',metadataOnly,bodyIncomplete,roleAmbiguous,otherDefects:defects-bodyIncomplete-roleAmbiguous,defects,conversationRows,conversationIncorporated:incorporated,incorporatedShare:conversationRows>0?Math.round(incorporated*1000/conversationRows)/10:null};
}
/** Texto honesto para HubSpot: conversaciones incorporadas / rechazadas con defecto / solo metadatos, con la base del porcentaje rotulada. Sin desglose cae al texto general + «No disponible». */
export function hubspotRejectionNote({total,incorporated,rejected,pending},b){
 const f=x=>x.toLocaleString('es-MX');
 if(!(rejected>0)||!(total>0))return null;
 if(!b||b.status!=='ok')return `${rejectionNote({total,incorporated,rejected,pending})} Desglose de las rechazadas por motivo: No disponible ahora (sin filas por motivo o consulta acotada fuera de tiempo).`;
 const parts=[b.bodyIncomplete>0&&`cuerpo incompleto ${f(b.bodyIncomplete)}`,b.roleAmbiguous>0&&`rol ambiguo ${f(b.roleAmbiguous)}`,b.otherDefects>0&&`otros motivos ${f(b.otherDefects)}`].filter(Boolean);
 const share=b.incorporatedShare===null?'—':b.incorporatedShare.toLocaleString('es-MX')+' %';
 return `Conversaciones incorporadas: ${f(incorporated)} de ${f(b.conversationRows)} filas con conversación (${share}; base: las ${f(total)} filas leídas menos ${f(b.metadataOnly)} registros solo de metadatos). `
  +`Rechazadas con defecto: ${f(b.defects)}${parts.length?` (${parts.join(' · ')})`:''}. `
  +`Registros solo de metadatos (sin mensajes): ${f(b.metadataOnly)}: no son conversaciones perdidas. `
  +(pending>0?`Aún hay ${f(pending)} pendientes de procesar.`:'No quedan filas pendientes.');
}
export function createProvenanceRepository({database}){
 return {
  /** Coverage per source: import rows (accepted+duplicate / rejected / pending) plus the sources that never create `imports` rows
   *  (Tracker, attachments, the economic ledger, HubSpot associations) read from their own tables with bounded queries. */
  async coverage(){return database.transaction('read',async s=>{
   const started=Date.now(),left=()=>Math.max(500,Math.min(STEP_TIMEOUT_MS,TOTAL_BUDGET_MS-(Date.now()-started)));
   const over=()=>Date.now()-started>=TOTAL_BUDGET_MS;
   const g=(work,ms)=>over()?Promise.resolve(null):guarded(s,work,ms??left());
   // Exact-first tally of `group` over `table` for this tenant. A cheap probe (LIMIT cap+1) answers small tables at once. Larger tables get an EXACT count
   // under a short statement timeout (fast when the read policy evaluates membership once per statement: migration 20261021000000, the 0055 pattern);
   // only if that exact count does not finish in time does the tally fall back to the 10 % Bernoulli sample, which is then labelled "Estimado".
   const tally=async({table,alias='t',where='true',group,cap=EXACT_CAP,tryExact=true,extraSelect='',join=''})=>{
    const probe=await g(async()=>Number((await s.query(`SELECT count(*) AS n FROM (SELECT 1 FROM ${table} ${alias} WHERE ${alias}.tenant_id=$1 AND ${where} LIMIT ${cap+1}) p`,[s.tenantId])).rows[0].n));
    if(probe===null)return null;if(probe===0)return {rows:[],exact:true};
    const count=(sample)=>async()=>(await s.query(`${extraSelect}SELECT ${group} AS g,count(*) AS n FROM ${table} ${alias}${sample} ${join} WHERE ${alias}.tenant_id=$1 AND ${where} GROUP BY 1 LIMIT 200`,[s.tenantId])).rows;
    if(probe<=cap||tryExact){const rows=await g(count(''),probe<=cap?undefined:Math.min(EXACT_STEP_MS,left()));if(rows!==null)return {rows:rows.map(r=>({g:r.g,n:Number(r.n)})),exact:true};if(probe<=cap)return null;}
    const rows=await g(count(` TABLESAMPLE BERNOULLI (${SAMPLE_PERCENT}) REPEATABLE (7)`));
    return rows===null?null:{rows:rows.map(r=>({g:r.g,n:Math.round(Number(r.n)*100/SAMPLE_PERCENT)})),exact:false};
   };
   const base=(key,extra)=>({key,label:EXPECTED_SOURCES.find(e=>e.key===key).label,loaded:true,status:'ok',class:'observed',imports:0,openImports:0,total:0,incorporated:0,rejected:0,pending:0,lastUpdate:null,detail:[],rejectionNote:null,...extra});
   const none=(key,status='empty')=>base(key,{loaded:false,status});
   // 1. Import rows per connection source (small table, always exact).
   const rows=(await s.query(`SELECT coalesce(c.source,'sin_conexion') AS source,count(*) AS imports,
     count(*) FILTER (WHERE i.state IN ('running','queued','mapping','uploaded','reserved','partial')) AS open_imports,
     coalesce(sum(i.total),0) AS total,coalesce(sum(i.accepted),0) AS accepted,coalesce(sum(i.duplicates),0) AS duplicates,coalesce(sum(i.rejected),0) AS rejected,coalesce(sum(i.pending),0) AS pending,
     max(i.updated_at) AS last_update
     FROM public.imports i LEFT JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id
     WHERE i.tenant_id=$1 GROUP BY 1 ORDER BY 1 LIMIT 50`,[s.tenantId])).rows;
   const present=new Map(rows.map(r=>[r.source,r]));
   const fromImports=(key)=>{const r=present.get(key);if(!r)return none(key);const total=n(r.total),incorporated=n(r.accepted)+n(r.duplicates),rejected=n(r.rejected),pending=n(r.pending);
    return base(key,{imports:n(r.imports),openImports:n(r.open_imports),total,incorporated,rejected,pending,rejectionNote:rejectionNote({total,incorporated,rejected,pending}),lastUpdate:r.last_update?new Date(r.last_update).toISOString():null});};
   const by=Object.fromEntries(['hubspot','csv','zendesk'].map(k=>[k,fromImports(k)]));
   // 1b. HubSpot: las rechazadas por error_code. Una sola agregación acotada (tenant + importaciones de HubSpot + state='rejected'), exacta o «No disponible»; jamás una muestra.
   if(by.hubspot.loaded&&by.hubspot.rejected>0){const h=by.hubspot,codes=await g(async()=>Object.fromEntries((await s.query(`SELECT coalesce(r.error_code,'SIN_CODIGO') AS code,count(*) AS n FROM public.import_rows r
      WHERE r.tenant_id=$1 AND r.state='rejected' AND r.import_id IN (SELECT i.id FROM public.imports i JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id WHERE i.tenant_id=$1 AND c.source='hubspot')
      GROUP BY 1 LIMIT 50`,[s.tenantId])).rows.map(r=>[r.code,Number(r.n)])),Math.min(EXACT_STEP_MS,left()));
    h.rejectionBreakdown=rejectionBreakdown({total:h.total,incorporated:h.incorporated,rejected:h.rejected,codes});
    h.rejectionNote=hubspotRejectionNote(h,h.rejectionBreakdown);}
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
     detail:[`Versión que manda: ${top.label??'rango '+top.rank} (mayor rango de ${versions.length})`,`${rowsCurrent.toLocaleString('es-MX')} filas vigentes · ${rejected.toLocaleString('es-MX')} rechazadas · ${n(sheets.closed)}/${n(sheets.total)} hojas cerradas`,`Huella del archivo de esa versión: ${String(top.file_sha256).slice(0,8)}`],
     sheets:{closed:n(sheets.closed),total:n(sheets.total)},topVersion:{label:top.label,rank:n(top.rank),sha:String(top.file_sha256).slice(0,8)}});}
   // 3. Attachments: blobs by state (index tenant_id,state).
   let attachments=none('attachments');
   const blobs=await tally({table:'public.attachment_blobs',alias:'b',group:'b.state',cap:20000,tryExact:false});
   if(blobs===null)attachments=none('attachments','timeout');
   else if(blobs.rows.length){const c=Object.fromEntries(blobs.rows.map(r=>[r.g,r.n])),k=x=>c[x]??0,total=blobs.rows.reduce((a,r)=>a+r.n,0);
    attachments=base('attachments',{class:blobs.exact?'observed':'estimated',total,incorporated:k('verified')+k('uploaded'),rejected:k('failed'),pending:k('planned')+k('metadata_only'),
     detail:[`${k('verified').toLocaleString('es-MX')} verificados · ${k('uploaded').toLocaleString('es-MX')} subidos · ${k('metadata_only').toLocaleString('es-MX')} solo metadatos · ${k('planned').toLocaleString('es-MX')} planificados · ${k('failed').toLocaleString('es-MX')} fallidos`].concat(blobs.exact?[]:[`Estimado con una muestra del ${SAMPLE_PERCENT} %.`])});}
   // 4. Economic ledger: entities per source name x currency x kind (counts only; currencies are never added together).
   let ledger=none('ledger');
   // Exact entity count per source x currency x kind (latest-revision-agnostic: DISTINCT entity_id). Exact within EXACT_STEP_MS; otherwise a labelled 10 % sample.
   const ledgerQuery=(sample)=>async()=>(await s.query(`WITH src AS (SELECT DISTINCT ON(source_id) source_id,name FROM public.economic_source_versions WHERE tenant_id=$1 ORDER BY source_id,version DESC)
      SELECT coalesce(src.name,'Fuente sin nombre') AS name,e.currency AS currency,e.kind AS kind,count(DISTINCT e.entity_id) AS n,count(*) AS revisions
      FROM public.economic_ledger_entries e${sample} LEFT JOIN src ON src.source_id=e.source_id WHERE e.tenant_id=$1 GROUP BY 1,2,3 ORDER BY 1,2,3 LIMIT 60`,[s.tenantId])).rows;
   // Resumen precomputado (20261022000000) primero: conteos exactos a la fecha del refresco, sin escanear el libro. Sin él: conteo directo o muestra (camino anterior).
   let lrows,exact,factor,ledgerSummary=null;
   const lsum=await readLedgerCounts(s);
   if(lsum.availability==='ready'){
    const names=await attempt(s,async()=>new Map((await s.query('SELECT DISTINCT ON(source_id) source_id,name FROM public.economic_source_versions WHERE tenant_id=$1 ORDER BY source_id,version DESC LIMIT 100',[s.tenantId])).rows.map(r=>[r.source_id,r.name])));
    if(names.value){lrows=lsum.groups.map(x=>({name:names.value.get(x.sourceId)??'Fuente sin nombre',currency:x.currency,kind:x.kind,n:x.entities,revisions:x.revisions}));exact=lsum.freshness==='fresh';factor=1;ledgerSummary={meta:summaryMeta(lsum),label:summaryLabel(lsum)};}
   }
   if(!lrows){lrows=await g(ledgerQuery(''),Math.min(EXACT_STEP_MS,left()));exact=lrows!==null;if(lrows===null)lrows=await g(ledgerQuery(` TABLESAMPLE BERNOULLI (${SAMPLE_PERCENT}) REPEATABLE (7)`));factor=exact?1:100/SAMPLE_PERCENT;}
   let revisions=0;
   if(lrows===null)ledger=none('ledger','timeout');
   else if(lrows.length){const groups=new Map();for(const r of lrows){const k=r.name+' · '+r.currency,o=groups.get(k)??{orders:0,refunds:0,other:0};revisions+=Math.round(Number(r.revisions)*factor);const v=Math.round(Number(r.n)*factor);if(r.kind==='order')o.orders+=v;else if(r.kind==='refund')o.refunds+=v;else o.other+=v;groups.set(k,o);}
    const total=[...groups.values()].reduce((a,o)=>a+o.orders+o.refunds+o.other,0),lines=[...groups.entries()].slice(0,6).map(([k,o])=>`${k}: ${o.orders.toLocaleString('es-MX')} pedidos · ${o.refunds.toLocaleString('es-MX')} reembolsos${o.other?` · ${o.other.toLocaleString('es-MX')} otros`:''}`);
    ledger=base('ledger',{class:exact?'observed':'estimated',total,incorporated:total,detail:[...lines,...(groups.size>6?[`y ${groups.size-6} grupos más`]:[]),'Conteo de registros por fuente y moneda; las monedas no se suman.',...(ledgerSummary?[`${exact?`Conteo exacto del libro: ${total.toLocaleString('es-MX')} registros distintos en ${revisions.toLocaleString('es-MX')} revisiones guardadas.`:`${total.toLocaleString('es-MX')} registros distintos en ${revisions.toLocaleString('es-MX')} revisiones al corte del resumen.`}`,ledgerSummary.label]:exact?[`Conteo exacto del libro: ${total.toLocaleString('es-MX')} registros distintos en ${revisions.toLocaleString('es-MX')} revisiones guardadas.`]:[`Estimado con una muestra del ${SAMPLE_PERCENT} %.`])],...(ledgerSummary?{summary:ledgerSummary.meta}:{})});}
   // 5. HubSpot ticket-contact associations: facts by state and active bindings (links).
   let associations=none('associations');
   // Conteos mantenidos (association_counts, 20261022000000): no dependen de la política initplan 20261021000000. Sin ellos: tally exacto o muestra.
   const asum=await readAssociationCounts(s);
   const assocBase=(c,total,linkCount,exact,tail,extra={})=>base('associations',{class:exact?'observed':'estimated',total,incorporated:total,counts:{facts:total,resolved:c.resolved??0,pending:c.pending??0,blocked:c.blocked??0,retained:c.retained??0,links:linkCount},
    detail:[`${total.toLocaleString('es-MX')} hechos (resueltos ${(c.resolved??0).toLocaleString('es-MX')} · pendientes ${(c.pending??0).toLocaleString('es-MX')} · por revisar ${(c.blocked??0).toLocaleString('es-MX')} · retenidos ${(c.retained??0).toLocaleString('es-MX')})`,linkCount===null?'Vínculos: no disponible ahora':`${linkCount.toLocaleString('es-MX')} vínculos activos conversación–cliente`].concat(tail),...extra});
   if(asum.availability==='ready'&&asum.counts.fact_resolved!==undefined){
    const k=asum.counts,c={resolved:k.fact_resolved,pending:k.fact_pending,blocked:k.fact_blocked,retained:k.fact_retained},total=c.resolved+c.pending+c.blocked+c.retained;
    if(total>0)associations=assocBase(c,total,k.binding_active??0,asum.freshness==='fresh',[asum.freshness==='fresh'?'Conteo exacto.':'',summaryLabel(asum)].filter(Boolean),{summary:summaryMeta(asum)});
   }
   // Sin resumen, o con resumen no fresco: se intenta el conteo directo; un directo EXACTO manda, uno estimado solo sustituye si no hay resumen.
   if(associations.loaded===false||associations.class!=='observed'){
   const hadSummary=associations.loaded!==false,facts=await tally({table:'public.native_customer_associations',alias:'f',group:'f.resolution_state'});
   if(facts===null){if(!hadSummary)associations=none('associations','timeout');}
   else if(facts.rows.length&&(facts.exact||!hadSummary)){const links=await tally({table:'public.conversation_customer_association_bindings',alias:'b',where:'b.active',group:"'links'"});
    const c=Object.fromEntries(facts.rows.map(r=>[r.g,r.n])),total=facts.rows.reduce((a,r)=>a+r.n,0),linkCount=links&&links.rows[0]?links.rows[0].n:links===null?null:0,exact=facts.exact&&(links===null||links.exact);
    if(exact||!hadSummary)associations=assocBase(c,total,linkCount,exact,exact?['Conteo exacto.']:[`Estimado con una muestra del ${SAMPLE_PERCENT} %.`]);}
   }
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
