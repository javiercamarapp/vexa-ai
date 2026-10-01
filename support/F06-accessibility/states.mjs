import assert from 'node:assert/strict';import {q} from '../F06-notifications/harness.mjs';
// Extracted from392 fourth: real response held for loading; real scoped revocation403 then recovery200.
export async function notificationStates({page,h,record}){
 for(const settings of [false,true]){
  const url=settings?'/settings/notifications':'/notifications',api=settings?'/api/notifications/preferences':'/api/notifications',heading=settings?'Preferencias de notificaciones':'Notificaciones',button=settings?'Actualizar preferencias':'Actualizar notificaciones';
  await page.goto(h.base+url);await page.waitForLoadState('networkidle');const panel=page.getByRole('region',{name:heading,exact:true});
  let release,seen,timer;const held=new Promise(r=>release=r),started=new Promise(r=>seen=r);
  // Hold the panel GET only; the header uses limit=1 and may cancel its own refresh.
  const pattern='**'+api+(settings?'':'?status=unread');
  const handlers=[];const intercept=route=>{const task=(async()=>{seen();await held;await route.continue();})();handlers.push(task);void task.catch(()=>{});return task;};await page.route(pattern,intercept);
  try{await panel.getByRole('button',{name:button,exact:true}).click();await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('LOADING_REQUEST_NOT_OBSERVED')),15000);})]);await panel.getByText(settings?'Verificando preferencias…':'Verificando notificaciones…',{exact:true}).waitFor();assert.equal(await panel.locator('fieldset,article').count(),0);record({scenario:'notificationStates:'+url+':loading',route:url,state:'loading',kind:'held_real_response',status:'pass'});}
  finally{clearTimeout(timer);release();let outcomes;try{outcomes=await Promise.allSettled(handlers);}finally{await page.unroute(pattern,intercept);}const errors=outcomes.filter(x=>x.status==='rejected').map(x=>x.reason);if(errors.length)throw new AggregateError(errors,'NOTIFICATION_HELD_REQUEST_FAILED');}
  await page.waitForLoadState('networkidle');h.sql(`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);
  try{const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===api),panel.getByRole('button',{name:button,exact:true}).click()]);assert.equal(response.status(),403);await panel.getByRole('alert').waitFor();assert.equal(await panel.locator('fieldset,article').count(),0);assert.equal(await panel.getByText('No hay avisos sin leer disponibles.',{exact:true}).count(),0);record({scenario:'notificationStates:'+url+':error',route:url,state:'error',http:403,status:'pass'});}
  finally{h.sql(`UPDATE memberships SET status='active' WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.A.id)}`);}
  const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===api),panel.getByRole('button',{name:button,exact:true}).click()]);assert.equal(response.status(),200);await page.waitForLoadState('networkidle');assert.equal(await panel.getByRole('alert').count(),0);const empty=!settings&&await panel.getByText('No hay avisos sin leer disponibles.',{exact:true}).isVisible();record({scenario:'notificationStates:'+url+':recovery',route:url,state:empty?'empty':'ready',recovery:200,status:'pass'});
 }
}
