import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {serverPool} from '../imports/server';
import {ACTIVE_ORG,AccessError,config,identity,PRIVATE_HEADERS,resolveSession} from '../auth';
import {requestAuth} from '../auth-http';
import {createInsightsReader} from '../../../../../packages/insights/reader.mjs';
/** Insights que leen dinero: solo propietarios y analistas (igual que /refunds y el menú «Dinero»). */
const MONEY=new Set(['refunds','tracker']);
const NAMES=new Set(['conversations','refunds','threads','tracker']);
async function reader(request:NextRequest){
 if(!config())throw new AccessError(503,'configuration_required');
 const auth=requestAuth(request);
 const id=identity(auth.client);
 const session=await resolveSession(id,request.cookies.get(ACTIVE_ORG)?.value);
 return {auth,session,reader:createInsightsReader({database:createDatabase({identity:id,pool:serverPool(),selectedTenant:session.active.tenant_id})})};
}
function fail(error:unknown,finish:(r:NextResponse)=>NextResponse){
 const e=error as {status?:number;code?:string};const status=[400,401,403,404,503].includes(e.status??0)?e.status!:503;
 const code=status===503?'insights_unavailable':e.code==='insight_input_invalid'?e.code:status===404?'resource_not_found':'request_rejected';
 return finish(NextResponse.json({error:{code}},{status,headers:PRIVATE_HEADERS}));
}
/** GET /api/insights?name=conversations|refunds|threads|tracker[&grain=week|month][&date_start=&date_end=&currency=&top=]. SOLO lee insight_*; nunca agrega en vivo. */
export async function insights(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  const q=request.nextUrl.searchParams;
  for(const k of q.keys())if(!['name','grain','date_start','date_end','currency','top'].includes(k))throw new AccessError(400,'unsupported_filter');
  const name=q.get('name')??'';if(!NAMES.has(name))throw Object.assign(new AccessError(400,'insight_input_invalid'),{code:'insight_input_invalid'});
  const r=await reader(request);finish=r.auth.finish;
  if(MONEY.has(name)&&!['owner','analyst'].includes(r.session.active.role))throw new AccessError(403,'role_insufficient');
  const top=q.get('top')===null?10:Number(q.get('top'));
  const data=name==='conversations'?await r.reader.conversationVolume({grain:q.get('grain')??'month'})
   :name==='refunds'?await r.reader.refundBySkuMonth({from:q.get('date_start'),to:q.get('date_end'),currency:q.get('currency')??'USD',top})
   :name==='threads'?await r.reader.threadResolution({}):await r.reader.trackerRefundStatus({});
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){return fail(error,finish);}
}
/** GET /api/freshness: marca ligera (version + corte por fuente e insight). Sin parámetros, una sola lectura de dos tablas diminutas. */
export async function freshness(request:NextRequest){
 let finish=(r:NextResponse)=>r;
 try{
  if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
  const r=await reader(request);finish=r.auth.finish;
  const data=await r.reader.freshness({});
  return finish(NextResponse.json({data},{headers:{...PRIVATE_HEADERS,Vary:'Cookie'}}));
 }catch(error){return fail(error,finish);}
}
