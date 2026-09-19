import test from 'node:test';
import assert from 'node:assert/strict';
import {inputs,prepare,components} from './support/F01-04/harness.mjs';
import {routes} from './support/F01-04/routes.mjs';
const candidate=process.env.VEXA_CANDIDATE;
test('F01-04: componentes reales, ocho rutas y autorización independiente del menú',{timeout:540000},async t=>{
 inputs(candidate);
 const h=await prepare(candidate);
 try{
  await h.start();
  await t.test('seis estados, alcance, teclado, foco y dos viewports',()=>components(h));
  await t.test('rutas protegidas con sesión real y selectores forjados',()=>routes(h,candidate));
 }finally{await h.close();console.log('Artifacts: '+h.tmp);}
});
