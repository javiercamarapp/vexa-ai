import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from './index.mjs';
const collect=async it=>{const a=[];for await(const x of it)a.push(x);return a;};
test('stream independent byte chunks, physical lines, escaped quotes, CR-only and emoji',async()=>{
 const text='\ufeffh,t\r1,"😀\r\nx""y"\r2,z';
 async function* input(){for(const b of Buffer.from(text))yield Uint8Array.of(b);}
 assert.deepEqual(await collect(m.parseCSVStream(input())),[{type:'row',values:['h','t'],line:1},{type:'row',values:['1','😀\nx"y'],line:2},{type:'row',values:['2','z'],line:4}]);
});
test('stream backpressure within chunk and abort do not pull another chunk',async()=>{
 let pulled=0,closed=false;async function* input(){try{pulled++;yield Buffer.from('a\nb\n');pulled++;throw Error('overread');}finally{closed=true;}}
 const c=new AbortController(),it=m.parseCSVStream(input(),{signal:c.signal});assert.equal((await it.next()).value.line,1);c.abort();await assert.rejects(it.next(),{code:'CSV_CANCELLED'});assert.equal(pulled,1);assert.equal(closed,true);
});
test('stream invalid UTF8, truncation and physical limit location',async()=>{
 async function* source(s){yield Buffer.from(s);}
 assert.deepEqual(await collect(m.parseCSVStream(source('h\n"x'))),[{type:'row',values:['h'],line:1},{type:'error',code:'CSV_SYNTAX',field:null,line:2}]);
 await assert.rejects(collect(m.parseCSVStream(source('"a\nb"\nc'),{maxRows:1})),e=>e.code==='CSV_LIMIT_ROWS'&&e.line===3);
 await assert.rejects(collect(m.parseCSVStream(source(Uint8Array.of(0xff)))),{code:'CSV_ENCODING'});
});
const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'csv',source_account_id:'SYN'};
const opts={context,observed_at:'2026-09-01T00:00:00Z',mappingVersion:'syn'};
const head='external_id,source_revision,occurred_at,text,role,amount,currency';
test('money validation keeps raw hash and exact minor units; text counts points',()=>{
 const r=m.normalizeCSV(head+'\na,v1,2026-09-01T00:00:00Z,'+'😀'.repeat(2000)+',customer,9007199254740993.01,USD\nb,v1,2026-09-01T00:00:00Z,x,customer,=1+1,USD',opts);
 assert.equal(r.records.length,1);assert.equal(r.errors[0].field,'amount');assert.equal(r.records[0].money.amount_minor,'900719925474099301');assert.equal(r.records[0].row_hash,m.contentHash(r.records[0].raw_payload));
});
test('abort rejects pending uncooperative read without waiting for iterator.return',async()=>{
 const c=new AbortController();let returned=0,started;const reading=new Promise(r=>started=r);
 const source={[Symbol.asyncIterator](){return this;},next(){started();return new Promise(()=>{});},return(){returned++;return new Promise(()=>{});}};
 const it=m.parseCSVStream(source,{signal:c.signal});const pending=it.next();await reading;c.abort();
 let timer;try{await Promise.race([assert.rejects(pending,{code:'CSV_CANCELLED'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('abort blocked')),100);})]);}finally{clearTimeout(timer);}
 assert.equal(returned,1);
});
test('money explicit currency, precision and unknown amounts cannot silently become zero',()=>{
 assert.deepEqual(m.parseMoney('-12.34','USD'),{amount_minor:'-1234',currency:'USD',exponent:2});
 assert.deepEqual(m.parseMoney('42','JPY'),{amount_minor:'42',currency:'JPY',exponent:0});
 assert.deepEqual(m.parseMoney('1.001','KWD'),{amount_minor:'1001',currency:'KWD',exponent:3});
 for(const [amount,currency]of [['','USD'],['1.001','USD'],['1.1','JPY'],['1',''],['NaN','USD'],['1e2','USD']])assert.throws(()=>m.parseMoney(amount,currency),/INVALID_/);
});
test('custom normalize row budget excludes header and all parsers locate first excess',()=>{
 const input=head+'\na,v1,2026-09-01T00:00:00Z,x,customer,1,USD\nb,v1,2026-09-01T00:00:00Z,x,customer,1,USD';
 assert.equal(m.normalizeCSV(input,{...opts,limits:{maxRows:2}}).records.length,2);
 assert.throws(()=>m.normalizeCSV(input,{...opts,limits:{maxRows:1}}),e=>e.code==='CSV_LIMIT_ROWS'&&e.line===3);
});
