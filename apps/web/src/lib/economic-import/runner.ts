import {EconomicImportError,parseImport,readSnapshot,reconcileImport,sameFields,currencyFields,sourceFields,entryFields,entryIdentity,type EconomicImport,type ImportSnapshot} from './contract';
export type ImportProgress={phase:'checking'|'running'|'paused'|'complete'|'error'|'unauthorized';verifiedEntries:number;acknowledgedEntries:number;totalEntries:number;completedOperations:number;message:string};
type Options={fetch?:typeof fetch;signal:AbortSignal;onProgress:(progress:ImportProgress)=>void};
export function scopeQuery(doc:EconomicImport){return new URLSearchParams(Object.fromEntries(Object.entries(doc.scope).filter(([key])=>key!=='dateBasis').map(([key,value])=>[key,String(value)]))).toString();}
export async function runEconomicImport(input:EconomicImport,tenantId:string,{fetch:fetcher=fetch,signal,onProgress}:Options):Promise<ImportProgress>{
 let progress:ImportProgress={phase:'checking',verifiedEntries:0,acknowledgedEntries:0,totalEntries:0,completedOperations:0,message:'Validando archivo y comprobando el ledger antes de escribir…'};
 const emit=(next:Partial<ImportProgress>)=>{progress={...progress,...next};onProgress({...progress});};
 const cancelled=()=>{if(signal.aborted)throw new EconomicImportError('paused','Carga pausada. La próxima continuación comprobará el ledger antes de reenviar.');};
 async function request(url:string,body?:Record<string,unknown>):Promise<unknown>{
  cancelled();let response:Response;
  try{response=await fetcher(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-Economic-Import-Tenant':tenantId}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});}
  catch{throw new EconomicImportError(signal.aborted?'paused':'uncertain',body?'No se confirmó el último guardado. Conserva este archivo y reanuda para comprobar el ledger.':'No se pudo verificar el ledger. No se enviarán más registros.');}
  if(response.status===401||response.status===403)throw new EconomicImportError('access','Tu acceso cambió. Se retiró el archivo; vuelve a iniciar sesión y a seleccionarlo.',true);
  if(!response.ok)throw new EconomicImportError(response.status===409?'conflict':'request',response.status===409?'Conflicto de identidad, versión o espacio de trabajo. Se detuvo la carga; revisa el ledger antes de reanudar.':'El servidor rechazó o no confirmó la operación. Se detuvo la carga.');
  try{return await response.json();}catch{throw new EconomicImportError('uncertain','La respuesta no se pudo verificar. Reanuda para comprobar el ledger antes de reenviar.');}
 }
 try{
  // Revalidate every field before ANY request; callers cannot bypass prevalidation.
  const doc=parseImport(JSON.stringify(input),tenantId);progress.totalEntries=doc.entries.length;emit({});
  const load=async():Promise<ImportSnapshot>=>readSnapshot(await request('/api/economics?'+scopeQuery(doc)),tenantId);
  let snapshot=await load();cancelled();const plan=await reconcileImport(doc,snapshot);cancelled();
  emit({verifiedEntries:plan.existingEntries,acknowledgedEntries:plan.existingEntries,phase:'running',message:'Archivo revisado. Guardando secuencialmente; todavía no se ha comprobado la carga completa.'});
  const acknowledge=async(operation:string,record:Record<string,unknown>,fields:string[],expectedVersion:number,expectedId?:string)=>{
   const raw=await request('/api/economics',{operation,...record,attested:true});
   if(!raw||typeof raw!=='object'||!('data' in raw)||!raw.data||typeof raw.data!=='object')throw new EconomicImportError('uncertain','No se pudo verificar el último guardado. Es necesario comprobar el ledger.');
   const row=raw.data as Record<string,unknown>;
   if(!sameFields(row,record,fields)||(operation==='record'?row.revision:row.version)!==expectedVersion||(expectedId!==undefined&&row.id!==expectedId)||(operation==='currency'&&row.valid!==true))throw new EconomicImportError('uncertain','La respuesta del guardado no coincide con el archivo. La carga se detuvo.');
   emit({completedOperations:progress.completedOperations+1,...(operation==='record'?{acknowledgedEntries:progress.acknowledgedEntries+1}:{}),message:operation==='record'?`Respuesta de guardado recibida para ${progress.acknowledgedEntries+1} de ${doc.entries.length} registros. Pendiente de comprobación final.`:'Configuración guardada; continuando con el archivo revisado.'});
   cancelled();
  };
  if(plan.currency)await acknowledge('currency',plan.currency,currencyFields,1);
  for(const source of plan.sources)await acknowledge('source',source,sourceFields,1,source.sourceId);
  for(const entry of plan.entries)await acknowledge('record',entry,entryFields,1,await entryIdentity(tenantId,entry));
  emit({phase:'checking',message:'Comprobando nuevamente todos los registros y metadatos en el ledger…'});
  snapshot=await load();cancelled();const final=await reconcileImport(doc,snapshot);cancelled();
  if(final.currency||final.sources.length||final.entries.length)throw new EconomicImportError('incomplete','La lectura final no acredita todos los registros. Conserva el archivo y reanuda para comprobar lo pendiente.');
  emit({phase:'complete',verifiedEntries:doc.entries.length,acknowledgedEntries:doc.entries.length,message:'Todos los registros del archivo coinciden con el ledger. No se publicó ningún snapshot ni se acredita completitud de las fuentes.'});
 }catch(error){
  const e=error instanceof EconomicImportError?error:new EconomicImportError('request','No se pudo completar la carga. Reanuda para comprobar el ledger.');
  const unauthorized=e.accessLost||e.code==='tenant'||e.code==='owner';
  emit({phase:unauthorized?'unauthorized':signal.aborted||e.code==='paused'?'paused':'error',message:e.message,...(unauthorized?{verifiedEntries:0,acknowledgedEntries:0,totalEntries:0,completedOperations:0}:{})});
 }
 return progress;
}
