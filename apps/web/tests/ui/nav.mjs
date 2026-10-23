// Navegación y barra global contra fixtures sintéticos, a 375 / 768 / 1440 px.
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
 // 1) La barra está en todas las pantallas del espacio y no desborda; en /preguntale no hay barra.
 for(const route of ['/overview','/problems','/cfo','/imports','/settings/team','/connections','/jobs/00000000-0000-4000-8000-000000000404']){
  const page=await open(route+(route==='/overview'||route==='/problems'||route==='/cfo'?'?'+SCOPE:''));
  check(await page.locator('.global-bar').count()===1,`${route}@${w}: falta la barra global`);
  const m=await page.evaluate(()=>{const b=document.querySelector('.global-bar')?.getBoundingClientRect(),vw=document.documentElement.clientWidth;return {over:document.documentElement.scrollWidth>vw+1,right:b?Math.round(b.right):0,vw,h:b?Math.round(b.height):0,pos:getComputedStyle(document.querySelector('.workspace-top')).position};});
  check(!m.over,`${route}@${w}: desborde horizontal de página`);check(m.right<=m.vw+1,`${route}@${w}: la barra se sale del viewport`);check(m.pos==='sticky',`${route}@${w}: la barra no es fija (sticky)`);
  check(m.h<=(w>=1100?130:64),`${route}@${w}: barra demasiado alta (${m.h}px)`);
  if(route==='/cfo')await shot(page,'barra-cfo');
  await page.close();
 }
 { const page=await open('/preguntale');check(await page.locator('.global-bar').count()===0,`/preguntale@${w}: no debe llevar la barra`);await page.close(); }
 // 2) Contenido de la barra con alcance en la URL.
 { const page=await open('/cfo?'+SCOPE);
  if(w<1100){await page.locator('.gb-summary').click();await page.waitForTimeout(150);check(await page.locator('.gb-panel').isVisible(),`compacta@${w}: el resumen tocable no abre el panel`);check((await page.locator('.gb-summary').getAttribute('aria-expanded'))==='true','móvil: aria-expanded');}
  else check(!(await page.locator('.gb-summary').isVisible()),`@${w}: el resumen móvil no debe verse`);
  const txt=await page.locator('.global-bar').innerText();
  check(/1 ago – 20 sep 2026/.test(txt),`periodo legible ausente: ${txt.replace(/\n/g,' | ').slice(0,200)}`);check(/USD/.test(txt),'moneda ausente');check(/Precio de línea de marketplace/.test(txt),'base legible ausente');check(!/marketplace_line_price/.test(txt),'la base se ve en jerga');
  check(/Libro económico\s*5 oct 2026/.test(txt)&&/Conversaciones\s*18 oct 2026/.test(txt),`«Datos hasta» por fuente ausente: ${txt.replace(/\n/g,' | ').slice(0,300)}`);
  check(await page.locator('.global-bar a[href="/notifications"]').count()===1,'campana ausente');
  check(await page.locator('.global-bar input[name=global-theme]').count()===3,'selector de tema ausente');
  check(await page.locator('.global-bar [class*=gb-org]').count()>=1,'organización ausente');
  if(w<1100)await shot(page,'barra-abierta');
  await page.close(); }
 // 3) Cambiar el periodo conserva moneda y base y suelta la publicación fijada.
 if(w>=768){const page=await open('/problems?'+SCOPE);if(w<1100)await page.locator('.gb-summary').click();await page.locator('.gb-select').selectOption('30d');await page.waitForTimeout(800);const u=new URL(page.url());check(u.pathname==='/problems'&&u.searchParams.get('currency')==='USD'&&u.searchParams.get('basis')==='marketplace_line_price'&&!u.searchParams.has('snapshot_id')&&u.searchParams.get('date_start')!=='2026-08-01',`cambio de periodo: URL ${u.search}`);await page.close();}
 // 4) Menú: grupos abiertos por defecto, estado recordado, alcance propagado, ítem activo correcto, sin Notificaciones, Interno según acceso.
 { const page=await open('/cfo?'+SCOPE);
  if(w>=768||true){
   const abrirMenu=async()=>{if(w<768){await page.getByRole('button',{name:'Abrir menú'}).click();await page.waitForTimeout(300);}};
   await abrirMenu();const root=w<768?page.locator('.mobile-sidebar'):page.locator('.workspace-sidebar');
   const toggles=root.locator('.nav-group-toggle');const n=await toggles.count();check(n===(internal?5:4)-0||n===(internal?5:4)+0,`grupos esperados ${internal?5:4}, hay ${n}`);
   for(let i=0;i<n;i++)check((await toggles.nth(i).getAttribute('aria-expanded'))==='true',`grupo ${i} no está abierto por defecto`);
   const labels=(await root.locator('nav a').allInnerTexts()).map(t=>t.trim());
   check(!labels.includes('Notificaciones')&&!labels.includes('Gestionar problemas')&&!labels.includes('Gestión económica'),`ítems que ya no van: ${labels}`);
   check(internal===labels.includes('Evaluación histórica'),`Interno ${internal?'debía':'no debía'} verse: ${labels}`);
   check(labels.indexOf('Resumen')<labels.indexOf('Problemas')&&labels.indexOf('Problemas')<labels.indexOf('Panorama')&&labels.indexOf('Panorama')<labels.indexOf('Recomendaciones')&&labels.indexOf('Acciones')<labels.indexOf('Explorador')&&labels.indexOf('Brief ejecutivo')<labels.indexOf('Fuentes'),`orden del menú: ${labels}`);
   const href=await root.locator('nav a',{hasText:'Problemas'}).first().getAttribute('href');const p=new URLSearchParams(href.split('?')[1]??'');
   check(['date_start','date_end','currency','basis','snapshot_id','scope_hash'].every(k=>p.get(k)===new URLSearchParams(SCOPE).get(k)),`el menú no propaga el alcance: ${href}`);
   if(w>=768){await toggles.filter({hasText:'Datos y fuentes'}).click();check((await toggles.filter({hasText:'Datos y fuentes'}).getAttribute('aria-expanded'))==='false','el grupo no se cierra');await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(500);check((await page.locator('.workspace-sidebar .nav-group-toggle',{hasText:'Datos y fuentes'}).getAttribute('aria-expanded'))==='false','el grupo cerrado no se recuerda');await page.evaluate(()=>localStorage.removeItem('vexa-nav-cerrados'));}
   await shot(page,'menu');
  }
  await page.close(); }
 for(const [route,activo] of [['/jobs/00000000-0000-4000-8000-000000000001','Importaciones'],['/problems/manage','Problemas'],['/analysis','Análisis'],['/economics','Preparar'],['/settings/notification-delivery','Preferencias de avisos']]){
  const page=await open(route);if(w<768){await page.getByRole('button',{name:'Abrir menú'}).click();await page.waitForTimeout(300);}
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
  else{check(/Esta sección es de uso interno/.test(t),`${route}: falta el aviso`);check(await page.getByRole('link',{name:'Ir al Resumen'}).count()===1,`${route}: falta el enlace al Resumen`);}
  if(route==='/evaluation')await shot(page,'interno');await page.close();
 }
 await ctx.close();
}
await browser.close();
console.log(fails.length?`FAIL: ${fails.length} comprobaciones`:'PASS: navegación y barra global');process.exit(fails.length?1:0);
