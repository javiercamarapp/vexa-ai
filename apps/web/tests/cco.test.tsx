// Pestaña CCO: permisos por rol, menú, título de pestaña, paridad ES/EN de textos, sello, estados vacíos honestos y marcado renderizado de las seis tarjetas.
// Sin DOM: el marcado se prueba con renderToStaticMarkup sobre datos sintéticos (nada real).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {CCO_ROLES,MONEY_SCREEN_ROLES,DATABASE_ACTION_ROLES} from '@vexa/platform/capabilities';
import {menuVisible,itemActivo,tituloDePantalla,MENU} from '../src/lib/workspace/menu.mjs';
import {PANTALLAS,clavesDePantalla} from '../src/lib/onboarding/pantallas.mjs';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {traducir,traductor} from '../src/lib/i18n';
import {IdiomaProvider} from '../src/components/i18n/proveedor';
import {TarjetaA,TarjetaB,TarjetaC,TarjetaD,TarjetaE,TarjetaF} from '../src/components/cco/cco-tarjetas';
import {mayor,mesTxt,selloCco,tonoDeEstado} from '../src/components/cco/cco-modelo.mjs';
import {armarCco,FALTAN,FALTAN_ES,SUBCANALES,LATENCIAS,HOJAS,faltanTexto} from '../../../packages/workspace-service/cco.mjs';
import {RUTAS_PUBLICAS,PREFIJOS_PRIVADOS} from '../src/lib/site.mjs';

const leer=(rel:string)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const ES=es as Record<string,string>,EN=en as Record<string,string>;
const claves=Object.keys(ES).filter(k=>k.startsWith('cco.')||k==='nav.item.cco'||k==='meta.titulo.cco'||k.startsWith('onb.pant.cco.'));
const vars=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');

// ---- permisos por rol ----
test('CCO es una pantalla de dinero: solo owner y analyst, y la capacidad es la fuente única del menú, la página y la API',()=>{
  assert.deepEqual([...CCO_ROLES],['owner','analyst']);assert.deepEqual([...CCO_ROLES],[...MONEY_SCREEN_ROLES]);
  assert.ok(CCO_ROLES.every(r=>DATABASE_ACTION_ROLES.read.includes(r)),'quien ve CCO también puede leer');
  for(const role of ['owner','analyst'] as const)assert.ok(menuVisible({role}).flatMap(e=>e.tipo==='grupo'?e.items:[e]).some(i=>i.href==='/cco'),role);
  for(const role of ['operator','viewer',undefined] as const)assert.ok(!menuVisible({role}).flatMap(e=>e.tipo==='grupo'?e.items:[e]).some(i=>i.href==='/cco'),String(role));
  assert.ok(!menuVisible({role:'viewer',interno:true}).flatMap(e=>e.tipo==='grupo'?e.items:[e]).some(i=>i.href==='/cco'),'el acceso de plataforma no abre el dinero del cliente');
});
test('CCO vive en Clientes y problemas, junto a Puntos de dolor, con su título',()=>{
  const g=MENU.find(e=>e.tipo==='grupo'&&e.clave==='clientes') as unknown as {items:{href:string}[]}|undefined;assert.deepEqual(g?.items.map(i=>i.href),['/problems','/pain-points','/cco']);
  assert.equal(itemActivo('/cco')?.grupo,'clientes');assert.equal(tituloDePantalla('/cco'),'CCO');
});
test('la página y la API comprueban el rol en el servidor con la misma capacidad, y la API es solo lectura sin filtros',()=>{
  const pagina=leer('src/app/(app)/(workspace)/cco/page.tsx'),api=leer('src/lib/cco/server.ts'),ruta=leer('src/app/api/cco/route.ts');
  assert.match(pagina,/CCO_ROLES/);assert.match(pagina,/metaTitulo\('meta\.titulo\.cco'\)/);
  assert.match(api,/CCO_ROLES/);assert.match(api,/role_insufficient/);assert.match(api,/unsupported_filter/);assert.match(api,/PRIVATE_HEADERS/);
  assert.match(ruta,/export const GET=/);assert.doesNotMatch(ruta,/export const (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(api,/\.(insert|update|delete)\(|INSERT INTO|UPDATE |DELETE FROM/i);
});
test('/cco es una ruta privada (noindex) y tiene paso propio en el recorrido guiado sin romper el catálogo',()=>{
  assert.ok(PREFIJOS_PRIVADOS.includes('/cco'));assert.ok(!RUTAS_PUBLICAS.includes('/cco'));
  assert.ok(PANTALLAS['/cco']);for(const k of clavesDePantalla('/cco')){assert.ok(ES[k]&&EN[k],k);}
});

// ---- i18n ----
test('i18n: cada clave de CCO existe en español e inglés con las mismas {variables}; sin paréntesis ni emojis; el inglés sin acentos',()=>{
  assert.ok(claves.length>150,'se esperaban todas las claves, hay '+claves.length);
  for(const k of claves){
    assert.ok(typeof ES[k]==='string'&&ES[k].length>0&&typeof EN[k]==='string'&&EN[k].length>0,'falta '+k);
    assert.equal(vars(ES[k]),vars(EN[k]),'variables distintas en '+k);
    for(const [idioma,v] of [['es',ES[k]],['en',EN[k]]])assert.doesNotMatch(v,/[()]|\p{Extended_Pictographic}/u,`${idioma} ${k}: paréntesis o emoji`);
    assert.doesNotMatch(EN[k],/[áéíóúñ¿¡]/i,'acento en inglés '+k);
  }
  assert.notEqual(ES['cco.desc'],EN['cco.desc']);
});
test('i18n: las claves que arma el código por familia existen (estado, tarjetas, subcanal, latencia, hoja, falta, salvedad, cobertura)',()=>{
  const fuente=leer('src/components/cco/cco-tarjetas.tsx');
  for(const m of fuente.matchAll(/t\('(cco\.[\w.]+)'/g))assert.ok(ES[m[1]]&&EN[m[1]],m[1]);
  for(const id of ['A','B','C','D','E','F'])for(const s of ['titulo','pregunta','hoy'])assert.ok(ES[`cco.${id}.${s}`]&&EN[`cco.${id}.${s}`],`${id}.${s}`);
  for(const e of ['listo','salvedad','falta'])for(const s of ['',  'Tip'])assert.ok(ES[`cco.estado.${e}${s}`]&&EN[`cco.estado.${e}${s}`]);
  for(const c of SUBCANALES)assert.ok(ES[`cco.sub.${c}`]&&EN[`cco.sub.${c}`],c);
  for(const c of LATENCIAS)assert.ok(ES[`cco.lat.${c}`]&&EN[`cco.lat.${c}`],c);
  for(const c of HOJAS)assert.ok(ES[`cco.hoja.${c}`]&&EN[`cco.hoja.${c}`],c);
  for(const [id,lista] of Object.entries(FALTAN))for(const x of lista){assert.ok(ES[`cco.falta.${x.clave}`]&&EN[`cco.falta.${x.clave}`],id+x.clave);assert.ok(['responsable_a','responsable_b'].includes(x.quien));assert.ok(ES[`cco.pedirA.${x.quien}`]);}
  const motor=leer('../../packages/workspace-service/cco.mjs');
  for(const m of motor.matchAll(/salvedades: \[([^\]]*)\]/g))for(const s of m[1].matchAll(/'(\w+)'/g))assert.ok(ES[`cco.salv.${s[1]}`]&&EN[`cco.salv.${s[1]}`],s[1]);
  for(const m of motor.matchAll(/clave: '(\w+)', conocido/g))assert.ok(ES[`cco.cob.${m[1]}`]&&EN[`cco.cob.${m[1]}`],m[1]);
});
test('los textos de «lo que falta» del agente (español) son idénticos a los de la interfaz',()=>{
  for(const [k,v] of Object.entries(FALTAN_ES))assert.equal(v,ES[`cco.falta.${k}`],k);
  assert.equal(Object.keys(FALTAN_ES).sort().join(),[...new Set(Object.values(FALTAN).flat().map(x=>x.clave))].sort().join(),'ningún dato sobra ni falta');
  assert.ok(faltanTexto('F').every(x=>/Pedir a (Responsable A|Responsable B)\.$/.test(x)));
});
test('título de pestaña: meta.titulo.cco existe en ambos idiomas y se resuelve con el idioma activo',()=>{
  assert.equal(traducir('es','meta.titulo.cco' as never),'CCO');assert.equal(traducir('en','meta.titulo.cco' as never),'CCO');
  assert.equal(traductor('en')('nav.item.cco' as never),'CCO');
});

// ---- modelo puro ----
test('formato y sello: un desconocido no se vuelve cero; el sello dice lo que no sabe',()=>{
  assert.equal(mayor(null,2),null);assert.equal(mayor(undefined,2),null);assert.equal(mayor('12345',2),123.45);
  assert.equal(mesTxt('2026-09-01','es-MX'),'sep 2026');assert.equal(mesTxt(null,'es-MX'),null);assert.equal(mesTxt('basura','en-US'),null);
  const tr=traductor('es');const s=selloCco(tr,'es-MX',{clase:'inferred',fuente:'libro',corte:'2026-10-02',consultado:'2026-10-28T12:00:00Z'});
  assert.equal(s.claseTxt,'Inferido');assert.equal(s.fuente,'Libro económico');assert.match(s.hasta,/^hasta 2 oct 2026$/);assert.match(s.texto,/Inferido · Libro económico · hasta 2 oct 2026 · consultado/);
  const sin=selloCco(tr,'es-MX',{clase:'observed',fuente:'tracker',corte:null,consultado:null});assert.equal(sin.hasta,'sin fecha de corte');
  assert.equal(selloCco(tr,'es-MX',{clase:'raro',fuente:null,corte:null}).claseTxt,'Sin dato');
  assert.equal(tonoDeEstado('listo'),'ok');assert.equal(tonoDeEstado('salvedad'),'warn');assert.equal(tonoDeEstado('falta'),'bad');
});

// ---- marcado renderizado ----
const ok=(rows:unknown[])=>({rows});const cel=(d1:string|null,d2:string|null,n:number,es_otros=false)=>({d1,d2,n,es_otros});
const raw=()=>({
  ventanas:ok([{channel:'amazon',refunds_available:true,orders_from:'2025-10-01',orders_to:'2026-10-02',refunds_from:'2025-10-01',refunds_to:'2026-10-02',month_from:'2025-10-01',month_to:'2026-09-01',months:12,complete:false},
    {channel:'bestbuy',refunds_available:false,orders_from:'2026-02-14',orders_to:'2026-10-02',refunds_from:null,refunds_to:null,month_from:'2026-03-01',month_to:'2026-09-01',months:7,complete:false}]),
  skuCanal:ok([{channel:'amazon',sku_base:'SYN-A',currency:'USD',exponent:2,order_lines:100,order_gross_minor:'250000',refund_n:10,refund_n_unknown_amount:10,refund_amount_minor:null,refunds_per_100_lines:10},
    {channel:'amazon',sku_base:'',currency:'USD',exponent:2,order_lines:5,order_gross_minor:'1000',refund_n:0,refund_n_unknown_amount:0,refund_amount_minor:'0',refunds_per_100_lines:0},
    {channel:'bestbuy',sku_base:'',currency:'USD',exponent:2,order_lines:30,order_gross_minor:'90000',refund_n:null,refund_n_unknown_amount:null,refund_amount_minor:null,refunds_per_100_lines:null}]),
  sinVenta:ok([{sku_base:'SYN-OLD',first_sale_month:'2025-10-01',last_sale_month:'2026-05-01',months_without_sale:4,lines_last_3m:0,lines_last_6m:0,lines_last_9m:12,channels:['amazon'],skus_with_sales:40,reference_month:'2026-09-01',data_through:'2026-10-02'}]),
  defecto:ok([]),hoja:ok([]),subcanal:ok([cel('amazon_cumplido_por_clientex',null,15)]),
  bodLat:ok([cel('BODEGAB-USTX','2_dias',9),cel(null,null,6,true)]),bodMot:ok([]),
  cob:ok([{rows_total:40,with_retailer:30,with_sku:30,with_warehouse:20,with_latency:9,with_address:10,sheets:3,cutoff:'2026-10-05T00:00:00Z'}]),
});
const geo=()=>({status:'ok',generatedAt:'2026-10-28T12:00:00.000Z',minimoPorCelda:5,cobertura:{filas:100,conDireccion:50,interpretables:45,pctInterpretablesDeDireccion:90,pais:{US:45,MX:0}},
  estados:[{clave:'US-TX',nombre:'Texas',pais:'US',n:12,tipos:{items:[{etiqueta:'Reembolsos',n:7}]},retailers:{items:[]}}],ocultos:{estados:2,casos:4,minimo:5}});
const render=(idioma:'es'|'en',nodo:React.ReactElement)=>renderToStaticMarkup(<IdiomaProvider idioma={idioma}>{nodo}</IdiomaProvider>);
const vista=()=>armarCco(raw(),geo(),{now:new Date('2026-10-28T12:00:00Z')});

test('las seis tarjetas llevan su insignia: A a D con salvedad, E y F falta dato; ninguna Lista porque a ninguna le sobran datos',()=>{
  const v=vista();assert.deepEqual(Object.values(v.cards).map(c=>c.estado),['salvedad','salvedad','salvedad','salvedad','falta','falta']);
  assert.deepEqual(v.resumen,{listo:0,salvedad:4,falta:2});
});
test('marcado en español: insignias, sello, ventana, «Sin dato» donde no se sabe y a quién pedir lo que falta',()=>{
  const v=vista();const c=v.cards,m=v.generatedAt;
  const html=[render('es',<TarjetaA card={c.A} minimo={5} consultado={m}/>),render('es',<TarjetaB card={c.B} minimo={5} consultado={m}/>),render('es',<TarjetaC card={c.C} minimo={5} consultado={m}/>),render('es',<TarjetaD card={c.D} minimo={5} consultado={m}/>),render('es',<TarjetaE card={c.E} minimo={5} consultado={m}/>),render('es',<TarjetaF card={c.F} minimo={5} consultado={m}/>)];
  const todo=html.join('\n');
  for(const x of ['Con salvedad','Falta dato','Observado','Inferido','Libro económico','Tracker de Excel','Pedir a Responsable A','Pedir a Responsable B','Sin dato','ventana común','Menos de 5'])assert.ok(todo.includes(x),'falta «'+x+'»');
  assert.doesNotMatch(todo,/NaN|undefined|\[object|cco\.[a-zA-Z]+\.|>null</,'sin valores crudos ni claves sin traducir');
  assert.doesNotMatch(todo,/ style=/,'sin atributos style en las tarjetas');
  assert.ok(html[5].includes('Sin dato: no hay costo de envío'),'F siempre sin dato');assert.ok(!/<td[^>]*>\s*0\s*<\/td>/.test(html[0]),'ningún desconocido pintado como 0');
});
test('marcado en inglés: sin claves ni español colado',()=>{
  const v=vista();const todo=[render('en',<TarjetaA card={v.cards.A} minimo={5} consultado={v.generatedAt}/>),render('en',<TarjetaF card={v.cards.F} minimo={5} consultado={v.generatedAt}/>),render('en',<TarjetaE card={v.cards.E} minimo={5} consultado={v.generatedAt}/>)].join('\n');
  for(const x of ['With caveats','Missing data','Ask Responsable A','Ask Responsable B','No data','common window'])assert.ok(todo.includes(x),'falta «'+x+'»');
  assert.doesNotMatch(todo,/Con salvedad|Falta dato|Pedir a|Sin dato|cco\./);
});
test('estados vacíos honestos: sin datos o sin migración no hay cifras, y se dice',()=>{
  const vacio={ventanas:ok([]),skuCanal:ok([]),sinVenta:ok([]),defecto:ok([]),hoja:ok([]),subcanal:ok([]),bodLat:ok([]),bodMot:ok([]),cob:ok([])};
  const v=armarCco(vacio,{status:'empty'},{now:new Date()});assert.deepEqual(Object.values(v.cards).map(c=>c.estado),['falta','falta','falta','falta','falta','falta']);
  const sin=armarCco(Object.fromEntries(Object.keys(vacio).map(k=>[k,{error:'not_installed'}])) as never,null,{now:new Date()});assert.equal(sin.status,'not_installed');
  const caido=armarCco({...vacio,skuCanal:{error:'unavailable'},ventanas:{error:'unavailable'}} as never,{status:'unavailable'},{now:new Date()});assert.equal(caido.cards.A.estado,'falta');assert.equal(caido.cards.A.indisponible,'unavailable');
  const html=render('es',<TarjetaA card={caido.cards.A} minimo={5} consultado={caido.generatedAt}/>);assert.match(html,/No disponible ahora. No es cero/);
  const htmlSin=render('es',<TarjetaA card={sin.cards.A} minimo={5} consultado={sin.generatedAt}/>);assert.match(htmlSin,/Falta aplicar la migración/);assert.doesNotMatch(htmlSin,/<table/,'sin migración no hay tabla ni cifras');
});
test('diseño: los componentes CCO no usan atributos style ni colores fijos; el CSS usa solo tokens y radios del conjunto',()=>{
  for(const f of ['src/components/cco/cco-tarjetas.tsx','src/components/cco/cco-pantalla.tsx'])assert.doesNotMatch(leer(f),/\bstyle=/,f);
  const css=leer('src/components/cco/cco.css');assert.doesNotMatch(css,/#[0-9a-f]{3,8}\b/i,'sin colores fijos');
  for(const m of css.matchAll(/border-radius:\s*([^;}]+)/g))assert.match(m[1].trim(),/^(0|8px|12px|999px|50%|inherit|var\(--ui-radius(?:-sm)?\))$/);
  for(const m of css.matchAll(/font(?:-size)?:\s*(?:[a-z0-9 ]*?\s)?(\d+)px/g))assert.ok(+m[1]>=12,'texto menor de 12 px: '+m[0]);
});
