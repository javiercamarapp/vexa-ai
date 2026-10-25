// Visual + geometry audit of the eight views (plus Historial) at 375 / 768 / 1440 px against synthetic fixtures.
//   VEXA_UI_FIXTURES=1 next dev -p 3107   (separate terminal)   then
//   NODE_PATH=<dir with playwright-core>/node_modules node apps/web/tests/ui/audit.mjs [baseUrl] [outDir]
// Fails (exit 1) on: page-level horizontal overflow, clipped text in buttons/links/badges/cards, elements wider than their
// scroll-less container, interactive controls that overlap each other, controls outside the viewport, console errors.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require('playwright-core');
const {respond,IDS,HASH,agentStateEmpty,CONV,ORD}=await import('./fixtures.mjs');
const base=process.argv[2]??'http://localhost:3107',out=process.argv[3]??path.resolve('ui-captures');fs.mkdirSync(out,{recursive:true});
const PIN=`?snapshot_id=${IDS.snapshot}&scope_hash=${HASH}&date_start=2026-10-01&date_end=2026-11-01&currency=USD&basis=net`;
const VIEWS=[['overview','/overview'],['problems','/problems'],['problem-detail',`/problems/${IDS.problemA}${PIN}`],['problem-detail-sin-publicacion',`/problems/${IDS.problemA}`],['recommendations','/recommendations'],['explorer','/explorer'],['customer','/customers/'+IDS.customer+PIN],['interventions','/interventions'],['briefs','/briefs'],['brief-detail','/briefs/'+IDS.brief],['history','/history'],['preguntale','/preguntale']];
const EXTRA=[['operacion-economia','/economics'],['operacion-problemas-gestion','/problems/manage'],['operacion-analisis','/analysis'],['datos-importaciones','/imports'],['datos-conexiones','/connections'],['datos-evaluacion','/evaluation'],['datos-candidatos','/evaluation/candidates'],['datos-migracion','/migrations'],['admin-notificaciones','/notifications'],['admin-avisos','/settings/notifications'],['admin-entrega','/settings/notification-delivery'],['admin-equipo','/settings/team'],['admin-retencion','/settings/retention'],['jobs-setup','/jobs/setup'],['login','/login'],['plataforma','/platform'],['404','/ruta-que-no-existe-xyz'],['invitacion','/auth/invitations/'+IDS.snapshot]];
if(process.env.EXTRA==='1')VIEWS.splice(0,VIEWS.length,...EXTRA);
// VIEWS_EXTRA='nombre=/ruta,otro=/ruta2': audita solo esas pantallas (útil para una ola de rediseño).
if(process.env.VIEWS_EXTRA)VIEWS.splice(0,VIEWS.length,...process.env.VIEWS_EXTRA.split(',').map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
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
 // Un control dentro de un contenedor con desplazamiento que queda fuera de su zona visible (p. ej. ítems del sidebar tras el bloque inferior) no está a la vista: no se compara.
 const visible=(e)=>{let t=e.getBoundingClientRect(),top=t.top,bottom=t.bottom;for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const oy=getComputedStyle(p).overflowY;if(oy==='visible'||oy==='clip')continue;const pr=p.getBoundingClientRect();top=Math.max(top,pr.top);bottom=Math.min(bottom,pr.bottom);}return {left:t.left,right:t.right,top,bottom};};
 const recortado=(e)=>{const v=visible(e);return v.bottom-v.top<=1;};
 const ctr=all.filter(e=>e.matches('button,a[href],input:not([type=hidden]):not(.sr-only),select,textarea,summary')&&!e.closest('.sr-only')&&!e.matches('.sr-only')&&!pinned(e)&&!recortado(e));
 for(let i=0;i<ctr.length;i++)for(let j=i+1;j<ctr.length;j++){const a=ctr[i],b=ctr[j];if(a.contains(b)||b.contains(a))continue;const ra=visible(a),rb=visible(b);const w=Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left),h=Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);if(w>3&&h>3)issues.push({kind:'controls-overlap',detail:label(a)+' ⟂ '+label(b)+` ${Math.round(w)}x${Math.round(h)}`});}
 for(const el of ctr){const r=el.getBoundingClientRect();if(r.height>0&&r.height<24&&!el.matches('summary,input[type=checkbox],input[type=radio],a'))issues.push({kind:'small-target',detail:label(el)+` h=${Math.round(r.height)}`});}
 // ---- System-style rules (Javier: no stray links, no unstyled buttons, no inline links without underline, 40px-ish click areas) ----
 const textual='p,li,dd,dt,small,figcaption,blockquote,td,th,span,strong,label';
 for(const el of all){
  if(!el.matches('a[href],button'))continue;
  if(el.closest('.workspace-sidebar,.workspace-bottom-nav,.workspace-header,.global-bar,.workspace-mobile-dialog,.sr-only,[role=tablist]')||el.matches('.skip-link'))continue;
  const s=getComputedStyle(el),r=el.getBoundingClientRect(),system=!!el.closest('.agente-history')||el.matches('.btn,.id-chip,.icon-button,.icon-btn,.seg-btn,.fchip-x,.catalog-link,.login-btn,.row-link,.card-link,.row-link-inline,.stat-card,.barlist-link,.tab-link,.check-chip,.ctl,.copiloto-hist-btn,.agente-chip,.agente-consult,.agente-q,.agente-round,.agente-hist-new,.agente-hist-close,.agente-history-item')||(el.tagName==='A'&&s.display.includes('flex')&&(parseFloat(s.borderTopLeftRadius)||0)>=10&&r.height>=32);
  const inline=el.tagName==='A'&&!system&&!!el.parentElement&&el.parentElement.matches(textual)&&getComputedStyle(el.parentElement).display!=='flex';
  if(inline){if(!(s.textDecorationLine||'').includes('underline'))issues.push({kind:'inline-link-no-underline',detail:label(el)});continue;}
  if(el.tagName==='A'&&!system){issues.push({kind:'unstyled-link',detail:label(el)+' (use LinkButton)'});continue;}
  if(el.tagName==='BUTTON'&&!system){const radius=parseFloat(s.borderTopLeftRadius)||0;if(r.height<32||radius<10)issues.push({kind:'unstyled-button',detail:label(el)+` h=${Math.round(r.height)} r=${radius}`});}
  if(system&&!el.closest('.agente-sources,.agente-history')&&!el.matches('.ctl,.copiloto-hist-btn,.agente-chip,.agente-consult,.agente-q,.id-chip,.icon-button,.icon-btn,.seg-btn,.fchip-x,.row-link,.card-link,.row-link-inline,.barlist-link,.check-chip,.stat-card')&&r.height>0&&r.height<32)issues.push({kind:'click-area-small',detail:label(el)+` h=${Math.round(r.height)}`});
 }
 for(const el of all){if(!el.matches('summary'))continue;if(el.closest('.workspace-sidebar,.nav-group'))continue;const r=el.getBoundingClientRect();if(r.height>0&&r.height<32)issues.push({kind:'click-area-small',detail:label(el)+` summary h=${Math.round(r.height)}`});}
 // text that spills its own box (any element with its own text, not a scroll container)
 for(const el of all){const s=getComputedStyle(el);if(s.display==='inline'||s.overflowX!=='visible'||el.matches('table,tbody,thead,tr,svg,code.ref'))continue;if(el.scrollWidth>el.clientWidth+2&&el.clientWidth>0&&!scrollAncestor(el)&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))issues.push({kind:'text-overflow',detail:label(el)+` ${el.scrollWidth}>${el.clientWidth}`});}
 // a short single word (label, chip, badge) must never be broken across lines
 for(const el of all){if(el.children.length>0)continue;const t=(el.textContent||'').trim();if(!t||/\s/.test(t)||t.length>14)continue;if(getComputedStyle(el).display==='inline'&&!el.matches('span,strong,small'))continue;const range=document.createRange();range.selectNodeContents(el);const tops=new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.top/4)));if(tops.size>1)issues.push({kind:'broken-word',detail:label(el)+` lines=${tops.size}`});}
 // siblings of a flex/grid container must not collide
 const parents=new Set(all.map(e=>e.parentElement).filter(Boolean));
 for(const p of parents){const d=getComputedStyle(p).display;if(!/flex|grid/.test(d))continue;const kids=[...p.children].filter(k=>!hidden(k)&&!['absolute','fixed'].includes(getComputedStyle(k).position)&&!k.matches('.sr-only,svg,option,script,style'));if(kids.length>40||kids.length<2)continue;
  for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++){const a=kids[i].getBoundingClientRect(),b=kids[j].getBoundingClientRect();const w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(w>3&&h>3&&!pinned(kids[i])&&!pinned(kids[j]))issues.push({kind:'sibling-overlap',detail:label(kids[i])+' ⟂ '+label(kids[j])+` ${Math.round(w)}x${Math.round(h)}`});}}
 // ---- Unified type scale and compact buttons (rediseño 20-oct): one size per heading level in every view; buttons 30–36 px tall ----
 for(const h of document.querySelectorAll('.workspace-content h1,.workspace-content h2,.workspace-content h3,.workspace-content h4')){if(hidden(h))continue;const want={H1:'24px',H2:'16px',H3:'14px',H4:'14px'}[h.tagName],fs=getComputedStyle(h).fontSize;if(fs!==want)issues.push({kind:'type-scale',detail:label(h)+' '+fs+' != '+want});}
 for(const b of document.querySelectorAll('.workspace-content .btn')){if(hidden(b)||b.matches('.title-link,.catalog-link'))continue;const r=b.getBoundingClientRect();if(r.height>0&&(r.height<30||r.height>38)&&b.textContent.trim().length<28)issues.push({kind:'button-height',detail:label(b)+' h='+Math.round(r.height)});}
 return issues;
};
const browser=await chromium.launch();const report=[];let failed=0;
if(process.env.SELFTEST){
 // Negative control: the rules must FAIL on deliberately broken markup, otherwise a green audit means nothing.
 const ctx=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});
 await ctx.route('**/api/**',async route=>{const req=route.request();let u=req.url();if(process.env.WVARIANT&&/\/api\/workspace(\?|$)/.test(u))u+=(u.includes('?')?'&':'?')+'variant='+process.env.WVARIANT;if(process.env.RVARIANT&&/\/api\/recommendations(\/[0-9a-f-]{36})?(\?|$)/.test(u))u+=(u.includes('?')?'&':'?')+'variant='+process.env.RVARIANT;const hit=await respond(u,req.method(),req.postData());return hit?route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}):route.fulfill({status:503,body:'{}'});});
 const page=await ctx.newPage();await page.goto(base+'/overview',{waitUntil:'networkidle'});
 await page.evaluate(()=>{const host=document.querySelector('.workspace-content');const d=document.createElement('div');d.innerHTML=`<p>Texto con <a href="/x" style="text-decoration:none">palabra con link</a> suelta.</p><div><a href="/y" style="all:unset;cursor:pointer">enlace sin estilo</a></div><div><button type="button" class="legacy" style="all:unset;cursor:pointer;border:1px solid #000;padding:2px">crudo</button></div><div style="display:flex;width:200px"><button class="btn" style="white-space:nowrap;width:60px;overflow:visible">Un texto de botón demasiado largo para su recuadro</button></div><div style="display:flex"><div style="width:120px;height:40px;background:#eee">A</div><div style="width:120px;height:40px;margin-left:-60px;background:#ddd">B</div></div><div><span style="display:inline-block;width:22px;overflow-wrap:anywhere">FUENTES</span></div><div style="width:100px;white-space:nowrap">Una línea que desborda su caja por completo sin saltar</div>`;host.appendChild(d);});
 const found=new Set((await page.evaluate(geometry)).map(i=>i.kind));
 const need=['inline-link-no-underline','unstyled-link','unstyled-button','sibling-overlap','broken-word'];const anyOf=[['text-spills-box','text-overflow','content-spills-container']];
 const missing=need.filter(k=>!found.has(k)).concat(anyOf.filter(g=>!g.some(k=>found.has(k))).map(g=>g.join('|')));
 console.log(missing.length?'FAIL selftest: reglas que no detectaron el defecto: '+missing.join(', ')+' (detectadas: '+[...found].join(', ')+')':'PASS selftest: las reglas detectan enlaces sin estilo/subrayado, botones crudos, texto desbordado y choques ('+[...found].join(', ')+')');
 await browser.close();process.exit(missing.length?1:0);
}

for(const [w,h] of VIEWPORTS){
 const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,reducedMotion:'reduce'});
 if(process.env.THEME)await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{/* optional */}},process.env.THEME);
 await ctx.route('**/api/**',async route=>{const req=route.request();let ru=req.url();if(process.env.RVARIANT&&/\/api\/recommendations(\/[0-9a-f-]{36})?(\?|$)/.test(ru))ru+=(ru.includes('?')?'&':'?')+'variant='+process.env.RVARIANT;const hit=await respond(ru,req.method(),req.postData());if(!hit)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});return route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])});});
 for(const [name,route] of VIEWS){
  if(filter&&!filter.includes(name))continue;
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/fixture_missing|503|Failed to load resource|auth_not_configured/.test(m.text()))errors.push('console: '+m.text().slice(0,160));});
  await page.goto(base+route,{waitUntil:'networkidle',timeout:90000}).catch(e=>errors.push('goto: '+e.message));
  await page.waitForTimeout(500);
  const issues=await page.evaluate(geometry).catch(e=>[{kind:'audit-error',detail:String(e)}]);
  const docTitle=await page.title();if(!/ · Rovaq AI$/.test(docTitle))issues.push({kind:'page-title',detail:'title should be "<vista> · Rovaq AI", got "'+docTitle+'"'});
  const full=await page.evaluate(()=>{const c=document.querySelector('.workspace-content');return Math.ceil(Math.min(6000,Math.max(document.documentElement.scrollHeight,c?c.scrollHeight+(c.getBoundingClientRect().top):0)));}).catch(()=>h);
  await page.setViewportSize({width:w,height:Math.max(h,full)});await page.waitForTimeout(150);
  await page.screenshot({path:path.join(out,`${name}-${w}.png`)}).catch(()=>{});await page.setViewportSize({width:w,height:h});
  const uniq=[...new Map(issues.map(i=>[i.kind+i.detail,i])).values()];
  if(uniq.length||errors.length)failed++;
  report.push({view:name,width:w,issues:uniq,errors});
  console.log(`${uniq.length||errors.length?'FAIL':'PASS'} ${name} @${w}${uniq.length?' · '+uniq.length+' problemas':''}${errors.length?' · '+errors.length+' errores':''}`);
  for(const i of uniq.slice(0,12))console.log('   - '+i.kind+': '+i.detail);for(const e of errors.slice(0,4))console.log('   ! '+e);
  await page.close();
 }
 if(process.env.EXTRA!=='1'&&(!filter||filter.includes('overview-trends'))){
  const page=await ctx.newPage(),fail=[],errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  try{
   await page.goto(base+'/overview',{waitUntil:'networkidle',timeout:90000});
   await page.waitForSelector('.trends .chart-plot svg',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'area chart did not render'}));
   await page.waitForSelector('.column-chart .col-bar',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'conversation columns did not render'}));
   const cols=await page.locator('.column-chart .col-bar').count();if(cols<12)fail.push({kind:'flow',detail:'expected 12 conversation bars, got '+cols});
   await page.locator('.trends .chart-plot svg').first().evaluate(e=>e.focus({preventScroll:true}));await page.keyboard.press('ArrowLeft');
   const tip=await page.locator('.trends .chart-tip').first().innerText().catch(()=>'');if(!new RegExp(new Date(Date.UTC(2026,9,1)).toLocaleString('es-MX',{month:'long',timeZone:'UTC'}),'i').test(tip)||!/pedidos/i.test(tip))fail.push({kind:'flow',detail:'tooltip did not show the last month: '+tip.replace(/\n/g,' | ')});
   await page.locator('.trends [role=radio]').nth(1).click();
   if(!(await page.locator('.trends h2',{hasText:'Reembolsos liquidados por mes'}).count()))fail.push({kind:'flow',detail:'refunds toggle did not change the chart'});
   const kinds=(await page.locator('.kind-badge').allInnerTexts()).join('|');if(!/Estimado/.test(kinds)||!/Observado/.test(kinds))fail.push({kind:'flow',detail:'conversation sample must be labelled Estimado and the ledger Observado: '+kinds});
   // Resumen ejecutivo actual. Los valores esperados salen de las fixtures (CONV/ORD), no de números fijos: el último mes COMPLETO es el penúltimo (el último es parcial y no se compara).
   const full=CONV.length-2,convEsperada=CONV[full].toLocaleString('en-US'),pedidosEsperados=(Number(ORD[full][1])/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD';
   const kpis=await page.locator('.stat-value').allInnerTexts();
   if(kpis.length!==4)fail.push({kind:'flow',detail:'se esperaban 4 KPI, hay '+kpis.length+': '+kpis.join('|')});
   if(!kpis.includes(convEsperada))fail.push({kind:'flow',detail:'KPI de conversaciones del último mes completo debe ser '+convEsperada+': '+kpis.join('|')});
   if(!kpis.includes(pedidosEsperados))fail.push({kind:'flow',detail:'KPI de ingresos del último mes completo debe ser '+pedidosEsperados+' (misma cifra que Dinero): '+kpis.join('|')});
   if(!/%$/.test(kpis[3]??''))fail.push({kind:'flow',detail:'el cuarto KPI (conversaciones analizadas por la IA) debe ser un porcentaje: '+kpis[3]});
   const cuerpo=await page.locator('main').innerText();
   if(!/Conversaciones analizadas por la IA/.test(cuerpo)||!/\d[\d,]* de ≈?[\d,]+ conversaciones/.test(cuerpo))fail.push({kind:'flow',detail:'falta «Conversaciones analizadas por la IA» con «N de M conversaciones»'});
   if((cuerpo.match(/Fuentes con datos:/g)??[]).length!==1)fail.push({kind:'flow',detail:'debe haber una sola franja de estado («Fuentes con datos:» aparece '+(cuerpo.match(/Fuentes con datos:/g)??[]).length+' veces)'});
   const orden=await page.evaluate(()=>{const y=t=>{const h=[...document.querySelectorAll('main h2')].find(e=>e.textContent.trim()===t);return h?h.getBoundingClientRect().top+scrollY:null;};const kpi=document.querySelector('.stat-value');return {fuga:y('Fuga de reembolsos'),kpi:kpi?kpi.getBoundingClientRect().top+scrollY:null,atencion:y('Qué requiere atención'),top5:y('Problemas con más conversaciones')};});
   if(orden.fuga===null||orden.kpi===null||!(orden.fuga<orden.kpi))fail.push({kind:'flow',detail:'la tarjeta «Fuga de reembolsos» debe ir arriba de los KPI: '+JSON.stringify(orden)});
   if(orden.atencion===null)fail.push({kind:'flow',detail:'falta «Qué requiere atención»'});
   if(orden.top5===null)fail.push({kind:'flow',detail:'falta el top 5 «Problemas con más conversaciones»'});
   // overlays: filters drawer opens, traps Esc, restores focus
   await page.getByRole('button',{name:/^Filtros/}).click();await page.waitForSelector('dialog.drawer[open] form',{timeout:5000}).catch(()=>fail.push({kind:'flow',detail:'filters drawer did not open'}));
   fail.push(...await page.evaluate(geometry));await page.keyboard.press('Escape');await page.waitForSelector('dialog.drawer[open]',{state:'detached',timeout:3000}).catch(()=>fail.push({kind:'flow',detail:'Esc did not close the drawer'}));
   fail.push(...await page.evaluate(geometry));
  }catch(e){fail.push({kind:'flow',detail:String(e).slice(0,200)});}
  const uniq=[...new Map(fail.map(i=>[i.kind+i.detail,i])).values()];if(uniq.length||errors.length)failed++;
  report.push({view:'overview-trends',width:w,issues:uniq,errors});console.log(`${uniq.length||errors.length?'FAIL':'PASS'} overview-trends @${w}${uniq.length?' · '+uniq.length+' problemas':''}`);for(const i of uniq.slice(0,12))console.log('   - '+i.kind+': '+i.detail);
  await page.close();
 }
 if(filter&&filter.includes('overview-slow')&&w===1440){
  // Production regression (21-oct): /api/workspace?resource=metrics hung for > 30 s on the 85k-row ledger and the Resumen showed nothing else.
  const page=await ctx.newPage(),fail=[];
  await page.route('**/api/workspace?resource=metrics*',()=>{/* never answered on purpose */});
  await page.goto(base+'/overview',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('text=/Información (histórica )?incorporada/',{timeout:20000}).catch(()=>fail.push({kind:'flow',detail:'coverage band missing while the figures are pending'}));
  await page.waitForSelector('.trends .col-bar',{timeout:20000}).catch(()=>fail.push({kind:'flow',detail:'monthly trends missing while the figures are pending'}));
  await page.waitForSelector('text=tardaron demasiado',{timeout:40000}).catch(()=>fail.push({kind:'flow',detail:'no timeout message after 25 s'}));
  if(await page.locator('.trends .col-bar').count()<12)fail.push({kind:'flow',detail:'trends disappeared after the timeout'});
  fail.push(...await page.evaluate(geometry));
  await page.screenshot({path:path.join(out,'overview-slow-1440.png'),fullPage:false});
  const uniq=[...new Map(fail.map(i=>[i.kind+i.detail,i])).values()];if(uniq.length)failed++;
  report.push({view:'overview-slow',width:w,issues:uniq,errors:[]});console.log(`${uniq.length?'FAIL':'PASS'} overview-slow @${w}${uniq.length?' · '+uniq.length+' problemas':''}`);for(const i of uniq.slice(0,12))console.log('   - '+i.kind+': '+i.detail);
  await page.close();
 }
 if(process.env.EXTRA!=='1'&&(!filter||filter.includes('demo-flow'))){
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  const fail=[];
  try{
   await page.goto(base+'/explorer',{waitUntil:'networkidle',timeout:90000});
   await page.waitForSelector('.coverage .cov-tile',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'coverage band did not render'}));
   await page.fill('#explorer-question','¿Qué reembolsos constan en este corte?');
   await page.click('button[aria-label="Consultar datos"]');
   await page.waitForSelector('[aria-label="Respuesta de la consulta"]',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'answer did not render'}));
   await page.waitForSelector('.citation',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'no citation after the answer'}));
   await page.click('.citation button[aria-controls]').catch(()=>fail.push({kind:'flow',detail:'Ver origen button missing'}));
   await page.waitForSelector('.origin-chain li',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'origin chain did not render'}));
   const answerText=await page.locator('[aria-label="Respuesta de la consulta"]').innerText().catch(()=>''),cardAmount=(await page.locator('[aria-label="Respuesta de la consulta"] dd').first().innerText().catch(()=>'')).split('\n')[0].trim();
   if(!cardAmount||!answerText.includes(cardAmount))fail.push({kind:'flow',detail:'the answer text does not quote the figure shown on its card ('+cardAmount+')'});
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

 if(process.env.EXTRA!=='1'&&(!filter||filter.includes('agente-flow'))){
  const page=await ctx.newPage(),errors=[],fail=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  const shot=async(name)=>{const full=await page.evaluate(()=>{const c=document.querySelector('.workspace-content');return Math.min(7000,c?c.scrollHeight+c.getBoundingClientRect().top:document.documentElement.scrollHeight);});await page.setViewportSize({width:w,height:Math.max(h,full)});await page.waitForTimeout(150);await page.screenshot({path:path.join(out,`${name}-${w}.png`)}).catch(()=>{});await page.setViewportSize({width:w,height:h});};
  const ask=async(q)=>{await page.fill('.agente-composer textarea',q);await page.keyboard.press('Enter');};
  try{
   await page.goto(base+'/preguntale',{waitUntil:'networkidle',timeout:90000});
   await page.waitForSelector('[data-testid=agente-shell] h1',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'la portada no se dibujó'}));
   if(await page.locator('.agente-chips button').count()<3)fail.push({kind:'flow',detail:'faltan sugerencias iniciales basadas en la cobertura'});
   await page.click('.agente-composer button:has-text("Consulta")');
   await page.waitForSelector('.agente-cats .agente-q',{timeout:5000}).catch(()=>fail.push({kind:'flow',detail:'las tarjetas de «Consulta» no aparecieron'}));
   fail.push(...await page.evaluate(geometry));await shot('agente-portada');
   await ask('¿Cuánto dinero en reembolsos tuvimos por marketplace?');
   await page.waitForSelector('.agente-answer .agente-block',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'la respuesta con tabla no apareció'}));
   const kinds=(await page.locator('.agente-block .kind-badge').allInnerTexts()).join('|');if(!/Observado/.test(kinds))fail.push({kind:'flow',detail:'el bloque no lleva etiqueta Observado: '+kinds});
   if(!/Cobertura: [\d,]+ de [\d,]+/.test((await page.locator('.agente-cov').first().innerText().catch(()=>''))))fail.push({kind:'flow',detail:'el bloque no muestra su cobertura'});
   if(!/no se suman/i.test(await page.locator('.agente-answer').first().innerText().catch(()=>'')))fail.push({kind:'flow',detail:'falta la nota de que las monedas no se suman'});
   await page.click('summary:has-text("Ver cómo lo calculé")');await page.waitForSelector('.agente-calc-step',{timeout:5000}).catch(()=>fail.push({kind:'flow',detail:'«Ver cómo lo calculé» no abrió'}));
   if(!(await page.locator('.agente-calc-step .id-chip').count()))fail.push({kind:'flow',detail:'«cómo lo calculé» sin herramienta/parámetros'});
   await page.click('.agente-actions button:has-text("Útil")');await page.waitForSelector('.agente-fb',{timeout:5000}).catch(()=>fail.push({kind:'flow',detail:'el feedback no confirmó'}));
   await page.click('.agente-actions button:has-text("No fue útil")');await page.waitForSelector('[aria-label="¿Qué falló?"] button',{timeout:5000}).catch(()=>fail.push({kind:'flow',detail:'no aparecieron los motivos del feedback'}));
   await page.click('[aria-label="¿Qué falló?"] button:has-text("Incompleto")');
   const dl=page.waitForEvent('download',{timeout:5000}).catch(()=>null);await page.click('.agente-actions button:has-text("Exportar")');if(!(await dl))fail.push({kind:'flow',detail:'Exportar no descargó nada'});
   await ask('¿Qué dicen los clientes sobre el producto dañado en tránsito?');
   await page.waitForSelector('.agente-citations .citation',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'no aparecieron citas verificables'}));
   await page.click('.agente-citations .citation button[aria-controls]').catch(()=>fail.push({kind:'flow',detail:'«Ver origen» ausente'}));
   await page.waitForSelector('.agente-citations .origin-chain li',{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'la cadena de origen no apareció'}));
   await ask('¿Cuántos reembolsos tuvimos en Zendesk?');
   await page.waitForFunction(()=>document.body.innerText.includes('No tengo ese dato'),null,{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'faltó «No tengo ese dato» para Zendesk'}));
   if(!(await page.locator('.agente-missing').count()))fail.push({kind:'flow',detail:'no dijo qué falta cargar'});
   await ask('¿Cuánto voy a vender el próximo trimestre?');
   await page.waitForFunction(()=>document.body.innerText.includes('No hago proyecciones'),null,{timeout:15000}).catch(()=>fail.push({kind:'flow',detail:'no rechazó el pronóstico'}));
   await page.waitForTimeout(300);fail.push(...await page.evaluate(geometry));await shot('agente-conversacion');
   await page.click('button:has-text("Historial")');await page.waitForSelector('.agente-history',{timeout:5000}).catch(()=>fail.push({kind:'flow',detail:'el historial no abrió'}));
   if(await page.locator('.agente-history .agente-history-item').count()<1)fail.push({kind:'flow',detail:'el chat no quedó en el historial'});
   await page.waitForTimeout(350);fail.push(...await page.evaluate(geometry));await shot('agente-historial');
   await page.keyboard.press('Escape');await page.waitForSelector('.agente-history',{state:'detached',timeout:3000}).catch(()=>fail.push({kind:'flow',detail:'Esc no cerró el historial'}));
  }catch(e){fail.push({kind:'flow',detail:String(e).slice(0,200)});}
  const uniq=[...new Map(fail.map(i=>[i.kind+i.detail,i])).values()];if(uniq.length||errors.length)failed++;
  report.push({view:'agente-flow',width:w,issues:uniq,errors});console.log(`${uniq.length||errors.length?'FAIL':'PASS'} agente-flow @${w}${uniq.length?' · '+uniq.length+' problemas':''}`);for(const i of uniq.slice(0,12))console.log('   - '+i.kind+': '+i.detail);for(const e of errors.slice(0,4))console.log('   ! '+e);
  await page.close();
 }
 if(process.env.EXTRA!=='1'&&(!filter||filter.includes('agente-estados'))){
  const states=[['agente-vacio',async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:await agentStateEmpty()})}),/Todavía no hay información cargada/],['agente-sin-permiso',route=>route.fulfill({status:403,contentType:'application/json',body:'{"error":{"code":"forbidden"}}'}),/Sin acceso/],['agente-error',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"agent_unavailable"}}'}),/No se pudo abrir/]];
  for(const [name,handler,expect] of states){
   const page=await ctx.newPage(),fail=[],errors=[];page.on('pageerror',e=>errors.push('pageerror: '+e.message));
   await page.route('**/api/agent/state',handler);
   try{await page.goto(base+'/preguntale',{waitUntil:'networkidle',timeout:90000});await page.waitForTimeout(400);
    if(!expect.test(await page.locator('.agente').innerText().catch(()=>'')))fail.push({kind:'flow',detail:name+': el estado esperado no se mostró'});
    fail.push(...await page.evaluate(geometry));await page.screenshot({path:path.join(out,`${name}-${w}.png`)}).catch(()=>{});}
   catch(e){fail.push({kind:'flow',detail:String(e).slice(0,200)});}
   const uniq=[...new Map(fail.map(i=>[i.kind+i.detail,i])).values()];if(uniq.length||errors.length)failed++;
   report.push({view:name,width:w,issues:uniq,errors});console.log(`${uniq.length||errors.length?'FAIL':'PASS'} ${name} @${w}${uniq.length?' · '+uniq.length+' problemas':''}`);for(const i of uniq.slice(0,12))console.log('   - '+i.kind+': '+i.detail);
   await page.close();
  }
 }
 await ctx.close();
}
await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
console.log(failed?`FAILED ${failed} combinaciones`:'ALL PASS');process.exitCode=failed?1:0;
