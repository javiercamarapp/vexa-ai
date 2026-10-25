// /api/internal/weekly y /api/baja: configuración y autenticación a nivel de ruta (sin base, sin red, sin proveedor).
//   cd apps/web && npm run test:pain-points
import test from 'node:test';
import assert from 'node:assert/strict';
import {tenantsSemanales} from '../src/lib/weekly/server';

const T1='11111111-1111-1111-1111-111111111111',T2='22222222-2222-2222-2222-222222222222';
test('VEXA_WEEKLY_TENANTS: lista explícita de UUID; vacía, con basura o de más de 20 falla cerrado (jamás «todas»)',()=>{
  assert.deepEqual(tenantsSemanales({VEXA_WEEKLY_TENANTS:` ${T1}, ${T2},${T1} `} as NodeJS.ProcessEnv),[T1,T2]);
  for(const mal of [undefined,'','  ','no-es-uuid',T1+';'+T2,Array.from({length:21},(_,i)=>`11111111-1111-1111-1111-${String(i).padStart(12,'0')}`).join(',')])
    assert.throws(()=>tenantsSemanales({VEXA_WEEKLY_TENANTS:mal} as NodeJS.ProcessEnv),/WEEKLY_CONFIGURATION_REQUIRED/);
});
test('ruta interna: sin secreto 503, sin bearer 401, con bearer pero sin organizaciones configuradas 503 (no recorre nada)',async()=>{
  const antes={...process.env};
  try{
    delete process.env.VEXA_WORKER_TRIGGER_SECRET;delete process.env.VEXA_WEEKLY_TENANTS;
    const sin=await import('../src/app/api/internal/weekly/route?sin');
    assert.equal((await sin.POST(new Request('https://x/api/internal/weekly',{method:'POST'}))).status,503);
    process.env.VEXA_WORKER_TRIGGER_SECRET='r'.repeat(40);
    const con=await import('../src/app/api/internal/weekly/route?con');
    assert.equal((await con.POST(new Request('https://x/api/internal/weekly',{method:'POST'}))).status,401);
    const r=await con.GET(new Request('https://x/api/internal/weekly',{headers:{authorization:'Bearer '+'r'.repeat(40)}}));
    assert.equal(r.status,503);assert.equal((await r.json()).code,'WEEKLY_CONFIGURATION_REQUIRED');
  }finally{for(const k of Object.keys(process.env))if(!(k in antes))delete process.env[k];Object.assign(process.env,antes);}
});
test('ruta pública de baja: sin secreto no hay baja posible (503 con mensaje claro); enlace manipulado 400; nunca toca la base',async()=>{
  const antes={...process.env};
  try{
    delete process.env.VEXA_UNSUBSCRIBE_SECRET;
    const sin=await import('../src/app/api/baja/route?sin');
    const a=await sin.GET(new Request('https://x/api/baja?t=v1.a.b') as never);assert.equal(a.status,503);assert.match(await a.text(),/No disponible por ahora/);
    process.env.VEXA_UNSUBSCRIBE_SECRET='b'.repeat(40);
    const con=await import('../src/app/api/baja/route?con');
    const b=await con.GET(new Request('https://x/api/baja?t=v1.abc.'+'A'.repeat(43)) as never);assert.equal(b.status,400);assert.match(await b.text(),/no es válido/);
    assert.equal((await con.POST(new Request('https://x/api/baja') as never)).status,400);
    assert.match(b.headers.get('cache-control')??'',/no-store/);
  }finally{for(const k of Object.keys(process.env))if(!(k in antes))delete process.env[k];Object.assign(process.env,antes);}
});
