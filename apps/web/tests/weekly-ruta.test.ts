// /api/internal/weekly y /api/baja: configuración y autenticación a nivel de ruta (sin base, sin red, sin proveedor).
//   cd apps/web && npm run test:pain-points
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tenantsSemanales} from '../src/lib/weekly/server';

// Cada configuración carga la ruta real en un proceso nuevo: tsx no garantiza
// reevaluar módulos CommonJS con ?query. El hijo no hereda credenciales.
type Peticion={url:string;method?:string;headers?:Record<string,string>};
type Resultado={status:number;text:string;cache:string|null};
function ruta(path:string,requests:Peticion[],config:Record<string,string>={}):Resultado[]{
 const env:NodeJS.ProcessEnv={NODE_ENV:'test'};
 for(const key of ['PATH','HOME','TMPDIR','LANG'])if(process.env[key])env[key]=process.env[key]!;
 Object.assign(env,config);
 const code=`console.info=(...args)=>console.error(...args);
 const {readFileSync}=await import('node:fs');
 const {path,requests}=JSON.parse(readFileSync(0,'utf8'));
 const module=await import(path);const route=module.GET?module:module.default;
 const results=[];
 for(const request of requests){const response=await route[request.method||'GET'](new Request(request.url,request));results.push({status:response.status,text:await response.text(),cache:response.headers.get('cache-control')});}
 process.stdout.write(JSON.stringify(results));`;
 const output=execFileSync(process.execPath,['--require','./tests/server-only-stub.cjs','--import','tsx','--input-type=module','-e',code],{
  cwd:fileURLToPath(new URL('..',import.meta.url)),env,timeout:15000,encoding:'utf8',
  input:JSON.stringify({path:new URL(path,import.meta.url).href,requests}),
 });
 return JSON.parse(output);
}
const T1='11111111-1111-1111-1111-111111111111',T2='22222222-2222-2222-2222-222222222222';
test('VEXA_WEEKLY_TENANTS: lista explícita de UUID; vacía, con basura o de más de 20 falla cerrado (jamás «todas»)',()=>{
  assert.deepEqual(tenantsSemanales({VEXA_WEEKLY_TENANTS:` ${T1}, ${T2},${T1} `} as unknown as NodeJS.ProcessEnv),[T1,T2]);
  const alpha='abcdefab-abcd-abcd-abcd-abcdefabcdef';
  assert.deepEqual(tenantsSemanales({VEXA_WEEKLY_TENANTS:`${alpha.toUpperCase()},${alpha}`} as NodeJS.ProcessEnv),[alpha]);
  for(const mal of [undefined,'','  ','no-es-uuid',T1+';'+T2,Array.from({length:21},(_,i)=>`11111111-1111-1111-1111-${String(i).padStart(12,'0')}`).join(',')])
    assert.throws(()=>tenantsSemanales({VEXA_WEEKLY_TENANTS:mal} as unknown as NodeJS.ProcessEnv),/WEEKLY_CONFIGURATION_REQUIRED/);
});
test('ruta interna: sin secreto 503, sin bearer 401, con bearer pero sin organizaciones configuradas 503 (no recorre nada)',()=>{
 const path='../src/app/api/internal/weekly/route.ts',url='https://x/api/internal/weekly';
 assert.equal(ruta(path,[{url,method:'POST'}])[0].status,503);
 const [sinBearer,conBearer]=ruta(path,[{url,method:'POST'},{url,headers:{authorization:'Bearer '+'r'.repeat(40)}}],{VEXA_WORKER_TRIGGER_SECRET:'r'.repeat(40)});
 assert.equal(sinBearer.status,401);
 assert.equal(conBearer.status,503);assert.equal(JSON.parse(conBearer.text).code,'WEEKLY_CONFIGURATION_REQUIRED');
});
test('ruta pública de baja: sin secreto no hay baja posible (503 con mensaje claro); enlace manipulado 400; nunca toca la base',()=>{
 const path='../src/app/api/baja/route.ts';
 const [sin]=ruta(path,[{url:'https://x/api/baja?t=v1.a.b'}]);
 assert.equal(sin.status,503);assert.match(sin.text,/No disponible por ahora/);
 const [manipulado,post]=ruta(path,[{url:'https://x/api/baja?t=v1.abc.'+'A'.repeat(43)},{url:'https://x/api/baja',method:'POST'}],{VEXA_UNSUBSCRIBE_SECRET:'b'.repeat(40)});
 assert.equal(manipulado.status,400);assert.match(manipulado.text,/no es válido/);
 assert.equal(post.status,400);assert.match(manipulado.cache??'',/no-store/);
});
