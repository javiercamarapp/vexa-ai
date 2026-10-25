// Prueba móvil REAL del caparazón (Playwright, isMobile + hasTouch) a 390×844, 360×780 y 430×932, en claro y oscuro.
// Mide: logo Rovaq en la barra (sin texto de cliente ni avatar circular), sin desborde horizontal del caparazón, zonas táctiles ≥ 44 px, barra inferior de 5 destinos sin superposición, selector de empresa visible,
// texto ≥ 12 px, sin `title` como único nombre accesible, compositor del chat sobre el teclado simulado, hoja «Más» y hoja de empresa (90 dvh, X ≥ 44),
// selector de tema centrado, sin destello de tema y PWA (manifest maskable, viewport-fit=cover). Guarda capturas.
//   VEXA_UI_FIXTURES=1 VEXA_UI_FIXTURES_PLATFORM=1 VEXA_UI_FIXTURES_ROLE=owner npx next dev -p 3200   (otra terminal)
//   VEXA_UI_BASE=http://localhost:3200 node tests/ui/movil.mjs [--routes=/overview,/cfo] [--sizes=390,360,430] [--themes=light,dark] [--out=dir]
// Sale con código 1 si falla algo del CAPARAZÓN. El desborde horizontal del CONTENIDO de cada pantalla se informa aparte (lo corrige el carril de contenido).
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const require=createRequire(process.env.VEXA_PW_PACKAGE??'/private/tmp/claude-501/vexa-pw/package.json');
const {chromium}=require('playwright-core');
const {respond}=await import('./fixtures.mjs');
const arg=(k,d)=>(process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3))??d;
const base=process.env.VEXA_UI_BASE??'http://localhost:3200';
const {MENU}=await import('../../src/lib/workspace/menu.mjs');
// Por defecto: las rutas de la barra inferior (con su destino activo esperado) y TODAS las del menú (identidad de la barra: logo Rovaq, sin texto de cliente).
const menuRoutes=[...new Set(MENU.flatMap(x=>x.tipo==='item'?[x.href]:(x.items??[]).map(i=>i.href)))];
const routes=arg('routes',[...new Set(['/overview','/cfo','/gaps','/problems','/recommendations','/preguntale','/confianza','/map','/settings/team',...menuRoutes])].join(',')).split(',');
const sizes=arg('sizes','390,360,430').split(',').map(Number),themes=arg('themes','light,dark').split(',');
const SIZE={390:[390,844],360:[360,780],430:[430,932]};
const out=arg('out',path.join(os.homedir(),'.codex-work/rovaq-cierre-20261007/estrategia-20261023/diseno-panel/movil-capturas-nuevas'));
fs.mkdirSync(out,{recursive:true});
const fallas=[],avisos=[];let comprobaciones=0;
const check=(ok,msg)=>{comprobaciones++;if(!ok){fallas.push(msg);console.log('   - FALLA: '+msg);}};
const aviso=msg=>{avisos.push(msg);console.log('   - aviso: '+msg);};
const slug=r=>r.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-')||'raiz';

/** En la página: nombre accesible mínimo de un control. */
function nombreAccesible(e){return (e.getAttribute('aria-label')||[...(e.getAttribute('aria-labelledby')||'').split(/\s+/)].map(i=>document.getElementById(i)?.textContent||'').join(' ')||e.textContent||'').trim();}
/** Mide el caparazón dentro de `raiz` (selector). Devuelve controles pequeños, fuentes <12, títulos como único nombre. */
function medirCaparazon(raices){
 const vis=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
 const nombreDe=e=>(e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(i=>document.getElementById(i)?.textContent||'').join(' ')||e.textContent||'').trim();
 const res={chicos:[],fuentes:[],soloTitle:[],total:0};
 for(const sel of raices)for(const raiz of document.querySelectorAll(sel)){
  if(!vis(raiz))continue;
  /* Zona táctil efectiva: el control más compacto amplía su toque con ::after (elementFromPoint ve el área ampliada). */
  const toque44=(e,r)=>{const cx=r.left+r.width/2,cy=r.top+r.height/2;return [[-21.5,-21.5],[21.5,-21.5],[-21.5,21.5],[21.5,21.5]].every(([dx,dy])=>{const x=cx+dx,y=cy+dy;if(x<0||y<0||x>=innerWidth||y>=innerHeight)return true;const t=document.elementFromPoint(x,y);return !!t&&(t===e||e.contains(t));});};
  for(const e of raiz.querySelectorAll('a[href],button,select,input:not([type=hidden]),summary,label:has(input[type=radio])')){
   if(!vis(e)||e.closest('.sr-only,[hidden]')||e.matches('.sr-only'))continue;
   res.total++;
   const r=e.getBoundingClientRect();
   if(e.tagName==='INPUT'&&e.type==='radio')continue; // el control es su <label> (medido aparte)
   if((r.height<43.5||r.width<43.5)&&!toque44(e,r))res.chicos.push((e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/)[0]:'')+' "'+nombreDe(e).slice(0,24)+'" '+Math.round(r.width)+'×'+Math.round(r.height)));
   if(e.getAttribute('title')&&!nombreDe(e))res.soloTitle.push(e.outerHTML.slice(0,80));
  }
  for(const e of raiz.querySelectorAll('*')){
   if(!vis(e)||e.closest('.sr-only,svg'))continue;
   const propio=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!propio)continue;
   const cs=getComputedStyle(e),fs=parseFloat(cs.fontSize);
   if(fs<11.5)res.fuentes.push(e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0]+' "'+e.textContent.trim().slice(0,20)+'" '+cs.fontSize);
  }
 }
 return res;
}
const browser=await chromium.launch();
for(const theme of themes)for(const w of sizes){
 const [W,H]=SIZE[w]??[w,844];
 console.log(`== ${W}×${H} ${theme}`);
 const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce',colorScheme:theme==='dark'?'dark':'light'});
 await ctx.addInitScript(t=>{try{localStorage.setItem('vexa-theme',t);}catch{}window.__temas=[];new MutationObserver(()=>window.__temas.push(document.documentElement.dataset.theme??null)).observe(document,{attributes:true,subtree:true,attributeFilter:['data-theme']});},theme);
 await ctx.route('**/api/**',async route=>{const q=route.request();if(/resource=problems/.test(q.url())&&/slim=1/.test(q.url())){const F=await import('./fixtures.mjs');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:F.bundleProblemsCatalogo()})});}const h=await respond(q.url(),q.method(),q.postData());return h?route.fulfill({status:h[0],contentType:'application/json',body:JSON.stringify(h[1])}):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});});
 for(const r of routes){
  const page=await ctx.newPage();const tag=`${r}@${W}/${theme}`;
  try{await page.goto(base+r,{waitUntil:'networkidle',timeout:120000});}catch(e){check(false,`${tag}: no cargó (${String(e.message).slice(0,60)})`);await page.close();continue;}
  await page.waitForTimeout(500);
  // 1) Desborde horizontal: del caparazón (falla) y del contenido (aviso).
  const d=await page.evaluate(()=>{const de=document.documentElement,wc=document.querySelector('.workspace-content');const sobra=[...document.querySelectorAll('.workspace-header,.workspace-bottom-nav')].filter(e=>{const b=e.getBoundingClientRect();return b.left<-0.5||b.right>innerWidth+0.5;}).map(e=>e.className);return {doc:de.scrollWidth-innerWidth,cont:wc?wc.scrollWidth-wc.clientWidth:0,sobra};});
  check(d.sobra.length===0,`${tag}: el caparazón se sale del viewport (${d.sobra.join(',')})`);
  if(d.doc>1)aviso(`${tag}: el CONTENIDO desborda el documento ${d.doc}px (carril de contenido)`);
  // 2) Barra inferior: 5 destinos visibles, sin superposición, etiquetas completas, ≥44 px.
  const b=await page.evaluate(()=>{const nav=document.querySelector('.workspace-bottom-nav');if(!nav)return null;const nb=nav.getBoundingClientRect();const items=[...nav.querySelectorAll('a')].map(a=>{const r=a.getBoundingClientRect(),l=a.querySelector('.bn-etiqueta');return {t:l?.textContent,x:r.left,r:r.right,w:r.width,h:r.height,corta:l?l.scrollWidth>l.clientWidth+0.5:false,lw:l?.getBoundingClientRect().width,actual:a.getAttribute('aria-current')};});const sob=items.some((a,i)=>i&&a.x<items[i-1].r-0.5);return {top:nb.top,bottom:nb.bottom,left:nb.left,right:nb.right,items,sob,vh:innerHeight,vw:innerWidth};});
  check(!!b&&b.items.length===5,`${tag}: la barra inferior debe tener 5 destinos`);
  if(b){check(!b.sob,`${tag}: destinos de la barra inferior superpuestos`);check(b.items.every(i=>i.h>=43.5&&i.w>=43.5),`${tag}: destino de la barra <44 px (${b.items.map(i=>Math.round(i.w)+'×'+Math.round(i.h))})`);check(b.items.every(i=>!i.corta),`${tag}: etiqueta truncada (${b.items.filter(i=>i.corta).map(i=>i.t)})`);check(b.left>=0&&b.right<=b.vw&&b.bottom<=b.vh,`${tag}: barra fuera de pantalla`);
   const esperado={'/overview':'Inicio','/cfo':'Dinero','/gaps':'Dinero','/refunds':'Dinero','/problems':'Clientes','/map':'Clientes','/recommendations':'Acciones','/interventions':'Acciones','/preguntale':'Preguntar','/confianza':null,'/settings/team':null}[r];
   if(esperado!==undefined){const act=b.items.filter(i=>i.actual==='page').map(i=>i.t);check(esperado===null?act.length===0:(act.length===1&&act[0]===esperado),`${tag}: destino activo ${JSON.stringify(act)} ≠ ${esperado}`);}
  }
  // 3) Identidad: logo Rovaq visible en la barra (a la izquierda, enlace a Inicio), sin texto de cliente ni avatar circular con letra suelta; selector de empresa alcanzable.
  const e=await page.evaluate(()=>{const h=document.querySelector('.workspace-header');if(!h)return null;const hb=h.getBoundingClientRect(),vis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';};
   const svg=[...h.querySelectorAll('svg[aria-label=Rovaq]')].find(vis),lr=svg?.getBoundingClientRect(),enlace=svg?.closest('a');
   const c=h.querySelector('[data-testid=selector-empresa]'),cr=c?.getBoundingClientRect();
   const org=[...document.querySelectorAll('.header-empresa [data-testid=selector-empresa]')].length?(c.getAttribute('aria-label')||''):'';
   const txtBarra=(h.innerText||'').replace(/\s+/g,' ').trim();
   const circulares=[...document.querySelectorAll('.workspace-header *,dialog[open] *')].filter(x=>{if(!vis(x))return false;const r=x.getBoundingClientRect(),br=getComputedStyle(x).borderRadius;const t=(x.textContent||'').trim();return t.length>0&&t.length<=2&&!/^\d+\+?$/.test(t)&&r.width<=48&&r.width>=16&&Math.abs(r.width-r.height)<2&&parseFloat(br)>=r.width/2-0.5&&!x.closest('.sr-only');}).map(x=>x.className||x.tagName);
   const items=[...h.querySelectorAll('a[href],button')].filter(vis).map(x=>x.getBoundingClientRect());const solapes=items.some((r,i)=>items.some((q,j)=>j>i&&r.left<q.right-0.5&&q.left<r.right-0.5&&r.top<q.bottom-0.5&&q.top<r.bottom-0.5));
   return {logo:!!svg,logoX:lr?.left,logoW:lr?.width,logoH:lr?.height,enlace:enlace?.getAttribute('href'),hb:hb.bottom,chip:!!c,cx:cr?.left,cw:cr?.width,ch:cr?.height,ctop:cr?.top,cbottom:cr?.bottom,nombre:org,txtBarra,circulares,solapes};});
  check(!!e&&e.logo,`${tag}: el logo de Rovaq no es visible en el encabezado móvil`);
  if(e){check(e.logo&&e.logoX<40&&e.logoW>=100&&e.logoH<=44,`${tag}: logo mal ubicado/dimensionado (x ${Math.round(e.logoX)}, ${Math.round(e.logoW)}×${Math.round(e.logoH)})`);check(e.enlace==='/overview'||/^\/overview(\?|$)/.test(e.enlace??''),`${tag}: el logo no enlaza a Inicio (${e.enlace})`);
   check(!/demostraci|CLIENTEX|empresa de demo/i.test(e.txtBarra),`${tag}: texto de cliente en la barra («${e.txtBarra}»)`);check(e.circulares.length===0,`${tag}: avatar circular con letra suelta (${e.circulares.join(',')})`);check(!e.solapes,`${tag}: controles del encabezado solapados`);
   check(e.chip&&e.ctop>=0&&e.cbottom<=e.hb&&e.cw>=43.5&&e.ch>=43.5,`${tag}: el selector de empresa no está alcanzable en la barra (${Math.round(e.cw)}×${Math.round(e.ch)})`);check(/Empresa: .*demostraci.*Cambiar de empresa/i.test(e.nombre),`${tag}: el selector no nombra la empresa para lectores de pantalla (${e.nombre})`);}
  // 4) Caparazón: controles ≥44, texto ≥12, sin title como único nombre.
  const m=await page.evaluate(medirCaparazon,['.workspace-header','.workspace-bottom-nav']);
  check(m.chicos.length===0,`${tag}: controles del caparazón <44 px: ${m.chicos.slice(0,4).join(' | ')}`);
  check(m.fuentes.length===0,`${tag}: texto <12 px en el caparazón: ${m.fuentes.slice(0,3).join(' | ')}`);
  check(m.soloTitle.length===0,`${tag}: control con title como único nombre: ${m.soloTitle[0]}`);
  // 5) Sin botones «Actualizar» ni «Actualizando».
  check(!(await page.getByRole('button',{name:/^actualizar/i}).count()),`${tag}: hay un botón «Actualizar»`);
  // 6) Destello de tema: el tema guardado ya está aplicado desde el primer cambio y nunca vuelve a claro/vacío.
  const temas=await page.evaluate(()=>window.__temas);
  if(theme==='dark')check(temas.length>0&&temas.every(t=>t==='dark'),`${tag}: destello de tema ${JSON.stringify(temas)}`);
  await page.screenshot({path:path.join(out,`${slug(r)}-${W}-${theme}.png`)});
  // 7) Chat: compositor fijo sobre la barra y sobre el teclado simulado.
  if(r==='/preguntale'){
   const ta=page.locator('.agente-composer textarea');
   const fs=await ta.evaluate(t=>parseFloat(getComputedStyle(t).fontSize));check(fs>=16,`${tag}: textarea de ${fs}px (<16 provoca zoom en iOS)`);
   const geo=async()=>page.evaluate(()=>{const c=document.querySelector('.agente-composer').getBoundingClientRect(),n=document.querySelector('.workspace-bottom-nav'),nb=n&&getComputedStyle(n).display!=='none'?n.getBoundingClientRect():null,h=document.querySelector('.workspace-header').getBoundingClientRect();return {cTop:c.top,cBottom:c.bottom,nTop:nb?.top??null,hBottom:h.bottom,vh:innerHeight,teclado:document.documentElement.dataset.teclado??null};});
   const g0=await geo();check(g0.nTop===null||g0.cBottom<=g0.nTop+0.5,`${tag}: el compositor se superpone con la barra inferior (${Math.round(g0.cBottom)} > ${Math.round(g0.nTop)})`);check(g0.cBottom<=g0.vh&&g0.cTop>g0.hBottom,`${tag}: compositor fuera de la pantalla`);
   await ta.tap();await ta.fill('¿Cuánto se devolvió este mes?');
   await page.setViewportSize({width:W,height:H-336});await page.waitForTimeout(500); // teclado simulado de 336 px
   const g1=await geo();check(g1.teclado==='abierto',`${tag}: no detecta el teclado (${g1.teclado})`);check(g1.cBottom<=H-336+0.5&&g1.cTop>=g1.hBottom-0.5,`${tag}: el compositor queda tapado por el teclado (fondo ${Math.round(g1.cBottom)} / ${H-336}; tope ${Math.round(g1.cTop)} vs cabecera ${Math.round(g1.hBottom)})`);check(g1.nTop===null,`${tag}: la barra inferior sigue visible con el teclado abierto`);
   await page.screenshot({path:path.join(out,`preguntale-teclado-${W}-${theme}.png`)});
   await page.setViewportSize({width:W,height:H});await page.waitForTimeout(300);
  }
  // 8) Hojas (solo en la primera ruta de cada tamaño/tema, para no repetir): «Más» y empresa.
  if(r===routes[0]){
   await page.getByRole('button',{name:'Abrir menú'}).tap();await page.waitForTimeout(350);
   const s=await page.evaluate(()=>{const dlg=document.querySelector('dialog.hoja-mas[open]');if(!dlg)return null;const hit44=e=>{const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;return [[-21.5,-21.5],[21.5,-21.5],[-21.5,21.5],[21.5,21.5]].every(([dx,dy])=>{const t=document.elementFromPoint(cx+dx,cy+dy);return !!t&&(t===e||e.contains(t));});};const p=dlg.querySelector('.drawer-panel').getBoundingClientRect(),xe=dlg.querySelector('.overlay-close'),x=xe?.getBoundingClientRect(),g=!!dlg.querySelector('.sheet-grabber');const cels=[...dlg.querySelectorAll('.theme-selector label')].map(l=>{const lr=l.getBoundingClientRect(),sv=l.querySelector('svg').getBoundingClientRect(),tx=l.querySelector('.tema-texto')?.getBoundingClientRect();const izq=Math.min(sv.left,tx?tx.left:sv.left),der=Math.max(sv.right,tx?tx.right:sv.right);return {w:lr.width,h:lr.height,dx:(izq+der)/2-(lr.left+lr.width/2),dy:(sv.top+sv.height/2)-(lr.top+lr.height/2),sw:sv.width,sh:sv.height,txt:l.textContent.trim(),marcado:l.querySelector('input').checked};});const niveles=document.querySelectorAll('dialog[open]').length;return {top:p.top,bottom:p.bottom,h:p.height,vh:innerHeight,x:x&&{w:x.width,h:x.height,t:x.top,r:x.right,hit:hit44(xe)},g,cels,niveles,opciones:dlg.querySelectorAll('.mobile-sidebar nav a').length};});
   check(!!s,`${tag}: no abrió la hoja «Más»`);
   if(s){check(s.h<=s.vh*0.9+1,`${tag}: la hoja «Más» mide ${Math.round(s.h)} > 90 dvh (${Math.round(s.vh*0.9)})`);check(s.g,`${tag}: la hoja «Más» no tiene grabber`);check(!!s.x&&(s.x.hit||(s.x.w>=43.5&&s.x.h>=43.5))&&s.x.t>=s.top&&s.x.r<=W,`${tag}: botón cerrar de la hoja ausente o <44 px (${JSON.stringify(s.x)})`);check(s.niveles===1,`${tag}: más de un nivel de overlay (${s.niveles})`);check(s.opciones>=3,`${tag}: la hoja «Más» no trae el menú completo (${s.opciones} enlaces)`);
    check(s.cels.length===3&&s.cels.every(c=>Math.abs(c.dx)<=1&&Math.abs(c.sw-16)<0.6&&Math.abs(c.sh-16)<0.6&&c.h>=43.5&&Math.abs(c.dy)<=1&&Math.abs(c.w-s.cels[0].w)<=1),`${tag}: selector de tema desigual ${JSON.stringify(s.cels.map(c=>[Math.round(c.dx*10)/10,Math.round(c.dy*10)/10,Math.round(c.w),Math.round(c.h)]))}`);check(s.cels.filter(c=>c.marcado).length===1,`${tag}: el selector de tema no marca exactamente una opción`);}
   check(await page.evaluate(()=>/Organización de demostración/.test(document.querySelector('dialog.hoja-mas[open] .sidebar-account')?.textContent??'')&&!!document.querySelector('dialog.hoja-mas[open] .sidebar-account .monograma')),`${tag}: «Más» no muestra el nombre de la empresa con su monograma`);
   const mm=await page.evaluate(medirCaparazon,['dialog.hoja-mas[open]']);
   check(mm.chicos.length===0,`${tag}: «Más»: controles <44 px: ${mm.chicos.slice(0,4).join(' | ')}`);check(mm.fuentes.length===0,`${tag}: «Más»: texto <12 px: ${mm.fuentes.slice(0,3).join(' | ')}`);check(mm.soloTitle.length===0,`${tag}: «Más»: title como único nombre`);
   await page.screenshot({path:path.join(out,`hoja-mas-${W}-${theme}.png`)});
   // Cambiar el tema desde la hoja se aplica al instante y no deja destello.
   await page.locator('dialog.hoja-mas .theme-selector label',{hasText:theme==='dark'?'Claro':'Oscuro'}).tap();await page.waitForTimeout(250);
   check((await page.evaluate(()=>document.documentElement.dataset.theme))===(theme==='dark'?'light':'dark'),`${tag}: el selector de tema no cambia el tema`);
   await page.locator('dialog.hoja-mas .theme-selector label',{hasText:theme==='dark'?'Oscuro':'Claro'}).tap();await page.waitForTimeout(250);
   await page.locator('dialog.hoja-mas .overlay-close').tap();await page.waitForTimeout(300);
   check(await page.evaluate(()=>!document.querySelector('dialog[open]')),`${tag}: la hoja «Más» no se cierra con la X`);
   // Hoja de empresa
   await page.locator('[data-testid=selector-empresa]').tap();await page.waitForTimeout(350);
   const o=await page.evaluate(()=>{const dlg=document.querySelector('dialog.hoja-empresa[open]');if(!dlg)return null;const hit44=e=>{const r=e.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;return [[-21.5,-21.5],[21.5,-21.5],[-21.5,21.5],[21.5,21.5]].every(([dx,dy])=>{const t=document.elementFromPoint(cx+dx,cy+dy);return !!t&&(t===e||e.contains(t));});};const p=dlg.querySelector('.drawer-panel').getBoundingClientRect();const filas=[...dlg.querySelectorAll('.org-fila')].map(f=>{const r=f.getBoundingClientRect();return {t:f.textContent.trim(),h:r.height,w:r.width,cur:f.getAttribute('aria-current'),tipo:f.type,nombre:f.name,valor:f.value};});const xe=dlg.querySelector('.overlay-close'),x=xe.getBoundingClientRect();return {h:p.height,vh:innerHeight,filas,x:[x.width,x.height],xhit:hit44(xe),accion:dlg.querySelector('form').getAttribute('action'),metodo:dlg.querySelector('form').method};});
   check(!!o,`${tag}: el selector de empresa no abre la hoja`);
   if(o){check(o.filas.length===2,`${tag}: la hoja de empresa debe listar 2 organizaciones (${o.filas.length})`);check(o.filas.every(f=>f.h>=43.5),`${tag}: filas de empresa <44 px`);check(o.filas.filter(f=>f.cur==='true').length===1,`${tag}: falta marcar la empresa actual`);check(o.filas.some(f=>f.tipo==='submit'&&f.nombre==='tenant_id'&&f.valor),`${tag}: cambiar de empresa debe enviar tenant_id a /auth/organization`);check(o.accion==='/auth/organization'&&o.metodo==='post',`${tag}: acción ${o.accion} ${o.metodo}`);check((o.xhit||(o.x[0]>=43.5&&o.x[1]>=43.5)),`${tag}: X de la hoja de empresa <44 px`);check(o.h<=o.vh*0.9+1,`${tag}: hoja de empresa >90 dvh`);}
   await page.screenshot({path:path.join(out,`hoja-empresa-${W}-${theme}.png`)});
   await page.keyboard.press('Escape');await page.waitForTimeout(250);
  }
  await page.close();
 }
 await ctx.close();
}
await browser.close();
// PWA: manifest instalable con iconos maskable, viewport-fit=cover y theme-color.
{const m=JSON.parse(fs.readFileSync(new URL('../../public/site.webmanifest',import.meta.url),'utf8'));
 check(m.display==='standalone'&&m.icons.some(i=>/maskable/.test(i.purpose)&&i.sizes==='512x512')&&m.icons.some(i=>i.sizes==='192x192'&&i.purpose==='any'),'manifest: falta display standalone o iconos any/maskable 192 y 512');
 for(const i of m.icons)check(fs.existsSync(new URL('../../public'+i.src,import.meta.url)),'manifest: falta el archivo '+i.src);
 const html=await (await fetch(base+'/login')).text();check(/viewport-fit=cover/.test(html),'viewport sin viewport-fit=cover');check(/name="theme-color"/.test(html),'sin meta theme-color');check(/rel="manifest"/.test(html),'sin enlace al manifest');}
console.log(`\n${comprobaciones} comprobaciones, ${fallas.length} fallas del caparazón, ${avisos.length} avisos de contenido`);
fs.writeFileSync(path.join(out,'_resultado.json'),JSON.stringify({comprobaciones,fallas,avisos},null,1));
process.exit(fallas.length?1:0);
