// Onboarding F4: pantalla /setup (Configuración). Solo lectura, estado honesto por rol, sin cifras inventadas.
// Sin DOM en este entorno: el comportamiento se prueba en la lógica pura (asistente.mjs) y en el marcado renderizado por rol con datos simulados;
// el foco real, axe y el render en navegador quedan para F5.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {PathnameContext,SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import {CATALOGO,pasosDe,ROL_DE_PISTA,rolTieneCapacidad,problemasDePaso,CLAVES_SETUP,clavesDePista} from '../src/lib/onboarding/catalogo.mjs';
import {ASISTENTE,calcularAsistente,datosHojaSoporte,indicadorConciliacion,nombreCredencial} from '../src/lib/onboarding/asistente.mjs';
import {normalizarSenales} from '../src/lib/onboarding/prerrequisitos.mjs';
import {consultaDeSenales,SENALES_SETUP_POR_ROL,SENALES_POR_ROL} from '../src/lib/onboarding/senales-sql.mjs';
import {menuVisible,ROLES_DINERO} from '../src/lib/workspace/menu.mjs';
import {SetupVista,textoHoja,IndicadorConciliacion} from '../src/components/onboarding/setup-piezas';
import {aceptarSetup,aceptarPush} from '../src/components/onboarding/setup-pantalla';
import {OnboardingRaiz} from '../src/components/onboarding/contexto';
import {IdiomaProvider} from '../src/components/i18n/proveedor';
import {traductor} from '../src/lib/i18n';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import type {Pista} from '../src/lib/onboarding/catalogo.mjs';

const leer=(rel:string)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const ESP=es as Record<string,string>,ING=en as Record<string,string>;
const TENANT='11111111-2222-4333-8444-555555555555';
const router={push(){},replace(){},back(){},forward(){},refresh(){},prefetch(){}};
const TODO_FALSO={conexion_activa:false,conexion_con_problema:false,historial_importado:false,corte_publicado:false,equipo_invitado:false,accion_propuesta:false,hay_intervenciones:false,resultado_registrado:false,pedidos_cargados:false,pedidos_ligados:false};
const ROL:Record<string,string>={propietario:'owner',analista:'analyst',operador:'operator',lector:'viewer'};
const ETIQUETA:Record<string,string>={propietario:'Administrador del espacio',analista:'Analista',operador:'Operador',lector:'Lectura'};
const consultadasDe=(rol:string)=>[...(SENALES_SETUP_POR_ROL[rol]??[])];
const envolver=(pistaProv:Pista|null,hijo:React.ReactNode,idioma:'es'|'en'='es')=>renderToStaticMarkup(
 <AppRouterContext.Provider value={router as never}><PathnameContext.Provider value="/setup"><SearchParamsContext.Provider value={new URLSearchParams() as never}>
  <IdiomaProvider idioma={idioma}><OnboardingRaiz datos={{pista:pistaProv,userId:'u',tenantId:TENANT,organizacion:'Org',rolEtiqueta:'x',rol:'owner'}}>{hijo}</OnboardingRaiz></IdiomaProvider>
 </SearchParamsContext.Provider></PathnameContext.Provider></AppRouterContext.Provider>);
type Ctx=Parameters<typeof calcularAsistente>[1];
/** Pantalla completa de una pista con datos simulados. */
function vista(pista:Pista,ctx:Ctx,{idioma='es',conc=null,soporte=false}:{idioma?:'es'|'en';conc?:ReturnType<typeof indicadorConciliacion>|null;soporte?:boolean}={}){
 const t=traductor(idioma),lista=['propietario','analista','operador','lector'].includes(pista)?calcularAsistente(pista,ctx):null;
 const hoja=pista==='propietario'?datosHojaSoporte({tenantId:TENANT,organizacion:'Org'}):null;
 return envolver(soporte?'soporte':pista,<SetupVista t={t} locale={idioma==='es'?'es-MX':'en-US'} pista={soporte?'soporte':pista} rolEtiqueta={ETIQUETA[pista]??''} soporteTerminado={false} cargando={false} errorDeLectura={false} lista={lista} conciliacion={conc} fechaResumen={null} hoja={hoja}/>,idioma);
}
const hrefs=(html:string)=>[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
const SENALES_PILOTO=normalizarSenales({...TODO_FALSO,conexion_activa:true,historial_importado:true,corte_publicado:true,pedidos_cargados:true,equipo_invitado:false});

// ---- El asistente sale del catálogo (no hay lista paralela)
test('cada paso del asistente existe en el catálogo y es válido para su pista: capacidad real, href en el menú del rol',()=>{
  const ids=new Set(CATALOGO.map(p=>p.id));
  for(const [pista,entradas] of Object.entries(ASISTENTE)){
    for(const e of entradas){
      assert.ok(ids.has(e.id),e.id);
      const paso=CATALOGO.find(p=>p.id===e.id)!;
      // Un paso de OTRO rol (p. ej. «propietario.crm» en la lista del analista) se muestra sin enlace; solo se valida con el rol dueño del paso.
      assert.deepEqual(problemasDePaso(paso,menuVisible),[],e.id);
      assert.ok(Number.isInteger(e.min)&&e.min>0,e.id+' trae tiempo estimado');
    }
    assert.equal(new Set(entradas.map(e=>e.id)).size,entradas.length,pista+' sin ids repetidos');
  }
  for(const p of CATALOGO.filter(x=>x.superficie==='setup'))assert.ok(Object.values(ASISTENTE).flat().some(e=>e.id===p.id),'paso de setup sin lugar en el asistente: '+p.id);
});
test('los pasos de setup no cuentan en el tour (máx. 5) ni en el checklist (máx. 4) y no inflan el recorrido',()=>{
  for(const pista of ['propietario','analista','operador','lector'] as const){assert.ok(pasosDe(pista,'tour').length<=5,pista);assert.ok(pasosDe(pista,'checklist').length<=4,pista);}
  assert.ok(pasosDe('soporte').every(p=>p.superficie!=='setup'),'soporte no tiene pasos de setup');
});
test('ningún paso del asistente es accionable para un rol sin la capacidad: estado «otro», sin cuenta, y la lista dice a quién pedirlo',()=>{
  for(const [pista,entradas] of Object.entries(ASISTENTE)){
    const rol=ROL_DE_PISTA[pista as Pista]!;
    const lista=calcularAsistente(pista as Pista,{senales:normalizarSenales(TODO_FALSO),consultadas:consultadasDe(rol),push:{configurado:true,dispositivos:0}});
    for(const i of lista.items){
      const paso=CATALOGO.find(p=>p.id===i.id)!;
      assert.equal(i.puede,rolTieneCapacidad(rol,paso.accion)&&!paso.espera,i.id);
      if(!i.puede){assert.equal(i.estado,'otro',i.id);assert.equal(i.cuenta,false,i.id);assert.notEqual(lista.siguiente,i.id);assert.ok(i.quien.length>0&&!i.quien.includes(rol as never),i.id+' dice a quién pedirlo');}
      assert.deepEqual(i.puede?[]:problemasDePaso(paso,menuVisible).length?['x']:[],[],i.id);
    }
    assert.equal(entradas.length,lista.items.length);
  }
});

// ---- Propietario con datos simulados (PILOTO: 0 enlaces pedido-cliente)
test('propietario: estados honestos con datos de PILOTO (conexión activa, historial, pedidos y corte cargados, 0 pedidos ligados, correo sin configurar, push sin configurar)',()=>{
  const l=calcularAsistente('propietario',{senales:SENALES_PILOTO,consultadas:consultadasDe('owner'),push:{configurado:false,dispositivos:0}});
  const por=Object.fromEntries(l.items.map(i=>[i.id.split('.')[1],i]));
  assert.equal(por.idioma.estado,'informativo');
  assert.equal(por.crm.estado,'hecho');assert.equal(por.crm.cuenta,false,'el CRM es de un tercero: no cuenta');assert.equal(por.crm.mixto,true);
  assert.equal(por.historial.estado,'hecho');assert.equal(por.pedidos.estado,'hecho');
  assert.equal(por.dimensiones.estado,'informativo','no hay forma barata de saberlo: nunca «hecho»');
  assert.equal(por.conciliar.estado,'pendiente');assert.equal(por.conciliar.cuenta,true);
  assert.equal(por.corte.estado,'salvedad');
  assert.equal(por.equipo.estado,'esperando');assert.equal(por.equipo.esperaA,'onb.tercero.correo');assert.equal(por.equipo.cuenta,false);
  assert.equal(por.avisos.estado,'esperando');assert.equal(por.avisos.esperaA,'onb.tercero.push');assert.equal(por.avisos.cuenta,false);
  assert.equal(por.mfa,undefined,'no hay paso de verificación en dos pasos: no se promete ni se simula');
  assert.equal(por.retencion.estado,'informativo');
  assert.equal(l.siguiente,'propietario.conciliar','el siguiente es el primer paso propio pendiente; nunca uno de tercero');
  assert.deepEqual(l.progreso,{hechos:3,total:4},'cuentan historial, pedidos, conciliar y corte (3 de 4 hechos, el corte con salvedad); nada de terceros ni informativos');
});
test('propietario: el push solo se ofrece (pendiente y con enlace) si el servidor dice configured=true; con dispositivos queda hecho',()=>{
  const base={senales:SENALES_PILOTO,consultadas:consultadasDe('owner')};
  const av=(push:Ctx extends infer C?C extends {push?:infer P}?P:never:never)=>calcularAsistente('propietario',{...base,push}).items.find(i=>i.id==='propietario.avisos')!;
  assert.equal(av({configurado:false,dispositivos:0}).estado,'esperando');
  assert.equal(av({configurado:true,dispositivos:0}).estado,'pendiente');
  assert.equal(av({configurado:true,dispositivos:0}).cuenta,true);
  assert.equal(av({configurado:true,dispositivos:2}).estado,'hecho');
  assert.equal(av({configurado:null,dispositivos:null}).estado,'desconocido','si no se pudo leer, no se inventa nada');
  assert.equal(calcularAsistente('propietario',{...base,push:null}).items.find(i=>i.id==='propietario.avisos')!.estado,'desconocido');
});
test('CRM: pendiente → esperando al equipo de Rovaq (tercero); sin señales → «no se pudo comprobar»; nunca «hecho» inventado',()=>{
  const sin=calcularAsistente('propietario',{senales:normalizarSenales(TODO_FALSO),consultadas:consultadasDe('owner')}).items.find(i=>i.id==='propietario.crm')!;
  assert.equal(sin.estado,'esperando');assert.equal(sin.esperaA,'onb.tercero.crm');assert.equal(sin.cuenta,false);
  const nada=calcularAsistente('propietario',{senales:null,consultadas:[]});
  for(const i of nada.items.filter(x=>CATALOGO.find(p=>p.id===x.id)!.prerrequisito))assert.equal(i.estado,'desconocido',i.id);
  assert.equal(nada.siguiente,null);assert.deepEqual(nada.progreso,{hechos:0,total:0});
});
test('propietario con la organización vacía: ningún paso aparece como hecho y el corte está bloqueado',()=>{
  const l=calcularAsistente('propietario',{senales:normalizarSenales(TODO_FALSO),consultadas:consultadasDe('owner'),push:{configurado:true,dispositivos:0}});
  const por=Object.fromEntries(l.items.map(i=>[i.id.split('.')[1],i]));
  for(const k of ['historial','pedidos','conciliar','corte'])assert.ok(!['hecho','salvedad'].includes(por[k].estado),k);
  assert.equal(por.corte.estado,'bloqueado');assert.equal(l.siguiente,'propietario.historial');assert.equal(l.progreso.hechos,0);
});
test('hay pedidos ligados: «hecho con salvedad», jamás «hecho», porque la cobertura completa no se mide',()=>{
  const l=calcularAsistente('propietario',{senales:normalizarSenales({...TODO_FALSO,pedidos_cargados:true,pedidos_ligados:true}),consultadas:consultadasDe('owner')});
  const c=l.items.find(i=>i.id==='propietario.conciliar')!;
  assert.equal(c.estado,'salvedad');assert.equal(c.nota,'onb.setup.conc.salvedad');
});

// ---- Pistas de otros roles
test('analista: lo del propietario se ve como «lo hace otra persona» y sin enlace; el corte espera al propietario; el avance solo cuenta lo suyo',()=>{
  const l=calcularAsistente('analista',{senales:normalizarSenales({...TODO_FALSO,historial_importado:true}),consultadas:consultadasDe('analyst'),push:{configurado:true,dispositivos:0}});
  const por=Object.fromEntries(l.items.map(i=>[i.id,i]));
  for(const id of ['propietario.crm','propietario.pedidos','propietario.dimensiones','propietario.conciliar']){assert.equal(por[id].estado,'otro',id);assert.equal(por[id].puede,false,id);}
  assert.equal(por['analista.importar'].estado,'hecho');assert.equal(por['analista.corte'].estado,'otro','publicar es del propietario: el analista no tiene aquí nada que hacer');assert.equal(por['analista.corte'].puede,false);assert.deepEqual(por['analista.corte'].quien,['owner']);
  assert.equal(por['analista.avisos'].estado,'pendiente');assert.equal(l.siguiente,'analista.avisos');
});
test('operador y lector: sin señales de dinero; lector sin ningún paso de escritura de la organización',()=>{
  const op=calcularAsistente('operador',{senales:normalizarSenales(TODO_FALSO),consultadas:consultadasDe('operator'),push:{configurado:true,dispositivos:0}});
  assert.deepEqual(op.items.map(i=>i.id),['operador.idioma','operador.avisos','operador.propuesta','operador.resultado']);
  assert.equal(op.items.find(i=>i.id==='operador.resultado')!.estado,'bloqueado');
  const le=calcularAsistente('lector',{senales:null,consultadas:[],push:{configurado:true,dispositivos:0}});
  assert.deepEqual(le.items.map(i=>i.id),['lector.idioma','lector.avisos']);
  for(const i of le.items)assert.ok(['read','notify'].includes(i.accion),i.id);
});
test('una señal que el servidor no consultó para el rol nunca se toma por «falso»: queda «no se pudo comprobar»',()=>{
  const l=calcularAsistente('analista',{senales:normalizarSenales(TODO_FALSO),consultadas:['corte_publicado']});
  assert.equal(l.items.find(i=>i.id==='analista.importar')!.estado,'desconocido');
});

// ---- Marcado por rol (ES y EN)
for(const idioma of ['es','en'] as const){
  const dic=idioma==='es'?ESP:ING;
  test(`propietario (${idioma}): lista ordenada accesible, estado de cada paso, tiempo, qué se pide, quién, enlace «Ir a hacerlo», hoja para soporte y sin «Probar ahora»`,()=>{
    const ctx={senales:SENALES_PILOTO,consultadas:consultadasDe('owner'),push:{configurado:true,dispositivos:0}};
    const html=vista('propietario',ctx,{idioma,conc:indicadorConciliacion({pedidos:85000,resumen:'ready',refreshedAt:'2026-10-27T10:00:00Z',ligadas:false})});
    assert.match(html,/<ol class="setup-lista" aria-label="/);
    const n=ASISTENTE.propietario.length;
    assert.equal((html.match(/<li class="setup-paso"/g)??[]).length,n);
    assert.equal((html.match(/<h3 id="setup-paso-\d+">/g)??[]).length,n,'un h3 por paso, enlazado con aria-labelledby');
    assert.equal((html.match(/aria-labelledby="setup-paso-\d+"/g)??[]).length,n);
    assert.ok(html.includes(dic['onb.setup.irAHacerlo']));
    assert.ok(html.includes(dic['onb.setup.pide']));
    assert.match(html,idioma==='es'?/Unos 15 min/:/About 15 min/);
    assert.ok(html.includes(dic['onb.setup.hoja.boton']));
    assert.doesNotMatch(html,/Probar ahora|Test now|Try now|Probar conexión|Test connection/i);
    assert.match(html,/<progress max="5" value="3" aria-label=/);
    assert.ok(html.includes(dic['onb.check.siguiente']));
    for(const h of ['/connections','/imports','/economics','/settings/team','/settings/notifications','/settings/retention'])assert.ok(hrefs(html).includes(h),h);
    assert.equal(hrefs(html).filter(h=>h==='/economics').length,4,'pedidos, dimensiones, conciliar y corte');
  });
  test(`analista (${idioma}): ningún enlace a pantallas que no puede usar; los pasos del propietario dicen a quién pedirlos`,()=>{
    const html=vista('analista',{senales:normalizarSenales({...TODO_FALSO,historial_importado:true}),consultadas:consultadasDe('analyst'),push:{configurado:true,dispositivos:0}},{idioma,conc:indicadorConciliacion({pedidos:10,resumen:'ready',refreshedAt:'2026-10-27T10:00:00Z',ligadas:false})});
    const h=hrefs(html);
    for(const prohibido of ['/connections','/settings/team','/settings/retention','/settings/notification-delivery'])assert.ok(!h.includes(prohibido),prohibido);
    assert.ok(!html.includes(dic['onb.setup.hoja.boton']),'la hoja para soporte es del propietario');
    // /economics: el analista no tiene ningún paso propio ahí (publicar y cargar pedidos son del propietario); no hay enlace.
    assert.ok(!h.includes('/economics'),'sin enlace a Cortes publicados desde un paso que no es suyo');
    assert.ok(h.includes('/imports')&&h.includes('/settings/notifications'));
    assert.ok(html.includes(dic['onb.setup.estado.otro']));
    assert.ok(html.includes(traductor(idioma)('onb.setup.noPuedes',{quien:idioma==='es'?'Administrador del espacio':'Workspace administrator'})));
  });
  test(`operador (${idioma}) y lector (${idioma}): solo enlaces a lo suyo, sin hoja ni indicador de dinero`,()=>{
    for(const pista of ['operador','lector'] as const){
      const html=vista(pista,{senales:normalizarSenales(TODO_FALSO),consultadas:consultadasDe(ROL[pista]),push:{configurado:false,dispositivos:0}},{idioma});
      const permitidos=pista==='operador'?['/settings/notifications','/recommendations','/interventions']:['/settings/notifications'];
      for(const h of hrefs(html))assert.ok(permitidos.includes(h),`${pista} no debe tener enlace a ${h}`);
      assert.ok(!html.includes(dic['onb.setup.hoja.boton'])&&!html.includes(dic['onb.setup.conc.titulo']),pista);
      assert.doesNotMatch(html,/class="setup-conc"/);
    }
    assert.ok(vista('lector',{senales:null,consultadas:[],push:null},{idioma}).includes(dic['onb.setup.lector']));
  });
}
test('soporte («Ver como») y vistas sin pista: solo un aviso, cero pasos, cero enlaces, cero botones',()=>{
  const sop=vista('propietario',{senales:SENALES_PILOTO,consultadas:consultadasDe('owner')},{soporte:true});
  assert.doesNotMatch(sop,/<ol|setup-paso|<progress|<button|<a /);
  assert.ok(sop.includes(ESP['onb.setup.soporte']));
  const sinPista=envolver(null,<SetupVista t={traductor('es')} locale="es-MX" pista={null} rolEtiqueta="" soporteTerminado={false} cargando={false} errorDeLectura={false} lista={null} conciliacion={null} fechaResumen={null} hoja={null}/>);
  assert.ok(sinPista.includes(ESP['onb.setup.sinPista']));assert.doesNotMatch(sinPista,/<ol|<button/);
  const plataforma=vista('plataforma',{});assert.ok(plataforma.includes(ESP['onb.setup.sinPista'])||!/<ol/.test(plataforma));
});
test('sin estilos en línea ni roles/tabindex ajenos en el marcado y en los componentes nuevos',()=>{
  const html=vista('propietario',{senales:SENALES_PILOTO,consultadas:consultadasDe('owner'),push:{configurado:true,dispositivos:0}});
  assert.doesNotMatch(html,/\sstyle=|role="button"|tabindex="[1-9]/);
  for(const f of ['src/components/onboarding/setup-piezas.tsx','src/components/onboarding/setup-pantalla.tsx','src/app/(app)/(workspace)/setup/page.tsx'])assert.doesNotMatch(leer(f),/style=\{|\sstyle="/,f);
  assert.doesNotMatch(leer('src/components/onboarding/setup.css'),/!important/);
  // Todo lo que se puede activar es un enlace, un botón o un resumen nativo (teclado gratis): no hay onClick en div, li ni span.
  assert.doesNotMatch(leer('src/components/onboarding/setup-piezas.tsx'),/<(div|li|span|p)[^>]*onClick/);
});
test('CSS de /setup: objetivos táctiles de 40 px, foco visible de 3 px, móvil de una columna y alto contraste forzado',()=>{
  const css=leer('src/components/onboarding/setup.css');
  assert.match(css,/min-height:40px/);assert.match(css,/outline:3px solid var\(--onb-resalte\)/);assert.match(css,/@media \(max-width:767px\)/);assert.match(css,/forced-colors:active/);
});

// ---- Indicador de conciliación: honesto
test('conciliación: PILOTO (85 mil pedidos del libro, 0 enlaces) → «0 de N pedidos ligados» con su base; nunca un porcentaje',()=>{
  const c=indicadorConciliacion({pedidos:85357,resumen:'ready',refreshedAt:'2026-10-27T10:00:00Z',ligadas:false});
  assert.deepEqual({tipo:c.tipo,ligados:c.ligados,total:c.total},{tipo:'base',ligados:0,total:85357});
  for(const idioma of ['es','en'] as const){
    const html=renderToStaticMarkup(<IndicadorConciliacion t={traductor(idioma)} c={c} fecha="27 oct 2026" formato={n=>new Intl.NumberFormat(idioma==='es'?'es-MX':'en-US').format(n)}/>);
    assert.ok(html.includes(idioma==='es'?'0 de 85,357 pedidos relacionados con un cliente':'0 of 85,357 orders matched to a customer'),html);
    assert.doesNotMatch(html,/%/);assert.ok(html.includes(traductor(idioma)('onb.setup.conc.pendiente')));
  }
});
test('conciliación: con vínculos no se inventa el conteo; sin resumen o sin pedidos o con dato roto, «pendiente» sin cifra de ligados',()=>{
  assert.deepEqual(indicadorConciliacion({pedidos:100,resumen:'ready',refreshedAt:'x',ligadas:true}),{tipo:'hay_ligas',ligados:null,total:100,fecha:'x'});
  assert.equal(indicadorConciliacion({pedidos:0,resumen:'ready',refreshedAt:'x',ligadas:false}).tipo,'sin_pedidos');
  for(const resumen of ['absent','unavailable','timeout','no_aplica'])assert.deepEqual(indicadorConciliacion({pedidos:50,resumen,refreshedAt:'x',ligadas:false}),{tipo:'sin_resumen',ligados:null,total:null,fecha:null},resumen);
  assert.equal(indicadorConciliacion({pedidos:null,resumen:'ready',refreshedAt:null,ligadas:false}).tipo,'pendiente');
  assert.equal(indicadorConciliacion({pedidos:-3,resumen:'ready',refreshedAt:null,ligadas:false}).tipo,'pendiente');
  assert.equal(indicadorConciliacion({pedidos:20,resumen:'ready',refreshedAt:null,ligadas:null}).tipo,'pendiente','si no se sabe si hay ligas, sin cifra');
  assert.equal(indicadorConciliacion(null).tipo,'sin_resumen');
  const html=renderToStaticMarkup(<IndicadorConciliacion t={traductor('es')} c={indicadorConciliacion({pedidos:50,resumen:'timeout',refreshedAt:null,ligadas:false})} fecha={null} formato={String}/>);
  assert.doesNotMatch(html.replace(/<[^>]+>/g,''),/\d/,'sin cifra visible');
});
test('el indicador solo se arma para propietario y analista (como el dinero de Hoy)',()=>{
  assert.deepEqual([...ROLES_DINERO],['owner','analyst']);
  const src=leer('src/lib/onboarding/setup-servidor.ts');assert.match(src,/ROLES_DINERO=\['owner','analyst'\]/);
  assert.match(leer('src/components/onboarding/setup-pantalla.tsx'),/verDinero=pista==='propietario'\|\|pista==='analista'/);
});

// ---- Hoja para soporte
test('hoja para soporte: proveedor, organización, id de cuenta (pendiente), nombre de credencial sugerido y permisos mínimos; sin secretos',()=>{
  const h=datosHojaSoporte({tenantId:TENANT,organizacion:'Org'});
  assert.equal(h.proveedor,'HubSpot');assert.equal(h.credencial,'hubspot-11111111');assert.equal(nombreCredencial(TENANT),'hubspot-11111111');
  assert.deepEqual(h.permisos,['conversations.read']);assert.ok(h.opcionales.includes('crm.objects.tickets.read')&&h.opcionales.includes('crm.objects.contacts.read'));
  for(const idioma of ['es','en'] as const){
    const txt=textoHoja(traductor(idioma),h);
    for(const parte of ['HubSpot',TENANT,'hubspot-11111111','conversations.read','Org'])assert.ok(txt.includes(parte),parte);
    assert.ok(txt.includes(traductor(idioma)('onb.setup.hoja.cuentaPendiente')));
    assert.doesNotMatch(txt,/token\s*[:=]\s*\S|secret\s*[:=]|password|contraseña\s*[:=]/i);
  }
  assert.equal(nombreCredencial(''),'hubspot-cuenta');
});
test('los permisos de la hoja coinciden con lo que el adaptador de HubSpot exige',()=>{
  const src=leer('../../packages/connectors/hubspot.mjs');
  assert.match(src,/scopes\.includes\('conversations\.read'\)/);assert.match(src,/crm\.objects\.tickets\.read/);assert.match(src,/crm\.objects\.contacts\.read/);
});

// ---- Consulta y endpoint
test('señales de /setup: solo EXISTS acotados al tenant; sin count(distinct), sin conteo del libro; el lector no consulta nada',()=>{
  for(const rol of ['owner','analyst','operator']){
    const q=consultaDeSenales(rol,SENALES_SETUP_POR_ROL)!;assert.ok(q,rol);
    assert.equal((q.texto.match(/^SELECT /g)??[]).length,1);
    assert.doesNotMatch(q.texto,/count\(\s*distinct|count\(\*\)\s+FROM public\.economic|GROUP BY|JOIN/i);
    for(const m of q.texto.matchAll(/FROM public\.\w+ WHERE ([^)]*)/g))assert.match(m[1],/^tenant_id=\$1/);
    assert.doesNotMatch(q.texto,/\$2/);
  }
  assert.equal(consultaDeSenales('viewer',SENALES_SETUP_POR_ROL),null);
  assert.match(consultaDeSenales('owner',SENALES_SETUP_POR_ROL)!.texto,/EXISTS\(SELECT 1 FROM public\.economic_ledger_entries WHERE tenant_id=\$1 AND kind='order'\)/);
  assert.match(consultaDeSenales('owner',SENALES_SETUP_POR_ROL)!.texto,/EXISTS\(SELECT 1 FROM public\.economic_order_customers WHERE tenant_id=\$1 AND customer_key IS NOT NULL\)/);
  assert.doesNotMatch(consultaDeSenales('operator',SENALES_SETUP_POR_ROL)!.texto,/economic_/);
  assert.doesNotMatch(consultaDeSenales('owner')!.texto,/economic_/,'el checklist de Hoy no cambió: sigue sin tocar el libro');
  assert.ok(SENALES_POR_ROL.owner.every(k=>SENALES_SETUP_POR_ROL.owner.includes(k)));
});
test('endpoint /api/onboarding/setup: solo GET, una transacción de lectura, total de pedidos de un resumen precalculado y no del libro',()=>{
  const src=leer('src/lib/onboarding/setup-servidor.ts');
  assert.match(src,/transaction\('read'/);assert.equal((src.match(/transaction\(/g)??[]).length,1);assert.match(src,/unsupported_filter/);
  assert.doesNotMatch(src,/INSERT|UPDATE|DELETE|transaction\('(import|configure|propose|approve|execute|retain)'/);
  assert.match(src,/FROM public\.economic_ledger_counts WHERE tenant_id=\$1 AND kind='order'/);
  assert.doesNotMatch(src,/economic_ledger_entries|count\(\s*distinct/i,'el libro nunca se cuenta en esta ruta');
  const ruta=leer('src/app/api/onboarding/setup/route.ts');assert.match(ruta,/export const GET=/);assert.doesNotMatch(ruta,/export const (POST|PUT|PATCH|DELETE)/);
});
test('aceptarSetup y aceptarPush rechazan formas inesperadas enteras',()=>{
  assert.equal(aceptarSetup({}),null);assert.equal(aceptarSetup({data:{rol:'owner'}}),null);assert.equal(aceptarSetup(null),null);
  const ok=aceptarSetup({data:{rol:'owner',senales:{pedidos_cargados:true,x:'true'},consultadas:['a',3],conciliacion:{resumen:'ready',pedidos:5,refreshedAt:'2026-10-27T00:00:00.000Z'}}})!;
  assert.deepEqual(ok.senales,{pedidos_cargados:true,x:false});assert.deepEqual(ok.consultadas,['a']);assert.equal(ok.conciliacion.pedidos,5);
  assert.equal(aceptarPush({data:{configured:'yes',devices:[]}}),null);assert.equal(aceptarPush({data:{configured:true}}),null);
  assert.deepEqual(aceptarPush({data:{configured:true,devices:[{},{}]}}),{configured:true,devices:2});
});

// ---- Textos: sin cifras ni promesas
const NUEVAS=[...new Set([...CLAVES_SETUP,'onb.tercero.push',...CATALOGO.filter(p=>p.superficie==='setup').flatMap(p=>[p.textos.titulo,p.textos.cuerpo])])];
test('claves de /setup: existen en es y en con las mismas {variables}; las de interfaz tienen su lugar en CLAVES_SETUP',()=>{
  const vars=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
  assert.ok(NUEVAS.length>=50);
  for(const k of NUEVAS){assert.ok(ESP[k]?.trim(),'falta en es: '+k);assert.ok(ING[k]?.trim(),'falta en en: '+k);assert.equal(vars(ESP[k]),vars(ING[k]),k);}
  const setup=Object.keys(ESP).filter(k=>k.startsWith('onb.setup.'));assert.deepEqual(setup.filter(k=>!CLAVES_SETUP.includes(k)),[]);
  for(const pista of ['propietario','analista','operador','lector'] as const)for(const k of clavesDePista(pista))assert.ok(ESP[k]&&ING[k],k);
});
test('textos de /setup: sin cifras, porcentajes, RLS, respaldos, SLA, certificaciones ni pruebas cruzadas (los números entran por {variable})',()=>{
  const prohibido=/\d|%|\bRLS\b|SOC\s?2|ISO\s?27|respaldo|backup|\bSLA\b|pruebas cruzadas|certific|cross-tenant/i;
  for(const k of NUEVAS)for(const [idioma,dic] of [['es',ESP],['en',ING]] as const)assert.doesNotMatch(dic[k],prohibido,`${idioma}:${k}`);
});
test('textos de /setup: ninguna promesa de MFA, push, Zendesk ni Google, y ninguna frase de «hoja de ruta»; push solo si el servidor lo permite',()=>{
  for(const k of NUEVAS)for(const dic of [ESP,ING])assert.doesNotMatch(dic[k],/zendesk|google|oauth/i,k);
  for(const k of Object.keys(ESP).filter(x=>/^onb\./.test(x)))assert.doesNotMatch(ESP[k]+' '+ING[k],/hoja de ruta|roadmap|próximamente|coming soon|segundo factor|second[- ]factor|dos pasos|two-step|\bMFA\b/i,k);
  assert.equal(ESP['onb.propietario.mfa.titulo'],undefined);assert.equal(ING['onb.propietario.mfa.cuerpo'],undefined);
  assert.ok(!CATALOGO.some(p=>p.id==='propietario.mfa'),'el paso de MFA se quitó del catálogo');
  assert.match(ESP['onb.propietario.avisos.cuerpo'],/si están disponibles/);assert.match(ING['onb.propietario.avisos.cuerpo'],/if available/);
  assert.match(ESP['onb.propietario.crm.cuerpo'],/equipo de Rovaq/);assert.match(ESP['onb.propietario.crm.cuerpo'],/nunca se escribe/);
  for(const k of Object.keys(ESP).filter(x=>/^onb\.setup\.hoja\./.test(x)))assert.doesNotMatch(ESP[k]+ING[k],/probar ahora|test now|try now/i);
});

test('jerga fuera del recorrido y de /setup: sin «sello de procedencia», «ligados», «conciliar», «salvedad», «libro», «ledger», «token», «credencial» ni «servidor» en los textos que lee el cliente',()=>{
  const prohibido=/sello de procedencia|provenance|ligad|conciliar|conciliaci|reconcil|libro de pedidos|\bledger\b|\btoken\b|credencial|credential|servidor|\bserver\b|mapear dimensiones|map dimensions/i;
  const claves=Object.keys(ESP).filter(k=>/^onb\.(pant|tour|setup|check|propietario|analista|operador|lector|plataforma|tercero|soporte)\./.test(k));
  assert.ok(claves.length>150);
  // «salvedad» sigue existiendo como nombre de la etiqueta de la pantalla CCO (cco.estado.*), que el recorrido describe; no como texto propio del onboarding.
  for(const k of claves)for(const [idioma,dic] of [['es',ESP],['en',ING]] as const)assert.doesNotMatch(dic[k].replace(/\{\w+\}/g,''),prohibido,`${idioma}:${k}`);
  for(const k of claves.filter(x=>!/^onb\.pant\.cco\./.test(x)))for(const dic of [ESP,ING])assert.doesNotMatch(dic[k],/salvedad|caveat/i,k);
});
test('hoja para soporte: la organización va por su nombre y el identificador técnico va rotulado como dato para soporte',()=>{
  const h=datosHojaSoporte({tenantId:TENANT,organizacion:'Org'});
  for(const idioma of ['es','en'] as const){
    const txt=textoHoja(traductor(idioma),h),lineas=txt.split('\n');
    const t=traductor(idioma);
    assert.ok(lineas.includes(`${t('onb.setup.hoja.organizacion')}: Org`),'la línea de la organización no lleva el UUID');
    assert.ok(lineas.includes(`${t('onb.setup.hoja.idTecnico')}: ${TENANT}`));
    assert.match(t('onb.setup.hoja.idTecnico'),idioma==='es'?/soporte/:/support/);
    assert.ok(!lineas.some(l=>l.startsWith(t('onb.setup.hoja.organizacion'))&&l.includes(TENANT)));
  }
});

// ---- Entradas: menú, Hoy, Guía y /confianza
test('menú por rol: «Configuración» (/setup) visible para los cuatro roles, derivado de la capacidad read; Ver como (rol lector) lo ve',()=>{
  for(const rol of ['owner','analyst','operator','viewer'])assert.ok(menuVisible({role:rol}).some(e=>e.tipo==='item'&&e.href==='/setup'),rol);
  assert.ok(!menuVisible({role:undefined}).some(e=>e.tipo==='item'&&e.href==='/setup'));
  assert.equal(ESP['nav.item.setup'],'Configuración');assert.equal(ING['nav.item.setup'],'Setup');
  assert.match(leer('src/lib/workspace/menu.mjs'),/const LECTURA = \[\.\.\.DATABASE_ACTION_ROLES\.read\]/);
});
test('el checklist de Hoy y el botón Guía enlazan a /setup (Ver como no tiene Guía ni checklist: solo el aviso)',()=>{
  assert.match(leer('src/components/onboarding/checklist.tsx'),/<Link href="\/setup"[^>]*>\{t\('onb\.setup\.verTodo'\)\}<\/Link>/);
  assert.match(leer('src/components/onboarding/contexto.tsx'),/router\.push\('\/setup'\)/);
  assert.match(leer('src/components/onboarding/guia.tsx'),/abrirSetup=\{c\.abrirSetup\}/);
  assert.match(leer('src/components/onboarding/paneles.tsx'),/abrirSetup&&<button type="button" onClick=\{abrirSetup\}>\{t\('onb\.setup\.verTodo'\)\}/);
  assert.equal(ESP['onb.setup.verTodo'],'Ver configuración completa');
});
test('/confianza (arreglo de F3): no pide /api/refunds ni /api/workload a quien no los puede leer, y oculta la tarjeta que depende de ellos',()=>{
  const src=leer('src/components/confianza/confianza-pantalla.tsx');
  assert.match(src,/useJson\(verDinero\?'\/api\/refunds':null,acceptFuga\)/);assert.match(src,/useJson\(verDinero\?'\/api\/workload':null,acceptCarga\)/);
  assert.match(src,/ROLES_DINERO\)\s+as readonly string\[\]\)\.includes\(rol\)|\(ROLES_DINERO as readonly string\[\]\)\.includes\(rol\)/);
  assert.match(src,/\{verDinero&&<Tarjeta id="dc-ventanas"/);
  assert.doesNotMatch(src,/useJson\('\/api\/(refunds|workload)'/,'ya no hay petición incondicional');
  for(const rol of ['operator','viewer'])assert.ok(!(ROLES_DINERO as readonly string[]).includes(rol),rol);
  const mismo=['owner','analyst'];assert.deepEqual([...ROLES_DINERO],mismo);
});
