// Revisión de la interfaz EN INGLÉS con Chrome headless (Playwright sobre CDP) y fixtures: busca español visible y texto cortado o desbordado a 1440 y 375 px.
//   VEXA_UI_BASE=http://localhost:3290 node tests/ui/ingles-visible.mjs [--routes=/overview,/map] [--sizes=1440,375] [--capturas=dir] [--lang=en]
// Serializa Chrome con el candado /tmp/chrome-cdp.lock (mkdir atómico). Los datos del cliente (fixtures) pueden estar en español: se listan aparte para que se juzguen.
import {createRequire} from 'node:module';
import {mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';

const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const F=await import('./fixtures.mjs');const {respond}=F;
const {MENU}=await import('../../src/lib/workspace/menu.mjs');
const {SUPERADMIN_ROUTES}=await import('./superadmin-rutas.mjs');
const arg=(k,d)=>(process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3))??d;
const base=process.env.VEXA_UI_BASE??'http://localhost:3290';
const lang=arg('lang','en');
const menuRoutes=[...new Set(MENU.flatMap(x=>x.tipo==='item'?[x.href]:(x.items??[]).map(i=>i.href)).concat(['/pain-points','/notifications','/confianza','/cfo?vista=informe']))];
const routes=arg('routes',null)?.split(',')??[...menuRoutes,...SUPERADMIN_ROUTES];
const sizes=arg('sizes','1440,375').split(',').map(Number);
const capDir=arg('capturas',null);
if(capDir)mkdirSync(capDir,{recursive:true});

const LOCK='/tmp/chrome-cdp.lock';
async function tomarCandado(){for(let i=0;i<600;i++){try{mkdirSync(LOCK);return;}catch{await new Promise(r=>setTimeout(r,1000));}}throw new Error('candado de Chrome ocupado');}
const soltarCandado=()=>{try{rmSync(LOCK,{recursive:true,force:true});}catch{}};

/** Se ejecuta en la página: líneas de texto visibles y desbordes. */
function medir(){
 const ES=/\b(de|del|la|las|los|el|y|en|para|por|sin|con|una?|tu|tus|que|se|su|más|hay|aún|ver|todos|nuevo|nueva|guardar|cancelar|cerrar|buscar|cargando|volver|siguiente|anterior|datos|cliente|clientes|pedidos|ventas|mes|meses|semana|días|no)\b/gi;
 const ACC=/[áéíóúñ¿¡]/i;
 // Autónimos de idioma: se muestran en su propio idioma a propósito.
 const AUTONIMOS=new Set(['Español']);

 const vis=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&cs.opacity!=='0';};
 const out={espanol:[],cortado:[],desborde:null};
 const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;const vistos=new Set();
 while((n=w.nextNode())){const p=n.parentElement;if(!p||p.closest('script,style,noscript,svg,[aria-hidden=true]')||!vis(p))continue;
  const t=n.textContent.replace(/\s+/g,' ').trim();if(t.length<4||vistos.has(t)||AUTONIMOS.has(t))continue;vistos.add(t);
  const k=(t.match(ES)||[]).length;if(ACC.test(t)||k>=2)out.espanol.push(t.slice(0,120));}
 for(const e of document.querySelectorAll('[aria-label],[title],[placeholder]')){if(!vis(e))continue;for(const a of['aria-label','title','placeholder']){const t=e.getAttribute(a);if(t&&!/^(Español|Switch language to Español)$/.test(t)&&(ACC.test(t)||(t.match(ES)||[]).length>=2)&&!vistos.has(t)){vistos.add(t);out.espanol.push('['+a+'] '+t.slice(0,120));}}}
 for(const e of document.querySelectorAll('button,a,th,td,label,summary,h1,h2,h3,h4,p,span,div,li')){
  if(!vis(e)||e.closest('svg,script,style,.sr-only'))continue;
  const own=[...e.childNodes].some(x=>x.nodeType===3&&x.textContent.trim());if(!own)continue;
  const cs=getComputedStyle(e);
  if(e.scrollWidth>e.clientWidth+2&&e.clientWidth>0&&(cs.overflowX==='hidden'||cs.textOverflow==='ellipsis'||cs.overflowX==='clip')&&!e.hasAttribute('title'))out.cortado.push(e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0]+' "'+e.textContent.trim().slice(0,50)+'" '+e.scrollWidth+'>'+e.clientWidth);
  else if(e.scrollHeight>e.clientHeight+3&&e.clientHeight>0&&(cs.overflowY==='hidden'||cs.overflowY==='clip')&&cs.display!=='inline')out.cortado.push('alto '+e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0]+' "'+e.textContent.trim().slice(0,50)+'" '+e.scrollHeight+'>'+e.clientHeight);
 }
 const d=document.documentElement;if(d.scrollWidth>innerWidth+1)out.desborde=d.scrollWidth+'>'+innerWidth;
 out.cortado=out.cortado.slice(0,12);
 return out;
}

await tomarCandado();
const browser=await chromium.launch(process.env.VEXA_CHROME?{executablePath:process.env.VEXA_CHROME,headless:true}:{});
const informe=[];
try{
 for(const w of sizes){
  const ctx=await browser.newContext({viewport:{width:w,height:w<500?812:900},deviceScaleFactor:1,reducedMotion:'reduce'});
  await ctx.addCookies([{name:'rovaq_lang',value:lang,url:base}]);
  await ctx.addInitScript(()=>{try{localStorage.setItem('vexa-theme','light');}catch{}});
  await ctx.route('**/api/**',async route=>{const q=route.request();if(/resource=problems/.test(q.url())&&/slim=1/.test(q.url()))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:F.bundleProblemsCatalogo()})});const hh=await respond(q.url(),q.method(),q.postData());return hh?route.fulfill({status:hh[0],contentType:'application/json',body:JSON.stringify(hh[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
  for(const r of routes){
   const page=await ctx.newPage();
   try{
    await page.goto(base+r+(r.includes('?')?'&':'?')+'lang='+lang,{waitUntil:'networkidle',timeout:120000});await page.waitForTimeout(900);
    await page.evaluate(()=>document.querySelector('.onb-invitacion .onb-btn-sec')?.click());await page.waitForTimeout(150);
    const m=await page.evaluate(medir);
    informe.push({ruta:r,ancho:w,...m});
    if(capDir)await page.screenshot({path:join(capDir,`${r.replace(/[^\w]+/g,'_').replace(/^_|_$/g,'')||'raiz'}-${w}.png`),fullPage:false});
    console.log(`${w} ${r} es=${m.espanol.length} cortado=${m.cortado.length} desborde=${m.desborde??'-'}`);
   }catch(e){informe.push({ruta:r,ancho:w,error:String(e).slice(0,160)});console.log(`${w} ${r} ERROR ${String(e).slice(0,100)}`);}
   await page.close();
  }
  await ctx.close();
 }
}finally{await browser.close();soltarCandado();}
console.log('\n=== DETALLE ===');
for(const i of informe){if(i.error||i.espanol?.length||i.cortado?.length||i.desborde){console.log('\n# '+i.ruta+' @'+i.ancho+(i.error?' ERROR '+i.error:''));for(const t of i.espanol??[])console.log('  ES  '+t);for(const t of i.cortado??[])console.log('  CUT '+t);if(i.desborde)console.log('  DESBORDE '+i.desborde);}}
