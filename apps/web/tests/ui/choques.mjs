// Detector de choques de interfaz. Uso (con `next dev` y fixtures en marcha):
//   (VEXA_UI_VARIANT=flujo añade ?variant= a las lecturas simuladas: una recomendación en cada etapa)
//   Servidor: VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev --webpack -p 3150 (las rutas de superadmin solo existen con esos fixtures)
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
const menuRoutes=[...new Set(MENU.flatMap(x=>x.tipo==='item'?[x.href]:(x.items??[]).map(i=>i.href)).concat(['/notifications','/confianza','/cfo?vista=informe','/pain-points']))];
// Superadmin (no están en el MENU): consola de plataforma, ficha 360 y las pantallas de acceso (/sin-acceso y /seguridad tienen vista sintética bajo fixtures).
const {SUPERADMIN_ROUTES}=await import('./superadmin-rutas.mjs');
const conSuperadmin=[...menuRoutes,...SUPERADMIN_ROUTES];
const routes=arg('routes',null)?.split(',')??conSuperadmin;
const sizes=arg('sizes','375,768,1440').split(',').map(Number),themes=arg('themes','light,dark').split(',');
const detalle=process.argv.includes('--detalle');
/** Se ejecuta en la página. Devuelve {overflowX,clipped,overlap,unnamed,h1,small} con ejemplos. */
function medir(){
 const vis=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&cs.opacity!=='0';};
 const desc=e=>e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'')+' "'+(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,30)+'"';
 const srOnly=e=>e.closest('.sr-only,[hidden],[aria-hidden=true]');
 const all=[...document.querySelectorAll('body *')].filter(e=>!['SCRIPT','STYLE','NOSCRIPT','svg','path','circle','rect','g','line','polyline','text','tspan','defs','use'].includes(e.tagName)&&!e.closest('svg')&&vis(e)&&!srOnly(e));
 const scrollers=e=>{for(let p=e.parentElement;p;p=p.parentElement){const o=getComputedStyle(p).overflowX;if((o==='auto'||o==='scroll')&&p.scrollWidth>p.clientWidth)return true;}return false;};
 const out={boton:[],boton:[],superficie:[],aireFila:[],contraste:[],pliegue:[],huecos:[],repetidos:[],topbar:[],overflowX:[],clipped:[],overlap:[],unnamed:[],h1:document.querySelectorAll('h1').length,small:[]};
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
  const abrev=e.hasAttribute('data-abrev')&&parseFloat(getComputedStyle(e,'::after').fontSize)>=12; // cifra abreviada del celular: el valor visible vive en ::after (font-size del contenedor en 0)
  if(ownText&&!abrev&&(fs<11||(fs<12&&cs.textTransform!=='uppercase')))out.small.push(desc(e)+' '+cs.fontSize);
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
 if(innerWidth>=1000)for(const b of document.querySelectorAll('.workspace-header button,.workspace-topbar button'))if(vis(b)&&!b.matches('.at-trigger'))out.topbar.push(desc(b));
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
 // Distancia al borde de la tarjeta/cabecera que lo contiene: un control con borde propio no puede quedar a <6 px del borde derecho/superior de su recuadro (el «Miembros» pegado a la esquina).
 for(const el of document.querySelectorAll('button,.btn,select,.ui-chip,.chip,input:not([type=checkbox]):not([type=radio]),[role=tab]')){
  if(!vis(el)||srOnly(el))continue;const cs=getComputedStyle(el);if(!(parseFloat(cs.borderLeftWidth)>0||cs.backgroundColor!=='rgba(0, 0, 0, 0)'))continue;
  const box=el.closest('.card,.ui-card,.pc-card,.hoy-card,.task-card,section,article,dialog');if(!box||box===el)continue;
  const bs=getComputedStyle(box);if(!(parseFloat(bs.borderLeftWidth)>0))continue;
  const r=el.getBoundingClientRect(),b=box.getBoundingClientRect();
  if(r.width<1||b.width<1)continue;
  if(b.right-r.right<6&&b.right-r.right>=-1&&r.right<=b.right+1||r.top-b.top<6&&r.top-b.top>=-1&&r.bottom<b.bottom)out.overlap.push('borde: '+desc(el)+' a '+Math.round(b.right-r.right)+'px derecha / '+Math.round(r.top-b.top)+'px arriba de su recuadro');
 }
  // ---- Superficie, contraste y aire en filas (sistema de grises): el color de un control o aviso no puede confundirse con el de su fondo ----
 const cv=document.createElement('canvas');cv.width=cv.height=1;const cx=cv.getContext('2d',{willReadFrequently:true});
 const rgba=c=>{cx.clearRect(0,0,1,1);cx.fillStyle='#000';cx.fillStyle=c;cx.fillRect(0,0,1,1);const d=cx.getImageData(0,0,1,1).data;return [d[0],d[1],d[2],d[3]/255];};
 const blend=(f,b)=>[f[0]*f[3]+b[0]*(1-f[3]),f[1]*f[3]+b[1]*(1-f[3]),f[2]*f[3]+b[2]*(1-f[3]),1];
 const bgDe=el=>{ // fondo efectivo (compuesto sobre sus ancestros hasta el lienzo)
  const capas=[];for(let p=el;p;p=p.parentElement){const c=rgba(getComputedStyle(p).backgroundColor);if(c[3]>0)capas.push(c);if(c[3]>=1)break;}
  let r=[255,255,255,1];if(getComputedStyle(document.documentElement).colorScheme==='dark'&&!capas.some(c=>c[3]>=1))r=rgba(getComputedStyle(document.body).backgroundColor);
  for(const c of capas.reverse())r=blend(c,r);return r;};
 const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);};
 const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
 const croma=c=>Math.max(c[0],c[1],c[2])-Math.min(c[0],c[1],c[2]);
 const CTRL='button,.btn,select,input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,.chip,.ui-chip,.fchip,[role=tab],[role=radio],.seg-btn,.status-chip,.kind-badge,.id-chip';
 const AVISO='.ui-notice,.notice-bar,.state-cache,.state,.state-panel,.state-error,.notice';
 for(const el of document.querySelectorAll(CTRL+','+AVISO)){
  if(!vis(el)||srOnly(el)||el.matches('.skip-link,.row-link-inline,.ui-chip-x,.sidebar-navigation a,.mobile-menu-button,.icon-button,.empresa-chip')||el.closest('.workspace-sidebar,.workspace-bottom-nav,.platform-nav'))continue;
  const cs=getComputedStyle(el),r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;
  const bgp=el.parentElement?bgDe(el.parentElement):[255,255,255,1],bg=bgDe(el),aviso=el.matches(AVISO);
  let bcr=rgba(cs.borderTopColor);if(bcr[3]<0.05&&/inset/.test(cs.boxShadow)){const m=cs.boxShadow.match(/(rgba?\([^)]*\)|color\([^)]*\))/);if(m)bcr=rgba(m[1]);} // píldoras móviles: borde transparente + sombra interior de 1 px
  const bw=bcr[3]>0.05?parseFloat(cs.borderTopWidth):0,bc=bw>0?blend(bcr,bgp):null;
  const propio=cs.backgroundColor!=='rgba(0, 0, 0, 0)'&&rgba(cs.backgroundColor)[3]>0.3;
  if(aviso){
   // Un aviso lleva color propio (tinte con croma) o, si es blanco, un borde con color; nunca gris sobre gris ni gris sobre blanco.
   if(propio&&croma(bg)<9&&!(croma(bc??[0,0,0,1])>=18))out.superficie.push('aviso sin color propio '+desc(el)+' bg='+bg.slice(0,3).map(Math.round)+' sobre '+bgp.slice(0,3).map(Math.round));
  }else if(propio||bw>0){
   const dist=propio?ratio(bg,bgp):1,borde=bc?ratio(bc,bgp):1,conColor=propio&&croma(bg)>=14;
   // Un control distinguible: tinte con color, o fondo claramente distinto del de su padre, o borde ≥ 3:1, o borde ≥ 1.4:1 si su fondo es blanco (superficie) y no gris.
   if(!(conColor||dist>=1.08||borde>=3||(borde>=1.4&&(lum(bg)>0.9||dist>=1.04)))&&!el.disabled)out.superficie.push('control del color del fondo '+desc(el)+' bg='+bg.slice(0,3).map(Math.round)+' fondo='+bgp.slice(0,3).map(Math.round)+' borde '+borde.toFixed(1)+':1');
   if(el.disabled&&!(dist>=1.04||borde>=1.5||conColor))out.superficie.push('control deshabilitado invisible '+desc(el));
  }
  // Contraste del texto del control/aviso contra su propio fondo (≥ 4.5:1).
  const t=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())||(el.matches('select,input,textarea')&&(el.value||el.placeholder));
  if(t&&!el.matches('.id-chip,[data-decorativo]')){
   const fg=blend(rgba(cs.color),bg),rt=ratio(fg,bg),op=parseFloat(cs.opacity);
   if(rt<4.5||op<0.99&&rt*op<4.5)out.contraste.push(desc(el)+' '+rt.toFixed(1)+':1');
  }
 }
 // Texto secundario de tablas y avisos (.muted, celdas, th): contraste AA contra el fondo real.
 for(const el of document.querySelectorAll('.workspace-content :is(td,th,.muted,small,.dn-meta,figcaption,label,dd,dt)')){
  if(!vis(el)||srOnly(el))continue;if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
  const cs=getComputedStyle(el),bg=bgDe(el),fg=blend(rgba(cs.color),bg),rt=ratio(fg,bg),op=parseFloat(cs.opacity);
  if(rt<4.5||op<0.99&&rt*op<4.5)out.contraste.push(desc(el)+' '+rt.toFixed(1)+':1');
 }
 // Aire en filas de tabla: un control con borde o relleno dentro de una fila queda a ≥ 6 px de sus separadores (arriba y abajo).
 for(const tr of document.querySelectorAll('.workspace-content tbody tr')){
  if(!vis(tr))continue;const rr=tr.getBoundingClientRect();if(rr.height<20)continue;
  for(const el of tr.querySelectorAll('button,.btn,select,input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea')){
   if(!vis(el)||srOnly(el)||el.matches('.row-link-inline'))continue;const cs=getComputedStyle(el);
   if(!(parseFloat(cs.borderTopWidth)>0&&rgba(cs.borderTopColor)[3]>0.05||rgba(cs.backgroundColor)[3]>0.3))continue;
   const r=el.getBoundingClientRect(),arriba=r.top-rr.top,abajo=rr.bottom-r.bottom;
   if(rr.height>r.height*2.2)continue; // filas con varias líneas de texto: la caja no manda
   if(arriba<5.4||abajo<5.4)out.aireFila.push('control a '+Math.round(arriba)+'/'+Math.round(abajo)+' px de los separadores en '+desc(el));
   if(r.height>34&&el.closest('td'))out.aireFila.push('control de fila de '+Math.round(r.height)+' px (máx. 34) '+desc(el));
  }
 }
 // ---- Estándar de botón (24-oct): alto 32 px escritorio / 36 px móvil (±1; 28 dentro de filas de tabla, que miden 40) y ≥ 8 px entre vecinos. /preguntale y /cfo los gobierna otro carril. ----
 if(!/^\/(preguntale|cfo)(\/|$)/.test(location.pathname)){
  const movil=innerWidth<820; // mismo corte que movil-contenido.css
  const EXCL='.row-link-inline,.dg-sku,.skip-link,.seg-btn,.fchip-x,.ui-chip-x,.id-chip,.chip,.empresa-chip,summary,th *,[role=tab],[role=radio],[role=switch],[role=checkbox],.mobile-menu-button,.at-trigger,.catalog-link,.barlist-link,[class*=catBtn],[class*=agente],[class*=cfo]';
  const esBtn=e=>!e.matches(EXCL)&&!e.closest('.segmented,.seg,.mc-seg,.pc-seg,.mp-seg,.mp-rank,.mv-modo-tablas,[class*=-seg],[role=tablist],[role=radiogroup],.workspace-sidebar,.workspace-bottom-nav,.theme-selector,.hoy-sig');
  const btns=[...document.querySelectorAll('button,.btn,a.btn,[role=button]')].filter(e=>vis(e)&&!srOnly(e)&&e.namespaceURI==='http://www.w3.org/1999/xhtml'&&esBtn(e));
  for(const el of btns){
   const cs=getComputedStyle(el),r=el.getBoundingClientRect();if(cs.display==='inline'||r.width<4)continue;
   const caja=(parseFloat(cs.borderTopWidth)>0&&rgba(cs.borderTopColor)[3]>0.05)||rgba(cs.backgroundColor)[3]>0.3;if(!caja)continue;
   const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.3,uno=r.height<lh*1.9+16;
   const dentroFila=!!el.closest('td'),obj=dentroFila&&!movil?28:movil?36:32,tieneTexto=(el.textContent||'').trim().length>0;
   if(uno&&Math.abs(r.height-obj)>1.2&&!(r.height>lh*1.6+10))out.boton.push('alto '+Math.round(r.height*10)/10+' (objetivo '+obj+') '+desc(el));
   if(!tieneTexto&&el.querySelector('svg')&&Math.abs(r.width-r.height)<3&&Math.abs(r.width-obj)>1.2)out.boton.push('botón de icono '+Math.round(r.width)+'x'+Math.round(r.height)+' (objetivo '+obj+') '+desc(el));
   if(parseFloat(cs.borderTopLeftRadius)>12&&r.height<60&&!el.matches('.pill,[data-forma=pildora]'))out.boton.push('radio '+cs.borderTopLeftRadius+' (píldora solo en estados) '+desc(el));
   if(parseFloat(cs.fontSize)>14.2&&tieneTexto&&!movil)out.boton.push('fuente '+cs.fontSize+' (13 px) '+desc(el));
   if(tieneTexto&&el.children.length<=1&&parseFloat(cs.fontWeight)<500)out.boton.push('peso '+cs.fontWeight+' '+desc(el));
  }
  for(let i=0;i<btns.length;i++)for(let j=i+1;j<btns.length;j++){
   if(btns[i].contains(btns[j])||btns[j].contains(btns[i]))continue;
   const a=btns[i].getBoundingClientRect(),b=btns[j].getBoundingClientRect();
   const gx=Math.max(a.left,b.left)-Math.min(a.right,b.right),gy=Math.max(a.top,b.top)-Math.min(a.bottom,b.bottom);
   const sobreX=Math.min(a.right,b.right)-Math.max(a.left,b.left),sobreY=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
   if((sobreY>2&&gx<7.5)||(sobreX>2&&gy<7.5))out.boton.push('botones a '+Math.round(Math.max(gx,gy))+' px (≥ 8) '+desc(btns[i])+' / '+desc(btns[j]));
  }
 }
 for(const k of ['boton','superficie','aireFila','contraste','clipped','overlap','unnamed','small'])out[k]=[...new Set(out[k])];
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
  try{await page.goto(base+r,{waitUntil:'networkidle',timeout:120000});await page.waitForTimeout(600);m=await page.evaluate(medir);}catch(e){m={error:String(e.message).slice(0,80),boton:[],superficie:[],aireFila:[],contraste:[],pliegue:[],huecos:[],repetidos:[],topbar:[],overflowX:[],clipped:[],overlap:[],unnamed:[],h1:1,small:[]};}
  await page.close();
  const n=m.boton.length+m.superficie.length+m.aireFila.length+m.contraste.length+m.pliegue.length+m.huecos.length+m.repetidos.length+m.topbar.length+m.overflowX.length+m.clipped.length+m.overlap.length+m.unnamed.length+m.small.length+(m.h1!==1?1:0)+(m.error?1:0);fallas+=n;
  filas.push({ruta:r,ancho:w,tema:theme,boton:m.boton.length,superficie:m.superficie.length,aire:m.aireFila.length,contraste:m.contraste.length,pliegue:m.pliegue.length,huecos:m.huecos.length,repetidos:m.repetidos.length,topbar:m.topbar.length,desborde:m.overflowX.length,recortes:m.clipped.length,solapes:m.overlap.length,sinNombre:m.unnamed.length,h1:m.h1,fuente12:m.small.length,error:m.error??''});
  if(detalle&&n)console.log('--',theme,w,r,JSON.stringify({bot:m.boton.slice(0,8),sup:m.superficie.slice(0,6),aire:m.aireFila.slice(0,6),con:m.contraste.slice(0,6),p:m.pliegue,h:m.huecos,r:m.repetidos,tb:m.topbar,o:m.overflowX,c:m.clipped.slice(0,4),s:m.overlap.slice(0,4),u:m.unnamed.slice(0,4),f:m.small.slice(0,4),h1:m.h1,e:m.error}));
 }
 await ctx.close();
}
await browser.close();
console.table(filas.filter(f=>f.boton||f.superficie||f.aire||f.contraste||f.pliegue||f.huecos||f.repetidos||f.topbar||f.desborde||f.recortes||f.solapes||f.sinNombre||f.h1!==1||f.fuente12||f.error));
console.log(`${filas.length} combinaciones, ${filas.filter(f=>f.boton||f.superficie||f.aire||f.contraste||f.pliegue||f.huecos||f.repetidos||f.topbar||f.desborde||f.recortes||f.solapes||f.sinNombre||f.h1!==1||f.fuente12||f.error).length} con fallas, ${fallas} hallazgos`);
process.exit(fallas?1:0);
