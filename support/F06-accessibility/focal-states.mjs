import assert from 'node:assert/strict';
/** Four historical388 loading captures did not assert a visible loading signal.
 * Hold the actual GET, assert its exact UI status, release it, and require HTTP200 recovery.
 * Reuses caller's page and h; no build/server/database or synthetic business response. */
export async function missingLoadingStates({page,h,query,brief,record}){
 const rows=[['/recommendations','/api/recommendations','Verificando recomendaciones…'],['/interventions','/api/interventions','Verificando intervenciones…'],['/explorer','/api/explorer','Verificando consulta…'],['/briefs/[id]','/api/briefs/'+brief.id,'Verificando brief…']];
 for(const[route,api,label]of rows){
  let release,seen,timer;const held=new Promise(r=>release=r),started=new Promise(r=>seen=r);
  const pattern='**'+api+'*';const intercept=async r=>{if(r.request().method()!=='GET'||new URL(r.request().url()).pathname!==api)return r.continue();seen();await held;return r.continue();};
  await page.route(pattern,intercept);
  try{
   const url=route==='/briefs/[id]'?'/briefs/'+brief.id:route;
   await page.goto(h.base+url+(route==='/briefs/[id]'?'':'?'+query));
   await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('F0607_PENDING_GET_NOT_OBSERVED:'+route)),15000);})]);clearTimeout(timer);
   const status=page.locator('main').getByRole('status').filter({hasText:label});await status.waitFor();assert.equal(await status.innerText(),label);
   const resumed=page.waitForResponse(r=>new URL(r.url()).pathname===api&&r.request().method()==='GET');release();assert.equal((await resumed).status(),200,'F0607_LOADING_MUST_RECOVER_WITH_REAL_GET');await status.waitFor({state:'hidden'});
   assert.equal(await page.locator('main').getByRole('alert').count(),0);
   record({scenario:'pending-loading:'+route,route,state:'loading',status:'pass',kind:'held actual GET; no fabricated response',recoveryStatus:200});
  }finally{clearTimeout(timer);release();await page.unroute(pattern,intercept);}
 }
}
/** Fresh fixture has no delivered inbox rows; require real API data and visible empty state.
 * Never classify authorization failure as empty; do not erase notifications to manufacture it. */
export async function emptyInbox({page,h,record}){
 const response=await h.request(h.A,'/api/notifications?status=unread');assert.equal(response.status,200);
 assert.ok(Array.isArray(response.data.data.items));assert.equal(response.data.data.items.length,0,'F0607_FIXTURE_EXPECTS_EMPTY_INBOX_BEFORE_DELIVERY');assert.equal(response.data.data.unreadCount,0);
 await page.goto(h.base+'/notifications');await page.locator('main').getByText('No hay avisos sin leer disponibles.',{exact:true}).waitFor();assert.equal(await page.locator('main').getByRole('alert').count(),0);
 record({scenario:'empty-inbox-real',route:'/notifications',state:'empty',status:'pass',http:200,items:0,unreadCount:0});
}

export function hasPassedState(checks,route,state,scenario){return checks.some(c=>c.status==='pass'&&c.route===route&&c.state===state&&(c.scenario===undefined||c.scenario===scenario));}
