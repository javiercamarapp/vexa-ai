// Requisito del dueño (24-oct): en carga y recarga solo el logo animado hasta que todo esté listo; sin encabezado global ni contenido a medias.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const f=(p)=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const css=f('app/(app)/globals.css'),layout=f('app/(app)/layout.tsx'),comp=f('components/arranque-limpio.tsx'),reg=f('components/rovaq-cargando.tsx'),hoy=f('components/hoy/hoy-pantalla.tsx');
test('el encabezado y el pie global se ocultan con carga de página completa y durante el arranque',()=>{
  assert.match(css,/body:has\(\.rovaq-cargando:not\(\.rovaq-cargando-compacto\)\) :is\(\.site-header,\.site-footer\)\s*\{\s*display:none/);
  assert.match(css,/html\[data-arranque\] :is\(\.site-header,\.site-footer,main,\.skip-link\)\s*\{\s*display:none!important/);
  assert.match(css,/html\[data-arranque\] #arranque-logo\s*\{\s*display:flex/);
});
test('el CSS crítico en línea oculta encabezado y pie y centra la carga antes de que llegue el CSS externo (visita fría en /)',()=>{
  const critico=layout.slice(layout.indexOf('ARRANQUE_CSS_CRITICO = `'),layout.indexOf('export default function RootLayout'));
  assert.match(critico,/body:has\(\.rovaq-cargando:not\(\.rovaq-cargando-compacto\)\) :is\(\.site-header,\.site-footer,\.skip-link\)\{display:none!important\}/);
  // Pantallas de acceso (login, enlace del correo, espacio de trabajo): el encabezado del sitio no se ve aunque la hoja externa llegue tarde.
  assert.match(critico,/body:has\(:is\(\.login,\.access-selection,\.workspace-shell\)\) :is\(\.site-header,\.site-footer,\.skip-link\)\{display:none!important\}/);
  assert.match(critico,/body:has\(\.access-selection\) \.rovaq-cargando\{min-height:100dvh;[^}]*align-items:center;justify-content:center/);
  assert.match(critico,/\.rovaq-cargando:not\(\.rovaq-cargando-compacto\)\{min-height:100dvh;[^}]*align-items:center;justify-content:center/);
});
test('con carga de página completa no se ve contenido hermano en el área de contenido',()=>{
  assert.match(css,/\.workspace-content:has\(\.rovaq-cargando:not\(\.rovaq-cargando-compacto\)\) \*:not\(\.rovaq-cargando\)[^{]*\{\s*display:none!important/);
});
test('el script de arranque marca data-arranque también en login/auth, excluye solo inicio/plataforma/landing, tiene seguro de 60 s solo sin ArranqueLimpio vivo y noscript revierte',()=>{
  assert.match(layout,/dataset\.arranque='1'/);
  const script=layout.match(/const ARRANQUE_ANTES_DEL_PINTADO = "([^\n]*)";/)?.[1]??'';
  assert.ok(script.length>0,'script de arranque presente');
  assert.match(script,/platform\|landing/);assert.doesNotMatch(script,/login|auth/,'login y auth también muestran solo el logo de carga: sin encabezado ni texto del sitio');
  assert.match(layout,/60000/);assert.match(layout,/__arranqueVivo/);assert.doesNotMatch(layout,/20000/);
  assert.match(layout,/<noscript>/);
  assert.match(layout,/id="arranque-logo"/);
  assert.match(layout,/<ArranqueLimpio\/>/);
});
test('el componente de arranque es cliente con la directiva en la primera línea, lee el DOM (readyState, cargadores, aria-busy), ventana estable de 600 ms y tope de 45 s',()=>{
  assert.equal(comp.split('\n')[0].trim(),"'use client';");
  assert.match(comp,/hayCargaDePagina/);assert.match(comp,/TOPE_MS = 45000/);assert.match(comp,/VENTANA_ESTABLE_MS = 600/);assert.match(comp,/delete raiz\.dataset\.arranque/);
  assert.match(comp,/document\.readyState === 'loading'/);assert.match(comp,/document\.querySelector\(inicial \? PENDIENTE : PAGINA\)/);
  assert.match(comp,/\.rovaq-cargando:not\(\.rovaq-cargando-compacto\)/);assert.match(comp,/aria-busy="true"/);assert.match(comp,/new MutationObserver/);
  assert.match(reg,/export const hayCargaDePagina/);
});
test('Hoy no pinta ningún bloque hasta que todos los datos críticos estén listos (y no vuelve al logo en reintentos)',async()=>{
  const {armarHoy}=await import('../src/components/hoy/hoy-modelo.mjs');
  const v=armarHoy({fuga:null,carga:null,cfo:null,estado:{fuga:'ok',carga:'cargando',cfo:'ok'}});
  assert.equal(v.cargando,true);
  assert.match(hoy,/yaListo/);
});
test('UNA sola capa de carga: fondo en el token --carga-fondo (claro blanco, oscuro #0e0e10), cubre todo, cargadores en línea invisibles y salida con fundido corto',()=>{
  assert.match(css,/:root \{ --carga-fondo:#ffffff; \}/);assert.match(css,/:root\[data-theme=dark\] \{ --carga-fondo:#0e0e10; \}/);
  assert.match(css,/#arranque-logo \{[^}]*position:fixed; inset:0; z-index:2000;[^}]*background:var\(--carga-fondo\)/);
  assert.match(css,/html\[data-arranque\],html\[data-arranque\] body \{ background:var\(--carga-fondo\); \}/);
  assert.match(css,/\.rovaq-cargando:not\(\.rovaq-cargando-compacto\) \{ visibility:hidden; \}/);
  assert.match(css,/#arranque-logo \{[^}]*transition:opacity 170ms/);assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{ #arranque-logo \{ transition:none; \} \}/);
  assert.match(css,/html\[data-carga-tope\] \.rovaq-cargando:not\(\.rovaq-cargando-compacto\) \{[^}]*position:fixed; inset:0;[^}]*background:var\(--carga-fondo\)/);
  assert.doesNotMatch(css,/html\[data-arranque\] #arranque-logo \{[^}]*background:var\(--background\)/);
});
test('la navegación interna activa la misma capa tras 250 ms y la mantiene >= 400 ms',()=>{
  assert.match(comp,/RETARDO_NAVEGACION_MS = 250/);assert.match(comp,/MINIMO_VISIBLE_MS = 400/);assert.match(comp,/suscribirCargaDePagina/);assert.match(comp,/raiz\.dataset\.arranque='1'/);
  assert.match(reg,/export const suscribirCargaDePagina/);
});
test('el logo de arranque respeta prefers-reduced-motion (reusa rovaq-respira)',()=>{
  assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{ \.rovaq-respira \{ animation:none/);
  assert.match(layout,/className="rovaq-respira"/);
});

test('el ajuste de cifras del celular vuelve a medir al soltar el arranque (data-arranque no es mutación de hijos)',()=>{
  const mc=f('components/ui/movil-contenido.tsx');
  assert.match(mc,/observe\(document\.documentElement,\{attributes:true,attributeFilter:\['data-arranque'\]\}\)/);
});
