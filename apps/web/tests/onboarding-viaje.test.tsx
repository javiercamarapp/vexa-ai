// Onboarding: viaje automático de un paso «ir» (lib/onboarding/viaje.mjs) y veracidad de los textos del recorrido.
// Sin DOM: la lógica se prueba pura y con temporizadores simulados (node:test mock timers); el marcado, con renderToStaticMarkup.
// El foco real, Tab, el clic fuera de la tarjeta, el lector de pantalla y el cambio de página quedan para el navegador.
import {test,mock,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {CUENTA_MS,FALLO_MS,armadoTras,planearViaje,reducirViaje,estadoViajeInicial,crearViaje,MOTIVOS_CANCELACION} from '../src/lib/onboarding/viaje.mjs';
import {estadoInicial,reducir,eventoDeTecla} from '../src/lib/onboarding/recorrido.mjs';
import {construirTour} from '../src/lib/onboarding/tour.mjs';
import {TarjetaRecorrido,type ViajeUi} from '../src/components/onboarding/paneles';
import {traductor} from '../src/lib/i18n';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const ESP=es as Record<string,string>,ING=en as Record<string,string>;
const noop=()=>{};
afterEach(()=>{mock.timers.reset();});
/** Avanza el reloj simulado en pasos cortos: los temporizadores que se programan dentro de otro se ejecutan en orden. */
const avanzar=(ms:number)=>{for(let t=0;t<ms;t+=250)mock.timers.tick(Math.min(250,ms-t));};

/** Un viaje con temporizadores simulados que cuenta cuántas veces se hizo el clic/push y guarda cada cambio de fase. */
function nuevo(){
  mock.timers.enable({apis:['setTimeout']});
  const r={viajes:0,fases:[] as string[]};
  const v=crearViaje({alViajar:()=>{r.viajes++;},alCambiar:e=>{r.fases.push(e.fase+':'+e.restan);}});
  return {v,r};
}
const plan=(extra={})=>planearViaje({tipo:'ir',armado:true,elemento:'existe',...extra});
const arrancar=(extra={})=>{const x=nuevo();x.v.enviar({tipo:'planear',plan:plan(extra)});return x;};

// ---- Decisión: armar o no
test('planearViaje: solo arma un paso «ir» alcanzado avanzando, con el elemento ya buscado y sin nada que proteger',()=>{
  const ok=plan();
  assert.deepEqual([ok.armar,ok.ms,ok.manual,ok.motivo],[true,CUENTA_MS,false,'ok']);
  assert.equal(CUENTA_MS,3000);
  assert.equal(plan({elemento:'buscando'}).armar,false,'mientras se busca el elemento no se arma');
  assert.equal(plan({armado:false}).armar,false,'recarga, Anterior o ruta ajena: no viaja solo');
  assert.equal(plan({armado:false}).manual,false,'sin viaje armado no se ofrece «Ir a …», basta Siguiente');
  assert.equal(planearViaje({tipo:'info',armado:true,elemento:'existe'}).armar,false,'un paso informativo nunca viaja');
});
test('planearViaje: menú plegado o cajón móvil (el elemento no existe) espera lo mismo: nunca menos de 3 s',()=>{
  const sin=plan({elemento:'ausente'});
  assert.equal(sin.armar,true);assert.ok(sin.ms>=3000,'nunca menos de 3 s (lector de pantalla)');assert.equal(sin.ms,plan().ms,'la misma cuenta que con elemento');
});
test('planearViaje: movimiento reducido, foco en un campo o formulario modificado NO viajan y ofrecen el botón manual',()=>{
  for(const [extra,motivo] of [[{movimientoReducido:true},'movimiento-reducido'],[{focoEnCampo:true},'campo'],[{formularioSucio:true},'formulario']] as const){
    const p=plan(extra);
    assert.equal(p.armar,false,motivo);assert.equal(p.manual,true,motivo);assert.equal(p.motivo,motivo);
  }
});
test('armadoTras: solo Siguiente y abrir/retomar arman el viaje; Anterior, cerrar, ruta y restaurar tras recargar no',()=>{
  assert.equal(armadoTras('siguiente'),true);assert.equal(armadoTras('abrir'),true);
  for(const o of ['anterior','cerrar','ruta','clic','restaurar','recarga'])assert.equal(armadoTras(o),false,o);
  // Anterior después de haber avanzado NO reactiva el viaje aunque el paso anterior sí viajó.
  let armado=armadoTras('siguiente');assert.equal(armado,true);
  armado=armadoTras('anterior');assert.equal(armado,false);
  assert.equal(plan({armado}).armar,false);
});

// ---- La cuenta
test('cuenta completa: tras 3 s viaja UNA sola vez y los segundos bajan de 3 a 1',()=>{
  const {v,r}=arrancar();
  assert.equal(v.estado().fase,'cuenta');assert.equal(v.estado().restan,3);
  avanzar(999);assert.equal(r.viajes,0);assert.equal(v.estado().restan,3);
  avanzar(1);assert.equal(v.estado().restan,2);
  avanzar(1000);assert.equal(v.estado().restan,1);assert.equal(r.viajes,0,'a 2 s todavía no viaja');
  avanzar(999);assert.equal(r.viajes,0,'a 2.999 s todavía no');
  avanzar(1);assert.equal(r.viajes,1);assert.equal(v.estado().fase,'viajando');
  avanzar(60000);assert.equal(r.viajes,1,'nunca dos viajes');
});
for(const motivo of MOTIVOS_CANCELACION){
  test(`cancelar por «${motivo}» detiene la cuenta: no viaja solo y queda el botón manual`,()=>{
    const {v,r}=arrancar();
    avanzar(1000);
    v.enviar({tipo:'cancelar',motivo});
    assert.equal(v.estado().fase,'manual');assert.equal(v.estado().motivo,motivo);
    avanzar(60000);assert.equal(r.viajes,0,'ni siquiera al pasar mucho tiempo');
    v.enviar({tipo:'manual'});assert.equal(r.viajes,1,'el botón manual sí viaja, una vez');
    v.enviar({tipo:'manual'});assert.equal(r.viajes,1);
  });
}
test('los motivos de cancelación son exactamente: quedarme, Escape, Tab, clic fuera y campo',()=>{
  assert.deepEqual([...MOTIVOS_CANCELACION].sort(),['campo','clic-fuera','escape','quedarme','tab']);
});
test('Esc cierra el recorrido y con él la cuenta: no viaja nada después',()=>{
  const ev=eventoDeTecla('Escape','BODY');assert.deepEqual(ev,{tipo:'cerrar'});
  const pasos=construirTour('propietario');
  const abierto={...estadoInicial(),abierto:true,indice:pasos.findIndex(p=>p.tipo==='ir')};
  assert.equal(reducir(abierto,ev!,pasos.length,pasos,'/zzz').abierto,false);
  const {v,r}=arrancar();avanzar(1500);
  v.reiniciar(); // lo que hace la guía al cerrarse: el paso desaparece
  avanzar(60000);assert.equal(r.viajes,0);assert.equal(v.estado().fase,'inactivo');
  assert.equal(eventoDeTecla('Tab','BODY'),null,'Tab no es una tecla del recorrido: la cancela el viaje');
});
test('doble disparo: Siguiente y el temporizador avanzan exactamente un viaje',()=>{
  const a=arrancar();avanzar(1000);
  a.v.enviar({tipo:'siguiente'});assert.equal(a.r.viajes,1);
  avanzar(10000);assert.equal(a.r.viajes,1,'el temporizador ya no dispara');
  a.v.enviar({tipo:'siguiente'});assert.equal(a.r.viajes,1,'ni un segundo Siguiente');
  mock.timers.reset();
  const b=arrancar();avanzar(3000);assert.equal(b.r.viajes,1);
  b.v.enviar({tipo:'siguiente'});b.v.enviar({tipo:'manual'});assert.equal(b.r.viajes,1,'Siguiente tras el viaje automático no lo repite');
  // y en la máquina del recorrido: un clic y su ruta avanzan exactamente un paso
  const pasos=construirTour('propietario'),i=pasos.findIndex(p=>p.tipo==='ir');
  let rec={...estadoInicial(),abierto:true,indice:i};
  rec=reducir(rec,{tipo:'ruta',ruta:pasos[i].href!},pasos.length,pasos,'/zzz');
  assert.equal(rec.indice,i+1);
  assert.equal(reducir(rec,{tipo:'ruta',ruta:pasos[i].href!},pasos.length,pasos,'/zzz').indice,i+1,'la misma ruta dos veces no avanza otro paso');
});
test('movimiento reducido o formulario sucio: no se auto-viaja nunca, solo con el botón «Ir a …»',()=>{
  for(const extra of [{movimientoReducido:true},{formularioSucio:true},{focoEnCampo:true}]){
    mock.timers.reset();
    const {v,r}=arrancar(extra);
    assert.equal(v.estado().fase,'manual');
    avanzar(120000);assert.equal(r.viajes,0,JSON.stringify(extra));
    v.enviar({tipo:'siguiente'});assert.equal(r.viajes,1,'Siguiente también lo ejecuta');
  }
});
test('recarga con la tarjeta abierta: no hay cuenta ni viaje, y Siguiente sigue funcionando',()=>{
  mock.timers.reset();
  const {v,r}=arrancar({armado:armadoTras('restaurar')});
  assert.equal(v.estado().fase,'inactivo');
  avanzar(120000);assert.equal(r.viajes,0);
  v.enviar({tipo:'siguiente'});assert.equal(r.viajes,1);
});
test('Anterior hacia un paso «ir» no lo viaja: el paso se alcanzó sin avanzar',()=>{
  const {v,r}=arrancar({armado:armadoTras('anterior')});
  avanzar(120000);assert.equal(r.viajes,0);assert.equal(v.estado().fase,'inactivo');
});

// ---- Salida por fallo
test('salida por fallo: si no llega la ruta a los 3 s del clic, el paso sale por «No pude abrir esta pantalla»',()=>{
  const {v,r}=arrancar();avanzar(3000);
  assert.equal(r.viajes,1);assert.equal(v.estado().fase,'viajando');
  avanzar(FALLO_MS-1);assert.equal(v.estado().fase,'viajando','a 2.999 s todavía espera');
  avanzar(1);assert.equal(v.estado().fase,'fallo');
  assert.equal(FALLO_MS,3000);
  v.enviar({tipo:'siguiente'});assert.equal(r.viajes,1,'en fallo no se reintenta solo el viaje: la persona usa «Continuar»');
});
test('salida por fallo también tras Siguiente o tras un clic de la propia persona; si llega la ruta a tiempo no hay fallo',()=>{
  const a=arrancar();a.v.enviar({tipo:'siguiente'});avanzar(FALLO_MS);assert.equal(a.v.estado().fase,'fallo');
  mock.timers.reset();
  const b=arrancar();b.v.enviar({tipo:'clic'});assert.equal(b.r.viajes,0,'el clic ya lo hizo la persona');assert.equal(b.v.estado().fase,'viajando');
  avanzar(FALLO_MS);assert.equal(b.v.estado().fase,'fallo');
  mock.timers.reset();
  const c=arrancar();avanzar(3000);avanzar(1500);
  c.v.reiniciar(); // llegó la ruta: el recorrido cambia de paso y la guía reinicia el viaje
  avanzar(60000);assert.equal(c.v.estado().fase,'inactivo','una ruta que llegó a tiempo cancela el plazo: nunca cae en fallo');
});
test('el paso «ir» se completa por la ruta, no por el clic: sin ruta el recorrido no avanza',()=>{
  const pasos=construirTour('propietario'),i=pasos.findIndex(p=>p.tipo==='ir');
  const rec={...estadoInicial(),abierto:true,indice:i};
  assert.equal(reducir(rec,{tipo:'ruta',ruta:'/sin-acceso'},pasos.length,pasos,'/zzz').indice,i,'una ruta ajena (redirección) no completa el paso');
  assert.equal(reducirViaje(estadoViajeInicial(),{tipo:'siguiente'}).efecto,'viajar');
});

// ---- Marcado de la tarjeta
const base={ilu:'nodos',n:7,total:80,grupoN:3,grupoTotal:24,ruta:{nombres:['Hoy','Problemas'],actual:1},anterior:noop,omitir:noop,primario:noop};
const vi=(fase:ViajeUi['fase'],restan=3):ViajeUi=>({fase,restan,nombre:'Problemas',quedarme:noop,irManual:noop,continuar:noop});
for(const idioma of ['es','en'] as const){
  const t=traductor(idioma),d=idioma==='es'?ESP:ING;
  const tarjeta=(fase:ViajeUi['fase'],restan?:number)=>renderToStaticMarkup(<TarjetaRecorrido t={t} tipo="ir" titulo="x" cuerpo="y" {...base} viaje={vi(fase,restan)}/>);
  test(`tarjeta (${idioma}): la cuenta se ve, se anuncia una sola vez en una región status y ofrece «Quedarme aquí»`,()=>{
    const h=tarjeta('cuenta',3);
    assert.ok(h.includes(t('onb.tour.ir.cuenta',{nombre:'Problemas',n:3})),'texto visible de la cuenta');
    assert.match(h,/<progress[^>]*class="onb-cuenta-barra"[^>]*max="3"[^>]*value="0"/);
    assert.equal((h.match(/role="status"/g)??[]).length,2,'«Paso n de N» y el anuncio de la cuenta');
    assert.equal((h.match(/aria-live="polite"/g)??[]).length,1);
    assert.ok(h.includes(t('onb.tour.ir.anuncio',{nombre:'Problemas'})));
    assert.ok(!h.includes(t('onb.tour.ir.cuenta',{nombre:'Problemas',n:3}).replace(/<[^>]+>/g,''))||h.includes('aria-hidden="true">'+t('onb.tour.ir.cuenta',{nombre:'Problemas',n:3})),'el contador que cambia cada segundo no se anuncia');
    assert.match(h,/data-onb-quedarme[^>]*>[^<]*</);assert.ok(h.includes(d['onb.tour.ir.quedarme']));
    assert.doesNotMatch(h,new RegExp(d['onb.tour.ir.manual'].replace('{nombre}','Problemas')));
    assert.ok(tarjeta('cuenta',1).includes(t('onb.tour.ir.cuenta',{nombre:'Problemas',n:1})),'el contador baja');
  });
  test(`tarjeta (${idioma}): tras cancelar o con movimiento reducido queda «Ir a Problemas» y ya no hay cuenta ni «Quedarme aquí»`,()=>{
    const h=tarjeta('manual');
    assert.match(h,/data-onb-manual/);assert.ok(h.includes(t('onb.tour.ir.manual',{nombre:'Problemas'})));
    assert.ok(!h.includes(d['onb.tour.ir.quedarme']));assert.doesNotMatch(h,/data-onb-cuenta|<progress[^>]*onb-cuenta/);
    assert.equal((h.match(/aria-live/g)??[]).length,0);
  });
  test(`tarjeta (${idioma}): si no abre la pantalla dice «${d['onb.tour.ir.fallo']}» y el primario pasa a «Continuar» (nadie queda varado)`,()=>{
    const h=tarjeta('fallo');
    assert.ok(h.includes(d['onb.tour.ir.fallo']));
    assert.match(h,new RegExp(`data-onb-primario[^>]*>${d['onb.tour.ir.continuar']}<`));
    assert.ok(!new RegExp(`data-onb-primario[^>]*>${d['onb.ui.siguiente']}<`).test(h),'«Siguiente» no sigue ahí');
  });
  test(`tarjeta (${idioma}): sin viaje (paso informativo) no aparece nada del viaje`,()=>{
    const h=renderToStaticMarkup(<TarjetaRecorrido t={t} tipo="info" titulo="x" cuerpo="y" {...base} viaje={vi('cuenta')}/>);
    assert.doesNotMatch(h,/data-onb-quedarme|data-onb-manual|onb-cuenta/);
  });
}

// ---- Textos veraces
test('el cuerpo del paso «ir» solo promete llevar cuando va a viajar; si no, dice cómo ir a mano',()=>{
  assert.match(ESP['onb.tour.ir.cuerpoViaja'],/te llevo/i);assert.match(ING['onb.tour.ir.cuerpoViaja'],/take you/i);
  assert.doesNotMatch(ESP['onb.tour.ir.cuerpo'],/espera|llevo/i);assert.doesNotMatch(ING['onb.tour.ir.cuerpo'],/wait|take you/i);
  assert.match(ESP['onb.tour.ir.cuerpo'],/Siguiente/);assert.match(ING['onb.tour.ir.cuerpo'],/Next/);
  assert.equal(ESP['onb.tour.ir.quedarme'],'Quedarme aquí');assert.equal(ING['onb.tour.ir.quedarme'],'Stay here');
  assert.equal(ESP['onb.tour.ir.fallo'],'No pude abrir esta pantalla');assert.equal(ESP['onb.tour.ir.continuar'],'Continuar');
  assert.ok(ESP['onb.tour.ir.cuenta'].includes('{n} s')&&ING['onb.tour.ir.cuenta'].includes('{n} s'));
});
