import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup,q} from './harness.mjs';
const settled=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
test('F03 UI authorization revocation clears private state and rejects obsolete responses',{timeout:240000},async t=>{
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-crm-ui-regression-'));let h,ctx;const observed={};
 try{h=await setup(process.env.VEXA_CANDIDATE,evidence);
 const snapshot=await h.repository(h.A).comparison.capture({dateStart:'2026-09-01T00:00:00Z',dateEnd:'2026-10-01T00:00:00Z',timezone:'UTC',currency:'USD',dateBasis:'conversation',sources:[],channels:[]});
 assert.equal((await h.request(h.A,'/api/connections/settings',{source:'zendesk',accountId:'SYN-UI-REVOCATION',credentialRef:'syn-ui',historyFrom:'2026-01-01T00:00:00Z',enabled:true,overlapSeconds:60,pollSeconds:300})).status,201);
 ctx=await(await h.browser()).newContext();ctx.setDefaultTimeout(10000);await ctx.addCookies(h.cookie(h.A).split('; ').map(v=>{const n=v.indexOf('=');return{name:v.slice(0,n),value:v.slice(n+1),url:h.base};}));const p=await ctx.newPage();
 const membership=status=>h.sql(`UPDATE memberships SET status=${q(status)} WHERE user_id=${q(h.A.id)} AND tenant_id=${q(h.A.tenant)}`);
 const config=p.locator('section[aria-labelledby="connection-settings-title"]');
 await t.test('health GET403 hides rows and settings own POST403 destroys cached owner configuration',async()=>{
  try{await p.goto(h.base+'/connections');await p.getByRole('button',{name:'Editar SYN-UI-REVOCATION',exact:true}).click();membership('revoked');
   const health=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/connections');await p.getByRole('button',{name:'Actualizar conexiones',exact:true}).click();assert.equal((await health).status(),403);await p.getByText('No tienes acceso a las conexiones de esta organización.',{exact:true}).waitFor();assert.equal(await p.locator('article[aria-label]').count(),0);
   const post=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/connections/settings'&&r.request().method()==='POST');await p.getByRole('button',{name:'Guardar conexión',exact:true}).click();assert.equal((await post).status(),403);await config.getByRole('alert').waitFor();await settled(p);
   observed.settingsPrivateRows=await config.locator('article').count();observed.settingsOwnerForms=await config.locator('form').count();await p.screenshot({path:path.join(evidence,'settings403.png')});
   assert.equal(observed.settingsPrivateRows,0,'SETTINGS_403_MUST_ERASE_PRIVATE_ROWS');assert.equal(observed.settingsOwnerForms,0,'SETTINGS_403_MUST_ERASE_OWNER_FORM');assert.equal(await config.getByRole('button',{name:'Nueva conexión',exact:true}).count(),0);
  }finally{membership('active');}
 });
 await t.test('migration current403 beats older real200 and cannot repopulate a private snapshot',async()=>{
  let firstResolve,release,deliveredResolve;const first=new Promise(r=>firstResolve=r),held=new Promise(r=>release=r),delivered=new Promise(r=>deliveredResolve=r);let n=0;observed.migrationStatuses=[];
  await p.route('**/api/migrations',async route=>{const response=await route.fetch();const index=++n;observed.migrationStatuses.push(response.status());if(index===1){assert.equal(response.status(),200);firstResolve();await held;}await route.fulfill({response});if(index===1)deliveredResolve();});
  try{await p.goto(h.base+'/migrations');await first;membership('revoked');await p.getByRole('button',{name:'Actualizar cortes',exact:true}).click();await p.getByRole('heading',{name:'Comparación de migración',exact:true}).locator('..').locator('p[role=alert]').waitFor();release();await delivered;await settled(p);
   observed.migrationPrivateOptions=await p.getByLabel('Antes',{exact:true}).locator('option[value="'+snapshot.id+'"]').count();await p.screenshot({path:path.join(evidence,'migration403-late200.png')});assert.deepEqual(observed.migrationStatuses,[200,403]);assert.equal(observed.migrationPrivateOptions,0,'MIGRATION_OLD_200_MUST_NOT_REPOPULATE_AFTER_403');assert.equal(await p.getByLabel('Antes',{exact:true}).isDisabled(),true);assert.equal(await p.getByRole('region',{name:'Resultado de comparación'}).count(),0);
  }finally{release();await p.unroute('**/api/migrations');membership('active');}
 });
 await t.test('legitimate authorization recovery restores settings and comparison while later403 clears selections',async()=>{
  try{await p.goto(h.base+'/connections');await p.getByRole('button',{name:'Editar SYN-UI-REVOCATION',exact:true}).waitFor();assert.equal(await config.locator('article').count(),1);
   await p.goto(h.base+'/migrations');await p.getByLabel('Antes',{exact:true}).locator('option[value="'+snapshot.id+'"]').waitFor({state:'attached'});await p.getByLabel('Antes',{exact:true}).selectOption(snapshot.id);membership('revoked');const deny=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/migrations');await p.getByRole('button',{name:'Actualizar cortes',exact:true}).click();assert.equal((await deny).status(),403);await p.getByRole('heading',{name:'Comparación de migración',exact:true}).locator('..').locator('p[role=alert]').waitFor();await settled(p);assert.equal(await p.getByLabel('Antes',{exact:true}).inputValue(),'');assert.equal(await p.getByLabel('Antes',{exact:true}).locator('option').count(),1);
   membership('active');await p.getByRole('button',{name:'Actualizar cortes',exact:true}).click();await p.getByLabel('Antes',{exact:true}).locator('option[value="'+snapshot.id+'"]').waitFor({state:'attached'});assert.equal(await p.getByLabel('Antes',{exact:true}).isEnabled(),true);assert.equal(await p.getByRole('heading',{name:'Comparación de migración',exact:true}).locator('..').locator('p[role=alert]').count(),0);
  }finally{membership('active');}
 });
 h.verifySources();
 }finally{fs.writeFileSync(path.join(evidence,'observed.json'),JSON.stringify(observed,null,2),{mode:0o600});if(ctx)await ctx.close();if(h)await h.close();console.log('REVIEW232_UI:'+evidence);}
});
