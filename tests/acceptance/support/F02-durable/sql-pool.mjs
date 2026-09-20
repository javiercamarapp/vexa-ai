// Exam transport implementing the EXISTING SqlPool; pg executes inside owned Docker.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
const worker=`const readline=require('readline');const {Client}=require('pg');let c;let chain=Promise.resolve();readline.createInterface({input:process.stdin}).on('line',line=>{chain=chain.then(async()=>{try{const m=JSON.parse(line);if(m.config){c=new Client(m.config);await c.connect();console.log(JSON.stringify({rows:[],rowCount:0}));}else{const r=await c.query(m.text,m.values);console.log(JSON.stringify({rows:r.rows??[],rowCount:r.rowCount??null}));}}catch(e){console.log(JSON.stringify({error:{code:e.code??'08006'}}));}});});process.stdin.on('end',()=>chain.finally(()=>c?.end()));`;
export function sqlPool(container,config){
 const children=new Set();
 return {async connect(){
  const child=spawn('docker',['exec','-i',container,'node','-e',worker],{stdio:['pipe','pipe','ignore']});children.add(child);
  const pending=[];let ended=false;
  const fail=()=>{ended=true;for(const p of pending.splice(0)){clearTimeout(p.timer);p.reject(Object.assign(new Error('SQL_TRANSPORT_CLOSED'),{code:'08006'}));}children.delete(child);};
  child.on('error',fail);child.on('exit',fail);
  createInterface({input:child.stdout}).on('line',line=>{const p=pending.shift();if(!p)return;clearTimeout(p.timer);try{const r=JSON.parse(line);r.error?p.reject(Object.assign(new Error('SQL_QUERY_FAILED'),r.error)):p.resolve(r);}catch{p.reject(new Error('SQL_TRANSPORT_PROTOCOL'));}});
  const send=m=>new Promise((resolve,reject)=>{if(ended)return reject(new Error('SQL_TRANSPORT_CLOSED'));const timer=setTimeout(()=>{child.kill();fail();},15000);pending.push({resolve,reject,timer});child.stdin.write(JSON.stringify(m)+'\n');});
  await send({config});return {query:(text,values=[])=>send({text,values}),release(){child.stdin.end();}};
 },close(){for(const c of children)c.kill();}};
}
