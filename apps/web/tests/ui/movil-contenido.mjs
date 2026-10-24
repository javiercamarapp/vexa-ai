// Auditoría del CONTENIDO móvil (celular) de todas las rutas del menú, con Playwright real (hasTouch + isMobile) y fixtures.
//   VEXA_UI_BASE=http://localhost:3210 node tests/ui/movil-contenido.mjs [--routes=/overview,/map] [--sizes=390,360,430] [--themes=light,dark] [--capturas=dir] [--detalle]
// Por cada ruta x ancho x tema mide: desborde horizontal del documento, cifras de KPI en UNA línea, controles con zona táctil >= 44 px (prueba de impacto con
// elementFromPoint, así cuenta el área ampliada con ::after), texto >= 12 px, palabras partidas a media palabra o líneas de una sola letra, pestañas cortadas,
// y que la primera cifra de Hoy quede en el primer pliegue. Sale con código 1 si hay hallazgos. Con --capturas guarda una captura de página completa por combinación.
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const F=await import('./fixtures.mjs');const {respond}=F;
const {MENU}=await import('../../src/lib/workspace/menu.mjs');
const arg=(k,d)=>(process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3))??d;
const base=process.env.VEXA_UI_BASE??'http://localhost:3210';
const menuRoutes=[...new Set(MENU.flatMap(x=>x.tipo==='item'?[x.href]:(x.items??[]).map(i=>i.href)).concat(['/pain-points','/notifications','/confianza','/cfo?vista=informe']))];
const routes=arg('routes',null)?.split(',')??menuRoutes;
const sizes=arg('sizes','390,360,430').split(',').map(Number),themes=arg('themes','light,dark').split(',');
const capDir=arg('capturas',null);
const detalle=process.argv.includes('--detalle'),completo=process.argv.includes('--completo');const cut=(a,n)=>completo?a:a.slice(0,n);
if(capDir)mkdirSync(capDir,{recursive:true});

/** Se ejecuta en la página. */
async function medir(){
 const vis=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&cs.opacity!=='0';};
 const desc=e=>e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'')+' "'+(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,28).replace(/\s+/g,' ')+'"';
 const oculto=e=>e.closest('.sr-only,[hidden],[aria-hidden=true],dialog:not([open]),svg');
 const out={desborde:[],kpi:[],tactil:[],texto:[],partidas:[],pestanas:[],pliegue:[]};
 const doc=document.documentElement;
 if(doc.scrollWidth>innerWidth+1)out.desborde.push('documento '+doc.scrollWidth+'>'+innerWidth);
 const all=[...document.querySelectorAll('.workspace-content *')].filter(e=>!['SCRIPT','STYLE','NOSCRIPT'].includes(e.tagName)&&!oculto(e)&&vis(e));
 // 1. Cifras de KPI en una línea
 for(const e of all.filter(e=>e.matches('.pc-kpi-valor,.stat-value,.ui-kpi-value,.hoy-kpi-valor,.pfig-value,.kpi-valor,[class*="kpi"][class*="valor"],[class*="kpi"][class*="value"]'))){
  const lh=parseFloat(getComputedStyle(e).lineHeight)||parseFloat(getComputedStyle(e).fontSize)*1.2;
  const txt=(e.textContent||'').trim();if(!txt)continue;
  const rg=document.createRange();rg.selectNodeContents(e);const tops=new Set([...rg.getClientRects()].map(r=>Math.round(r.top/4)));
  if(!e.hasAttribute('data-largo')&&(tops.size>1||e.scrollWidth>e.clientWidth+1))out.kpi.push(desc(e)+' '+tops.size+' líneas, '+e.scrollWidth+'/'+e.clientWidth);
 }
 // 2. Texto >= 12 px
 for(const e of all){
  const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!own)continue;
  const fs=parseFloat(getComputedStyle(e).fontSize);if(fs>0&&fs<11.99)out.texto.push(desc(e)+' '+fs+'px');
 }
 // 3. Palabras partidas a media palabra / líneas de una sola letra
 let presupuesto=5000;
 const walker=document.createTreeWalker(document.querySelector('.workspace-content')||document.body,NodeFilter.SHOW_TEXT);
 let n;
 while((n=walker.nextNode())&&presupuesto>0){
  const p=n.parentElement;if(!p||oculto(p)||!vis(p)||p.closest('script,style'))continue;
  const t=n.textContent;if(!t.trim())continue;
  const re=/[\p{L}\p{N}]{3,}/gu;let m;
  while((m=re.exec(t))&&presupuesto-->0){
   const rg=document.createRange();rg.setStart(n,m.index);rg.setEnd(n,m.index+m[0].length);
   const tops=new Set([...rg.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.top/3)));
   if(tops.size>1){out.partidas.push('"'+m[0]+'" en '+desc(p));break;}
  }
 }
 // líneas de una sola letra: cadenas de >=3 hijos/filas con 1 carácter en un elemento
 for(const e of all){
  if(e.children.length)continue;const t=(e.textContent||'').trim();if(t.length<4||t.length>60)continue;
  const rg=document.createRange();rg.selectNodeContents(e);const rs=[...rg.getClientRects()].filter(r=>r.width>0);
  if(rs.length>=4&&rs.every(r=>r.width<=parseFloat(getComputedStyle(e).fontSize)*1.2)&&!/^\s*$/.test(t))out.partidas.push('letra por línea: '+desc(e));
 }
 // 4. Zona táctil >= 44 px (prueba de impacto)
 const ctl=all.filter(e=>e.matches('button,a[href],select,input:not([type=hidden]),textarea,[role=tab],[role=button],[role=switch],summary')&&!e.matches('.sr-only,.skip-link,.agente-round')&&!e.closest('.workspace-bottom-nav,.mobile-sidebar,.workspace-header'));
 for(const e of ctl){
  if(e.tagName==='A'&&e.closest('p,li.pc-s,.pc-notas,td,.pc-s,.pc-t,small,.prose,.ui-notice,.notice,.brief-text')&&getComputedStyle(e).display==='inline')continue; // enlace de texto en línea (WCAG 2.5.8 excepción)
  if(e.type==='checkbox'||e.type==='radio'){const l=e.closest('label');if(l&&l.getBoundingClientRect().height>=43.5)continue;}
  const r0=e.getBoundingClientRect();if(r0.width<1)continue;
  if(r0.height>=43.5&&r0.width>=43.5)continue;
  e.scrollIntoView({block:'center',inline:'center'});
  const r=e.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)continue;
  const cx=r.left+r.width/2,cy=r.top+r.height/2;
  const ok=(x,y)=>{if(x<0||y<0||x>=innerWidth||y>=innerHeight)return true;const h=document.elementFromPoint(x,y);return !!h&&(e===h||e.contains(h)||h.contains(e)&&h.closest('label')===e.closest('label')&&!!h.closest('label'));};
  const needH=r.height<43.5,needW=r.width<43.5;
  const pasa=(!needH||(ok(cx,cy-21)&&ok(cx,cy+21)))&&(!needW||(ok(cx-21,cy)&&ok(cx+21,cy)));
  if(!pasa)out.tactil.push(desc(e)+' '+Math.round(r.width)+'×'+Math.round(r.height));
 }
 window.scrollTo(0,0);
 // 5. Pestañas: la última no se corta y hay separación
 for(const c of document.querySelectorAll('.pc-tabs,.segmented,[role=tablist],.ui-filterbar,.hoy-filtros')){
  if(!vis(c)||oculto(c))continue;
  const items=[...c.querySelectorAll(':scope > a,:scope > button,:scope > li > a,:scope > li > button,:scope > [role=tab]')].filter(vis);
  if(items.length<2)continue;
  c.scrollLeft=c.scrollWidth;await new Promise(r=>setTimeout(r,60));
  const cr=c.getBoundingClientRect(),last=items[items.length-1].getBoundingClientRect();
  if(last.right>cr.right+2||last.right>innerWidth+2)out.pestanas.push('última cortada en '+desc(c)+' ('+Math.round(last.right)+'>'+Math.round(cr.right)+')');
  c.scrollLeft=0;
  if(c.matches('.pc-tabs,[role=tablist]')){for(let i=1;i<items.length;i++){const a=items[i-1].getBoundingClientRect(),b=items[i].getBoundingClientRect();if(b.left-a.right<2&&b.left>a.right-1){out.pestanas.push('pestañas pegadas en '+desc(c));break;}}
   const act=items.find(i=>i.matches('[aria-current=page],[aria-selected=true],[aria-pressed=true]'));
   if(act&&c.scrollWidth>c.clientWidth+1){act.scrollIntoView({inline:'center',block:'nearest'});await new Promise(r=>setTimeout(r,60));const ar=act.getBoundingClientRect(),cr2=c.getBoundingClientRect();if(ar.left<cr2.left-1||ar.right>cr2.right+1)out.pestanas.push('la activa no queda visible en '+desc(c));c.scrollLeft=0;}}
 }
 // 6. Primer pliegue de Hoy: primera cifra visible
 if(location.pathname==='/overview'){
  const k=document.querySelector('.hoy-kpis .hoy-kpi-valor,.hoy-kpis [class*="valor"],.hoy-page .pfig-value,.hoy-page .stat-value,.hoy-page [class*="kpi"] [class*="value"]');
  if(!k)out.pliegue.push('no se encontró ninguna cifra KPI');
  else{const r=k.getBoundingClientRect();if(r.bottom>innerHeight)out.pliegue.push('la primera cifra termina en y='+Math.round(r.bottom)+' > '+innerHeight);}
  const fr=document.querySelector('.hoy-cobertura,.hoy-estado,.hoy-franja,[class*="franja"]');
  if(fr){const h=fr.getBoundingClientRect().height;if(h>44.5)out.pliegue.push('franja de estado de '+Math.round(h)+' px > 44 ('+(fr.className||'').toString().slice(0,30)+')');}
 }
 for(const k of Object.keys(out))out[k]=[...new Set(out[k])];
 return out;
}

const browser=await chromium.launch();
const filas=[];let fallas=0;
for(const theme of themes)for(const w of sizes){
 const h=w===360?780:w===430?932:844;
 const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,hasTouch:true,isMobile:true,reducedMotion:'reduce',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
 await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{}},theme);
 await ctx.route('**/api/**',async route=>{const q=route.request();if(/resource=problems/.test(q.url())&&/slim=1/.test(q.url()))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:F.bundleProblemsCatalogo()})});const V=process.env.VEXA_UI_VARIANT,u2=V?q.url()+(q.url().includes('?')?'&':'?')+'variant='+V:q.url();const hh=await respond(u2,q.method(),q.postData());return hh?route.fulfill({status:hh[0],contentType:'application/json',body:JSON.stringify(hh[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
 for(const r of routes){
  const page=await ctx.newPage();let m;
  try{await page.goto(base+r,{waitUntil:'networkidle',timeout:120000});await page.waitForTimeout(700);
   if(capDir&&w===390)await page.screenshot({path:join(capDir,r.replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')+'-'+theme+'-'+w+'.jpg'),type:'jpeg',quality:60,fullPage:true}).catch(()=>{});
   if(!await page.$('.workspace-content'))throw new Error('sin .workspace-content (¿error de compilación o de carga?)');
   m=await page.evaluate(medir);}
  catch(e){m={desborde:[],kpi:[],tactil:[],texto:[],partidas:[],pestanas:[],pliegue:[],error:String(e.message).slice(0,80)};}
  await page.close();
  const n=Object.entries(m).filter(([k])=>k!=='error').reduce((s,[,v])=>s+v.length,0)+(m.error?1:0);fallas+=n;
  filas.push({ruta:r,ancho:w,tema:theme,desborde:m.desborde.length,kpi:m.kpi.length,tactil:m.tactil.length,texto12:m.texto.length,partidas:m.partidas.length,pestanas:m.pestanas.length,pliegue:m.pliegue.length,error:m.error??''});
  if(detalle&&n)console.log('--',theme,w,r,JSON.stringify({d:m.desborde,k:cut(m.kpi,3),t:cut(m.tactil,6),x:cut(m.texto,4),p:cut(m.partidas,4),pe:m.pestanas,pl:m.pliegue,e:m.error}));
 }
 await ctx.close();
}
await browser.close();
const mal=filas.filter(f=>f.desborde||f.kpi||f.tactil||f.texto12||f.partidas||f.pestanas||f.pliegue||f.error);
console.table(mal);
console.log(`${filas.length} combinaciones, ${mal.length} con hallazgos, ${fallas} hallazgos`);
process.exit(fallas?1:0);
