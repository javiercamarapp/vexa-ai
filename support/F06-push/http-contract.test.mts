// Exact application route and official Auth SDK with synthetic HTTP fixtures; not real Supabase sessions.
import {test,afterEach} from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const root=process.env.VEXA_CANDIDATE!;const require=createRequire(path.join(root,'package.json'));const {NextRequest}=require('next/server');
const {POST:logout}=await import(pathToFileURL(path.join(root,'apps/web/src/app/auth/logout/route.ts')).href);
const {config,ACTIVE_ORG}=await import(pathToFileURL(path.join(root,'apps/web/src/lib/auth.ts')).href);
const originalFetch=globalThis.fetch;
const savedEnv={...process.env};
afterEach(()=>{globalThis.fetch=originalFetch; for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SITE_URL','VEXA_GOOGLE_AUTH_ENABLED','VEXA_DATABASE_URL']) {if(savedEnv[key]===undefined)delete process.env[key];else process.env[key]=savedEnv[key];}});
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userId='11111111-1111-4111-8111-111111111111';
const origin='http://localhost:3000';
function setup(){process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:56321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='synthetic-public-key';process.env.NEXT_PUBLIC_SITE_URL=origin;}
const user={id:userId,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
function session(){const exp=Math.floor(Date.now()/1000)+3600;return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,exp,session_id:'33333333-3333-4333-8333-333333333333'})}.synthetic-signature`,refresh_token:'synthetic-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user};}
function cookies(){return `sb-127-auth-token=base64-${encode(session())}; ${ACTIVE_ORG}=${A}`;}
function request(path:string,body?:string,requestOrigin:string|null=origin){return new NextRequest(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:cookies(),...(requestOrigin?{origin:requestOrigin}:{}),...(body===undefined?{}:{'content-type':'application/x-www-form-urlencoded'})},...(body===undefined?{}:{body})});}
function mockServer(options:{revoked?:boolean; dbError?:boolean; invalid?:boolean; logoutError?:boolean; platform?:'granted'|'denied'|'unavailable'}={}) {
  const paths:string[]=[];
  globalThis.fetch=async(input)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);paths.push(url.pathname);
    const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
    if(url.pathname==='/auth/v1/user')return options.invalid?json({msg:'invalid token'},401):json(user);
    if(url.pathname==='/auth/v1/token' || url.pathname==='/auth/v1/verify')return json(session());
    if(url.pathname==='/auth/v1/logout')return options.logoutError?json({msg:'unavailable'},503):new Response(null,{status:204});
    if(url.pathname==='/rest/v1/rpc/platform_manage')return options.platform==='granted'?json({administrator:true}):options.platform==='unavailable'?json({code:'PGRST000',message:'unavailable'},503):json({code:'42501',message:'platform_access_denied'},403);
    if(url.pathname==='/rest/v1/memberships')return options.dbError?json({message:'unavailable'},503):json(options.revoked?[]:[A,B].map(tenant_id=>({tenant_id,user_id:userId,role:'owner',status:'active',permissions_version:1})));
    throw new Error(`unexpected mocked network path ${url.pathname}`);
  };return paths;
}
test('push logout of platform identity without membership must not report failure after Auth revokes',async()=>{setup();process.env.VEXA_DATABASE_URL='postgresql://syn:syn@127.0.0.1:1/syn';const paths=mockServer({revoked:true,platform:'granted'});const response=await logout(request('/auth/logout',''));assert.equal(paths.filter(p=>p==='/auth/v1/logout').length,1);assert.equal(response.status,303,'AUTH_SUCCEEDED_WITHOUT_WORKSPACE_LOGOUT_MUST_SUCCEED');});
test('logout service failure remains visible after removing membership dependency',async()=>{setup();const paths=mockServer({logoutError:true});const response=await logout(request('/auth/logout',''));assert.equal(paths.filter(p=>p==='/auth/v1/logout').length,1);assert.equal(response.status,503);assert.equal(response.cookies.get('sb-127-auth-token')?.value,'');});
test('push request body read is bounded by a server deadline',async()=>{
 setup();process.env.VEXA_DATABASE_URL='postgresql://syn:syn@127.0.0.1:1/syn';mockServer();
 const {pushResponse}=await import(pathToFileURL(path.join(root,'apps/web/src/lib/notifications/push-server.ts')).href);let streamController:ReadableStreamDefaultController<Uint8Array>|undefined;let cancelled=false;
 const body=new ReadableStream<Uint8Array>({start(c){streamController=c;},cancel(){cancelled=true;}});
 const request=new NextRequest(origin+'/api/notifications/push',{method:'POST',headers:{origin,cookie:cookies(),'content-type':'application/json'},body,duplex:'half'} as RequestInit);
 const pending=pushResponse(request);let timer:ReturnType<typeof setTimeout>|undefined;let result:Response|'deadline-missing';
 try{result=await Promise.race([pending,new Promise<'deadline-missing'>(r=>timer=setTimeout(()=>r('deadline-missing'),5500))]);}
 finally{clearTimeout(timer);if(!cancelled)streamController?.close();await pending;}
 assert.notEqual(result,'deadline-missing','PUSH_BODY_DEADLINE_MISSING');assert.equal((result as Response).status,408);assert.equal(cancelled,true);
});
