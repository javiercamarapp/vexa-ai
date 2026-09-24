import {randomUUID} from 'node:crypto';
import {createDurableBudgetRepository} from '../gateway/durable-budget.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validWindow=value=>typeof value==='string'&&value.length>0&&value.length<=100;
const fail=(status,code)=>{throw Object.assign(Error(code),{status,code});};
function fields(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(400,'problem_input_invalid');}
function dollars(value){if(typeof value!=='string'||!/^\d{1,12}(?:\.\d{1,6})?$/.test(value))fail(400,'problem_input_invalid');const [whole,fraction='']=value.split('.');return String(BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0')));}
function version(value){if(!Number.isSafeInteger(value)||value<1||value>=2147483647)fail(400,'problem_input_invalid');}
/** Owner operations only. Configuration never enables a runtime or sends inference. */
export function createProblemBudget({database,window:configuredWindow}={}){
 const window=validWindow(configuredWindow)?configuredWindow:null;
 const ownerDatabase={transaction:async(action,work)=>{let roleDenied=false;try{return await database.transaction(action,scope=>{if(scope.role!=='owner'){roleDenied=true;fail(403,'role_insufficient');}return work(scope);});}catch(error){if(roleDenied)fail(403,'role_insufficient');throw error;}}};
 const repository=jobId=>createDurableBudgetRepository({database:ownerDatabase,purpose:'embedding',jobId:jobId??randomUUID()});
 const owner=async()=>ownerDatabase.transaction('read',scope=>scope.tenantId);
 return Object.freeze({
  async read(){
   await owner();
   const input=await ownerDatabase.transaction('read',async s=>({
    limits:window?(await s.query("SELECT purpose,limit_minor::text AS \"limitMinor\",version FROM public.ai_budget_limits WHERE tenant_id=$1 AND window_key=$2 AND purpose IN ('all','embedding') ORDER BY purpose",[s.tenantId,window])).rows:[],
    // Outstanding costs remain reconcilable after the configured window changes.
    windows:(await s.query("SELECT DISTINCT window_key FROM public.ai_budget_reservations WHERE tenant_id=$1 AND purpose='embedding' AND (state IN ('reserved','uncertain') OR window_key=$2) ORDER BY window_key",[s.tenantId,window])).rows.map(row=>row.window_key)
   }));
   const reservations=[];
   for(const key of input.windows){const rows=await repository().list({window:key});reservations.push(...rows.filter(row=>key===window||['reserved','uncertain'].includes(row.state)));}
   return {window,limits:input.limits,reservations};
  },
  async configure(input){
   await owner();fields(input,['operation','purpose','limitUsd','expectedVersion','expectedWindow']);
   if(!['all','embedding'].includes(input.purpose)||!validWindow(input.expectedWindow))fail(400,'problem_input_invalid');
   if(input.expectedVersion!==undefined)version(input.expectedVersion);
   const limitMinor=dollars(input.limitUsd);
   if(!window)fail(503,'configuration_required');
   if(input.expectedWindow!==window)fail(409,'budget_window_changed');
   return repository().configure({window,purpose:input.purpose,limitMinor,expectedVersion:input.expectedVersion});
  },
  async reconcile(input){
   await owner();fields(input,['operation','reservationId','expectedVersion','expectedWindow','actualUsd','evidenceHash','confirmedProviderEvidence']);
   if(!uuid(input.reservationId)||!validWindow(input.expectedWindow)||typeof input.evidenceHash!=='string'||!/^[a-f0-9]{64}$/.test(input.evidenceHash)||input.confirmedProviderEvidence!==true)fail(400,'problem_input_invalid');
   version(input.expectedVersion);const actualMinor=dollars(input.actualUsd);
   const row=await ownerDatabase.transaction('configure',async s=>(await s.query("SELECT job_id FROM public.ai_budget_reservations WHERE tenant_id=$1 AND id=$2 AND purpose='embedding' AND window_key=$3",[s.tenantId,input.reservationId,input.expectedWindow])).rows[0]);
   if(!row)fail(404,'budget_reservation_not_found');
   return repository(row.job_id).reconcile({reservationId:input.reservationId,expectedVersion:input.expectedVersion,actualMinor,evidenceHash:input.evidenceHash,confirmedProviderEvidence:true});
  }
 });
}
