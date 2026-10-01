import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=path.resolve(process.argv[2]);
const require=createRequire(path.join(process.env.TYPESCRIPT_ROOT??root,'package.json'));
const ts=require('typescript');
class AccessError extends Error{constructor(status,code){super(code);this.status=status;}}
let failures=0;
for(const file of ['delivery-server.ts','server.ts']){
 const source=fs.readFileSync(`${root}/apps/web/src/lib/notifications/${file}`,'utf8');
 let code;
 if(source.includes('async function notificationInput('))code=source.slice(source.indexOf('async function notificationInput('),source.indexOf('export async function'));
 else{const start=source.indexOf('const raw=await request.text()');const end=source.indexOf("throw new AccessError(400,'input_invalid');}",start)+"throw new AccessError(400,'input_invalid');}".length;assert(start>=0&&end>start);code=`async function notificationInput(request){${source.slice(start,end)}return input;}`;}
 const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const read=vm.runInNewContext(`${js};notificationInput`,{AccessError,Buffer,TextDecoder,Promise,setTimeout,clearTimeout});
 let count=0;const test=async(name,fn)=>{try{await fn();count++;console.log(`PASS ${file} ${name}`);}catch(e){failures++;console.log(`FAIL ${file} ${name}: ${e.message}`);}};
 const request=(data,headers={'content-type':'application/json'})=>new Request('http://127.0.0.1',{method:'POST',headers,body:data,duplex:'half'});
 await test('valid JSON',async()=>assert.equal((await read(request('{"x":1}'))).x,1));
 await test('malformed JSON 400',async()=>assert.rejects(read(request('{')),e=>e.status===400));
 await test('invalid UTF8 400',async()=>assert.rejects(read(request(new Uint8Array([123,34,120,34,58,34,255,34,125]))),e=>e.status===400));
 await test('wrong media type 400',async()=>assert.rejects(read(request('{}',{'content-type':'text/plain'})),e=>e.status===400));
 await test('oversized chunk 413 + cancel',async()=>{let cancelled=false,controller;const body=new ReadableStream({start(c){controller=c;c.enqueue(new Uint8Array(4097));},cancel(){cancelled=true;}});const timer=setTimeout(()=>{if(!cancelled)controller.close();},100);try{await assert.rejects(read(request(body)),e=>e.status===413);assert(cancelled);}finally{clearTimeout(timer);if(!cancelled){try{controller.close();}catch{}}}});
 await test('stalled stream 408 + cancel by 5.5s',async()=>{let cancelled=false,controller;const body=new ReadableStream({start(c){controller=c;},cancel(){cancelled=true;}});const began=Date.now();let timer;try{const outcome=await Promise.race([read(request(body)).then(()=>({ok:true}),e=>({status:e.status})),new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'hung'}),5500);})]);assert.equal(outcome.status,408);assert(Date.now()-began<=5550);assert(cancelled);}finally{clearTimeout(timer);if(!cancelled)controller.close();}});
 console.log(`${file}: ${count}/6`);
}
process.exitCode=failures?1:0;
