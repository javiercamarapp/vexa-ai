// Registro de eventos de seguridad (auditoría 3, R-1): sin PII, nunca rompe la petición, muestreo local, tope de escrituras en vuelo y puntos de captura.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/eventos-seguridad.test.ts
import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {claseDeRuta,construirCarga,huellaDeIp,registrarEventoSeguridad,instalarEscritor,_reiniciarLocal} from '../src/lib/security/eventos';
import {POST as logout} from '../src/app/(app)/auth/logout/route';
import {middleware} from '../src/middleware';
import {POST as internalProblems} from '../src/app/api/internal/problems/route';
import '../src/lib/imports/server'; // instala el ayudante global que usan los paquetes
beforeEach(()=>_reiniciarLocal());
const tick=(ms=15)=>new Promise(r=>setTimeout(r,ms));
const origin='http://localhost:3000';

test('la carga no lleva IP ni correo en claro: IP solo como HMAC hex de 64, agente truncado, ruta sin consulta ni identificadores',()=>{
  const clave='k'.repeat(32);
  const c=construirCarga({kind:'forbidden_403',route:'/api/briefs/6f0c1e5a-1b2c-4d3e-8f90-a1b2c3d4e5f6/export?email=a@b.co&token=eyJxxx',method:'GET',ipRaw:'203.0.113.9, 10.0.0.1',ua:'U'.repeat(500),detail:{code:'role_insufficient',nota:'x'.repeat(200),n:3}},clave);
  const texto=JSON.stringify(c);
  assert.ok(!/203\.0\.113|10\.0\.0\.1|a@b\.co|eyJ/.test(texto),texto);
  assert.match(String(c.ip_hash),/^[a-f0-9]{64}$/);assert.equal((c.ua as string).length,120);assert.equal(c.route,'/api/briefs/:id/export');
  assert.deepEqual(c.detail,{code:'role_insufficient',n:3},'texto largo descartado');
  assert.equal(huellaDeIp('no-ip',clave),null);assert.equal(huellaDeIp('203.0.113.9',null),null);
  assert.notEqual(huellaDeIp('203.0.113.9',clave),huellaDeIp('203.0.113.10',clave));
  assert.equal(claseDeRuta('/api/jobs/123456/errors'),'/api/jobs/:id/errors');
});
test('nunca rompe la petición: escritor que lanza, rechaza, cuelga o entrada rara no producen excepción ni retrasan',async()=>{
  const antes=Date.now();
  assert.doesNotThrow(()=>registrarEventoSeguridad({kind:'auth_401'},async()=>{throw new Error('base caída');},t=>{void t();}));
  assert.doesNotThrow(()=>registrarEventoSeguridad({kind:'auth_401',route:'/api/b'},()=>{throw new Error('síncrono');},t=>{void t();}));
  assert.doesNotThrow(()=>registrarEventoSeguridad({kind:'auth_401',route:'/api/c'},()=>new Promise(()=>{}),t=>{void t();}));
  assert.doesNotThrow(()=>registrarEventoSeguridad(null as never,async()=>{}));
  assert.doesNotThrow(()=>registrarEventoSeguridad({kind:'x'} as never,null));
  assert.doesNotThrow(()=>registrarEventoSeguridad({kind:'auth_401'},async()=>{},()=>{throw new Error('diferir roto');}));
  assert.ok(Date.now()-antes<100,'la llamada es sincrónica y rápida');
  await tick(30);
});
test('deduplicación local: una ráfaga de la misma IP y ruta escribe pocas filas; export y soporte nunca se omiten',async()=>{
  const llamadas:unknown[]=[];const w=async(c:unknown)=>{llamadas.push(c);};
  for(let i=0;i<200;i++){registrarEventoSeguridad({kind:'auth_401',route:'/api/problems',ipRaw:'203.0.113.9'},w,t=>{void t();});await tick(0);}
  assert.ok(llamadas.length<=16,String(llamadas.length));
  const a=llamadas.length;for(let i=0;i<20;i++){registrarEventoSeguridad({kind:'export',actorId:'11111111-1111-4111-8111-111111111111'},w,t=>{void t();});await tick(0);}
  assert.equal(llamadas.length-a,20);
});
test('tope de escrituras en vuelo: con la base lenta no se acumulan (se descartan)',async()=>{
  let liberar:()=>void=()=>{};const lento=()=>new Promise<void>(r=>{liberar=r;});let n=0;const w=async()=>{n++;await lento();};
  for(let i=0;i<10;i++)registrarEventoSeguridad({kind:'rate_limited',route:'/api/r'+i},w,t=>{void t();});
  await tick(5);assert.ok(n<=2,String(n));liberar();await tick(5);
});
test('puntos de captura: CSRF inválido, Bearer inválido y bloqueo de soporte dejan un evento sin PII',async()=>{
  const eventos:Record<string,unknown>[]=[];instalarEscritor(async c=>{eventos.push(c);});
  const savedEnv={...process.env};
  try{
    process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:56321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='synthetic-public-key';process.env.NEXT_PUBLIC_SITE_URL=origin;process.env.VEXA_WORKER_TRIGGER_SECRET='s'.repeat(40);
    const csrf=new NextRequest(origin+'/auth/logout',{method:'POST',headers:{origin:'https://evil.example',cookie:'x=1','x-forwarded-for':'203.0.113.77','user-agent':'curl/8'}});
    assert.equal((await logout(csrf)).status,403);await tick(30);
    const bad=new NextRequest(origin+'/api/internal/problems',{method:'POST',headers:{authorization:'Bearer nope-secreto-equivocado','x-forwarded-for':'203.0.113.78'}});
    assert.equal((await internalProblems(bad)).status,401);await tick(30);
    const marca=String(Math.floor(Date.now()/1000)+1800);
    const soporte=new NextRequest(origin+'/api/workspace/export?format=csv',{headers:{cookie:'vexa_support='+marca+'; sb-x=1','x-forwarded-for':'203.0.113.79'}});
    assert.equal((await middleware(soporte)).status,403);
    await tick(40);
    const tipos=eventos.map(e=>e.kind);
    assert.ok(tipos.includes('csrf_rejected'),tipos.join());assert.ok(tipos.includes('bearer_invalid'),tipos.join());assert.ok(tipos.includes('support_blocked'),tipos.join());
    const todo=JSON.stringify(eventos);
    assert.ok(!/203\.0\.113|evil\.example|nope-secreto|ssssssss/.test(todo),'sin IP, origen ni secreto en claro: '+todo);
  }finally{instalarEscritor(null);for(const k of Object.keys(process.env))if(!(k in savedEnv))delete process.env[k];Object.assign(process.env,savedEnv);}
});

import {filtrosSeguros,TIPOS} from '../src/components/platform/eventos-seguridad';
import {GET as cronAlertas} from '../src/app/api/internal/security-alerts/route';
test('pantalla: los filtros solo admiten tipos, severidades y fechas conocidos (nada llega crudo a la base)',()=>{
  const f=filtrosSeguros({kind:"auth_401'; drop table x;--",severity:'high',since:'no-fecha'});
  assert.equal(f.kind,undefined);assert.equal(f.severity,'high');assert.equal(f.since,undefined);
  assert.equal(filtrosSeguros({kind:'export',since:'2026-10-01'}).kind,'export');assert.equal(filtrosSeguros({kind:['a','b']}).kind,undefined);
  assert.ok(TIPOS.includes('alert_raised'));
});
test('cron de alertas: sin secreto 503, con Bearer equivocado 401 y deja evento bearer_invalid',async()=>{
  const eventos:Record<string,unknown>[]=[];instalarEscritor(async c=>{eventos.push(c);});const saved=process.env.VEXA_WORKER_TRIGGER_SECRET;
  try{
    delete process.env.VEXA_WORKER_TRIGGER_SECRET;assert.equal((await cronAlertas(new Request('http://x/api/internal/security-alerts'))).status,503);
    process.env.VEXA_WORKER_TRIGGER_SECRET='s'.repeat(40);
    assert.equal((await cronAlertas(new Request('http://x/api/internal/security-alerts',{headers:{authorization:'Bearer mal'}}))).status,401);await tick(40);
    assert.ok(eventos.some(e=>e.kind==='bearer_invalid'));
  }finally{instalarEscritor(null);if(saved===undefined)delete process.env.VEXA_WORKER_TRIGGER_SECRET;else process.env.VEXA_WORKER_TRIGGER_SECRET=saved;}
});
