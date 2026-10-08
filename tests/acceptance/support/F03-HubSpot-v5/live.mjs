// Capture both real transports at module evaluation, BEFORE any candidate import.
import{createNativeObserver}from'./vendor/observer/native-observer.mjs';
const capturedMetadataFetch=globalThis.fetch.bind(globalThis);
import fs from'node:fs';import path from'node:path';import{pathToFileURL}from'node:url';
import{fragmentTree}from'./vendor/parser/fragment.mjs';
import{loadExportContext,projectWithExportContext,EXPORT_PROFILE}from'./vendor/profile/export-context.mjs';
import{projectionWitness,verifyMessage}from'./vendor/dual/identity.mjs';
import{privateJSON,validateConfig,validateReference,verifyCandidateManifest,reserveReceipt,hash,need}from'./contract.mjs';
import{executePrepared}from'./driver-core.mjs';
import{projectionCharge}from'./projection-budget.mjs';
function controlPins(){const d=JSON.parse(fs.readFileSync(new URL('./dependencies.json',import.meta.url),'utf8'));need(d.schema==='s01-external-control-pins-v1'&&Array.isArray(d.files)&&d.files.length>0,'S01_CONTROL_MANIFEST');for(const f of d.files){need(typeof f.path==='string'&&!path.isAbsolute(f.path)&&f.path.split('/').every(x=>x&&x!=='.'&&x!=='..')&&typeof f.sha256==='string'&&/^[a-f0-9]{64}$/.test(f.sha256),'S01_CONTROL_PIN');const target=new URL(f.path,import.meta.url);const st=fs.lstatSync(target);need(st.isFile()&&!st.isSymbolicLink()&&hash(fs.readFileSync(target))===f.sha256,'S01_CONTROL_DRIFT');}}
const safeCode=e=>typeof e?.code==='string'&&/^(?:S01|OBS|DUAL|CONTEXT|FRAGMENT|UNSUPPORTED|LIMIT)_[A-Z_]+$/.test(e.code)?e.code:'S01_LIVE_FAILED_REDACTED';
export async function runLive(){
 need(arguments.length===0,'S01_NO_CALLER_OVERRIDES');let receipt,config,sourceManifest,root,summary,callbackPeak=0;const began=Date.now();
 try{
  controlPins();need(typeof process.env.VEXA_CANDIDATE==='string'&&path.isAbsolute(process.env.VEXA_CANDIDATE),'S01_CANDIDATE_REQUIRED');root=fs.realpathSync(process.env.VEXA_CANDIDATE);need(process.env.VEXA_HUBSPOT_S01_CONFIG,'S01_LIVE_BLOCKED');const loaded=privateJSON(process.env.VEXA_HUBSPOT_S01_CONFIG,root);config=validateConfig(loaded.value,process.env.VEXA_HUBSPOT_APPROVAL_REFERENCE,EXPORT_PROFILE);const ref=privateJSON(config.reconciliation_file,root);need(hash(ref.bytes)===config.reconciliation_sha256,'S01_REFERENCE_PIN');const context=await loadExportContext(config.export_context_file,{sha256:config.export_context_sha256,accountId:config.account_id});privateJSON(config.export_context_file,root);const reference=validateReference(ref.value,config,context);const sm=privateJSON(config.candidate_manifest_file,root);need(hash(sm.bytes)===config.candidate_manifest_sha256,'S01_CANDIDATE_MANIFEST_PIN');sourceManifest=sm.value;verifyCandidateManifest(sourceManifest,root);
  const token=process.env.VEXA_HUBSPOT_TOKEN,key=process.env.VEXA_HUBSPOT_RECONCILIATION_KEY;need(typeof token==='string'&&token.length>15&&!/[\r\n]/.test(token)&&typeof key==='string'&&key.length>=32,'S01_SECRETS_REQUIRED');
  receipt=reserveReceipt(config.receipt_file,root); // Exclusive destination before ANY native network.
  const projectRich=({thread,id,richText},observer)=>{
   const {aggregateCharge}=projectionCharge(richText,observer.stats().retainedBytes);callbackPeak=Math.max(callbackPeak,aggregateCharge);
   // Preventive logical charge (not an AST heap bound) for synchronous parser/tree/projection; released on return.
   const tree=fragmentTree(richText),treeSha256=hash(JSON.stringify(tree));const result=projectWithExportContext({tree,treeSha256,sourceSha256:hash(richText)},{accountId:config.account_id,threadId:thread,messageId:id},context);return projectionWitness(result,{profile:EXPORT_PROFILE,contextSha256:context.sha256,accountId:config.account_id,threadId:thread,messageId:id});
  };
  summary=await executePrepared({config,reference,token,key,createObserver:createNativeObserver,metadataFetch:capturedMetadataFetch,projectRich,verifyMessage,loadImplementation:async()=>{controlPins();verifyCandidateManifest(sourceManifest,root);return import(pathToFileURL(path.join(root,'packages/connectors/index.mjs')).href);}});
  controlPins();verifyCandidateManifest(sourceManifest,root);receipt.write({schema:'s01-live-v5-receipt',...summary,peakCallbackAggregateReservation:callbackPeak,controlProfile:EXPORT_PROFILE,elapsedIncludingPreflightMs:Date.now()-began,formalAcceptance:false});return summary;
 }catch(e){const code=safeCode(e);receipt?.write({schema:'s01-live-v5-receipt',status:'failed',code,elapsedMs:Date.now()-began,networkMayHaveOccurred:Boolean(receipt),formalAcceptance:false});throw Object.assign(new Error(code),{code});}finally{receipt?.close();}
}
