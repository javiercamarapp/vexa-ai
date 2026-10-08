import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
/** Exact served SW handler bytes; network reads use the real authenticated local API.
 * Notification UI and click are observed locally, not a claim of provider/browser delivery. */
export async function exerciseWorker(source,{base,cookie,expectedVisible}){
 const handlers=new Map(),shown=[],opened=[];let waited,closed=0;
 const self={addEventListener:(type,handler)=>handlers.set(type,handler),skipWaiting:()=>Promise.resolve(),clients:{claim:()=>Promise.resolve(),openWindow:url=>{opened.push(url);return Promise.resolve();}},location:{origin:base},registration:{showNotification:(title,options)=>{shown.push({title,options});return Promise.resolve();}}};
 vm.runInNewContext(fs.readFileSync(source,'utf8'),{self,URL,Date,Promise,AbortSignal,fetch:(url,options)=>fetch(new URL(url,base),{...options,headers:{cookie}})});
 let scope={subscriptionId:'11111111-1111-4111-8111-111111111111',version:1};const response=await fetch(base+'/api/notifications/push',{headers:{cookie}});if(response.ok){const {data}=await response.json();const current=data.devices?.find(d=>d.deviceId===data.currentDeviceId&&d.status==='active');if(current)scope={subscriptionId:current.id,version:current.version};}
 const dispatch=async payload=>{handlers.get('push')({data:{json:()=>payload},waitUntil:p=>waited=p});await waited;};
 await dispatch({...scope,title:'SYN PII must be ignored',body:'tenant secret',href:'https://outside.invalid'});
 assert.equal(shown.length,expectedVisible?1:0);
 if(expectedVisible){assert.deepEqual(JSON.parse(JSON.stringify(shown[0])),{title:'Rovaq AI',options:{body:'Tienes avisos disponibles en Rovaq AI.',tag:'vexa-notifications',data:{href:'/notifications'}}});}
 const count=shown.length;for(const payload of [{...scope,version:scope.version+1},{...scope,subscriptionId:'99999999-9999-4999-8999-999999999999'},{title:'SYN missing binding'}]){await dispatch(payload);assert.equal(shown.length,count,'PUSH_STALE_OR_FOREIGN_BINDING_HIDDEN');}
 handlers.get('notificationclick')({notification:{data:{href:'https://outside.invalid'},close:()=>closed++},waitUntil:p=>waited=p});await waited;assert.equal(closed,1);assert.deepEqual(opened,[base+'/notifications']);return{shown:shown.length,opened};
}
