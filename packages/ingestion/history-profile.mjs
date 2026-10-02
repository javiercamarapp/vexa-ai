import {IngestionError,timestamp,contentHash,requiredString} from './index.mjs';
export const HISTORY_PROFILE='history-message-v1';
const fail=(code,field=null)=>{throw new IngestionError(code,field);};
export function checkedProfile(profile){if(profile!==undefined&&profile!==HISTORY_PROFILE)fail('INVALID_INGESTION_PROFILE');return profile;}
export function historicalText(text){
 if(typeof text!=='string'||!text.isWellFormed())fail('INVALID_TEXT','text');
 if(!text.trim())fail('HISTORY_EMPTY_BODY','text');
 if(text.length>100000||text.normalize('NFC').length>100000)fail('BODY_ANALYSIS_LIMIT','text');
 return text;
}
export function historicalTimestamp(value){
 if(typeof value!=='string')fail('INVALID_TIMESTAMP','occurred_at');
 const m=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!m)fail('INVALID_TIMESTAMP','occurred_at');
 const fraction=m[2]??'',micro=fraction.padEnd(6,'0'),canonical=timestamp(timestamp(`${m[1]}.${micro.slice(0,3)}${m[3]}`,'occurred_at'),'occurred_at');
 const remainder=Number(micro.slice(3));
 return {profile:HISTORY_PROFILE,original:value,canonical,precision_digits:fraction.length,epoch_microseconds:(BigInt(Date.parse(canonical))*1000n+BigInt(remainder)).toString(),remainder_microseconds:remainder,normalization:'floor-to-millisecond'};
}
export function historyMetadata(text,original){historicalText(text);return historicalTimestamp(original);}
export function validateHistoryPayload(envelope,raw){
 const profile=checkedProfile(envelope.ingestion_profile);
 const metadata=raw.historical_timestamp;
 if(!profile){if(metadata&&typeof metadata==='object')fail('INGESTION_PROFILE_MISMATCH');return;}
 historicalText(raw.text);
 if(!metadata||typeof metadata!=='object'||metadata.profile!==profile)fail('INGESTION_PROFILE_MISMATCH');
 if(raw.source_occurred_at!==metadata.original)fail('HISTORICAL_TIMESTAMP_MISMATCH');
 const expected=historicalTimestamp(metadata.original);
 if(contentHash(metadata)!==contentHash(expected)||raw.occurred_at!==expected.canonical||envelope.occurred_at!==expected.canonical)fail('HISTORICAL_TIMESTAMP_MISMATCH');
}

export function historicalIdentity(id,conversation,role){requiredString(id,'external_id');requiredString(conversation,'conversation_id');if(!['customer','agent','internal'].includes(role))fail('CSV_MESSAGE_INVALID','role');}
