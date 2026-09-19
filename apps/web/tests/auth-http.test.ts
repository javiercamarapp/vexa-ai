/** Synthetic HTTP fixtures. Official SDK runs; Auth and PostgREST network responses are mocked.
 * This is NOT evidence of valid JWTs, real Supabase sessions, or SQL/RLS execution. */
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST as select} from '../src/app/auth/organization/route';
import {GET as callback} from '../src/app/auth/callback/route';
import {POST as logout} from '../src/app/auth/logout/route';
import {POST as google} from '../src/app/auth/google/route';
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
function mockServer(options:{revoked?:boolean; dbError?:boolean; invalid?:boolean; logoutError?:boolean}={}) {
  const paths:string[]=[];
  globalThis.fetch=async(input)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);paths.push(url.pathname);
    const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
    if(url.pathname==='/auth/v1/user')return options.invalid?json({msg:'invalid token'},401):json(user);
    if(url.pathname==='/auth/v1/token' || url.pathname==='/auth/v1/verify')return json(session());
    if(url.pathname==='/auth/v1/logout')return options.logoutError?json({msg:'unavailable'},503):new Response(null,{status:204});
    if(url.pathname==='/rest/v1/memberships')return options.dbError?json({message:'unavailable'},503):json(options.revoked?[]:[A,B].map(tenant_id=>({tenant_id,user_id:userId,role:'owner',status:'active',permissions_version:1})));
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
test('Auth rejection denies even structurally valid synthetic token',async()=>{setup();const paths=mockServer({invalid:true});const result=await middleware(request('/'));assert.equal(result.status,303);assert.match(result.headers.get('location')!,/login\?error=access_denied/);assert.deepEqual(paths,['/auth/v1/user']);});
test('active membership rechecked on every request; revoked membership denied',async()=>{setup();mockServer();assert.equal((await middleware(request('/'))).status,200);const paths=mockServer({revoked:true});const result=await middleware(request('/'));assert.equal(result.status,303);assert.ok(paths.includes('/rest/v1/memberships'));assert.match(result.headers.get('cache-control')!,/no-store/);});
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
