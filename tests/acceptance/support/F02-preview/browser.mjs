// Independent browser assertions for a REAL authenticated Next /imports page.
// Takes a Playwright Page from a control-owned real Auth session, never candidate JSON.
// No fake HTML mount, mocked response, product component import or pass report.
import assert from 'node:assert/strict';
import {csv} from './fixtures.mjs';
export async function keyboard(page,control){
 await page.evaluate(()=>document.activeElement?.blur());let reached=false;
 for(let i=0;i<80;i++){await page.keyboard.press('Tab');if(await control.evaluate(e=>document.activeElement===e)){reached=true;break;}}
 assert.ok(reached,'UI_TAB_REACHABLE');assert.ok(await control.evaluate(e=>{const s=getComputedStyle(e);return(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none';}),'UI_FOCUS_VISIBLE');
}
export async function browserExam(page,{base,storageOrigin,connectionId}){
 assert.equal(new URL(base).hostname,'127.0.0.1','REAL_LOCAL_NEXT');
 const requests=[];const forbidden=[];
 const guard=async route=>{const u=new URL(route.request().url());if([base,storageOrigin].includes(u.origin))return route.continue();forbidden.push(u.origin);return route.abort();};
 await page.route('**/*',guard);page.on('request',r=>requests.push({method:r.method(),url:r.url(),body:r.postData()}));
 try{
  const response=await page.goto(base+'/imports');assert.equal(response.status(),200,'UI_AUTHENTICATED_PAGE');
  assert.equal(await page.getByRole('navigation',{name:'Espacio de trabajo'}).count(),1,'REAL_WORKSPACE');
  const nav=page.getByRole('link',{name:/import/i});assert.ok(await nav.count()>0,'IMPORTS_NAV_LINK');
  await page.getByLabel(/conexi[oó]n/i).selectOption(connectionId);
  await page.locator('input[type=file]').setInputFiles({name:'SYNTHETIC-preview.csv',mimeType:'text/csv',buffer:csv()});
  const uploaded=page.waitForResponse(r=>r.request().method()==='GET'&&/\/api\/imports\/[^/]+$/.test(new URL(r.url()).pathname));
  await page.getByRole('button',{name:'Reservar y subir archivo'}).click();assert.equal((await uploaded).status(),200,'UI_UPLOAD_DETAIL');
  const selector=label=>page.getByLabel(label);
  for(const [label,value] of [[/^Columna id/,'id'],[/^Columna text/,'text'],[/^Columna date/,'date'],[/^Columna amount/,'amount'],[/^Columna currency/,'currency']])await selector(label).selectOption(value);
  const zone=selector(/timezone|zona horaria/i);if(await zone.evaluate(e=>e.tagName)==='SELECT')await zone.selectOption('UTC');else await zone.fill('UTC');
  await selector(/formato.*fecha/i).selectOption('iso');
  const preview=page.getByRole('button',{name:/preview|previsualizar|vista previa/i});await keyboard(page,preview);
  const result=page.waitForResponse(r=>/\/api\/imports\/[^/]+\/preview$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');
  await page.keyboard.press('Enter');assert.equal((await result).status(),200,'UI_PREVIEW_HTTP');
  assert.ok(requests.some(r=>r.method==='PUT'&&new URL(r.url).origin===storageOrigin),'UI_DIRECT_STORAGE');
  assert.ok(requests.filter(r=>r.method==='POST'&&new URL(r.url).pathname==='/api/imports').every(r=>!r.body?.includes('SYNTHETIC <img')),'NO_UPLOAD_PROXY');
  assert.equal(await page.locator('img[src="x"]').count(),0,'TEXT_NOT_HTML');assert.match(await page.locator('body').innerText(),/SYNTHETIC <img/,'TEXT_VISIBLE');
  assert.equal(requests.filter(r=>r.url.endsWith('/confirm')).length,0,'NO_IMPLICIT_CONFIRM');
  const save=page.getByRole('button',{name:/guardar.*mapping|guardar.*mapeo|guardar.*configuraci[oó]n/i});await keyboard(page,save);
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/mapping')&&r.request().method()==='POST');await page.keyboard.press('Enter');assert.equal((await saved).status(),200,'UI_MAPPING_HTTP');
  const download=page.waitForEvent('download');await page.getByRole('link',{name:/Descargar errores CSV/}).click();const file=await download;assert.equal(await file.failure(),null,'CSV_DOWNLOAD');
  const confirm=page.getByRole('button',{name:'Confirmar envío a cola'});await keyboard(page,confirm);
  const queued=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/confirm'));await page.keyboard.press('Enter');const accepted=await queued;assert.equal(accepted.status(),202,'UI_CONFIRM');const data=(await accepted.json()).data;assert.equal(data.state,'queued','UI_QUEUED_NOT_COMPLETED');
  assert.match(await page.locator('body').innerText(),/queued|en cola|pendiente/i,'UI_QUEUED_VISIBLE');assert.doesNotMatch(await page.locator('body').innerText(),/an[aá]lisis completado|importaci[oó]n completada/i,'UI_NO_FALSE_SUCCESS');
  const confirms=requests.filter(r=>r.url.endsWith('/confirm')).length;await page.reload();assert.equal(requests.filter(r=>r.url.endsWith('/confirm')).length,confirms,'RELOAD_NO_NEW_CONFIRM');
  for(const width of [390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'UI_NO_OVERFLOW');}
  assert.deepEqual(forbidden,[],'NO_EXTERNAL_NETWORK');
 }finally{await page.unroute('**/*',guard);}
}
// Invoked only by an external real Auth/Pg/Storage + Next lifecycle. Pending wiring
// is deliberately NOT converted to skip/pass in the acceptance entrypoint.
export async function statusExam(page,{base,revoke,restore}){
 const alert=()=>page.locator('[role=alert]:not(#__next-route-announcer__)');
 await page.route('**/api/imports**',route=>route.abort('failed'));
 try{await page.goto(base+'/imports');await alert().first().waitFor();assert.match(await alert().first().innerText(),/error|fall[oó]|no.*disponible/i,'UI_ERROR_NOT_EMPTY');const retry=page.getByRole('button',{name:/reintentar|retry/i});await keyboard(page,retry);}finally{await page.unroute('**/api/imports**');}
 await revoke();try{await page.reload();assert.ok([401,403].includes((await page.goto(base+'/imports')).status())||new URL(page.url()).pathname==='/login'||await alert().count()>0,'UI_REVOCATION');}finally{await restore();}
}
