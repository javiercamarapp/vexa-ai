import fs from 'node:fs';
import path from 'node:path';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(value).digest('hex');
export function validateAuthorization(config,reference,now=Date.now()){
 if(!config||config.version!==1||typeof config.authorizationRef!=='string'||config.authorizationRef.length<8)fail('S02_AUTHORIZATION_REQUIRED');
 if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(config.subdomain??''))fail('S02_SUBDOMAIN_REQUIRED');
 if(config.context?.source!=='zendesk'||config.context?.source_account_id!==config.subdomain||!config.context?.tenant_id||!config.context?.connection_id)fail('S02_CONTEXT_REQUIRED');
 if(config.accountConfirmed!==true||config.providerContractConfirmed!==true||config.authorizedReadScope!=='account-wide-incremental-tickets-comments-authors')fail('S02_SCOPE_REQUIRED');
 if(!Number.isSafeInteger(config.startTime)||config.startTime<0||config.startTime>=Math.floor(now/1000)-60)fail('S02_WINDOW_REQUIRED');
 if(!Number.isSafeInteger(config.expiresAt)||config.expiresAt<=now||config.expiresAt>now+86400000)fail('S02_AUTHORIZATION_EXPIRED');
 if(typeof config.expectedAdminUserId!=='string'||!/^\d+$/.test(config.expectedAdminUserId))fail('S02_IDENTITY_REQUIRED');
 if(!Number.isSafeInteger(config.maxPages)||config.maxPages<1||config.maxPages>100||!Number.isSafeInteger(config.maxRecords)||config.maxRecords<20||config.maxRecords>100000)fail('S02_LIMIT_REQUIRED');
 if(reference?.version!==1||reference.subdomain!==config.subdomain||reference.startTime!==config.startTime||typeof reference.independentExportRef!=='string'||reference.independentExportRef.length<8||!['ui-export','authorized-export'].includes(reference.origin))fail('S02_INDEPENDENT_REFERENCE_REQUIRED');
 if(!Array.isArray(reference.tickets)||reference.tickets.length<20||new Set(reference.tickets.map(t=>t.id)).size!==reference.tickets.length)fail('S02_SAMPLE_REQUIRED');
 let internal=false,deleted=false,updated=false;
 for(const t of reference.tickets){if(typeof t.id!=='string'||!/^\d+$/.test(t.id)||typeof t.updated_at!=='string'||!Number.isFinite(Date.parse(t.updated_at))||typeof t.deleted!=='boolean'||!Array.isArray(t.comments))fail('S02_REFERENCE_SCHEMA');deleted||=t.deleted;updated||=t.updated_since_previous_export===true;
  if(new Set(t.comments.map(c=>c?.id)).size!==t.comments.length)fail('S02_REFERENCE_DUPLICATE_COMMENT');
  for(const c of t.comments){if(typeof c.id!=='string'||!/^\d+$/.test(c.id)||!['customer','agent','internal','unknown'].includes(c.role)||!['public','internal','unknown'].includes(c.visibility)||!/^([a-f0-9]{64})$/.test(c.text_sha256??''))fail('S02_REFERENCE_SCHEMA');internal||=c.visibility==='internal';}
 }
 if(!internal||!deleted||!updated)fail('S02_REFERENCE_COVERAGE_REQUIRED');
}
function secureRead(file,root){const real=fs.realpathSync(file),base=fs.realpathSync(root);if(!real.startsWith(`${base}${path.sep}`)||fs.lstatSync(file).isSymbolicLink())fail('S02_PRIVATE_FILE_REQUIRED');const s=fs.statSync(real);if(!s.isFile()||(s.mode&0o077)!==0||s.size>8*1024*1024)fail('S02_PRIVATE_FILE_REQUIRED');return fs.readFileSync(real,'utf8');}
function parse(text){try{return JSON.parse(text);}catch{fail('S02_PRIVATE_JSON_INVALID');}}
export async function runLive(candidate){
 const configPath=process.env.VEXA_ZENDESK_S02_CONFIG,approval=process.env.VEXA_ZENDESK_APPROVAL_REFERENCE;
 if(!configPath||!approval||!fs.existsSync(configPath))fail('S02_LIVE_BLOCKED_ACCESS_AND_AUTHORIZATION');
 const privateRoot=path.dirname(path.resolve(configPath)),config=parse(secureRead(configPath,privateRoot));
 if(config.authorizationRef!==approval)fail('S02_APPROVAL_MISMATCH');
 if(typeof config.referenceFile!=='string')fail('S02_PRIVATE_FILE_REQUIRED');
 const referenceText=secureRead(path.resolve(privateRoot,config.referenceFile),privateRoot),reference=parse(referenceText);
 if(digest(referenceText)!==config.referenceSha256)fail('S02_REFERENCE_HASH');
 validateAuthorization(config,reference);
 const key=process.env.VEXA_ZENDESK_RECONCILIATION_KEY;if(typeof key!=='string'||Buffer.byteLength(key)<32)fail('S02_RECONCILIATION_KEY_REQUIRED');
 const {signature,...signedReference}=reference;const wanted=createHmac('sha256',key).update(JSON.stringify(signedReference)).digest();if(typeof signature!=='string'||! /^[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(wanted,Buffer.from(signature,'hex')))fail('S02_REFERENCE_SIGNATURE');
 const token=(process.env.VEXA_ZENDESK_TOKEN??'').trim();if(!token||/[\r\n]/.test(token))fail('S02_TOKEN_REQUIRED');
 const origin=`https://${config.subdomain}.zendesk.com`,counts={requests:0,incremental:0,comments:0,users:0};let totalBytes=0;
 const deadline=Math.min(config.expiresAt,Date.now()+300000);
 async function guarded(raw,init={}){
  if(Date.now()>=deadline)fail('S02_DEADLINE');const u=new URL(raw);if(u.origin!==origin||u.username||u.password||u.hash||init.method!=='GET'||!/^\/api\/v2\/(?:incremental\/tickets\/cursor\.json|tickets\/\d+\/comments\.json|users\/(?:\d+|me)\.json|oauth\/tokens\/current\.json)$/.test(u.pathname))fail('S02_READ_SCOPE');
  if(++counts.requests>1000)fail('S02_REQUEST_LIMIT');if(u.pathname.includes('/incremental/'))counts.incremental++;else if(u.pathname.includes('/comments'))counts.comments++;else if(u.pathname.includes('/users/'))counts.users++;
  let r;try{r=await fetch(u,{...init,redirect:'manual',signal:AbortSignal.any([AbortSignal.timeout(Math.min(15000,deadline-Date.now())),...(init.signal?[init.signal]:[])])});}catch{fail('S02_NETWORK_ERROR');}
  if(r.redirected||r.status>=300&&r.status<400){await r.body?.cancel();fail('S02_REDIRECT_BLOCKED');}
  const reader=r.body?.getReader();if(!reader)fail('S02_RESPONSE_SCHEMA');const chunks=[];let bytes=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;totalBytes+=value.length;if(bytes>8*1024*1024||totalBytes>64*1024*1024)fail('S02_RESPONSE_LIMIT');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  return new Response(Buffer.concat(chunks),{status:r.status,headers:r.headers});
 }
 async function get(route){const r=await guarded(`${origin}${route}`,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});if(!r.ok)fail(`S02_ACCESS_HTTP_${r.status}`);try{return await r.json();}catch{fail('S02_RESPONSE_SCHEMA');}}
 const me=(await get('/api/v2/users/me.json')).user;
 if(String(me?.id)!==config.expectedAdminUserId||me?.role!=='admin'||me?.suspended===true)fail('S02_EFFECTIVE_ADMIN_REQUIRED');
 const effective=(await get('/api/v2/oauth/tokens/current.json')).token;
 if(String(effective?.user_id)!==String(me.id)||!Array.isArray(effective?.scopes)||!(effective.scopes.includes('read')||effective.scopes.includes('tickets:read')&&effective.scopes.includes('users:read')))fail('S02_EFFECTIVE_SCOPES_REQUIRED');
 const {createZendeskAdapter}=await import(pathToFileURL(path.join(candidate,'packages/connectors/index.mjs')));
 if(typeof createZendeskAdapter!=='function')fail('S02_ADAPTER_REQUIRED');
 const adapter=createZendeskAdapter({context:config.context,subdomain:config.subdomain,startTime:config.startTime,token,fetch:guarded,maxPages:config.maxPages,maxRecords:config.maxRecords,deadlineMs:deadline});
 const records=[];let pages=0,final=null;
 for await(const p of adapter.pages()){pages++;if(p.errors?.length)fail('S02_QUARANTINE_PRESENT');records.push(...p.records);final=p;}
 if(!final?.done||!final.checkpoint?.cursor||pages<1)fail('S02_STREAM_NOT_COMPLETE');
 let matched=0,messages=0;
 for(const expected of reference.tickets){const t=records.find(r=>r.envelope.entity_type==='ticket'&&r.envelope.external_id===expected.id);if(!t||t.deleted!==expected.deleted||t.provider_updated_at!==expected.updated_at)fail('S02_TICKET_RECONCILIATION');const actual=records.filter(r=>r.envelope.entity_type==='message'&&r.conversation_id===expected.id);if(new Set(actual.map(r=>r.envelope.external_id)).size!==actual.length)fail('S02_ACTUAL_DUPLICATE_COMMENT');if(actual.length!==expected.comments.length)fail('S02_COMMENT_COUNT');for(const e of expected.comments){const m=actual.find(r=>r.envelope.external_id===e.id);if(!m||m.role!==e.role||m.visibility!==e.visibility||!m.body_complete||typeof m.text!=='string'||digest(m.text.normalize('NFC'))!==e.text_sha256)fail('S02_COMMENT_RECONCILIATION');messages++;}matched++;}
 if(messages<20)fail('S02_MESSAGE_COVERAGE');
 return {status:'pass',s02_live:true,matched_tickets:matched,matched_messages:messages,pages,requests:counts.requests,reference_sha256:config.referenceSha256,provider:'zendesk',external_validation_only:true};
}
