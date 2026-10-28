// Onboarding F2: máquina del recorrido, teclado, accesibilidad del marcado, CSS sin estilos en línea, helper de prerrequisitos y consulta de señales.
// No hay DOM en este entorno (sin jsdom/Playwright): el comportamiento se prueba en la máquina pura y en el marcado renderizado (renderToStaticMarkup); el foco real y axe quedan para la corrida de F5.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {estadoInicial,reducir,eventoDeTecla,OBJETIVOS} from '../src/lib/onboarding/recorrido.mjs';
import {CATALOGO,pasosDe,PISTAS} from '../src/lib/onboarding/catalogo.mjs';
import {calcularChecklist,estadoDePaso,normalizarSenales,MAX_VISIBLES} from '../src/lib/onboarding/prerrequisitos.mjs';
import {consultaDeSenales,SENALES_POR_ROL} from '../src/lib/onboarding/senales-sql.mjs';
import {TarjetaRecorrido,InvitacionRecorrido,MenuGuia} from '../src/components/onboarding/paneles';
import {traductor} from '../src/lib/i18n';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer=(rel:string)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const noop=()=>{};
const TODO_FALSO={conexion_activa:false,conexion_con_problema:false,historial_importado:false,corte_publicado:false,equipo_invitado:false,accion_propuesta:false,hay_intervenciones:false,resultado_registrado:false};

// ---- Máquina del recorrido
test('recorrido: solo se abre con «abrir»; un cambio de ruta jamás lo abre, lo cierra ni lo mueve',()=>{
  let e=estadoInicial();
  assert.equal(reducir(e,{tipo:'ruta'},5).abierto,false,'cerrado sigue cerrado al cambiar de ruta');
  assert.equal(reducir(e,{tipo:'siguiente'},5).abierto,false,'nada se abre sin que la persona lo pida');
  e=reducir(e,{tipo:'abrir'},5);assert.equal(e.abierto,true);assert.equal(e.iniciadoPorPersona,true);
  e=reducir(e,{tipo:'siguiente'},5);const antes=e;
  assert.deepEqual(reducir(e,{tipo:'ruta'},5),antes,'abierto sigue igual (mismo paso) al cambiar de ruta');
});
test('recorrido: Esc cierra y conserva el paso; flechas navegan sin salirse; Terminar cierra y marca terminado',()=>{
  let e=reducir(estadoInicial(),{tipo:'abrir',indice:99},3);assert.equal(e.indice,2,'el índice se acota');
  e=reducir(e,{tipo:'anterior'},3);e=reducir(e,{tipo:'anterior'},3);e=reducir(e,{tipo:'anterior'},3);assert.equal(e.indice,0);
  e=reducir(e,{tipo:'siguiente'},3);assert.equal(e.indice,1);
  const cerrado=reducir(e,eventoDeTecla('Escape')!,3);assert.equal(cerrado.abierto,false);assert.equal(cerrado.indice,1);assert.equal(cerrado.terminado,false);
  const fin=reducir(reducir(reducir(estadoInicial(),{tipo:'abrir'},3),{tipo:'siguiente'},3),{tipo:'siguiente'},3);assert.equal(fin.indice,2);
  const termino=reducir(fin,{tipo:'siguiente'},3);assert.equal(termino.abierto,false);assert.equal(termino.terminado,true);
  assert.deepEqual(reducir(estadoInicial(),{tipo:'abrir'},0),estadoInicial(),'sin pasos no hay recorrido');
});
test('teclado: flechas, Esc y Enter (Enter solo si el foco no está en un control que ya lo maneja)',()=>{
  assert.deepEqual(eventoDeTecla('ArrowRight'),{tipo:'siguiente'});assert.deepEqual(eventoDeTecla('ArrowLeft'),{tipo:'anterior'});assert.deepEqual(eventoDeTecla('Escape'),{tipo:'cerrar'});
  assert.deepEqual(eventoDeTecla('Enter','SECTION'),{tipo:'siguiente'});
  for(const el of ['BUTTON','A','INPUT','SELECT','TEXTAREA','SUMMARY'])assert.equal(eventoDeTecla('Enter',el),null,el);
  assert.equal(eventoDeTecla('Tab'),null);assert.equal(eventoDeTecla('a'),null);
});
test('flujo del propietario completo con teclado en ≤ 12 interacciones (Tab al botón, Enter, opción del menú, 4 flechas, Enter final)',()=>{
  const total=pasosDe('propietario','tour').length;assert.ok(total>=1&&total<=5);
  const teclas:string[]=['Tab','Enter','Enter'];// Tab→Guía, Enter abre el menú, Enter en «Repetir el recorrido»
  let e=reducir(estadoInicial(),{tipo:'abrir'},total);
  for(let i=0;i<total-1;i++)teclas.push('ArrowRight');
  teclas.push('Enter');// Enter sobre «Terminar»
  for(const k of teclas.slice(3)){const ev=eventoDeTecla(k,k==='Enter'?'BUTTON':'SECTION');if(k==='Enter')e=reducir(e,{tipo:'siguiente'},total);else if(ev)e=reducir(e,ev,total);}
  assert.equal(e.terminado,true);assert.equal(e.abierto,false);
  assert.ok(teclas.length<=12,`interacciones: ${teclas.length}`);
});
test('cada paso de tour tiene objetivos y todos los data-tour que usan existen en el código',()=>{
  const fuentes=['src/components/hoy/hoy-pantalla.tsx','src/components/connection-health.tsx','src/components/workspace/problems-view.tsx','src/components/workspace/navigation.tsx','src/components/platform/platform-nav.tsx'].map(leer).join('\n');
  for(const p of CATALOGO.filter(p=>p.superficie==='tour'&&p.pista!=='soporte'))assert.ok((OBJETIVOS as Record<string,string[]>)[p.id]?.length>0,'sin objetivo '+p.id);
  for(const lista of Object.values(OBJETIVOS))for(const sel of lista){
    const m=/data-tour="([^":]+)(?::([^"]*))?"/.exec(sel)!;
    if(m[1]==='menu')assert.match(fuentes,/data-tour=\{'menu:'\+link\.href\}/);
    else if(m[1]==='plataforma')assert.match(fuentes,/data-tour=\{'plataforma:'\+href\}/);
    else if(m[1]!=='alcance')assert.ok(fuentes.includes(`data-tour="${m[1]}"`),'falta data-tour '+m[1]);
  }
  assert.ok(!OBJETIVOS['operador.hoy'].some(s=>s.includes('hoy-cifras'))&&!OBJETIVOS['lector.hoy'].some(s=>s.includes('hoy-cifras')),'operador y lector ven esas cifras «sin acceso»: no se resaltan');
});

// ---- Marcado accesible
const T={es:traductor('es'),en:traductor('en')};
for(const idioma of ['es','en'] as const){
  test(`tarjeta (${idioma}): dialog no modal, un solo anuncio de «Paso n de N», primer botón primario, sin style=`,()=>{
    const t=T[idioma],dic=(idioma==='es'?es:en) as Record<string,string>;
    const html=renderToStaticMarkup(<TarjetaRecorrido t={t} titulo="onb.propietario.datos.titulo" cuerpo="onb.propietario.datos.cuerpo" n={2} total={5} alEvento={noop} omitir={noop}/>);
    assert.match(html,/role="dialog"/);assert.doesNotMatch(html,/aria-modal/);assert.doesNotMatch(html,/\bstyle=/);assert.doesNotMatch(html,/tabindex/i,'no atrapa el foco');
    assert.match(html,/aria-labelledby="onb-t-titulo"/);assert.match(html,/aria-describedby="onb-t-cuerpo"/);
    assert.equal((html.match(/role="status"/g)??[]).length,1,'un solo anuncio');assert.doesNotMatch(html,/aria-live/);
    assert.match(html,/class="onb-contador" aria-hidden="true"/,'la línea visible del contador no se duplica en lectores de pantalla');
    const anuncio=/role="status">([^<]*)</.exec(html)![1];assert.ok(anuncio.includes(dic['onb.propietario.datos.titulo'])&&/2/.test(anuncio)&&/5/.test(anuncio));
    assert.ok(html.indexOf('data-onb-primario')>html.indexOf(dic['onb.ui.omitir']),'Omitir, Anterior y Siguiente en orden de lectura');
    assert.ok(html.includes(dic['onb.ui.anterior'])&&html.includes(dic['onb.ui.siguiente']));
  });
}
test('tarjeta: en el primer paso no hay «Anterior»; en el último el primario dice «Terminar»',()=>{
  const t=T.en;
  const primero=renderToStaticMarkup(<TarjetaRecorrido t={t} titulo="onb.lector.hoy.titulo" cuerpo="onb.lector.hoy.cuerpo" n={1} total={3} alEvento={noop} omitir={noop}/>);
  assert.doesNotMatch(primero,/>Back</);
  const ultimo=renderToStaticMarkup(<TarjetaRecorrido t={t} titulo="onb.lector.confianza.titulo" cuerpo="onb.lector.confianza.cuerpo" n={3} total={3} alEvento={noop} omitir={noop}/>);
  assert.match(ultimo,/>Finish</);
});
test('invitación y menú Guía: sin style=, saltar/«No volver a mostrar»/«Retomar» presentes según el caso',()=>{
  const t=T.en;
  const inv=renderToStaticMarkup(<InvitacionRecorrido t={t} saltar={noop} empezar={noop}/>);
  assert.match(inv,/Skip/);assert.match(inv,/Start tour/);assert.doesNotMatch(inv,/\bstyle=|role="dialog"/);
  const menu=(paso:boolean,descartado:boolean)=>renderToStaticMarkup(<MenuGuia t={t} contexto="Org · Owner" tienePaso={paso} mostrarChecklistOpcion descartado={descartado} iniciar={noop} retomar={noop} mostrarChecklist={noop} noVolver={noop} cerrar={noop}/>);
  assert.match(menu(true,false),/Resume where I left off/);assert.doesNotMatch(menu(false,false),/Resume where/);
  assert.match(menu(false,false),/Don&#x27;t show again/);assert.doesNotMatch(menu(false,true),/Don&#x27;t show again/);assert.match(menu(false,true),/Show the getting started list/);
  assert.match(menu(false,false),/Org · Owner/);assert.doesNotMatch(menu(true,true),/\bstyle=/);
});

// ---- CSS y fuentes: sin estilos en línea, reduced-motion, contraste, móvil
test('los componentes nuevos no usan style= ni librerías externas',()=>{
  for(const f of ['contexto.tsx','guia.tsx','paneles.tsx','checklist.tsx']){const src=leer('src/components/onboarding/'+f);assert.doesNotMatch(src,/\bstyle=\{|\bstyle="/,f);assert.doesNotMatch(src,/from '(?!react|next|\.)[^']+'/,f+' importa una librería externa');}
});
test('CSS: animación solo bajo prefers-reduced-motion:no-preference, transform/opacity, 150-250 ms, móvil sobre la barra inferior, forced-colors y outline ≥ 3 px',()=>{
  const css=leer('src/components/onboarding/onboarding.css');
  const fueraDeMedia=css.replace(/@media \(prefers-reduced-motion:no-preference\) \{[\s\S]*?\n\}\n/,'');
  assert.doesNotMatch(fueraDeMedia,/animation\s*:|transition\s*:|@keyframes/,'ninguna animación fuera de no-preference');
  assert.match(css,/@media \(prefers-reduced-motion:no-preference\)[\s\S]*animation:onb-entra 200ms/);
  assert.match(css,/from \{ opacity:0; transform:translateY\(8px\); \} to \{ opacity:1; transform:none; \}/);
  assert.match(css,/@media \(forced-colors:active\)/);assert.match(css,/\.onb-resaltado \{ outline:3px solid var\(--onb-resalte\)/);
  assert.match(css,/@media \(max-width:767px\)[\s\S]*bottom:calc\(var\(--nav-total, 0px\) \+ 12px\)/);
});
const lum=(hex:string)=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
const contraste=(a:string,b:string)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
test('contraste del resaltado ≥ 3:1 contra los fondos de tema claro y oscuro',()=>{
  const css=leer('src/components/onboarding/onboarding.css'),glob=leer('src/app/globals.css');
  const claro=/:root \{ --onb-resalte:(#[0-9a-f]{6})/.exec(css)![1],oscuro=/data-theme=dark\] \{ --onb-resalte:(#[0-9a-f]{6})/.exec(css)![1];
  const fondoClaro=/--ui-canvas:(#[0-9a-f]{6})/.exec(glob.split('\n')[1])![1],fondoOscuro=/--ui-canvas:(#[0-9a-f]{6})/.exec(glob.split('\n')[2])![1];
  assert.ok(contraste(claro,'#ffffff')>=3&&contraste(claro,fondoClaro)>=3,String(contraste(claro,fondoClaro)));
  assert.ok(contraste(oscuro,fondoOscuro)>=3&&contraste(oscuro,'#17171a')>=3);
});
test('getting-started.tsx y su CSS ya no existen y nadie los importa',()=>{
  assert.equal(fs.existsSync(new URL('../src/components/workspace/getting-started.tsx',import.meta.url)),false);
  assert.doesNotMatch(leer('src/app/globals.css'),/getting-started|step-number/);
});
test('cierre de sesión borra las claves onb.* (shell y página de ingreso)',()=>{
  assert.match(leer('src/components/workspace/shell.tsx'),/action="\/auth\/logout"[^>]*onSubmit=\{\(\)=>\{limpiarTodo\(\);limpiarEstadoOnboarding\(almacenDelNavegador\(\)\);\}\}/);
  assert.match(leer('src/components/limpiar-cache.tsx'),/limpiarEstadoOnboarding\(almacenDelNavegador\(\)\)/);
});

// ---- Prerrequisitos con datos simulados
test('checklist del propietario: sin datos todo pendiente; el tercero (correo) en espera y fuera del progreso; el dinero publicado va «con salvedad»',()=>{
  const vacio=calcularChecklist('propietario',normalizarSenales(TODO_FALSO));
  const por=Object.fromEntries(vacio.items.map(i=>[i.id.split('.')[1],i]));
  assert.equal(por.historial.estado,'pendiente');assert.equal(por.corte.estado,'bloqueado');assert.equal(por.corte.nota,'onb.check.bloq.sinDatos');
  assert.equal(por.equipo.estado,'esperando');assert.equal(por.equipo.esperaA,'onb.tercero.correo');assert.equal(por.retencion.estado,'informativo');
  assert.deepEqual(vacio.progreso,{hechos:0,total:2},'equipo (tercero) y retención (informativa) no cuentan');
  assert.equal(vacio.siguiente,'propietario.historial','el siguiente nunca es uno en espera, bloqueado o informativo');
  const con=calcularChecklist('propietario',normalizarSenales({...TODO_FALSO,historial_importado:true,corte_publicado:true,equipo_invitado:true}));
  const c2=Object.fromEntries(con.items.map(i=>[i.id.split('.')[1],i]));
  assert.equal(c2.historial.estado,'hecho');assert.equal(c2.corte.estado,'salvedad');assert.equal(c2.corte.nota,'onb.check.concil');assert.equal(c2.equipo.estado,'hecho');
  assert.deepEqual(con.progreso,{hechos:2,total:2});assert.equal(con.siguiente,null);assert.equal(con.completo,true);
});
test('checklist: señales ausentes (error de red) → desconocido, sin progreso ni siguiente; sin señales nunca se inventa «hecho»',()=>{
  const c=calcularChecklist('propietario',null);
  assert.ok(c.items.every(i=>i.estado==='desconocido'||i.estado==='informativo'));assert.deepEqual(c.progreso,{hechos:0,total:0});assert.equal(c.siguiente,null);
  assert.equal(normalizarSenales('x'),null);assert.deepEqual(normalizarSenales({corte_publicado:'true'})!.corte_publicado,false,'solo true booleano cuenta');
});
test('checklist por capacidad real: el analista no publica cortes (espera al propietario); el operador necesita una intervención asignada; el lector no tiene checklist',()=>{
  const a=calcularChecklist('analista',normalizarSenales(TODO_FALSO)).items.find(i=>i.id==='analista.corte')!;
  assert.equal(a.estado,'esperando');assert.equal(a.esperaA,'onb.tercero.propietario');assert.equal(a.cuenta,false);
  const o=Object.fromEntries(calcularChecklist('operador',normalizarSenales(TODO_FALSO)).items.map(i=>[i.id,i]));
  assert.equal(o['operador.resultado'].estado,'bloqueado');assert.equal(o['operador.resultado'].nota,'onb.check.bloq.sinIntervencion');assert.equal(o['operador.propuesta'].estado,'pendiente');
  assert.equal(calcularChecklist('operador',normalizarSenales({...TODO_FALSO,hay_intervenciones:true})).items.find(i=>i.id==='operador.resultado')!.estado,'pendiente');
  for(const p of ['lector','plataforma','soporte'] as const)assert.equal(calcularChecklist(p,normalizarSenales(TODO_FALSO)).items.length,0,p);
});
test('checklist: máximo 4 visibles y el resto plegado (con una lista simulada más larga)',()=>{
  assert.equal(MAX_VISIBLES,4);
  for(const p of PISTAS){const c=calcularChecklist(p,normalizarSenales(TODO_FALSO));assert.ok(c.visibles.length<=4,p);assert.equal(c.visibles.length+c.plegados.length,c.items.length);}
  const c=calcularChecklist('propietario',normalizarSenales(TODO_FALSO),{maxVisibles:2});assert.equal(c.visibles.length,2);assert.equal(c.plegados.length,2);
});
test('estadoDePaso: el paso de MFA/push nunca existe como «hecho» (no hay tal paso en el catálogo) y el dinero no muestra cifra de conciliación',()=>{
  assert.ok(!CATALOGO.some(p=>/mfa|push/i.test(p.id)),'sin pasos de MFA ni push en F2');
  const corte=CATALOGO.find(p=>p.id==='propietario.corte')!;
  const r=estadoDePaso(corte,normalizarSenales({...TODO_FALSO,corte_publicado:true}));assert.equal(r.estado,'salvedad');
  for(const k of ['onb.check.concil'])for(const dic of [es,en])assert.doesNotMatch((dic as Record<string,string>)[k],/\d|%/,'sin cifra inventada');
});

// ---- Consulta de señales: barata y por rol
test('consulta de señales: una sola sentencia con EXISTS acotados al tenant; sin conteos sobre el libro, pedidos o mensajes; cada rol consulta solo lo suyo',()=>{
  for(const rol of ['owner','analyst','operator']){
    const q=consultaDeSenales(rol)!;assert.ok(q,rol);
    assert.equal((q.texto.match(/^SELECT /g)??[]).length,1,'una sola sentencia de nivel superior');
    assert.doesNotMatch(q.texto,/economic_ledger_entries|orders|messages|conversations|count\(\s*distinct/i,'no toca el libro ni tablas grandes');
    assert.doesNotMatch(q.texto,/\$2/);
    for(const k of q.claves)assert.match(q.texto,new RegExp(`AS ${k}\\b`));
    for(const m of q.texto.matchAll(/FROM public\.\w+ WHERE ([^)]*)/g))assert.match(m[1],/^tenant_id=\$1/,'cada subconsulta filtra por tenant');
  }
  assert.equal(consultaDeSenales('viewer'),null,'el lector no tiene checklist: cero consultas');
  assert.deepEqual(SENALES_POR_ROL.viewer,[]);assert.equal(consultaDeSenales('inventado'),null);
  assert.ok(!/memberships/.test(consultaDeSenales('analyst')!.texto)&&!/memberships/.test(consultaDeSenales('operator')!.texto));
  for(const rol of ['owner','analyst','operator'])for(const k of consultaDeSenales(rol)!.claves)assert.ok(k in TODO_FALSO,k);
});
test('endpoint de señales: lectura pura, sin parámetros, una transacción de lectura',()=>{
  const src=leer('src/lib/onboarding/servidor.ts');
  assert.match(src,/transaction\('read'/);assert.equal((src.match(/transaction\(/g)??[]).length,1);assert.match(src,/unsupported_filter/);
  assert.doesNotMatch(src,/INSERT|UPDATE|DELETE|transaction\('(import|configure|propose|approve|execute|retain)'/);
  assert.match(leer('src/app/api/onboarding/estado/route.ts'),/export const GET=/);assert.doesNotMatch(leer('src/app/api/onboarding/estado/route.ts'),/export const POST/);
});

// ---- i18n y cifras
test('claves nuevas de F2 existen en es y en con las mismas {variables} y sin cifras',()=>{
  const nuevas=Object.keys(es).filter(k=>/^onb\.(check|tercero)\./.test(k)||/^onb\.ui\.(cerrar|empezar|saltar|retomar|noVolver|invitacion|recorrido|menuGuia|rolOrg|mostrarChecklist|avisoPasos)/.test(k));
  assert.ok(nuevas.length>=30);
  const vars=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
  for(const k of nuevas){const a=(es as Record<string,string>)[k],b=(en as Record<string,string>)[k];assert.ok(b,'falta en: '+k);assert.equal(vars(a),vars(b),k);assert.doesNotMatch(a+b,/\d|%/,k);}
});
test('textos corregidos con F0: el operador no decide por el propietario, el lector no «ve resumido», el soporte no promete pantallas',()=>{
  const e=es as Record<string,string>,n=en as Record<string,string>;
  assert.match(e['onb.operador.acciones.cuerpo'],/asignaron/);assert.match(n['onb.operador.acciones.cuerpo'],/assigned to you/);
  assert.doesNotMatch(e['onb.operador.propuesta.cuerpo'],/propietario/);assert.doesNotMatch(e['onb.lector.problemas.cuerpo'],/resumid/);
  assert.match(e['onb.soporte.aviso.cuerpo'],/no están disponibles/);assert.match(n['onb.soporte.aviso.cuerpo'],/not available/);
});
