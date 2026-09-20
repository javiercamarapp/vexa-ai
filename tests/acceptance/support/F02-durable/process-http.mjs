import {fork} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
export async function processHTTP(config,entry=new URL('./canonical-reference.mjs',import.meta.url).href){
 const child=fork(new URL('./http-child.mjs',import.meta.url),[],{stdio:['ignore','ignore','ignore','ipc']});
 const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('HTTP_CHILD_TIMEOUT'));},10000);child.once('message',m=>{clearTimeout(timer);m.type==='ready'?resolve(m):reject(new Error(m.code));});child.once('exit',()=>{clearTimeout(timer);reject(new Error('HTTP_CHILD_EXIT'));});});
 child.send({type:'start',config,entry});const {origin,pid}=await ready;
 return {origin,pid,async kill(){if(child.exitCode!==null||child.signalCode)return;const exit=once(child,'exit');child.kill('SIGKILL');await exit;},async close(){if(child.exitCode!==null||child.signalCode)return;const exit=once(child,'exit');child.send({type:'close'});const timer=setTimeout(()=>child.kill('SIGKILL'),3000);await exit;clearTimeout(timer);},async request(actor,route,body,headers={}){
 const r=await fetch(origin+route,{method:body===undefined?'GET':'POST',headers:{Connection:'close','Content-Type':'application/json',...(actor?{Authorization:'Bearer '+actor.token,'x-vexa-organization':actor.tenant}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});let data;try{data=await r.json();}catch{}return {status:r.status,data};}};
}
