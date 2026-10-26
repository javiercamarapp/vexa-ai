import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidElement,type ReactNode} from 'react';
import {KpiLinea} from '../src/components/panel-comun/kpi-linea';

function segmentos(node:ReactNode):{key:string|null;title:string}[]{
 if(Array.isArray(node))return node.flatMap(segmentos);
 if(!isValidElement<{children?:ReactNode;title?:string}>(node))return [];
 if(node.type==='i')return [{key:node.key,title:node.props.title??''}];
 return segmentos(node.props.children);
}

test('cortes con prefijo idéntico conservan identidades completas y estables al reordenarse',()=>{
 const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
 const partes=ids.map((key,i)=>({key,label:key.slice(0,6),value:i+1}));
 const render=(p:typeof partes)=>segmentos(KpiLinea({items:[{label:'Cortes guardados',value:2,c:5,partes:p}]}));
 assert.deepEqual(partes.map(p=>p.label),['000000','000000']);
 const inicial=render(partes),reordenado=render([...partes].reverse());
 assert.deepEqual(inicial.map(p=>p.key),ids);
 assert.equal(new Set(inicial.map(p=>p.key)).size,2);
 assert.deepEqual(reordenado,[...inicial].reverse(),'la identidad sigue al corte, no a su índice');
 assert.deepEqual(inicial.map(p=>p.title),['000000: 1','000000: 2'],'la etiqueta breve sigue siendo presentación');
});
test('barras sin id explícito conservan sus etiquetas como clave',()=>{
 const nodes=segmentos(KpiLinea({items:[{label:'Canales',value:3,c:1,partes:[{label:'Amazon',value:1},{label:'Walmart',value:2}]}]}));
 assert.deepEqual(nodes.map(p=>p.key),['Amazon','Walmart']);
});
