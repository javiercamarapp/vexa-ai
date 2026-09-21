// Read-only diagnostic. Explicit authorized operator invocation only. Never prints provider bodies/IDs.
import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHubSpotAdapter,ConnectorError} from './index.mjs';
export async function runHubSpotSpike(config,{authorizationRef,accountConfirmed,versionConfirmed}={}){
 if(typeof authorizationRef!=='string'||!authorizationRef.trim()||accountConfirmed!==true||versionConfirmed!==true)throw new ConnectorError('LIVE_AUTHORIZATION_REQUIRED');
 if(!Array.isArray(config.threadIds)||config.threadIds.length<20)throw new ConnectorError('LIVE_THREAD_ALLOWLIST_REQUIRED');
 const counts={pages:0,threads:0,messages:0,notes:0,tickets:0,rejected:0,bodies_missing:0,notes_bodies_missing:0};
 // S01 needs an independent UI/export reconciliation, never satisfied by this diagnostic alone.
 const receipt={schema:'vexa-hubspot-s01-observation-v1',status:'blocked',live_attempted:true,s01_accepted:false,version:'v3',counts,method:'GET',provider_host:'api.hubapi.com',scope_claims_verified:false,pending:['independent_scope_and_account_verification','20_threads_reconciled_with_authorized_UI_or_export'],error:null};
 try{const adapter=createHubSpotAdapter({...config,deadlineMs:Math.min(config.deadlineMs??Infinity,Date.now()+300000),maxPages:Math.min(config.maxPages??20,20),maxRecords:Math.min(config.maxRecords??10000,10000)});
  for await(const page of adapter.pages()){
   counts.pages++;counts.rejected+=page.errors.length;counts.bodies_missing+=page.coverage.bodies_missing;counts.notes_bodies_missing+=page.coverage.notes_bodies_missing;
   for(const r of page.records){const type=r.envelope.entity_type;if(type==='thread')counts.threads++;if(type==='message')counts.messages++;if(type==='note')counts.notes++;if(type==='ticket')counts.tickets++;}
   if(counts.threads>=20)break;
  }
  receipt.status=counts.threads>=20&&counts.messages>0&&counts.rejected===0&&counts.bodies_missing===0&&counts.notes_bodies_missing===0?'observed_needs_reconciliation':'blocked_insufficient_coverage';
 }catch(e){receipt.status='failed';receipt.error={code:e instanceof ConnectorError?e.code:'SPIKE_ERROR',status:e instanceof ConnectorError?e.status:null};}
 return receipt;
}
async function main(){
 const filename=process.env.VEXA_HUBSPOT_SPIKE_CONFIG,token=process.env.VEXA_HUBSPOT_TOKEN;
 if(!filename||!token){console.log(JSON.stringify({schema:'vexa-hubspot-s01-observation-v1',status:'blocked',live_attempted:false,s01_accepted:false,error:{code:'LIVE_CONFIGURATION_REQUIRED'}}));return 2;}
 try{
  const info=await stat(filename);if(!info.isFile()||(info.mode&0o077)!==0||info.size>16384)throw new ConnectorError('PRIVATE_CONFIG_REQUIRED');
  const conf=JSON.parse(await readFile(filename,'utf8'));
  // Explicit allowlist: JSON cannot install fetchers, change hosts, or disable deadlines.
  const {context,version,scopes,archived,inboxId,includeTickets,includeNotes,threadIds}=conf;
  const receipt=await runHubSpotSpike({context,version,scopes,archived,inboxId,includeTickets,includeNotes,threadIds,token},{authorizationRef:conf.authorizationRef,accountConfirmed:conf.accountConfirmed,versionConfirmed:conf.versionConfirmed});
  console.log(JSON.stringify(receipt));return receipt.status==='observed_needs_reconciliation'?0:2;
 }catch{console.log(JSON.stringify({schema:'vexa-hubspot-s01-observation-v1',status:'blocked',live_attempted:false,s01_accepted:false,error:{code:'INVALID_PRIVATE_CONFIGURATION'}}));return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
