//   node --test apps/web/src/lib/legibilidad/resumen-ejecutivo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {lineaAvisos,kpiConversaciones,kpiPedidos,topProblemas,estadoFuentes,mesesCoberturaBaja,coberturaDeTendencias,avisosCoherentes} from './resumen-ejecutivo.mjs';
const AHORA=new Date('2026-10-23T00:00:00Z');
const conv={status:'ok',class:'observed',series:[{month:'2026-07',count:900},{month:'2026-08',count:2575},{month:'2026-09',count:1318},{month:'2026-10',count:77}],completeness:{dataThrough:'2026-10-05T00:00:00.000Z'}};
test('conversaciones: último mes completo vs anterior; octubre parcial no entra',()=>{
 const k=kpiConversaciones(conv,AHORA);
 assert.equal(k.valor,1318);assert.equal(k.mes,'2026-09');assert.equal(k.delta.dir,'down');assert.equal(k.delta.value,'48.8 %');assert.match(k.rotulo,/septiembre de 2026 vs ago/);
 assert.equal(kpiConversaciones({status:'timeout'},AHORA),null);
 assert.equal(kpiConversaciones({...conv,series:[{month:'2026-10',count:5}]},AHORA).valor,null,'sin mes completo no hay cifra');
});
// Serie real de vexa-ai (conversation_monthly, leída 23-oct-2026): nov-25 … sep-26; octubre en curso sin conversaciones cargadas.
const REAL=[['2025-11',3403],['2025-12',5807],['2026-01',5806],['2026-02',1961],['2026-03',3263],['2026-04',4201],['2026-05',5370],['2026-06',6047],['2026-07',8810],['2026-08',2576],['2026-09',1318],['2026-10',0]].map(([month,count])=>({month,count}));
const CORTE={dataThrough:'2026-10-18T00:00:00.000Z'};
test('cobertura baja: un mes completo con < 25 % de la mediana no da delta ni flecha, y lo dice con su nombre',()=>{
 const serie=REAL.map(p=>p.month==='2026-09'?{...p,count:1100}:p);// 1,100 < 25 % de 4,786
 const k=kpiConversaciones({status:'ok',class:'estimated',sampled:true,series:serie,completeness:CORTE},AHORA);
 assert.equal(k.delta,null);assert.equal(k.mes,'2026-09');assert.equal(k.valor,1100);assert.deepEqual(k.coberturaBaja,['septiembre']);
 assert.equal(k.rotulo,'Cobertura baja en septiembre (carga de HubSpot parcial); sin comparación');
 assert.ok(!k.spark.includes(1100),'la serie de la tarjeta no baja con el mes de cobertura baja');assert.equal(k.estimado,true);
 assert.deepEqual([...mesesCoberturaBaja({series:serie,completeness:CORTE},AHORA).keys()],['2026-09']);
});
test('cobertura baja en el mes BASE de la comparación tampoco da delta (el % saldría inflado)',()=>{
 const serie=REAL.map(p=>p.month==='2026-08'?{...p,count:900}:p);
 const k=kpiConversaciones({status:'ok',class:'observed',series:serie,completeness:CORTE},AHORA);
 assert.equal(k.delta,null);assert.match(k.rotulo,/^Cobertura baja en agosto/);
});
test('números reales (jul 8,810 · ago 2,576 · sep 1,318): la regla del 25 % NO marca septiembre (27.5 % de la mediana 4,786) ni agosto (53.8 %)',()=>{
 const baja=mesesCoberturaBaja({series:REAL,completeness:CORTE},AHORA);
 assert.equal(baja.size,0,'ningún mes del año queda marcado con los números reales');
 const k=kpiConversaciones({status:'ok',class:'estimated',sampled:true,series:REAL,completeness:CORTE},AHORA);
 assert.equal(k.delta.value,'48.8 %');assert.equal(k.delta.dir,'down');
});
test('pedidos: monto exacto del último mes completo con su base rotulada, sin convertir monedas',()=>{
 const led={status:'ok',currency:'USD',exponent:2,completeness:{dataThrough:'2026-10-05T00:00:00.000Z'},series:[{month:'2026-08',orders:{count:10,amountMinor:'120000',unknownAmounts:0}},{month:'2026-09',orders:{count:8,amountMinor:'87200700',unknownAmounts:1}},{month:'2026-10',orders:{count:1,amountMinor:'500',unknownAmounts:0}}]};
 const k=kpiPedidos(led,AHORA);
 assert.equal(k.mes,'2026-09');assert.equal(k.amountMinor,'87200700');assert.equal(k.delta.dir,'up');assert.match(k.rotulo,/Libro de registros, septiembre de 2026/);
 {const k2=kpiPedidos({...led,orderBasis:{base:'marketplace_line_price',label:'Precio de línea de marketplace'}},new Date('2026-10-22T12:00:00Z'));assert.equal(k2.base,'Precio de línea de marketplace');assert.match(k2.rotulo,/^Precio de línea de marketplace, septiembre de 2026/);}
 assert.equal(kpiPedidos({status:'ok',currency:'USD',exponent:2,series:[]},AHORA).amountMinor,null);
 assert.equal(kpiPedidos(null,AHORA),null);
});
test('top de problemas: por conversaciones, desconocidos fuera, con grupo numerado',()=>{
 const it=(id,t,n)=>({id,title:t,metrics:[],evidence:[],details:n===null?[]:[{label:'Incidencias (conversaciones)',value:String(n)}]});
 const top=topProblemas([it('a','Warranty: Battery Replacement',40),it('b','Warranty: Battery Replacement',336),it('c','Shipping: Questions',null),it('d','Order: Spare Parts',100)],2);
 assert.deepEqual(top.map(f=>f.id),['b','d']);assert.deepEqual(top[0].grupo,{n:1,de:2});
});
test('fuentes: «6 de 7», análisis incorporado y «datos hasta» con su propia fecha (sin fecha = desconocida)',()=>{
 const view={sources:[{key:'hubspot',label:'HubSpot',loaded:true,status:'ok',total:8200,incorporated:8033,rejectionBreakdown:{status:'ok',conversationRows:8200,conversationIncorporated:8033}},{key:'zendesk',label:'Zendesk',loaded:false,status:'empty'},{key:'csv',label:'CSV',loaded:true,status:'ok',total:1,incorporated:1}]};
 const e=estadoFuentes(view,{libro:'2026-10-05T00:00:00Z',conversaciones:null});
 assert.equal(e.cargadas,2);assert.equal(e.total,3);assert.deepEqual(e.sinCargar,['Zendesk']);assert.equal(e.incorporacion.pct,98);assert.equal(e.incorporacion.texto,'8,033 de 8,200 conversaciones de HubSpot (98.0 %)');
 {const sin=estadoFuentes({sources:[{key:'hubspot',label:'HubSpot',loaded:true,status:'ok',total:17163,incorporated:8287,rejectionBreakdown:{status:'unavailable'}}]});assert.equal(sin.incorporacion,null,'sin desglose no se inventa un porcentaje sobre otra base');}
 {const c=coberturaDeTendencias({status:'ok',class:'observed',total:104018,analysis:{status:'ok',analyzed:9994}});assert.equal(c.texto,'9,994 de 104,018 conversaciones (9.6 %)');assert.equal(coberturaDeTendencias({status:'ok',total:100,analysis:{status:'timeout',analyzed:null}}).pct,null);assert.equal(coberturaDeTendencias(null).pct,null);}
 assert.equal(e.cortes.find(c=>c.etiqueta==='Libro de pedidos').dia,'5 oct 2026');assert.equal(e.cortes.find(c=>c.etiqueta==='Conversaciones').dia,null);
 assert.equal(estadoFuentes(null).cargadas,null);
});

test('datos hasta el 18-sep (último mensaje real): septiembre es parcial, sin flecha ni delta; agosto sigue siendo el último mes completo',()=>{
 const k=kpiConversaciones({status:'ok',class:'observed',series:REAL,completeness:{dataThrough:'2026-09-18'}},AHORA);
 assert.equal(k.delta,null);assert.equal(k.mes,'2026-08');assert.equal(k.valor,2576);assert.deepEqual(k.coberturaParcial,['septiembre']);assert.equal(k.datosHasta,'2026-09-18');
 assert.equal(k.rotulo,'Cobertura parcial en septiembre (datos hasta el 18 de septiembre); sin comparación');
});

test('línea de avisos: solo con avisos críticos reales; resume qué falta y qué mes es parcial',()=>{
 assert.equal(lineaAvisos({conv:{series:REAL,completeness:{dataThrough:'2026-10-18'}},ahora:AHORA}),null,'sin avisos y con datos completos no hay línea');
 const l=lineaAvisos({critico:true,faltantes:['Exposición','Reembolsos'],conv:{series:REAL,completeness:{dataThrough:'2026-09-18'}},led:{series:[{month:'2026-09',orders:{count:5}}],completeness:{dataThrough:'2026-09-30'}},ahora:AHORA});
 assert.match(l,/^Estado de los datos: hay señales críticas por revisar · faltan 2 cifras por cobertura \(Exposición, Reembolsos\) · conversaciones: septiembre parcial \(datos hasta el 18 de septiembre\), sin comparación\.$/);
 assert.ok(!/libro/.test(l),'el libro con datos hasta el 30-sep no es parcial');
 assert.match(lineaAvisos({faltantes:['Exposición']}),/falta cobertura de Exposición/);
});

test('A7: el aviso de señales críticas pendientes desaparece cuando la tarjeta ya muestra el conteo (mismo estado)',()=>{
 const av=[{key:'pendiente'},{key:'parcial'}];
 assert.deepEqual(avisosCoherentes(av,{groups:53,signals:120}).map(a=>a.key),['parcial']);
 assert.deepEqual(avisosCoherentes(av,null).map(a=>a.key),['pendiente','parcial'],'sin conteo el aviso sigue');
 assert.deepEqual(avisosCoherentes(undefined,null),[]);
 assert.equal(lineaAvisos({critico:false,pendiente:avisosCoherentes(av,{groups:53,signals:null}).some(a=>a.key==='pendiente'),parcialCarga:false,faltantes:[],conv:null,led:null,ahora:AHORA}),null,'la línea de estado tampoco dice «sin calcular»');
});
