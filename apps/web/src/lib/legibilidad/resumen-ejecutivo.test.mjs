//   node --test apps/web/src/lib/legibilidad/resumen-ejecutivo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {kpiConversaciones,kpiPedidos,topProblemas,estadoFuentes} from './resumen-ejecutivo.mjs';
const AHORA=new Date('2026-10-23T00:00:00Z');
const conv={status:'ok',class:'observed',series:[{month:'2026-07',count:900},{month:'2026-08',count:2575},{month:'2026-09',count:1318},{month:'2026-10',count:77}],completeness:{dataThrough:'2026-10-05T00:00:00.000Z'}};
test('conversaciones: último mes completo vs anterior; octubre parcial no entra',()=>{
 const k=kpiConversaciones(conv,AHORA);
 assert.equal(k.valor,1318);assert.equal(k.mes,'2026-09');assert.equal(k.delta.dir,'down');assert.equal(k.delta.value,'48.8 %');assert.match(k.rotulo,/septiembre de 2026 vs ago/);
 assert.equal(kpiConversaciones({status:'timeout'},AHORA),null);
 assert.equal(kpiConversaciones({...conv,series:[{month:'2026-10',count:5}]},AHORA).valor,null,'sin mes completo no hay cifra');
});
test('pedidos: monto exacto del último mes completo con su base rotulada, sin convertir monedas',()=>{
 const led={status:'ok',currency:'USD',exponent:2,completeness:{dataThrough:'2026-10-05T00:00:00.000Z'},series:[{month:'2026-08',orders:{count:10,amountMinor:'120000',unknownAmounts:0}},{month:'2026-09',orders:{count:8,amountMinor:'87200700',unknownAmounts:1}},{month:'2026-10',orders:{count:1,amountMinor:'500',unknownAmounts:0}}]};
 const k=kpiPedidos(led,AHORA);
 assert.equal(k.mes,'2026-09');assert.equal(k.amountMinor,'87200700');assert.equal(k.delta.dir,'up');assert.match(k.rotulo,/Libro de registros, septiembre de 2026/);
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
 assert.equal(e.cargadas,2);assert.equal(e.total,3);assert.deepEqual(e.sinCargar,['Zendesk']);assert.equal(e.analisis.pct,98);
 assert.equal(e.cortes.find(c=>c.etiqueta==='Libro de pedidos').dia,'5 oct 2026');assert.equal(e.cortes.find(c=>c.etiqueta==='Conversaciones').dia,null);
 assert.equal(estadoFuentes(null).cargadas,null);
});
