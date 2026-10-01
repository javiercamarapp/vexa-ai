import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
/** Run on the existing isolated Next/browser harness; synthetic API only in these UI states. */
export async function policyUiStates({browser,base,cookie,evidence}){
 fs.mkdirSync(evidence,{recursive:true});const results=[];
 for(const scenario of ['success','cancel','load-timeout','post-timeout','post-uncertain','refresh-failed','duplicates','forbidden']){
  const context=await browser.newContext({viewport:{width:390,height:844}});context.setDefaultTimeout(20000);
  if(cookie)await context.addCookies(cookie.split('; ').map(x=>{const i=x.indexOf('=');return{name:x.slice(0,i),value:x.slice(i+1),url:base};}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let reads=0,posts=0;let stored=false;
  const rows=()=>['inapp','email','push'].map(channel=>({channel,version:stored&&channel==='email'?2:1,enabled:stored&&channel==='email',intervalMs:60000,digestWindowMs:0,maxAttempts:3,lifetimeMs:86400000}));
  await page.route('**/api/notifications/delivery',async route=>{
   if(route.request().method()==='POST'){posts++;const body=route.request().postDataJSON();assert.equal(body.channel,'email');assert.equal(body.enabled,true);assert.equal(body.expectedVersion,1);stored=true;
    if(scenario==='post-timeout')return;
    if(scenario==='post-uncertain'){await route.abort('failed');return;}
    await route.fulfill({json:{data:{channel:'email',version:2}}});return;
   }
   reads++;if(scenario==='load-timeout'&&reads===1)return;
   if(scenario==='forbidden'||(scenario==='refresh-failed'&&reads===2)){await route.fulfill({status:403,json:{error:{message:'SYN PRIVATE RAW ERROR'}}});return;}
   await route.fulfill({json:{data:scenario==='duplicates'?[rows()[0],rows()[0],rows()[0]]:rows()}});
  });
  try{
   await page.goto(base+'/settings/notification-delivery');const panel=page.getByRole('region',{name:'Política de envío',exact:true}),update=panel.getByRole('button',{name:'Actualizar políticas',exact:true});await update.waitFor();
   if(['load-timeout','duplicates','forbidden'].includes(scenario)){
    await panel.getByRole('alert').waitFor();assert.equal(await update.isEnabled(),true);assert.equal(await panel.getByRole('button',{name:'Guardar Correo electrónico',exact:true}).count(),0);assert.equal(posts,0);
    if(scenario==='load-timeout'){await update.click();await panel.getByRole('button',{name:'Guardar Correo electrónico',exact:true}).waitFor();}
   }else{
    const form=page.locator('#delivery-policy-email');await form.getByLabel('Autorizar este canal').check();await form.getByRole('button',{name:'Guardar Correo electrónico',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'¿Guardar la política de Correo electrónico?'});await dialog.waitFor();assert.equal(posts,0);
    if(scenario==='cancel'){await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(posts,0);await form.getByRole('button',{name:'Guardar Correo electrónico',exact:true}).click();await page.keyboard.press('Escape');assert.equal(posts,0);}
    else{await dialog.getByRole('button',{name:'Confirmar guardado',exact:true}).click();
     if(scenario==='success'){await panel.getByRole('status').filter({hasText:'Política guardada y verificada'}).waitFor();assert.equal(await form.getByLabel('Autorizar este canal').isChecked(),true);}
     else{await panel.getByRole('alert').waitFor();assert.match(await panel.getByRole('alert').innerText(),/No se confirmó el guardado/);assert.equal(await panel.getByRole('button',{name:'Guardar Correo electrónico',exact:true}).count(),0);assert.equal(posts,1);await update.click();await form.getByRole('button',{name:'Guardar Correo electrónico',exact:true}).waitFor();assert.equal(await form.getByLabel('Autorizar este canal').isChecked(),true);assert.equal(posts,1,'UNCERTAIN_POST_MUST_ONLY_RECONCILE_WITH_GET');}
    }
   }
   assert.deepEqual(errors,[]);assert.equal((await page.locator('body').innerText()).includes('SYN PRIVATE RAW ERROR'),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(evidence,scenario+'-390.png'),fullPage:true});if(scenario==='success'){await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(evidence,scenario+'-1440.png'),fullPage:true});}
   results.push({scenario,passed:true,reads,posts});
  }catch(error){results.push({scenario,passed:false,error:error.message});throw error;}finally{await context.close();fs.writeFileSync(path.join(evidence,'policy-ui.json'),JSON.stringify(results,null,2));}
 }
 return results;
}
