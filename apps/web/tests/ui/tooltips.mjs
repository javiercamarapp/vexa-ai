// Prueba de tooltips de gráficas (hover con cursor y toque). Uso, con `next dev` y fixtures en marcha:
//   VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev --webpack -p 3250
//   VEXA_UI_BASE=http://localhost:3250 node tests/ui/tooltips.mjs [--routes=/overview,/cfo] [--sizes=1440,390] [--themes=light,dark] [--detalle] [--capturas=DIR]
// Por cada gráfica (área, columnas, mapa, burbujas, Tip) hace hover en varios puntos (extremos incluidos), también con el viewport
// desplazado para que la gráfica quede cerca del borde inferior, y comprueba: ancho >= 160 y <= 280 (celular: <= viewport - 32),
// alto < 40 % del viewport, dentro del viewport, sin recorte por ancestros, ninguna palabra partida letra por letra, fuente >= 12 px,
// sin overflow-wrap:anywhere / word-break:break-all, un solo tooltip visible y que no cubra el punto bajo el cursor.
// Sale con código 1 si hay fallas. También exige encontrar al menos un tooltip de cada tipo en total (si no, no se probó nada).
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const F=await import('./fixtures.mjs');const {respond}=F;
const {MENU}=await import('../../src/lib/workspace/menu.mjs');
const arg=(k,d)=>(process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3))??d;
const base=process.env.VEXA_UI_BASE??'http://localhost:3150';
const menuRoutes=[...new Set(MENU.flatMap(x=>x.tipo==='item'?[x.href]:(x.items??[]).map(i=>i.href)).concat(['/notifications','/confianza','/cfo?vista=informe','/pain-points']))];
const routes=arg('routes',null)?.split(',')??menuRoutes;
const sizes=arg('sizes','1440,390').split(',').map(Number),themes=arg('themes','light,dark').split(',');
const detalle=process.argv.includes('--detalle'),capturas=arg('capturas',null),maxPorPagina=Number(arg('max','4'));
if(capturas)mkdirSync(capturas,{recursive:true});

const SEL='.chart-tip,.mp-tip,.pp-tip,.tip-bubble';
/** Se ejecuta en la página: devuelve los tooltips visibles con sus medidas. */
function medirTips({sel,px,py}){
 const vw=innerWidth,vh=innerHeight;
 const visible=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&parseFloat(cs.opacity)>0.5;};
 const tips=[...document.querySelectorAll(sel)].filter(visible);
 return {n:tips.length,tips:tips.map(e=>{
  const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
  // Palabras partidas: una palabra corta que ocupa más de una línea.
  const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let nd,partidas=[];
  while((nd=tw.nextNode())){const t=nd.textContent;const re=/\S+/g;let m;while((m=re.exec(t))){const rg=document.createRange();rg.setStart(nd,m.index);rg.setEnd(nd,m.index+m[0].length);const tops=new Set([...rg.getClientRects()].map(q=>Math.round(q.top/3)));if(tops.size>1&&m[0].length<=24)partidas.push(m[0]);}}
  // Recorte por ancestros con overflow distinto de visible (el tooltip en flujo del celular no flota: se omite).
  let recorte=null;if(cs.position!=='static'){for(let p=e.parentElement;p&&p!==document.documentElement;p=p.parentElement){const o=getComputedStyle(p);if(o.position==='fixed')break;if(/hidden|clip|auto|scroll/.test(o.overflowX+o.overflowY)){const q=p.getBoundingClientRect();if(r.left<q.left-0.5||r.right>q.right+0.5||r.top<q.top-0.5||r.bottom>q.bottom+0.5){recorte=(p.className&&String(p.className).split(' ')[0]||p.tagName)+' '+Math.round(q.width)+'x'+Math.round(q.height);break;}}}}
  let chico=0;for(const x of [e,...e.querySelectorAll('*')]){const own=[...x.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(own&&parseFloat(getComputedStyle(x).fontSize)<11.99)chico++;}
  const wrap=cs.overflowWrap+'/'+cs.wordBreak;
  const cubre=px!=null&&px>=r.left&&px<=r.right&&py>=r.top&&py<=r.bottom;
  const cls=e.matches('.chart-tip')?'chart-tip':e.matches('.mp-tip')?'mp-tip':e.matches('.pp-tip')?'pp-tip':'tip-bubble';
  return {cls,x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,vw,vh,pos:cs.position,
   fuera:r.left<-0.5||r.top<-0.5||r.right>vw+0.5||r.bottom>vh+0.5,margen:Math.round(Math.min(r.left,r.top,vw-r.right,vh-r.bottom)),
   partidas,recorte,chico,anywhere:/anywhere/.test(cs.overflowWrap)||/break-all/.test(cs.wordBreak),wrap,cubre,texto:(e.innerText||'').replace(/\s+/g,' ').trim().slice(0,70)};
 })};
}
function evaluar(m,ancho){
 const out=[];const movil=ancho<820;
 if(m.n===0)return ['sin tooltip visible'];
 if(m.n>1)out.push(m.n+' tooltips visibles a la vez');
 for(const t of m.tips){
  const enFlujo=t.pos==='static';
  if(t.cls==='chart-tip'||t.cls==='tip-bubble'||t.cls==='mp-tip'||t.cls==='pp-tip'){
   if(movil&&enFlujo){if(t.w>t.vw-32+1)out.push('cinta '+t.w+' > viewport-32');}
   else{if(t.w<160-0.5)out.push('ancho '+t.w+' < 160');if(t.w>280+0.5)out.push('ancho '+t.w+' > 280');if(movil&&t.w>t.vw-32+1)out.push('ancho '+t.w+' > viewport-32');}
  }
  if(t.h>=0.4*t.vh)out.push('alto '+t.h+' >= 40 % del viewport');
  if(t.fuera)out.push('fuera del viewport ('+t.x+','+t.y+' '+t.w+'x'+t.h+' en '+t.vw+'x'+t.vh+')');
  else if(!enFlujo&&t.margen<7.5)out.push('a '+t.margen+' px del borde (<8)');
  if(t.partidas.length)out.push('palabras partidas: '+t.partidas.slice(0,3).join(','));
  if(t.recorte)out.push('recortado por '+t.recorte);
  if(t.chico)out.push(t.chico+' textos < 12 px');
  if(t.anywhere)out.push('overflow-wrap/word-break '+t.wrap);
  if(t.cubre&&!enFlujo)out.push('cubre el punto bajo el cursor');
 }
 return out;
}

const browser=await chromium.launch();
const filas=[];const tiposVistos=new Set();let fallas=0,sondeos=0;
for(const theme of themes)for(const w of sizes){
 const movil=w<820;
 const ctx=await browser.newContext({viewport:{width:w,height:movil?812:900},reducedMotion:'reduce',hasTouch:movil});
 await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{}},theme);
 await ctx.route('**/api/**',async route=>{const q=route.request();if(/resource=problems/.test(q.url())&&/slim=1/.test(q.url()))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:F.bundleProblemsCatalogo()})});const h=await respond(q.url(),q.method(),q.postData());return h?route.fulfill({status:h[0],contentType:'application/json',body:JSON.stringify(h[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
 for(const r of routes){
  const page=await ctx.newPage();
  try{await page.goto(base+r,{waitUntil:'networkidle',timeout:120000});await page.waitForTimeout(700);}catch(e){filas.push({ruta:r,ancho:w,tema:theme,tipo:'-',sondeos:0,fallas:1,nota:'error '+String(e.message).slice(0,60)});fallas++;await page.close();continue;}
  // Objetivos: gráficas de área/columnas, regiones del mapa, burbujas, Tip.
  const objetivos=await page.evaluate(()=>{
   const o=[];
   [...document.querySelectorAll('.chart-plot > svg')].forEach((s,i)=>o.push({tipo:s.closest('.area-chart')?'area':'columnas',i}));
   const reg=[...document.querySelectorAll('.mp-reg[data-tipo=dato]')];if(reg.length)o.push({tipo:'mapa',i:0,n:reg.length});
   const bur=[...document.querySelectorAll('.pp-burbuja')];if(bur.length)o.push({tipo:'burbujas',i:0,n:bur.length});
   [...document.querySelectorAll('.tip-target')].forEach((_,i)=>o.push({tipo:'tip',i}));
   return o;
  });
  const porTipo={};
  for(const ob of objetivos){
   porTipo[ob.tipo]=(porTipo[ob.tipo]||0)+1;if(porTipo[ob.tipo]>maxPorPagina)continue;
   const fallasObj=[];let nSond=0,capturado=false;
   /** Coloca el objetivo en pantalla y devuelve los puntos de sondeo [x,y] (coordenadas de ventana). */
   const puntos=async(modo)=>page.evaluate(({ob,modo})=>{
    const pick=()=>ob.tipo==='area'||ob.tipo==='columnas'?document.querySelectorAll('.chart-plot > svg')[ob.i]:ob.tipo==='mapa'?document.querySelector('.mp-reg[data-tipo=dato]')?.ownerSVGElement:ob.tipo==='burbujas'?document.querySelector('.pp-burbuja')?.ownerSVGElement:document.querySelectorAll('.tip-target')[ob.i];
    const el=pick();if(!el)return [];
    el.scrollIntoView({block:'center'});
    if(modo==='borde'){const r0=el.getBoundingClientRect();window.scrollBy(0,r0.bottom-(innerHeight-6));}
    if(modo==='arriba'){const r0=el.getBoundingClientRect();window.scrollBy(0,r0.top-6);}
    const r=el.getBoundingClientRect();
    if(ob.tipo==='area'||ob.tipo==='columnas'){return [0.02,0.12,0.3,0.5,0.7,0.88,0.985].map(f=>[r.left+r.width*f,r.top+r.height*(ob.tipo==='area'?0.45:0.55)]);}
    if(ob.tipo==='mapa'){const regs=[...document.querySelectorAll('.mp-reg[data-tipo=dato]')];const pts=[];for(const idx of [0,Math.floor(regs.length/2),regs.length-1]){const b=regs[idx].getBoundingClientRect();for(const [fx,fy] of [[.5,.5],[.35,.4],[.6,.6],[.5,.3]]){const x=b.left+b.width*fx,y=b.top+b.height*fy;const t=document.elementFromPoint(x,y);if(t===regs[idx]){pts.push([x,y]);break;}}}return pts;}
    if(ob.tipo==='burbujas'){const bs=[...document.querySelectorAll('.pp-burbuja')];return [0,Math.floor(bs.length/2),bs.length-1].map(i=>{const b=bs[i].getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];});}
    return [[r.left+r.width/2,r.top+r.height/2]];
   },{ob,modo});
   for(const modo of (movil?['centro']:['centro','borde','arriba'])){
    const pts=await puntos(modo);
    for(const [x,y] of pts){
     if(x<0||y<0||x>w||y>(movil?812:900))continue;
     await page.mouse.move(2,2);await page.waitForTimeout(40);
     if(movil&&(ob.tipo==='area'||ob.tipo==='columnas')){await page.touchscreen.tap(x,y);}
     else if(ob.tipo==='tip'){await page.mouse.move(x,y);}
     else{await page.mouse.move(x,y,{steps:3});}
     await page.waitForTimeout(90);
     const m=await page.evaluate(medirTips,{sel:SEL,px:movil?null:x,py:movil?null:y});
     nSond++;sondeos++;
     if(m.n)tiposVistos.add(ob.tipo+'@'+(movil?'movil':'escritorio'));
     if(capturas&&!capturado&&m.n&&ob.tipo!=='tip'){capturado=true;await page.screenshot({path:join(capturas,`${arg('prefijo','')}${ob.tipo}-${w}-${theme}-${r.replace(/\W+/g,'_')}.png`)});}
     // «tip» sin tooltip visible por haber salido del hover no cuenta; para el resto, tooltip ausente = fallo solo si el punto cae sobre datos.
     const pr=evaluar(m,w,ob.tipo);
     if(pr.length&&!(pr.length===1&&pr[0]==='sin tooltip visible')){fallasObj.push(`[${modo} ${Math.round(x)},${Math.round(y)}] `+pr.join('; ')+' · '+(m.tips[0]?.texto??''));}
    }
   }
   // Teclado: ←/→ en el área; foco en la primera y la última columna. El tooltip debe quedar entero en la ventana (sin cursor).
   if(!movil&&(ob.tipo==='area'||ob.tipo==='columnas')){
    await page.mouse.move(2,2);
    const tecla=async(paso)=>{
     if(ob.tipo==='area'){const sv=page.locator('.chart-plot > svg').nth(ob.i);await sv.scrollIntoViewIfNeeded();await sv.focus();for(let k=0;k<(paso==='fin'?14:1);k++)await page.keyboard.press('ArrowRight');if(paso==='inicio'){await page.keyboard.press('ArrowLeft');}}
     else{const todas=page.locator('.chart-plot > svg').nth(ob.i).locator('.col');const n=await todas.count();const c=todas.nth(paso==='fin'?n-1:0);await c.scrollIntoViewIfNeeded();await c.focus();}
     await page.waitForTimeout(120);
     const m=await page.evaluate(medirTips,{sel:SEL,px:null,py:null});nSond++;sondeos++;
     if(m.n)tiposVistos.add(ob.tipo+'-teclado@escritorio');
     const pr=m.n?evaluar(m,w,ob.tipo):['sin tooltip con teclado'];
     if(pr.length)fallasObj.push(`[teclado ${paso}] `+pr.join('; ')+' · '+(m.tips[0]?.texto??''));
    };
    await tecla('inicio');await tecla('fin');
    await page.evaluate(()=>document.activeElement?.blur());
   }
   await page.mouse.move(2,2);
   if(fallasObj.length)fallas+=fallasObj.length;
   filas.push({ruta:r,ancho:w,tema:theme,tipo:ob.tipo+'#'+ob.i,sondeos:nSond,fallas:fallasObj.length});
   if(detalle&&fallasObj.length)for(const f of fallasObj.slice(0,6))console.log('--',theme,w,r,ob.tipo+'#'+ob.i,f);
  }
  // Paneles anclados (Popover, pista de paso): se abren con clic/toque. Mismo criterio de ventana y de palabras, ancho <= viewport - 32.
  const paneles=await page.evaluate(()=>({pop:document.querySelectorAll('.popover > button').length,paso:document.querySelectorAll('.step-pop > summary').length}));
  for(const [tipo,sel,panel,total] of [['popover','.popover > button','.popover-panel',paneles.pop],['paso','.step-pop > summary','.step-hint',paneles.paso]]){
   const fallasObj=[];let nSond=0;
   for(let i=0;i<Math.min(total,maxPorPagina);i++){
    if(!(await page.locator(sel).nth(i).isVisible()))continue;
    for(const modo of ['centro','borde']){
     await page.evaluate(({sel,i,modo})=>{const el=document.querySelectorAll(sel)[i];el.scrollIntoView({block:'center'});if(modo==='borde'){const r=el.getBoundingClientRect();window.scrollBy(0,r.bottom-(innerHeight-6));}},{sel,i,modo});
     await page.waitForTimeout(60);
     await page.locator(sel).nth(i).click({trial:false}).catch(()=>{});
     await page.waitForTimeout(160);
     const m=await page.evaluate(({panel})=>{const e=document.querySelector(panel);if(!e)return null;const r=e.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=innerHeight;
      const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let nd,partidas=[];while((nd=tw.nextNode())){const re=/\S+/g;let q;while((q=re.exec(nd.textContent))){const rg=document.createRange();rg.setStart(nd,q.index);rg.setEnd(nd,q.index+q[0].length);if(new Set([...rg.getClientRects()].map(z=>Math.round(z.top/3))).size>1&&q[0].length<=24)partidas.push(q[0]);}}
      return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),r:Math.round(r.right),vw,vh,partidas};},{panel});
     nSond++;sondeos++;
     if(!m){fallasObj.push(`[${modo}] no abrió ${panel}`);continue;}
     tiposVistos.add(tipo+'@'+(movil?'movil':'escritorio'));
     const pr=[];if(m.x<7.5||m.r>m.vw-7.5)pr.push(`horizontal fuera de [8,${m.vw-8}]: ${m.x}..${m.r}`);if(m.w>m.vw-32+1)pr.push(`ancho ${m.w} > viewport-32`);if(m.h>=0.7*m.vh)pr.push(`alto ${m.h} >= 70 % del viewport`);if(m.y<7.5||m.y+m.h>m.vh-7.5)pr.push(`vertical fuera de [8,${m.vh-8}]: ${m.y}..${m.y+m.h}`);if(m.partidas.length)pr.push('palabras partidas: '+m.partidas.slice(0,3).join(','));
     if(pr.length)fallasObj.push(`[${modo}] `+pr.join('; '));
     await page.keyboard.press('Escape');await page.waitForTimeout(60);
    }
   }
   if(nSond){fallas+=fallasObj.length;filas.push({ruta:r,ancho:w,tema:theme,tipo,sondeos:nSond,fallas:fallasObj.length});if(detalle)for(const f of fallasObj.slice(0,4))console.log('--',theme,w,r,tipo,f);}
  }
  // Cintas de valor en flujo (serie del briefing CFO): `.cn-tip` bajo la gráfica; deben caber, no recortarse ni partir palabras.
  if(await page.locator('.cn-hit').count()){
   const fallasObj=[];let nSond=0;
   for(const idx of ['primero','medio','ultimo']){
    const pt=await page.evaluate(idx=>{const hs=[...document.querySelectorAll('.cn-hit rect')];const e=hs[idx==='primero'?0:idx==='medio'?Math.floor(hs.length/2):hs.length-1];e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];},idx);
    await page.mouse.move(pt[0],pt[1],{steps:3});await page.waitForTimeout(120);
    const m=await page.evaluate(()=>{const e=document.querySelector('.cn-tip');if(!e)return null;const r=e.getBoundingClientRect(),vw=document.documentElement.clientWidth;
     const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let nd,partidas=[];while((nd=tw.nextNode())){const re=/\S+/g;let q;while((q=re.exec(nd.textContent))){const rg=document.createRange();rg.setStart(nd,q.index);rg.setEnd(nd,q.index+q[0].length);if(new Set([...rg.getClientRects()].map(z=>Math.round(z.top/3))).size>1&&q[0].length<=24)partidas.push(q[0]);}}
     let chico=0;for(const x of [e,...e.querySelectorAll('*')]){if([...x.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(x).fontSize)<11.99)chico++;}
     return {x:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width),h:Math.round(r.height),vw,vh:innerHeight,sc:e.scrollWidth>e.clientWidth+1,partidas,chico,texto:e.innerText.replace(/\s+/g,' ').slice(0,60)};});
    nSond++;sondeos++;if(!m){fallasObj.push('sin .cn-tip');continue;}
    tiposVistos.add('cinta@'+(movil?'movil':'escritorio'));
    const pr=[];if(m.x<0||m.r>m.vw)pr.push(`fuera del viewport ${m.x}..${m.r}`);if(m.sc)pr.push('contenido recortado');if(m.partidas.length)pr.push('palabras partidas: '+m.partidas.slice(0,3).join(','));if(m.chico)pr.push(m.chico+' textos < 12 px');if(m.h>=0.4*m.vh)pr.push('alto '+m.h);
    if(pr.length)fallasObj.push(`[${idx}] `+pr.join('; ')+' · '+m.texto);
   }
   fallas+=fallasObj.length;filas.push({ruta:r,ancho:w,tema:theme,tipo:'cinta',sondeos:nSond,fallas:fallasObj.length});if(detalle)for(const f of fallasObj.slice(0,4))console.log('--',theme,w,r,'cinta',f);
  }
  await page.close();
 }
 await ctx.close();
}
await browser.close();
console.table(filas.filter(f=>f.tipo!=='-'||f.fallas).map(f=>({...f})));
const requeridos=['area@escritorio','columnas@escritorio','area@movil','columnas@movil'].filter(k=>sizes.some(s=>(s<820)===k.endsWith('movil')));
const faltan=requeridos.filter(k=>!tiposVistos.has(k));
console.log('Tipos con tooltip observado:',[...tiposVistos].sort().join(', '));
console.log('Sondeos:',sondeos,'· fallas:',fallas);
if(faltan.length&&!arg('routes',null)){console.log('FALTAN tipos sin probar:',faltan.join(', '));process.exit(1);}
process.exit(fallas?1:0);
