import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
export async function browserOptIn(h,subscription,evidence){
 const browser=await h.browser(),context=await browser.newContext({permissions:['notifications']});context.setDefaultTimeout(15000);
 await context.addCookies(h.cookie(h.A).split('; ').map(value=>{const i=value.indexOf('=');return{name:value.slice(0,i),value:value.slice(i+1),url:h.base};}));
 // Browser-issued subscription is synthetic, to avoid registering with Google's external push service.
 // Actual page, permission API, service worker, authenticated HTTP and PostgreSQL remain real.
 await context.addInitScript(({subscription})=>{
  window.__pushCalls={permission:0,subscribe:0,unsubscribe:0};let active=null;
  const permission=Notification.requestPermission.bind(Notification);
  Notification.requestPermission=()=>{window.__pushCalls.permission++;return permission();};
  Object.defineProperty(PushManager.prototype,'getSubscription',{value:async()=>active});
  Object.defineProperty(PushManager.prototype,'subscribe',{value:async options=>{window.__pushCalls.subscribe++;active={options,toJSON:()=>subscription,unsubscribe:async()=>{window.__pushCalls.unsubscribe++;active=null;return true;}};return active;}});
 },{subscription});
 const page=await context.newPage();await page.goto(h.base+'/notifications/push');
 const enable=page.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true});await enable.waitFor();await assert.doesNotReject(()=>enable.waitFor({state:'visible'}));
 await page.waitForFunction(()=>!document.querySelector('button')?.disabled);assert.deepEqual(await page.evaluate(()=>window.__pushCalls),{permission:0,subscribe:0,unsubscribe:0});
 assert.equal(h.sql('SELECT count(*) FROM push_subscriptions'),'0');
 await enable.click();await page.getByRole('status').filter({hasText:'Dispositivo registrado'}).waitFor();assert.match(await page.getByRole('status').innerText(),/no confirma una entrega/i);
 assert.deepEqual(await page.evaluate(()=>window.__pushCalls),{permission:1,subscribe:1,unsubscribe:0});
 const worker=await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;return{scope:r.scope,script:r.active?.scriptURL};});assert.equal(worker.scope,h.base+'/');assert.equal(worker.script,h.base+'/service-worker.js');
 assert.equal(h.sql('SELECT count(*) FROM push_subscriptions WHERE status=\'active\''),'1');
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(evidence,'SYN-push-'+width+'.png'),fullPage:true});}
 fs.writeFileSync(path.join(evidence,'SYN-browser-optin.json'),JSON.stringify({worker,calls:await page.evaluate(()=>window.__pushCalls),externalPushService:'not contacted; synthetic browser subscription'}));
 return{page,context};
}
