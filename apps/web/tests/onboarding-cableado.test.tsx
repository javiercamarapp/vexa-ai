// Onboarding: CABLEADO del viaje automático (lib/onboarding/cableado.mjs + objetivo.ts + paneles.tsx). Sin DOM real (no hay jsdom): decisiones puras con temporizadores
// simulados, el árbol de la tarjeta sin renderizar y un DOM mínimo simulado para las utilidades de objetivo.ts. Cada prueba existe para que FALLE al romper una de estas ocho cosas:
//  (1) armadoTras al cambiar de paso (también por 'ruta')  (2) Tab que cancela  (3) formulario sucio  (4) movimiento reducido  (5) reiniciar por paso
//  (6) Siguiente por el conductor (un solo viaje)  (7) botón «Continuar» en fallo  (8) Escape que cancela solo el viaje.
// Lo que sigue sin poder probarse sin navegador (foco real, lector de pantalla, clic en el menú) se anota en T37X-NOTAS.md.
import {test,mock,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {ReactElement,ReactNode} from 'react';
import {crearViaje,CUENTA_MS,FALLO_MS,type EventoViaje} from '../src/lib/onboarding/viaje.mjs';
import {crearArmado,planDelPaso,siguienteDelPaso,teclaQueCancela,cancelarConTecla,punteroFueraDeTarjeta,puedeTomarFoco,reiniciarAlSalir,eventoDeTeclado} from '../src/lib/onboarding/cableado.mjs';
import {TarjetaRecorrido,type ViajeUi} from '../src/components/onboarding/paneles';
import {traductor} from '../src/lib/i18n';
import * as objetivo from '../src/components/onboarding/objetivo';

afterEach(()=>{mock.timers.reset();});
const avanzar=(ms:number)=>{for(let t=0;t<ms;t+=250)mock.timers.tick(Math.min(250,ms-t));};
const sensoresNada={reducirMovimiento:()=>false,enCampo:()=>false,hayFormularioSucio:()=>false};
/** Un conductor real con temporizadores simulados que cuenta cuántos viajes hizo. */
function conductor(extra:Partial<Parameters<typeof planDelPaso>[0]['sensores']>={},armado=true){
  mock.timers.enable({apis:['setTimeout']});
  const r={viajes:0};
  const v=crearViaje({alViajar:()=>{r.viajes++;}});
  v.enviar({tipo:'planear',plan:planDelPaso({tipo:'ir',armado,el:{},sensores:{...sensoresNada,...extra}})});
  return {v,r};
}

// ---- (1) armado: solo avanzar por voluntad de la persona arma el viaje
test('crearArmado: solo Siguiente y abrir/retomar arman; Anterior, cerrar, ruta y restaurar lo desarman, y el último origen manda',()=>{
  const a=crearArmado();
  assert.equal(a.esta(),false,'un recorrido recién restaurado tras recargar no viaja');
  assert.equal(a.tras('siguiente'),true);assert.equal(a.esta(),true);
  assert.equal(a.tras('ruta'),false,'llegar a la pantalla por una ruta ajena no arma');assert.equal(a.esta(),false);
  assert.equal(a.tras('abrir'),true);assert.equal(a.esta(),true);
  assert.equal(a.tras('anterior'),false);assert.equal(a.esta(),false,'tras Anterior el paso «ir» no viaja solo');
  for(const o of ['cerrar','clic','restaurar'])assert.equal(a.tras(o),false,o);
  a.tras('siguiente');assert.equal(a.tras('cerrar'),false);
});
test('un paso «ir» alcanzado con Anterior o por ruta NO arranca la cuenta; con Siguiente sí',()=>{
  for(const origen of ['anterior','ruta','cerrar','restaurar']){
    mock.timers.reset();
    const a=crearArmado();a.tras(origen);
    const {v,r}=conductor({},a.esta());
    assert.equal(v.estado().fase,'inactivo',origen);avanzar(60000);assert.equal(r.viajes,0,origen);
  }
  mock.timers.reset();
  const a=crearArmado();a.tras('siguiente');const {v}=conductor({},a.esta());
  assert.equal(v.estado().fase,'cuenta');
});

// ---- (3)(4) lo que impide viajar solo se lee AL DECIDIR
test('planDelPaso: un formulario modificado, el movimiento reducido o el foco en un campo no viajan solos y ofrecen «Ir a …»',()=>{
  for(const [sensor,motivo] of [['hayFormularioSucio','formulario'],['reducirMovimiento','movimiento-reducido'],['enCampo','campo']] as const){
    const p=planDelPaso({tipo:'ir',armado:true,el:{},sensores:{...sensoresNada,[sensor]:()=>true}});
    assert.equal(p.armar,false,motivo);assert.equal(p.manual,true,motivo);assert.equal(p.motivo,motivo);
    mock.timers.reset();
    const {v,r}=conductor({[sensor]:()=>true});
    assert.equal(v.estado().fase,'manual',motivo);avanzar(120000);assert.equal(r.viajes,0,motivo+': ni con mucho tiempo');
  }
});
test('planDelPaso: sin nada que proteger arma una cuenta de 3 s (también con el elemento ausente: menú plegado o cajón móvil)',()=>{
  for(const el of [{},null]){
    const p=planDelPaso({tipo:'ir',armado:true,el,sensores:sensoresNada});
    assert.deepEqual([p.armar,p.manual,p.motivo],[true,false,'ok']);assert.ok(p.ms>=3000&&p.ms===CUENTA_MS);
  }
  assert.equal(planDelPaso({tipo:'ir',armado:false,el:{},sensores:sensoresNada}).armar,false);
  assert.equal(planDelPaso({tipo:'info',armado:true,el:{},sensores:sensoresNada}).armar,false);
});
test('planDelPaso lee cada sensor al decidir, una sola vez',()=>{
  const llamadas:string[]=[];
  planDelPaso({tipo:'ir',armado:true,el:{},sensores:{reducirMovimiento:()=>{llamadas.push('m');return false;},enCampo:()=>{llamadas.push('c');return false;},hayFormularioSucio:()=>{llamadas.push('f');return false;}}});
  assert.deepEqual(llamadas.sort(),['c','f','m']);
});

// ---- (6)(7) Siguiente
test('siguienteDelPaso: un paso que no es «ir» avanza el recorrido y nunca toca el conductor',()=>{
  const {v,r}=conductor();let despachos=0,llevadas=0;
  assert.equal(siguienteDelPaso({tipo:'info',conductor:v,despachar:e=>{assert.deepEqual(e,{tipo:'siguiente'});despachos++;},llevar:()=>{llevadas++;}}),'avanzar');
  assert.deepEqual([despachos,llevadas,r.viajes,v.estado().fase],[1,0,0,'cuenta']);
});
test('siguienteDelPaso: Siguiente en un paso «ir» pasa por el conductor y viaja UNA sola vez, sin llevar directo ni repetirlo con el temporizador',()=>{
  const {v,r}=conductor();let despachos=0,llevadas=0;
  const sig=()=>siguienteDelPaso({tipo:'ir',conductor:v,despachar:()=>{despachos++;},llevar:()=>{llevadas++;}});
  avanzar(1000);
  assert.equal(sig(),'conductor');assert.equal(r.viajes,1);assert.equal(v.estado().fase,'viajando');
  assert.equal(sig(),'conductor');avanzar(60000);
  assert.equal(r.viajes,1,'ni el segundo Siguiente ni el temporizador repiten el viaje');
  assert.deepEqual([despachos,llevadas],[0,0],'no avanza el recorrido ni lleva directo: espera la ruta');
});
test('siguienteDelPaso: sin conductor montado todavía, un paso «ir» lleva directo una vez',()=>{
  let despachos=0,llevadas=0;
  assert.equal(siguienteDelPaso({tipo:'ir',conductor:null,despachar:()=>{despachos++;},llevar:()=>{llevadas++;}}),'llevar');
  assert.deepEqual([despachos,llevadas],[0,1]);
});
test('siguienteDelPaso: en fallo, la flecha derecha hace lo mismo que «Continuar» (avanza) y no reintenta el viaje',()=>{
  const {v,r}=conductor();avanzar(3000);avanzar(FALLO_MS);
  assert.equal(v.estado().fase,'fallo');assert.equal(r.viajes,1);
  let despachos=0;
  assert.equal(siguienteDelPaso({tipo:'ir',conductor:v,despachar:e=>{assert.deepEqual(e,{tipo:'siguiente'});despachos++;},llevar:()=>assert.fail('no debe llevar')}),'continuar');
  assert.equal(despachos,1);assert.equal(r.viajes,1);
});

// ---- (2)(8) teclas
test('teclaQueCancela: Tab cancela y sigue su curso; Escape cancela y se consume; el resto no cancela',()=>{
  assert.deepEqual(teclaQueCancela('Tab'),{motivo:'tab',consumir:false});
  assert.deepEqual(teclaQueCancela('Escape'),{motivo:'escape',consumir:true});
  for(const k of ['Enter','ArrowRight','a',' ','Shift'])assert.equal(teclaQueCancela(k),null,k);
});
const tecla=(key:string)=>{const e={key,prevenido:false,preventDefault(){e.prevenido=true;}};return e;};
test('cancelarConTecla: Tab detiene la cuenta (motivo «tab») sin consumir el evento; Escape la detiene (motivo «escape») y lo consume; otras teclas no hacen nada',()=>{
  const t=conductor();avanzar(1000);
  const tab=tecla('Tab');assert.equal(cancelarConTecla(t.v,tab),true);
  assert.deepEqual([t.v.estado().fase,t.v.estado().motivo,tab.prevenido],['manual','tab',false]);
  avanzar(60000);assert.equal(t.r.viajes,0,'cancelada con Tab no viaja sola');
  mock.timers.reset();
  const e=conductor();avanzar(1000);
  const esc=tecla('Escape');assert.equal(cancelarConTecla(e.v,esc),true);
  assert.deepEqual([e.v.estado().fase,e.v.estado().motivo,esc.prevenido],['manual','escape',true]);
  avanzar(60000);assert.equal(e.r.viajes,0);
  mock.timers.reset();
  const o=conductor();const x=tecla('x');assert.equal(cancelarConTecla(o.v,x),false);assert.equal(o.v.estado().fase,'cuenta');assert.equal(x.prevenido,false);
});
test('Escape en dos tiempos: el primero SOLO cancela el viaje (la guía sigue abierta y queda «Ir a …»); el segundo cierra la guía',()=>{
  const {v,r}=conductor();avanzar(1500);
  // Misma secuencia que el documento: primero el oyente de captura de la guía (solo vive mientras corre la cuenta), después el teclado del recorrido.
  const teclear=(key:string)=>{
    const e={key,defaultPrevented:false,preventDefault(){e.defaultPrevented=true;}};
    if(v.estado().fase==='cuenta')cancelarConTecla(v,e);
    return eventoDeTeclado({key:e.key,defaultPrevented:e.defaultPrevented,tagName:'BODY',dentroDeTarjeta:false,propias:false,modificador:false});
  };
  assert.equal(teclear('Escape'),null,'el primer Escape no llega al recorrido: la guía no se cierra');
  assert.equal(v.estado().fase,'manual');avanzar(60000);assert.equal(r.viajes,0);
  assert.deepEqual(teclear('Escape'),{tipo:'cerrar'},'el segundo Escape cierra la guía');
});
test('eventoDeTeclado: un evento ya consumido no hace nada; Escape cierra; flechas navegan salvo en campos; Enter solo dentro de la tarjeta',()=>{
  const base={defaultPrevented:false,tagName:'BODY',dentroDeTarjeta:false,propias:false,modificador:false};
  assert.deepEqual(eventoDeTeclado({...base,key:'Escape'}),{tipo:'cerrar'});
  assert.equal(eventoDeTeclado({...base,key:'Escape',defaultPrevented:true}),null);
  assert.deepEqual(eventoDeTeclado({...base,key:'ArrowRight'}),{tipo:'siguiente'});
  assert.deepEqual(eventoDeTeclado({...base,key:'ArrowLeft'}),{tipo:'anterior'});
  assert.equal(eventoDeTeclado({...base,key:'ArrowRight',propias:true}),null);
  assert.equal(eventoDeTeclado({...base,key:'ArrowRight',modificador:true}),null);
  assert.equal(eventoDeTeclado({...base,key:'Enter'}),null,'Enter fuera de la tarjeta no avanza');
  assert.deepEqual(eventoDeTeclado({...base,key:'Enter',dentroDeTarjeta:true}),{tipo:'siguiente'});
});

// ---- punteros y foco
test('punteroFueraDeTarjeta: dentro de la tarjeta no cancela; fuera sí',()=>{
  const dentro={},fuera={};const tarjeta={contains:(n:unknown)=>n===dentro};
  assert.equal(punteroFueraDeTarjeta(dentro,tarjeta),false);assert.equal(punteroFueraDeTarjeta(fuera,tarjeta),true);
  assert.equal(punteroFueraDeTarjeta(fuera,null),true);assert.equal(punteroFueraDeTarjeta(null,tarjeta),true);
});
test('puedeTomarFoco: sí desde ningún sitio, el cuerpo, la tarjeta, el menú o el botón Guía; no desde la página (un campo, un enlace)',()=>{
  const cuerpo={id:''},enTarjeta={id:'a'},enMenu={id:'b'},boton={id:'onb-boton'},campo={id:'campo-nombre'};
  const tarjeta={contains:(n:unknown)=>n===enTarjeta},menu={contains:(n:unknown)=>n===enMenu};
  for(const activo of [null,undefined,cuerpo,enTarjeta,enMenu,boton])assert.equal(puedeTomarFoco({activo,cuerpo,tarjeta,menu}),true,JSON.stringify(activo));
  assert.equal(puedeTomarFoco({activo:campo,cuerpo,tarjeta,menu}),false,'no le quita el foco a quien escribe');
  assert.equal(puedeTomarFoco({activo:campo,cuerpo,tarjeta:null,menu:null}),false);
});

// ---- (5) reiniciar por paso
test('reiniciarAlSalir: al cambiar de paso la cuenta y el plazo mueren: nada viaja después; el conductor se lee al limpiar',()=>{
  const {v,r}=conductor();avanzar(1500);
  let actual:typeof v|null=null;
  const limpiar=reiniciarAlSalir(()=>actual);
  actual=v;limpiar();
  assert.equal(v.estado().fase,'inactivo');avanzar(60000);assert.equal(r.viajes,0,'la cuenta del paso anterior no viaja');
  mock.timers.reset();
  const b=conductor();b.v.enviar({tipo:'siguiente'});avanzar(1000);assert.equal(b.r.viajes,1);
  reiniciarAlSalir(()=>b.v)();avanzar(FALLO_MS*3);assert.equal(b.v.estado().fase,'inactivo','el plazo de fallo del paso anterior tampoco dispara «No pude abrir esta pantalla»');
  assert.doesNotThrow(()=>reiniciarAlSalir(()=>null)());
});

// ---- (7) la tarjeta: qué hace cada botón (árbol de elementos, sin renderizar)
type Hijo=ReactNode|ReactElement<{children?:ReactNode}>;
function todos(nodo:Hijo,acc:ReactElement<Record<string,unknown>>[]=[]){
  if(Array.isArray(nodo)){nodo.forEach(n=>todos(n,acc));return acc;}
  if(nodo&&typeof nodo==='object'&&'props' in nodo){acc.push(nodo as ReactElement<Record<string,unknown>>);todos((nodo.props as {children?:ReactNode}).children,acc);}
  return acc;
}
const clics={primario:()=>{},quedarme:()=>{},irManual:()=>{},continuar:()=>{},anterior:()=>{},omitir:()=>{}};
const tarjeta=(fase:ViajeUi['fase'],tipo:'ir'|'info'|'cierre'='ir')=>TarjetaRecorrido({t:traductor('es'),tipo,titulo:'x',cuerpo:'y',ilu:'nodos',n:7,total:80,grupoN:3,grupoTotal:24,ruta:{nombres:['Hoy','Problemas'],actual:1},
  anterior:clics.anterior,omitir:clics.omitir,primario:clics.primario,viaje:{fase,restan:3,nombre:'Problemas',quedarme:clics.quedarme,irManual:clics.irManual,continuar:clics.continuar}}) as ReactElement<{children?:ReactNode}>;
const boton=(arbol:ReactElement<{children?:ReactNode}>,atributo:string)=>todos(arbol).find(e=>e.type==='button'&&atributo in e.props);
test('botón primario: en fallo ejecuta «Continuar» (vi.continuar); en cualquier otra fase, el primario del paso',()=>{
  const fallo=boton(tarjeta('fallo'),'data-onb-primario')!;
  assert.equal(fallo.props.onClick,clics.continuar,'en fallo el botón principal es Continuar');
  for(const fase of ['inactivo','cuenta','manual','viajando'] as const)assert.equal(boton(tarjeta(fase),'data-onb-primario')!.props.onClick,clics.primario,fase);
  assert.equal(boton(tarjeta('fallo','info'),'data-onb-primario')!.props.onClick,clics.primario,'sin viaje (paso informativo) no hay Continuar');
});
test('botones del viaje: «Quedarme aquí» solo en la cuenta y cancela; «Ir a …» solo en manual y viaja',()=>{
  assert.equal(boton(tarjeta('cuenta'),'data-onb-quedarme')!.props.onClick,clics.quedarme);
  assert.equal(boton(tarjeta('manual'),'data-onb-manual')!.props.onClick,clics.irManual);
  for(const fase of ['inactivo','manual','viajando','fallo'] as const)assert.equal(boton(tarjeta(fase),'data-onb-quedarme'),undefined,fase);
  for(const fase of ['inactivo','cuenta','viajando','fallo'] as const)assert.equal(boton(tarjeta(fase),'data-onb-manual'),undefined,fase);
});

// ---- el cableado de contexto.tsx / guia.tsx / paneles.tsx usa estas piezas (guardas de código: sin jsdom no se pueden montar los hooks)
const fuente=(f:string)=>fs.readFileSync(new URL('../src/components/onboarding/'+f,import.meta.url),'utf8').replace(/\s+/g,' ');
test('contexto.tsx: cada cambio del recorrido registra su origen en el armado, Siguiente pasa por siguienteDelPaso y el teclado por eventoDeTeclado',()=>{
  const c=fuente('contexto.tsx');
  assert.match(c,/armado\.current\.tras\(e\.tipo\);aplicar\(reducir\(rec,e,/,'despachar registra el origen real del evento');
  assert.match(c,/if\(sig!==rec\)\{armado\.current\.tras\('ruta'\);/,'una ruta ajena desarma');
  assert.equal((c.match(/armado\.current\.tras\('abrir'\)/g)??[]).length,2,'iniciar e irAPantalla arman');
  assert.match(c,/viajeAutomatico:\(\)=>armado\.current\.esta\(\)/);
  assert.match(c,/siguienteDelPaso\(\{tipo:paso\?\.tipo,conductor:viajeCtl\.current,despachar,llevar:llevame\}\)/);
  assert.doesNotMatch(c,/viajeCtl\.current\.enviar|armadoTras|viaje\.current/,'nada sortea el cableado probado');
  assert.match(c,/eventoDeTeclado\(\{key:e\.key,defaultPrevented:e\.defaultPrevented,/);
});
test('guia.tsx: la decisión del viaje, las cancelaciones, el reinicio por paso y el foco usan las piezas probadas',()=>{
  const g=fuente('guia.tsx');
  assert.match(g,/planDelPaso\(\{tipo,armado:viajeRef\.current\?\.\(\)\?\?false,el,sensores:\{reducirMovimiento,enCampo:\(\)=>enCampo\(document\.activeElement\),hayFormularioSucio:\(\)=>hayFormularioSucio\(\)\}\}\)/);
  assert.doesNotMatch(g,/planearViaje/);
  assert.match(g,/useEffect\(\(\)=>reiniciarAlSalir\(\(\)=>ctlRef\.current\),\[pasoId\]\)/,'el reinicio depende del paso');
  assert.match(g,/const alTecla=\(e:KeyboardEvent\)=>\{if\(ctlRef\.current\)cancelarConTecla\(ctlRef\.current,e\);\}/);
  assert.match(g,/punteroFueraDeTarjeta\(e\.target,tarjeta\.current\)/);
  assert.match(g,/document\.addEventListener\('keydown',alTecla,true\)/,'en captura: llega antes que el teclado del recorrido');
  assert.match(g,/\},\[faseViaje\]\);/);
  assert.match(g,/faseViaje==='cuenta'\?'\[data-onb-quedarme\]'/,'al aparecer la cuenta el foco va a «Quedarme aquí»');
  assert.match(g,/puedeTomarFoco\(\{activo:document\.activeElement,cuerpo:document\.body,tarjeta:tarjeta\.current,menu:menu\.current\}\)/);
});
test('paneles.tsx: el botón principal de la tarjeta es «Continuar» en fallo',()=>{
  assert.match(fuente('paneles.tsx'),/data-onb-primario onClick=\{fallo&&vi\?vi\.continuar:primario\}/);
});

// ---- objetivo.ts con un DOM mínimo simulado
function ulPlegadoDesde(inicio:Elemento|null):Elemento|null{for(let e=inicio;e;e=e.padre)if(e.tagName==='UL'&&e.hidden)return e;return null;}
class Elemento{
  tagName='DIV';id='';hidden=false;rol:string|null=null;isContentEditable=false;visible=true;clics=0;padre:Elemento|null=null;
  getAttribute(n:string){return n==='role'?this.rol:null;}
  getClientRects(){return this.visible?[{}]:[];}
  click(){this.clics++;}
  closest(sel:string):Elemento|null{return sel==='ul[hidden]'?ulPlegadoDesde(this):null;}
}
class Entrada extends Elemento{tagName='INPUT';type='text';value='';defaultValue='';checked=false;defaultChecked=false;}
class AreaTexto extends Elemento{tagName='TEXTAREA';value='';defaultValue='';}
class Lista extends Elemento{tagName='SELECT';options:{selected:boolean;defaultSelected:boolean}[]=[];}
class Formulario extends Elemento{tagName='FORM';elements:Elemento[]=[];}
class Raiz{constructor(public formularios:Formulario[]){}querySelectorAll(sel:string){if(sel!=='form')throw new Error('selector inesperado');return this.formularios;}}
Object.assign(globalThis,{HTMLElement:Elemento,HTMLInputElement:Entrada,HTMLTextAreaElement:AreaTexto,HTMLSelectElement:Lista,CSS:{escape:(s:string)=>s}});
const form=(...c:Elemento[])=>{const f=new Formulario();f.elements=c;return new Raiz([f]);};
const texto=(valor:string,inicial:string,tipo='text')=>{const i=new Entrada();i.type=tipo;i.value=valor;i.defaultValue=inicial;return i;};

test('hayFormularioSucio: un campo cambiado respecto de su valor inicial es sucio; sin cambios, o sin formularios, no',()=>{
  assert.equal(objetivo.hayFormularioSucio(form(texto('Ana','')) as never),true);
  assert.equal(objetivo.hayFormularioSucio(form(texto('Ana','Ana')) as never),false);
  assert.equal(objetivo.hayFormularioSucio(new Raiz([]) as never),false);
  assert.equal(objetivo.hayFormularioSucio(form() as never),false);
});
test('hayFormularioSucio: casillas, áreas de texto y listas comparan con su valor inicial; hidden/submit/button/reset/image/file se ignoran',()=>{
  const casilla=(marcada:boolean,inicial:boolean,tipo='checkbox')=>{const i=new Entrada();i.type=tipo;i.checked=marcada;i.defaultChecked=inicial;return i;};
  assert.equal(objetivo.hayFormularioSucio(form(casilla(true,false)) as never),true);
  assert.equal(objetivo.hayFormularioSucio(form(casilla(true,true)) as never),false);
  assert.equal(objetivo.hayFormularioSucio(form(casilla(true,false,'radio')) as never),true);
  const area=(v:string,d:string)=>{const a=new AreaTexto();a.value=v;a.defaultValue=d;return a;};
  assert.equal(objetivo.hayFormularioSucio(form(area('nota','')) as never),true);
  assert.equal(objetivo.hayFormularioSucio(form(area('nota','nota')) as never),false);
  const lista=(...o:[boolean,boolean][])=>{const l=new Lista();l.options=o.map(([selected,defaultSelected])=>({selected,defaultSelected}));return l;};
  assert.equal(objetivo.hayFormularioSucio(form(lista([true,false],[false,true])) as never),true);
  assert.equal(objetivo.hayFormularioSucio(form(lista([true,true],[false,false])) as never),false);
  for(const tipo of ['hidden','submit','button','reset','image','file'])assert.equal(objetivo.hayFormularioSucio(form(texto('cambiado','',tipo)) as never),false,tipo+' no cuenta');
  assert.equal(objetivo.hayFormularioSucio(form(texto('igual','igual'),texto('cambiado','')) as never),true,'un solo campo sucio entre varios basta');
  const dos=new Raiz([form(texto('a','a')).formularios[0],form(texto('b','')).formularios[0]]);
  assert.equal(objetivo.hayFormularioSucio(dos as never),true,'se recorren todos los formularios');
});
test('enCampo: campos de texto, listas, contenteditable y roles de pestañas/listas sí; botones, enlaces y nada no',()=>{
  assert.equal(objetivo.enCampo(null),false);
  assert.equal(objetivo.enCampo(new Entrada() as never),true);
  assert.equal(objetivo.enCampo(new AreaTexto() as never),true);
  assert.equal(objetivo.enCampo(new Lista() as never),true);
  const editable=new Elemento();editable.isContentEditable=true;assert.equal(objetivo.enCampo(editable as never),true);
  const boton=new Elemento();boton.tagName='BUTTON';assert.equal(objetivo.enCampo(boton as never),false);
  const enlace=new Elemento();enlace.tagName='A';assert.equal(objetivo.enCampo(enlace as never),false);
  const pestana=new Elemento();pestana.rol='tab';assert.equal(objetivo.enCampo(pestana as never),true);
  assert.equal(objetivo.enCampo({tagName:'INPUT'} as never),false,'solo elementos reales (HTMLElement)');
});
test('abrirGrupoDelMenu: despliega el grupo plegado que esconde el enlace (clic en su botón) y dice si lo hizo',()=>{
  const registro:Record<string,Elemento[]>={};const botones:Record<string,Elemento>={};
  Object.assign(globalThis,{document:{
    querySelectorAll:(s:string)=>{if(s==='[[malo')throw new SyntaxError('selector inválido');return registro[s]??[];},
    querySelector:(s:string)=>{const m=/aria-controls="([^"]+)"/.exec(s);return m?botones[m[1]]??null:null;},
  }});
  const enlace=(grupoHidden:boolean,id:string)=>{const ul=new Elemento();ul.tagName='UL';ul.hidden=grupoHidden;ul.id=id;const a=new Elemento();a.tagName='A';a.padre=ul;return {ul,a};};
  const boton=(id:string,visible=true)=>{const b=new Elemento();b.tagName='BUTTON';b.visible=visible;botones[id]=b;return b;};
  // plegado + botón visible: hace clic una vez
  let {a}=enlace(true,'grp-1');registro['[data-tour="menu:/x"]']=[a];const b1=boton('grp-1');
  assert.equal(objetivo.abrirGrupoDelMenu(['[data-tour="menu:/x"]']),true);assert.equal(b1.clics,1);
  // ya desplegado: no toca nada
  ({a}=enlace(false,'grp-2'));registro['[data-tour="menu:/y"]']=[a];const b2=boton('grp-2');
  assert.equal(objetivo.abrirGrupoDelMenu(['[data-tour="menu:/y"]']),false);assert.equal(b2.clics,0);
  // plegado pero el grupo no tiene id: no puede localizar su botón
  ({a}=enlace(true,''));registro['[data-tour="menu:/z"]']=[a];
  assert.equal(objetivo.abrirGrupoDelMenu(['[data-tour="menu:/z"]']),false);
  // botón del grupo no visible (cajón móvil cerrado): no hace clic
  ({a}=enlace(true,'grp-4'));registro['[data-tour="menu:/w"]']=[a];const b4=boton('grp-4',false);
  assert.equal(objetivo.abrirGrupoDelMenu(['[data-tour="menu:/w"]']),false);assert.equal(b4.clics,0);
  // selector inválido se ignora y sigue con el siguiente; sin coincidencias, false
  assert.equal(objetivo.abrirGrupoDelMenu(['[[malo','[data-tour="menu:/x"]']),true);assert.equal(b1.clics,2);
  assert.equal(objetivo.abrirGrupoDelMenu(['[data-tour="menu:/nada"]']),false);assert.equal(objetivo.abrirGrupoDelMenu([]),false);
});
test('objetivo.primerVisible: el orden de los selectores manda, ignora lo no visible y los selectores inválidos',()=>{
  const reg:Record<string,Elemento[]>={};
  Object.assign(globalThis,{document:{querySelectorAll:(s:string)=>{if(s==='[[malo')throw new SyntaxError('x');return reg[s]??[];}}});
  const oculto=new Elemento();oculto.visible=false;const a=new Elemento(),b=new Elemento();
  reg['.a']=[oculto,a];reg['.b']=[b];
  assert.equal(objetivo.primerVisible(['[[malo','.b','.a']),b,'el primer selector con un visible gana');
  assert.equal(objetivo.primerVisible(['.a']),a,'salta el no visible');
  assert.equal(objetivo.primerVisible(['.nada']),null);
});
// Guarda de tipos de los eventos que el cableado envía al conductor.
const _eventos:EventoViaje[]=[{tipo:'siguiente'},{tipo:'manual'},{tipo:'clic'},{tipo:'cancelar',motivo:'escape'}];void _eventos;
