import {IngestionError,contentHash,timestamp,requiredString} from './index.mjs';

export const CUSTOMER_PROFILE='hubspot-contact-csv-v1';
export const CUSTOMER_ADAPTER='csv-customer-v1';
export const customerFields=['id','raw','raw_hash','source_file','source_index','source_file_hash','source_observed_at','provider_account'];
const fail=(code,field=null)=>{throw new IngestionError(code,field);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

export function customerColumns(columns){
 if(!object(columns)||Object.keys(columns).some(k=>!customerFields.includes(k)))fail('INVALID_MAPPING');
 const result={};
 for(const field of customerFields){
  if(typeof columns[field]!=='string'||!columns[field].length)fail('REQUIRED_COLUMNS',field);
  result[field]=columns[field];
 }
 if(new Set(Object.values(result)).size!==customerFields.length)fail('INVALID_MAPPING');
 return result;
}
function pairedDate(top,property,field){
 if(top==null&&property==null)return null;
 if(top==null||property==null)fail('CUSTOMER_DATE_MISMATCH',field);
 const value=timestamp(top,field);
 if(value!==timestamp(property,field))fail('CUSTOMER_DATE_MISMATCH',field);
 return value;
}

// Rebuild all projections from the original CSV cells. The producer separately
// verifies that this declared source belongs to the acquired HubSpot dataset.
export function customerPayload(headers,cells,columns){
 const mapping=customerColumns(columns);
 if(!Array.isArray(headers)||!Array.isArray(cells)||headers.length!==cells.length||headers.some(h=>typeof h!=='string'||!h)||new Set(headers).size!==headers.length||cells.some(c=>typeof c!=='string'))fail('CUSTOMER_SOURCE_CELLS');
 const data={};
 for(const field of customerFields){const index=headers.indexOf(mapping[field]);if(index<0)fail('COLUMN_NOT_FOUND',field);data[field]=cells[index];}
 if(Buffer.byteLength(data.raw,'utf8')>16384)fail('CUSTOMER_RAW_LIMIT','raw');
 let original;
 try{original=JSON.parse(data.raw);}catch{fail('CUSTOMER_RAW_JSON','raw');}
 if(!object(original)||!object(original.properties))fail('CUSTOMER_RAW_OBJECT','raw');
 if(typeof data.id!=='string'||! /^[0-9]{1,128}$/.test(data.id)||original.id!==data.id||original.properties.hs_object_id!==data.id)fail('CUSTOMER_IDENTITY_MISMATCH','id');
 if(original.archived!==false)fail('CUSTOMER_ARCHIVED','raw');
 for(const node of [original,original.properties])for(const key of ['deletedAt','deleted_at','archivedAt','archived_at','deleted','isDeleted','hs_is_deleted','hs_deleted_at'])if(node[key]!=null)fail('CUSTOMER_DELETION_METADATA','raw');
 const hash=contentHash(original);
 if(!sha(data.raw_hash)||data.raw_hash!==hash)fail('CUSTOMER_RAW_HASH_MISMATCH','raw_hash');
 const names=[original.properties.firstname,original.properties.lastname];
 if(names.some(n=>n!=null&&(typeof n!=='string'||!n.isWellFormed())))fail('CUSTOMER_NAME_INVALID','raw');
 const parts=names.filter(n=>typeof n==='string'&&n!=='');
 const display_name=parts.length?parts.join(' '):null;
 if(display_name!==null&&[...display_name].length>4096)fail('CUSTOMER_NAME_LIMIT','raw');
 const created=pairedDate(original.createdAt,original.properties.createdate,'created_at');
 const occurred_at=pairedDate(original.updatedAt,original.properties.lastmodifieddate,'occurred_at');
 if(created!==null&&occurred_at!==null&&Date.parse(occurred_at)<Date.parse(created))fail('CUSTOMER_DATE_ORDER','occurred_at');
 if(!data.source_file||data.source_file.startsWith('/')||/[:\\\u0000-\u001f\u007f]/u.test(data.source_file)||data.source_file.split('/').some(x=>!x||x==='.'||x==='..'))fail('CUSTOMER_SOURCE_FILE','source_file');
 if(! /^(0|[1-9][0-9]{0,4})$/.test(data.source_index)||Number(data.source_index)>49999)fail('CUSTOMER_SOURCE_INDEX','source_index');
 if(!sha(data.source_file_hash))fail('CUSTOMER_SOURCE_HASH','source_file_hash');
 const source_observed_at=timestamp(data.source_observed_at,'source_observed_at');
 requiredString(data.provider_account,'provider_account');
 return {external_id:data.id,display_name,occurred_at,original_object:original,original_object_hash:hash,original_provider:'hubspot',provider_account_id:data.provider_account,source_file:data.source_file,source_index:Number(data.source_index),source_file_sha256:data.source_file_hash,source_observed_at,source_headers:[...headers],source_cells:[...cells],source_mapping:mapping};
}

export function validateCustomerEnvelope(envelope,raw){
 if(envelope.source!=='csv'||envelope.entity_type!=='customer'||envelope.ingestion_profile!==CUSTOMER_PROFILE)fail('CUSTOMER_PROFILE_MISMATCH');
 if(!object(raw))fail('CUSTOMER_PAYLOAD_REQUIRED');
 const expected=customerPayload(raw.source_headers,raw.source_cells,raw.source_mapping);
 if(contentHash(raw)!==contentHash(expected))fail('CUSTOMER_PROJECTION_MISMATCH');
 if(envelope.external_id!==expected.external_id||envelope.source_revision!=='sha256:'+expected.original_object_hash||envelope.occurred_at!==expected.occurred_at||envelope.observed_at!==expected.source_observed_at||envelope.deleted_at!==null)fail('CUSTOMER_ENVELOPE_MISMATCH');
 return expected;
}
