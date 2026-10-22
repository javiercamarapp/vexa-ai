import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATEGORIAS,CATEGORIA_RUIDO,TOTAL_CATEGORIAS,etiquetaCategoria,categoriaOriginal,esCategoriaRuido} from './categorias.mjs';
import {esRuido,separarRuido,separarRuidoCategorias} from './ruido.mjs';
import {GUIAS,IDS_GUIA,guia} from './guias.mjs';
import {insightsResumen,insightsProblemas,insightsProblemaSerie,variacion,dosMesesCompletos} from './insights.mjs';

test('la tabla cubre la taxonomía de 45 entradas, todas con etiqueta en español sin duplicados',()=>{
 assert.equal(TOTAL_CATEGORIAS,45);assert.equal(Object.keys(CATEGORIAS).length,45);
 assert.equal(new Set(Object.values(CATEGORIAS)).size,45);
 for(const [en,es] of Object.entries(CATEGORIAS)){assert.match(en,/^[A-Za-z-]+: /);assert.match(es,/^(Preventa|Pedido|Envío|Devolución|Garantía|Opinión|Suscripción|Distribuidores|Otros): /);}
});
test('ejemplos pedidos: Warranty: Troubleshooting y Order: Spare Parts',()=>{
 assert.equal(etiquetaCategoria('Warranty: Troubleshooting (before deciding)'),'Garantía: Diagnóstico previo a decidir');
 assert.equal(etiquetaCategoria('Order: Spare Parts'),'Pedido: Refacciones');
});
test('tolera mayúsculas y espacios; una categoría desconocida se muestra tal cual',()=>{
 assert.equal(etiquetaCategoria('  order:  spare parts '),'Pedido: Refacciones');
 assert.equal(etiquetaCategoria('Marketing: Algo nuevo'),'Marketing: Algo nuevo');
 assert.equal(etiquetaCategoria('Order: #10445'),'Order: #10445');
 assert.equal(etiquetaCategoria(''),'Sin categoría');assert.equal(etiquetaCategoria(null),'Sin categoría');
});
test('categoriaOriginal revierte la etiqueta y deja pasar lo desconocido',()=>{
 assert.equal(categoriaOriginal('Pedido: Refacciones'),'Order: Spare Parts');assert.equal(categoriaOriginal('Order: Spare Parts'),'Order: Spare Parts');assert.equal(categoriaOriginal('Otra cosa'),'Otra cosa');
});
test('el ruido se reconoce en inglés, en español y dentro de un título',()=>{
 assert.ok(esCategoriaRuido(CATEGORIA_RUIDO));assert.ok(esCategoriaRuido(CATEGORIAS[CATEGORIA_RUIDO]));assert.ok(!esCategoriaRuido('Order: Spare Parts'));
 assert.ok(esRuido('Other: Retailer notifications and system alerts'));assert.ok(esRuido('Alertas del sistema recurrentes'));assert.ok(esRuido('Notificaciones automáticas de minoristas'));
 assert.ok(!esRuido('Baterías que no cargan'));assert.ok(!esRuido(''));assert.ok(!esRuido(undefined));
});
const prob=(id,title,extra={})=>({id,title,summary:extra.summary??'',details:extra.details??[]});
test('separarRuido oculta por defecto, cuenta lo oculto y lo devuelve al incluir',()=>{
 const items=[prob('a','Cargador defectuoso'),prob('b','Otros: Notificaciones automáticas de minoristas y alertas del sistema'),prob('c','Entrega tardía',{details:[{label:'Categoría',value:'Other: Retailer notifications and system alerts'}]})];
 const campos=i=>[i.title,i.summary,...i.details.map(d=>d.value)];
 const a=separarRuido(items,campos);assert.deepEqual(a.visibles.map(x=>x.id),['a']);assert.equal(a.ocultosN,2);
 const b=separarRuido(items,campos,true);assert.equal(b.visibles.length,3);assert.equal(b.ocultosN,0);
 assert.equal(items.length,3,'no modifica la entrada (solo presentación)');
 assert.deepEqual(separarRuido(null,campos),{visibles:[],ocultos:[],ocultosN:0});
});
test('separarRuidoCategorias cuenta incidencias ocultas, no solo grupos',()=>{
 const filas=[{category:'Order: Spare Parts',count:10},{category:CATEGORIA_RUIDO,count:7},{category:'Shipping: Arrived Late',count:3}];
 const r=separarRuidoCategorias(filas);assert.equal(r.visibles.length,2);assert.equal(r.gruposOcultos,1);assert.equal(r.incidenciasOcultas,7);
 const t=separarRuidoCategorias(filas,true);assert.equal(t.visibles.length,3);assert.equal(t.incidenciasOcultas,0);
});
test('cada vista pedida tiene una línea guía breve y sin promesas de retorno ni «analizó todo»',()=>{
 for(const id of ['resumen','problemas','recomendaciones','explorador','intervenciones','brief','cliente','historial']){
  const g=guia(id);assert.ok(g,id);assert.ok(IDS_GUIA.includes(id));assert.ok(g.linea.length>20&&g.linea.length<=160,id+' '+g.linea.length);assert.ok(g.como.length>=2);
  for(const t of [g.linea,...g.como])assert.doesNotMatch(t,/\bROI\b|retorno garantizado|ahorrar[áa]s|analiz[óo] todo|todo el corpus/i,t);
 }
 assert.equal(guia('inexistente'),null);assert.equal(Object.keys(GUIAS).length,8);
});
test('las guías distinguen incidencias de problemas agrupados',()=>{
 const t=GUIAS.problemas.como.join(' ');assert.match(t,/Incidencia/);assert.match(t,/Problema agrupado/);
});
test('variacion es exacta (BigInt) y no inventa base cero',()=>{
 assert.deepEqual(variacion('1100','1000'),{dir:'sube',texto:'10.0 %'});assert.deepEqual(variacion('900','1000'),{dir:'baja',texto:'10.0 %'});
 assert.equal(variacion('5','0'),null);assert.equal(variacion('x','1'),null);assert.equal(variacion('1000','1000').dir,'igual');
 const mini=variacion('9007199254740993','9007199254740992');assert.equal(mini.dir,'sube');assert.equal(mini.pequena,true);
});
const AHORA=new Date('2026-10-21T12:00:00Z');
const mes=(m,o,r=0)=>({month:m,orders:{count:2,amountMinor:String(o),unknownAmounts:1},refunds:{count:1,amountMinor:String(r),unknownAmounts:0}});
const trends=()=>({generatedAt:'x',window:{start:'a',end:'b',months:12},note:'',
 conversations:{status:'ok',class:'observed',series:[{month:'2026-08',count:100},{month:'2026-09',count:150},{month:'2026-10',count:9}],outsideWindow:4,undated:2,total:null},
 ledger:{status:'ok',class:'observed',currency:'USD',exponent:2,otherCurrencies:['CAD','MXN'],currencies:['USD','CAD','MXN'],series:[mes('2026-08',100000),mes('2026-09',150000),mes('2026-10',1)]}});
test('dosMesesCompletos descarta el mes en curso',()=>{const p=dosMesesCompletos(trends().conversations.series,AHORA);assert.deepEqual(p.map(x=>x.month),['2026-08','2026-09']);assert.equal(dosMesesCompletos([{month:'2026-09'}],AHORA),null);});
test('Resumen: máx. 3, con fuente y cobertura; las monedas no se mezclan; categorías sin dato → Aún sin datos',()=>{
 const r=insightsResumen({trends:trends(),ahora:AHORA});assert.equal(r.length,3);
 const [c,p,k]=r;assert.match(c.texto,/\*\*100\*\*.*\*\*150\*\*.*\+50.0 %/);assert.match(c.cobertura,/fuera de la ventana/);assert.equal(c.clase,'observed');
 assert.match(p.texto,/\*\*1,000\.00 USD\*\*.*\*\*1,500\.00 USD\*\*/);assert.match(p.texto,/\+50\.0 %/);assert.match(p.cobertura,/CAD, MXN\) no se suman ni se convierten/);assert.match(p.cobertura,/2 pedidos sin importe/);
 assert.equal(k.vacio,true);assert.match(k.razon,/no están disponibles ahora/);
 for(const i of r){assert.ok(i.fuente);if(!i.vacio){assert.ok(i.cobertura);assert.ok(['observed','estimated','inferred'].includes(i.clase));}}
});
test('Resumen: sin datos o con timeout no inventa nada',()=>{
 const sin=insightsResumen({trends:null,ahora:AHORA});assert.ok(sin.every(i=>i.vacio&&i.razon&&i.fuente));
 const t=trends();t.conversations.status='timeout';t.ledger.status='empty';t.ledger.series=[];
 const r=insightsResumen({trends:t,ahora:AHORA});assert.ok(r.every(i=>i.vacio));assert.match(r[0].razon,/tiempo/);
});
test('Resumen: con una muestra la clase es Estimado y lo dice',()=>{
 const t=trends();t.conversations.class='estimated';t.conversations.sampled=true;t.conversations.samplePercent=3;
 const c=insightsResumen({trends:t,ahora:AHORA})[0];assert.equal(c.clase,'estimated');assert.match(c.cobertura,/muestra del 3 %/);
});
test('Resumen: la categoría principal usa la etiqueta en español y cuenta incidencias',()=>{
 const k=insightsResumen({trends:null,categorias:[{category:'Order: Spare Parts',count:30},{category:'Shipping: Arrived Late',count:10}],ahora:AHORA})[2];
 assert.match(k.texto,/Pedido: Refacciones/);assert.match(k.texto,/75.0 %/);assert.match(k.cobertura,/no problemas agrupados/);
});
const item=(id,title,amount,ev=1,coverage)=>({id,title,evidence:Array.from({length:ev},(_,i)=>({id:String(i)})),metrics:[{kind:'exposure',amount_minor:amount,currency:'USD',exponent:2,coverage}]});
test('Problemas: mayor exposición, importes conocidos y citas; máx. 3 y separa problemas de incidencias',()=>{
 const r=insightsProblemas({items:[item('a','Baterías','500000',3,{known_n:4,eligible_n:5}),item('b','Envíos','250000',0),item('c','Sin cifra',null,1)],moneda:'USD'});
 assert.equal(r.length,3);assert.match(r[0].texto,/Baterías/);assert.match(r[0].texto,/3\*\* citas verificables/);assert.match(r[0].cobertura,/4 de 5 registros/);assert.equal(r[0].clase,'inferred');
 assert.match(r[1].texto,/\*\*2\*\* de \*\*3\*\* problemas agrupados/);assert.match(r[2].texto,/\*\*2\*\* de \*\*3\*\*/);
});
test('Problemas: sin elementos o sin importes exactos → Aún sin datos con razón',()=>{
 const a=insightsProblemas({items:[]});assert.equal(a.length,1);assert.equal(a[0].vacio,true);
 const b=insightsProblemas({items:[item('a','X',null,0)],moneda:'USD'});assert.equal(b[0].vacio,true);assert.match(b[0].razon,/importe expuesto exacto/);
});
test('Problemas: no compara importes de monedas distintas',()=>{
 const cad={...item('a','En CAD','999999999',1)};cad.metrics[0].currency='CAD';
 const r=insightsProblemas({items:[cad,item('b','En USD','100',1)],moneda:'USD'});assert.match(r[0].texto,/En USD/);
});
test('la UI no usa «nf.format» de categorías sin traducir (anclaje de integración)',()=>{
 const src=readFileSync(new URL('../../components/evidence-panel.tsx',import.meta.url),'utf8');
 assert.match(src,/etiquetaCategoria/);
});

const catVista=(rows,extra={})=>({status:'ok',rows,totals:{incidences:rows.reduce((n,r)=>n+r.count,0),categories:rows.length,runs:5},truncated:false,...extra});
test('Resumen: categorías reales (vista de la API) → Inferido, excluye ruido del porcentaje y lo dice',()=>{
 const ruido=Object.keys(CATEGORIAS).find(c=>esCategoriaRuido(c));
 const v=catVista([{category:'Order: Spare Parts',count:60},{category:'Shipping: Arrived Late',count:20},{category:ruido,count:920}]);
 const k=insightsResumen({trends:null,categorias:v,ahora:AHORA})[2];
 assert.equal(k.clase,'inferred');assert.match(k.texto,/\*\*60\*\* de 80 \(75.0 %\)/);assert.match(k.cobertura,/3 categorías en 1,000 incidencias/);assert.match(k.cobertura,/excluye 920 incidencias de notificaciones/);
});
test('Resumen: categorías en timeout / vacías / solo ruido → Aún sin datos con razón',()=>{
 assert.match(insightsResumen({categorias:{status:'timeout',rows:[]},ahora:AHORA})[2].razon,/tiempo permitido/);
 assert.match(insightsResumen({categorias:{status:'empty',rows:[]},ahora:AHORA})[2].razon,/No hay incidencias clasificadas/);
 const ruido=Object.keys(CATEGORIAS).find(c=>esCategoriaRuido(c));
 assert.match(insightsResumen({categorias:catVista([{category:ruido,count:5}]),ahora:AHORA})[2].razon,/notificaciones automáticas/);
});
const serieP=(counts,extra={})=>({status:'ok',scope:'problem',total:counts.reduce((a,b)=>a+b,0)+(extra.outsideWindow??0),outsideWindow:0,undated:0,linkedRuns:7,window:{months:counts.length},series:counts.map((c,i)=>({month:`2026-${String(i+1).padStart(2,'0')}`,count:c})),...extra});
test('Problema: pico, cambio entre dos meses completos y corridas (máx. 3, con fuente y cobertura)',()=>{
 const r=insightsProblemaSerie(serieP([2,10,4,6,8,3,0,0,0]),new Date('2026-09-15T00:00:00Z'));
 assert.equal(r.length,3);assert.match(r[0].texto,/\*\*33\*\* incidencias/);assert.match(r[0].texto,/feb 2026\*\* con \*\*10\*\*/);
 assert.equal(r[1].vacio,true);assert.match(r[1].razon,/base honesta/);
 for(const i of r){assert.ok(i.fuente);if(!i.vacio){assert.ok(i.cobertura);assert.equal(i.clase,'inferred');}}
 assert.match(r[2].texto,/\*\*7\*\* corridas de extracción/);assert.match(r[2].texto,/\*\*33\*\* incidencias/);
});
test('Problema: cambio calculado con BigInt y sin comparar contra base cero',()=>{
 const r=insightsProblemaSerie(serieP([0,0,0,0,0,0,4,6,1]),new Date('2026-09-15T00:00:00Z'));
 const c=r.find(i=>i.id==='cambio');assert.match(c.texto,/subieron de \*\*4\*\* en julio de 2026 a \*\*6\*\* en agosto de 2026 \(\+50.0 %\)/);
 const z=insightsProblemaSerie(serieP([0,0,0,0,0,0,0,6,1]),new Date('2026-09-15T00:00:00Z')).find(i=>i.id==='cambio');assert.equal(z.vacio,true);assert.match(z.razon,/base honesta/);
});
test('Problema: vacío, timeout o sin vista → Aún sin datos; fuera de ventana y sin fecha se declaran',()=>{
 assert.equal(insightsProblemaSerie(null)[0].vacio,true);
 assert.match(insightsProblemaSerie({status:'timeout'})[0].razon,/tiempo permitido/);
 assert.match(insightsProblemaSerie({status:'empty',total:0})[0].razon,/aún no tiene incidencias/);
 const r=insightsProblemaSerie(serieP([1,2],{outsideWindow:9,undated:4,total:16}),new Date('2026-09-15T00:00:00Z'));
 assert.match(r[0].cobertura,/9 incidencias quedan fuera/);assert.match(r[0].cobertura,/4 sin fecha/);
 const sin=insightsProblemaSerie({status:'ok',total:5,outsideWindow:5,undated:0,linkedRuns:null,window:{months:2},series:[{month:'2026-01',count:0},{month:'2026-02',count:0}]},new Date('2026-09-15T00:00:00Z'));
 assert.equal(sin[0].vacio,true);assert.match(sin[0].razon,/ninguna dentro de la ventana/);
});
