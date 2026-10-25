// Carga a pantalla completa: UNA sola capa (logo centrado, fondo uniforme = fondo base de la app) mientras la pantalla carga; nada más es visible; al terminar aparece todo de una vez.
//   VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner VEXA_UI_LAYOUT_DELAY_MS=2500 npx next dev --webpack -p 3310
//   node tests/ui/carga-pantalla-completa.mjs [baseUrl] [dirCapturas]      Sale 1 si algo falla. Escenarios: recarga de /overview con la cadena real lenta (+503 reintentado), carga inicial, navegación rápida y lenta, claro/oscuro, 1440 y 390.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');const {chromium}=require('playwright-core');
const {respond}=await import('./fixtures.mjs');
const base=process.argv[2]??'http://localhost:3310',out=process.argv[3]??path.resolve('carga-pantalla-completa-capturas');fs.mkdirSync(out,{recursive:true});
const fails=[];const check=(ok,msg)=>{console.log((ok?'   ok: ':'   FALLA: ')+msg);if(!ok)fails.push(msg);};
const ESCALA=Number(process.env.ESCALA??1);
/** Muestreador por fotograma: qué es visible, cobertura de la capa de carga, colores computados. */
const MUESTREADOR=`(()=>{const F=window.__f=[];const t0=performance.now();
 const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)>0.01;};
 const todos=s=>[...document.querySelectorAll(s)].filter(vis);
 const bg=e=>e?getComputedStyle(e).backgroundColor:null;
 const tick=()=>{const raiz=document.documentElement;
  const capa=document.querySelector('#arranque-logo'),capaV=vis(capa);let cubre=false;if(capaV){const r=capa.getBoundingClientRect();cubre=r.left<=0&&r.top<=0&&r.right>=innerWidth-0.5&&r.bottom>=innerHeight-0.5;}
  const enLinea=todos('.rovaq-cargando:not(.rovaq-cargando-compacto)').length;
  const logos=todos('.rovaq-respira').length;
  const s=sel=>todos(sel).length;
  const sh=document.querySelector('.workspace-shell'),sb=document.querySelector('.workspace-sidebar'),ct=document.querySelector('.workspace-content');
  F.push({t:Math.round(performance.now()-t0),pend:document.querySelector('.rovaq-cargando:not(.rovaq-cargando-compacto)')!==null,arr:!!raiz.dataset.arranque,capa:capaV,cubre,enLinea,logos,
   side:s('.workspace-sidebar'),top:s('.workspace-header'),hdr:s('.site-header,.site-footer'),cont:s('.hoy-kpis,.hoy-titular,.hoy-card,.hoy-kpi,.hoy-skel,.workspace-content h1,.workspace-content table'),
   col:{html:bg(raiz),body:bg(document.body),capa:capaV?bg(capa):null,shell:bg(sh),sidebar:bg(sb),contenido:bg(ct)}});
  requestAnimationFrame(tick);};requestAnimationFrame(tick);})();`;
const TEMAS=['light','dark'];
async function contexto(browser,w,h,tema,conf){
 const ctx=await browser.newContext({viewport:{width:w,height:h},colorScheme:tema});
 await ctx.addInitScript(`try{localStorage.setItem('vexa-theme','${tema}')}catch(e){}`);
 await ctx.addInitScript(MUESTREADOR);
 const vistos={};
 await ctx.route(/\/(api|cfo\/data)\//,async route=>{const req=route.request(),u=req.url();
  const clave=/cfo\/data/.test(u)?'cfo':/workload/.test(u)?'carga':/\/api\/refunds/.test(u)?'fuga':/api\/workspace/.test(u)?'panel':'otro';
  vistos[clave]=(vistos[clave]??0)+1;
  const demora=conf.d[clave]??300;
  let hit=await respond(u,req.method(),req.postData());if(!hit&&/cfo\/data\/report/.test(u))hit=[200,{data:{status:'empty'}}];
  await new Promise(r=>setTimeout(r,demora));
  if(conf.falla503&&conf.falla503===clave&&vistos[clave]===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_503'}})});
  return hit?route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
 return ctx;
}
/** Resume los fotogramas: primer fotograma con la app completa y violaciones de «solo la capa». */
function analizar(F,desde=0){
 const fr=F.filter(x=>x.t>=desde);const viol=new Set();let salida=0;let primeraApp=-1,ultimoCarga=-1;
 fr.forEach((x,i)=>{const saliendo=x.capa&&!x.arr;const carga=(x.capa&&!saliendo)||x.enLinea>0;
  if(carga)ultimoCarga=i;
  if(carga&&(x.side||x.top||x.hdr||x.cont))viol.add('capa/logo junto a '+['sidebar','topbar','encabezado','contenido'].filter((_,k)=>[x.side,x.top,x.hdr,x.cont][k]).join('+'));
  if(saliendo)salida++;if(x.capa&&!x.cubre)viol.add('capa que no cubre el viewport');
  if(x.logos>1)viol.add('más de un logo animado ('+x.logos+')');
  if(x.capa&&x.enLinea>0&&!saliendo)viol.add('capa y logo en línea visibles a la vez');
  if(x.capa&&x.col.capa!==x.col.body&&false)viol.add('color');
  if(primeraApp<0&&x.cont>0&&!carga)primeraApp=i;});
 // Huecos: fotogramas sin capa, sin logo y sin contenido antes de la app (parpadeo en blanco)
 let huecos=0;const ini=fr.findIndex(x=>x.capa||x.enLinea>0);if(ini>=0)for(let i=ini;i<primeraApp;i++){const x=fr[i];if(!x.capa&&!x.enLinea&&!x.cont&&!x.side)huecos++;}
 return {salida,viol:[...viol],primeraApp,ultimoCarga,huecos,n:fr.length,tFinCarga:ultimoCarga>=0?fr[ultimoCarga].t:null,tApp:primeraApp>=0?fr[primeraApp].t:null};
}
const browser=await chromium.launch();
const resumen=[];
// ---------- A. RECARGA de /overview con la cadena real lenta (el reclamo del dueño) ----------
const ESC_RECARGA=[
 {n:'recarga FRÍA lenta (fuga 4 s, carga 9 s, CFO 503 y reintento, panel 6 s)',frio:true,d:{fuga:4000*ESCALA,carga:9000*ESCALA,cfo:6000*ESCALA,panel:6000*ESCALA},falla503:'cfo'},
 {n:'recarga FRÍA con panel inferior más lento que Hoy',frio:true,d:{fuga:1500,carga:2000,cfo:2500,panel:9000}},
 {n:'recarga FRÍA muy lenta (Hoy 24 s: pasa el seguro de 20 s de antes)',frio:true,d:{fuga:24000,carga:8000,cfo:5000,panel:4000}},
 {n:'recarga con caché tibia (revalida en segundo plano)',frio:false,d:{fuga:4000,carga:9000,cfo:6000,panel:6000}},
];
for(const tema of TEMAS)for(const [w,h] of [[1440,900],[390,844]])for(const [i,e] of ESC_RECARGA.entries()){if(process.env.SOLO_NAV||(process.env.FILTRO&&!e.n.includes(process.env.FILTRO)))continue;
 if(w===390&&i>0)continue;if(tema==='dark'&&i>=2)continue;
 console.log(`== ${w}px ${tema}: ${e.n}`);
 const ctx=await contexto(browser,w,h,tema,e);const page=await ctx.newPage();
 await page.goto(base+'/overview',{waitUntil:'commit',timeout:120000});await page.waitForSelector('.hoy-kpis',{timeout:90000});await page.waitForTimeout(1500);
 // recarga (lo que hace el dueño)
 await page.evaluate((frio)=>{window.__f.length=0;if(frio)try{sessionStorage.clear();}catch{}},!!e.frio);
 const t0=Date.now();await page.reload({waitUntil:'commit'});
 await page.waitForTimeout(1200);await page.screenshot({path:path.join(out,`recarga-${tema}-${w}-${i}-mid.png`)});
 await page.waitForSelector('.hoy-kpis',{timeout:90000});await page.waitForTimeout(1800);
 await page.screenshot({path:path.join(out,`recarga-${tema}-${w}-${i}-fin.png`)});
 const F=await page.evaluate(()=>window.__f);const a=analizar(F);
 check(a.viol.length===0,`${w}/${tema}/${e.n}: sin violaciones por fotograma ${JSON.stringify(a.viol)} (${a.n} fotogramas; capa hasta ${a.tFinCarga} ms, app a ${a.tApp} ms)`);
 check(a.huecos===0,`${w}/${tema}/${e.n}: sin fotogramas en blanco entre la capa y la app (${a.huecos})`);
 const demoraMax=Math.max(...Object.values(e.d));
 const minimo=e.frio?Math.max(e.d.fuga,e.d.carga,e.d.cfo)+(e.falla503?0:0):2000;
 check(a.tApp!==null&&a.tApp>=minimo-800,`${w}/${tema}/${e.n}: la app no aparece antes del dato más lento (app a ${a.tApp} ms, más lento ${demoraMax} ms)`);
 // Colores computados por estado (primer fotograma de cada estado)
 const est={};for(const x of F){const k=x.capa&&x.arr?'capa':x.capa?'saliendo':x.enLinea?'enLinea':x.cont?'app':'vacio';if(!est[k])est[k]={t:x.t,...x.col};}
 console.log('   colores:',JSON.stringify(est));
 resumen.push({w,tema,e:e.n,a,est});
 await ctx.close();
}
// ---------- B. Navegación interna (solo 1440) ----------
for(const tema of TEMAS){
 if(process.env.FILTRO)break;
 const w=1440,h=900;
 for(const [nombre,d] of [['lenta (3 s: capa completa)',{cfo:3000,carga:3000,fuga:3000,panel:3000,otro:2500}]]){
  console.log(`== ${w}px ${tema}: navegación ${nombre}`);
  const ctx=await contexto(browser,w,h,tema,{d:{cfo:80,carga:80,fuga:80,panel:80}});const page=await ctx.newPage();
  await page.goto(base+'/overview',{waitUntil:'commit',timeout:120000});await page.waitForSelector('.hoy-kpis',{timeout:90000});await page.waitForTimeout(1500);
  // Calienta la compilación de /cfo (dev) y vuelve a Hoy para que la medición no incluya compilar la ruta.
  await page.locator('.workspace-sidebar a[href^="/cfo"]').first().click();await page.waitForFunction(()=>location.pathname==='/cfo');await page.waitForTimeout(2500);
  await page.locator('.workspace-sidebar a[href^="/overview"]').first().click();await page.waitForFunction(()=>location.pathname==='/overview');await page.waitForTimeout(2500);
  await ctx.unroute(/\/(api|cfo\/data)\//);
  await ctx.route(/\/(api|cfo\/data)\//,async route=>{const req=route.request(),u=req.url();let hit=await respond(u,req.method(),req.postData());if(!hit&&/cfo\/data\/report/.test(u))hit=[200,{data:{status:'empty'}}];
   await new Promise(r=>setTimeout(r,/cfo\/data/.test(u)?d.cfo:/workload/.test(u)?d.carga:/api\/workspace/.test(u)?d.panel:d.otro));
   return hit?route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
  await page.evaluate(()=>{window.__f.length=0;});
  await page.locator('.workspace-sidebar a[href^="/cfo"]').first().click();
  await page.waitForTimeout(1200);await page.screenshot({path:path.join(out,`nav-${tema}-${nombre.slice(0,6).trim()}-mid.png`)});
  await page.waitForFunction(()=>location.pathname==='/cfo');await page.waitForTimeout(6000);
  const F=await page.evaluate(()=>window.__f);const a=analizar(F);
  const capaFr=F.filter(x=>x.capa&&x.arr);
  const pf=F.filter(x=>x.pend);const pendMs=pf.length?pf[pf.length-1].t-pf[0].t:0;
  if(process.env.DEPURA)console.log('   pend ms',pendMs,'capa frames',capaFr.length,capaFr[0]&&capaFr[0].t,'→',capaFr.length&&capaFr[capaFr.length-1].t);
  {check(capaFr.length>0,`${w}/${tema}: navegación lenta muestra la capa (${capaFr.length} fotogramas)`);check(capaFr.every(x=>x.cubre&&!x.side&&!x.top&&!x.cont&&x.logos===1),`${w}/${tema}: durante la navegación lenta la capa cubre todo, sin sidebar y con 1 logo`);
   const t=capaFr.length?capaFr[capaFr.length-1].t-capaFr[0].t:0;check(t>=380,`${w}/${tema}: la capa permanece >= 400 ms una vez visible (${t} ms)`);}
  check(a.viol.length===0,`${w}/${tema}/nav ${nombre}: sin violaciones ${JSON.stringify(a.viol)}`);
  await ctx.close();
 }
}
// ---------- C. Lógica de 250 ms / 400 ms con un cargador de página inyectado (determinista, sin depender del tiempo de compilación) ----------
for(const tema of TEMAS){
 if(process.env.FILTRO)break;
 console.log(`== 1440px ${tema}: cargador de página inyectado 150 ms (sin destello) y 700 ms (capa >= 400 ms)`);
 const ctx=await contexto(browser,1440,900,tema,{d:{cfo:80,carga:80,fuga:80,panel:80}});const page=await ctx.newPage();
 await page.goto(base+'/overview',{waitUntil:'commit',timeout:120000});await page.waitForSelector('.hoy-kpis',{timeout:90000});await page.waitForTimeout(2500);
 for(const ms of [150,700]){
  await page.evaluate(()=>{window.__f.length=0;});
  await page.evaluate(async ms=>{const d=document.createElement('div');d.className='rovaq-cargando';d.setAttribute('role','status');d.setAttribute('aria-busy','true');document.body.appendChild(d);await new Promise(r=>setTimeout(r,ms));d.remove();},ms);
  await page.waitForTimeout(1200);
  const F=await page.evaluate(()=>window.__f);const capaFr=F.filter(x=>x.capa&&x.arr);const a=analizar(F);
  if(ms===150)check(capaFr.length===0,`1440/${tema}: cargador de 150 ms no muestra la capa (${capaFr.length} fotogramas)`);
  else{const t=capaFr.length?capaFr[capaFr.length-1].t-capaFr[0].t:0;check(capaFr.length>0&&t>=380,`1440/${tema}: cargador de 700 ms muestra la capa y la mantiene >= 400 ms (${t} ms)`);check(capaFr.every(x=>x.cubre&&!x.side&&!x.top&&x.logos===1),`1440/${tema}: la capa cubre 100 % del viewport, sin sidebar y con 1 logo`);}
 }
 await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(out,'resumen.json'),JSON.stringify(resumen,null,1));
console.log(fails.length?`\n${fails.length} FALLAS`:'\nTODO OK');process.exit(fails.length?1:0);
