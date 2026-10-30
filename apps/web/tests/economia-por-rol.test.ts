// R2-03 (auditoría run-2): la economía (importes de dinero) solo es para owner/analyst; viewer y operator reciben 403 role_insufficient en las rutas /api/economics, /api/economic-snapshots (y su exportación) y /api/economic-priorities, sin tocar la base.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/economia-por-rol.test.ts
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {ACTIVE_ORG} from '../src/lib/auth';
import {GET as economics,POST as economicsPost} from '../src/app/api/economics/route';
import {GET as snapshots} from '../src/app/api/economic-snapshots/route';
import {GET as snapshotById} from '../src/app/api/economic-snapshots/[id]/route';
import {GET as snapshotExport} from '../src/app/api/economic-snapshots/[id]/export/route';
import {GET as priorities} from '../src/app/api/economic-priorities/route';
const originalFetch=globalThis.fetch,saved={...process.env};
afterEach(()=>{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);});
const T='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',U='11111111-1111-4111-8111-111111111111',origin='http://localhost:3000',ID='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
function sesion(){const exp=Math.floor(Date.now()/1000)+3600;return {access_token:`${enc({alg:'HS256'})}.${enc({sub:U,exp})}.sig`,refresh_token:'refresh-sintetico',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id:U,aud:'authenticated',role:'authenticated',email:'sintetico@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};}
function preparar(role:string){
  process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:56321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='k';process.env.NEXT_PUBLIC_SITE_URL=origin;
  process.env.VEXA_DATABASE_URL='postgres://nadie:nada@127.0.0.1:1/ninguna';
  const vistos:string[]=[];
  globalThis.fetch=async(input)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);vistos.push(url.pathname);
    const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json'}});
    if(url.pathname==='/auth/v1/user')return json(sesion().user);
    if(url.pathname==='/rest/v1/memberships')return json([{tenant_id:T,user_id:U,role,status:'active',permissions_version:1}]);
    if(url.pathname==='/rest/v1/rpc/platform_support')return json({active:false});
    throw new Error('ruta simulada inesperada '+url.pathname);};
  return vistos;
}
const get=(path:string)=>{const r=new NextRequest(origin+path,{method:'GET',headers:{cookie:`sb-127-auth-token=base64-${enc(sesion())}; ${ACTIVE_ORG}=${T}`}});r.cookies.set(ACTIVE_ORG,T);return r;};
const rutas:Array<[string,()=>Promise<Response>]>=[
  ['GET /api/economics',()=>economics(get('/api/economics?view=overview&start=2026-01-01&end=2026-02-01&currency=USD&exponent=2&basis=marketplace_line_price'))],
  ['GET /api/economic-snapshots',()=>snapshots(get('/api/economic-snapshots?start=2026-01-01&end=2026-02-01&currency=USD&exponent=2&basis=marketplace_line_price'))],
  ['GET /api/economic-snapshots/[id]',()=>snapshotById(get('/api/economic-snapshots/'+ID),{params:Promise.resolve({id:ID})})],
  ['GET /api/economic-snapshots/[id]/export',()=>snapshotExport(get(`/api/economic-snapshots/${ID}/export?scopeHash=${'a'.repeat(64)}&format=csv`),{params:Promise.resolve({id:ID})})],
  ['GET /api/economic-priorities',()=>priorities(get('/api/economic-priorities?snapshotId='+ID))],
];
for(const role of ['viewer','operator'])for(const [nombre,llamar] of rutas)
  test(`R2-03: ${role} recibe 403 role_insufficient en ${nombre} sin llegar a la base`,async()=>{
    preparar(role);const r=await llamar();const cuerpo=JSON.stringify(await r.json());
    assert.equal(r.status,403,cuerpo);assert.match(cuerpo,/role_insufficient/);assert.doesNotMatch(r.headers.get('content-type')??'',/csv/);assert.equal(r.headers.get('content-disposition'),null);
  });
for(const role of ['owner','analyst'])for(const [nombre,llamar] of rutas)
  test(`R2-03: ${role} pasa la compuerta de rol en ${nombre} (el fallo posterior es de base, no de rol)`,async()=>{
    preparar(role);const r=await llamar();const cuerpo=JSON.stringify(await r.json());assert.doesNotMatch(cuerpo,/role_insufficient/,cuerpo);
  });
test('R2-03: viewer tampoco puede escribir economía (POST /api/economics)',async()=>{
  preparar('viewer');const r=await economicsPost(new NextRequest(origin+'/api/economics',{method:'POST',headers:{cookie:`sb-127-auth-token=base64-${enc(sesion())}; ${ACTIVE_ORG}=${T}`,origin,'content-type':'application/json'},body:JSON.stringify({operation:'source'})}));
  assert.equal(r.status,403);assert.match(JSON.stringify(await r.json()),/role_insufficient/);
});
