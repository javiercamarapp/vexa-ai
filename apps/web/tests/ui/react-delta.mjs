// Servidor loopback ya iniciado con VEXA_UI_FIXTURES=1. No inicia servidores.
// VEXA_UI_BASE=http://localhost:3427 VEXA_PW_PACKAGE=/ruta/package.json node tests/ui/react-delta.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {respond} from './fixtures.mjs';
import {buildCfoReport,ledgerMonthlyFixture,exposureFixture,FIXTURE_WATERMARK,serializeReport} from '../../../../packages/cfo-copilot/src/index.mjs';
const cfoFixture={data:{status:'ok',synthetic:true,exposureStatus:'ok',report:serializeReport(buildCfoReport(ledgerMonthlyFixture(),{watermark:FIXTURE_WATERMARK,now:new Date('2026-10-20T14:00:00Z'),exposure:exposureFixture()}))}};
const base=new URL(process.env.VEXA_UI_BASE??'http://localhost:3427');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Solo loopback');
const require=createRequire(process.env.VEXA_PW_PACKAGE??new URL('../../package.json',import.meta.url));
const {chromium}=require('playwright-core'),checks=[];
const only=process.argv.find(x=>x.startsWith('--case='))?.slice(7)??'all';
assert.ok(['all','agent','preferences','blocked'].includes(only));
const browser=await chromium.launch(),question='¿Cuánto se registró en órdenes en este periodo?';
async function context(blocked=false){
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 const turns=[],errors=[],missing=[];
 if(blocked)await ctx.addInitScript(()=>{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Synthetic denied storage','SecurityError');}});});
 await ctx.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin!==base.origin)return route.fulfill({status:503,body:'external_network_disabled'});
  if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/cfo/data/')){
   if(u.pathname==='/api/agent/turn'){assert.equal(r.method(),'POST');turns.push(JSON.parse(r.postData()??'{}'));}
   const hit=u.pathname==='/cfo/data/report'&&r.method()==='GET'?[200,cfoFixture]:await respond(r.url(),r.method(),r.postData());if(!hit)missing.push(u.pathname);
   return route.fulfill({status:hit?.[0]??503,contentType:'application/json',body:JSON.stringify(hit?.[1]??{error:{code:'fixture_missing'}})});
  }
  if(!['GET','HEAD'].includes(r.method()))return route.fulfill({status:503,body:'unmocked_write_disabled'});
  return route.continue();
 });
 const page=await ctx.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/hydration|hydrated|did not match|same key|unique.*key/i.test(m.text()))errors.push(m.text());});
 return {ctx,page,turns,errors,missing};
}
async function ready(page,path){
 await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-arranque'),null,{timeout:60000});
}
async function cardTitles(page){
 const titles=await page.locator('table[data-mv] [data-titulo] .btn-label').evaluateAll(es=>es.map(e=>{const label=e.getBoundingClientRect(),button=e.closest('.btn').getBoundingClientRect(),row=e.closest('tr').getBoundingClientRect();return {text:e.textContent,height:label.height,buttonHeight:button.height,contained:label.top>=button.top-1&&label.bottom<=button.bottom+1&&button.top>=row.top-1&&button.bottom<=row.bottom+1};}));
 assert.ok(titles.length>0);assert.ok(titles.every(t=>t.contained),'títulos completos contenidos en botón y fila: '+JSON.stringify(titles));
 return titles.map(({height,buttonHeight})=>({height,buttonHeight}));
}
async function theme(page,value){
 assert.ok(await page.evaluate(()=>innerWidth<=document.documentElement.clientWidth+1),'sin viewport móvil expandido por texto desbordado');
 await page.getByRole('button',{name:'Abrir menú',exact:true}).tap();
 const sheet=page.locator('dialog.hoja-mas[open]');await sheet.waitFor();
 await sheet.locator('.overlay-body').evaluate(e=>{e.scrollTop=e.scrollHeight;});
 const label=sheet.locator(`.theme-selector label:has(input[value="${value}"])`);
 const geometry=await label.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {visible:y>=0&&y<=visualViewport.height,hit:e.contains(document.elementFromPoint(x,y)),horizontal:getComputedStyle(e.parentElement).display==='flex',height:r.height};});
 assert.deepEqual(geometry,{visible:true,hit:true,horizontal:true,height:44},'selector horizontal alcanzable por toque después del scroll');
 await label.tap();
 await page.waitForFunction(v=>document.documentElement.dataset.theme===v,value);
 await sheet.locator('.overlay-close').tap();await sheet.waitFor({state:'hidden'});
}
const modeButton=(page,value)=>page.getByRole('group',{name:'Cómo ver las tablas',exact:true}).first().getByRole('button',{name:value==='comparar'?'Comparar columnas':'Tarjetas',exact:true});
async function tableMode(page,value){
 const button=modeButton(page,value);await button.click();
 await page.waitForFunction(v=>document.documentElement.dataset.tablasMovil===v,value);
 assert.equal(await button.getAttribute('aria-pressed'),'true');
}
try{
 if(only==='all'||only==='agent'){
 console.log('START agent-auto-once');
 const c=await context();
 try{
  await ready(c.page,'/preguntale?enviar=1&q='+encodeURIComponent(question));
  const composer=c.page.getByRole('textbox',{name:'Tu pregunta',exact:true});await composer.waitFor();
  await c.page.waitForFunction(()=>document.querySelector('.agente-answer-text')?.textContent?.trim());
  assert.equal(c.turns.length,1);assert.equal(c.turns[0].question,question);
  assert.equal(await composer.inputValue(),'','compositor vacío tras autoenvío');
  for(const key of ['enviar','q'])assert.equal(new URL(c.page.url()).searchParams.has(key),false);
  await c.page.getByRole('button',{name:'Historial de chats',exact:true}).click();await c.page.keyboard.press('Escape');
  await composer.fill('Borrador no enviado');await composer.fill('');
  await c.page.evaluate(()=>window.dispatchEvent(new Event('vexa:refresh')));
  await c.page.waitForTimeout(650); // supera el antirrebote de refresh (400 ms)
  assert.equal(c.turns.length,1,'rerenders y refresh no repiten POST');
  await ready(c.page,c.page.url());await composer.waitFor();await c.page.waitForTimeout(650);
  assert.equal(c.turns.length,1,'navegar a URL limpia no reenvía');assert.equal(await composer.inputValue(),'');
  assert.deepEqual(c.errors,[]);assert.deepEqual(c.missing,[],'todas las API deben tener fixture explícito');checks.push({case:'agent-auto-once',posts:c.turns.length,missing:c.missing});
 }finally{await c.ctx.close();}}
 if(only==='all'||only==='preferences'){
 console.log('START preferences');
 const p=await context();
 try{
  await ready(p.page,'/cfo?vista=informe#comparativa');
  const tab=p.page.getByRole('tab',{name:'Comparativa',exact:true});await tab.waitFor();
  assert.equal(await tab.getAttribute('aria-selected'),'true','hash hidratado elige panel');
  await ready(p.page,'/problems/manage');
  await theme(p.page,'dark');await tableMode(p.page,'comparar');
  assert.deepEqual(await p.page.evaluate(()=>[localStorage.getItem('vexa-theme'),localStorage.getItem('vexa:tablas-movil')]),['dark','comparar']);
  await ready(p.page,'/problems/manage');
  await p.page.waitForFunction(()=>document.documentElement.dataset.theme==='dark'&&document.documentElement.dataset.tablasMovil==='comparar');
  assert.equal(await modeButton(p.page,'comparar').getAttribute('aria-pressed'),'true');
  await theme(p.page,'light');await tableMode(p.page,'tarjetas');
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.missing,[],'todas las API deben tener fixture explícito');checks.push({case:'preferences-persist-hydration',missing:p.missing});
 }finally{await p.ctx.close();}}
 if(only==='all'||only==='blocked'){
 console.log('START blocked-storage');
 const b=await context(true);
 try{
  await ready(b.page,'/problems/manage');const titles=await cardTitles(b.page);await theme(b.page,'dark');await tableMode(b.page,'comparar');
  await b.page.setViewportSize({width:1024,height:844});
  await b.page.getByRole('group',{name:'Cómo ver las tablas',exact:true}).waitFor({state:'hidden'});
  await b.page.setViewportSize({width:390,height:844});
  await modeButton(b.page,'comparar').waitFor();
  assert.equal(await modeButton(b.page,'comparar').getAttribute('aria-pressed'),'true','fallback conserva la preferencia al remontar el control móvil');
  await tableMode(b.page,'tarjetas');await theme(b.page,'light');
  assert.deepEqual(b.errors,[]);assert.deepEqual(b.missing,[],'todas las API deben tener fixture explícito');checks.push({case:'blocked-storage-session',titles,missing:b.missing});
 }finally{await b.ctx.close();}}
 console.log(JSON.stringify({ok:true,checks},null,2));
}finally{await browser.close();}
