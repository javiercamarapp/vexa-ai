// SYN: real application, Auth/SQL fixtures and browser. No replacement DOM or navigation mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setup} from '../F06-notifications/harness.mjs';
import {seedNotifications} from '../F06-notifications/fixtures.mjs';
const deadline=15000;
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});return{promise,resolve,reject};}
async function within(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('NAVIGATION_BARRIER:'+label)),deadline);})]);}finally{clearTimeout(timer);}}
const turns=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

test('pending workspace responses preserve real navigation and ordinary link behavior',{timeout:480000},async t=>{
 const candidate=process.env.VEXA_CANDIDATE;assert.ok(candidate,'CANDIDATE_REQUIRED');
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-navigation-race-'));fs.chmodSync(evidence,0o700);console.log('F0608_RUNNING:'+evidence);
 let h;const outcomes=[],releaseAll=[];
 try{
  h=await setup(candidate,evidence);const f=await seedNotifications(h),browser=await h.browser();
  const startQuery=new URLSearchParams(f.query);startQuery.delete('scope_hash');
  const start=h.base+'/overview?'+startQuery;
  const expected={snapshot:f.query.get('snapshot_id'),scope:f.query.get('scope_hash')};assert.ok(expected.snapshot&&expected.scope);
  async function scenario(name,fn){await t.test(name,async()=>{
   const ctx=await browser.newContext({timezoneId:'America/Merida'});ctx.setDefaultTimeout(deadline);ctx.setDefaultNavigationTimeout(deadline);
   await ctx.addCookies(h.cookie(h.A).split('; ').map(value=>{const i=value.indexOf('=');return{name:value.slice(0,i),value:value.slice(i+1),url:h.base};}));
   const page=await ctx.newPage();h.ctx=ctx;h.p=page;const events=[];let jsonDone=deferred(),failure;
   const record=value=>{events.push({receivedAt:Date.now(),...value});};
   page.on('console',message=>{if(message.text().startsWith('SYN_NAV:')){const row=JSON.parse(message.text().slice(8));record(row);if(row.kind==='workspace-json')jsonDone.resolve('consumed');}});
   page.on('pageerror',error=>record({kind:'pageerror',message:error.message}));
   page.on('request',request=>{if(new URL(request.url()).origin===h.base)record({kind:'request',pathname:new URL(request.url()).pathname});});
   page.on('requestfinished',request=>record({kind:'requestfinished',pathname:new URL(request.url()).pathname}));
   page.on('requestfailed',request=>record({kind:'requestfailed',pathname:new URL(request.url()).pathname,error:request.failure()?.errorText}));
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())record({kind:'framenavigated',pathname:new URL(frame.url()).pathname});});
   await page.addInitScript(()=>{
    const record=value=>console.debug('SYN_NAV:'+JSON.stringify({at:Date.now(),pathname:location.pathname,...value}));
    for(const name of ['pushState','replaceState']){const original=history[name];history[name]=function(...args){record({kind:name,target:args[2]===undefined?null:new URL(String(args[2]),location.href).pathname});return original.apply(this,args);};}
    document.addEventListener('click',event=>{const a=event.target instanceof Element?event.target.closest('a'):null;if(a)record({kind:'click',target:new URL(a.href,location.href).pathname,hash:new URL(a.href,location.href).hash,ctrl:event.ctrlKey,meta:event.metaKey,trusted:event.isTrusted});},true);
    const original=window.fetch;window.fetch=async function(...args){const response=await original.apply(this,args);const input=args[0],url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.pathname==='/api/workspace'){const json=response.json.bind(response);response.json=async()=>{const value=await json();record({kind:'workspace-json'});return value;};}return response;};
   });
   const pending=[];
   async function holdWorkspace(){
    jsonDone=deferred();
    const ready=deferred(),gate=deferred(),terminal=deferred(),aborted=deferred(),done=deferred();let captured,once=false,abortSeen=false;const errors=[];
    releaseAll.push(gate.resolve);
    page.on('requestfinished',request=>{if(request===captured)terminal.resolve('finished');});
    page.on('requestfailed',request=>{if(request===captured){const reason=request.failure()?.errorText;if(!/ERR_ABORTED/.test(reason??'')){const error=Error('WORKSPACE_FAILED:'+reason);terminal.reject(error);aborted.reject(error);}else{abortSeen=true;record({kind:'workspace-aborted'});terminal.resolve('aborted');aborted.resolve('aborted');}}});
    const matcher=url=>url.pathname==='/api/workspace';
    await page.route(matcher,async intercepted=>{
     if(once){await intercepted.continue();return;}once=true;captured=intercepted.request();
     try{const response=await intercepted.fetch({timeout:deadline});assert.equal(response.status(),200,'REAL_WORKSPACE_RESPONSE');const body=await response.body();assert.ok(JSON.parse(body).data.meta.snapshot_id);record({kind:'workspace-held'});ready.resolve();await gate.promise;
      try{await intercepted.fulfill({status:200,headers:response.headers(),body});record({kind:'workspace-released'});}catch(error){if(!abortSeen)throw error;record({kind:'workspace-release-after-abort'});}
     }catch(error){errors.push(error.message);ready.reject(error);terminal.reject(error);}finally{done.resolve();}
    });
    const control={ready:ready.promise,release:gate.resolve,async settle(){await within(terminal.promise,'workspace-terminal');const outcome=await within(Promise.race([jsonDone.promise,aborted.promise]),'workspace-consumed-or-aborted');await within(done.promise,'workspace-route-complete');await turns(page);assert.deepEqual(errors,[]);return outcome;},async close(){gate.resolve();await within(done.promise,'workspace-close');await page.unroute(matcher);}};
    pending.push(control.close);return control;
   }
   async function holdNavigation(){
    const gate=deferred(),seen=deferred(),requests=[],errors=[];releaseAll.push(gate.resolve);const matcher=url=>url.pathname==='/notifications';
    await page.route(matcher,intercepted=>{const task=(async()=>{try{record({kind:'navigation-held'});seen.resolve();const response=await intercepted.fetch({timeout:deadline});assert.equal(response.status(),200,'REAL_NAVIGATION_RESPONSE');await gate.promise;try{await intercepted.fulfill({response});record({kind:'navigation-released'});}catch(error){record({kind:'navigation-prefetch-cancelled',message:error.message});}}catch(error){errors.push(error.message);seen.reject(error);}})();requests.push(task);return task;});
    const close=async()=>{gate.resolve();await within(Promise.all(requests),'navigation-routes-complete');await page.unroute(matcher);assert.deepEqual(errors,[]);};pending.push(close);return{seen:seen.promise,release:gate.resolve,close};
   }
   const pins=()=>{const url=new URL(page.url());assert.equal(url.origin,h.base);assert.equal(url.pathname,'/overview');assert.equal(url.searchParams.get('snapshot_id'),expected.snapshot);assert.equal(url.searchParams.get('scope_hash'),expected.scope);};
   const table=()=>page.getByRole('region',{name:'Resumen con alcance compartido',exact:true}).getByRole('table');
   try{await fn({ctx,page,holdWorkspace,holdNavigation,pins,table,record});assert.equal(events.filter(row=>row.kind==='pageerror').length,0,'BROWSER_PAGE_ERRORS');outcomes.push({name,pass:true});}
   catch(error){failure=error;outcomes.push({name,pass:false,error:error.message});throw error;}
   finally{
    let cleanupError;for(const release of releaseAll)release();for(const close of pending)try{await close();}catch(error){cleanupError??=error;}
    try{fs.writeFileSync(path.join(evidence,name+'.dom.html'),await page.content());fs.writeFileSync(path.join(evidence,name+'.url.txt'),page.url());await page.screenshot({path:path.join(evidence,name+'.png')});}catch{}
    fs.writeFileSync(path.join(evidence,name+'.trace.json'),JSON.stringify(events,null,2));try{await ctx.close();}catch(error){cleanupError??=error;}if(cleanupError){Object.assign(outcomes.at(-1),{pass:false,cleanupError:cleanupError.message});if(!failure)throw cleanupError;}
   }
  });}
  for(const via of ['bell','sidebar','bell-pinned'])await scenario(via,async({page,holdWorkspace,holdNavigation,pins,table,record})=>{
   let destination=start;if(via==='bell-pinned'){await page.goto(start);await table().waitFor();pins();destination=page.url();record({kind:'precondition-fully-pinned'});}const workspace=await holdWorkspace(),navigation=await holdNavigation();await page.goto(destination);await within(workspace.ready,'workspace-ready');
   if(via==='sidebar'){const nav=page.getByRole('navigation',{name:'Navegación principal',exact:true});await nav.getByRole('button',{name:'Administración',exact:true}).click();await nav.getByRole('link',{name:'Notificaciones',exact:true}).click();}
   else await page.getByRole('link',{name:'Notificaciones',exact:true}).click();
   await within(navigation.seen,'navigation-request');workspace.release();const terminal=await workspace.settle();record({kind:'navigation-release-after-workspace-terminal',terminal});navigation.release();
   await page.waitForURL(url=>url.origin===h.base&&url.pathname==='/notifications',{timeout:deadline});await page.getByRole('region',{name:'Notificaciones',exact:true}).getByRole('list',{name:'Avisos disponibles',exact:true}).waitFor();assert.equal(await table().count(),0,'OLD_FINANCIAL_CONTENT_REMOVED');
   await navigation.close();await workspace.close();await page.goBack({waitUntil:'domcontentloaded',timeout:deadline});await table().waitFor();pins();assert.match(await table().innerText(),/300[.,]00 USD/);
  });
  await scenario('modified',async({ctx,page,holdWorkspace,pins,table})=>{
   const workspace=await holdWorkspace();await page.goto(start);await within(workspace.ready,'workspace-ready');const platform=await page.evaluate(()=>navigator.platform),modifier=/Mac/.test(platform)?'Meta':'Control';
   const opened=ctx.waitForEvent('page',{timeout:deadline});await page.getByRole('link',{name:'Notificaciones',exact:true}).click({modifiers:[modifier]});const popup=await opened;
   try{await popup.waitForURL(url=>url.origin===h.base&&url.pathname==='/notifications',{timeout:deadline});await popup.getByRole('list',{name:'Avisos disponibles',exact:true}).waitFor();workspace.release();assert.equal(await workspace.settle(),'consumed','MODIFIED_CLICK_MUST_NOT_ABORT_ORIGINAL');await table().waitFor();pins();}finally{await popup.close();}
  });
  await scenario('hash',async({page,holdWorkspace,pins,table,record})=>{
   const workspace=await holdWorkspace();await page.goto(start);await within(workspace.ready,'workspace-ready');const skip=page.locator('a.workspace-skip');await skip.focus();await skip.press('Enter');assert.equal(new URL(page.url()).hash,'#workspace-contenido');workspace.release();record({kind:'hash-workspace-terminal',terminal:await workspace.settle()});await table().waitFor();pins();assert.equal(new URL(page.url()).hash,'#workspace-contenido','LATE_PIN_PRESERVES_HASH');
  });
  await scenario('download',async({page,pins,table})=>{
   await page.goto(start);await table().waitFor();pins();const before=page.url();const bytes=await h.browserDownload(page,()=>page.getByRole('region',{name:'Resumen con alcance compartido',exact:true}).getByRole('link',{name:'Exportar JSON',exact:true}).click());const data=JSON.parse(bytes.toString());assert.equal(data.meta.snapshot_id,expected.snapshot);assert.equal(data.meta.scope_hash,expected.scope);assert.equal(data.items.flatMap(item=>item.metrics).find(metric=>metric.kind==='exposure').known_subtotal,'30000');assert.equal(page.url(),before,'DOWNLOAD_MUST_NOT_NAVIGATE');await table().waitFor();
  });
  await scenario('rsc-fallback',async({page,holdWorkspace,pins,table,record})=>{
   let failedRsc=0;const matcher=url=>url.pathname==='/notifications';
   const failRsc=async intercepted=>{const request=intercepted.request();if(request.headers().rsc==='1'){failedRsc++;record({kind:'rsc-only-injected-failure',status:500});await intercepted.fulfill({status:500,contentType:'text/plain',body:'SYN unavailable RSC response'});}else await intercepted.continue();};
   await page.route(matcher,failRsc);const workspace=await holdWorkspace();
   try{
    await page.goto(start);await within(workspace.ready,'workspace-ready');
    const documentResponse=page.waitForResponse(response=>new URL(response.url()).origin===h.base&&new URL(response.url()).pathname==='/notifications'&&response.request().resourceType()==='document',{timeout:deadline});documentResponse.catch(()=>{});
    await page.getByRole('link',{name:'Notificaciones',exact:true}).click();workspace.release();
    const response=await documentResponse;assert.equal(response.status(),200,'REAL_DOCUMENT_FALLBACK_200');assert.equal(response.request().isNavigationRequest(),true);assert.notEqual(response.request().headers().rsc,'1');
    await page.waitForURL(url=>url.origin===h.base&&url.pathname==='/notifications',{waitUntil:'domcontentloaded',timeout:deadline});await page.getByRole('region',{name:'Notificaciones',exact:true}).getByRole('list',{name:'Avisos disponibles',exact:true}).waitFor();
    record({kind:'fallback-workspace-terminal',terminal:await workspace.settle()});assert.ok(failedRsc>0,'RSC_FAILURE_REQUIRED');assert.equal(await table().count(),0,'OLD_FINANCIAL_CONTENT_REMOVED');record({kind:'document-fallback-confirmed',status:response.status(),failedRsc});
    await page.unroute(matcher,failRsc);await workspace.close();await page.goBack({waitUntil:'domcontentloaded',timeout:deadline});await table().waitFor();pins();assert.match(await table().innerText(),/300[.,]00 USD/);
   }finally{workspace.release();await page.unroute(matcher,failRsc);}
  });
 }finally{for(const release of releaseAll)release();fs.writeFileSync(path.join(evidence,'scenarios.json'),JSON.stringify({expected:7,outcomes},null,2));if(h)await h.close();console.log('F0608_EVIDENCE:'+evidence);}
});
