import {IngestionError,contentHash,timestamp} from '../index.mjs';

export const ASSOCIATION_PROFILE='hubspot-ticket-contact-association-v1';
export const associationFields=['id','raw','raw_hash','container_raw','container_hash','source_file','source_index','source_file_hash','source_observed_at','provider_account','source_version','pair_index','global_ordinal','bridge','bridge_hash'];
const fail=(code,field=null)=>{throw new IngestionError(code,field);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const decimal=x=>typeof x==='string'&&/^[0-9]{1,128}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const index=x=>Number.isSafeInteger(x)&&x>=0;
function integer(value,field){if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value)||!index(Number(value)))fail('ASSOCIATION_INDEX',field);return Number(value);}
function nativeId(value){if(decimal(value))return value;if(Number.isSafeInteger(value)&&value>=0)return String(value);fail('ASSOCIATION_NATIVE_ID');}
function sourceFile(value){if(typeof value!=='string'||!value||value.startsWith('/')||/[:\\\u0000-\u001f\u007f]/u.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'))fail('ASSOCIATION_SOURCE_FILE');}
function parse(value,field){try{return JSON.parse(value);}catch{fail('ASSOCIATION_JSON',field);}}
function pair(value){
 if(!exact(value,['from','to'])||!exact(value.from,['id'])||!decimal(value.from.id)||!object(value.to))fail('ASSOCIATION_NATIVE_PAIR');
 const contactId=nativeId(value.to.toObjectId),types=value.to.associationTypes;
 if(!Array.isArray(types)||!types.length)fail('ASSOCIATION_TYPES');
 for(const t of types)if(!object(t)||!['HUBSPOT_DEFINED','USER_DEFINED','INTEGRATOR_DEFINED'].includes(t.category)||!index(t.typeId)||(t.label!==null&&(typeof t.label!=='string'||!t.label.isWellFormed())))fail('ASSOCIATION_TYPES');
 return {ticketId:value.from.id,contactId};
}
function proof(x,field){if(!exact(x,['sourceFileSha256','sourceIndex','field'])||!sha(x.sourceFileSha256)||!index(x.sourceIndex)||x.field!==field)fail('ASSOCIATION_PROOF');}
function validateBridge(b,ticketId){
 if(!exact(b,['schema','property','notes','archivedTicket','sourceNamespaceCandidates'])||b.schema!=='association-bridge-v1'||typeof b.archivedTicket!=='boolean'||!exact(b.property,['status','value','proof'])||!['missing','malformed','valid'].includes(b.property.status))fail('ASSOCIATION_BRIDGE');
 proof(b.property.proof,'properties.gorgias_id');
 if(b.property.status==='valid'?!decimal(b.property.value):b.property.value!==null)fail('ASSOCIATION_PROPERTY');
 if(!Array.isArray(b.notes))fail('ASSOCIATION_NOTES');
 for(const n of b.notes){if(!exact(n,['gorgiasId','proof'])||!decimal(n.gorgiasId))fail('ASSOCIATION_NOTES');proof(n.proof,'properties.hs_note_body');}
 const candidates=[`hubspot:${ticketId}`,...new Set([...(b.property.status==='valid'?[b.property.value]:[]),...b.notes.map(n=>n.gorgiasId)].map(id=>`gorgias:${id}`))];
 if(contentHash(b.sourceNamespaceCandidates)!==contentHash(candidates))fail('ASSOCIATION_NAMESPACE_CANDIDATES');
}
function validatePayload(p){
 if(!exact(p,['schema','provider','portalId','ticketId','contactId','nativePair','source','bridge','evidenceHash','sourceVersionHash','globalOrdinal'])||p.schema!=='association-payload-v1'||p.provider!=='hubspot'||!decimal(p.portalId)||!sha(p.sourceVersionHash)||!index(p.globalOrdinal))fail('ASSOCIATION_PAYLOAD');
 const ids=pair(p.nativePair);if(ids.ticketId!==p.ticketId||ids.contactId!==p.contactId)fail('ASSOCIATION_IDENTITY');
 const s=p.source;if(!exact(s,['sourceFile','sourceFileSha256','sourceIndex','pairIndex','containerSha256','sourceObservedAt'])||!sha(s.sourceFileSha256)||!sha(s.containerSha256)||!index(s.sourceIndex)||!index(s.pairIndex))fail('ASSOCIATION_SOURCE');
 sourceFile(s.sourceFile);if(timestamp(s.sourceObservedAt,'sourceObservedAt')!==s.sourceObservedAt)fail('ASSOCIATION_SOURCE_DATE');
 validateBridge(p.bridge,p.ticketId);
 if(!sha(p.evidenceHash)||p.evidenceHash!==associationEvidenceHash(p))fail('ASSOCIATION_EVIDENCE_HASH');
 return p;
}
export function associationColumns(columns){
 if(!exact(columns,associationFields))fail('INVALID_MAPPING');
 const result={};for(const field of associationFields){if(typeof columns[field]!=='string'||!columns[field])fail('REQUIRED_COLUMNS',field);result[field]=columns[field];}
 if(new Set(Object.values(result)).size!==associationFields.length)fail('INVALID_MAPPING');return result;
}
export function associationEvidenceHash(payload){return contentHash({schema:'association-evidence-v1',nativePair:payload.nativePair,source:payload.source,bridge:payload.bridge});}
export function associationFactId({tenantId,connectionId,provider,portalId,ticketId,contactId}){
 if(!uuid(tenantId)||!uuid(connectionId)||provider!=='hubspot'||![portalId,ticketId,contactId].every(decimal))fail('ASSOCIATION_IDENTITY');
 const h=contentHash(['native-customer-association-v1',tenantId,connectionId,provider,portalId,ticketId,contactId]);
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function associationPayload(headers,cells,columns){
 const mapping=associationColumns(columns);
 if(!Array.isArray(headers)||!Array.isArray(cells)||headers.length!==cells.length||headers.some(h=>typeof h!=='string'||!h)||new Set(headers).size!==headers.length||cells.some(c=>typeof c!=='string'||!c.isWellFormed()))fail('ASSOCIATION_SOURCE_CELLS');
 const d={};for(const f of associationFields){const i=headers.indexOf(mapping[f]);if(i<0)fail('COLUMN_NOT_FOUND',f);d[f]=cells[i];}
 const nativePair=parse(d.raw,'raw'),container=parse(d.container_raw,'container_raw'),bridge=parse(d.bridge,'bridge'),ids=pair(nativePair);
 if(!sha(d.raw_hash)||contentHash(nativePair)!==d.raw_hash||!sha(d.container_hash)||contentHash(container)!==d.container_hash||!sha(d.bridge_hash)||contentHash(bridge)!==d.bridge_hash)fail('ASSOCIATION_CONTENT_HASH');
 const pairIndex=integer(d.pair_index,'pair_index');
 if(!object(container)||!exact(container.from,['id'])||container.from.id!==ids.ticketId||!Array.isArray(container.to)||pairIndex>=container.to.length||contentHash(container.to[pairIndex])!==contentHash(nativePair.to))fail('ASSOCIATION_CONTAINER_MEMBERSHIP');
 if(!decimal(d.provider_account)||d.id!==`hubspot-ticket-contact:${d.provider_account}:${ids.ticketId}:${ids.contactId}`)fail('ASSOCIATION_IDENTITY');
 const p={schema:'association-payload-v1',provider:'hubspot',portalId:d.provider_account,...ids,nativePair,source:{sourceFile:d.source_file,sourceFileSha256:d.source_file_hash,sourceIndex:integer(d.source_index,'source_index'),pairIndex,containerSha256:d.container_hash,sourceObservedAt:timestamp(d.source_observed_at,'source_observed_at')},bridge,sourceVersionHash:d.source_version,globalOrdinal:integer(d.global_ordinal,'global_ordinal')};
 p.evidenceHash=associationEvidenceHash(p);return validatePayload(p);
}
export function validateAssociationRecord(record,{tenantId,connectionId,fileHash,mappingVersion}){
 if(!uuid(tenantId)||!uuid(connectionId)||!sha(fileHash)||typeof mappingVersion!=='string'||!mappingVersion)fail('ASSOCIATION_RECORD_SCOPE');
 if(!exact(record,['profile','association','row_ref','row_hash','batch_hash','mapping_version','payload_ref'])||record.profile!==ASSOCIATION_PROFILE||record.batch_hash!==fileHash||record.mapping_version!==mappingVersion||!((Number.isSafeInteger(record.row_ref)&&record.row_ref>=2)||(typeof record.row_ref==='string'&&/^[1-9][0-9]*$/.test(record.row_ref)&&Number(record.row_ref)>=2&&Number.isSafeInteger(Number(record.row_ref))))||record.payload_ref!==`csv:${fileHash}:line:${record.row_ref}`)fail('ASSOCIATION_RECORD_BINDING');
 const p=validatePayload(record.association);if(record.row_hash!==p.evidenceHash)fail('ASSOCIATION_RECORD_HASH');return p;
}
