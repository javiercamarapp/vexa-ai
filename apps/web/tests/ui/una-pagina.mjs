// Guardia «UNA PÁGINA»: «Pregúntale a tus datos» y «CFO» caben en la pantalla sin scroll de página (como ChatGPT o Lovable) y comparten controles compactos.
// Por cada tamaño × tema comprueba:
//   · /preguntale (portada), /preguntale con un hilo de varias respuestas largas, /cfo (resumen) y /cfo?vista=informe: document.scrollHeight <= innerHeight y sin desborde horizontal;
//   · portada completa visible (logo, título, sugerencias, compositor) sin que el compositor tape nada; con hilo, el hilo scrollea por dentro, queda anclado abajo y el compositor sigue visible;
//   · controles (.ctl, .seg-btn, .btn): alto 32 px escritorio / 36 px hasta 819 px (±1), fuente 13 px, nunca se tocan (separación ≥ 8 px), texto visible ≥ 12 px, zona táctil ≥ 44 px (área invisible);
//   · capturas en ~/.codex-work/rovaq-cierre-20261007/estrategia-20261023/diseno-panel/una-pagina-capturas/.
//   VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev --webpack -p 3340   (otra terminal)
//   VEXA_UI_BASE=http://localhost:3340 node tests/ui/una-pagina.mjs [--sizes=390x844,360x740,768x1024,1440x900,1280x720] [--themes=light,dark] [--out=dir] [--solo=portada,hilo,cfo,informe]
// Sale con código 1 si falla algo. --selftest comprueba que las reglas SÍ detectan scroll de página y botones pegados.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const {respond}=await import('./fixtures.mjs');
const arg=(k,d)=>(process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3))??d;
const base=process.env.VEXA_UI_BASE??'http://localhost:3340';
const sizes=arg('sizes','390x844,360x740,768x1024,1440x900,1280x720').split(',').map(x=>x.split('x').map(Number));
const themes=arg('themes','light,dark').split(',');
const solo=arg('solo','portada,hilo,cfo,informe').split(',');
const out=arg('out',path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/estrategia-20261023/diseno-panel/una-pagina-capturas'));
fs.mkdirSync(out,{recursive:true});
const fallas=[];let comprobaciones=0;
const check=(ok,msg)=>{comprobaciones++;if(!ok){fallas.push(msg);console.log('   - FALLA: '+msg);}};

/** En la página: escala de documento y desborde. */
function medirPagina(){
 const de=document.documentElement,b=document.body;
 return {sh:de.scrollHeight,bh:b.scrollHeight,ih:innerHeight,sw:de.scrollWidth,iw:innerWidth,scrollY:scrollY};
}
/** En la página: controles visibles, su alto/fuente, zona táctil y separación entre vecinos. */
function medirControles(){
 const vis=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&!e.closest('[hidden],.sr-only');};
 // Recorte por contenedores con scroll: un control fuera del área visible de su fila deslizable no cuenta para vecinos.
 const recorte=e=>{let r=e.getBoundingClientRect(),v={l:Math.max(0,r.left),t:Math.max(0,r.top),r:Math.min(innerWidth,r.right),b:Math.min(innerHeight,r.bottom)};for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const cs=getComputedStyle(p);if(/(auto|scroll|hidden|clip)/.test(cs.overflowX+cs.overflowY)){const q=p.getBoundingClientRect();v={l:Math.max(v.l,q.left),t:Math.max(v.t,q.top),r:Math.min(v.r,q.right),b:Math.min(v.b,q.bottom)};}}return v;};
 const desc=e=>e.tagName.toLowerCase()+'.'+String(e.className).trim().split(/\s+/).slice(0,2).join('.')+' "'+(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,22)+'"';
 const raiz=document.querySelector('.workspace-content');if(!raiz)return {items:[],texto:[]};
 const sel='.ctl,.seg-btn,.btn,.copiloto-hist-btn,.agente-round';
 const items=[...raiz.querySelectorAll(sel)].filter(e=>vis(e)&&!e.matches('.ctl-icon:disabled')).map(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e),a=getComputedStyle(e,'::after'),c=recorte(e);const hit=a.content!=='none'&&a.position==='absolute'?e.getBoundingClientRect().height+Math.abs(parseFloat(a.top)||0)+Math.abs(parseFloat(a.bottom)||0):r.height;return {d:desc(e),x:r.left,y:r.top,w:r.width,h:r.height,fs:parseFloat(cs.fontSize),hit,en:c.r-c.l>=r.width-1&&c.b-c.t>=r.height-1,ctl:e.classList.contains('ctl'),r:parseFloat(cs.borderTopLeftRadius)};});
 const texto=[];
 for(const e of raiz.querySelectorAll('*')){if(!vis(e)||e.closest('svg,.particle-field'))continue;const cerrado=e.closest('details:not([open])');if(cerrado&&!e.closest('summary'))continue;const p=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!p)continue;const cs=getComputedStyle(e),fs=parseFloat(cs.fontSize);if(fs<11||(fs<11.99&&cs.textTransform!=='uppercase'))texto.push(desc(e)+' '+fs+'px');}
 return {items,texto};
}
/** Separación mínima entre pares (<8 px = se tocan o se montan). Solo pares ambos visibles por completo. */
function vecinos(items,min=8){
 const mal=[];
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const a=items[i],b=items[j];if(!a.en||!b.en)continue;
  const gx=Math.max(a.x-(b.x+b.w),b.x-(a.x+a.w)),gy=Math.max(a.y-(b.y+b.h),b.y-(a.y+a.h));
  const sep=gx<0&&gy<0?Math.max(gx,gy):Math.max(gx,gy,0)===0&&(gx<0||gy<0)?Math.max(gx,gy):Math.max(gx,gy);
  const cerca=(gx<0&&gy<0)||(gx<min&&gy<0)||(gy<min&&gx<0)||(gx>=0&&gy>=0&&Math.hypot(gx,gy)<min);
  if(cerca)mal.push(`${a.d} ⟂ ${b.d} (${Math.round(gx)},${Math.round(gy)})`);
 }
 return mal;
}
function reglasControles(tag,m,W<=819){
 const H=movil?36:32;
 // Las preguntas sugeridas (.ctl-q) son frases: nunca se truncan, así que en celular pueden ocupar 2 líneas (alto ≥ H); el resto mide H exacto.
 const raros=m.items.filter(i=>i.ctl||/seg-btn/.test(i.d)).filter(i=>/ctl-q/.test(i.d)?i.h<H-1.01:Math.abs(i.h-H)>1.01);
 check(raros.length===0,`${tag}: controles con alto ≠ ${H}±1: ${raros.slice(0,4).map(i=>i.d+' '+i.h.toFixed(1)).join(' | ')}`);
 const fs=m.items.filter(i=>i.ctl).filter(i=>Math.abs(i.fs-13)>0.1);
 check(fs.length===0,`${tag}: botones con fuente ≠ 13 px: ${fs.slice(0,4).map(i=>i.d+' '+i.fs).join(' | ')}`);
 const hit=m.items.filter(i=>i.ctl&&i.hit<43.5);
 check(hit.length===0,`${tag}: zona táctil < 44 px: ${hit.slice(0,4).map(i=>i.d+' '+i.hit).join(' | ')}`);
 const mal=vecinos(m.items);
 check(mal.length===0,`${tag}: controles que se tocan o se montan (<8 px): ${mal.slice(0,4).join(' | ')}`);
 check(m.texto.length===0,`${tag}: texto < 12 px: ${m.texto.slice(0,4).join(' | ')}`);
}
const sinScroll=(tag,p)=>{check(p.sh<=p.ih&&p.bh<=p.ih+1,`${tag}: la página scrollea (documento ${p.sh}/${p.bh} > ventana ${p.ih})`);check(p.sw<=p.iw,`${tag}: desborde horizontal ${p.sw} > ${p.iw}`);check(p.scrollY===0,`${tag}: la página se desplazó (${p.scrollY})`);};

const browser=await chromium.launch();
if(process.argv.includes('--selftest')){
 // Control negativo: en una página que SÍ scrollea y con botones pegados las reglas deben fallar.
 const ctx=await browser.newContext({viewport:{width:390,height:700},isMobile:true});const page=await ctx.newPage();
 await page.setContent('<style>.ctl{display:inline-block;height:20px;font-size:13px;margin:0}</style><div style="height:2000px"><span class="ctl" style="position:relative">a</span><span class="ctl">b</span></div>');
 const p=await page.evaluate(medirPagina);const m=await page.evaluate(()=>({items:[...document.querySelectorAll('.ctl')].map(e=>{const r=e.getBoundingClientRect();return {d:e.textContent,x:r.left,y:r.top,w:r.width,h:r.height,fs:13,hit:r.height,en:true,ctl:true};}),texto:[]}));
 const antes=fallas.length;sinScroll('selftest',p);reglasControles('selftest',m,true);
 const n=fallas.length-antes;console.log(n>=3?`PASS selftest: ${n} reglas detectaron scroll, alto y vecinos pegados`:`FAIL selftest: solo ${n} detecciones`);
 await browser.close();process.exit(n>=3?0:1);
}
const PREGUNTAS=['¿Cuánto dinero en reembolsos tuvimos por marketplace?','¿Qué dicen los clientes sobre el producto dañado en tránsito?','¿Cuántos reembolsos tuvimos en Zendesk?','¿Cuánto voy a vender el próximo trimestre?'];
for(const theme of themes)for(const [W,H] of sizes){
 const movil=W<768;
 console.log(`== ${W}×${H} ${theme}`);
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,reducedMotion:'reduce',colorScheme:theme,isMobile:movil,hasTouch:movil});
 await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{}},theme);
 await ctx.route('**/api/**',async route=>{const q=route.request();const hit=await respond(q.url(),q.method(),q.postData());if(!hit)return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"fixture_missing"}}'});return route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])});});
 const foto=(page,n)=>page.screenshot({path:path.join(out,`${n}-${W}x${H}-${theme}.png`)});
 const abrir=async(r,esperar)=>{const page=await ctx.newPage();try{await page.goto(base+r,{waitUntil:'networkidle',timeout:120000});await page.waitForSelector(esperar,{timeout:20000});}catch(e){check(false,`${r}@${W}x${H}/${theme}: no cargó (${String(e.message).slice(0,70)})`);}await page.waitForTimeout(500);return page;};
 const encaja=async(page,tag,sels)=>{ // lo esencial dentro de la ventana y sin quedar bajo el compositor ni la barra inferior
  const g=await page.evaluate(ss=>{const c=document.querySelector('.agente-composer')?.getBoundingClientRect(),n=document.querySelector('.workspace-bottom-nav'),nb=n&&getComputedStyle(n).display!=='none'?n.getBoundingClientRect():null;
   return {c:c?{t:c.top,b:c.bottom}:null,nTop:nb?nb.top:null,vh:innerHeight,els:ss.map(s=>{const e=document.querySelector(s);if(!e)return {s,falta:true};const r=e.getBoundingClientRect();return {s,t:r.top,b:r.bottom,l:r.left,r:r.right};})};},sels);
  check(!!g.c,`${tag}: no hay compositor`);if(!g.c)return;
  check(g.c.b<=g.vh+0.5&&g.c.t>=0,`${tag}: el compositor no está completo en la ventana (${Math.round(g.c.t)}–${Math.round(g.c.b)} de ${g.vh})`);
  if(g.nTop!==null)check(g.c.b<=g.nTop+0.5,`${tag}: el compositor se monta con la barra inferior`);
  for(const e of g.els){if(e.falta){check(false,`${tag}: falta ${e.s}`);continue;}check(e.t>=-0.5&&e.b<=g.vh+0.5&&e.l>=-0.5&&e.r<=innerWidthOf(W)+0.5,`${tag}: ${e.s} fuera de la ventana (${Math.round(e.t)}–${Math.round(e.b)})`);const limite=g.nTop!==null?Math.min(g.nTop,g.c.t):g.c.t;if(e.s!=='.agente-composer')check(e.b<=limite+0.5||e.t>=g.c.b-0.5,`${tag}: ${e.s} queda bajo el compositor o la barra (${Math.round(e.b)} > ${Math.round(limite)})`);}
 };
 const innerWidthOf=w=>w;
 if(solo.includes('portada')){
  const tag=`portada@${W}x${H}/${theme}`;const page=await abrir('/preguntale','[data-testid=agente-shell] h1');
  sinScroll(tag,await page.evaluate(medirPagina));
  await encaja(page,tag,['[data-testid=agente-shell] h1','.una-sug','.una-temas','.una-preguntas','.agente-composer']);
  const m=await page.evaluate(medirControles);check(m.items.length>=6,`${tag}: pocos controles medidos (${m.items.length})`);reglasControles(tag,m,W<=819);
  const pregs=await page.locator('.una-preguntas .ctl').count();check(pregs===3,`${tag}: deben verse 3 preguntas del tema (hay ${pregs})`);
  const pend=await page.evaluate(()=>[...document.querySelectorAll('.una-temas .ctl')].every(e=>e.getBoundingClientRect().height>0));check(pend,`${tag}: temas sin altura`);
  await foto(page,'portada');await page.close();
 }
 if(solo.includes('hilo')){
  const tag=`hilo@${W}x${H}/${theme}`;const page=await abrir('/preguntale','.agente-composer textarea');
  for(const q of PREGUNTAS){const antes=await page.locator('.agente-user').count();await page.fill('.agente-composer textarea',q);await page.keyboard.press('Enter');await page.waitForFunction(n=>document.querySelectorAll('.agente-answer,.agente-cancelled').length>=n,antes+1,{timeout:20000}).catch(()=>check(false,`${tag}: no llegó la respuesta a «${q.slice(0,24)}»`));await page.waitForTimeout(250);}
  await page.waitForTimeout(500);
  sinScroll(tag,await page.evaluate(medirPagina));
  const h=await page.evaluate(()=>{const t=document.querySelector('.agente-thread'),c=document.querySelector('.agente-composer').getBoundingClientRect(),r=t.getBoundingClientRect(),cs=getComputedStyle(t);return {sc:t.scrollHeight,ch:t.clientHeight,top:t.scrollTop,fin:t.scrollHeight-t.scrollTop-t.clientHeight,tb:r.bottom,ct:c.top,cb:c.bottom,vh:innerHeight,ov:cs.overflowY,live:t.getAttribute('aria-live'),role:t.getAttribute('role')};});
  check(h.sc>h.ch+20,`${tag}: el hilo no desborda por dentro (${h.sc} vs ${h.ch}); la prueba necesita respuestas largas`);
  check(/auto|scroll/.test(h.ov),`${tag}: el hilo no es la caja de scroll (${h.ov})`);
  check(h.fin<=4,`${tag}: el hilo no queda anclado abajo (faltan ${Math.round(h.fin)} px)`);
  check(h.tb<=h.ct+0.5,`${tag}: el hilo se monta con el compositor (${Math.round(h.tb)} > ${Math.round(h.ct)})`);
  check(h.cb<=h.vh+0.5,`${tag}: el compositor se sale de la ventana`);
  check(h.live==='polite'&&h.role==='log',`${tag}: el hilo perdió role=log / aria-live=polite`);
  // Subir dentro del hilo no mueve la página; el compositor sigue en su sitio.
  const c0=await page.evaluate(()=>document.querySelector('.agente-composer').getBoundingClientRect().top);
  await page.evaluate(()=>{document.querySelector('.agente-thread').scrollTop=0;});await page.waitForTimeout(150);
  const p2=await page.evaluate(medirPagina),c1=await page.evaluate(()=>document.querySelector('.agente-composer').getBoundingClientRect().top);
  check(p2.scrollY===0&&Math.abs(c1-c0)<1,`${tag}: al subir por el hilo se movió la página o el compositor (${c0}→${c1})`);
  const m=await page.evaluate(medirControles);check(m.items.length>=6,`${tag}: pocos controles medidos`);reglasControles(tag,m,W<=819);
  await page.evaluate(()=>{const t=document.querySelector('.agente-thread');t.scrollTop=t.scrollHeight;});await page.waitForTimeout(200);
  await foto(page,'hilo');
  // Con el hilo abajo, un tercio del hilo hacia arriba también se ve (captura del hilo a media altura).
  await page.evaluate(()=>{const t=document.querySelector('.agente-thread');t.scrollTop=Math.max(0,t.scrollHeight/3);});await page.waitForTimeout(150);await foto(page,'hilo-medio');
  await page.close();
 }
 if(solo.includes('cfo')){
  const tag=`cfo@${W}x${H}/${theme}`;const page=await abrir('/cfo','.una-kpis');
  sinScroll(tag,await page.evaluate(medirPagina));
  await encaja(page,tag,['.una-kpis','.una-tablist','.una-panel','.agente-composer']);
  const m=await page.evaluate(medirControles);check(m.items.length>=8,`${tag}: pocos controles medidos (${m.items.length})`);reglasControles(tag,m,W<=819);
  const kp=await page.evaluate(()=>{const l=[...document.querySelectorAll('.una-kpi')].map(e=>e.getBoundingClientRect());return {n:l.length,misma:l.every(r=>Math.abs(r.top-l[0].top)<1)};});check(kp.n>=4&&kp.misma,`${tag}: los KPI no van en una sola fila (${kp.n})`);
  const pn=await page.evaluate(()=>{const p=document.querySelector('.una-panel').getBoundingClientRect(),c=document.querySelector('.agente-composer').getBoundingClientRect();return {h:p.height,b:p.bottom,ct:c.top};});check(pn.h>=150,`${tag}: el panel principal es muy bajo (${Math.round(pn.h)} px)`);
  await foto(page,'cfo');
  // Cada pestaña: sigue sin scroll de página.
  for(const nombre of ['Alertas','Canales','Calidad','Proyección']){await page.getByRole('tab',{name:new RegExp('^'+nombre)}).click();await page.waitForTimeout(200);sinScroll(`${tag}/${nombre}`,await page.evaluate(medirPagina));}
  await foto(page,'cfo-pestana');
  // CFO con un hilo: el hilo scrollea por dentro y el compositor sigue visible.
  await page.fill('.agente-composer textarea','¿Qué alerta debo atender primero?');await page.keyboard.press('Enter');await page.waitForTimeout(1500);
  sinScroll(tag+'/hilo',await page.evaluate(medirPagina));
  await foto(page,'cfo-hilo');await page.close();
 }
 if(solo.includes('informe')){
  const tag=`informe@${W}x${H}/${theme}`;const page=await abrir('/cfo?vista=informe','.una-kpis');
  sinScroll(tag,await page.evaluate(medirPagina));
  const m=await page.evaluate(medirControles);check(m.items.length>=8,`${tag}: pocos controles medidos (${m.items.length})`);reglasControles(tag,m,W<=819);
  const pn=await page.evaluate(()=>{const p=document.querySelector('.una-panel').getBoundingClientRect();return {h:p.height,b:p.bottom,vh:innerHeight};});check(pn.h>=150&&pn.b<=pn.vh+0.5,`${tag}: el panel principal no cabe (${Math.round(pn.h)} px, fondo ${Math.round(pn.b)}/${pn.vh})`);
  await foto(page,'informe');
  for(const nombre of ['Alertas','Canales','Calidad','Proyección','Exposición','Comparativa','Glosario']){await page.getByRole('tab',{name:new RegExp('^'+nombre)}).click();await page.waitForTimeout(200);sinScroll(`${tag}/${nombre}`,await page.evaluate(medirPagina));if(nombre==='Canales')await foto(page,'informe-canales');}
  await foto(page,'informe-glosario');await page.close();
 }
 await ctx.close();
}
await browser.close();
console.log(fallas.length?`FALLÓ: ${fallas.length} de ${comprobaciones} comprobaciones`:`TODO BIEN: ${comprobaciones} comprobaciones, capturas en ${out}`);
process.exit(fallas.length?1:0);
