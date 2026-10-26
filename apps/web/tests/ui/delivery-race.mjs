// Fixture-only regression: a delayed silent GET must not undo a verified save.
// VEXA_UI_BASE=http://localhost:PORT VEXA_PW_PACKAGE=/path/package.json node tests/ui/delivery-race.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {respond} from './fixtures.mjs';
const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const base=process.env.VEXA_UI_BASE??'http://localhost:3290';
const browser=await chromium.launch();
try{
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/api/**',async route=>{const req=route.request(),r=await respond(req.url(),req.method(),req.postData());return r?route.fulfill({status:r[0],contentType:'application/json',body:JSON.stringify(r[1])}):route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"fixture_missing"}}'});});
 await context.addInitScript(()=>{
  const original=window.fetch.bind(window);
  let rows=['inapp','email','push'].map(channel=>({channel,enabled:false,version:1,intervalMs:60000,digestWindowMs:0,maxAttempts:3,lifetimeMs:86400000}));
  const response=data=>new Response(JSON.stringify({data}),{status:200,headers:{'Content-Type':'application/json'}});
  const harness={delay:false,started:false,release:null,saved:0};window.deliveryRace=harness;
  window.fetch=(input,init)=>{
   const url=new URL(typeof input==='string'?input:input.url,location.href);
   if(url.pathname!=='/api/notifications/delivery')return original(input,init);
   if(init?.method==='POST'){
    const {expectedVersion,...body}=JSON.parse(init.body),prior=rows.find(r=>r.channel===body.channel);
    if(expectedVersion!==prior.version)return Promise.resolve(new Response('{}',{status:409}));
    const saved={...body,version:prior.version+1};rows=rows.map(r=>r.channel===body.channel?saved:r);harness.saved++;
    return Promise.resolve(response({version:saved.version}));
   }
   if(harness.delay){harness.delay=false;harness.started=true;const old=structuredClone(rows);
    // Deliberately ignore abort: an already-delivered response body can finish
    // after cancellation. The generation check must also reject stale results.
    return new Promise(resolve=>{harness.release=()=>resolve(response(old));});
   }
   return Promise.resolve(response(rows));
  };
 });
 const page=await context.newPage();
 await page.goto(base+'/settings/notification-delivery',{waitUntil:'networkidle',timeout:120000});
 const checkbox=page.locator('#delivery-policy-email input[type=checkbox]');
 await checkbox.waitFor({state:'visible'});assert.equal(await checkbox.isChecked(),false);
 await page.evaluate(()=>{window.deliveryRace.delay=true;window.dispatchEvent(new Event('vexa:refresh'));});
 await page.waitForFunction(()=>window.deliveryRace.started);
 await checkbox.check();
 await page.getByRole('button',{name:'Guardar Correo electrónico',exact:true}).click();
 await page.getByRole('button',{name:'Confirmar guardado',exact:true}).click();
 await page.getByText('Política guardada y verificada.',{exact:false}).waitFor();
 assert.equal(await checkbox.isChecked(),true);
 await page.evaluate(async()=>{window.deliveryRace.release();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 assert.equal(await checkbox.isChecked(),true,'GET antiguo sobrescribió la política guardada');
 assert.equal(await page.evaluate(()=>window.deliveryRace.saved),1,'exactamente un guardado');
 await context.close();
 console.log('delivery-race: PASS (GET antiguo ignorado tras guardado verificado)');
}finally{await browser.close();}
