// Detector de choques de interfaz. Uso (con `next dev` y fixtures en marcha):
//   (VEXA_UI_VARIANT=flujo añade ?variant= a las lecturas simuladas: una recomendación en cada etapa)
//   VEXA_UI_BASE=http://localhost:3150 node tests/ui/choques.mjs [--routes=/problems,/cfo] [--sizes=375,1440] [--themes=light,dark] [--detalle]
// Por cada ruta del MENU x ancho x tema detecta: desborde horizontal, texto recortado, hermanos que se solapan,
// botones sin nombre, h1 != 1 y fuentes < 12 px (11 px solo en MAYÚSCULAS), h1 > 20 px o cifra KPI > 30 px. Imprime una tabla y sale con código 1 si hay fallas.
import {createRequire} from 'node:module';

const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const F=await import('./fixtures.mjs');const {respond}=F;
const {MENU}=await import('../../src/lib/workspace/menu.mjs');
const arg=(k,d)=>(process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3))??d;
const base=process.env.VEXA_UI_BASE??'http://localhost:3150';
const menuRoutes=[...new Set(MENU.flatMap(x=>x.tipo==='item'?[x.href]:(x.items??[]).map(i=>i.href)).concat(['/notifications','/confianza','/cfo?vista=informe']))];
const routes=arg('routes',null)?.split(',')??menuRoutes;
const sizes=arg('sizes','375,768,1440').split(',').map(Number),themes=arg('themes','light,dark').split(',');
const detalle=process.argv.includes('--detalle');
/** Se ejecuta en la página. Devuelve {overflowX,clipped,overlap,unnamed,h1,small} con ejemplos. */
function medir(){
 const vis=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&cs.opacity!=='0';};
 const desc=e=>e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'')+' "'+(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,30)+'"';
 const srOnly=e=>e.closest('.sr-only,[hidden],[aria-hidden=true]');
 const all=[...document.querySelectorAll('body *')].filter(e=>!['SCRIPT','STYLE','NOSCRIPT','svg','path','circle','rect','g','line','polyline','text','tspan','defs','use'].includes(e.tagName)&&!e.closest('svg')&&vis(e)&&!srOnly(e));
 const scrollers=e=>{for(let p=e.parentElement;p;p=p.parentElement){const o=getComputedStyle(p).overflowX;if((o==='auto'||o==='scroll')&&p.scrollWidth>p.clientWidth)return true;}return false;};
 const out={pliegue:[],huecos:[],repetidos:[],topbar:[],overflowX:[],clipped:[],overlap:[],unnamed:[],h1:document.querySelectorAll('h1').length,small:[]};
 const wc=document.querySelector('.workspace-content');
 if(document.documentElement.scrollWidth>innerWidth+1)out.overflowX.push('documento '+document.documentElement.scrollWidth+'>'+innerWidth);
 if(wc&&wc.scrollWidth>wc.clientWidth+1)out.overflowX.push('.workspace-content '+wc.scrollWidth+'>'+wc.clientWidth);
 if(out.overflowX.length){const clip=e=>{for(let q=e.parentElement;q&&q!==document.body;q=q.parentElement){if(getComputedStyle(q).overflowX!=='visible')return true;}return false;};for(const e of [...document.querySelectorAll('.workspace-content *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!clip(e)).slice(0,3))out.overflowX.push('  culpable: '+desc(e)+' r='+Math.round(e.getBoundingClientRect().right));}
 for(const e of all){
  const cs=getComputedStyle(e);
  const ownText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  const fs=parseFloat(cs.fontSize);
  if(ownText&&e.matches('h1')&&fs>20.5)out.small.push('h1 '+fs+'px > 20');
  if(ownText&&e.matches('.stat-value,.ui-kpi-value,.hoy-kpi-valor,.pfig-value')&&fs>30.5)out.small.push('KPI '+fs+'px > 30');
  if(ownText&&(fs<11||(fs<12&&cs.textTransform!=='uppercase')))out.small.push(desc(e)+' '+cs.fontSize);
  if((cs.overflowX==='hidden'||cs.overflowX==='clip')&&e.scrollWidth>e.clientWidth+1&&cs.textOverflow!=='ellipsis'&&(e.textContent||'').trim()&&!scrollers(e)&&e.tagName!=='SELECT'&&e.tagName!=='INPUT')out.clipped.push(desc(e)+' '+e.scrollWidth+'>'+e.clientWidth);
  if(e.matches('button,[role=button],a[href],[role=tab],[role=radio]')){
   const nombre=(e.textContent||'').trim()||e.getAttribute('aria-label')||e.getAttribute('title')||e.getAttribute('aria-labelledby')||e.querySelector('img[alt]:not([alt=""])');
   if(!nombre)out.unnamed.push(desc(e));
  }
  if(e.children.length>1&&e.children.length<=40&&/flex|grid/.test(cs.display)){
   const kids=[...e.children].filter(k=>vis(k)&&!srOnly(k)&&!/^inline$/.test(getComputedStyle(k).display)&&!['absolute','fixed','sticky'].includes(getComputedStyle(k).position));
   for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++){
    const a=kids[i].getBoundingClientRect(),b=kids[j].getBoundingClientRect();
    const w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    if(w>2&&h>2&&getComputedStyle(kids[i]).marginTop!=='-1px')out.overlap.push(desc(kids[i])+' x '+desc(kids[j]));
   }
  }
 }
 // Huecos: una fila de tarjetas debe llenar el ancho de su contenedor (ninguna tarjeta sola con un lado en blanco).
 for(const par of new Set(all.filter(e=>e.matches('.card,.hoy-card,.ui-card,.hoy-kpis,.stat-card')).map(e=>e.parentElement))){
  if(!par||!/grid|flex/.test(getComputedStyle(par).display))continue;
  const pr=par.getBoundingClientRect(),cs=getComputedStyle(par);if(pr.width<700||cs.flexDirection==='column')continue;
  const kids=[...par.children].filter(k=>vis(k)&&getComputedStyle(k).position!=='absolute'),right=Math.max(...kids.map(k=>k.getBoundingClientRect().right)),libre=pr.right-parseFloat(cs.paddingRight)-right;
  if(kids.length&&libre>0.22*pr.width&&!(cs.display.includes('grid')&&kids.length===1&&false))out.huecos.push(desc(par)+' libre '+Math.round(libre)+'px de '+Math.round(pr.width));
 }
 // Primer pliegue de Hoy a >=1280 px: la gráfica de tendencia completa y al menos 2 filas de la tabla sin scroll.
 if(innerWidth>=1280&&location.pathname==='/overview'){const g=document.querySelector('.hoy-page .trends svg[role=group],.hoy-page .trends svg'),filas=[...document.querySelectorAll('.hoy-page .ov-problemas tbody tr')];
  if(!g||g.getBoundingClientRect().bottom>innerHeight)out.pliegue.push('la gráfica de tendencia no cabe completa en '+innerHeight+' px');
  if(filas.length<2||filas[1].getBoundingClientRect().bottom>innerHeight)out.pliegue.push('menos de 2 filas de la tabla en el primer pliegue');}
 // Botones repetidos en la misma pantalla (Actualizar / Exportar) y botones en la barra superior (solo el del menú móvil).
 const cont=document.querySelector('.workspace-content'),cuenta={};
 for(const e of cont?[...cont.querySelectorAll('button,a.btn')].filter(vis):[]){const n=((e.getAttribute('aria-label')||e.textContent)||'').trim().toLowerCase();if(/^(actualizar|exportar|exportar informe)$/.test(n))cuenta[n]=(cuenta[n]||0)+1;}
 for(const [n,c] of Object.entries(cuenta))if(c>1)out.repetidos.push(n+' x'+c);
 if(innerWidth>=1000)for(const b of document.querySelectorAll('.workspace-header button,.workspace-topbar button'))if(vis(b))out.topbar.push(desc(b));
 // Aire interior de botones, chips, pestañas y selects con borde o relleno: texto e iconos a ≥5 px del borde (nada pegado al margen); el select, además, ≥24 px a la derecha para su chevron.
 for(const el of document.querySelectorAll('button,.btn,select,.chip,.ui-chip,[role=tab],.fchip')){
  if(!vis(el)||srOnly(el)||el.matches('.row-link-inline,.skip-link,.ui-chip-x'))continue;
  const cs=getComputedStyle(el),r=el.getBoundingClientRect(),caja=parseFloat(cs.borderLeftWidth)>0||cs.backgroundColor!=='rgba(0, 0, 0, 0)';
  if(!caja||r.width<4)continue;
  if(el.tagName==='SELECT'){if(el.multiple||el.size>1)continue;if(parseFloat(cs.paddingRight)<24)out.overlap.push('aire: select con padding-derecho '+cs.paddingRight+' '+desc(el));continue;}
  if(el.querySelector('.sr-only,code')||el.matches('.id-chip'))continue;
  const txt=(el.textContent||'').trim();if(!txt)continue;
  const rg=document.createRange();rg.selectNodeContents(el);const tr=rg.getBoundingClientRect();
  if(tr.width&&(tr.left-r.left<5||r.right-tr.right<5||tr.top-r.top<2||r.bottom-tr.bottom<2))out.overlap.push('aire: texto pegado al borde en '+desc(el)+' ('+Math.round(tr.left-r.left)+'/'+Math.round(r.right-tr.right)+'/'+Math.round(tr.top-r.top)+'/'+Math.round(r.bottom-tr.bottom)+')');
  for(const sv of el.querySelectorAll('svg')){const q=sv.getBoundingClientRect();if(q.width&&(q.left-r.left<4||r.right-q.right<4))out.overlap.push('aire: icono pegado al borde en '+desc(el));}
 }
 for(const k of ['clipped','overlap','unnamed','small'])out[k]=[...new Set(out[k])];
 return out;
}
const browser=await chromium.launch();
const filas=[];let fallas=0;
for(const theme of themes)for(const w of sizes){
 const ctx=await browser.newContext({viewport:{width:w,height:w<500?812:w<1000?1024:900},reducedMotion:'reduce'});
 await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{}},theme);
 await ctx.route('**/api/**',async route=>{const q=route.request();if(/resource=problems/.test(q.url())&&/slim=1/.test(q.url()))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:F.bundleProblemsCatalogo()})});const V=process.env.VEXA_UI_VARIANT,u2=V?q.url()+(q.url().includes('?')?'&':'?')+'variant='+V:q.url();const h=await respond(u2,q.method(),q.postData());return h?route.fulfill({status:h[0],contentType:'application/json',body:JSON.stringify(h[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
 for(const r of routes){
  const page=await ctx.newPage();let m;
  try{await page.goto(base+r,{waitUntil:'networkidle',timeout:120000});await page.waitForTimeout(600);m=await page.evaluate(medir);}catch(e){m={error:String(e.message).slice(0,80),pliegue:[],huecos:[],repetidos:[],topbar:[],overflowX:[],clipped:[],overlap:[],unnamed:[],h1:1,small:[]};}
  await page.close();
  const n=m.pliegue.length+m.huecos.length+m.repetidos.length+m.topbar.length+m.overflowX.length+m.clipped.length+m.overlap.length+m.unnamed.length+m.small.length+(m.h1!==1?1:0)+(m.error?1:0);fallas+=n;
  filas.push({ruta:r,ancho:w,tema:theme,pliegue:m.pliegue.length,huecos:m.huecos.length,repetidos:m.repetidos.length,topbar:m.topbar.length,desborde:m.overflowX.length,recortes:m.clipped.length,solapes:m.overlap.length,sinNombre:m.unnamed.length,h1:m.h1,fuente12:m.small.length,error:m.error??''});
  if(detalle&&n)console.log('--',theme,w,r,JSON.stringify({p:m.pliegue,h:m.huecos,r:m.repetidos,tb:m.topbar,o:m.overflowX,c:m.clipped.slice(0,4),s:m.overlap.slice(0,4),u:m.unnamed.slice(0,4),f:m.small.slice(0,4),h1:m.h1,e:m.error}));
 }
 await ctx.close();
}
await browser.close();
console.table(filas.filter(f=>f.pliegue||f.huecos||f.repetidos||f.topbar||f.desborde||f.recortes||f.solapes||f.sinNombre||f.h1!==1||f.fuente12||f.error));
console.log(`${filas.length} combinaciones, ${filas.filter(f=>f.pliegue||f.huecos||f.repetidos||f.topbar||f.desborde||f.recortes||f.solapes||f.sinNombre||f.h1!==1||f.fuente12||f.error).length} con fallas, ${fallas} hallazgos`);
process.exit(fallas?1:0);
