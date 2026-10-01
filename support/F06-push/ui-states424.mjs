import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
export async function pushUiStates({browser,base,evidence,baseline=false,cookie}){
 const results=[];
 const scenarios=baseline?['post-uncertain']:['unsupported','denied','unconfigured','load-timeout','post-uncertain','refresh-failed','revoke-failed','permission-dismiss','success'];
 for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width:390,height:844}});if(cookie)await context.addCookies(cookie.split('; ').map(value=>{const i=value.indexOf('=');return{name:value.slice(0,i),value:value.slice(i+1),url:base};}));const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let reads=0,posts=0;
  const key='B'+ 'A'.repeat(86),device={id:'11111111-1111-4111-8111-111111111111',deviceId:'22222222-2222-4222-8222-222222222222',status:'active',expiresAt:new Date(Date.now()+3600000).toISOString()};
  await context.addInitScript(({scenario,key})=>{
   window.__pushCalls={permission:0,subscribe:0,unsubscribe:0};
   if(scenario==='unsupported'){Object.defineProperty(window,'PushManager',{value:undefined});delete window.PushManager;return;}
   Object.defineProperty(window,'Notification',{value:{permission:scenario==='denied'?'denied':'default',requestPermission:async()=>{window.__pushCalls.permission++;return scenario==='permission-dismiss'?'default':'granted';}}});
   const subscription={options:{applicationServerKey:new Uint8Array(65)},toJSON:()=>({endpoint:'https://fixture.invalid/SYN',keys:{p256dh:'SYN',auth:'SYN'}}),unsubscribe:async()=>{window.__pushCalls.unsubscribe++;return true;}};
   const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>{window.__pushCalls.subscribe++;return subscription;}}};
   Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration),getRegistration:async()=>({...registration,pushManager:{getSubscription:async()=>subscription}})}});
  },{scenario,key});
  await page.route('**/api/notifications/push',async route=>{
   if(route.request().method()==='POST'){posts++;if(scenario==='post-uncertain'){await route.abort('failed');return;}if(scenario==='revoke-failed'){await route.fulfill({status:503,json:{error:{message:'SYN secret'}}});return;}await route.fulfill({json:{data:{...device}}});return;}
   reads++;if(scenario==='load-timeout'&&reads===1)return;
   if(scenario==='refresh-failed'&&reads===2){await route.fulfill({status:503,json:{error:{message:'SYN secret'}}});return;}
   await route.fulfill({json:{data:{observedAt:Date.now(),devices:posts||scenario==='revoke-failed'?[device]:[],configured:scenario!=='unconfigured',publicKey:key,currentDeviceId:device.deviceId}}});
  });
  try{
   await page.goto(base+'/notifications/push');const enable=page.getByRole('button',{name:'Activar avisos en este dispositivo',exact:true});await enable.waitFor();
   if(scenario==='load-timeout'){await page.getByText('No se pudo verificar el estado de los dispositivos.',{exact:false}).waitFor({timeout:18000});assert.equal(await page.locator('section[aria-labelledby="push-title"]').getAttribute('aria-busy'),'false');await page.getByRole('button',{name:'Actualizar estado',exact:true}).click();await enable.waitFor();await page.waitForFunction(()=>!document.querySelector('section[aria-labelledby="push-title"]')?.getAttribute('aria-busy')?.includes('true'));}
   else {await page.getByRole('button',{name:'Actualizar estado',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="push-title"]')?.getAttribute('aria-busy')==='false');}
   if(['unsupported','denied','unconfigured'].includes(scenario)){assert.equal(await enable.isDisabled(),true);assert.equal((await page.evaluate(()=>window.__pushCalls)).permission,0);}
   else if(scenario==='revoke-failed'){await page.getByRole('button',{name:'Desactivar',exact:true}).click();await page.getByText(/No se confirmó/).waitFor();assert.equal(await enable.isDisabled(),true);assert.equal((await page.evaluate(()=>window.__pushCalls)).unsubscribe,0);}
   else if(scenario!=='load-timeout'){
    await enable.click();if(scenario==='permission-dismiss'){await page.getByText(/Permiso no concedido/).waitFor();assert.equal((await page.evaluate(()=>window.__pushCalls)).subscribe,0);assert.equal(posts,0);}else if(baseline){await page.waitForFunction(()=>document.querySelector('section[aria-labelledby="push-title"]')?.getAttribute('aria-busy')==='false');assert.equal((await page.evaluate(()=>window.__pushCalls)).unsubscribe,0,'UNKNOWN_REGISTRATION_MUST_NOT_UNSUBSCRIBE');}if(scenario==='permission-dismiss'){}else if(scenario==='success'){await page.getByText(/Dispositivo registrado/).waitFor();}
    else{await page.getByText(scenario==='refresh-failed'?/No se pudo verificar el estado/:/No se confirmó/).waitFor();assert.equal(await enable.isDisabled(),true);const calls=await page.evaluate(()=>window.__pushCalls);assert.equal(calls.unsubscribe,0,'UNKNOWN_REGISTRATION_MUST_NOT_UNSUBSCRIBE');await page.getByRole('button',{name:'Actualizar estado',exact:true}).click();await page.getByText(/este navegador/).first().waitFor();assert.equal(posts,1,'NO_AUTOMATIC_MUTATION_RETRY');}
   }
   assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(evidence,scenario+'-390.png'),fullPage:true});
   if(scenario==='success'){await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(evidence,scenario+'-1440.png'),fullPage:true});}
   results.push({scenario,pass:true,reads,posts,calls:await page.evaluate(()=>window.__pushCalls)});
  }catch(e){results.push({scenario,pass:false,error:e.message,calls:await page.evaluate(()=>window.__pushCalls),text:await page.locator('body').innerText()});await page.screenshot({path:path.join(evidence,scenario+'-failure.png')});throw e;}finally{await context.close();fs.writeFileSync(path.join(evidence,'ui-states.json'),JSON.stringify(results,null,2));}
 }
 return results;
}
