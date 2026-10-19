// Visual + geometry audit of the eight views (plus Historial) at 375 / 768 / 1440 px against synthetic fixtures.
//   VEXA_UI_FIXTURES=1 next dev -p 3107   (separate terminal)   then
//   NODE_PATH=<dir with playwright-core>/node_modules node apps/web/tests/ui/audit.mjs [baseUrl] [outDir]
// Fails (exit 1) on: page-level horizontal overflow, clipped text in buttons/links/badges/cards, elements wider than their
// scroll-less container, interactive controls that overlap each other, controls outside the viewport, console errors.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require('playwright-core');
const {respond,IDS,HASH}=await import('./fixtures.mjs');
const base=process.argv[2]??'http://localhost:3107',out=process.argv[3]??path.resolve('ui-captures');fs.mkdirSync(out,{recursive:true});
const PIN=`?snapshot_id=${IDS.snapshot}&scope_hash=${HASH}&date_start=2026-10-01&date_end=2026-11-01&currency=USD&basis=net`;
const VIEWS=[['overview','/overview'],['problems','/problems'],['problem-detail',`/problems/${IDS.problemA}${PIN}`],['recommendations','/recommendations'],['explorer','/explorer'],['customer','/customers/'+IDS.customer+PIN],['interventions','/interventions'],['briefs','/briefs'],['brief-detail','/briefs/'+IDS.brief],['history','/history']];
const VIEWPORTS=[[375,812],[768,1024],[1440,900]];
const filter=process.env.ONLY?process.env.ONLY.split(','):null;
const geometry=()=>{
 const issues=[],vw=document.documentElement.clientWidth;
 const scrollAncestor=(el)=>{for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const o=getComputedStyle(p).overflowX;if(o==='auto'||o==='scroll')return p;}return null;};
 const hidden=(el)=>{const s=getComputedStyle(el);if(s.visibility==='hidden'||s.display==='none')return true;const r=el.getBoundingClientRect();return r.width===0||r.height===0||!!el.closest('[hidden],[inert],dialog:not([open]),details:not([open]) > *:not(summary)');};
 const label=(el)=>(el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'')+' «'+(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,40)+'»');
 if(document.documentElement.scrollWidth>vw+1)issues.push({kind:'page-h-scroll',detail:`scrollWidth ${document.documentElement.scrollWidth} > ${vw}`});
 const all=[...document.querySelectorAll('main *, .workspace-content *')].filter(e=>!hidden(e)&&!e.closest('svg'));
 for(const el of all){
  const r=el.getBoundingClientRect(),sa=scrollAncestor(el);
  if(!sa&&(r.right>vw+1||r.left<-1)&&!el.closest('.sr-only')&&getComputedStyle(el).position!=='fixed'&&!el.matches('.sr-only'))issues.push({kind:'outside-viewport',detail:label(el)+` x=${Math.round(r.left)}..${Math.round(r.right)} vw=${vw}`});
  const s=getComputedStyle(el);
  if(el.matches('button,a,.badge,.status,summary,th,td,dt,dd,h1,h2,h3,figcaption,blockquote,li,p,label')&&!sa&&s.overflowX==='visible'){
   const p=el.parentElement,pr=p?.getBoundingClientRect();
   if(pr&&r.width>pr.width+2&&getComputedStyle(p).display!=='flex'&&!['TD','TH'].includes(el.tagName)&&!p.matches('table,tr,thead,tbody'))issues.push({kind:'wider-than-parent',detail:label(el)+` ${Math.round(r.width)} > ${Math.round(pr.width)}`});
  }
  if(el.matches('button,a.btn,.btn,.badge,.chip')&&(s.overflowX==='hidden'||s.textOverflow==='ellipsis')&&el.scrollWidth>el.clientWidth+1)issues.push({kind:'clipped-text',detail:label(el)});
  if(el.matches('button,.btn,.badge,.chip')&&s.whiteSpace==='nowrap'&&el.scrollWidth>el.clientWidth+1&&s.overflowX==='visible')issues.push({kind:'text-spills-box',detail:label(el)});
  if(el.matches('article,section,.record-card,.card,li,td,th,figure,dd')&&s.overflowX==='visible'&&el.scrollWidth>el.clientWidth+2&&!sa&&!el.closest('table'))issues.push({kind:'content-spills-container',detail:label(el)+` ${el.scrollWidth}>${el.clientWidth}`});
 }
 const pinned=(e)=>{for(let p=e;p&&p!==document.body;p=p.parentElement){const ps=getComputedStyle(p).position;if(ps==='fixed'||ps==='sticky')return true;}return false;};
 const ctr=all.filter(e=>e.matches('button,a[href],input:not([type=hidden]):not(.sr-only),select,textarea,summary')&&!e.closest('.sr-only')&&!e.matches('.sr-only')&&!pinned(e));
 for(let i=0;i<ctr.length;i++)for(let j=i+1;j<ctr.length;j++){const a=ctr[i],b=ctr[j];if(a.contains(b)||b.contains(a))continue;const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();const w=Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left),h=Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);if(w>3&&h>3)issues.push({kind:'controls-overlap',detail:label(a)+' ⟂ '+label(b)+` ${Math.round(w)}x${Math.round(h)}`});}
 for(const el of ctr){const r=el.getBoundingClientRect();if(r.height>0&&r.height<24&&!el.matches('summary,input[type=checkbox],input[type=radio],a'))issues.push({kind:'small-target',detail:label(el)+` h=${Math.round(r.height)}`});}
 return issues;
};
const browser=await chromium.launch();const report=[];let failed=0;
for(const [w,h] of VIEWPORTS){
 const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,reducedMotion:'reduce'});
 if(process.env.THEME)await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{/* optional */}},process.env.THEME);
 await ctx.route('**/api/**',async route=>{const req=route.request(),hit=respond(req.url(),req.method(),req.postData());if(!hit)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});return route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])});});
 for(const [name,route] of VIEWS){
  if(filter&&!filter.includes(name))continue;
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/fixture_missing|503|Failed to load resource/.test(m.text()))errors.push('console: '+m.text().slice(0,160));});
  await page.goto(base+route,{waitUntil:'networkidle',timeout:90000}).catch(e=>errors.push('goto: '+e.message));
  await page.waitForTimeout(500);
  const issues=await page.evaluate(geometry).catch(e=>[{kind:'audit-error',detail:String(e)}]);
  const full=await page.evaluate(()=>{const c=document.querySelector('.workspace-content');return Math.min(6000,Math.max(document.documentElement.scrollHeight,c?c.scrollHeight+(c.getBoundingClientRect().top):0));}).catch(()=>h);
  await page.setViewportSize({width:w,height:Math.max(h,full)});await page.waitForTimeout(150);
  await page.screenshot({path:path.join(out,`${name}-${w}.png`)}).catch(()=>{});await page.setViewportSize({width:w,height:h});
  const uniq=[...new Map(issues.map(i=>[i.kind+i.detail,i])).values()];
  if(uniq.length||errors.length)failed++;
  report.push({view:name,width:w,issues:uniq,errors});
  console.log(`${uniq.length||errors.length?'FAIL':'PASS'} ${name} @${w}${uniq.length?' · '+uniq.length+' problemas':''}${errors.length?' · '+errors.length+' errores':''}`);
  for(const i of uniq.slice(0,12))console.log('   - '+i.kind+': '+i.detail);for(const e of errors.slice(0,4))console.log('   ! '+e);
  await page.close();
 }
 if(!filter||filter.includes('demo-flow')){
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  const fail=[];
  try{
   await page.goto(base+'/explorer',{waitUntil:'networkidle',timeout:90000});
   await page.waitForSelector('.coverage .cov-row',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'coverage band did not render'}));
   await page.fill('#explorer-question','¿Qué reembolsos constan en este corte?');
   await page.click('button[aria-label="Consultar datos"]');
   await page.waitForSelector('[aria-label="Respuesta de la consulta"]',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'answer did not render'}));
   await page.waitForSelector('.citation',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'no citation after the answer'}));
   await page.click('.citation button[aria-controls]').catch(()=>fail.push({kind:'flow',detail:'Ver origen button missing'}));
   await page.waitForSelector('.origin-chain li',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'origin chain did not render'}));
   const steps=await page.locator('.origin-chain li').count();if(steps<4)fail.push({kind:'flow',detail:'origin chain has '+steps+' steps, expected 4 (cita, fuente, fila, archivo)'});
   if(!(await page.locator('.origin-chain .id-chip').first().isVisible().catch(()=>false)))fail.push({kind:'flow',detail:'hash chip not visible'});
   await page.waitForTimeout(400);
   fail.push(...await page.evaluate(geometry));
   const full=await page.evaluate(()=>{const c=document.querySelector('.workspace-content');return Math.min(7000,c?c.scrollHeight+c.getBoundingClientRect().top:document.documentElement.scrollHeight);});
   await page.setViewportSize({width:w,height:Math.max(h,full)});await page.waitForTimeout(150);await page.screenshot({path:path.join(out,`demo-flow-${w}.png`)});
  }catch(e){fail.push({kind:'flow',detail:String(e).slice(0,200)});}
  const uniq=[...new Map(fail.map(i=>[i.kind+i.detail,i])).values()];if(uniq.length||errors.length)failed++;
  report.push({view:'demo-flow',width:w,issues:uniq,errors});console.log(`${uniq.length||errors.length?'FAIL':'PASS'} demo-flow @${w}${uniq.length?' · '+uniq.length+' problemas':''}`);for(const i of uniq.slice(0,12))console.log('   - '+i.kind+': '+i.detail);
  await page.close();
 }
 await ctx.close();
}
await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
console.log(failed?`FAILED ${failed} combinaciones`:'ALL PASS');process.exitCode=failed?1:0;
