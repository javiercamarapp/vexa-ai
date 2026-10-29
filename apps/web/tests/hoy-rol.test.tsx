// F3b: «Hoy» de operador y lector solo lee lo que su rol puede leer: ni endpoints de dinero, ni tarjetas «sin acceso».
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {aceptarProblemas,aceptarIntervenciones,HoyRol,HoyPorRol} from '../src/components/hoy/hoy-rol';
import {IdiomaProvider} from '../src/components/i18n/proveedor';
import {OnboardingRaiz} from '../src/components/onboarding/contexto';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {PathnameContext,SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer=(rel:string)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const ID='11111111-2222-4333-8444-555555555555',YO='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const router={push(){},replace(){},back(){},forward(){},refresh(){},prefetch(){}};
const envolver=(rol:string|undefined,hijo:React.ReactNode,idioma:'es'|'en'='es')=>renderToStaticMarkup(
 <AppRouterContext.Provider value={router as never}><PathnameContext.Provider value="/overview"><SearchParamsContext.Provider value={new URLSearchParams() as never}>
  <IdiomaProvider idioma={idioma}><OnboardingRaiz datos={{pista:null,userId:YO,tenantId:'t',organizacion:'Org',rolEtiqueta:'x',rol}}>{hijo}</OnboardingRaiz></IdiomaProvider>
 </SearchParamsContext.Provider></PathnameContext.Provider></AppRouterContext.Provider>);

test('el Hoy por rol no consulta ningún endpoint de dinero (solo owner y analyst) ni usa el estado «sin acceso»',()=>{
  const src=leer('src/components/hoy/hoy-rol.tsx').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
  for(const prohibido of ['/api/refunds','/api/workload','/cfo/data','endpointFuga','sin_acceso','hoy.sinAcceso','armarHoy'])assert.ok(!src.includes(prohibido),prohibido);
  const usados=[...src.matchAll(/useJson<[^>]*>\('([^']+)'/g)].map(m=>m[1]).sort();
  assert.deepEqual(usados,['/api/interventions','/api/problems'],'solo lecturas de los cuatro roles');
});
test('la página de Hoy elige por rol y la pantalla completa (con los tres endpoints de dinero) no se monta para operador ni lector',()=>{
  assert.match(leer('src/app/(app)/(workspace)/overview/page.tsx'),/<HoyPorRol completa=\{<HoyPantalla\/>\}\/>/);
  const sentinela=createElement('p',{id:'completa'},'cifras');
  for(const rol of ['operator','viewer'])assert.ok(!envolver(rol,createElement(HoyPorRol,{completa:sentinela})).includes('id="completa"'),rol);
  for(const rol of ['owner','analyst',undefined])assert.ok(envolver(rol,createElement(HoyPorRol,{completa:sentinela})).includes('id="completa"'),String(rol));
});
test('operador: sus intervenciones asignadas, recomendaciones y problemas; lector: problemas con evidencia redactada y Confianza; ninguno con botón de escritura',()=>{
  const op=envolver('operator',createElement(HoyRol,{rol:'operator'}));
  assert.match(op,/data-rol="operator"/);assert.ok(op.includes(es['hoy.rol.intervencionesTitulo'])&&op.includes(es['hoy.rol.recomendacionesTitulo'])&&op.includes(es['hoy.rol.problemasTitulo']));
  assert.ok(!op.includes(es['hoy.sinAcceso']));assert.doesNotMatch(op,/<button/);
  const le=envolver('viewer',createElement(HoyRol,{rol:'viewer'}));
  assert.match(le,/data-rol="viewer"/);assert.ok(le.includes(es['hoy.rol.problemasTitulo'])&&le.includes(es['hoy.rol.confianzaTitulo']));
  assert.ok(!le.includes(es['hoy.rol.intervencionesTitulo'])&&!le.includes(es['hoy.rol.recomendacionesTitulo']));assert.ok(!le.includes(es['hoy.sinAcceso']));assert.doesNotMatch(le,/<button/);
  assert.ok(envolver('viewer',createElement(HoyRol,{rol:'viewer'}),'en').includes(en['hoy.rol.problemasLector']));
});
test('aceptarProblemas: solo problemas activos, ordenados por conversaciones; una forma rara se rechaza entera',()=>{
  const ok=aceptarProblemas({problems:[{id:ID,label:'B',state:'active',conversationIds:['a'],conversationCount:2},{id:ID.replace('1111','2222'),label:'A',state:'active',conversationIds:[]},{id:ID.replace('1111','3333'),label:'viejo',state:'retired',conversationIds:[]}]});
  assert.deepEqual(ok?.map(p=>p.label),['B','A']);
  assert.equal(aceptarProblemas({problems:[{id:'no-uuid',label:'x',state:'active'}]}),null);assert.equal(aceptarProblemas({}),null);assert.equal(aceptarProblemas(null),null);
});
test('aceptarIntervenciones: solo las abiertas cuyo responsable es la persona (el servidor exige lo mismo para ejecutar)',()=>{
  const items=[{id:'1',title:'mía',status:'active',ownerId:YO},{id:'2',title:'ajena',status:'active',ownerId:'otro'},{id:'3',title:'cerrada',status:'closed',ownerId:YO},{id:'4',title:'cancelada',status:'cancelled',ownerId:YO}];
  assert.deepEqual(aceptarIntervenciones({data:{items}},YO)?.map(i=>i.title),['mía']);
  assert.deepEqual(aceptarIntervenciones({data:{items}},''),[],'sin usuario no se asigna nada');
  assert.equal(aceptarIntervenciones({data:{}},YO),null);assert.equal(aceptarIntervenciones({data:{items:[null]}},YO),null);
});
test('textos del Hoy por rol: mismas claves en es y en, sin prometer escritura ni cifras de dinero',()=>{
  const claves=Object.keys(es).filter(k=>k.startsWith('hoy.rol.'));assert.ok(claves.length>=15);
  for(const k of claves){assert.ok(k in en,k);assert.ok(!/\d/.test(es[k as keyof typeof es]),k);}
  assert.match(es['hoy.rol.sinIntervenciones'],/propietario/);assert.match(en['hoy.rol.sinIntervenciones'],/owner/);
});
