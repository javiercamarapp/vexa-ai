// Arranque limpio: con respuestas lentas, durante la carga/recarga SOLO se ve el logo animado (sin encabezado global, pie, sidebar ni contenido) y luego aparece todo.
//   VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev -p 3230   (otra terminal)
//   node tests/ui/arranque.mjs [baseUrl] [dirCapturas]      Sale 1 si algo falla.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');const {chromium}=require('playwright-core');
const {respond}=await import('./fixtures.mjs');
const base=process.argv[2]??'http://localhost:3230',out=process.argv[3]??path.resolve('arranque-capturas');fs.mkdirSync(out,{recursive:true});
const fails=[];const check=(ok,msg)=>{console.log((ok?'   ok: ':'   FALLA: ')+msg);if(!ok)fails.push(msg);};
/** Muestreador en la página: cada fotograma anota violaciones. */
const MUESTREADOR=`(()=>{const v=window.__viol=[];window.__muestras={arranque:0,carga:0,logo1:0};
 const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden';};
 const todos=s=>[...document.querySelectorAll(s)].filter(vis);
 const tick=()=>{const raiz=document.documentElement,arr=!!raiz.dataset.arranque,carga=todos('.rovaq-cargando:not(.rovaq-cargando-compacto)').length>0;
  const logos=todos('.rovaq-respira').length;
  if(arr){window.__muestras.arranque++;for(const s of ['.site-header','.site-footer','.workspace-sidebar','.sidebar-logo','.workspace-header','main'])if(todos(s).length)v.push('arranque: visible '+s);if(logos!==1)v.push('arranque: logos animados='+logos);}
  if(carga){window.__muestras.carga++;if(todos('.hoy-kpis,.hoy-titular,.hoy-card,.hoy-kpi').length)v.push('carga: contenido visible junto al logo');if(todos('.site-header,.site-footer').length)v.push('carga: encabezado/pie global visible');if(logos!==1)v.push('carga: logos animados='+logos);}
  if(arr||carga)window.__muestras.logo1++;
  requestAnimationFrame(tick);};requestAnimationFrame(tick);})();`;
const browser=await chromium.launch();
for(const [w,h] of [[1440,900],[390,844]]){
 const ctx=await browser.newContext({viewport:{width:w,height:h}});
 await ctx.addInitScript(MUESTREADOR);
 await ctx.route(/\/(api|cfo\/data)\//,async route=>{const req=route.request(),u=req.url();
  const demora=/cfo\/data/.test(u)?3000:/workload/.test(u)?1800:900; // bloques con tiempos distintos
  const hit=await respond(u,req.method(),req.postData());await new Promise(r=>setTimeout(r,demora));
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
  console.log(`== ${w}px: navegación interna (sidebar sigue visible)`);
  await page.evaluate(()=>{window.__viol.length=0;window.__lado=[];const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};const f=()=>{const s=document.querySelector('.workspace-sidebar');window.__lado.push(!!s&&vis(s)&&getComputedStyle(s).display!=='none');requestAnimationFrame(f);};f();});
  await page.locator('.workspace-sidebar a[href^="/cfo"]').first().click();
  await page.waitForTimeout(500);await page.screenshot({path:path.join(out,`4-navegacion-interna-${w}.png`)});
  await page.waitForFunction(()=>location.pathname==='/cfo');await page.waitForTimeout(4500);
  const nav=await page.evaluate(()=>({lado:window.__lado.every(Boolean),n:window.__lado.length,viol:[...new Set(window.__viol)],arr:!!document.documentElement.dataset.arranque}));
  check(nav.lado&&nav.n>10,`${w}: sidebar visible en TODOS los fotogramas de la navegación interna (${nav.n})`);
  check(!nav.arr,`${w}: la navegación interna no reactiva el arranque`);
  check(nav.viol.length===0,`${w}: navegación interna sin violaciones ${JSON.stringify(nav.viol)}`);
 }
 await ctx.close();
}
await browser.close();
console.log(fails.length?`\n${fails.length} FALLAS`:'\nTODO OK');process.exit(fails.length?1:0);
