import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,1024}$/.test(x);
const need=(x,c)=>{if(!x)throw Object.assign(new Error(c),{code:c});};
// A small ordered tuple is the observer callback's result. Its JSON SHA is exactly
// the observer proofJSON(array); no object key canonicalization duplicated here.
export function projectionWitness(result,{profile,contextSha256,accountId,threadId,messageId}){
 need(typeof profile==='string'&&profile.startsWith('s01-')&&profile.length<200,'DUAL_PROFILE');
 need(hex(contextSha256)&&id(accountId)&&id(threadId)&&id(messageId),'DUAL_SCOPE');
 need(result?.status==='SUPPORTED'&&result.value?.profile===profile&&hex(result.digest)&&hash(JSON.stringify(result.value))===result.digest,'DUAL_PROJECTION');
 const c=result.exportContext;
 need(c?.sha256===contextSha256&&c.binding?.accountId===accountId&&c.binding?.threadId===threadId&&c.binding?.messageId===messageId&&hex(c.captureUrlSha256)&&hex(c.baseUriSha256),'DUAL_CONTEXT');
 return Object.freeze(['s01-dual-projection-v1',profile,contextSha256,accountId,threadId,messageId,c.captureUrlSha256,c.baseUriSha256,result.digest]);
}
export function projectionWitnessDigest(witness){
 need(Array.isArray(witness)&&witness.length===9&&witness[0]==='s01-dual-projection-v1'&&witness.every(x=>typeof x==='string'),'DUAL_WITNESS');
 return hash(JSON.stringify(witness));
}
export function messageDigest(record,richProofDigest,key){
 need(typeof key==='string'&&key.length>=32,'DUAL_KEY');
 need(record?.envelope?.entity_type==='message'&&id(record.envelope.external_id)&&id(record.conversation_id)&&record.body_complete===true,'DUAL_MESSAGE');
 need(['agent','customer','internal'].includes(record.role)&&record.visibility===(record.role==='internal'?'internal':'public'),'DUAL_ROLE_VISIBILITY');
 need(Array.isArray(record.associations)&&record.associations.length<=1&&record.associations.every(a=>a?.entity_type==='ticket'&&id(a.external_id)),'DUAL_ASSOCIATIONS');
 need(hex(richProofDigest),'DUAL_RICH_PROOF');
 const associations=record.associations.map(a=>[a.entity_type,a.external_id]);
 return createHmac('sha256',key).update(JSON.stringify(['s01-ui-source-content-actions-and-provider-fidelity-v1',record.conversation_id,record.envelope.external_id,record.role,record.visibility,associations,richProofDigest])).digest('hex');
}
export function verifyMessage(record,observerVerification,expectedDigest,key){
 need(observerVerification?.sourceTextExactNfc===true&&observerVerification.payloadExact===true,'DUAL_PROVIDER_FIDELITY');
 need(hex(expectedDigest),'DUAL_REFERENCE');
 const actual=messageDigest(record,observerVerification.richProjectionDigest,key);
 need(timingSafeEqual(Buffer.from(expectedDigest,'hex'),Buffer.from(actual,'hex')),'DUAL_UI_MISMATCH');
 return true;
}
