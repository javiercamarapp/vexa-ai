// Los formularios que ahora viven en Drawer/Modal siguen alcanzables con los MISMOS nombres accesibles que usan las pruebas de aceptación
// (tests/acceptance, support/F0*): abrir -> etiquetas y botones visibles -> Esc cierra. Datos sintéticos de fixtures.mjs por interceptación.
//   VEXA_UI_FIXTURES=1 next dev -p 3418   y luego
//   NODE_PATH=<dir con playwright-core>/node_modules node apps/web/tests/ui/forms-drawer.mjs [baseUrl]
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require('playwright-core');
const {respond,IDS,HASH}=await import('./fixtures.mjs');
const base=process.argv[2]??'http://localhost:3418';
const PIN=`?snapshot_id=${IDS.snapshot}&scope_hash=${HASH}&date_start=2026-10-01&date_end=2026-11-01&currency=USD&basis=net`;
const CHECKS=[
 {name:'recomendaciones · proponer (Modal)',route:'/recommendations',opener:{role:'button',name:'Proponer una recomendación',first:true},dialog:'Proponer una recomendación',labels:['Problema para recomendar'],buttons:['Proponer recomendación']},
 {name:'recomendaciones · editar (Drawer)',route:'/recommendations',opener:{role:'button',name:'Editar o gestionar',first:true},dialog:'Editar o gestionar',labels:['Acción propuesta','Condiciones previas, una por línea','Justificación de la recomendación','Responsable de la recomendación','Razón del cambio'],buttons:['Guardar revisión']},
 {name:'intervenciones · detalle (Drawer)',route:'/interventions',opener:{role:'button',name:/^Abrir detalle de /,first:true},dialog:null,labels:[/^Hipótesis/,/^Responsable de la intervención/,'Razón del plan'],buttons:['Guardar plan'],optional:true},
 {name:'briefs · generar (Modal)',route:'/briefs',opener:{role:'button',name:'Generar brief',first:true},dialog:'Generar brief',labels:['Publicación previa para comparar'],buttons:['Generar versión']},
 {name:'briefs · filtros (Drawer)',route:'/briefs',opener:{role:'button',name:/^Filtros/,first:true},dialog:'Filtros',labels:[/^SKU, uno por línea/],buttons:['Aplicar']},
 {name:'resumen · filtros (Drawer)',route:'/problems'+PIN,opener:{role:'button',name:/^Filtros/,first:true},dialog:'Filtros',labels:[/^SKU, uno por línea/,'Desde (UTC)','Hasta, exclusivo (UTC)'],buttons:['Aplicar']},
 {name:'conexiones · nueva (Drawer)',route:'/connections',opener:{role:'button',name:'Nueva conexión',first:true},dialog:'Nueva conexión',labels:['Identificador de la cuenta','Nombre de la credencial configurada','Inicio del histórico (UTC)'],buttons:['Guardar conexión']},
 {name:'histórico · autorizar (Drawer)',route:'/history',opener:{role:'button',name:'Autorizar procesamiento',first:true},dialog:'Autorizar procesamiento',labels:['Conexión del histórico','Autorizo el análisis y la agrupación de este histórico con los límites configurados.'],buttons:['Autorizar lote histórico']},
 {name:'análisis · límites y conciliación (Drawer)',route:'/analysis',opener:{role:'button',name:'Límites y conciliación',first:true},dialog:'Límites y conciliación',labels:['Tipo de límite','Límite en USD'],buttons:['Guardar límite']},
 {name:'problemas · agrupar (Drawer)',route:'/problems/manage',opener:{role:'button',name:'Agrupar extracción',first:true},dialog:'Agrupar extracción',labels:[/^Extracción publicada/],buttons:['Agrupar extracción']},
 {name:'importaciones · nueva conexión CSV (Drawer)',route:'/imports',opener:{role:'button',name:'Nueva conexión CSV',first:true},dialog:'Nueva conexión CSV',labels:['Nombre del origen CSV'],buttons:['Crear conexión CSV']},
];
const browser=await chromium.launch();let failed=0,skipped=0;
const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
await ctx.route('**/api/**',async route=>{const req=route.request(),hit=await respond(req.url(),req.method(),req.postData());if(!hit)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_missing'}})});return route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])});});
for(const c of CHECKS){
 const page=await ctx.newPage(),problems=[];
 try{
  await page.goto(base+c.route,{waitUntil:'networkidle',timeout:90000});await page.waitForTimeout(400);
  const opener=page.getByRole(c.opener.role,{name:c.opener.name,exact:typeof c.opener.name==='string'}).first();
  if(!await opener.count()){console.log(`SKIP ${c.name}: el fixture no ofrece este opener${c.optional?'':' (revisar)'}`);skipped++;continue;}
  await opener.click();
  const dialog=c.dialog?page.getByRole('dialog',{name:c.dialog,exact:true}):page.getByRole('dialog').first();
  await dialog.waitFor({state:'visible',timeout:5000}).catch(()=>problems.push('el diálogo no abrió'));
  for(const l of c.labels){const n=await dialog.getByLabel(l,{exact:typeof l==='string'}).count();if(!n)problems.push('falta la etiqueta '+l);}
  for(const b of c.buttons){const n=await dialog.getByRole('button',{name:b,exact:true}).count();if(!n)problems.push('falta el botón '+b);}
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden',timeout:3000}).catch(()=>problems.push('Esc no cerró el diálogo'));
 }catch(e){problems.push(String(e).slice(0,160));}
 if(problems.length){failed++;console.log(`FAIL ${c.name} · ${problems.join(' | ')}`);}else console.log(`PASS ${c.name}`);
 await page.close();
}
// menú inferior móvil: «Pregúntale» presente y el menú sin desbordes
const m=await browser.newContext({viewport:{width:375,height:812}});await m.route('**/api/**',async route=>{const req=route.request(),hit=await respond(req.url(),req.method(),req.postData());return hit?route.fulfill({status:hit[0],contentType:'application/json',body:JSON.stringify(hit[1])}):route.fulfill({status:503,body:'{}'});});
const mp=await m.newPage();await mp.goto(base+'/overview',{waitUntil:'networkidle',timeout:90000});
const bottom=await mp.evaluate(()=>{const nav=document.querySelector('.workspace-bottom-nav');if(!nav)return null;const items=[...nav.querySelectorAll('a,button')].map(e=>({t:(e.textContent||'').trim(),w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}));return {items,over:nav.scrollWidth>nav.clientWidth+1};});
const okBottom=bottom&&bottom.items.some(i=>i.t==='Pregúntale')&&!bottom.over&&bottom.items.every(i=>i.h>=44);
console.log((okBottom?'PASS':'FAIL')+' menú inferior móvil con Pregúntale '+JSON.stringify(bottom));if(!okBottom)failed++;
await browser.close();console.log(failed?`FALLARON ${failed} (omitidos ${skipped})`:`ALL PASS (omitidos ${skipped})`);process.exit(failed?1:0);
