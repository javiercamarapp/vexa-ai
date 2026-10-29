/** Synthetic HTTP fixtures. Official SDK runs; Auth and PostgREST network responses are mocked.
 * This is NOT evidence of valid JWTs, real Supabase sessions, or SQL/RLS execution. */
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST as select} from '../src/app/(app)/auth/organization/route';
import {GET as callback} from '../src/app/(app)/auth/callback/route';
import {POST as logout} from '../src/app/(app)/auth/logout/route';
import {POST as google} from '../src/app/(app)/auth/google/route';
import {middleware} from '../src/middleware';
import {config, ACTIVE_ORG} from '../src/lib/auth';
const originalFetch=globalThis.fetch;
const savedEnv={...process.env};
afterEach(()=>{globalThis.fetch=originalFetch; for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SITE_URL','VEXA_GOOGLE_AUTH_ENABLED']) {if(savedEnv[key]===undefined)delete process.env[key];else process.env[key]=savedEnv[key];}});
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userId='11111111-1111-4111-8111-111111111111';
const origin='http://localhost:3000';
function setup(){process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:56321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='synthetic-public-key';process.env.NEXT_PUBLIC_SITE_URL=origin;}
const user={id:userId,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
function session(){const exp=Math.floor(Date.now()/1000)+3600;return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,exp,session_id:'synthetic-session'})}.synthetic-signature`,refresh_token:'synthetic-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user};}
function cookies(){return `sb-127-auth-token=base64-${encode(session())}; ${ACTIVE_ORG}=${A}`;}
function request(path:string,body?:string,requestOrigin:string|null=origin){return new NextRequest(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:cookies(),...(requestOrigin?{origin:requestOrigin}:{}),...(body===undefined?{}:{'content-type':'application/x-www-form-urlencoded'})},...(body===undefined?{}:{body})});}
function mockServer(options:{tenants?:string[]; support?:{tenantId:string;expiresAt:string}; revoked?:boolean; dbError?:boolean; invalid?:boolean; logoutError?:boolean; platform?:'granted'|'denied'|'unavailable'}={}) {
  const paths:string[]=[];
  globalThis.fetch=async(input)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);paths.push(url.pathname);
    const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
    if(url.pathname==='/auth/v1/user')return options.invalid?json({msg:'invalid token'},401):json(user);
    if(url.pathname==='/auth/v1/token' || url.pathname==='/auth/v1/verify')return json(session());
    if(url.pathname==='/auth/v1/logout')return options.logoutError?json({msg:'unavailable'},503):new Response(null,{status:204});
    if(url.pathname==='/rest/v1/rpc/platform_manage')return options.platform==='granted'?json({administrator:true}):options.platform==='unavailable'?json({code:'PGRST000',message:'unavailable'},503):json({code:'42501',message:'platform_access_denied'},403);
    if(url.pathname==='/rest/v1/rpc/platform_support')return options.support?json({active:true,session:{id:'ssssssss-ssss-4sss-8sss-ssssssssssss',tenantId:options.support.tenantId,tenantName:'Cliente',reason:'revisar carga de HubSpot',expiresAt:options.support.expiresAt}}):json({code:'42501',message:'platform_access_denied'},403);
    if(url.pathname==='/rest/v1/memberships')return options.dbError?json({message:'unavailable'},503):json(options.revoked?[]:(options.tenants??[A,B]).map(tenant_id=>({tenant_id,user_id:userId,role:'owner',status:'active',permissions_version:1})));
    throw new Error(`unexpected mocked network path ${url.pathname}`);
  };return paths;
}
test('same-origin foreign selection returns authorization 403, preserves active cookie, positive fresh selection persists',async()=>{
  setup();mockServer();const denied=await select(request('/auth/organization','tenant_id=cccccccc-cccc-4ccc-8ccc-cccccccccccc'));
  assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,'organization_not_authorized');assert.equal(denied.cookies.get(ACTIVE_ORG),undefined);
  const allowed=await select(request('/auth/organization',`tenant_id=${B}`));assert.equal(allowed.status,303);assert.equal(allowed.cookies.get(ACTIVE_ORG)?.value,B);
  const follow=request('/');follow.cookies.set(ACTIVE_ORG,allowed.cookies.get(ACTIVE_ORG)!.value);assert.equal((await middleware(follow)).status,200);
});
test('CSRF fails before Auth network and does not alter org cookie',async()=>{setup();const paths=mockServer();const result=await select(request('/auth/organization',`tenant_id=${B}`,'https://evil.test'));assert.equal(result.status,403);assert.equal((await result.json()).error.code,'csrf_rejected');assert.equal(result.cookies.get(ACTIVE_ORG),undefined);assert.equal(paths.length,0);});
test('Auth rejection denies even structurally valid synthetic token',async()=>{setup();const paths=mockServer({invalid:true});const result=await middleware(request('/'));assert.equal(result.status,303);assert.equal(result.headers.get('location'),origin+'/login');assert.deepEqual(paths,['/auth/v1/user']);});
test('active membership rechecked on every request; revoked membership denied',async()=>{setup();mockServer();assert.equal((await middleware(request('/'))).status,200);const paths=mockServer({revoked:true});const result=await middleware(request('/'));assert.equal(result.status,303);assert.equal(result.headers.get('location'),origin+'/sin-acceso');assert.ok(paths.includes('/rest/v1/memberships'));assert.match(result.headers.get('cache-control')!,/no-store/);});
test('DB error is 503, not missing membership or empty UI',async()=>{setup();mockServer({dbError:true});assert.equal((await middleware(request('/'))).status,503);});
for(const next of ['https://evil.test','//evil.test','/\\evil.test','/a/..//evil.test','/?tab=one'])test(`successful mocked PKCE callback normalizes ${next}`,async()=>{
  setup();const paths=mockServer();const req=request('/auth/callback?code=synthetic-code&next='+encodeURIComponent(next));req.cookies.set('sb-127-auth-token-code-verifier','base64-'+encode('synthetic-verifier'));req.headers.set('host','evil.test');const response=await callback(req);
  assert.equal(response.status,303);assert.equal(response.headers.get('location'),origin+(next==='/?tab=one'?next:'/'));assert.ok(paths.includes('/auth/v1/user'));assert.match(response.headers.get('cache-control')!,/no-store/);
});
test('local OTP callback verifies token hash with Auth',async()=>{setup();const paths=mockServer();const response=await callback(request('/auth/callback?token_hash=synthetic-hash&type=email'));assert.equal(response.status,303);assert.ok(paths.includes('/auth/v1/verify'));});
test('remote token-hash callback is disabled',async()=>{setup();process.env.NEXT_PUBLIC_SUPABASE_URL='https://synthetic.supabase.co';const paths=mockServer();assert.equal((await callback(request('/auth/callback?token_hash=synthetic-hash&type=email'))).status,401);assert.equal(paths.length,0);});
test('logout revokes through official SDK and expires cookies',async()=>{setup();const paths=mockServer();const response=await logout(request('/auth/logout',''));assert.equal(response.status,303);assert.ok(paths.includes('/auth/v1/logout'));assert.equal(response.cookies.get(ACTIVE_ORG)?.value,'');assert.equal(response.cookies.get('sb-127-auth-token')?.value,'');assert.match(response.headers.get('cache-control')!,/no-store/);assert.ok(response.headers.get('clear-site-data'));const fresh=new NextRequest(origin+'/');assert.equal((await middleware(fresh)).status,303);});
test('logout service failure is visible, local cookies still removed',async()=>{setup();mockServer({logoutError:true});const response=await logout(request('/auth/logout',''));assert.equal(response.status,503);assert.equal(response.cookies.get('sb-127-auth-token')?.value,'');});
test('Google unavailable by default, no network call',async()=>{setup();delete process.env.VEXA_GOOGLE_AUTH_ENABLED;const paths=mockServer();assert.equal((await google(request('/auth/google',''))).status,503);assert.equal(paths.length,0);});
test('missing config supports build; partial and untrusted site configuration fails closed',()=>{for(const k of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SITE_URL'])delete process.env[k];assert.equal(config(),null);process.env.NEXT_PUBLIC_SITE_URL=origin;assert.throws(config);setup();process.env.NEXT_PUBLIC_SITE_URL='https://name:pass@example.test';assert.throws(config);});
test('callback without code is denied without trusting next or cookies',async()=>{setup();const paths=mockServer();const response=await callback(request('/auth/callback?next=/'));assert.equal(response.status,401);assert.equal(paths.length,0);});
test('corrupt session cookie does not confer identity',async()=>{setup();const paths=mockServer();const req=request('/');req.cookies.set('sb-127-auth-token','corrupt-cookie');assert.equal((await middleware(req)).status,303);assert.equal(paths.includes('/rest/v1/memberships'),false);});

for (const path of ['/login', '/']) test(`form page ${path} permits same-origin referrers without leaking to external origins`, async()=>{
  setup();mockServer();
  const response=await middleware(request(path));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('referrer-policy'),'same-origin');
  assert.match(response.headers.get('cache-control')!,/no-store/);
});
for (const [path,handler] of [['/auth/google',google],['/auth/organization',select],['/auth/logout',logout]] as const)
  for (const unsafeOrigin of ['null','https://evil.test',null]) test(`${path} rejects Origin ${unsafeOrigin===null?'absent':unsafeOrigin} before network`,async()=>{
    setup();process.env.VEXA_GOOGLE_AUTH_ENABLED='true';const paths=mockServer();
    const response=await handler(request(path,`tenant_id=${B}`,unsafeOrigin));
    assert.equal(response.status,403);
    assert.equal((await response.json()).error.code,'csrf_rejected');
    assert.equal(response.cookies.get(ACTIVE_ORG),undefined);
    assert.deepEqual(paths,[]);
  });

test('platform grant sends completed OAuth login to platform even without membership',async()=>{
 setup();const paths=mockServer({platform:'granted',revoked:true});const req=request('/auth/callback?code=synthetic-code');req.cookies.set('sb-127-auth-token-code-verifier','base64-'+encode('synthetic-verifier'));const response=await callback(req);
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),origin+'/platform');assert.ok(paths.includes('/rest/v1/rpc/platform_manage'));
});
test('platform grant revocation is checked again by callback',async()=>{
 setup();mockServer({platform:'denied'});const req=request('/auth/callback?code=synthetic-code');req.cookies.set('sb-127-auth-token-code-verifier','base64-'+encode('synthetic-verifier'));const response=await callback(req);
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),origin+'/');
});
test('platform authorization outage fails callback visibly instead of selecting unauthorized destination',async()=>{
 setup();mockServer({platform:'unavailable'});const req=request('/auth/callback?code=synthetic-code');req.cookies.set('sb-127-auth-token-code-verifier','base64-'+encode('synthetic-verifier'));const response=await callback(req);
 assert.equal(response.status,503);assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('cache-control')!,/no-store/);
});
test('platform middleware refreshes identity without requiring membership; page and RPC own grant checks',async()=>{
 setup();const paths=mockServer({revoked:true});const response=await middleware(request('/platform'));
 assert.equal(response.status,200);assert.deepEqual(paths,['/auth/v1/user']);assert.match(response.headers.get('cache-control')!,/no-store/);
 mockServer({invalid:true});assert.equal((await middleware(request('/platform'))).status,303);
});

test('OAuth cancellation returns to local login without network, tokens or provider details',async()=>{setup();const paths=mockServer();const response=await callback(request('/auth/callback?error=access_denied&error_description=private-provider-message&next=https://evil.test'));assert.equal(response.status,303);assert.equal(response.headers.get('location'),origin+'/login?error=oauth_cancelled');assert.match(response.headers.get('cache-control')!,/no-store/);assert.deepEqual(paths,[]);assert.equal(response.cookies.get(ACTIVE_ORG),undefined);});

for(const path of ['/', '/overview', '/platform'])test(`first visit without session opens normal login: ${path}`,async()=>{setup();const paths=mockServer();const result=await middleware(new NextRequest(origin+path));assert.equal(result.status,303);assert.equal(result.headers.get('location'),origin+'/login');assert.match(result.headers.get('cache-control')!,/no-store/);assert.deepEqual(paths,[]);});

// ---------------------------------------------------------------- SUPERADMIN (24-oct): cookie revocada, soporte «ver como» solo lectura
const C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const mark=(minutes:number)=>String(Math.floor(Date.now()/1000)+minutes*60);
function withMark(req:NextRequest,minutes=30){req.cookies.set('vexa_support',mark(minutes));return req;}
test('cookie de organización revocada: navegación cae a una membresía válida, la repara en la respuesta y no hay 403',async()=>{
  setup();mockServer({tenants:[B]});const response=await middleware(request('/'));
  assert.equal(response.status,200);assert.equal(response.cookies.get(ACTIVE_ORG)?.value,B);
});
test('cookie válida no se reescribe',async()=>{setup();mockServer();const response=await middleware(request('/'));assert.equal(response.status,200);assert.equal(response.cookies.get(ACTIVE_ORG),undefined);});
test('sin ninguna membresía válida: /sin-acceso (ya no el genérico acceso denegado)',async()=>{
  setup();mockServer({tenants:[]});const response=await middleware(request('/overview'));assert.equal(response.status,303);assert.equal(response.headers.get('location'),origin+'/sin-acceso');
});
test('soporte vigente: el administrador sin membresía entra a la organización del cliente (como lector) por la navegación',async()=>{
  setup();const exp=new Date(Date.now()+20*60000).toISOString();mockServer({tenants:[],support:{tenantId:C,expiresAt:exp}});
  const req=request('/overview');req.cookies.set(ACTIVE_ORG,C);const response=await middleware(req);assert.equal(response.status,200);
});
test('soporte: la cookie apuntando a otra organización NO concede nada',async()=>{
  setup();const exp=new Date(Date.now()+20*60000).toISOString();mockServer({tenants:[],support:{tenantId:C,expiresAt:exp}});
  const req=request('/overview');req.cookies.set(ACTIVE_ORG,B);assert.equal((await middleware(req)).status,303);
});
test('soporte vencido en la base: 303 a /sin-acceso aunque la cookie siga',async()=>{
  setup();mockServer({tenants:[],support:{tenantId:C,expiresAt:new Date(Date.now()-5000).toISOString()}});
  const req=request('/overview');req.cookies.set(ACTIVE_ORG,C);assert.equal((await middleware(req)).status,303);
});
for(const [method,path] of [['POST','/api/agent/turn'],['PUT','/api/connections/settings'],['DELETE','/api/notifications/push'],['PATCH','/api/briefs/x'],['POST','/api/workspace/mappings'],['GET','/api/workspace/export'],['GET','/api/briefs/abc/export'],['GET','/api/pain-points/P2/evidence?format=csv'],['GET','/api/jobs/abc/errors'],['GET','/cfo/data/export?format=pdf']] as const)
  test(`marca de soporte: ${method} ${path} se rechaza con 403 antes de llegar a la ruta`,async()=>{
    setup();const paths=mockServer();const req=withMark(new NextRequest(origin+path,{method,headers:{cookie:cookies()}}));
    const response=await middleware(req);assert.equal(response.status,403);assert.match((await response.json()).error.code,/^support_(read_only|export_blocked)$/);assert.equal(paths.length,0,'sin red');
  });
test('marca de soporte: lecturas, cambio de organización, salida y consola siguen permitidos',async()=>{
  setup();mockServer();
  for(const [method,path] of [['GET','/api/problems'],['POST','/auth/organization'],['POST','/auth/logout'],['POST','/api/platform'],['POST','/platform/data/support']] as const){
    const response=await middleware(withMark(new NextRequest(origin+path,{method,headers:{cookie:cookies()}})));assert.notEqual(response.status,403,method+' '+path);
  }
});
test('sin marca (o vencida) las rutas /api quedan exactamente como antes',async()=>{
  setup();mockServer();
  const plain=await middleware(new NextRequest(origin+'/api/agent/turn',{method:'POST',headers:{cookie:cookies()}}));assert.equal(plain.status,200);
  const stale=new NextRequest(origin+'/api/agent/turn',{method:'POST',headers:{cookie:cookies()}});stale.cookies.set('vexa_support',String(Math.floor(Date.now()/1000)-60));assert.equal((await middleware(stale)).status,200);
});
// ---------------------------------------------------------------- AUTH-01 / R-01 (auditoría 28-oct): exportar no depende de la cookie vexa_support
import {GET as exportWorkspace} from '../src/app/api/workspace/export/route';
import {GET as exportBrief} from '../src/app/api/briefs/[id]/export/route';
import {GET as exportSnapshot} from '../src/app/api/economic-snapshots/[id]/export/route';
import {GET as jobErrors} from '../src/app/api/jobs/[id]/errors/route';
test('soporte SIN cookie vexa_support: cada exportación responde 403 y no entrega bytes (la base no es alcanzable)',async()=>{
  setup();process.env.VEXA_DATABASE_URL='postgres://nadie:nada@127.0.0.1:1/ninguna';
  mockServer({tenants:[],support:{tenantId:C,expiresAt:new Date(Date.now()+20*60000).toISOString()}});
  const id='dddddddd-dddd-4ddd-8ddd-dddddddddddd',get=(path:string)=>{const req=new NextRequest(origin+path,{method:'GET',headers:{cookie:cookies()}});req.cookies.set(ACTIVE_ORG,C);assert.equal(req.cookies.get('vexa_support'),undefined);return req;};
  try{
    const results=await Promise.all([
      exportWorkspace(get(`/api/workspace/export?snapshot_id=${id}&scope_hash=${'a'.repeat(64)}&format=csv`)),
      exportBrief(get(`/api/briefs/${id}/export?format=json`),{params:Promise.resolve({id})}),
      exportSnapshot(get(`/api/economic-snapshots/${id}/export?scopeHash=${'a'.repeat(64)}&format=csv`),{params:Promise.resolve({id})}),
      jobErrors(get(`/api/jobs/${id}/errors`)),
    ]);
    for(const [i,r] of results.entries()){assert.equal(r.status,403,`ruta ${i}`);assert.doesNotMatch(r.headers.get('content-type')??'',/csv/);assert.equal(r.headers.get('content-disposition'),null);}
  }finally{delete process.env.VEXA_DATABASE_URL;}
});

// Segunda capa de AUTH-01 (cierre de seguridad): CSV de evidencia de pain-points y exportación CFO tampoco dependen de la cookie.
import {painEvidenceHandler} from '../src/lib/pain-points/server';
import {GET as exportCfo} from '../src/app/(app)/(workspace)/cfo/data/export/route';
test('soporte SIN cookie vexa_support: CSV de pain-points y exportación CFO responden 403 sin bytes',async()=>{
  setup();process.env.VEXA_DATABASE_URL='postgres://nadie:nada@127.0.0.1:1/ninguna';
  mockServer({tenants:[],support:{tenantId:C,expiresAt:new Date(Date.now()+20*60000).toISOString()}});
  const get=(path:string)=>{const req=new NextRequest(origin+path,{method:'GET',headers:{cookie:cookies()}});req.cookies.set(ACTIVE_ORG,C);assert.equal(req.cookies.get('vexa_support'),undefined);return req;};
  try{
    const pain=await painEvidenceHandler(get('/api/pain-points/P2/evidence?format=csv'),{id:'P2'});
    const cfo=await exportCfo(get('/cfo/data/export?format=csv'));
    for(const r of [pain,cfo]){assert.equal(r.status,403);assert.doesNotMatch(r.headers.get('content-type')??'',/csv|pdf/);assert.equal(r.headers.get('content-disposition'),null);}
    assert.equal((await cfo.json()).error.code,'support_export_blocked');
  }finally{delete process.env.VEXA_DATABASE_URL;}
});

// R-05 (cierre de seguridad 28-oct): /api/briefs no sirve de la memoria sin revalidar la membresía vigente.
import {briefResponse} from '../src/lib/briefs/server';
import {conMemoria,olvidarMemoria} from '../src/lib/lectura-memo.mjs';
test('briefs: con la lista en memoria, una membresía revocada recibe 403 y no la caché; una vigente sigue sirviéndose de ella',async()=>{
  setup();olvidarMemoria();process.env.VEXA_DATABASE_URL='postgres://nadie:nada@127.0.0.1:1/ninguna';
  const key='briefs|'+userId+'|'+A+'|owner|';
  await conMemoria(key,60_000,async()=>({items:[{id:'secreto-en-cache'}]}));
  try{
    mockServer({tenants:[A]});
    const vigente=await briefResponse(new NextRequest(origin+'/api/briefs',{method:'GET',headers:{cookie:cookies()}}));
    assert.equal(vigente.status,200);assert.match(JSON.stringify(await vigente.json()),/secreto-en-cache/);
    mockServer({tenants:[]});
    const revocada=await briefResponse(new NextRequest(origin+'/api/briefs',{method:'GET',headers:{cookie:cookies()}}));
    assert.equal(revocada.status,403);assert.doesNotMatch(await revocada.text(),/secreto-en-cache/);
  }finally{delete process.env.VEXA_DATABASE_URL;olvidarMemoria();}
});

// AUTH-05 (cierre de seguridad 28-oct): el cierre de sesión borra vexa_support y termina la sesión de soporte en la base antes de revocar tokens.
test('logout: borra la cookie vexa_support aunque no llegara en la petición y cierra la sesión de soporte en la base antes de revocar',async()=>{
  setup();const paths=mockServer({support:{tenantId:C,expiresAt:new Date(Date.now()+20*60000).toISOString()}});
  const response=await logout(request('/auth/logout',''));
  assert.equal(response.status,303);assert.equal(response.cookies.get('vexa_support')?.value,'');
  const fin=paths.indexOf('/rest/v1/rpc/platform_support'),rev=paths.indexOf('/auth/v1/logout');
  assert.ok(fin>=0,'llamó platform_support end');assert.ok(rev>fin,'cerró soporte antes de revocar el token');
});
test('logout: si cerrar soporte falla (no administrador), el cierre de sesión sigue y borra todo',async()=>{
  setup();mockServer();const response=await logout(request('/auth/logout',''));
  assert.equal(response.status,303);assert.equal(response.cookies.get('vexa_support')?.value,'');assert.equal(response.cookies.get('sb-127-auth-token')?.value,'');
});
