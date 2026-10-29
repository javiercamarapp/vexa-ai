// R-02 (cierre de seguridad 28-oct): los cuerpos JSON del copiloto y de /platform/data se leen con tope en la lectura,
// no con request.text() completo. Un cuerpo en flujo (sin Content-Length) que excede 8 KiB se corta con 413 y el flujo se cancela.
//   cd apps/web && node --require ./tests/server-only-stub.cjs --import tsx --test tests/cuerpo-con-tope.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readJson, MAX_BODY} from '../src/components/platform/server/copilot-http';
const json={'content-type':'application/json'};
test('cuerpo válido pequeño: se parsea',async()=>{
  const r=await readJson(new Request('http://x/a',{method:'POST',headers:json,body:JSON.stringify({question:'hola'})}));
  assert.equal(r.question,'hola');
});
test('Content-Length declarado sobre el tope: 413 sin leer el flujo',async()=>{
  const req=new Request('http://x/a',{method:'POST',headers:{...json,'content-length':String(MAX_BODY+1)},body:'{}'});
  await assert.rejects(readJson(req),(e:any)=>e.status===413&&e.code==='input_limit');
});
test('flujo sin Content-Length que excede el tope: 413 y se cancela antes de acumular todo',async()=>{
  let sent=0,cancelled=false;
  const stream=new ReadableStream<Uint8Array>({pull(c){if(sent>MAX_BODY*50){c.close();return;}sent+=1024;c.enqueue(new Uint8Array(1024).fill(97));},cancel(){cancelled=true;}});
  const req=new Request('http://x/a',{method:'POST',headers:json,body:stream,duplex:'half'} as RequestInit);
  await assert.rejects(readJson(req),(e:any)=>e.status===413&&e.code==='input_limit');
  assert.ok(sent<=MAX_BODY+4096,'no se leyó más allá del tope + un fragmento: '+sent);
  await new Promise(r=>setTimeout(r,10));assert.equal(cancelled,true);
});
test('JSON inválido y tipo de contenido erróneo siguen siendo 400',async()=>{
  await assert.rejects(readJson(new Request('http://x/a',{method:'POST',headers:json,body:'{no'})),(e:any)=>e.status===400);
  await assert.rejects(readJson(new Request('http://x/a',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})),(e:any)=>e.status===400);
});
test('ningún manejador de copiloto ni de /platform/data vuelve a llamar request.text()',()=>{
  for(const f of ['src/components/platform/server/copilot-http.ts','src/app/(app)/platform/data/actions/route.ts','src/app/(app)/platform/data/support/route.ts','src/app/(app)/platform/data/copilot/route.ts','src/app/(app)/(workspace)/cfo/data/copilot/route.ts'])
    assert.doesNotMatch(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),/request\.text\(\)|request\.json\(\)/,f);
});
