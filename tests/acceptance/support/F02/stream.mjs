// Shared assertions. No parser implementation or candidate fallback.
import assert from 'node:assert/strict';
export async function collect(stream){const out=[];for await(const event of stream)out.push(event);return out;}
export const row=(values,line)=>({type:'row',values,line});
export function tracked(chunks){let reads=0,closed=false;return {get reads(){return reads;},get closed(){return closed;},[Symbol.asyncIterator](){return this;},async next(){return reads<chunks.length?{done:false,value:chunks[reads++]}:{done:true};},async return(){closed=true;return {done:true};}};}
export async function earlyEmission(parse){
 let release;const barrier=new Promise(r=>release=r);let ended=false,closed=false;
 async function* source(){try{yield Buffer.from('id,text\r\n');await barrier;yield Buffer.from('1,end\r\n');ended=true;}finally{closed=true;}}
 const it=parse(source())[Symbol.asyncIterator]();let timer;
 try {const first=await Promise.race([it.next(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Object.assign(new Error('STREAM_EARLY_EMISSION'),{code:'ERR_ASSERTION'})),1500))]);assert.deepEqual(first,{done:false,value:row(['id','text'],1)},'STREAM_FIRST_ROW');assert.equal(ended,false,'STREAM_SOURCE_NOT_ENDED');release();assert.deepEqual((await it.next()).value,row(['1','end'],2));assert.equal((await it.next()).done,true);assert.equal(closed,true);} finally {clearTimeout(timer);release();await it.return?.();}
}
export async function splitBoundary(parse){
 const input=Buffer.from('\ufeffid,text\r\n1,"😀é,a\r\nb ""Q"""\r\n2,end');
 const expected=[row(['id','text'],1),row(['1','😀é,a\nb "Q"'],2),row(['2','end'],4)];
 for(let split=1;split<input.length;split++)assert.deepEqual(await collect(parse(tracked([input.subarray(0,split),input.subarray(split)]))),expected,`STREAM_SPLIT_${split}`);
 assert.deepEqual(await collect(parse(tracked([...input].map(x=>Buffer.from([x]))))),expected,'STREAM_BYTE_CHUNKS');
}
export async function cancellation(parse){
 const source=tracked([Buffer.from('h\n'),Buffer.from('a\n'),Buffer.from('b\n')]);const controller=new AbortController();const it=parse(source,{signal:controller.signal})[Symbol.asyncIterator]();await it.next();const before=source.reads;controller.abort();await assert.rejects(()=>it.next(),e=>e.code==='CSV_CANCELLED','STREAM_CANCEL_REASON');assert.equal(source.reads,before,'STREAM_CANCEL_NO_READ');assert.equal(source.closed,true,'STREAM_CANCEL_CLOSE');
 const second=tracked([Buffer.from('h\n'),Buffer.from('a\n')]);for await(const event of parse(second)){assert.equal(event.type,'row');break;}assert.equal(second.closed,true,'STREAM_BREAK_CLOSE');assert.equal(second.reads,1,'STREAM_BACKPRESSURE');
}
export async function consumption(parse){
 for(const [limits,chunks,code]of [[{maxBytes:2},['é','x','TAIL'],'CSV_LIMIT_BYTES'],[{maxRows:2},['a\n','b\n','c\n','TAIL'],'CSV_LIMIT_ROWS'],[{maxFieldChars:2},['ab','c','TAIL'],'CSV_LIMIT_FIELD'],[{maxColumns:2},['a,b,','c\n','TAIL'],'CSV_LIMIT_COLUMNS']]){
 const source=tracked(chunks.map(x=>Buffer.from(x)));await assert.rejects(()=>collect(parse(source,limits)),e=>e.code===code,`STREAM_REJECT_${code}`);assert.ok(source.reads<chunks.length,`STREAM_CONSUMPTION_${code}`);assert.equal(source.closed,true,`STREAM_CLOSED_${code}`);
 }
}
export async function pendingAbort(parse){
 let reads=0,closed=false,release;const blocked=new Promise(r=>release=r);const source={ [Symbol.asyncIterator](){return this;},async next(){reads++;return blocked;},async return(){closed=true;return {done:true};}};
 const controller=new AbortController(),it=parse(source,{signal:controller.signal})[Symbol.asyncIterator]();const pending=it.next();await new Promise(r=>setImmediate(r));assert.equal(reads,1,'STREAM_PENDING_READ_STARTED');controller.abort();let timer;
 try {await assert.rejects(()=>Promise.race([pending,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('STREAM_ABORT_TIMEOUT')),1500))]),e=>e.code==='CSV_CANCELLED','STREAM_PENDING_ABORT');assert.equal(closed,true,'STREAM_PENDING_CLOSE');}finally{clearTimeout(timer);release({done:true});await pending.catch(()=>{});await it.return?.();}
}
