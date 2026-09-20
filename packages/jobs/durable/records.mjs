import {createHash} from 'node:crypto';
import {parseCSVStream,contentHash,createEnvelope,parseMoney,requiredString,timestamp} from '../../ingestion/index.mjs';
import {canonicalMapping,inspectImport,normalizeDate} from '../../ingestion/mapping.mjs';
import {fail} from './error.mjs';
// Original file remains immutable in Storage. Each payload includes exact source cells.
export async function recordsFromBytes(bytes,row){
 if(!(bytes instanceof Uint8Array)||bytes.length!==Number(row.size)||createHash('sha256').update(bytes).digest('hex')!==row.file_hash)fail('INPUT_HASH_MISMATCH');
 const legacy=!row.provenance?.mapping;
 const config=legacy?{columns:{id:'id',text:'text',date:'date',role:'role',conversation:'conversation'},sheet:null}:canonicalMapping(row.provenance.mapping);
 if(!config.columns.role||!config.columns.conversation||!config.columns.date)fail('INGESTION_MAPPING_REQUIRED',422);
 let parsed;
 if(row.content_type==='text/csv'){
  const rows=[],errors=[];for await(const event of parseCSVStream((async function*(){yield bytes;})())){const {type,...rest}=event;(type==='row'?rows:errors).push(rest);}
  const head=rows.shift();if(!head||head.line!==1||new Set(head.values).size!==head.values.length||head.values.some(x=>!x))fail('INVALID_HEADER',422);
  parsed={headers:head.values,rows,errors};
 }else parsed=inspectImport(bytes,{contentType:row.content_type,sheet:config.sheet});
 for(const column of Object.values(config.columns))if(column&&!parsed.headers.includes(column))fail('COLUMN_NOT_FOUND',422);
 const context={tenant_id:row.tenant_id,connection_id:row.connection_id,source:row.source,source_account_id:row.account_id};
 const records=[];
 for(const entry of parsed.rows){
  const data=Object.fromEntries(Object.entries(config.columns).map(([key,column])=>[key,column?entry.values[parsed.headers.indexOf(column)]:null]));
  try{
   if(entry.values.length!==parsed.headers.length)fail('COLUMN_COUNT',422);
   requiredString(data.id,'id');if(typeof data.text!=='string'||[...data.text].length>2000)fail('INVALID_TEXT',422);
   const occurred_at=legacy?(data.date==null||data.date===''?null:timestamp(data.date,'date')):normalizeDate(data.date,config.timezone,config.dateFormat);
   if(data.amount!=null&&data.amount!=='')parseMoney(data.amount,config.columns.currency?data.currency:config.currency);
   const payload={external_id:data.id,text:data.text,occurred_at,role:data.role,conversation_id:data.conversation,customer_id:data.customer||null,order_id:data.order||null,sku:data.sku||null,source_cells:entry.values,source_headers:parsed.headers};
   const envelope={...createEnvelope(context,{entity_type:'message',external_id:data.id,occurred_at,observed_at:new Date(row.created_at).toISOString(),payload_ref:`csv:${row.file_hash}:line:${entry.line}`},payload),adapter_version:'csv-message-v1'};
   records.push({envelope,raw_payload:payload,row_ref:entry.line,row_hash:contentHash(payload),batch_hash:row.file_hash,mapping_version:row.mapping_version});
  }catch(error){if(!error.code)throw error;records.push({row_ref:entry.line,mapping_version:row.mapping_version,raw_hash:contentHash(entry.values),batch_hash:row.file_hash,validation_error:error.code,validation_field:error.field??null});}
 }
 for(const e of parsed.errors)records.push({row_ref:e.line,mapping_version:row.mapping_version,raw_hash:contentHash(e),batch_hash:row.file_hash,validation_error:e.code});
 return records.sort((a,b)=>Number(a.row_ref)-Number(b.row_ref));
}
export async function* pagesFromStorage(storage,row,checkpoint,{signal,chunkSize=100}={}){
 if(!Number.isSafeInteger(chunkSize)||chunkSize<1||chunkSize>500)fail('INVALID_CHUNK_SIZE');
 const bytes=await storage.read({tenantId:row.tenant_id,userId:row.user_id},row,{signal});
 const records=await recordsFromBytes(bytes,row),scope=contentHash([row.file_hash,row.mapping_version,row.tenant_id,row.connection_id]);
 const offset=checkpoint?.offset??0;if(checkpoint&&(checkpoint.scope!==scope||offset>records.length))fail('CHECKPOINT_SCOPE');
 if(!records.length)yield {records:[],checkpoint:{scope,offset:0},done:true};
 for(let i=offset;i<records.length;i+=chunkSize){if(signal?.aborted)throw signal.reason;const end=Math.min(i+chunkSize,records.length);yield {records:records.slice(i,end),checkpoint:{scope,offset:end},done:end===records.length};}
}
