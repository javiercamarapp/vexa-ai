// E2E «ir y volver» de la caché stale-while-revalidate, contra fixtures sintéticos y con latencia artificial en las lecturas.
//   VEXA_UI_FIXTURES=1 next dev -p 3139   (otra terminal)   luego
//   NODE_PATH=<dir con playwright-core>/node_modules [THEME=dark] node apps/web/tests/ui/cache.mjs [baseUrl] [outDir]
// Comprueba, con 1,2 s de latencia por lectura: (1) la primera carga no pinta «No disponible ahora» mientras la lectura está en vuelo;
// (2) tras cargar el Resumen se precalientan las pantallas principales con tope de concurrencia 2; (3) la segunda visita (fresca) pinta al instante,
// sin esqueleto vacío y sin pedir de nuevo; (4) con la caché obsoleta (+6 min) pinta al instante rotulada «Actualizando…» y revalida sin vaciar;
// (5) si la revalidación falla conserva el dato rotulado, nunca «No disponible ahora»; (6) cerrar sesión borra la caché. Sale 1 si algo falla.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require('playwright-core');
const {respond}=await import('./fixtures.mjs');
const base=process.argv[2]??'http://localhost:3139',out=process.argv[3]??path.resolve('ui-captures-cache');fs.mkdirSync(out,{recursive:true});
const theme=process.env.THEME??'light',LAT=Number(process.env.LAT??1200);
const SCOPE='date_start=2026-08-01&date_end=2026-09-21&currency=USD&basis=marketplace_line_price&snapshot_id=00000000-0000-4000-8000-0000000000aa&scope_hash=abc123';
const fails=[],medidas=[];const check=(ok,msg)=>{if(!ok){fails.push(msg);console.log('   - FALLA: '+msg);}else console.log('   ok: '+msg);};
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch();
// ---- calentamiento: compila las rutas de `next dev` para que la medición no incluya compilación ----
{const ctx=await browser.newContext({viewport:{width:1440,height:900}});await ctx.route('**/api/**',async route=>{const req=route.request();const hit=await respond(req.url(),req.method(),req.postData());return hit?route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}):route.fulfill({status:503,contentType:'application/json',body:'{}'});});
 const p=await ctx.newPage();for(const r of ['/overview','/problems','/recommendations','/briefs','/explorer','/cfo','/connections'])await p.goto(base+r+'?'+SCOPE,{waitUntil:'networkidle',timeout:180000}).catch(()=>{});await ctx.close();}
const estado={extra:{},lat:0,falla:false,enVuelo:0,max:0,log:[]};
const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{/* opcional */}window.__off=0;const n=Date.now.bind(Date);Date.now=()=>n()+window.__off;
 // Observador de la primera carga: ¿alguna vez los KPI o la franja dijeron «No disponible ahora» / «…» mientras las lecturas seguían en vuelo?
 window.__obs={sawSkel:false,sawNA:false,sawDots:false,n:0};
 const mira=()=>{const k=document.querySelector('[aria-label="Indicadores principales"]'),f=document.querySelector('[aria-label="Estado de los datos"]');if(k){window.__obs.n++;if(k.querySelector('.skel-inline'))window.__obs.sawSkel=true;if(/No disponible ahora/.test(k.innerText))window.__obs.sawNA=true;}
  if(f&&/Fuentes con datos:\s*(…|No disponible)/.test(f.innerText)&&window.__obs.pendiente!==false)window.__obs.sawDots=true;};
 new MutationObserver(mira).observe(document,{subtree:true,childList:true,characterData:true,attributes:true});},theme);
const atender=async(route,esCfo)=>{const req=route.request();const u=req.url();estado.enVuelo++;estado.max=Math.max(estado.max,estado.enVuelo);const reg={t:performance.now(),fin:null,url:u.replace(base,''),m:req.method()};estado.log.push(reg);
 try{if(estado.lat)await dormir(estado.lat+(Object.entries(estado.extra).find(([k])=>u.includes(k))?.[1]??0));
  if(estado.falla)return await route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"x"}}'});
  if(esCfo)return await route.continue();
  const hit=await respond(u,req.method(),req.postData());return await route.fulfill(hit?{status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}:{status:503,contentType:'application/json',body:'{"error":{"code":"fixture_missing"}}'});
 }catch{/* página cerrada */}finally{estado.enVuelo--;reg.fin=performance.now();}};
await ctx.route('**/api/**',r=>atender(r,false));await ctx.route('**/cfo/data/report**',r=>atender(r,true));
await ctx.route('**/auth/logout',route=>route.fulfill({status:303,headers:{location:'/login'},body:''}));
const page=await ctx.newPage();const errores=[];page.on('pageerror',e=>errores.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|fixture_missing|503/.test(m.text()))errores.push(m.text().slice(0,200));});
const claves=()=>page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('vexa:swr:')).length);
const muestrear=async(destino,esperaMs,accion)=>{
 await page.evaluate(d=>{window.__s={t0:performance.now(),frames:[],stop:false};const f=()=>{const root=document.querySelector('.workspace-content');
  const fb=!!root?.querySelector('.state-loading');const sel='.skeleton,.skel-chart,.wait-status,.skel-rows,:not(button)[aria-busy="true"]';const todos=root?[...root.querySelectorAll(sel)].filter(e=>!e.closest('.state-loading')):[];const q=todos[0];
  window.__s.frames.push({t:performance.now()-window.__s.t0,quien:q?(q.className||q.tagName)+' <'+(q.parentElement?.className||q.parentElement?.tagName)+'>':null,ruta:location.pathname===d,fb,cargando:todos.length,len:root?root.innerText.length:0,linea:root?.querySelector('[data-testid=linea-cache]')?.textContent??null});if(!window.__s.stop)requestAnimationFrame(f);};requestAnimationFrame(f);},destino);
 await accion();await dormir(esperaMs);
 const fr=await page.evaluate(()=>{window.__s.stop=true;return window.__s.frames;});
 const enRuta=fr.filter(f=>f.ruta),listo=enRuta.find(f=>f.cargando===0&&!f.fb&&f.len>600),primera=enRuta[0],ultFb=[...enRuta].reverse().find(f=>f.fb);
 const ini=primera?.t??0;return {viajeMs:ultFb?Math.round(ultFb.t-ini):0,pintadoMs:listo?Math.round(listo.t-Math.max(ini,ultFb?.t??ini)):null,quien:enRuta.filter(f=>listo&&f.t<listo.t&&f.cargando>0).map(f=>f.quien).filter(Boolean).slice(0,2).join(' ; '),tListo:listo?Math.round(listo.t):null,esqueletoAntes:listo?enRuta.filter(f=>f.t<listo.t&&f.cargando>0&&!f.fb).length:enRuta.length,primeraLinea:enRuta.find(f=>f.linea)?.linea??null,ultimaLinea:enRuta.at(-1)?.linea??null,primeraCargando:primera?.cargando??null,nFrames:fr.length};
};
const irMenu=async(ruta)=>{const a=page.locator(`.workspace-sidebar nav a[href^="${ruta}"]`).first();if(!(await a.isVisible())){await page.locator('.workspace-sidebar .nav-group').filter({has:a}).locator('.nav-group-toggle').click();}await a.click();};
const KPI='[aria-label="Indicadores principales"]';
console.log(`== caché stale-while-revalidate · ${theme} · latencia ${LAT} ms por lectura`);
// 1) Primera carga del Resumen con latencia: nada de «No disponible ahora» mientras hay lecturas en vuelo.
estado.lat=LAT;estado.extra={'/api/trends':2500};const t0=Date.now();await page.goto(base+'/overview?'+SCOPE,{waitUntil:'domcontentloaded',timeout:120000});
await page.locator(KPI).first().waitFor({timeout:60000});
const obs=await page.evaluate(()=>window.__obs);console.log('   observador (1.ª carga):',JSON.stringify(obs));
check(obs.sawSkel,'los KPI mostraron esqueleto mientras la lectura estaba en vuelo');
check(!obs.sawNA,'los KPI nunca dijeron «No disponible ahora» con la lectura en vuelo');
check(!obs.sawDots,'la franja nunca dijo «Fuentes con datos: …» ni «No disponible» con la lectura en vuelo');
await page.waitForFunction(()=>!document.querySelector('.workspace-content :not(button)[aria-busy="true"]')&&document.querySelectorAll('.workspace-content .skel-inline').length===0,null,{timeout:60000});
estado.extra={};const tPrimera=Date.now()-t0;medidas.push(['Resumen, primera carga (con '+LAT+' ms por lectura)',tPrimera+' ms']);
await page.screenshot({path:path.join(out,`cache-overview-1a-${theme}.png`),fullPage:false});
check((await claves())>0,'la caché guardó lecturas en sessionStorage ('+(await claves())+' claves)');
// 2) Precalentamiento: las pantallas principales se piden solas, de a 2 como máximo, con el Resumen ya quieto.
await dormir(LAT*6+2500);
{const urls=estado.log.map(l=>l.url);
 // Prefetch = lecturas que empiezan cuando las propias del Resumen (tendencias, cobertura, categorías, problemas slim) ya terminaron.
 const propias=estado.log.filter(l=>/\/api\/(trends|coverage)|slim=1/.test(l.url)),finPropias=Math.max(...propias.map(l=>l.fin??0));
 const pre=estado.log.filter(l=>l.t>=finPropias-5&&!propias.includes(l)&&l.m==='GET');
 console.log('   precalentadas:',pre.map(l=>l.url.slice(0,60)).join(' | '));
 check(pre.some(l=>/\/api\/workspace\?.*resource=problems/.test(l.url)&&!/slim=1|meta_only/.test(l.url)),'precalienta Problemas');
 check(pre.some(l=>l.url.startsWith('/api/recommendations?')),'precalienta Recomendaciones (alcance fijado → datos)');
 check(pre.some(l=>l.url.startsWith('/api/briefs?')),'precalienta el Brief');
 check(pre.some(l=>l.url.startsWith('/cfo/data/report')),'precalienta Dinero (CFO)');
 check(pre.length===new Set(pre.map(l=>l.url)).size,'sin lecturas duplicadas');
 let max=0;for(const a of pre){const n=pre.filter(b=>b.t<(a.fin??a.t)&&(b.fin??1e15)>a.t).length;max=Math.max(max,n);}
 check(max<=2,'tope de concurrencia ≤ 2 (máximo observado '+max+')');
 void urls;}
// 3) Ir y volver (fresca): segunda visita instantánea, sin esqueleto, sin red.
const PANTALLAS=[['Problemas','/problems'],['Por decidir','/recommendations'],['Explorador','/explorer'],['Dinero','/cfo'],['Fuentes conectadas','/connections']];
const primeras={};
for(const [,ruta] of PANTALLAS){
 const m1=await muestrear(ruta,LAT*4+1500,()=>irMenu(ruta));primeras[ruta]=m1;
 await irMenu('/overview');await dormir(400);
}
// Segunda visita
for(const [menu,ruta] of PANTALLAS){
 estado.log.length=0;
 const m=await muestrear(ruta,500,()=>irMenu(ruta));
 const pedidasL=estado.log.filter(l=>(l.url.includes('/api/')||l.url.includes('/cfo/data'))&&!/\/api\/notifications|\/api\/connections\/settings/.test(l.url)),pedidas=pedidasL.length;if(pedidas)console.log('     pedidas:',pedidasL.map(l=>l.url.slice(0,80)).join(' | '));
 console.log(`   ${menu}: 1.ª ${primeras[ruta].tListo??'—'} ms · 2.ª ${m.tListo??'—'} ms (viaje de página ${m.viajeMs} ms + datos pintados ${m.pintadoMs} ms) · esqueleto de datos ${m.esqueletoAntes} fotogramas (${m.quien}) · lecturas ${pedidas} · «${(m.primeraLinea??'').slice(0,60)}»`);
 medidas.push([`${menu}, segunda visita (fresca)`,`${m.pintadoMs??'sin contenido'} ms de datos tras montar la página (+ ${m.viajeMs} ms de viaje de página); 1.ª visita ${primeras[ruta].tListo??'—'} ms (la de Problemas, Recomendaciones, Brief y Dinero ya venía precalentada)`]);
 check(m.pintadoMs!==null&&m.pintadoMs<250,`${menu}: con la página montada, los datos se pintan al instante (<250 ms; ${m.pintadoMs} ms)`);
 check(m.esqueletoAntes===0,`${menu}: ningún fotograma de esqueleto de datos (${m.esqueletoAntes}: ${m.quien})`);
 check(pedidas===0,`${menu}: dato fresco no vuelve a pedirse (${pedidas} lecturas)`);
 if(ruta==='/problems')await page.screenshot({path:path.join(out,`cache-problems-2a-${theme}.png`)});
 await irMenu('/overview');await dormir(300);
}
// Resumen de vuelta (fresco): rotulado y sin pedir.
{await irMenu('/problems');await dormir(500);estado.log.length=0;const m=await muestrear('/overview',500,()=>irMenu('/overview'));
 medidas.push(['Resumen, segunda visita (fresca)',`${m.pintadoMs??'sin contenido'} ms de datos tras montar (+ ${m.viajeMs} ms de viaje de página)`]);
 check(m.pintadoMs!==null&&m.pintadoMs<250,`Resumen: datos pintados al instante tras montar (${m.pintadoMs} ms; viaje de página ${m.viajeMs} ms)`);check(m.esqueletoAntes===0,'Resumen: sin esqueleto antes del contenido ('+m.esqueletoAntes+')');
 check(/^Mostrando la última carga \(hace \d+ (s|min)\)/.test(m.primeraLinea??''),'Resumen: rotulado con su antigüedad: «'+(m.primeraLinea??'')+'»');
 await page.screenshot({path:path.join(out,`cache-overview-2a-${theme}.png`)});}
// 4) Caché obsoleta (+6 min): pinta al instante, rotulada «Actualizando…», revalida sin vaciar.
await page.evaluate(()=>{window.__off=6*60*1000;});
{estado.log.length=0;await irMenu('/problems');await dormir(200);
 const m=await muestrear('/overview',LAT*3+1500,()=>irMenu('/overview'));
 medidas.push(['Resumen, caché obsoleta (+6 min)',`${m.pintadoMs??'sin contenido'} ms de datos tras montar (+ ${m.viajeMs} ms de viaje); revalida en segundo plano`]);
 check(m.pintadoMs!==null&&m.pintadoMs<250,`obsoleta: pinta ya (${m.pintadoMs} ms tras montar)`);check(m.esqueletoAntes===0,'obsoleta: sin esqueleto vacío ('+m.esqueletoAntes+')');
 check(/Actualizando…/.test(m.primeraLinea??''),'obsoleta: «Actualizando…» ('+(m.primeraLinea??'')+')');
 const pedidas=estado.log.filter(l=>/\/api\/(workspace|trends|coverage)/.test(l.url)).length;check(pedidas>0,'obsoleta: revalida en segundo plano ('+pedidas+' lecturas)');
 check(!/Actualizando…/.test(m.ultimaLinea??'')&&!/hace/.test(m.ultimaLinea??'x hace')||m.ultimaLinea===null||!/Actualizando…/.test(m.ultimaLinea),'tras revalidar desaparece «Actualizando…»');
}
// 5) Si la revalidación falla: se conserva el dato, rotulado; nunca «No disponible ahora» nuevo.
{await page.evaluate(()=>{window.__off=40*60*1000-20*60*1000;});// edad real ~ 14 min: obsoleta pero viva
 await irMenu('/problems');await dormir(300);
 const antes=(await page.locator('.workspace-content').innerText()).match(/No disponible ahora/g)?.length??0;
 estado.lat=0;estado.falla=true;
 const m=await muestrear('/overview',2500,()=>irMenu('/overview'));
 const texto=await page.locator('.workspace-content').innerText(),despues=(texto.match(/No disponible ahora/g)??[]).length;
 console.log('   línea tras fallo:',(await page.locator('[data-testid=linea-cache]').first().textContent().catch(()=>null)));
 check(m.pintadoMs!==null&&m.pintadoMs<250,'fallo: el dato viejo se pinta igual ('+m.pintadoMs+' ms tras montar)');
 check(/No se pudo actualizar ahora; se conserva este dato/.test(texto),'fallo: rotula «No se pudo actualizar ahora; se conserva este dato»');
 check(despues<=antes+0||despues===0,`fallo: no aparece «No disponible ahora» nuevo (${antes} → ${despues})`);
 await page.screenshot({path:path.join(out,`cache-overview-fallo-${theme}.png`)});estado.falla=false;}
// 6) Cerrar sesión borra la caché.
{estado.lat=0;check((await claves())>0,'antes de cerrar sesión hay lecturas guardadas');
 await Promise.all([page.waitForURL('**/login**',{timeout:30000}).catch(()=>{}),page.locator('form[action="/auth/logout"] button').first().click()]);
 await dormir(1500);check((await claves())===0,'cerrar sesión borra las lecturas guardadas ('+(await claves())+' restantes)');}
check(errores.length===0,'sin errores de consola/página'+(errores.length?': '+errores.slice(0,3).join(' | '):''));
console.log('\nTiempos medidos:\n'+medidas.map(([a,b])=>' - '+a+': '+b).join('\n'));
await browser.close();
if(fails.length){console.log('\n'+fails.length+' fallas');process.exit(1);}console.log('\nOK');
