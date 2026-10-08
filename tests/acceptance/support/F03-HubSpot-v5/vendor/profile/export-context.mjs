import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {nativeUiIdentity} from './ui-origin.mjs';
import {project} from './content-actions.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const strict=re=>({test:value=>typeof value==='string'&&re.test(value)});
const hash=strict(/^[a-f0-9]{64}$/),decimal=strict(/^[1-9][0-9]*$/),message=strict(/^[A-Za-z0-9_-]{1,1024}$/);
const MAX=1024*1024;const verifiedContexts=new WeakSet();
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const keys=(x,expected)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...expected].sort().join(',');
export const EXPORT_PROFILE='s01-ui-source-content-actions-export-context-v2';
const rootKeys=['schema','profile','createdAt','selectionSha256','collectionManifestSha256','records'];
const recordKeys=['accountId','threadId','messageId','captureUrl','baseUri','baseSource','htmlSha256','mhtmlSha256','collectionSha256'];
export function parseExportContext(raw,{sha256,accountId}){
 if(!(raw instanceof Uint8Array)||raw.byteLength>MAX||!hash.test(sha256??'')||sha(raw)!==sha256)fail('CONTEXT_PIN');
 if(!decimal.test(accountId??''))fail('CONTEXT_ACCOUNT');
 let doc;try{doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{fail('CONTEXT_JSON');}
 if(!keys(doc,rootKeys)||doc.schema!=='source-dom-export-context-v1'||doc.profile!=='source_dom_export_context_reconciled'||typeof doc.createdAt!=='string'||!Number.isFinite(Date.parse(doc.createdAt))||!hash.test(doc.selectionSha256??'')||!hash.test(doc.collectionManifestSha256??'')||!Array.isArray(doc.records)||doc.records.length<1||doc.records.length>10000)fail('CONTEXT_SCHEMA');
 const entries=new Map();
 for(const r of doc.records){
  if(!keys(r,recordKeys)||typeof r.captureUrl!=='string'||typeof r.baseUri!=='string'||r.accountId!==accountId||!decimal.test(r.threadId??'')||!message.test(r.messageId??'')||r.baseSource!=='captured-document-base-uri'||!['htmlSha256','mhtmlSha256','collectionSha256'].every(k=>hash.test(r[k]??'')))fail('CONTEXT_RECORD');
  let identity,base;try{identity=nativeUiIdentity(r.captureUrl);base=new URL(r.baseUri);}catch{fail('CONTEXT_CAPTURE');}
  if(identity.account!==r.accountId||identity.thread!==r.threadId)fail('CONTEXT_IDENTITY');
  // Base is a separate, pinned serialization context, never an identity source.
  if(base.origin!=='https://app.hubspot.com'||base.username||base.password||typeof r.baseUri!=='string'||r.baseUri.length>8192||/[\u0000-\u0020\u007f]/u.test(r.baseUri))fail('CONTEXT_BASE');
  const k=JSON.stringify([r.threadId,r.messageId]);if(entries.has(k))fail('CONTEXT_DUPLICATE');
  entries.set(k,Object.freeze({...r}));
 }
 const context=Object.freeze({sha256,selectionSha256:doc.selectionSha256,collectionManifestSha256:doc.collectionManifestSha256,size:entries.size,
  uiRecord(pins){if(!keys(pins,['messageId','htmlSha256','mhtmlSha256','collectionSha256']))fail('CONTEXT_UI_PINS');const matches=[...entries.values()].filter(r=>Object.keys(pins).every(k=>r[k]===pins[k]));if(matches.length!==1)fail('CONTEXT_UI_PINS');return matches[0];},
  get(identity){if(!keys(identity,['accountId','threadId','messageId'])||!decimal.test(identity.threadId)||!message.test(identity.messageId)||identity.accountId!==accountId)fail('CONTEXT_SCOPE');const r=entries.get(JSON.stringify([identity.threadId,identity.messageId]));if(!r)fail('CONTEXT_SCOPE');return r;},
 });verifiedContexts.add(context);return context;
}
export async function loadExportContext(file,options){
 if(!path.isAbsolute(file))fail('CONTEXT_PATH');
 const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const stat=await handle.stat();if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.size>MAX)fail('CONTEXT_FILE');
  const bytes=Buffer.alloc(MAX+1);let offset=0;while(offset<bytes.length){const r=await handle.read(bytes,offset,bytes.length-offset,offset);if(!r.bytesRead)break;offset+=r.bytesRead;}
  if(offset>MAX||offset!==stat.size)fail('CONTEXT_SIZE');return parseExportContext(bytes.subarray(0,offset),options);
 }finally{await handle.close();}
}
export function projectWithExportContext(input,identity,context){
 if(!verifiedContexts.has(context))fail('CONTEXT_UNVERIFIED');
 if(Object.hasOwn(input,'base')||Object.hasOwn(input,'exportContextRelativeSpaces'))fail('CONTEXT_OVERRIDE');
 const binding=context.get(identity);
 const pending=[input.tree];let visited=0;while(pending.length){const n=pending.pop();if(++visited>10000)fail('CONTEXT_TREE_LIMIT');if(typeof n==='string')continue;if(!n||typeof n!=='object'||!Array.isArray(n.children))fail('CONTEXT_TREE');if(n.tag==='base')fail('CONTEXT_OWN_BASE');pending.push(...n.children);}
 const result=project({...input,base:binding.baseUri,exportContextRelativeSpaces:true});
 const value={...result.value,profile:EXPORT_PROFILE};
 const canonicalIdentity={accountId:binding.accountId,threadId:binding.threadId,messageId:binding.messageId};
 return {...result,value,digest:sha(JSON.stringify(value)),exportContext:{sha256:context.sha256,binding:canonicalIdentity,captureUrlSha256:sha(binding.captureUrl),baseUriSha256:sha(binding.baseUri),baseKind:'prefixed-ui-export-serialization-context',htmlSha256:binding.htmlSha256,mhtmlSha256:binding.mhtmlSha256,collectionSha256:binding.collectionSha256},claims:{sourceEmailOwnBaseVerified:false,historicalProviderRewriteVerified:false,renderedUiVerified:false,formalAcceptance:false}};
}
export function compareWithExportContext(expected,actual){
 for(const x of [expected,actual])if(x?.status!=='SUPPORTED'||x.value?.profile!==EXPORT_PROFILE||!hash.test(x.digest??'')||sha(JSON.stringify(x.value))!==x.digest||!hash.test(x.exportContext?.sha256??'')||!hash.test(x.exportContext?.baseUriSha256??'')||!hash.test(x.exportContext?.captureUrlSha256??'')||!keys(x.exportContext?.binding,['accountId','threadId','messageId'])||!decimal.test(x.exportContext.binding.accountId??'')||!decimal.test(x.exportContext.binding.threadId??'')||!message.test(x.exportContext.binding.messageId??''))fail('CONTEXT_COMPARISON');
 if(expected.exportContext.sha256!==actual.exportContext.sha256||JSON.stringify(expected.exportContext.binding)!==JSON.stringify(actual.exportContext.binding)||expected.exportContext.baseUriSha256!==actual.exportContext.baseUriSha256||expected.exportContext.captureUrlSha256!==actual.exportContext.captureUrlSha256)fail('CONTEXT_COMPARISON_BINDING');
 const same=expected.digest===actual.digest;
 return {status:same?'MATCH':'MISMATCH',uiSourceContentActionsReconciled:same,providerPlainExactNfc:null,quoteAttributionVerified:false,visualStructureVerified:false,historicalProviderRewriteVerified:false,sourceEmailOwnBaseVerified:false,formalAcceptance:false};
}
