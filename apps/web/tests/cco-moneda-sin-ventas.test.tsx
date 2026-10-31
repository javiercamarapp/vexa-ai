// CCO pregunta A: una tabla de moneda sin ventas reales se pliega a una línea honesta; con ventas queda igual. Datos sintéticos.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {IdiomaProvider} from '../src/components/i18n/proveedor';
import {TarjetaA} from '../src/components/cco/cco-tarjetas';
import {monedaSinVentas,skusConDefectos} from '../src/components/cco/cco-modelo.mjs';

const fila=(sku:string,lineas:number,brutoMinor:string,defectos:number|null)=>({sku,lineas,brutoMinor,exponente:2,reembolsos:null,reembolsosSinImporte:null,reembolsoMinor:null,porCien:null,defectos,defectosClase:null,hojas:null});
const moneda=(m:string,top:ReturnType<typeof fila>[])=>({moneda:m,exponente:2,skus:top.length,totalBrutoMinor:'0',top});
const card=(monedas:ReturnType<typeof moneda>[])=>({estado:'salvedad',salvedades:[],faltan:[],cobertura:[],trackerDisponible:true,canales:[{canal:'amazon',ventana:{desde:'2025-10-01',hasta:'2026-09-01',meses:12,completa:true,ordenesDesde:null,ordenesHasta:null,devolucionesDesde:null,devolucionesHasta:null},devolucionesDisponibles:true,lineas:0,lineasConSku:0,devoluciones:0,devolucionesConSku:0,lineasSinSku:0,monedas}]}) as never;
const render=(idioma:'es'|'en',c:never)=>renderToStaticMarkup(<IdiomaProvider idioma={idioma}><TarjetaA card={c} minimo={5} consultado="2026-10-28T12:00:00.000Z"/></IdiomaProvider>);
const ceros=moneda('MXN',[fila('SYN-1',0,'0',3),fila('SYN-2',0,'0',2),fila('SYN-3',0,'0',null)]);
const conVentas=moneda('USD',[fila('SYN-4',20,'150000',null),fila('SYN-5',0,'0',1)]);

test('tabla toda en cero: una línea honesta con {n} y el detalle plegado en <details> con las mismas filas',()=>{
  assert.equal(monedaSinVentas(ceros),true);assert.equal(skusConDefectos(ceros),2);
  const h=render('en',card([ceros]));
  assert.match(h,/<details[^>]*class="cco-plegable"[^>]*><summary>No sales in this currency in this window; 2 SKUs have Tracker defect cases\.<\/summary>/);
  assert.doesNotMatch(h,/<details[^>]* open/,'plegado por omisión');
  for(const s of ['SYN-1','SYN-2','SYN-3'])assert.ok(h.includes(s),'la fila '+s+' sigue en el marcado');
  const e=render('es',card([ceros]));
  assert.match(e,/<summary>Sin ventas en esta moneda en esta ventana; 2 SKU tienen casos de defecto del Tracker\.<\/summary>/);
});
test('con al menos una fila con ventas la tabla queda igual que antes: sin details ni línea de colapso',()=>{
  assert.equal(monedaSinVentas(conVentas),false);
  const h=render('es',card([conVentas]));
  assert.doesNotMatch(h,/<details|Sin ventas en esta moneda/);assert.match(h,/<table/);assert.ok(h.includes('SYN-4')&&h.includes('SYN-5'));
});
test('dos monedas: solo la de ceros se pliega y la otra sigue visible',()=>{
  const h=render('en',card([conVentas,ceros]));
  assert.equal((h.match(/<details/g)??[]).length,1);assert.equal((h.match(/<table/g)??[]).length,2);
});
test('accesibilidad: summary nativo (teclado), tabla con caption y región enfocable dentro',()=>{
  const h=render('en',card([ceros]));
  assert.match(h,/<details[^>]*><summary>/);
  assert.match(h,/<div class="ui-table-wrap" tabindex="0" role="region" aria-label="Amazon MXN">/);
  assert.match(h,/<caption class="sr-only">Amazon MXN<\/caption>/);
});
test('importes ilegibles o sin filas no cuentan como cero: no se pliega',()=>{
  assert.equal(monedaSinVentas(moneda('MXN',[fila('SYN-1',0,'abc',1)])),false);
  assert.equal(monedaSinVentas(moneda('MXN',[])),false);
  assert.equal(monedaSinVentas(moneda('MXN',[fila('SYN-1',0,'0',1),fila('SYN-2',1,'0',1)])),false);
  assert.equal(monedaSinVentas(moneda('MXN',[fila('SYN-1',0,'100',1)])),false);
});
test('ES y EN con las mismas {variables}',()=>{
  for(const k of ['cco.sinVentasMoneda','cco.sinVentasMonedaSolo'] as const){
    const v=(s:string)=>(s.match(/\{\w+\}/g)??[]).sort().join();
    assert.ok(es[k]&&en[k]);assert.equal(v(es[k]),v(en[k]),k);
  }
  assert.match(en['cco.sinVentasMoneda'],/\{n\}/);
  const h=render('es',card([moneda('MXN',[fila('SYN-1',0,'0',0)])]));
  assert.match(h,/<summary>Sin ventas en esta moneda en esta ventana\.<\/summary>/);
});
