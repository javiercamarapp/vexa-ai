// Índice de tickets HubSpot para el Tracker: consulta SOLO LECTURA (para el MCP) y lector de su resultado.
// "Ticket conocido" = existe como conversación HubSpot viva del tenant en Vexa (external_id = id o 'hubspot:'+id).
// La evidencia se decide AL CARGAR (las revisiones son solo INSERT): el índice debe estar completo antes de la primera carga.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function candidateIds(plans){ // plans: salida de planSheetJob (sin índice) de una o varias versiones
 const ids=new Set();
 for(const j of plans)for(const b of j.batches)for(const r of b.rows)if(r.ticket.state==='candidate'&&r.ticket.ticket_id)ids.add(r.ticket.ticket_id);
 return [...ids].sort((a,b)=>a.length-b.length||(a<b?-1:1));
}
const BANNER='-- SOLO LECTURA (un unico SELECT, sin lista de ids). Proyecto Vexa: proyecto-ejemplo. Devuelve solo ids numericos de tickets, nunca contenido.\n';
// Historicas HubSpot: source='csv', external_id='hubspot:<id>'. Nativas: source='hubspot', external_id numerico puro. No se filtra por source.
const CONV=t=>`from public.conversations c where c.tenant_id='${t}' and c.deleted_at is null and c.external_id ~ '^(hubspot:)?[0-9]{6,20}$'`;
function tenantOk(tenant){if(!UUID.test(tenant))fail('INVALID_TENANT');}
export function summarySql(tenant){
 tenantOk(tenant);
 return BANNER+`select 'TICKETS_SUMMARY '||coalesce(string_agg(g,' ' order by g),'vacio')||' END' as resumen from (select c.source||'/'||(case when c.external_id like 'hubspot:%' then 'prefijo' else 'numerico' end)||'='||count(*) g ${CONV(tenant)} group by c.source,(c.external_id like 'hubspot:%')) z;\n`;
}
export function idsSql(tenant){
 tenantOk(tenant);
 return BANNER+`with e as (select distinct c.source,regexp_replace(c.external_id,'^hubspot:','') id ${CONV(tenant)})\n`+
  `select 'TICKETS_FOUND:'||coalesce(string_agg(distinct id,' '),'')||':END' as ids,\n`+
  ` (select string_agg(source||'='||k,' ' order by source) from (select source,count(distinct id) k from e group by 1) z) as fuentes from e;\n`;
}
// Acepta el texto crudo del resultado (JSON del MCP, salida de psql o del CLI). Devuelve solo ids que son candidatos.
export function parseIdsResult(text,candidates){
 const m=/TICKETS_FOUND:([0-9 ]*):END/.exec(String(text));
 if(!m)fail('RESULT_UNREADABLE');
 const cand=new Set(candidates),found=m[1].split(' ').filter(Boolean),seen=new Set(),extra=[];
 for(const id of found){if(!cand.has(id))extra.push(id);else seen.add(id);}
 return {ids:[...seen],ignored_not_candidate:extra.length,duplicates:found.length-seen.size-extra.length};
}
