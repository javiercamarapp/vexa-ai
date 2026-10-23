// Lógica pura de la pantalla «Problemas»: filas, agrupación por categoría, numeración «grupo n de N», orden, búsqueda y ruido.
//   node --test apps/web/src/lib/legibilidad/problemas-catalogo.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';
import {filasDesdeCatalogo,filasDesdeItems,agruparCategorias,numerarGrupos,ordenarFilas,filtrarFilas,resumenFilas,hayImporte,etiquetaSeveridad,fraseGrupo,marcarGeneral,ETIQUETA_GENERAL} from './problemas-catalogo.mjs';
import {separarRuido} from './ruido.mjs';

const R=(id,label,conversations,extra={})=>({id,label,conversations,severity:'medium',critical:false,citations:conversations,recommendations:0,quote:null,...extra});
const catalogo={rows:[
 R('a1','Order: Spare Parts',2338,{severity:'high',critical:true,quote:'Necesito una pieza de repuesto para mi cortadora.'}),
 R('a2','Order: Spare Parts',90),R('a3','Order: Spare Parts',90,{recommendations:1}),R('a4','Order: Spare Parts',4,{quote:null}),
 R('w1','Warranty: Battery Replacement',336,{severity:'high',critical:true}),R('w2','Warranty: Battery Replacement',124),
 R('n1','Other: Retailer notifications and system alerts',6190),R('n2','Other: Retailer notifications and system alerts',49),
 R('s1','Shipping: Questions',302)],parts:{signals:'ok',severity:'ok',quotes:'ok'}};

test('las filas del catálogo traen la categoría en español y los datos tal cual; sin catálogo se usan las incidencias de los registros',()=>{
 const f=filasDesdeCatalogo(catalogo);
 assert.equal(f.length,9);assert.equal(f[0].categoria,'Pedido: Refacciones');assert.equal(f[0].titulo,'Order: Spare Parts');assert.equal(f[0].conversaciones,2338);assert.equal(f[0].ejemplo,'Necesito una pieza de repuesto para mi cortadora.');
 const items=[{id:'x',title:'Envío: No recibido',summary:'',status:'partial',version:1,metrics:[],evidence:[{id:'e'}],details:[{label:'Incidencias (conversaciones)',value:'5'}]},{id:'y',title:'Pago',summary:'',status:'ready',version:1,metrics:[],evidence:[],details:[]}];
 const g=filasDesdeItems(items);
 assert.equal(g[0].conversaciones,5);assert.equal(g[1].conversaciones,null,'sin dato: desconocido, no 0');assert.equal(g[0].critico,null);assert.equal(g[0].citas,1);
});

test('agrupa por categoría ordenada por conversaciones y numera «grupo n de N» por conversaciones dentro de la categoría, sin repetir título ambiguo',()=>{
 const f=numerarGrupos(filasDesdeCatalogo(catalogo));
 const cats=agruparCategorias(f);
 assert.deepEqual(cats.map(c=>[c.nombre,c.grupos,c.conversaciones]),[['Otros: Notificaciones automáticas de minoristas y alertas del sistema',2,6239],['Pedido: Refacciones',4,2522],['Garantía: Reemplazo de batería',2,460],['Envío: Preguntas',1,302]]);
 const spare=f.filter(r=>r.titulo==='Order: Spare Parts').sort((a,b)=>a.grupo.n-b.grupo.n);
 assert.deepEqual(spare.map(r=>[r.id,r.grupo.n,r.grupo.de]),[['a1',1,4],['a2',2,4],['a3',3,4],['a4',4,4]],'empate por id: orden estable');
 assert.equal(f.find(r=>r.id==='s1').grupo.de,1);
 assert.equal(fraseGrupo(f.find(r=>r.id==='a2')),'Grupo 2 de 4');assert.equal(fraseGrupo(f.find(r=>r.id==='s1')),'Único grupo');
 assert.equal(cats.find(c=>c.nombre==='Pedido: Refacciones').criticos,1);
});

test('desconocido no es cero: si ninguna fila trae aviso crítico, los críticos de la categoría son null',()=>{
 const f=numerarGrupos(filasDesdeCatalogo({rows:[R('a','Order: Spare Parts',3,{critical:null,citations:null})],parts:{}}));
 assert.equal(agruparCategorias(f)[0].criticos,null);assert.equal(resumenFilas(f).criticos,null);
});

test('orden por defecto y por columnas, con desconocidos siempre al final',()=>{
 const f=numerarGrupos(filasDesdeCatalogo({rows:[R('a','Order: Spare Parts',5),R('b','Order: Spare Parts',9,{citations:null}),R('c','Shipping: Questions',9,{severity:'high'}),R('d','Shipping: Questions',1,{severity:null,citations:2})],parts:{}}));
 assert.deepEqual(ordenarFilas(f,{col:'conversaciones',dir:'desc'}).map(r=>r.id),['b','c','a','d']);
 assert.deepEqual(ordenarFilas(f,{col:'conversaciones',dir:'asc'}).map(r=>r.id),['d','a','b','c']);
 assert.deepEqual(ordenarFilas(f,{col:'citas',dir:'desc'}).map(r=>r.id),['c','a','d','b'],'null (citas no disponibles) al final aun en descendente');
 assert.deepEqual(ordenarFilas(f,{col:'citas',dir:'asc'}).map(r=>r.id),['d','a','c','b']);
 assert.deepEqual(ordenarFilas(f,{col:'severidad',dir:'desc'}).map(r=>r.id).slice(0,1),['c']);assert.equal(ordenarFilas(f,{col:'severidad',dir:'desc'}).at(-1).id,'d');
 assert.deepEqual(ordenarFilas(f,{col:'categoria',dir:'asc'}).map(r=>r.categoria),['Envío: Preguntas','Envío: Preguntas','Pedido: Refacciones','Pedido: Refacciones']);
 assert.ok(f.length===4&&f[0].id==='a','no muta la entrada');
});

test('búsqueda sin acentos ni mayúsculas, filtro por categoría y solo críticos',()=>{
 const f=numerarGrupos(filasDesdeCatalogo(catalogo));
 assert.deepEqual(filtrarFilas(f,{texto:'garantia bateria'}).map(r=>r.id).sort(),['w1','w2']);
 assert.deepEqual(filtrarFilas(f,{texto:'REPUESTO'}).map(r=>r.id),['a1'],'busca también en el extracto');
 assert.deepEqual(filtrarFilas(f,{clave:f.find(r=>r.id==='s1').clave}).map(r=>r.id),['s1']);
 assert.deepEqual(filtrarFilas(f,{soloCriticos:true}).map(r=>r.id).sort(),['a1','w1']);
 assert.equal(filtrarFilas(f,{}).length,9);
 assert.deepEqual(filtrarFilas(f,{texto:'   '}).length,9);
});

test('el ruido (notificaciones automáticas) se oculta por defecto y vuelve con el interruptor; la agrupación no las mezcla en el resumen visible',()=>{
 const f=numerarGrupos(filasDesdeCatalogo(catalogo));
 const sep=separarRuido(f,r=>[r.titulo,r.categoria],false);
 assert.equal(sep.ocultosN,2);assert.equal(sep.visibles.length,7);
 assert.ok(!agruparCategorias(sep.visibles).some(c=>/Notificaciones/.test(c.nombre)));
 assert.equal(separarRuido(f,r=>[r.titulo,r.categoria],true).visibles.length,9);
 assert.equal(resumenFilas(sep.visibles).grupos,7);assert.equal(resumenFilas(sep.visibles).categorias,3);assert.equal(resumenFilas(sep.visibles).criticos,2);
});

test('importe: solo aparece cuando algún registro trae un importe exacto; entonces la fila lo conserva',()=>{
 const item=(id,amount)=>({id,title:'Envío: No recibido',summary:'',status:'ready',version:1,evidence:[],details:[{label:'Incidencias (conversaciones)',value:'2'}],metrics:[{label:'Ingresos expuestos',kind:'exposure',amount_minor:amount,known_subtotal:null,currency:'USD',exponent:2,source_ref:'x'}]});
 assert.equal(hayImporte(filasDesdeItems([item('a',null),item('b',null)])),false);
 const f=filasDesdeItems([item('a','12345'),item('b',null),item('c','abc')]);
 assert.equal(hayImporte(f),true);assert.equal(f[0].importe.amount_minor,'12345');assert.equal(f[1].importe,null);assert.equal(f[2].importe,null,'un importe no entero no es exacto');
});

test('etiquetas de severidad: valores conocidos en español, desconocido tal cual y null como no disponible',()=>{
 assert.equal(etiquetaSeveridad('high'),'Alta');assert.equal(etiquetaSeveridad('medium'),'Media');assert.equal(etiquetaSeveridad('low'),'Baja');assert.equal(etiquetaSeveridad('critical'),'Crítica');
 assert.equal(etiquetaSeveridad(null),null);assert.equal(etiquetaSeveridad('rara'),'rara');
});

test('la fila trae cuántas señales críticas (evidencias) y el motivo; el resumen suma señales solo de los grupos críticos y lo desconocido sigue null (QA1-009)',()=>{
 const f=filasDesdeCatalogo({rows:[R('a','Order: Spare Parts',2338,{severity:'low',critical:true,critical_signals:1,critical_reason:'severity'}),R('b','Order: Spare Parts',10,{critical:false,critical_signals:0,critical_reason:null}),R('c','Shipping: Questions',5,{critical:true,critical_signals:4,critical_reason:'both'})],parts:{}});
 assert.equal(f[0].severidad,'low');assert.equal(f[0].critico,true);assert.equal(f[0].senalesCriticas,1);assert.equal(f[0].motivoCritico,'severity');
 assert.deepEqual(resumenFilas(f),{grupos:3,categorias:2,criticos:2,senalesCriticas:5});
 const sin=filasDesdeCatalogo({rows:[R('a','Order: Spare Parts',3,{critical:null,citations:null})],parts:{}});
 assert.equal(sin[0].senalesCriticas,null);assert.deepEqual(resumenFilas(sin),{grupos:1,categorias:1,criticos:null,senalesCriticas:null});
});

test('el grupo gigante (2,338 de 2,499 conversaciones) se rotula «Grupo general» sin inventar nombre; los demás conservan «Grupo n de N» (QA1-010)',()=>{
 const f=marcarGeneral(numerarGrupos(filasDesdeCatalogo({rows:[R('a','Order: Spare Parts',2338),R('b','Order: Spare Parts',90),R('c','Order: Spare Parts',71)],parts:{}})));
 assert.equal(f[0].general,true);assert.equal(fraseGrupo(f[0]),ETIQUETA_GENERAL);assert.match(ETIQUETA_GENERAL,/conviene re-agrupar/);
 assert.equal(f[1].general,false);assert.equal(fraseGrupo(f[1]),'Grupo 2 de 3');
 const solo=marcarGeneral(numerarGrupos(filasDesdeCatalogo({rows:[R('a','Order: Spare Parts',10)],parts:{}})));assert.equal(solo[0].general,false);assert.equal(fraseGrupo(solo[0]),'Único grupo');
 const parejo=marcarGeneral(filasDesdeCatalogo({rows:[R('a','x',100),R('b','y',100),R('c','z',100),R('d','w',100)],parts:{}}));assert.ok(parejo.every(r=>!r.general));
 const sinDato=marcarGeneral(filasDesdeCatalogo({rows:[R('a','x',null),R('b','y',null)].map(r=>({...r,conversations:null})),parts:{}}));assert.ok(sinDato.every(r=>!r.general),'desconocido no es grande');
});
