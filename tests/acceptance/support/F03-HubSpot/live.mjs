// Real-provider witness. This module has no simulated transport option or receipt-success input.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,createHmac} from 'node:crypto';
import {candidate,implementation} from './http.mjs';
const realFetch=globalThis.fetch.bind(globalThis);
const fail=code=>{throw new Error(code);};
const requireThat=(condition,code)=>{if(!condition)fail(code);};
function privateJSON(file){requireThat(typeof file==='string'&&path.isAbsolute(file),'S01_PRIVATE_CONFIG_REQUIRED');const real=fs.realpathSync(file);requireThat(!real.startsWith(candidate+path.sep),'S01_CONFIG_OUTSIDE_CANDIDATE');const s=fs.lstatSync(file);requireThat(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0&&s.size<8*1024*1024,'S01_PRIVATE_FILE_PERMISSIONS');return {value:JSON.parse(fs.readFileSync(file,'utf8')),bytes:fs.readFileSync(file)};}
export function reconciliationDigest(record,key){return createHmac('sha256',key).update(JSON.stringify([record.envelope.external_id,record.conversation_id,record.role,record.visibility,record.text,record.associations.map(a=>[a.entity_type,a.external_id]).sort()])).digest('hex');}
async function executeLive(){
 // Presence of configuration never supplies authorization: supervisor must first match its
 // approval reference to the actual user/account-holder decision, as described in LIVE.md.
 if(!process.env.VEXA_HUBSPOT_S01_CONFIG)fail('S01_LIVE_BLOCKED: explicit account-holder authorization, private configuration and independently reconciled export required');
 const {value:c}=privateJSON(process.env.VEXA_HUBSPOT_S01_CONFIG);
 requireThat(c.version==='v3'&&typeof c.authorization_ref==='string'&&c.authorization_ref.length>10,'S01_AUTHORIZATION_REFERENCE_REQUIRED');
 requireThat(typeof c.account_id==='string'&&/^\d+$/.test(c.account_id)&&typeof c.client_id==='string'&&c.client_id.length>0,'S01_EXPECTED_ACCOUNT_APP_REQUIRED');
 requireThat(typeof c.reviewer==='string'&&c.reviewer.length>2&&c.reviewer!==c.implementer,'S01_INDEPENDENT_REVIEWER_REQUIRED');
 requireThat(Date.parse(c.expires_at)>Date.now()&&Date.parse(c.expires_at)<Date.now()+24*3600000,'S01_APPROVAL_WINDOW_REQUIRED');
 requireThat(typeof process.env.VEXA_HUBSPOT_APPROVAL_REFERENCE==='string'&&process.env.VEXA_HUBSPOT_APPROVAL_REFERENCE.length>0&&c.authorization_ref===process.env.VEXA_HUBSPOT_APPROVAL_REFERENCE,'S01_SUPERVISOR_APPROVAL_MISMATCH');
 const {value:expected,bytes}=privateJSON(c.reconciliation_file);
 requireThat(createHash('sha256').update(bytes).digest('hex')===c.reconciliation_sha256,'S01_RECONCILIATION_HASH');
 requireThat(expected.origin==='authorized-ui-or-export'&&expected.account_id===c.account_id&&expected.reviewer===c.reviewer,'S01_EXPORT_PROVENANCE');
 requireThat(Array.isArray(expected.threads)&&expected.threads.length<=1000&&expected.threads.every(t=>typeof t==='string'&&/^[A-Za-z0-9_-]{1,1024}$/.test(t))&&new Set(expected.threads).size>=20&&new Set(expected.threads).size===expected.threads.length,'S01_TWENTY_UNIQUE_THREADS_REQUIRED');
 requireThat(Array.isArray(expected.messages)&&expected.messages.length>=20&&expected.messages.every(m=>typeof m.id==='string'&&expected.threads.includes(m.thread)&&/^[a-f0-9]{64}$/.test(m.digest)),'S01_MESSAGE_EXPORT_REQUIRED');
 requireThat(new Set(expected.messages.map(m=>`${m.thread}:${m.id}`)).size===expected.messages.length,'S01_EXPORT_DUPLICATE');
 const token=process.env.VEXA_HUBSPOT_TOKEN,key=process.env.VEXA_HUBSPOT_RECONCILIATION_KEY;
 requireThat(typeof token==='string'&&token.length>15&&!/[\r\n]/.test(token)&&typeof key==='string'&&key.length>=32,'S01_SECRET_CONFIGURATION_REQUIRED');
 const wanted=new Set(expected.threads);
 const deadline=Date.now()+240000;let requests=0,threadRequests=0,messageRequests=0;
 const boundedFetch=async(input,init)=>{const u=new URL(input);requireThat(u.origin==='https://api.hubapi.com'&&!u.username&&!u.password&&!u.hash,'S01_HOST_ALLOWLIST');requireThat(init?.method==='GET'&&init.redirect==='manual','S01_READONLY_REDIRECT_POLICY');requireThat(++requests<=250&&Date.now()<deadline,'S01_REQUEST_BUDGET');
  const route=/^\/conversations\/v3\/conversations\/threads\/([A-Za-z0-9_-]+)(\/messages(?:\/[A-Za-z0-9_-]+\/original-content)?)?$/.exec(u.pathname);
  requireThat(route!==null&&wanted.has(route[1]),'S01_THREAD_SCOPE_ALLOWLIST');
  if(!route[2])threadRequests++;if(u.pathname.endsWith('/messages'))messageRequests++;
  try{return await realFetch(u,{...init,signal:AbortSignal.any([init.signal,AbortSignal.timeout(10000)])});}catch{fail('S01_LIVE_TRANSPORT');}
 };
 // Legacy introspection remains documented until2027-02-16. Token exists in memory-only
 // provider URL; neither URL nor native exceptions are exposed to logs or receipts.
 let metadata;
 try{const r=await realFetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(token)}`,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10000)});requireThat(r.status===200&&!r.redirected,'S01_INTROSPECTION_HTTP');const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;requireThat(size<=1024*1024,'S01_INTROSPECTION_LIMIT');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}metadata=JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));}catch{fail('S01_INTROSPECTION_FAILED');}
 requireThat(String(metadata.hub_id)===c.account_id&&metadata.client_id===c.client_id,'S01_LIVE_ACCOUNT_APP_MISMATCH');
 requireThat(Array.isArray(metadata.scopes)&&metadata.scopes.includes('conversations.read'),'S01_LIVE_SCOPE_MISSING');
 const {createHubSpotAdapter}=await implementation();const adapter=createHubSpotAdapter({context:{tenant_id:c.tenant_id,connection_id:c.connection_id,source:'hubspot',source_account_id:c.account_id},token,version:'v3',scopes:metadata.scopes,fetch:boundedFetch,threadIds:[...wanted],inboxId:c.inbox_id,archived:c.archived??false,maxPages:Math.max(20,wanted.size),maxRecords:10000,maxRetries:1,maxDelayMs:1000,timeoutMs:10000,deadlineMs:deadline});
 const found=new Set(),messages=[];
 for await(const page of adapter.pages()){
  requireThat(page.errors.length===0,'S01_QUARANTINE_REQUIRES_REVIEW');
  for(const r of page.records){if(r.envelope.entity_type==='thread'&&wanted.has(r.envelope.external_id))found.add(r.envelope.external_id);if(r.envelope.entity_type==='message'&&wanted.has(r.conversation_id)){requireThat(r.body_complete,'S01_INCOMPLETE_BODY');messages.push({id:r.envelope.external_id,thread:r.conversation_id,digest:reconciliationDigest(r,key)});}}
  if(found.size===wanted.size)break;
 }
 requireThat(found.size===wanted.size&&messageRequests>=20&&threadRequests>=1,'S01_LIVE_SAMPLE_NOT_OBSERVED');
 const sort=rows=>rows.map(x=>JSON.stringify([x.thread,x.id,x.digest])).sort();
 requireThat(JSON.stringify(sort(messages))===JSON.stringify(sort(expected.messages)),'S01_UI_EXPORT_MISMATCH');
 return {status:'passed',account_scopes_verified:true,threads:found.size,messages:messages.length,requests,ui_export_reconciled:true};
}

export async function runLive(){try{return await executeLive();}catch(error){const code=String(error?.message??'');throw new Error(/^S01_[A-Z_]+(?:: explicit account-holder authorization, private configuration and independently reconciled export required)?$/.test(code)?code:'S01_LIVE_FAILED_REDACTED');}}
