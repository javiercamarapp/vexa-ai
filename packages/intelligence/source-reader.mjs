import {recordsFromBytes} from '../jobs/durable/records.mjs';
import {contentHash} from '../ingestion/index.mjs';
const fail=()=>{throw Object.assign(Error('EXTRACTION_SOURCE_UNAVAILABLE'),{code:'23514'});};
/** Reads the immutable import object or durable CRM normalization, never a caller URL. */
export function createExtractionSourceReader({storage}={}){
 return async function read(scope,revision){
  const rows=(await scope.query(`SELECT i.*,u.size,u.content_type,u.user_id,c.source,c.account_id,r.row_ref
   FROM public.import_rows r JOIN public.imports i ON i.tenant_id=r.tenant_id AND i.id=r.import_id
   JOIN public.connections c ON c.tenant_id=i.tenant_id AND c.id=i.connection_id
   LEFT JOIN public.import_uploads u ON u.tenant_id=i.tenant_id AND u.import_id=i.id
   WHERE r.tenant_id=$1 AND r.payload_ref=$2 AND c.status='active'`,[scope.tenantId,revision.text_ref])).rows;
  if(rows.length!==1)fail();const row=rows[0];let payload;
  if(['hubspot','zendesk'].includes(row.source)){
   const originals=(await scope.query(`SELECT normalized FROM public.sync_raw_objects WHERE tenant_id=$1 AND import_id=$2
    AND (row_ref=$3 OR row_ref||':linked-v1'=$3)`,[scope.tenantId,row.id,row.row_ref])).rows;
   if(originals.length!==1)fail();payload=originals[0].normalized?.payload;
  }else{
   if(!storage?.read||!row.object_path?.startsWith(scope.tenantId+'/imports/'+row.id+'/'))fail();
   const bytes=await storage.read({tenantId:scope.tenantId,userId:scope.userId},row,{signal:AbortSignal.timeout(10000)});
   const records=await recordsFromBytes(bytes,row),matches=records.filter(r=>String(r.row_ref)===row.row_ref);
   if(matches.length!==1)fail();payload=matches[0].raw_payload;
  }
  if(!payload||contentHash(payload)!==revision.hash||typeof payload.text!=='string'||payload.role!==revision.role)fail();
  return payload.text;
 };
}
