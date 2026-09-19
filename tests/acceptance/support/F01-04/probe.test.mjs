import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {prepare,components} from './harness.mjs';
test('F01-04 oracle probe: React/Next/Chromium real y mutantes',{timeout:360000},async t=>{
 const h=await prepare(process.env.VEXA_CANDIDATE,{proposal:true});
 try{
  await h.start();await components(h);const validation=()=>{const r=h.browser('validation');assert.equal(r.status,0,r.stderr);};validation();
  for(const [name,file,from,to,expected] of [
   ['retry hash-only',h.inputs.state,'<a href="">','<a href="#">',/ERROR_RETRY_REQUEST/],
   ['retry salto Tab',h.inputs.state,'<a href="">','<a href="" tabIndex={-1}>',/ERROR_RETRY_KEYBOARD/],
   ['omite validación','apps/web/src/lib/workspace/contracts.ts'," const allowed=new Set("," return {scope:{} as any,limit:25,cursor:null}; const allowed=new Set(",/VALIDATION_SPECIFIC/],
   ['error a vacío',h.inputs.state,"if(state.kind==='error')","if(false)",/ERROR_VISIBLE/],
   ['pierde alcance',h.inputs.navigation,"href={href+'?'+query}","href={href+'?'}",/SCOPE_PRESERVED/],
   ['navegación sin teclado',h.inputs.navigation,'<Link aria-current','<Link tabIndex={-1} aria-current',/KEYBOARD_NAV/],
  ])await t.test(name,async()=>{
   const dest=path.join(h.tmp,file),original=fs.readFileSync(dest,'utf8');assert.ok(original.includes(from),'MUTATION_SETUP');
   let mutated=original.replace(from,to);
   if(name==='error a vacío')mutated=original.replace("if(state.kind==='error')", "if(state.kind==='error')return <div role=\"status\">Sin resultados para este alcance</div>; if(false)");
   fs.writeFileSync(dest,mutated);await new Promise(r=>setTimeout(r,1000));
   try{const r=h.browser(name==='omite validación'?'validation':'components');assert.equal(r.error,undefined,'MUTATION_INFRA');assert.notEqual(r.status,0,'MUTANT_SURVIVED');assert.match(r.stderr,expected,'MUTANT_MUST_FAIL_RELEVANT_ASSERTION');console.log('KILLED '+name+' '+expected);}
   finally{fs.writeFileSync(dest,original);await new Promise(r=>setTimeout(r,1000));}
  });
  await components(h);validation();
 }finally{await h.close();console.log('Artifacts: '+h.tmp);}
});
