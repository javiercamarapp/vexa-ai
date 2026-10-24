// Navegación y sidebar contra fixtures sintéticos, a 375 / 768 / 1440 px.
//   VEXA_UI_FIXTURES=1 [VEXA_UI_FIXTURES_PLATFORM=1] next dev -p 3137   (otra terminal)   luego
//   NODE_PATH=<dir con playwright-core>/node_modules [EXPECT_INTERNAL=1] [THEME=dark] node apps/web/tests/ui/nav.mjs [baseUrl] [outDir]
// Sale 1 si algo falla. EXPECT_INTERNAL=1 solo si el servidor corre con VEXA_UI_FIXTURES_PLATFORM=1.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require('playwright-core');
const {respond}=await import('./fixtures.mjs');
const base=process.argv[2]??'http://localhost:3137',out=process.argv[3]??path.resolve('ui-captures-nav');fs.mkdirSync(out,{recursive:true});
const internal=process.env.EXPECT_INTERNAL==='1',theme=process.env.THEME??'light';
const SCOPE='date_start=2026-08-01&date_end=2026-09-21&currency=USD&basis=marketplace_line_price&snapshot_id=00000000-0000-4000-8000-0000000000aa&scope_hash=abc123';
const fails=[];const check=(ok,msg)=>{if(!ok){fails.push(msg);console.log('   - FALLA: '+msg);}};
const browser=await chromium.launch();
for(const [w,h] of [[375,812],[768,1024],[1440,900]]){
 const ctx=await browser.newContext({viewport:{width:w,height:h},reducedMotion:'reduce'});
 await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{/* opcional */}},theme);
 await ctx.route('**/api/**',async route=>{const req=route.request();let u=req.url();if(/\/api\/trends(\?|$)/.test(u))u+=(u.includes('?')?'&':'?')+'variant=parcial';const hit=await respond(u,req.method(),req.postData());return hit?route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
 const open=async(route)=>{const page=await ctx.newPage();await page.goto(base+route,{waitUntil:'networkidle',timeout:90000});await page.waitForTimeout(400);return page;};
 const shot=(page,name)=>page.screenshot({path:path.join(out,`${name}-${w}-${theme}.png`)});
 console.log(`== ${w}px ${theme}${internal?' (interno)':''}`);
 // 1) Ya no hay barra global en ninguna pantalla del espacio (ni en /preguntale); nada desborda; el título sigue en el encabezado de cada pantalla.
 for(const route of ['/overview','/problems','/cfo','/imports','/settings/team','/connections','/jobs/00000000-0000-4000-8000-000000000404','/preguntale']){
  const page=await open(route+(route==='/overview'||route==='/problems'||route==='/cfo'?'?'+SCOPE:''));
  check(await page.locator('.global-bar,.workspace-top,.gb-summary').count()===0,`${route}@${w}: no debe haber barra global`);
  check(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)),`${route}@${w}: desborde horizontal de página`);
  if(route==='/cfo')await shot(page,'sin-barra-cfo');
  if(route==='/cfo'){check(w<768?true:!(await page.locator('.workspace-header').isVisible()),`/cfo@${w}: el copiloto de CFO no lleva encabezado de página`);check((await page.locator('.workspace-content h1').count())===1,`/cfo@${w}: un solo h1`);check((await page.getByRole('button',{name:'Copiloto CFO'}).count())===0,`/cfo@${w}: ya no hay cajón «Copiloto CFO»`);check(await page.locator('[data-modo=cfo] textarea').count()===1,`/cfo@${w}: el compositor del copiloto está presente`);}
  await page.close();
 }
 { const page=await open('/preguntale');
  check(!(await page.locator('.global-bar').isVisible()),`/preguntale@${w}: no debe llevar la barra global`);
  check(w<768?true:!(await page.locator('.workspace-header').isVisible()),`/preguntale@${w}: no debe llevar encabezado de página`);
  check((await page.locator('[data-testid=barra-pagina]').count())===0,`/preguntale@${w}: sin barra superior de página`);
  check((await page.locator('.workspace-content h1').allInnerTexts()).join('|')==='Pregúntale a tus datos',`/preguntale@${w}: el contenido empieza en la portada`);
  check((await page.locator('.workspace-content a:has-text("Espacio de trabajo")').count())===0,`/preguntale@${w}: ya no lleva el enlace «Espacio de trabajo»`);
  check((await page.locator('.workspace-content select').count())===0,`/preguntale@${w}: ya no lleva selector de tema propio`);
  if(w>=768){check(await page.locator('.workspace-sidebar').isVisible(),`/preguntale@${w}: falta la barra lateral de la app`);check(/Pregúntale a tus datos/.test(await page.locator('.workspace-sidebar [aria-current=page]').first().innerText()),`/preguntale@${w}: el menú no marca «Pregúntale a tus datos»`);}
  else check(await page.locator('.workspace-bottom-nav [aria-current=page]').count()===1,`/preguntale@${w}: la navegación móvil no marca Pregúntale`);
  check(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)),`/preguntale@${w}: desborde horizontal`);
  await shot(page,'preguntale');await page.close(); }
 // 2) El sidebar lleva abajo organización, avisos (con enlace a /notifications), tema claro/sistema/oscuro y cuenta, SIN solaparse con la lista de ítems, que se desplaza por dentro.
 { const page=await open('/cfo?'+SCOPE);
  if(w<768){await page.getByRole('button',{name:/^(Abrir menú|Más opciones de navegación)$/}).last().click();await page.waitForTimeout(300);}
  const root=w<768?page.locator('.mobile-sidebar'):page.locator('.workspace-sidebar');
  check(await root.locator('input[type=radio][name$="-theme"]').count()===3,`@${w}: falta el selector de tema en el sidebar`);
  check(await root.locator('a[href="/notifications"]').count()===1,`@${w}: falta «Notificaciones» en el sidebar`);
  check(w<768?await page.locator('[data-testid=selector-empresa]').count()===1:await root.locator('.organization-switch,.workspace-context').count()===1,`@${w}: falta la organización en el sidebar`);
  const g=await root.evaluate(r=>{const rc=s=>r.querySelector(s)?.getBoundingClientRect();const nav=rc('.sidebar-navigation'),foot=rc('.sidebar-footer'),box=r.getBoundingClientRect(),out=r.querySelector('button[aria-label="Cerrar sesión"]')?.getBoundingClientRect(),nv=r.querySelector('.sidebar-navigation');return {navBottom:nav.bottom,footTop:foot.top,footBottom:foot.bottom,boxBottom:box.bottom,outBottom:out?.bottom,outTop:out?.top,scroll:nv.scrollHeight>nv.clientHeight,ov:getComputedStyle(nv).overflowY};});
  check(g.navBottom<=g.footTop+1,`@${w}: la lista de ítems se solapa con el bloque inferior (${g.navBottom} > ${g.footTop})`);
  check(g.outBottom<=g.boxBottom+1&&g.outTop>=g.footTop-1,`@${w}: «Cerrar sesión» queda fuera del bloque inferior`);
  check(w<768||/auto|scroll/.test(g.ov),`@${w}: la lista de ítems no se desplaza por dentro`);
  await page.evaluate(()=>{for(const n of document.querySelectorAll('.sidebar-navigation'))n.scrollTop=n.scrollHeight;});await page.waitForTimeout(150);
  const last=await root.evaluate(r=>{const a=[...r.querySelectorAll('.sidebar-navigation a')].filter(x=>x.getBoundingClientRect().height>0).pop().getBoundingClientRect(),f=r.querySelector('.sidebar-footer').getBoundingClientRect();return {b:a.bottom,t:f.top};});
  check(last.b<=last.t+1,`@${w}: el último enlace (Retención) queda bajo el bloque inferior (${last.b} > ${last.t})`);
  await shot(page,'sidebar');
  // el tema se cambia desde el sidebar
  await root.locator('label:has(input[value=dark])').click();await page.waitForTimeout(150);check(await page.evaluate(()=>document.documentElement.dataset.theme)==='dark',`@${w}: el botón de tema oscuro no aplica`);
  await root.locator('label:has(input[value=light])').click();await page.waitForTimeout(150);check(await page.evaluate(()=>document.documentElement.dataset.theme)==='light',`@${w}: el botón de tema claro no aplica`);
  await page.close(); }
 // 3) (reservado: el periodo se cambia en la barra propia de cada pantalla, no en una barra global)

 // 4) Menú: grupos abiertos por defecto, estado recordado, alcance propagado, ítem activo correcto, sin Notificaciones, Interno según acceso.
 { const page=await open('/cfo?'+SCOPE);
  if(w>=768||true){
   const abrirMenu=async()=>{if(w<768){await page.getByRole('button',{name:/^(Abrir menú|Más opciones de navegación)$/}).last().click();await page.waitForTimeout(300);}};
   await abrirMenu();const root=w<768?page.locator('.mobile-sidebar'):page.locator('.workspace-sidebar');
   const toggles=root.locator('.nav-group-toggle');const n=await toggles.count();check(n===(internal?7:6),`grupos esperados ${internal?7:6}, hay ${n}`);
   const abiertos=async()=>{let k=0;for(let i=0;i<n;i++)if((await toggles.nth(i).getAttribute('aria-expanded'))==='true')k++;return k;};
   check((await abiertos())===1,`acordeón: debe haber exactamente 1 grupo abierto por defecto, hay ${await abiertos()}`);
   check((await toggles.nth(0).getAttribute('aria-expanded'))==='true',`en /overview el grupo abierto por defecto es el primero (${await toggles.nth(0).innerText()})`);
   const labels=(await root.locator('nav a').allInnerTexts()).map(t=>t.trim());
   check(!labels.includes('Notificaciones')&&!labels.includes('Gestionar problemas')&&!labels.includes('Gestión económica'),`ítems que ya no van: ${labels}`);
   check(internal===labels.includes('Evaluación histórica'),`Interno ${internal?'debía':'no debía'} verse: ${labels}`);
   const ord=['Hoy','Pregúntale a tus datos','CFO','Problemas','Mapa de problemas','Por decidir','En curso y resultados','Confianza','Explorador','Equipo'].map(x=>labels.indexOf(x));check(ord.every(x=>x>=0)&&ord.every((x,k)=>k===0||ord[k-1]<x)&&!labels.includes('Brief ejecutivo')&&!labels.includes('Recomendaciones'),`orden del menú (8 espacios): ${labels}`);
   const href=await root.locator('nav a',{hasText:'Problemas'}).first().getAttribute('href');const p=new URLSearchParams(href.split('?')[1]??'');
   check(['date_start','date_end','currency','basis','snapshot_id','scope_hash'].every(k=>p.get(k)===new URLSearchParams(SCOPE).get(k)),`el menú no propaga el alcance: ${href}`);
   {await toggles.filter({hasText:'Datos y confianza'}).click();check((await toggles.filter({hasText:'Datos y confianza'}).getAttribute('aria-expanded'))==='true','acordeón: «Datos y confianza» no se abre');check((await toggles.nth(0).getAttribute('aria-expanded'))==='false','acordeón: al abrir otro grupo se debe cerrar el anterior');check((await abiertos())===1,'acordeón: nunca más de un grupo abierto');await toggles.filter({hasText:'Datos y confianza'}).click();check((await abiertos())===0,'acordeón: pulsar el grupo abierto lo cierra');}
   await shot(page,'menu');
  }
  await page.close(); }
 for(const [route,activo] of [['/jobs/00000000-0000-4000-8000-000000000001','Importaciones'],['/problems/manage','Problemas'],['/analysis','Análisis'],['/economics','Preparar'],['/settings/notification-delivery','Preferencias de avisos']]){
  const page=await open(route);if(w<768){await page.getByRole('button',{name:/^(Abrir menú|Más opciones de navegación)$/}).last().click();await page.waitForTimeout(300);}
  const root=w<768?page.locator('.mobile-sidebar'):page.locator('.workspace-sidebar');const cur=await root.locator('nav a[aria-current=page]').allInnerTexts();
  check(cur.length===1&&cur[0].trim()===(activo==='Preferencias de avisos'?'Avisos':activo)||(route.startsWith('/settings')&&cur.length===1),`${route}@${w}: ítem activo ${JSON.stringify(cur)} != ${activo}`);
  if(route==='/problems/manage'){check(await page.locator('.tabs a[aria-current=page]').innerText()==='Gestionar','pestaña Gestionar no activa');check(await page.locator('.tabs a').count()===2,'faltan las pestañas de Problemas');}
  await page.close();
 }
 // 5) Carga inexistente: pantalla amable.
 { const page=await open('/jobs/00000000-0000-4000-8000-000000000404');const t=await page.locator('.workspace-content').innerText();
  check(/Esta carga no existe o ya no está disponible/.test(t),'falta el mensaje amable');check(!/404|JOB_NOT_FOUND|Cargando estado real/.test(t),`quedan restos técnicos: ${t.slice(0,160)}`);check(await page.getByRole('link',{name:'Volver a importaciones'}).count()>=1,'falta volver a importaciones');await shot(page,'jobs-inexistente');await page.close(); }
 // 6) Pantallas internas.
 for(const route of ['/evaluation','/evaluation/candidates','/migrations']){
  const page=await open(route);const t=await page.locator('.workspace-content').innerText();
  if(internal)check(!/Esta sección es de uso interno/.test(t),`${route}: el equipo interno no debe ver el aviso`);
  else{check(/Esta sección es de uso interno/.test(t),`${route}: falta el aviso`);check(await page.getByRole('link',{name:'Ir a Hoy'}).count()===1,`${route}: falta el enlace a Hoy`);}
  if(route==='/evaluation')await shot(page,'interno');await page.close();
 }
 await ctx.close();
}
await browser.close();
console.log(fails.length?`FAIL: ${fails.length} comprobaciones`:'PASS: navegación y sidebar');process.exit(fails.length?1:0);
