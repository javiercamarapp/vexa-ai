import test from 'node:test';
import assert from 'node:assert/strict';
import type {FugaVista} from '../../../packages/workspace-service/fuga-reembolsos.mjs';
import {mensajeReclamo} from '../src/components/refunds/fuga-archivos.mjs';
import {identidadReclamo,reconciliarBorrador} from '../src/components/hoy/reclamo-borrador';

const scope:FugaVista['scope']={dateStart:'2026-08-01',dateEnd:'2026-09-01',currency:'USD'};
const sku='SYN-1';
const fixture:FugaVista={
 generatedAt:'2026-10-25T19:00:00Z',scope,class:'observed',ventanas:[],todasParciales:true,
 titular:{status:'unavailable'},acumulado:{status:'unavailable'},
 skus:{status:'ok',top:[{sku,n:1,usdBrutoMinor:'1000',usdNetoMinor:'1000',pos:1,canales:[],lineas:null,acumPct:null}],total:1,sinSku:{n:0},walmart:[],lineasStatus:'unavailable',detalleMensual:[]},
 intensidad:{status:'unavailable'},tracker:{status:'unavailable'},contactoRepetido:{status:'unavailable'},
 cambios:{reembolsos:[],conversaciones:null,excluidos:[]},parts:{},
};
const cuerpo=mensajeReclamo(fixture,sku)!.cuerpo;
const identidad=identidadReclamo(sku,scope,cuerpo);
const editado={identidad,texto:'Revisar el lote de agosto según el acuerdo con el proveedor.'};

test('cambiar periodo descarta el borrador aunque el generador produzca exactamente el mismo texto',()=>{
 const otro={...fixture,scope:{...scope,dateStart:'2026-09-01',dateEnd:'2026-10-01'}};
 const mismoTexto=mensajeReclamo(otro,sku)!.cuerpo;
 assert.equal(mismoTexto,cuerpo,'regresión: el texto generado no identifica el periodo');
 const siguiente=identidadReclamo(sku,otro.scope,mismoTexto);
 assert.notEqual(siguiente,identidad);
 const vigente=reconciliarBorrador(editado,siguiente);
 const mostrado=vigente?.texto??mismoTexto;
 assert.equal(vigente,null);
 assert.equal(mostrado,cuerpo);
 assert.equal(reconciliarBorrador(vigente,identidad),null,'volver al periodo no resucita un borrador descartado');
});
test('renders y refrescos del mismo alcance conservan la edición, incluso vacía',()=>{
 const igual=identidadReclamo(sku,{...scope},mensajeReclamo({...fixture,generatedAt:'2026-10-25T20:00:00Z'},sku)!.cuerpo);
 assert.equal(reconciliarBorrador(editado,igual),editado);
 const vacio={identidad,texto:''};assert.equal(reconciliarBorrador(vacio,igual)?.texto,'');
});
test('SKU y contenido nuevo también invalidan el borrador',()=>{
 for(const siguiente of [identidadReclamo('SYN-2',scope,cuerpo),identidadReclamo(sku,scope,cuerpo+' Cambió la cifra.')])assert.equal(reconciliarBorrador(editado,siguiente),null);
});
