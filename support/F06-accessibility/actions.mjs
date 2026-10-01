import assert from 'node:assert/strict';import {assertPersistence} from './oracles.mjs';
export async function preferencesPersistence({page,h,record}){
 const api='/api/notifications/preferences';await page.goto(h.base+'/settings/notifications');await page.waitForLoadState('networkidle');
 const before=await h.request(h.A,api),foreignBefore=await h.request(h.B,api);assert.equal(before.status,200);assert.equal(foreignBefore.status,200);
 const channel=before.data.data.channels.find(c=>c.id==='inapp');assert.ok(channel,'INAPP_CHANNEL');
 const box=page.getByLabel('Activar '+channel.label,{exact:true}),desired=!(await box.isChecked());
 assert.equal(await box.isChecked(),!desired);const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===api&&r.request().method()==='POST'),box.click()]);assert.equal(response.status(),200,'PREFERENCE_POST_FAILED');
 const posted=response.request().postDataJSON();assert.equal(posted.channel,'inapp');assert.equal(posted.eventType,'*');assert.equal(posted.enabled,desired);
 await page.getByRole('status').filter({hasText:'Preferencias guardadas y verificadas.'}).waitFor();
 assert.equal(await box.isChecked(),desired);const reread=await h.request(h.A,api);assert.equal(reread.status,200);const stored=reread.data.data.preferences.find(p=>p.channel==='inapp'&&p.eventType==='*');assert.equal(stored.enabled,desired);assert.equal(stored.version,posted.expectedVersion+1);
 assert.deepEqual((await h.request(h.B,api)).data.data,foreignBefore.data.data,'PREFERENCE_CROSS_TENANT_WRITE');
 await page.reload();await page.waitForLoadState('networkidle');assert.equal(await box.isChecked(),desired);
 record({family:'preferences',method:'POST',status:200,posted,stored,foreignUnchanged:true,reloaded:true});
 // Restore only this actor's own preference with current CAS; no notification producer effects.
 const restored=await h.request(h.A,api,{channel:'inapp',eventType:'*',enabled:!desired,expectedVersion:stored.version});assert.equal(restored.status,200);
}
export async function briefPersistence({page,h,f,query,record}){
 await page.goto(h.base+'/briefs?'+query);const form=page.getByRole('form',{name:'Generar brief',exact:true});await form.waitFor();
 const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/briefs'&&r.request().method()==='POST'),form.getByRole('button',{name:'Generar versión',exact:true}).click()]);assert.equal(response.status(),200,'BRIEF_UI_POST_FAILED');const posted=(await response.json()).data;
 await page.getByRole('status').filter({hasText:'Brief guardado y verificado.'}).waitFor();
 const persisted=await f.ok(h.request(h.A,'/api/briefs/'+posted.id));assert.equal(persisted.contentHash,posted.contentHash);assert.deepEqual(persisted.document,posted.document);const foreignStatus=(await h.request(h.B,'/api/briefs/'+posted.id)).status;assertPersistence({method:response.request().method(),status:response.status(),posted:{id:posted.id,contentHash:posted.contentHash},stored:{id:persisted.id,contentHash:persisted.contentHash},foreignStatus});
 await page.reload();await page.getByRole('button',{name:'Abrir versión '+posted.version,exact:true}).click();await page.getByRole('article',{name:'Brief versión '+posted.version,exact:true}).waitFor();
 record({family:'brief-generation',method:'POST',status:200,id:posted.id,contentHash:posted.contentHash,persisted:true,foreignStatus:404,reloaded:true});return posted;
}
