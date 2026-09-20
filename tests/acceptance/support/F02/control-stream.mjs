// CONTROL ONLY: independent Python csv.reader, no production parser or fallback.
// Covers early emission and split decoding only; no claim about bounded memory.
import {spawn,spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import fs from 'node:fs';import {earlyEmission,splitBoundary} from './stream.mjs';
const py=`import sys,csv,io,json
source=io.TextIOWrapper(sys.stdin.buffer,encoding='utf-8-sig',newline=None)
reader=csv.reader(source,strict=True)
while True:
 line=reader.line_num+1
 try: values=next(reader)
 except StopIteration: break
 print(json.dumps({'type':'row','values':values,'line':line}),flush=True)
`;
async function* independent(source){
 const child=spawn('python3',['-u','-c',py],{stdio:['pipe','pipe','pipe']});let queue=[],wake,ended=false,error,buffer='';
 const signal=()=>{wake?.();wake=null;};
 child.stdout.on('data',data=>{buffer+=data;let n;while((n=buffer.indexOf('\n'))>=0){queue.push(JSON.parse(buffer.slice(0,n)));buffer=buffer.slice(n+1);}signal();});
 let stderr='';child.stderr.on('data',x=>stderr+=x);child.on('error',e=>{error=e;ended=true;signal();});child.on('close',code=>{if(code!==0)error=Error(`CONTROL_READER_INFRA:${code}:${stderr}`);ended=true;signal();});
 child.stdin.on('error',()=>{});
 const pump=(async()=>{try{for await(const bytes of source)child.stdin.write(bytes);child.stdin.end();}catch(e){error=e;child.kill();}})();
 try {while(!ended||queue.length){if(queue.length)yield queue.shift();else await new Promise(r=>wake=r);}if(error)throw error;}finally{child.kill();await pump;}
}
async function* eager(source){const all=[];for await(const b of source)all.push(b);yield* independent([Buffer.concat(all)]);}
async function* brokenDecode(source){async function* damaged(){for await(const b of source)yield Buffer.from(b.toString('utf8'));}yield* independent(damaged());}
const cases=[['early',earlyEmission,eager,'STREAM_EARLY_EMISSION'],['split',splitBoundary,brokenDecode,'STREAM_SPLIT_']];
if(process.argv[2]==='--probe'){
 const selected=cases.find(x=>x[0]===process.argv[3]);await selected[1](process.argv[4]==='defect'?selected[2]:independent);
}else{
 const results=[];
 for(const [id,,,label]of cases){
  const exits={};for(const stage of ['before','defect','restored']){
   const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--probe',id,stage],{encoding:'utf8',timeout:15000});
   fs.writeFileSync(new URL(`./evidence/complete01/stream-${id}-${stage}.log`,import.meta.url),r.stdout+r.stderr);
   assert.equal(r.status,stage==='defect'?1:0,`CONTROL_EXIT:${id}:${stage}:${r.stderr}`);
   if(stage==='defect'){assert.match(r.stderr,/ERR_ASSERTION/);assert.ok(r.stderr.includes(label));assert.ok(!/CONTROL_READER_INFRA|SyntaxError/.test(r.stderr));}exits[stage]=r.status;
  }
  results.push({id,...exits,assertion:label});
 }
 fs.writeFileSync(new URL('./evidence/complete01/stream-controls.json',import.meta.url),JSON.stringify({controlOnly:true,reader:'Python stdlib csv.reader; real bytes; no limit/cancel implementation',results},null,2));console.log(JSON.stringify(results));
}
