import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
export async function pushWorkerReady({browser,base,evidence,cookie}){
const context=await browser.newContext();if(cookie)await context.addCookies(cookie.split('; ').map(value=>{const i=value.indexOf('=');return{name:value.slice(0,i),value:value.slice(i+1),url:base};}));const page=await context.newPage();let posts=0;
await page.addInitScript(()=>{
window.__pushCalls={subscribe:0};Object.defineProperty(window,'Notification',{value:{permission:'granted',requestPermission:async()=>'granted'}});
const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>{window.__pushCalls.subscribe++;throw Error('unexpected');}}};
Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:new Promise(()=>{})}});
});
await page.route('**/api/notifications/push',async route=>{if(route.request().method()==='POST')posts++;await route.fulfill({json:{data:{devices:[],configured:true,observedAt:Date.now(),publicKey:'B'+'A'.repeat(86),currentDeviceId:null}}});});
let result;
try{await page.goto(base+'/notifications/push');await page.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true}).click();await page.waitForTimeout(16000);const busy=await page.locator('section[aria-labelledby="push-title"]').getAttribute('aria-busy');result={busy,posts,calls:await page.evaluate(()=>window.__pushCalls)};assert.equal(busy,'false','STALLED_SERVICE_WORKER_READY_MUST_RELEASE_BUSY');assert.equal(posts,0);assert.equal(result.calls.subscribe,0);assert.equal(await page.getByRole('button',{name:'Actualizar estado',exact:true}).isEnabled(),true);await page.getByText(/No se confirmó la activación/).waitFor();result.pass=true;}catch(e){result={...result,pass:false,error:e.message};throw e;}finally{fs.writeFileSync(path.join(evidence,'ui-ready.json'),JSON.stringify(result,null,2));await context.close();}
}
