// Onboarding F2b: recorrido guiado «página por página». Sin DOM en este entorno: la máquina y la construcción se prueban en lógica pura; el marcado, con renderToStaticMarkup;
// el foco con atenuación, el scroll suave, el seguimiento del elemento y las animaciones reales quedan para la corrida en el navegador.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {CATALOGO,PISTAS,ROL_DE_PISTA,rolTieneCapacidad,ACCIONES_DE_ESCRITURA,CLAVES_UI,pasosDe} from '../src/lib/onboarding/catalogo.mjs';
import {PANTALLAS,slugDe,CLAVES_PANTALLAS,clavesDePantalla,TEXTO_PISTA,CLAVES_TEXTO_PISTA} from '../src/lib/onboarding/pantallas.mjs';
import {construirTour,pantallasDe,gruposDe} from '../src/lib/onboarding/tour.mjs';
import {estadoInicial,reducir,eventoDeTecla,teclasPropias} from '../src/lib/onboarding/recorrido.mjs';
import {enPantalla} from '../src/lib/onboarding/ruta.mjs';
import {calcularChecklist,normalizarSenales} from '../src/lib/onboarding/prerrequisitos.mjs';
import {actualizarEstado,leerEstado,claveEstado,ESTADO_VACIO,type Almacen} from '../src/lib/onboarding/estado';
import {menuVisible} from '../src/lib/workspace/menu.mjs';
import {TarjetaRecorrido,EtiquetaObjetivo,CapaFoco,MenuGuia,ventanaRuta} from '../src/components/onboarding/paneles';
import {Ilustracion,TIPOS_ILUSTRACION} from '../src/components/onboarding/ilustraciones';
import {traductor} from '../src/lib/i18n';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer=(rel:string)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const ESP=es as Record<string,string>,ING=en as Record<string,string>;
const noop=()=>{};
const ROLES_PISTA=['propietario','analista','operador','lector'] as const;
const hrefsDelMenu=(rol:string)=>menuVisible({role:rol}).flatMap(e=>e.tipo==='grupo'?e.items:[e]).map(i=>i.href);
const variables=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');

// ---- Construcción desde el catálogo y el menú real
test('las pantallas del recorrido de cada rol son EXACTAMENTE las del menú que ese rol ve (y nada más), en el orden del menú',()=>{
  for(const pista of ROLES_PISTA){
    const rol=ROL_DE_PISTA[pista]!,menu=hrefsDelMenu(rol),vistas=pantallasDe(pista);
    assert.deepEqual(vistas,menu.filter(h=>h in PANTALLAS),pista);
    assert.deepEqual(menu.filter(h=>!(h in PANTALLAS)),[],`${pista}: pantalla del menú sin contenido de recorrido`);
    assert.ok(vistas.length>=14,pista);
  }
  assert.deepEqual(pantallasDe('plataforma'),pasosDe('plataforma','tour').map(p=>p.href));
  assert.deepEqual(pantallasDe('soporte'),[]);assert.deepEqual(pantallasDe(null as never),[]);assert.deepEqual(construirTour('soporte'),[]);
});
test('el lector, el operador y el analista no reciben pantallas que su menú no muestra (dinero, administración, configuración de fuentes)',()=>{
  const sin=(pista:(typeof ROLES_PISTA)[number],rutas:string[])=>{const v=pantallasDe(pista);for(const r of rutas)assert.ok(!v.includes(r),`${pista} no debe ver ${r}`);};
  sin('lector',['/cfo','/gaps','/refunds','/economics','/map','/workload','/pain-points','/settings/team','/settings/retention','/settings/notification-delivery']);
  sin('operador',['/cfo','/economics','/settings/team','/settings/retention']);
  sin('analista',['/settings/team','/settings/retention','/settings/notification-delivery']);
  assert.ok(pantallasDe('propietario').includes('/settings/team')&&pantallasDe('propietario').includes('/economics'));
});
test('cada pantalla tiene entre 2 y 4 micro-pasos de contenido (qué es, elemento clave, acción principal) más el paso «ir»; el último paso es el cierre',()=>{
  for(const pista of PISTAS){
    const tour=construirTour(pista);if(pista==='soporte'){assert.equal(tour.length,0);continue;}
    assert.equal(new Set(tour.map(p=>p.id)).size,tour.length,'ids únicos '+pista);
    assert.equal(tour.at(-1)!.tipo,'cierre');
    const grupos=gruposDe(tour);assert.equal(grupos.length,pantallasDe(pista).length);
    for(const g of grupos){
      const pasos=tour.filter(p=>p.grupo===g.grupo);
      assert.equal(pasos[0].tipo,'ir',g.href);assert.equal(pasos[1].clave,'que');assert.equal(pasos[2].clave,'clave');
      assert.ok(pasos.length-1>=2&&pasos.length-1<=3,`${pista} ${g.href}: ${pasos.length-1} micro-pasos`);
      assert.ok(pasos.every(p=>p.href===g.href&&p.objetivos.length>0&&p.ilu));
      assert.deepEqual(pasos[0].objetivos,[`[data-tour="${pista==='plataforma'?'plataforma:':'menu:'}${g.href}"]`]);
    }
  }
});
test('el texto específico del rol del catálogo sustituye al genérico del paso «qué es»; sin catálogo se usa el de la pantalla',()=>{
  const duenio=construirTour('propietario'),lector=construirTour('lector');
  const catalogo=(tour:ReturnType<typeof construirTour>,id:string)=>tour.find(p=>p.id===id)!;
  assert.equal(catalogo(duenio,'overview.que').cuerpo,'onb.propietario.hoy.cuerpo');assert.equal(catalogo(lector,'overview.que').cuerpo,'onb.lector.hoy.cuerpo');
  assert.equal(catalogo(duenio,'cfo.que').cuerpo,'onb.pant.cfo.desc');
  for(const t of [duenio,lector])for(const p of t.filter(x=>x.catalogo))assert.ok(CATALOGO.some(c=>c.id===p.catalogo&&c.href===p.href),p.id);
});
test('el paso de acción principal solo existe si el rol tiene la capacidad real; el lector nunca recibe uno de escritura',()=>{
  for(const pista of ROLES_PISTA){
    const rol=ROL_DE_PISTA[pista]!;
    for(const p of construirTour(pista).filter(x=>x.clave==='accion')){
      const cap=PANTALLAS[p.href!].accion!.capacidad;assert.ok(rolTieneCapacidad(rol,cap as never),`${pista} ${p.href} exige ${cap}`);
      if(pista==='lector')assert.ok(!(ACCIONES_DE_ESCRITURA as readonly string[]).includes(cap),'lector '+p.href);
    }
  }
  const tiene=(pista:(typeof ROLES_PISTA)[number],id:string)=>construirTour(pista).some(p=>p.id===id);
  assert.ok(tiene('propietario','recommendations.accion')&&!tiene('operador','recommendations.accion')&&!tiene('analista','recommendations.accion'));
  assert.ok(tiene('operador','interventions.accion')&&!tiene('lector','interventions.accion'));
  assert.ok(tiene('analista','imports.accion')&&!tiene('operador','imports.accion'));
});
test('ruta: enPantalla usa el mismo criterio que el encabezado (alias y subrutas) y la consola de plataforma distingue sus pantallas',()=>{
  assert.ok(enPantalla('/problems','/problems')&&enPantalla('/problems/123','/problems')&&enPantalla('/problems/manage','/problems'));
  assert.ok(enPantalla('/jobs/abc','/imports')&&enPantalla('/notifications/push','/settings/notifications'));
  assert.ok(!enPantalla('/overview','/problems')&&!enPantalla('/settings/notification-delivery','/settings/notifications'));
  assert.ok(enPantalla('/platform','/platform')&&!enPantalla('/platform/auditoria','/platform')&&enPantalla('/platform/auditoria/x','/platform/auditoria'));
});

// ---- Máquina del recorrido
const tourDuenio=construirTour('propietario'),N=tourDuenio.length;
const idx=(id:string)=>tourDuenio.findIndex(p=>p.id===id);
const R=(e:ReturnType<typeof estadoInicial>,ev:Parameters<typeof reducir>[1],ruta:string|null='/overview')=>reducir(e,ev,N,tourDuenio,ruta);
test('máquina: abrir en la pantalla del primer paso salta el «ir» inútil; desde otra pantalla empieza por «ir» (te dice qué apretar)',()=>{
  const aqui=R(estadoInicial(),{tipo:'abrir'},'/overview');assert.equal(tourDuenio[aqui.indice].id,'overview.que');
  const lejos=R(estadoInicial(),{tipo:'abrir'},'/problems/3');assert.equal(tourDuenio[lejos.indice].id,'overview.ir');assert.equal(lejos.abierto,true);
});
test('máquina: el clic en el elemento (o «Llévame») completa el paso «ir»; en un paso normal el clic no hace nada',()=>{
  const e=R(estadoInicial(),{tipo:'abrir',indice:idx('problems.ir')},'/overview');
  assert.equal(tourDuenio[e.indice].id,'problems.ir');
  const tras=R(e,{tipo:'clic'},'/overview');assert.equal(tourDuenio[tras.indice].id,'problems.que');
  assert.deepEqual(R(tras,{tipo:'clic'},'/problems'),tras,'un clic en un paso informativo no mueve el recorrido');
  assert.deepEqual(R(estadoInicial(),{tipo:'clic'}),estadoInicial(),'cerrado no se abre con un clic');
});
test('máquina: llegar a la pantalla del paso «ir» (aunque sea por otro camino) lo completa; cualquier otro cambio de ruta no abre, cierra ni mueve',()=>{
  const ir=R(estadoInicial(),{tipo:'abrir',indice:idx('problems.ir')},'/overview');
  assert.deepEqual(R(ir,{tipo:'ruta',ruta:'/cfo'}),ir,'otra pantalla: nada cambia');
  assert.equal(tourDuenio[R(ir,{tipo:'ruta',ruta:'/problems'}).indice].id,'problems.que');
  assert.equal(tourDuenio[R(ir,{tipo:'ruta',ruta:'/problems/manage'}).indice].id,'problems.que');
  const enContenido=R(estadoInicial(),{tipo:'abrir',indice:idx('problems.clave')},'/problems');
  assert.deepEqual(R(enContenido,{tipo:'ruta',ruta:'/overview'}),enContenido,'cambio de ruta ajeno: el paso se conserva');
  assert.deepEqual(R(estadoInicial(),{tipo:'ruta',ruta:'/problems'}),estadoInicial(),'cerrado sigue cerrado');
});
test('máquina: siguiente cruza de pantalla hasta un «ir» (o lo salta si ya estás ahí); anterior vuelve a la pantalla previa sin detenerse en el «ir» de la actual',()=>{
  const finOverview=idx('preguntale.ir')-1,e=R(estadoInicial(),{tipo:'abrir',indice:finOverview},'/overview');
  assert.equal(tourDuenio[R(e,{tipo:'siguiente'},'/overview').indice].id,'preguntale.ir');
  assert.equal(tourDuenio[R(e,{tipo:'siguiente'},'/preguntale').indice].id,'preguntale.que','ya estás en la pantalla: no hay nada que apretar');
  const que=R(estadoInicial(),{tipo:'abrir',indice:idx('preguntale.que')},'/preguntale');
  assert.equal(tourDuenio[R(que,{tipo:'anterior'},'/preguntale').indice].id,tourDuenio[finOverview].id,'salta preguntale.ir y vuelve al último paso de Hoy');
  assert.equal(tourDuenio[R(que,{tipo:'anterior'},'/otra').indice].id,tourDuenio[finOverview].id,'hacia atrás un «ir» nunca es destino, estés donde estés (si no, el viaje automático quedaría en bucle)');
  for(const ruta of ['/overview','/otra','/sin-acceso'])for(let i=0;i<N;i++){const antes=R(estadoInicial(),{tipo:'abrir',indice:i},ruta),sig=R(antes,{tipo:'anterior'},ruta);if(sig.indice!==antes.indice)assert.notEqual(tourDuenio[sig.indice].tipo,'ir',`Anterior desde ${tourDuenio[i].id} con ruta ${ruta}`);assert.ok(sig.indice<=antes.indice);}
  const primero=R(estadoInicial(),{tipo:'abrir'},'/overview');assert.equal(R(primero,{tipo:'anterior'},'/overview').indice,primero.indice,'no se sale por el principio');
});
test('máquina: retomar (abrir en el paso guardado), saltar a una pantalla (menú), terminar en el cierre y Esc que conserva el paso',()=>{
  const guardado=idx('connections.clave'),r=R(estadoInicial(),{tipo:'abrir',indice:guardado},'/connections');assert.equal(r.indice,guardado);
  const g=gruposDe(tourDuenio).find(x=>x.href==='/economics')!,salto=R(r,{tipo:'abrir',indice:g.desde},'/connections');assert.equal(tourDuenio[salto.indice].id,'economics.ir');
  const fin=R(estadoInicial(),{tipo:'abrir',indice:N-1},'/overview');assert.equal(tourDuenio[fin.indice].tipo,'cierre');
  const t=R(fin,{tipo:'siguiente'});assert.equal(t.abierto,false);assert.equal(t.terminado,true);
  const esc=R(r,{tipo:'cerrar'});assert.equal(esc.abierto,false);assert.equal(esc.indice,guardado);assert.equal(esc.terminado,false);
  assert.deepEqual(reducir(estadoInicial(),{tipo:'abrir'},0),estadoInicial());
});
test('teclado: las flechas avanzan siempre (también tras navegar) salvo en campos de texto, listas o pestañas, o con modificadores; Esc siempre sale',()=>{
  const campo=(tagName:string,extra:object={})=>({tagName,getAttribute:()=>null,...extra});
  assert.equal(teclasPropias(campo('INPUT')),true);assert.equal(teclasPropias(campo('TEXTAREA')),true);assert.equal(teclasPropias(campo('SELECT')),true);
  assert.equal(teclasPropias(campo('DIV',{isContentEditable:true})),true);
  assert.equal(teclasPropias({tagName:'DIV',getAttribute:(n:string)=>n==='role'?'tab':null}),true);assert.equal(teclasPropias({tagName:'DIV',getAttribute:(n:string)=>n==='role'?'listbox':null}),true);
  assert.equal(teclasPropias(campo('BUTTON')),false);assert.equal(teclasPropias(campo('A')),false);assert.equal(teclasPropias(campo('BODY')),false);assert.equal(teclasPropias(null),false);
  const propias=teclasPropias(campo('INPUT'));
  assert.equal(eventoDeTecla('ArrowRight','INPUT',{propias}),null);assert.equal(eventoDeTecla('ArrowLeft','TEXTAREA',{propias}),null);
  assert.deepEqual(eventoDeTecla('Escape','INPUT',{propias}),{tipo:'cerrar'});
  assert.equal(eventoDeTecla('ArrowRight','BODY',{modificador:true}),null,'Alt+→ es del navegador');
  assert.deepEqual(eventoDeTecla('ArrowRight','BODY'),{tipo:'siguiente'});assert.deepEqual(eventoDeTecla('ArrowLeft','BUTTON'),{tipo:'anterior'});
  const ctx=leer('src/components/onboarding/contexto.tsx');
  assert.match(ctx,/document\.addEventListener\('keydown',alTeclear\)/,'oyente a nivel de documento mientras el recorrido está abierto');
  assert.match(ctx,/teclasPropias\(objetivo\)/);assert.match(ctx,/e\.altKey\|\|e\.ctrlKey\|\|e\.metaKey/);
  assert.doesNotMatch(leer('src/components/onboarding/paneles.tsx'),/onKeyDown=\{[^}]*ArrowRight|alTeclear/,'la tarjeta no intercepta teclas: no depende de dónde esté el foco');
});
test('el recorrido por teclado completo de un lector se hace solo con flechas y llega al cierre',()=>{
  const tour=construirTour('lector'),n=tour.length;let e=reducir(estadoInicial(),{tipo:'abrir'},n,tour,'/overview'),pasos=0;
  while(e.abierto&&pasos<500){const p=tour[e.indice];e=p.tipo==='ir'?reducir(e,{tipo:'clic'},n,tour,'/x'):reducir(e,eventoDeTecla('ArrowRight','BODY')!,n,tour,p.href);pasos++;}
  assert.equal(e.terminado,true);assert.ok(pasos<=n);
});

// ---- Estado (retomar tras recargar)
test('estado: el paso y «activo» se guardan y se leen; Esc/Omitir/Terminar lo apagan; una pista distinta no hereda el paso de otra',()=>{
  const datos=new Map<string,string>(),a:Almacen={getItem:k=>datos.get(k)??null,setItem:(k,v)=>{datos.set(k,v);},removeItem:k=>{datos.delete(k);},key:i=>[...datos.keys()][i]??null,get length(){return datos.size;}};
  const k=claveEstado('u','t','propietario');
  actualizarEstado(a,k,{paso:'connections.clave',visto:true,activo:true});
  const leido=leerEstado(a,k);assert.equal(leido.activo,true);assert.equal(tourDuenio.findIndex(p=>p.id===leido.paso),idx('connections.clave'),'tras recargar se retoma exactamente ahí');
  assert.equal(actualizarEstado(a,k,{activo:false}).paso,'connections.clave','Esc conserva el paso para «Retomar»');
  assert.equal(leerEstado(a,k).activo,false);
  assert.equal(leerEstado(a,claveEstado('u','t','lector')).activo,false);assert.equal(ESTADO_VACIO.activo,false);
  a.setItem(k,JSON.stringify({paso:'ya-no-existe',activo:true}));assert.equal(construirTour('propietario').findIndex(p=>p.id===leerEstado(a,k).paso),-1,'un paso que ya no existe no reabre nada');
  const ctx=leer('src/components/onboarding/contexto.tsx');
  assert.match(ctx,/leido\.activo&&!leido\.descartado/);assert.match(ctx,/guardar\(\{paso:p\.id,visto:true,activo:true\}\)/);assert.match(ctx,/guardar\(\{activo:false\}\)/);
});

// ---- Marcado accesible
const T={es:traductor('es'),en:traductor('en')};
const baseTarjeta={ilu:'nodos',n:7,total:80,grupoN:3,grupoTotal:24,ruta:{nombres:['Hoy','Pregúntale','CFO','Problemas'],actual:2},anterior:noop,omitir:noop,primario:noop};
for(const idioma of ['es','en'] as const){
  test(`tarjeta (${idioma}): paso «ir» = dialog no modal con «Siguiente» como primario (nunca «Llévame»), un solo anuncio, ruta con pantalla actual, sin style=`,()=>{
    const t=T[idioma],dic=idioma==='es'?ESP:ING;
    const html=renderToStaticMarkup(<TarjetaRecorrido t={t} tipo="ir" titulo={t('onb.tour.ir.titulo',{pantalla:'Problemas'})} cuerpo={t('onb.tour.ir.cuerpo',{nombre:'Problemas'})} {...baseTarjeta}/>);
    assert.match(html,/role="dialog"/);assert.doesNotMatch(html,/aria-modal|\bstyle=|tabindex/i);
    assert.equal((html.match(/role="status"/g)??[]).length,1,'«Paso n de N» se anuncia una vez');assert.doesNotMatch(html,/aria-live/);
    assert.match(html,/class="onb-cab" aria-hidden="true"/);
    assert.match(html,new RegExp(`data-onb-primario[^>]*>${dic['onb.ui.siguiente']}<`));assert.doesNotMatch(html,/Llévame|Take me there/);
    assert.match(html,/<progress[^>]*max="80"[^>]*value="7"/);assert.match(html,/<ol class="onb-ruta" aria-label=/);
    assert.equal((html.match(/aria-current="step"/g)??[]).length,1);assert.match(html,/<li[^>]*data-actual[^>]*>CFO</);
    assert.ok(html.includes(dic['onb.ui.omitir'])&&html.includes(dic['onb.ui.anterior']));
  });
}
test('tarjeta: paso informativo usa «Siguiente»; el cierre no lista pantallas, muestra «Ir a Configuración» y «Terminar», sin «Omitir», y no repite el contador de pantalla',()=>{
  const t=T.es;
  const info=renderToStaticMarkup(<TarjetaRecorrido t={t} tipo="info" titulo="Qué es" cuerpo="Cuerpo" {...baseTarjeta}/>);
  assert.match(info,/data-onb-primario[^>]*>Siguiente</);assert.match(info,/Pantalla 3 de 24/);
  const cierre=renderToStaticMarkup(<TarjetaRecorrido t={t} tipo="cierre" titulo={t('onb.tour.cierre.titulo')} cuerpo={t('onb.tour.cierre.cuerpo')} mostrarSetup irSetup={noop} {...baseTarjeta} ilu="cierre" n={80} ruta={{nombres:[],actual:-1}}/>);
  assert.match(cierre,/data-onb-primario[^>]*>Terminar</);assert.match(cierre,/Ir a Configuración/);assert.doesNotMatch(cierre,/Omitir recorrido/);assert.match(cierre,/Terminaste el recorrido/);assert.match(cierre,/Puedes repetirlo o saltar a cualquier pantalla desde Guía\./);assert.doesNotMatch(cierre,/Pasaste por|onb-ruta|Ya conoces cada pantalla|de tu rol/,'el cierre no afirma lo que no puede saber ni repite la ruta');
  assert.doesNotMatch(cierre,/Pantalla \d+ de/);assert.doesNotMatch(cierre,/aria-current="step"/,'en el cierre ninguna pantalla queda marcada como actual');assert.match(cierre,/ilu-grueso/,'checkmark que se dibuja');
  assert.doesNotMatch(renderToStaticMarkup(<TarjetaRecorrido t={t} tipo="cierre" titulo="x" cuerpo="y" {...baseTarjeta} mostrarSetup={false}/>),/Ir a Configuración/,'la consola de plataforma no tiene Configuración');
  assert.doesNotMatch(renderToStaticMarkup(<TarjetaRecorrido t={t} tipo="info" titulo="x" cuerpo="y" {...baseTarjeta} n={1}/>),/>Anterior</,'sin «Anterior» en el primer paso');
  assert.match(renderToStaticMarkup(<TarjetaRecorrido t={t} tipo="info" titulo="x" cuerpo="y" sinObjetivo centrada {...baseTarjeta}/>),/data-centrada="true"[\s\S]*Esta parte de la pantalla aún no está disponible/,'destino ausente: tarjeta centrada con aviso');
});
test('cierre sin lista falsa: el mismo texto para corto, completo y plataforma, sin «tu rol», sin número a mano y sin ruta de pantallas',()=>{
  for(const [clave,dic] of [['es',ESP],['en',ING]] as const){
    const cuerpo=dic['onb.tour.cierre.titulo']+' '+dic['onb.tour.cierre.cuerpo'];
    assert.doesNotMatch(cuerpo,/tu rol|your role|cada pantalla|every screen|\d/,clave);
    assert.equal(variables(dic['onb.tour.cierre.cuerpo']),'',clave);
  }
  assert.equal(ESP['onb.tour.cierre.titulo'],'Terminaste el recorrido');assert.equal(ING['onb.tour.cierre.titulo'],'You finished the tour');
  assert.match(leer('src/components/onboarding/guia.tsx'),/ruta=\{\{nombres:cierre\?\[\]:nombres,/,'en el cierre no se pinta la ruta de pantallas');
  assert.doesNotMatch(leer('src/components/onboarding/guia.tsx'),/onb\.tour\.cierre\.resumen/);
});
test('paso «ir»: título, cuerpo y etiqueta usan el MISMO nombre, el rótulo del menú (etiquetaItem), no el title del enlace; el cuerpo es corto y no repite el título',()=>{
  const guia=leer('src/components/onboarding/guia.tsx');
  assert.match(guia,/t\('onb\.tour\.ir\.titulo',\{pantalla\}\)/);assert.match(guia,/t\('onb\.tour\.ir\.cuerpo',\{nombre:pantalla\}\)/);assert.match(guia,/t\('onb\.tour\.clic',\{nombre:pantalla\}\)/);
  assert.doesNotMatch(guia,/onb\.tour\.clic',\{nombre:nombreEl\}|onb\.tour\.ir\.cuerpo',\{nombre:nombreEl/,'el nombre leído del DOM (aria-label/title/texto) ya no se usa en pasos «ir»');
  assert.match(guia,/pantalla=nombrePantalla\(paso\.pantalla\)/);assert.match(guia,/etiquetaItem\(t,item\)/);
  for(const [clave,dic] of [['es',ESP],['en',ING]] as const){
    assert.ok(dic['onb.tour.ir.cuerpo'].length<=80,clave+': cuerpo corto');
    const t=T[clave];
    for(const nombre of ['Hoy','Problemas'])for(const k of ['onb.tour.ir.titulo','onb.tour.ir.cuerpo','onb.tour.clic'] as const)assert.ok(t(k,{pantalla:nombre,nombre}).includes(nombre),clave+k);
  }
});
test('textos de pantalla: el cuerpo no repite el título como prefijo («Importaciones: …») y «qué es» y «elemento clave» no se repiten frase por frase',()=>{
  const frases=(x:string)=>x.split(/[.;:]\s+|[.;:]$/).map(f=>f.trim().toLowerCase()).filter(f=>f.length>=25);
  for(const [clave,dic] of [['es',ESP],['en',ING]] as const){
    for(const pista of PISTAS){
      for(const modo of ['completo'] as const){
        const pasos=construirTour(pista,modo),porPantalla=new Map<string,Record<string,string>>();
        for(const p of pasos){
          if(p.tipo!=='info'||!p.cuerpo)continue;
          const cuerpo=dic[p.cuerpo],titulo=p.titulo?dic[p.titulo]:'';
          if(titulo)assert.ok(!cuerpo.toLowerCase().startsWith(titulo.toLowerCase()+':'),`${clave}:${pista}:${p.id} repite su título como prefijo`);
          for(const nombre of [dic['nav.item.'+slugDe(p.pantalla!)],dic['tr.pf.n'+({platform:'Resumen','platform-organizaciones':'Organizaciones','platform-costos-ia':'CostosIa','platform-auditoria':'Auditoria'} as Record<string,string>)[slugDe(p.pantalla!)]]].filter(Boolean))assert.ok(!cuerpo.toLowerCase().startsWith(nombre.toLowerCase()+':'),`${clave}:${pista}:${p.id} empieza con el nombre del menú «${nombre}: »`);
          const g=porPantalla.get(p.pantalla!)??{};g[p.clave]=cuerpo;porPantalla.set(p.pantalla!,g);
        }
        for(const [href,g] of porPantalla)if(g.que&&g.clave){const a=new Set(frases(g.que));assert.deepEqual(frases(g.clave).filter(f=>a.has(f)),[],`${clave}:${pista}:${href} repite una frase entre «qué es» y «clave»`);assert.notEqual(g.que,g.clave);}
      }
    }
  }
});
test('texto por rol: operador y lector no leen periodos ni conciliación, nadie lee una promesa que su rol no cumple, y cada variante existe en es y en',()=>{
  for(const k of CLAVES_TEXTO_PISTA){assert.ok(ESP[k]&&ING[k],k);assert.equal(variables(ESP[k]),variables(ING[k]),k);assert.ok((CLAVES_UI as readonly string[]).includes(k),k+' declarada en CLAVES_UI');}
  for(const mapa of Object.values(TEXTO_PISTA))for(const pista of Object.keys(mapa))assert.ok((PISTAS as readonly string[]).includes(pista),pista);
  const texto=(pista:(typeof PISTAS)[number],dic:Record<string,string>,filtro:(id:string)=>boolean)=>construirTour(pista).filter(p=>filtro(p.id)).flatMap(p=>[p.titulo,p.cuerpo]).filter(Boolean).map(k=>dic[k!]).join(' | ');
  for(const dic of [ESP,ING]){
    for(const pista of ['operador','lector'] as const)assert.doesNotMatch(texto(pista,dic,id=>id==='overview.clave'),/period|reconcil|concili|conciliar/i,pista+' overview.clave');
    for(const pista of ['lector','analista','operador'] as const)assert.doesNotMatch(texto(pista,dic,id=>id.startsWith('recommendations.')),/decidir|decide|deciding|decidi/i,pista+' recommendations');
    for(const pista of ['lector','analista'] as const)assert.doesNotMatch(texto(pista,dic,id=>id.startsWith('interventions.')),/lo que hiciste|what you did/i,pista+' interventions');
    assert.doesNotMatch(texto('propietario',dic,id=>id==='interventions.accion'),/te asignaron|assigned to you/i);
    assert.doesNotMatch(texto('operador',dic,id=>id==='operador.hoy'||id==='overview.que'),/decidir|decide /i,'operador hoy');
  }
  assert.match(texto('operador',ESP,id=>id==='interventions.accion'),/te asignaron/,'el operador sí trabaja intervenciones asignadas');
});
test('datos que no se pueden comprobar no se escriben a mano: sin «cuatro», «veinticuatro horas» ni «seis» en Hoy ni en CCO',()=>{
  for(const [clave,dic] of [['es',ESP],['en',ING]] as const){
    const hoy=dic['onb.propietario.hoy.titulo']+' '+dic['onb.propietario.hoy.cuerpo']+' '+dic['onb.pant.cco.desc'];
    assert.doesNotMatch(hoy,/cuatro|veinticuatro|seis|\bfour\b|twenty|\bsix\b|24/i,clave);
  }
  assert.match(ESP['onb.propietario.hoy.cuerpo'],/respuestas con demora/);assert.match(ING['onb.propietario.hoy.cuerpo'],/delayed replies/);
});
test('plataforma: los títulos de las tarjetas son los rótulos del menú de la consola, la etiqueta del rol se traduce y la guía no ofrece Configuración',()=>{
  const nav={resumen:'Resumen',organizaciones:'Organizaciones',costos:'CostosIa',auditoria:'Auditoria'};
  for(const [clave,dic] of [['es',ESP],['en',ING]] as const)for(const [id,n] of Object.entries(nav))assert.equal(dic[`onb.plataforma.${id}.titulo`],dic['tr.pf.n'+n],`${clave}:${id}`);
  assert.equal(ESP['tr.pf.plataforma'],'Plataforma');assert.equal(ING['tr.pf.plataforma'],'Platform');
  const layout=leer('src/app/(app)/platform/layout.tsx');assert.match(layout,/rolEtiqueta: t\('tr\.pf\.plataforma'\)/);assert.doesNotMatch(layout,/rolEtiqueta: 'Plataforma'/);
  assert.match(leer('src/components/onboarding/guia.tsx'),/abrirSetup=\{c\.pista==='plataforma'\?undefined:c\.abrirSetup\}/);
  const menu=renderToStaticMarkup(<MenuGuia t={T.es} contexto="Rovaq · Plataforma" tienePaso={false} mostrarChecklistOpcion={false} descartado={false} iniciar={noop} retomar={noop} mostrarChecklist={noop} noVolver={noop} cerrar={noop}/>);
  assert.doesNotMatch(menu,/Ver configuración completa/);
});
test('ventana de la ruta: pocas pantallas alrededor de la actual con «…» a los lados',()=>{
  const nombres=['A','B','C','D','E','F','G','H'];
  assert.deepEqual(ventanaRuta(nombres,0),{items:['A','B','C','D','E'].map((nombre,i)=>({nombre,actual:i===0})),antes:false,despues:true});
  const medio=ventanaRuta(nombres,3);assert.equal(medio.items.length,5);assert.ok(medio.antes&&medio.despues&&medio.items.some(i=>i.actual&&i.nombre==='D'));
  const fin=ventanaRuta(nombres,7);assert.equal(fin.items.at(-1)!.nombre,'H');assert.equal(fin.despues,false);assert.equal(ventanaRuta(['A','B'],1).antes,false);
});
test('etiqueta y capa de foco: decorativos para lectores de pantalla, sin style=; la etiqueta dice qué apretar con el nombre real',()=>{
  const t=T.es,etq=renderToStaticMarkup(<EtiquetaObjetivo texto={t('onb.tour.clic',{nombre:'Problemas'})}/>);
  assert.match(etq,/aria-hidden="true"/);assert.match(etq,/Haz clic aquí: Problemas/);assert.doesNotMatch(etq,/\bstyle=/);assert.match(etq,/<svg/);
  const capa=renderToStaticMarkup(<CapaFoco scrim/>);assert.match(capa,/aria-hidden="true"/);assert.match(capa,/data-sin-foco/);assert.doesNotMatch(capa,/\bstyle=|<button|<a /);
  assert.equal(ESP['onb.tour.entrada'],undefined,'el aviso «Ahora: X» repetía el título y se retiró');assert.doesNotMatch(leer('src/components/onboarding/guia.tsx'),/BannerPantalla|onb\.tour\.entrada/);
  assert.match(renderToStaticMarkup(<EtiquetaObjetivo texto={T.en('onb.tour.clic',{nombre:'Problems'})}/>),/Click here: Problems/);
});
test('menú Guía: repetir, retomar y saltar a una pantalla concreta (lista con la actual marcada)',()=>{
  const t=T.en,html=renderToStaticMarkup(<MenuGuia t={t} contexto="Org · Owner" tienePaso mostrarChecklistOpcion descartado={false} iniciar={noop} retomar={noop} mostrarChecklist={noop} noVolver={noop} cerrar={noop}
   pantallas={[{href:'/overview',nombre:'Today',actual:false},{href:'/problems',nombre:'Problems',actual:true}]} irAPantalla={noop}/>);
  assert.match(html,/Repeat the tour|Resume where I left off/);assert.match(html,/Resume where I left off/);assert.match(html,/Jump to a screen/);assert.match(html,/aria-label="Tour screens"/);
  assert.match(html,/aria-current="step"[^>]*>Problems</);assert.doesNotMatch(html,/\bstyle=/);
});
test('ilustraciones: una para cada familia, SVG en línea sin imágenes ni referencias externas ni style=, decorativas; cada pantalla apunta a una ilustración que existe',()=>{
  for(const tipo of TIPOS_ILUSTRACION){const html=renderToStaticMarkup(<Ilustracion tipo={tipo}/>);
   assert.match(html,/^<svg class="onb-ilu" viewBox="0 0 160 96" aria-hidden="true" focusable="false">/,tipo);assert.doesNotMatch(html,/\bstyle=|<image|<foreignObject|<script|href=|xlink|https?:|data:/i,tipo);assert.ok(html.length>200,tipo);}
  assert.equal(TIPOS_ILUSTRACION.length,14);
  for(const [href,d] of Object.entries(PANTALLAS))assert.ok((TIPOS_ILUSTRACION as readonly string[]).includes(d.ilu),href);
  assert.match(renderToStaticMarkup(<Ilustracion tipo="no-existe"/>),/ilu-barra/,'una ilustración desconocida cae en la de barras');
  assert.match(renderToStaticMarkup(<Ilustracion tipo="barras"/>),/ilu-arco/,'barras que crecen y un donut que se dibuja');
  assert.match(renderToStaticMarkup(<Ilustracion tipo="nodos"/>),/ilu-traza/,'nodos que se conectan');
});

// ---- Código y CSS: CSP, movimiento reducido, forced-colors, móvil
test('los componentes del recorrido no usan style= ni librerías ni CDN; la posición se escribe por CSSOM',()=>{
  for(const f of ['contexto.tsx','guia.tsx','paneles.tsx','checklist.tsx','ilustraciones.tsx','objetivo.ts']){const src=leer('src/components/onboarding/'+f);
   assert.doesNotMatch(src,/\bstyle=\{|\bstyle="|setAttribute\('style'|\.cssText|insertAdjacentHTML|dangerouslySetInnerHTML/,f);assert.doesNotMatch(src,/https?:\/\//,f+' sin CDN');
   assert.doesNotMatch(src,/from '(?!react|next|\.)[^']+'/,f+' importa una librería externa');}
  const guia=leer('src/components/onboarding/guia.tsx');
  assert.match(guia,/style\.setProperty\('--tour-x'/);assert.match(guia,/style\.setProperty\('--lab-x'/);
});
test('scroll guiado y espera del elemento: scrollIntoView suave (instantáneo con reducir movimiento) y MutationObserver con tope de 4 s; si no existe, el paso se degrada',()=>{
  const guia=leer('src/components/onboarding/guia.tsx'),obj=leer('src/components/onboarding/objetivo.ts');
  assert.match(guia,/scrollIntoView\(\{behavior:reducirMovimiento\(\)\?'auto':'smooth',block:estrecha\?'start':'center'\}\)/);
  assert.match(obj,/new MutationObserver/);assert.match(obj,/tope = 4000/);assert.match(obj,/alAgotar\(\)/);
  assert.match(guia,/centrada=cierre\|\|el===null/,'sin elemento: tarjeta centrada, sin fallar');assert.match(guia,/sinObjetivo=\{!cierre&&paso\.tipo!=='ir'&&el===null\}/,'en un paso «ir» sin elemento (menú plegado) no se muestra la nota: la guía navega directo');
  assert.match(guia,/addEventListener\('click',alClic,true\)/,'el clic real se escucha sin impedirlo');assert.doesNotMatch(guia,/alClic[^\n]*preventDefault|stopPropagation/);
});
test('CSS: capa sin eventos de puntero (no bloquea el objetivo ni la salida), anillo que pulsa y recorte que se desliza solo con movimiento permitido; forced-colors; móvil sobre la barra inferior',()=>{
  const css=leer('src/components/onboarding/onboarding.css');
  const fuera=css.replace(/@media \(prefers-reduced-motion:no-preference\) \{[\s\S]*?\n\}\n/,'');
  assert.doesNotMatch(fuera,/animation\s*:|animation-delay|transition\s*:|@keyframes/,'ningún movimiento fuera de no-preference');
  assert.equal((css.match(/@media \(prefers-reduced-motion/g)??[]).length,1);assert.doesNotMatch(css,/reduced-motion:\s*reduce/);
  for(const clase of ['.onb-capa','.onb-etiqueta'])assert.match(css,new RegExp(clase.replace('.','\\.')+' \\{[^}]*pointer-events:none'),clase);
  assert.match(css,/\.onb-capa\[data-animar\] \.onb-foco \{ transition:transform 380ms/);assert.match(css,/\.onb-foco::after \{ animation:onb-pulso/);assert.match(css,/@keyframes onb-pulso/);
  assert.match(css,/box-shadow:0 0 0 2px #fff, 0 0 0 4px var\(--onb-resalte\), 0 0 0 9999px/,'recorte con sombra gigante + anillo de contraste');
  assert.match(css,/@media \(forced-colors:active\)[\s\S]*\.onb-foco \{ box-shadow:none; outline:3px solid Highlight/);
  assert.match(css,/@media \(max-width:767px\)[\s\S]*bottom:calc\(var\(--nav-total, 0px\) \+ 12px\)/);
  assert.match(css,/stroke-dashoffset/);assert.match(css,/@keyframes onb-barra/);assert.match(css,/@keyframes onb-arco/);assert.match(css,/@keyframes onb-pop/);
  assert.doesNotMatch(css,/onb-entrada|onb-banner/,'sin estilos del aviso retirado');
});
test('botón Guía compacto: ~26 px, texto 12 px, sin bloque oscuro, punto de acento, área táctil ≥ 36 px solo en pantallas táctiles, claro y oscuro con tokens',()=>{
  const css=leer('src/components/onboarding/onboarding.css'),linea=css.split('\n').find(l=>l.startsWith('.workspace-header .onb-boton, .onb-boton {'))!;
  assert.match(linea,/height:26px/);assert.match(linea,/font:500 12px/);assert.match(linea,/background:var\(--ui-soft\)/);assert.match(linea,/border:1px solid var\(--ui-border\)/);assert.doesNotMatch(linea,/var\(--ink\)\s*;|background:var\(--ink\)|var\(--ui-action\)/);
  assert.match(css,/\.onb-boton-signo \{[^}]*width:14px; height:14px/);assert.match(css,/\.onb-boton-punto \{[^}]*width:6px; height:6px/);assert.match(css,/@media \(pointer:coarse\) \{ \.onb-boton::after \{ content:""; position:absolute; inset:-9px -7px/);assert.match(css,/max-width:819px\) \{\s*:root:root \.workspace-header \.onb-boton \{ height:44px; min-width:44px/); // en celular la caja táctil real es de 44 px
  assert.match(css,/\.workspace-header \.onb-boton:hover[^{]*\{ background:var\(--ui-surface\)/);
  assert.match(leer('src/components/onboarding/guia.tsx'),/onb-boton-punto/);
});

// ---- Textos
test('claves del recorrido por pantallas: existen en es y en con las mismas {variables}, sin cifras ni afirmaciones, y todas las que el recorrido usa están declaradas',()=>{
  const usadas=new Set<string>(CLAVES_PANTALLAS);
  for(const pista of PISTAS)for(const p of construirTour(pista))for(const k of [p.titulo,p.cuerpo])if(k)usadas.add(k);
  for(const k of usadas){assert.ok(k in ESP&&k in ING,'falta '+k);assert.equal(variables(ESP[k]),variables(ING[k]),k);}
  for(const k of Object.keys(ESP).filter(x=>/^onb\.(tour|pant)\./.test(x)||x==='onb.check.esperan'))assert.doesNotMatch(ESP[k]+ING[k],/\d|%|\bRLS\b|SOC\s?2|ISO\s?27|respaldo|backup|\bSLA\b|certific/i,k);
  assert.equal(CLAVES_PANTALLAS.length,Object.keys(PANTALLAS).reduce((n,h)=>n+clavesDePantalla(h).length,0));
  for(const k of CLAVES_PANTALLAS)assert.ok((CLAVES_UI as readonly string[]).includes(k),k);
  for(const h of Object.keys(PANTALLAS)){assert.ok(ESP[`onb.pant.${slugDe(h)}.desc`]);}
  assert.equal(variables(ESP['onb.tour.ir.titulo']),'pantalla');assert.equal(variables(ESP['onb.tour.ir.cuerpo']),'nombre');assert.equal(variables(ESP['onb.tour.clic']),'nombre');assert.equal(ESP['onb.tour.cierre.resumen'],undefined);assert.equal(ING['onb.tour.cierre.resumen'],undefined);
  assert.match(ESP['onb.tour.clic'],/^Haz clic aquí/);assert.match(ING['onb.tour.clic'],/^Click here/);assert.equal(ESP['onb.tour.llevame'],undefined);assert.equal(ING['onb.tour.llevame'],undefined);
});
test('textos por pantalla: no prometen escrituras al lector ni dinero al operador; el cierre lleva a Configuración',()=>{
  const texto=(pista:(typeof ROLES_PISTA)[number])=>construirTour(pista).map(p=>[p.titulo,p.cuerpo]).flat().filter(Boolean).map(k=>ESP[k!]).join(' ');
  assert.doesNotMatch(texto('lector'),/\b(importa|conecta|invita|aprueba|carga|sube)\b/i);
  assert.equal(ESP['onb.tour.cierre.setup'],'Ir a Configuración');assert.equal(ING['onb.tour.cierre.setup'],'Go to Setup');
  assert.match(leer('src/components/onboarding/contexto.tsx'),/router\.push\('\/setup'\)/);
});

// ---- Checklist de Hoy
test('checklist: «n de m que puedes hacer ahora» y cuántos esperan a un tercero (nunca «2 de 2 listos» con pasos en espera)',()=>{
  assert.equal(ESP['onb.check.progreso'],'{hechos} de {total} que puedes hacer ahora');assert.equal(ING['onb.check.progreso'],'{hechos} of {total} you can do now');
  assert.match(ESP['onb.check.esperan'],/tercero/);assert.match(ING['onb.check.esperan'],/third party/);
  const l=calcularChecklist('propietario',normalizarSenales({historial_importado:true,corte_publicado:true}));
  assert.deepEqual(l.progreso,{hechos:2,total:2});assert.equal(l.esperan,1,'el correo de acceso sigue en espera');
  assert.equal(calcularChecklist('lector',null).esperan,0);
  const src=leer('src/components/onboarding/checklist.tsx');
  assert.match(src,/lista\.completo&&lista\.esperan===0/,'una lista con pasos en espera no se oculta como si estuviera completa');assert.match(src,/onb\.check\.esperan/);
});
