// Onboarding: recorrido corto (unos 12 pasos) además del completo, con selector al iniciar. Lógica pura y marcado, como onboarding-tour.test.tsx.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {ROL_DE_PISTA} from '../src/lib/onboarding/catalogo.mjs';
import {construirTour,pantallasDe,gruposDe,ESENCIALES,MODOS} from '../src/lib/onboarding/tour.mjs';
import {estadoInicial,reducir,eventoDeTecla} from '../src/lib/onboarding/recorrido.mjs';
import {actualizarEstado,leerEstado,claveEstado,ESTADO_VACIO,type Almacen} from '../src/lib/onboarding/estado';
import {InvitacionRecorrido,MenuGuia} from '../src/components/onboarding/paneles';
import {traductor} from '../src/lib/i18n';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const ROLES=['propietario','analista','operador','lector'] as const;
const noop=()=>{};
const leer=(rel:string)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');

test('los modos son corto y completo',()=>{assert.deepEqual([...MODOS],['corto','completo']);});
test('cada rol tiene un recorrido corto de 12 pasos, subconjunto exacto del completo y con cierre',()=>{
  for(const pista of ROLES){
    const corto=construirTour(pista,'corto'),completo=construirTour(pista,'completo'),ids=new Set(completo.map(p=>p.id));
    assert.equal(corto.length,12,pista);
    assert.ok(corto.every(p=>ids.has(p.id)),`${pista}: un paso corto no existe en el completo`);
    assert.equal(corto.at(-1)!.tipo,'cierre',pista);
    assert.equal(new Set(corto.map(p=>p.id)).size,corto.length,`${pista}: ids repetidos`);
    // Cada pantalla del corto entra por «ir» y se explica con «que»: nunca un paso suelto sin contexto.
    for(const g of gruposDe(corto)){const claves=corto.filter(p=>p.pantalla===g.href).map(p=>p.clave);assert.ok(claves[0]==='ir'&&claves.includes('que'),`${pista} ${g.href}: ${claves}`);}
  }
});
test('el corto solo recorre pantallas que el menú del rol muestra y mantiene el orden del recorrido completo',()=>{
  for(const pista of ROLES){
    const menu=pantallasDe(pista),pantallas=gruposDe(construirTour(pista,'corto')).map(g=>g.href);
    assert.ok(pantallas.length>=4,pista);
    assert.ok(pantallas.every(h=>menu.includes(h)),`${pista}: pantalla fuera del menú del rol`);
    assert.deepEqual(pantallas,menu.filter(h=>pantallas.includes(h)),`${pista}: orden distinto al del menú`);
    assert.equal(pantallas.length,ESENCIALES[pista]!.length,`${pista}: una esencial no está en su menú`);
  }
});
test('los grupos del corto se numeran 0..n-1 sin huecos y el cierre queda en n',()=>{
  for(const pista of ROLES){
    const t=construirTour(pista,'corto'),grupos=gruposDe(t);
    assert.deepEqual(grupos.map(g=>g.grupo),grupos.map((_,i)=>i),pista);
    assert.equal(t.at(-1)!.grupo,grupos.length,pista);
  }
});
test('el rol no recibe esenciales de otro: el lector no ve Equipo ni el analista Intervenciones',()=>{
  const ve=(p:(typeof ROLES)[number])=>gruposDe(construirTour(p,'corto')).map(g=>g.href);
  assert.ok(ve('propietario').includes('/settings/team'));
  for(const p of ['analista','operador','lector'] as const)assert.ok(!ve(p).includes('/settings/team'),p);
  assert.ok(ve('operador').includes('/interventions'));assert.ok(!ve('lector').includes('/interventions'));
  assert.ok(ROL_DE_PISTA.lector==='viewer');
});
test('plataforma y soporte no tienen versión reducida (plataforma ya es corta)',()=>{
  assert.deepEqual(construirTour('plataforma','corto').map(p=>p.id),construirTour('plataforma','completo').map(p=>p.id));
  assert.deepEqual(construirTour('soporte','corto'),[]);
});
test('sin modo se mantiene el recorrido completo de siempre',()=>{
  for(const pista of ROLES)assert.deepEqual(construirTour(pista).map(p=>p.id),construirTour(pista,'completo').map(p=>p.id));
});
test('el recorrido corto de un lector se completa con flechas y clics y llega al cierre',()=>{
  const tour=construirTour('lector','corto'),n=tour.length;let e=reducir(estadoInicial(),{tipo:'abrir'},n,tour,'/overview'),pasos=0;
  while(e.abierto&&pasos<200){const p=tour[e.indice];e=p.tipo==='ir'?reducir(e,{tipo:'clic'},n,tour,'/x'):reducir(e,eventoDeTecla('ArrowRight','BODY')!,n,tour,p.href);pasos++;}
  assert.equal(e.terminado,true);assert.ok(pasos<=n);
});
test('estado: el modo elegido se guarda, un valor ajeno se descarta y el vacío no trae modo',()=>{
  const datos=new Map<string,string>(),a:Almacen={getItem:k=>datos.get(k)??null,setItem:(k,v)=>{datos.set(k,v);},removeItem:k=>{datos.delete(k);},key:i=>[...datos.keys()][i]??null,get length(){return datos.size;}};
  const k=claveEstado('u','t','analista');
  assert.equal(ESTADO_VACIO.modo,null);assert.equal(leerEstado(a,k).modo,null);
  assert.equal(actualizarEstado(a,k,{modo:'corto',paso:'problems.que',activo:true}).modo,'corto');
  assert.equal(leerEstado(a,k).modo,'corto');assert.equal(actualizarEstado(a,k,{activo:false}).modo,'corto','cerrar no borra la elección');
  a.setItem(k,JSON.stringify({modo:'rapido',paso:'x'}));assert.equal(leerEstado(a,k).modo,null);
  a.setItem(k,'{roto');assert.equal(leerEstado(a,k).modo,null);
});
const T={es:traductor('es'),en:traductor('en')};
test('la invitación ofrece corto y completo con el número de pasos en ES y EN; sin versión corta queda un solo botón',()=>{
  for(const [id,corto,completo] of [['es','Recorrido corto (12 pasos)','Recorrido completo (80 pasos)'],['en','Short tour (12 steps)','Full tour (80 steps)']] as const){
    const html=renderToStaticMarkup(<InvitacionRecorrido t={T[id]} saltar={noop} empezar={noop} opciones={{corto:12,completo:80}}/>);
    assert.match(html,new RegExp(corto.replace(/[()]/g,'\\$&')));assert.match(html,new RegExp(completo.replace(/[()]/g,'\\$&')));
    assert.match(html,/data-onb-modo="corto"/);assert.match(html,/data-onb-modo="completo"/);
  }
  const uno=renderToStaticMarkup(<InvitacionRecorrido t={T.en} saltar={noop} empezar={noop}/>);
  assert.doesNotMatch(uno,/data-onb-modo/);assert.match(uno,/Start tour/);
});
test('el menú de la Guía ofrece los dos recorridos cuando hay versión corta',()=>{
  const html=renderToStaticMarkup(<MenuGuia t={T.es} contexto="Org · Propietario" tienePaso={false} mostrarChecklistOpcion={false} descartado={false} iniciar={noop} opciones={{corto:12,completo:80}} retomar={noop} mostrarChecklist={noop} noVolver={noop} cerrar={noop}/>);
  assert.match(html,/Recorrido corto \(12 pasos\)/);assert.match(html,/Recorrido completo \(80 pasos\)/);assert.doesNotMatch(html,/Repetir el recorrido/);
  const sin=renderToStaticMarkup(<MenuGuia t={T.es} contexto="x" tienePaso={false} mostrarChecklistOpcion={false} descartado={false} iniciar={noop} retomar={noop} mostrarChecklist={noop} noVolver={noop} cerrar={noop}/>);
  assert.match(sin,/Repetir el recorrido/);
});
test('paridad ES y EN de las claves nuevas, con las mismas variables y sin cifras escritas a mano',()=>{
  for(const k of ['onb.ui.invitacionElige','onb.ui.recorridoCorto','onb.ui.recorridoCompleto']){
    const a=(es as Record<string,string>)[k],b=(en as Record<string,string>)[k];assert.ok(a&&b,k);
    assert.equal([...a.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).join(),[...b.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).join(),k);
    assert.doesNotMatch(a,/\d/);assert.doesNotMatch(b,/\d/);
  }
});
test('el contexto elige los pasos por modo y la guía conserva el modo al retomar',()=>{
  const ctx=leer('src/components/onboarding/contexto.tsx');
  assert.match(ctx,/construirTour\(pista,'corto'\)/);assert.match(ctx,/hayModoCorto/);assert.match(ctx,/guardar\(\{omitido:false,modo:elegido\}\)/);
});
