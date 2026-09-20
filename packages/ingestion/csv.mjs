import { IngestionError } from './index.mjs';
const defaults={maxBytes:20*1024*1024,maxRows:50001,maxColumns:100,maxFieldChars:100000};
function config(limits){const c={...defaults,...limits};delete c.signal;for(const n of Object.values(c))if(!Number.isSafeInteger(n)||n<1)throw new IngestionError('INVALID_LIMIT');return c;}
function error(code,line){const e=new IngestionError(code);e.line=line;throw e;}
// One record in memory. CR normalization and quote state persist across chunks.
class CSVState {
 constructor(c){this.c=c;this.values=[];this.field='';this.state='start';this.line=1;this.start=1;this.count=0;this.bad=false;this.touched=false;this.cr=false;this.first=true;this.chars=0;}
 pushField(){this.values.push(this.field);this.field='';this.chars=0;if(this.values.length>this.c.maxColumns)error('CSV_LIMIT_COLUMNS',this.start);}
 row(){this.pushField();if(++this.count>this.c.maxRows)error('CSV_LIMIT_ROWS',this.start);const out=this.bad?{type:'error',code:'CSV_SYNTAX',line:this.start,field:null}:{type:'row',values:this.values,line:this.start};this.values=[];this.state='start';this.bad=false;this.touched=false;this.start=this.line+1;return out;}
 add(c){this.field+=c;if(++this.chars>this.c.maxFieldChars)error('CSV_LIMIT_FIELD',this.start);}
 step(c){
  if(this.first){this.first=false;if(c==='\ufeff')return;}
  if(c==='\0')error('CSV_ENCODING',this.line);
  if(this.cr){this.cr=false;if(c==='\n')return;}
  if(c==='\r'){this.cr=true;c='\n';}
  this.touched=true;
  if(this.state==='quoted'){if(c==='"')this.state='closed';else{this.add(c);if(c==='\n')this.line++;}return;}
  if(this.state==='closed'&&c==='"'){this.add('"');this.state='quoted';return;}
  if(c==='\n'){const out=this.row();this.line++;return out;}
  if(c===','){this.pushField();if(this.values.length>=this.c.maxColumns)error('CSV_LIMIT_COLUMNS',this.start);this.state='start';return;}
  if(c==='"'&&this.state==='start'){this.state='quoted';return;}
  if(c==='"'||this.state==='closed')this.bad=true;
  this.add(c);this.state='plain';
 }
 end(){if(this.touched||this.values.length||this.field.length){if(this.state==='quoted')this.bad=true;return this.row();}}
}
export function parseCSV(input,limits={}){
 const c=config(limits);if(!(typeof input==='string'||input instanceof Uint8Array))error('CSV_ENCODING',1);
 if((typeof input==='string'?Buffer.byteLength(input):input.byteLength)>c.maxBytes)error('CSV_LIMIT_BYTES',1);
 let text;try{text=typeof input==='string'?input:new TextDecoder('utf-8',{fatal:true}).decode(input);}catch{error('CSV_ENCODING',1);}
 if(!text.isWellFormed())error('CSV_ENCODING',1);
 const s=new CSVState(c),rows=[],errors=[];const keep=e=>{if(!e)return;const {type,...v}=e;(type==='row'?rows:errors).push(v);};
 for(const char of text)keep(s.step(char));keep(s.end());return {rows,errors};
}
export async function* parseCSVStream(source,options={}){
 const c=config(options),s=new CSVState(c),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0;
 const check=()=>{if(options.signal?.aborted)error('CSV_CANCELLED',s.start);};
 const decode=(b,stream)=>{try{return decoder.decode(b,{stream});}catch{error('CSV_ENCODING',s.line);}};
 check();
 const iterator=source[Symbol.asyncIterator]?.();if(!iterator)error('CSV_ENCODING',1);
 const next=()=>{
  if(!options.signal)return iterator.next();
  return new Promise((resolve,reject)=>{
   const abort=()=>{const e=new IngestionError('CSV_CANCELLED');e.line=s.start;reject(e);};
   options.signal.addEventListener('abort',abort,{once:true});
   if(options.signal.aborted){abort();return;}
   Promise.resolve().then(()=>{check();return iterator.next();}).then(resolve,reject).finally(()=>options.signal.removeEventListener('abort',abort));
  });
 };
 try{
  while(true){check();const item=await next();check();if(item.done)break;
   if(!(item.value instanceof Uint8Array))error('CSV_ENCODING',s.line);
   bytes+=item.value.byteLength;if(bytes>c.maxBytes)error('CSV_LIMIT_BYTES',s.start);
   const text=decode(item.value,true);
   for(const char of text){check();const e=s.step(char);if(e)yield e;}
  }
  for(const char of decode(undefined,false)){check();const e=s.step(char);if(e)yield e;}
  check();const e=s.end();if(e)yield e;
 }finally{
  // An async generator may queue return() behind a pending read. Request cleanup,
  // but cancellation must not be held hostage by an uncooperative producer.
  if(options.signal?.aborted){try{Promise.resolve(iterator.return?.()).catch(()=>{});}catch{}}
  else await iterator.return?.();
 }
}
