// R2-06 (auditoría run-2): /auth/email/request responde el 202 genérico sin esperar al proveedor de correo, para que el tiempo de respuesta no distinga cuentas existentes, duplicados ni lentitud del proveedor.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/enlace-sin-espera.test.ts
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../src/app/(app)/auth/email/request/route';
const originalFetch=globalThis.fetch,saved={...process.env};
afterEach(()=>{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);});
const origin='http://localhost:3000';
test('el 202 no espera a signInWithOtp (proveedor lento: 2.5 s) y la petición al proveedor sí se hace',async()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:56321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='k';process.env.NEXT_PUBLIC_SITE_URL=origin;process.env.VEXA_EMAIL_AUTH_ENABLED='true';delete process.env.VEXA_DATABASE_URL;
  let otpIniciado=false,otpTerminado=false;
  globalThis.fetch=async(input)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:(input as Request).url);
    if(url.pathname==='/auth/v1/otp'){otpIniciado=true;await new Promise(r=>setTimeout(r,2500));otpTerminado=true;return new Response('{}',{status:200,headers:{'content-type':'application/json'}});}
    throw new Error('ruta inesperada '+url.pathname);};
  const t0=Date.now();
  const r=await POST(new NextRequest(origin+'/auth/email/request',{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':'203.0.113.77'},body:JSON.stringify({email:'persona@example.invalid'})}));
  const ms=Date.now()-t0;
  assert.equal(r.status,202);assert.ok(ms<1000,'respondió en '+ms+' ms; no debe esperar al proveedor');assert.equal(otpTerminado,false);
  await new Promise(r=>setTimeout(r,2800));assert.equal(otpIniciado,true,'el envío sí ocurrió en segundo plano');assert.equal(otpTerminado,true);
});
