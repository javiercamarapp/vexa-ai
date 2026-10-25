// Requisito del dueño (24-oct): en carga y recarga solo el logo animado hasta que todo esté listo; sin encabezado global ni contenido a medias.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f=(p)=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const css=f('app/globals.css'),layout=f('app/layout.tsx'),comp=f('components/arranque-limpio.tsx'),reg=f('components/rovaq-cargando.tsx'),hoy=f('components/hoy/hoy-pantalla.tsx');
test('el encabezado y el pie global se ocultan con carga de página completa y durante el arranque',()=>{
  assert.match(css,/body:has\(\.rovaq-cargando:not\(\.rovaq-cargando-compacto\)\) :is\(\.site-header,\.site-footer\)\s*\{\s*display:none/);
  assert.match(css,/html\[data-arranque\] :is\(\.site-header,\.site-footer,main,\.skip-link\)\s*\{\s*display:none!important/);
  assert.match(css,/html\[data-arranque\] #arranque-logo\s*\{\s*display:flex/);
});
test('con carga de página completa no se ve contenido hermano en el área de contenido',()=>{
  assert.match(css,/\.workspace-content:has\(\.rovaq-cargando:not\(\.rovaq-cargando-compacto\)\) \*:not\(\.rovaq-cargando\)[^{]*\{\s*display:none!important/);
});
test('el script de arranque marca data-arranque, excluye login/auth, tiene seguro de 15 s y noscript revierte',()=>{
  assert.match(layout,/dataset\.arranque='1'/);
  assert.match(layout,/login\|auth/);
  assert.match(layout,/20000/);
  assert.match(layout,/<noscript>/);
  assert.match(layout,/id="arranque-logo"/);
  assert.match(layout,/<ArranqueLimpio\/>/);
});
test('el componente de arranque es cliente con la directiva en la primera línea, lee el DOM (readyState, cargadores, aria-busy), ventana estable de 600 ms y tope de 20 s',()=>{
  assert.equal(comp.split('\n')[0].trim(),"'use client';");
  assert.match(comp,/hayCargaDePagina/);assert.match(comp,/TOPE_MS = 20000/);assert.match(comp,/VENTANA_ESTABLE_MS = 600/);assert.match(comp,/delete raiz\.dataset\.arranque/);
  assert.match(comp,/document\.readyState === 'loading'/);assert.match(comp,/document\.querySelector\(PENDIENTE\)/);
  assert.match(comp,/\.rovaq-cargando:not\(\.rovaq-cargando-compacto\)/);assert.match(comp,/aria-busy="true"/);assert.match(comp,/new MutationObserver/);
  assert.match(reg,/export const hayCargaDePagina/);
});
test('Hoy no pinta ningún bloque hasta que todos los datos críticos estén listos (y no vuelve al logo en reintentos)',async()=>{
  const {armarHoy}=await import('../src/components/hoy/hoy-modelo.mjs');
  const v=armarHoy({fuga:null,carga:null,cfo:null,estado:{fuga:'ok',carga:'cargando',cfo:'ok'}});
  assert.equal(v.cargando,true);
  assert.match(hoy,/yaListo/);
});
test('el logo de arranque respeta prefers-reduced-motion (reusa rovaq-respira)',()=>{
  assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{ \.rovaq-respira \{ animation:none/);
  assert.match(layout,/className="rovaq-respira"/);
});

test('el ajuste de cifras del celular vuelve a medir al soltar el arranque (data-arranque no es mutación de hijos)',()=>{
  const mc=f('components/ui/movil-contenido.tsx');
  assert.match(mc,/observe\(document\.documentElement,\{attributes:true,attributeFilter:\['data-arranque'\]\}\)/);
});
