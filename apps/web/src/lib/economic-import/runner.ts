import {traducir,type Clave,type Variables} from '../i18n';
type ClaveError=Extract<Clave,`tr.err.${string}`>;
import {EconomicImportError,parseImport,readSnapshot,reconcileImport,sameFields,currencyFields,sourceFields,entryFields,entryIdentity,type EconomicImport,type ImportSnapshot} from './contract';
export type ImportProgress={phase:'checking'|'running'|'paused'|'complete'|'error'|'unauthorized';verifiedEntries:number;acknowledgedEntries:number;totalEntries:number;completedOperations:number;message:string;clave?:ClaveError;vars?:Variables};
const say=(clave:ClaveError,vars?:Variables)=>({message:traducir('es',clave,vars),clave,vars});
type Options={fetch?:typeof fetch;signal:AbortSignal;onProgress:(progress:ImportProgress)=>void};
export function scopeQuery(doc:EconomicImport){return new URLSearchParams(Object.fromEntries(Object.entries(doc.scope).filter(([key])=>key!=='dateBasis').map(([key,value])=>[key,String(value)]))).toString();}
export async function runEconomicImport(input:EconomicImport,tenantId:string,{fetch:fetcher=fetch,signal,onProgress}:Options):Promise<ImportProgress>{
 let progress:ImportProgress={phase:'checking',verifiedEntries:0,acknowledgedEntries:0,totalEntries:0,completedOperations:0,...say('tr.err.impRunValidando')};
 const emit=(next:Partial<ImportProgress>)=>{progress={...progress,...next};onProgress({...progress});};
 const cancelled=()=>{if(signal.aborted)throw new EconomicImportError('paused','tr.err.impRunPausa');};
 async function request(url:string,body?:Record<string,unknown>):Promise<unknown>{
  cancelled();let response:Response;
  try{response=await fetcher(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-Economic-Import-Tenant':tenantId}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});}
  catch{throw new EconomicImportError(signal.aborted?'paused':'uncertain',body?'tr.err.impRunSinConfirmar':'tr.err.impRunNoVerifLedger');}
  if(response.status===401||response.status===403)throw new EconomicImportError('access','tr.err.impRunAcceso',undefined,true);
  if(!response.ok)throw new EconomicImportError(response.status===409?'conflict':'request',response.status===409?'tr.err.impRunConflicto':'tr.err.impRunRechazo');
  try{return await response.json();}catch{throw new EconomicImportError('uncertain','tr.err.impRunRespNoVerif');}
 }
 try{
  // Revalidate every field before ANY request; callers cannot bypass prevalidation.
  const doc=parseImport(JSON.stringify(input),tenantId);progress.totalEntries=doc.entries.length;emit({});
  const load=async():Promise<ImportSnapshot>=>readSnapshot(await request('/api/economics?'+scopeQuery(doc)),tenantId);
  let snapshot=await load();cancelled();const plan=await reconcileImport(doc,snapshot);cancelled();
  emit({verifiedEntries:plan.existingEntries,acknowledgedEntries:plan.existingEntries,phase:'running',...say('tr.err.impRunGuardando')});
  const acknowledge=async(operation:string,record:Record<string,unknown>,fields:string[],expectedVersion:number,expectedId?:string)=>{
   const raw=await request('/api/economics',{operation,...record,attested:true});
   if(!raw||typeof raw!=='object'||!('data' in raw)||!raw.data||typeof raw.data!=='object')throw new EconomicImportError('uncertain','tr.err.impRunUltimoNoVerif');
   const row=raw.data as Record<string,unknown>;
   if(!sameFields(row,record,fields)||(operation==='record'?row.revision:row.version)!==expectedVersion||(expectedId!==undefined&&row.id!==expectedId)||(operation==='currency'&&row.valid!==true))throw new EconomicImportError('uncertain','tr.err.impRunNoCoincide');
   emit({completedOperations:progress.completedOperations+1,...(operation==='record'?{acknowledgedEntries:progress.acknowledgedEntries+1}:{}),...(operation==='record'?say('tr.err.impRunRespuestaN',{n:progress.acknowledgedEntries+1,total:doc.entries.length}):say('tr.err.impRunConfigGuardada'))});
   cancelled();
  };
  if(plan.currency)await acknowledge('currency',plan.currency,currencyFields,1);
  for(const source of plan.sources)await acknowledge('source',source,sourceFields,1,source.sourceId);
  for(const entry of plan.entries)await acknowledge('record',entry,entryFields,1,await entryIdentity(tenantId,entry));
  emit({phase:'checking',...say('tr.err.impRunRecomprobando')});
  snapshot=await load();cancelled();const final=await reconcileImport(doc,snapshot);cancelled();
  if(final.currency||final.sources.length||final.entries.length)throw new EconomicImportError('incomplete','tr.err.impRunFinalIncompleta');
  emit({phase:'complete',verifiedEntries:doc.entries.length,acknowledgedEntries:doc.entries.length,...say('tr.err.impRunCompleto')});
 }catch(error){
  const e=error instanceof EconomicImportError?error:new EconomicImportError('request','tr.err.impRunFallo');
  const unauthorized=e.accessLost||e.code==='tenant'||e.code==='owner';
  emit({phase:unauthorized?'unauthorized':signal.aborted||e.code==='paused'?'paused':'error',...say(e.clave,e.vars),...(unauthorized?{verifiedEntries:0,acknowledgedEntries:0,totalEntries:0,completedOperations:0}:{})});
 }
 return progress;
}
