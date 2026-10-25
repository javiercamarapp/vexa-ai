// Arranque limpio: con respuestas lentas, durante la carga/recarga SOLO se ve el logo animado (sin encabezado global, pie, sidebar ni contenido) y luego aparece todo.
//   VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev -p 3230   (otra terminal)
//   Para reproducir la cadena real (HTML del servidor antes que el espacio de trabajo, frontera Suspense pendiente) arrancar el servidor ADEMÁS con VEXA_UI_LAYOUT_DELAY_MS=2500.
//   node tests/ui/arranque.mjs [baseUrl] [dirCapturas]      Sale 1 si algo falla.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');const {chromium}=require('playwright-core');
const {respond}=await import('./fixtures.mjs');
const base=process.argv[2]??'http://localhost:3230',out=process.argv[3]??path.resolve('arranque-capturas');fs.mkdirSync(out,{recursive:true});
const fails=[];const check=(ok,msg)=>{console.log((ok?'   ok: ':'   FALLA: ')+msg);if(!ok)fails.push(msg);};
/** Muestreador en la página: cada fotograma anota violaciones. */
const MUESTREADOR=`(()=>{const v=window.__viol=[];window.__muestras={arranque:0,carga:0,logo1:0,tras:0};
 const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden';};
 const todos=s=>[...document.querySelectorAll(s)].filter(vis);
 const tick=()=>{const raiz=document.documentElement,arr=!!raiz.dataset.arranque,carga=todos('.rovaq-cargando:not(.rovaq-cargando-compacto)').length>0;
  const logos=todos('.rovaq-respira').length;
  if(arr){window.__muestras.arranque++;for(const s of ['.site-header','.site-footer','.workspace-sidebar','.sidebar-logo','.workspace-header','main'])if(todos(s).length)v.push('arranque: visible '+s);if(logos!==1)v.push('arranque: logos animados='+logos);}
  if(carga){window.__muestras.carga++;if(todos('.hoy-kpis,.hoy-titular,.hoy-card,.hoy-kpi').length)v.push('carga: contenido visible junto al logo');if(todos('.site-header,.site-footer').length)v.push('carga: encabezado/pie global visible');if(logos!==1)v.push('carga: logos animados='+logos);}
  if(window.__soloArranque!==false&&!arr&&carga&&todos('.workspace-sidebar,.workspace-header').length){window.__muestras.tras++;v.push('tras soltar el arranque aún hay logo de carga con sidebar/encabezado (liberación prematura)');}
  if(arr||carga)window.__muestras.logo1++;
  requestAnimationFrame(tick);};requestAnimationFrame(tick);})();`;
const browser=await chromium.launch();
for(const [w,h] of [[1440,900],[390,844]]){
 const ctx=await browser.newContext({viewport:{width:w,height:h}});
 await ctx.addInitScript(MUESTREADOR);
 await ctx.route(/\/(api|cfo\/data)\//,async route=>{const req=route.request(),u=req.url();
  const demora=/cfo\/data/.test(u)?3000:/workload/.test(u)?1800:900; // bloques con tiempos distintos
  let hit=await respond(u,req.method(),req.postData());if(!hit&&/cfo\/data\/report/.test(u))hit=[200,{data:{status:'empty'}}];await new Promise(r=>setTimeout(r,demora));
  return hit?route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
 const page=await ctx.newPage();
 console.log(`== ${w}px: carga inicial /overview`);
 await page.goto(base+'/overview',{waitUntil:'commit',timeout:120000});
 await page.waitForSelector('#arranque-logo',{state:'attached',timeout:60000});
 await page.waitForTimeout(700);
 await page.screenshot({path:path.join(out,`1-arranque-${w}.png`)});
 check(await page.evaluate(()=>!!document.documentElement.dataset.arranque||!!document.querySelector('.rovaq-cargando')),`${w}: durante la espera hay arranque o logo de carga`);
 await page.waitForSelector('.hoy-kpis',{timeout:60000});
 await page.waitForTimeout(500);
 const fin=await page.evaluate(()=>{const vis=s=>[...document.querySelectorAll(s)].some(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none';});
  return {arr:!!document.documentElement.dataset.arranque,carga:vis('.rovaq-cargando:not(.rovaq-cargando-compacto)'),header:vis('.site-header'),footer:vis('.site-footer'),side:vis('.workspace-sidebar'),kpis:vis('.hoy-kpis'),viol:[...new Set(window.__viol)],m:window.__muestras};});
 await page.screenshot({path:path.join(out,`2-listo-${w}.png`)});
 check(!fin.arr&&!fin.carga,`${w}: al terminar no queda arranque ni logo`);
 check(!fin.header&&!fin.footer,`${w}: nunca queda encabezado/pie global`);
 check(w<900||fin.side,`${w}: sidebar visible al terminar`);
 check(fin.kpis,`${w}: contenido completo al terminar`);
 check(fin.m.arranque+fin.m.carga>3,`${w}: el muestreador vio la espera (${fin.m.arranque} fotogramas de arranque, ${fin.m.carga} de carga)`);
 check(fin.viol.length===0,`${w}: sin violaciones durante la espera ${JSON.stringify(fin.viol)}`);
 console.log(`== ${w}px: recarga`);
 await page.evaluate(()=>{window.__viol.length=0;});
 await page.reload({waitUntil:'commit'});await page.waitForSelector('#arranque-logo',{state:'attached'});await page.waitForTimeout(500);
 await page.screenshot({path:path.join(out,`3-recarga-${w}.png`)});
 await page.waitForSelector('.hoy-kpis',{timeout:60000});await page.waitForTimeout(400);
 const v2=await page.evaluate(()=>[...new Set(window.__viol)]);check(v2.length===0,`${w}: recarga sin violaciones ${JSON.stringify(v2)}`);
 if(w>=900){
  console.log(`== ${w}px: navegación interna (sidebar visible o capa única completa)`);
  await page.evaluate(()=>{window.__soloArranque=false;window.__viol.length=0;window.__lado=[];const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};const f=()=>{const s=document.querySelector('.workspace-sidebar');window.__lado.push((!!s&&vis(s)&&getComputedStyle(s).display!=='none')||(document.documentElement.dataset.arranque==='1'));requestAnimationFrame(f);};f();});
  await page.locator('.workspace-sidebar a[href^="/cfo"]').first().click();
  await page.waitForTimeout(500);await page.screenshot({path:path.join(out,`4-navegacion-interna-${w}.png`)});
  await page.waitForFunction(()=>location.pathname==='/cfo');await page.waitForTimeout(4500);
  const nav=await page.evaluate(()=>({lado:window.__lado.every(Boolean),n:window.__lado.length,viol:[...new Set(window.__viol)],arr:!!document.documentElement.dataset.arranque}));
  check(nav.lado&&nav.n>10,`${w}: sidebar visible o cubierta por la capa de carga única en TODOS los fotogramas de la navegación interna (${nav.n})`);
  check(!nav.arr,`${w}: la navegación interna no reactiva el arranque`);
  check(nav.viol.length===0,`${w}: navegación interna sin violaciones ${JSON.stringify(nav.viol)}`);
 }
 await ctx.close();
}

/** Latencias realistas por bloque de Hoy y en distinto orden (incluye el hueco entre el loader del servidor y los loaders de cliente que hacen fetch). */
const ESCENARIOS=[
 {n:'fuga 1.5 s, carga 6 s, CFO 12 s',d:{fuga:1500,workload:6000,cfo:12000}},
 {n:'CFO 1.5 s, fuga 6 s, carga 12 s',d:{fuga:6000,workload:12000,cfo:1500}},
 {n:'carga 1.5 s, CFO 6 s, fuga 12 s',d:{fuga:12000,workload:1500,cfo:6000}},
];
for(const [w,h,esc] of [[1440,900,ESCENARIOS],[390,844,ESCENARIOS.slice(0,1)]])for(const e of esc){
 console.log(`== ${w}px: latencias reales de /api/* (${e.n})`);
 const ctx=await browser.newContext({viewport:{width:w,height:h}});
 await ctx.addInitScript(MUESTREADOR);
 const pedidos=[];
 await ctx.route(/\/(api|cfo\/data)\//,async route=>{const req=route.request(),u=req.url();
  const demora=/cfo\/data/.test(u)?e.d.cfo:/workload/.test(u)?e.d.workload:/\/api\/refunds/.test(u)?e.d.fuga:400;
  let hit=await respond(u,req.method(),req.postData());if(!hit&&/cfo\/data\/report/.test(u))hit=[200,{data:{status:'empty'}}];
  pedidos.push(Date.now());await new Promise(r=>setTimeout(r,demora));
  return hit?route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
 const page=await ctx.newPage();const t0=Date.now();
 await page.goto(base+'/overview',{waitUntil:'commit',timeout:120000});
 await page.waitForSelector('#arranque-logo',{state:'attached',timeout:60000});
 // Debe seguir el arranque mientras llegan los datos más lentos: muestra a los 3 s y a los 8 s (antes de que terminen 12 s).
 const demoraMax=Math.max(e.d.fuga,e.d.workload,e.d.cfo);
 for(const ms of [3000,Math.min(8000,demoraMax-2500)]){
  await page.waitForTimeout(Math.max(0,ms-(Date.now()-t0)));
  const est=await page.evaluate(()=>{const vis=s=>[...document.querySelectorAll(s)].some(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(x).display!=='none';});
   return {arr:!!document.documentElement.dataset.arranque,logo:vis('#arranque-logo')&&getComputedStyle(document.querySelector('#arranque-logo')).visibility==='visible',side:vis('.workspace-sidebar'),top:vis('.workspace-header'),hdr:vis('.site-header'),ftr:vis('.site-footer'),kpis:vis('.hoy-kpis'),logos:[...document.querySelectorAll('.rovaq-respira')].filter(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0;}).length};});
  check(est.arr&&est.logo&&!est.side&&!est.top&&!est.hdr&&!est.ftr&&!est.kpis&&est.logos===1,`${w}px/${e.n}: a los ${Math.round((Date.now()-t0)/1000)} s sigue SOLO el logo (1 logo, sin sidebar/encabezado/pie/contenido) ${JSON.stringify(est)}`);
 }
 await page.screenshot({path:path.join(out,`5-latencias-${w}-${ESCENARIOS.indexOf(e)}.png`)});
 await page.waitForFunction(()=>!document.documentElement.dataset.arranque,null,{timeout:60000});
 const t1=Date.now()-t0;
 const fin=await page.evaluate(()=>{const vis=s=>[...document.querySelectorAll(s)].some(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(x).display!=='none';});
  return {carga:vis('.rovaq-cargando:not(.rovaq-cargando-compacto)'),kpis:vis('.hoy-kpis'),side:vis('.workspace-sidebar'),top:vis('.workspace-header'),hdr:vis('.site-header'),viol:[...new Set(window.__viol)],m:window.__muestras};});
 await page.waitForTimeout(800);
 const post=await page.evaluate(()=>({viol:[...new Set(window.__viol)],m:window.__muestras}));
 check(fin.kpis&&!fin.carga&&!fin.hdr&&(w<900||fin.side),`${w}px/${e.n}: al soltar el arranque (${t1} ms) ya está TODO (contenido de Hoy, sin logo de carga, sin encabezado global) ${JSON.stringify({...fin,viol:undefined,m:undefined})}`);
 check(t1>=demoraMax-500,`${w}px/${e.n}: no se soltó antes de que llegara el dato más lento (${t1} ms vs ${demoraMax} ms)`);
 check(post.m.tras===0&&post.m.arranque>10,`${w}px/${e.n}: ningún fotograma con logo de carga + sidebar tras soltar (${post.m.tras}); fotogramas de arranque=${post.m.arranque}`);
 check(post.viol.length===0,`${w}px/${e.n}: sin violaciones por fotograma ${JSON.stringify(post.viol)}`);
 await ctx.close();
}
await browser.close();
console.log(fails.length?`\n${fails.length} FALLAS`:'\nTODO OK');process.exit(fails.length?1:0);
