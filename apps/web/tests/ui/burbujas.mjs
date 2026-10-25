// Prueba visual del mapa de burbujas de /pain-points (Playwright + fixtures). Uso, con `next dev` y fixtures en marcha:
//   VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev --webpack -p 3320
//   VEXA_UI_BASE=http://localhost:3320 node tests/ui/burbujas.mjs [--sizes=1440,768,390] [--themes=light,dark] [--capturas=DIR]
// Por tamaño x tema x pestaña x modo comprueba: sin desborde horizontal, burbujas dentro de su cúmulo y sin tocarse, radio PROPORCIONAL a la raíz del valor
// (misma constante en todos los cúmulos), texto dentro de la burbuja o fuera sin cruzar el contorno, fuentes >= 12 px, aria-label por burbuja, tooltip 160-280 px
// dentro del viewport, y Enter marca la burbuja. Sale con código 1 si hay fallas.
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const F=await import('./fixtures.mjs');
const arg=(k,d)=>(process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3))??d;
const base=process.env.VEXA_UI_BASE??'http://localhost:3320',sizes=arg('sizes','1440,768,390').split(',').map(Number),themes=arg('themes','light,dark').split(','),capt=arg('capturas',null);
if(capt)mkdirSync(capt,{recursive:true});
const TABS=['Todos','Devoluciones y chargebacks','Garantía','Logística y servicio','Canales','Ubicaciones','SKU'];
function medir(){
 const fallas=[],mapa=document.querySelector('.pp-mapa');
 if(!mapa)return ['no hay .pp-mapa'];
 if(mapa.scrollWidth>mapa.clientWidth+1)fallas.push(`desborde horizontal ${mapa.scrollWidth}>${mapa.clientWidth}`);
 const bs=[...mapa.querySelectorAll('.pp-burbuja')].map(g=>{const c=g.querySelector('circle'),r=c.getBoundingClientRect(),svg=g.closest('svg'),vb=svg.viewBox.baseVal,s=svg.getBoundingClientRect().width/vb.width;return {g,r,svg,s,cx:r.left+r.width/2,cy:r.top+r.height/2,rad:r.width/2,rl:+g.dataset.r,v:+g.dataset.valor,tipo:g.dataset.tipo,sec:g.closest('.pp-cumulo').getBoundingClientRect(),label:g.getAttribute('aria-label')};});
 for(const b of bs){
  if(!b.label)fallas.push('burbuja sin aria-label');
  if(Math.abs(b.rad-b.rl*b.s)>0.8)fallas.push(`radio dibujado ${b.rad.toFixed(1)} != ${(b.rl*b.s).toFixed(1)} (${b.label?.slice(0,30)})`);
  if(b.cx-b.rad<b.sec.left-1||b.cx+b.rad>b.sec.right+1||b.cy-b.rad<b.sec.top-1||b.cy+b.rad>b.sec.bottom+1)fallas.push('burbuja fuera de su cúmulo: '+b.label?.slice(0,30));
 }
 for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++)if(Math.hypot(bs[i].cx-bs[j].cx,bs[i].cy-bs[j].cy)<bs[i].rad+bs[j].rad-1)fallas.push('burbujas que se tocan: '+bs[i].label?.slice(0,25)+' x '+bs[j].label?.slice(0,25));
 // proporcionalidad: r/(s·√v) constante en todo el mapa (las de tamaño mínimo son las únicas excepciones y no traen dato exacto de área)
 const rs=bs.map(b=>b.rl/Math.sqrt(b.v)).sort((a,b)=>a-b),kref=rs.length?rs[Math.floor(rs.length/2)]:0;
  const raras=bs.filter(b=>Math.abs(b.rl/Math.sqrt(b.v)-kref)/kref>=0.005);if(raras.length>2)fallas.push('burbujas fuera de la escala global (solo se admiten los tamaños mínimos): '+raras.length);
 for(const t of mapa.querySelectorAll('.pp-burbuja text')){
  const g=t.closest('.pp-burbuja'),c=g.querySelector('circle').getBoundingClientRect(),cx=c.left+c.width/2,cy=c.top+c.height/2,rad=c.width/2,tr=t.getBoundingClientRect(),svgR=g.closest('svg').getBoundingClientRect();
  const esq=[[tr.left,tr.top],[tr.right,tr.top],[tr.left,tr.bottom],[tr.right,tr.bottom]],dentro=esq.filter(([x,y])=>Math.hypot(x-cx,y-cy)<=rad+0.5).length;
  if(dentro!==0&&dentro!==4)fallas.push('texto cruza el contorno: '+t.textContent.slice(0,30));
  if(tr.left<svgR.left-0.5||tr.right>svgR.right+0.5||tr.bottom>svgR.bottom+0.5)fallas.push('texto fuera del cúmulo: '+t.textContent.slice(0,30));
  if(parseFloat(getComputedStyle(t).fontSize)<11.99)fallas.push('texto < 12 px');
 }
 // texto fuera de una burbuja que choca con otra burbuja
 for(const t of mapa.querySelectorAll('.pp-burbuja text')){const tr=t.getBoundingClientRect(),yo=t.closest('.pp-burbuja');for(const b of bs){if(b.g===yo)continue;const x=Math.max(tr.left,Math.min(b.cx,tr.right)),y=Math.max(tr.top,Math.min(b.cy,tr.bottom));if(Math.hypot(x-b.cx,y-b.cy)<b.rad-1)fallas.push('texto sobre otra burbuja: '+t.textContent.slice(0,25));}}
 for(const e of mapa.querySelectorAll('.pp-explica,.pp-leyenda,.pp-leyenda *,.pp-cumulo-cab *,.pp-cumulo-pie,.pp-vacios,.pp-concilia'))if([...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<11.99)fallas.push('fuente < 12 px en '+e.className);
 for(const e of mapa.querySelectorAll('.pp-cumulo-cab *,.pp-cumulo-pie,.pp-vacios,.pp-concilia,.pp-explica')){if(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).display!=='inline')fallas.push('texto recortado en '+e.className);}
 return fallas;
}
const browser=await chromium.launch();let total=0,corridas=0,tips=0;
for(const theme of themes)for(const w of sizes){
 const ctx=await browser.newContext({viewport:{width:w,height:2600},reducedMotion:'reduce'});
 await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{}},theme);
 await ctx.route('**/api/**',async route=>{const q=route.request(),h=await F.respond(q.url(),q.method(),q.postData());return h?route.fulfill({status:h[0],contentType:'application/json',body:JSON.stringify(h[1])}):route.fulfill({status:503,contentType:'application/json',body:'{}'});});
 const page=await ctx.newPage();await page.goto(base+'/pain-points',{waitUntil:'networkidle',timeout:180000});await page.waitForTimeout(700);
 for(const modo of ['Dinero','Volumen'])for(const tab of TABS){
  await page.getByRole('radio',{name:modo,exact:true}).click();
  await page.getByRole('radio',{name:tab,exact:true}).click().catch(()=>page.getByRole('tab',{name:tab,exact:true}).click());
  await page.waitForTimeout(250);
  const f=await page.evaluate(medir);corridas++;
  if(f.length){total+=f.length;console.log(`FALLA ${theme} ${w} ${modo} / ${tab}:\n  `+[...new Set(f)].slice(0,6).join('\n  '));}
  if(capt&&(tab==='Todos'))await page.locator('.ui-card,.card').filter({has:page.locator('.pp-mapa')}).last().screenshot({path:`${capt}/${theme}-${w}-${modo}.png`});
 }
 // tooltip y teclado (en Dinero/Todos)
 await page.getByRole('radio',{name:'Dinero',exact:true}).click();await page.getByRole('radio',{name:'Todos',exact:true}).click();await page.waitForTimeout(200);
 const n=await page.locator('.pp-burbuja').count();
 for(const i of [0,Math.floor(n/2),n-1]){
  const b=page.locator('.pp-burbuja').nth(i);await b.scrollIntoViewIfNeeded();await b.locator('circle').hover();await page.waitForTimeout(150);
  const t=await page.evaluate(()=>{const e=document.querySelector('.pp-tip');if(!e)return null;const r=e.getBoundingClientRect();return {w:r.width,l:r.left,r:r.right,t:r.top,b:r.bottom,vw:innerWidth,vh:innerHeight,fs:parseFloat(getComputedStyle(e).fontSize)};});
  tips++;
  if(!t||t.w<159||t.w>281||t.l<-0.5||t.r>t.vw+0.5||t.t<-0.5||t.b>t.vh+0.5||t.fs<11.99){total++;console.log(`FALLA tooltip ${theme} ${w} #${i}: ${JSON.stringify(t)}`);}
 }
 await page.locator('.pp-burbuja').first().focus();await page.keyboard.press('Tab');
 const foco=await page.evaluate(()=>document.activeElement?.classList.contains('pp-burbuja'));
 if(!foco){total++;console.log(`FALLA Tab no recorre burbujas ${theme} ${w}`);}
 await page.keyboard.press('Enter');await page.waitForTimeout(200);
 if(!await page.evaluate(()=>!!document.querySelector('.pp-burbuja[aria-pressed=true]'))){total++;console.log(`FALLA Enter no marca burbuja ${theme} ${w}`);}
 await ctx.close();
}
await browser.close();
console.log(`burbujas: ${corridas} vistas, ${tips} tooltips, ${total} hallazgos`);process.exit(total?1:0);
