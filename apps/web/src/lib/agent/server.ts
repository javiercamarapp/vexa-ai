import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {createDatabase} from '@vexa/platform/db';
import {ACTIVE_ORG,AccessError,PRIVATE_HEADERS,assertOrigin,config,identity,resolveSession} from '../auth';
import {requestAuth} from '../auth-http';
import {serverPool} from '../imports/server';
import {readRequestText} from '../request-body';
import {ROLES,LIMITS,buildSuggestions,createAgent,createSyntheticPort,createSyntheticStore,createTurnLimiter,createWorkspacePort,SYNTHETIC_TENANTS,SYNTHETIC_NOW,type DataPort,type Direct} from '../../../../../packages/agent-datos/index.mjs';

// Local visual QA / demo only (same guard as the workspace layout): synthetic organization, no Supabase, never in a production build.
export const AGENT_FIXTURES=process.env.NODE_ENV==='development'&&process.env.VEXA_UI_FIXTURES==='1';
const registry=globalThis as typeof globalThis&{__vexaAgent?:{store:Map<string,unknown>;limiter:ReturnType<typeof createTurnLimiter>}};
const shared=registry.__vexaAgent??={store:createSyntheticStore(),limiter:createTurnLimiter()};
// Deterministic mode (no LLM, cost 0) until the gateway gets a `data_agent` role. The limiter is per instance; the durable one belongs in the database.
export const agent=createAgent({limiter:shared.limiter});

export type AgentContext={ctx:{tenantId:string;userId:string;role:string;now:Date};port:DataPort;finish:(r:NextResponse)=>NextResponse};
export async function agentContext(request:NextRequest,mutating:boolean):Promise<AgentContext>{
 if(AGENT_FIXTURES){const role=process.env.VEXA_UI_FIXTURES_ROLE||'owner';return {ctx:{tenantId:SYNTHETIC_TENANTS.A,userId:'fixture-user',role,now:new Date(SYNTHETIC_NOW)},port:createSyntheticPort(shared.store,{tenantId:SYNTHETIC_TENANTS.A}),finish:r=>{for(const [k,v] of Object.entries(PRIVATE_HEADERS))r.headers.set(k,v);return r;}};}
 const configuration=config();if(!configuration)throw new AccessError(503,'configuration_required');
 if(mutating)assertOrigin(request.headers.get('origin'),configuration.origin);
 const auth=requestAuth(request);const session=await resolveSession(identity(auth.client),request.cookies.get(ACTIVE_ORG)?.value);
 const database=createDatabase({identity:identity(auth.client),pool:serverPool(),selectedTenant:session.active.tenant_id});
 return {ctx:{tenantId:session.active.tenant_id,userId:session.user.id,role:session.active.role,now:new Date()},port:createWorkspacePort({database,tenantId:session.active.tenant_id}),finish:auth.finish};
}
export const knownRole=(role:string)=>(ROLES as readonly string[]).includes(role);
export function failure(error:unknown,finish:(r:NextResponse)=>NextResponse=r=>r){
 const status=error instanceof AccessError?error.status:503;
 const code=error instanceof AccessError?error.code:'agent_unavailable';
 const message=status===401?'Inicia sesión para preguntarle a tus datos.':status===403?'Tu rol no tiene acceso a estas consultas.':status===400||status===413?'La solicitud no es válida.':'No se pudo preparar la consulta. Reintenta en un momento.';
 return finish(NextResponse.json({error:{code,message,retryable:status===503}},{status:[400,401,403,408,413,429].includes(status)?status:503,headers:PRIVATE_HEADERS}));
}
export async function jsonBody(request:NextRequest,allowed:readonly string[],maxBytes=16384):Promise<Record<string,unknown>>{
 if(request.nextUrl.search)throw new AccessError(400,'unsupported_filter');
 const raw=await readRequestText(request,maxBytes);if(Buffer.byteLength(raw)>maxBytes)throw new AccessError(413,'input_too_large');
 let value:unknown;try{value=JSON.parse(raw);}catch{throw new AccessError(400,'input_invalid');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new AccessError(400,'input_invalid');
 for(const key of Object.keys(value))if(!allowed.includes(key))throw new AccessError(400,'unsupported_field');
 return value as Record<string,unknown>;
}
export function parseDirect(value:unknown):Direct|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new AccessError(400,'input_invalid');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>k!=='tool'&&k!=='args')||typeof v.tool!=='string'||v.tool.length>60)throw new AccessError(400,'input_invalid');
 if(v.args!==undefined&&(!v.args||typeof v.args!=='object'||Array.isArray(v.args)))throw new AccessError(400,'input_invalid');
 return {tool:v.tool,args:v.args as Record<string,unknown>|undefined};
}
export {LIMITS,buildSuggestions};
