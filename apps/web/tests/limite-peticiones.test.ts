/* eslint-disable @typescript-eslint/no-explicit-any -- dobles de prueba */
// H-01: límite general de peticiones por clase, IP y sesión, con contador compartido y sincronización por lotes; falla abierto.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/limite-peticiones.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {claseDe,crearLimitador,huellaDeUsuario,huellaIp,LIMITES} from '../src/lib/security/limite';
import {evaluarLimite,revisarUsuario} from '../src/lib/security/limite-servidor';
import {clientIp} from '../src/lib/email-auth/admission';
import {middleware} from '../src/middleware';
const K='k'.repeat(32);
test('clases por endpoint: lectura, escritura, exportación, importación, IA, auth y ganchos; salud y páginas sin límite',()=>{
  assert.equal(claseDe('GET','/api/problems'),'read');assert.equal(claseDe('POST','/api/interventions'),'write');
  assert.equal(claseDe('GET','/api/workspace/export'),'export');assert.equal(claseDe('GET','/api/pain-points/P2/evidence','?format=csv'),'export');assert.equal(claseDe('GET','/api/jobs/abc/errors'),'export');
  assert.equal(claseDe('POST','/api/imports'),'import');assert.equal(claseDe('GET','/api/imports/x'),'read');
  assert.equal(claseDe('POST','/api/agent/turn'),'ai');assert.equal(claseDe('POST','/api/pain-points/P2/ia'),'ai');assert.equal(claseDe('GET','/api/pain-points/P2/ia'),'read');
  assert.equal(claseDe('POST','/auth/email/request'),'auth');assert.equal(claseDe('GET','/auth/callback'),'auth');
  assert.equal(claseDe('POST','/api/webhooks/email'),'hook');assert.equal(claseDe('POST','/api/internal/crm'),'hook');assert.equal(claseDe('GET','/api/baja'),'hook');
  assert.equal(claseDe('GET','/api/health/version'),null);assert.equal(claseDe('GET','/overview'),null);assert.equal(claseDe('POST','/auth/logout'),null);
});
test('cubeta por IP: el exceso responde con Retry-After hasta el cambio de minuto; otra IP no se ve afectada',()=>{
  let t=60_000*10+1000;const lim=crearLimitador({sumar:()=>null,ahora:()=>t});
  const ip=huellaIp('203.0.113.9',K),otra=huellaIp('198.51.100.1',K);
  for(let i=0;i<LIMITES.export.ip;i++)assert.equal(lim.revisar('export',ip,null).permitido,true,'dentro del límite '+i);
  const d=lim.revisar('export',ip,null);assert.equal(d.permitido,false);assert.ok(!d.permitido&&d.reintentarEn>=1&&d.reintentarEn<=60&&d.por==='ip');
  assert.equal(lim.revisar('export',otra,null).permitido,true);assert.equal(lim.revisar('read',ip,null).permitido,true,'otra clase tiene su propia cubeta');
  t+=60_000;assert.equal(lim.revisar('export',ip,null).permitido,true,'minuto nuevo');
});
test('cubeta por usuario verificado: 10 exportaciones por minuto aunque vengan de IP distintas',()=>{
  const lim=crearLimitador({sumar:()=>null,ahora:()=>5_000_000});const s=huellaDeUsuario('11111111-1111-4111-8111-111111111111',K);
  assert.match(String(s),/^[a-f0-9]{64}$/);
  for(let i=0;i<10;i++)assert.equal(lim.revisar('export',huellaIp('203.0.113.'+i,K),s).permitido,true);
  const d=lim.revisar('export',huellaIp('203.0.113.200',K),s);assert.ok(!d.permitido&&d.por==='sesion');
});
test('R2-13: la huella por usuario deriva del sub verificado (HMAC), no de cookies sin verificar; no filtra el sub',()=>{
  const a=huellaDeUsuario('sub-a',K),b=huellaDeUsuario('sub-b',K);
  assert.notEqual(a,b);assert.equal(a,huellaDeUsuario('sub-a',K));assert.ok(!String(a).includes('sub-a'));
  assert.equal(huellaDeUsuario('',K),null);assert.equal(huellaDeUsuario('sub-a',null),null);
});
test('R2-13: rotar el refresh_token de la cookie NO evade el tope: el borde ya no cuenta por cookie y el tope por usuario cuenta el mismo sub',()=>{
  const SUB='22222222-2222-4222-8222-222222222222';let estado:ReturnType<typeof revisarUsuario>=null;let primero429=0;
  for(let i=0;i<70;i++){
    const cookie='sb-x-auth-token=base64-'+Buffer.from(JSON.stringify({access_token:'MISMO',refresh_token:'refresh-distinto-'+i+'-xxxxxxxx'})).toString('base64url');
    // el borde (sin verificar) no debe aplicar tope por sesión: solo por IP, y aquí cada petición viene de una IP distinta
    assert.equal(evaluarLimite({method:'POST',headers:{get:(n:string)=>n==='x-forwarded-for'?'203.0.113.'+(i+1):n==='cookie'?cookie:null}},'/api/interventions',''),null);
    estado=revisarUsuario(SUB,'POST','/api/interventions');if(estado&&!primero429)primero429=i+1;
  }
  assert.ok(estado&&estado.clase==='write','70 POST del mismo sub verificado producen 429');assert.equal(primero429,LIMITES.write.user!+1);
  assert.equal(revisarUsuario('33333333-3333-4333-8333-333333333333','POST','/api/interventions'),null,'otro usuario no se ve afectado');
  assert.equal(revisarUsuario(SUB,'GET','/overview'),null,'páginas sin clase no se limitan');
});
test('R2-13: tope global de volcados a la base en vuelo; el excedente espera sin perder el conteo local',async()=>{
  let vuelo=0,maxVuelo=0;const lim=crearLimitador({ahora:()=>7_000_000,maxPendiente:1,maxVuelo:2,sumar:async()=>{vuelo++;maxVuelo=Math.max(maxVuelo,vuelo);await new Promise(r=>setTimeout(r,20));vuelo--;return 1;}});
  for(let i=0;i<30;i++)lim.revisar('read',huellaIp('198.51.100.'+i,K),null);
  await new Promise(r=>setTimeout(r,60));assert.ok(maxVuelo<=2,'máximo 2 volcados simultáneos, hubo '+maxVuelo);
});
test('R2-13: la IP del cliente prefiere x-vercel-forwarded-for, luego x-real-ip y por último x-forwarded-for',()=>{
  const h=(o:Record<string,string>)=>({get:(n:string)=>o[n]??null});
  assert.equal(clientIp(h({'x-vercel-forwarded-for':'203.0.113.7','x-real-ip':'198.51.100.1','x-forwarded-for':'1.2.3.4, 5.6.7.8'})),'203.0.113.7');
  assert.equal(clientIp(h({'x-real-ip':'198.51.100.1','x-forwarded-for':'1.2.3.4'})),'198.51.100.1');
  assert.equal(clientIp(h({'x-forwarded-for':'1.2.3.4, 5.6.7.8'})),'1.2.3.4');
  assert.equal(clientIp(h({'x-vercel-forwarded-for':'no-es-ip','x-forwarded-for':'1.2.3.4'})),'1.2.3.4','valor inválido cae al siguiente');
});
test('sincronización compartida: suma por lotes (no una por petición) y usa el total global de otras instancias',async()=>{
  let t=1_200_000;const llamadas:number[]=[];let globalOtros=0;
  const lim=crearLimitador({ahora:()=>t,syncMs:5000,maxPendiente:25,sumar:async(_c,_h,n)=>{llamadas.push(n);globalOtros+=n;return globalOtros;}});
  const ip=huellaIp('203.0.113.9',K);
  for(let i=0;i<100;i++)lim.revisar('read',ip,null);
  await new Promise(r=>setTimeout(r,5));assert.ok(llamadas.length<=5,'lotes, no 100 viajes: '+llamadas.length);
  globalOtros=590;lim.revisar('read',ip,null);t+=5001;lim.revisar('read',ip,null);await new Promise(r=>setTimeout(r,5));
  assert.equal(lim.revisar('read',ip,null).permitido,false,'otras instancias ya consumieron el cupo del minuto (600) -> 429 aquí también');
});
test('falla abierto: si la base lanza, rechaza o devuelve basura, se sigue contando en local sin excepciones',async()=>{
  for(const sumar of [()=>{throw new Error('x');},async()=>{throw new Error('y');},async()=>NaN,()=>null]){
    const lim=crearLimitador({ahora:()=>9_000_000,sumar:sumar as never,maxPendiente:1});const ip=huellaIp('203.0.113.5',K);
    for(let i=0;i<LIMITES.write.ip;i++)assert.equal(lim.revisar('write',ip,null).permitido,true);
    await new Promise(r=>setTimeout(r,3));assert.equal(lim.revisar('write',ip,null).permitido,false,'el tope local sigue vigente');
  }
});
test('memoria acotada: muchas huellas distintas no crecen sin límite',()=>{
  const lim=crearLimitador({sumar:()=>null,ahora:()=>1,maxClaves:50});for(let i=0;i<500;i++)lim.revisar('read',huellaIp('10.0.'+(i>>8)+'.'+(i&255),K),null);
  assert.ok(lim._tamano()<=50);
});
test('middleware: 429 con Retry-After y cabeceras privadas al exceder; las rutas sin clase no se limitan',async()=>{
  const saved={...process.env};process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:56321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='k';process.env.NEXT_PUBLIC_SITE_URL='http://localhost:3000';
  try{
    const mk=()=>new NextRequest('http://localhost:3000/api/webhooks/email',{method:'POST',headers:{'x-forwarded-for':'203.0.113.123'}});
    let ultimo=200;for(let i=0;i<LIMITES.hook.ip+5;i++)ultimo=(await middleware(mk())).status;
    assert.equal(ultimo,429);const r=await middleware(mk());assert.equal(r.status,429);assert.match(r.headers.get('retry-after')??'',/^\d+$/);assert.match(r.headers.get('cache-control')??'',/no-store/);assert.equal((await r.json()).error.code,'rate_limited');
    for(let i=0;i<LIMITES.hook.ip+50;i++)assert.notEqual((await middleware(new NextRequest('http://localhost:3000/api/health/version',{headers:{'x-forwarded-for':'203.0.113.123'}}))).status,429);
  }finally{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});

import {crearGuardia,TOPES} from '../src/lib/security/concurrencia';
import {createDatabase} from '@vexa/platform/db';
const T='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',U1='11111111-1111-4111-8111-111111111111';
const poolFalso=(respuesta:(sql:string)=>unknown,log:string[]=[])=>({async connect(){return {async query(sql:string){log.push(sql.slice(0,40));if(/api_concurrency/.test(sql))return {rows:[{v:respuesta(sql)}]};if(/memberships/.test(sql))return {rows:[{tenant_id:T,user_id:U1,role:'owner',status:'active',permissions_version:1}]};return {rows:[]};},release(){}};}});
const identidad={async getUser(){return {id:U1};},async memberships(){return [{tenant_id:T,user_id:U1,role:'owner' as const,status:'active' as const,permissions_version:1}];}};
test('concurrencia: la guardia entrega liberación o null (tope alcanzado) y falla abierto sin base, con error o con lentitud',async()=>{
  const g=crearGuardia(()=>poolFalso(()=>'lease-1') as never,()=>true);assert.equal(typeof await g(T,'export'),'function');
  assert.equal(await crearGuardia(()=>poolFalso(()=>null) as never,()=>true)(T,'export'),null);
  assert.equal(typeof await crearGuardia(()=>poolFalso(()=>null) as never,()=>false)(T,'export'),'function','sin base: pasa');
  assert.equal(typeof await crearGuardia(()=>{throw new Error('sin pool');},()=>true)(T,'import'),'function','error: pasa');
  assert.equal(typeof await g(T,'read'),'function','acciones ligeras no usan la guardia');assert.ok(TOPES.materialize.max===1&&TOPES.export.max===2);
});
test('createDatabase: una acción pesada con el tope alcanzado responde 429 org_busy SIN tocar el pool; una ligera no consulta la guardia; la liberación ocurre siempre',async()=>{
  const g=globalThis as {__vexaConcurrency?:unknown};const previo=g.__vexaConcurrency;const consultas:string[]=[];let liberada=0,ocupada=true;
  g.__vexaConcurrency=async(_t:string,a:string)=>{consultas.push(a);return ocupada?null:()=>{liberada++;};};
  try{
    let conexiones=0;const pool={async connect(){conexiones++;return poolFalso(()=>null).connect();}};
    const db=createDatabase({identity:identidad as never,pool:pool as never,selectedTenant:T});
    await assert.rejects(db.transaction('export',async()=>1),(e:any)=>e.status===429&&e.code==='org_busy');assert.equal(conexiones,0);
    ocupada=false;assert.equal(await db.transaction('export',async()=>42),42);assert.equal(liberada,1);
    await assert.rejects(db.transaction('import',async()=>{throw new Error('boom');}));assert.equal(liberada,2,'se libera aunque el trabajo falle');
    consultas.length=0;await db.transaction('read',async()=>1);assert.deepEqual(consultas,[]);
  }finally{g.__vexaConcurrency=previo;}
});

test('R2-13: rutas de datos fuera de /api tienen clase propia (exportación, copiloto, lectura y escritura)', () => {
  assert.equal(claseDe('GET', '/cfo/data/export'), 'export');
  assert.equal(claseDe('GET', '/platform/data/download/x'), 'export');
  assert.equal(claseDe('POST', '/platform/data/copilot'), 'ai');
  assert.equal(claseDe('GET', '/cfo/data/resumen'), 'read');
  assert.equal(claseDe('POST', '/seguridad/data'), 'write');
  assert.equal(claseDe('PUT', '/auth/organization'), 'write');
  assert.equal(claseDe('GET', '/platform'), null, 'las páginas normales siguen sin límite');
  assert.equal(claseDe('GET', '/seguridad'), null);
});
