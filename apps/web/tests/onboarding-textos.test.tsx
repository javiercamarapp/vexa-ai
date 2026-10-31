// Onboarding: veracidad de los textos del recorrido (T30), nombre del rol y consistencia del inglés. Sin DOM: solo diccionarios y la construcción del recorrido.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {construirTour} from '../src/lib/onboarding/tour.mjs';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const ESP=es as Record<string,string>,ING=en as Record<string,string>;

test('T30: ningún texto del recorrido afirma lo que la pantalla real no hace',()=>{
  const todo=(dic:Record<string,string>)=>Object.entries(dic).filter(([k])=>/^onb\./.test(k));
  const prohibidos:[RegExp,string][]=[
    [/alertas? (abiertas?|siguen)|open alerts/i,'auditoría de plataforma es solo la bitácora: no hay alertas'],
    [/ordena por antigüedad|sort by age|quién lo atiende|who is handling/i,'Carga y SLA es un mapa de calor: no hay orden ni responsable'],
    [/lo que se esperaba cobrar|expected to (be )?collect|what was expected and what came in/i,'Brechas es del bruto al retenido, no esperado vs. cobrado'],
    [/puntos se juntan|dots cluster/i,'el mapa es por estados con escala de color, sin puntos'],
    [/Solo el propietario aprueba|Only the owner approves/i,'el rol se llama Administrador del espacio'],
    [/decide con evidencia: proceder|decide with evidence: proceed/i,'el operador no decide: propone'],
    [/para decidir qué atender|to decide what to handle|antes de decidir qué hacer|before deciding what to do/i,'operador y lector no deciden'],
    [/no cambiar nada|not change anything/i,'el lector sí configura sus avisos'],
    [/espera un momento y te llevo|wait a moment and I will take you/i,'la promesa de viaje depende de que viaje'],
  ];
  for(const [dic,idioma] of [[ESP,'es'],[ING,'en']] as const)for(const [k,v] of todo(dic))for(const [re,motivo] of prohibidos)assert.doesNotMatch(v,re,`${idioma}:${k} — ${motivo}`);
  assert.match(ESP['onb.pant.platform-auditoria.desc'],/cuándo/);assert.match(ESP['onb.pant.workload.claveC'],/mapa de calor/);
  assert.match(ESP['onb.pant.gaps.claveC'],/cancelaciones y los reembolsos/);assert.match(ESP['onb.pant.map.claveC'],/más oscuros/);
});
test('rol: el rol propietario se llama «Administrador del espacio» en todos los textos del onboarding, y los demás como el menú (Analista, Operador, Lectura)',()=>{
  assert.equal(ESP['shell.rol.owner'],'Administrador del espacio');assert.equal(ING['shell.rol.owner'],'Workspace administrator');
  for(const [k,v] of Object.entries(ESP).filter(([k])=>/^onb\./.test(k)))assert.doesNotMatch(v,/\bpropietari[oa]s?\b|\blectores?\b/i,k);
  for(const [k,v] of Object.entries(ING).filter(([k])=>/^onb\./.test(k)))assert.doesNotMatch(v,/\bowners?\b|\bviewers?\b/i,k);
  assert.match(ESP['onb.propietario.acciones.cuerpo'],/administrador del espacio/);assert.match(ING['onb.propietario.acciones.cuerpo'],/workspace administrator/);
});
test('rol: el operador propone (no decide) y el lector no aprueba ni queda sin poder configurar sus avisos',()=>{
  assert.equal(ESP['onb.operador.propuesta.titulo'],'Proponer una acción');assert.equal(ING['onb.operador.propuesta.titulo'],'Propose an action');
  assert.doesNotMatch(ESP['onb.operador.propuesta.cuerpo'],/decid|aprueb/i);
  assert.match(ESP['onb.lector.hoy.cuerpo'],/no cambiar los datos de la organización/);assert.match(ING['onb.lector.hoy.cuerpo'],/not change the organization/);
  const lector=construirTour('lector').filter(p=>p.cuerpo).map(p=>ESP[p.cuerpo!]).join(' ');
  assert.doesNotMatch(lector,/decidir|decide/i);
});
test('inglés: «alerts» (como el menú) en vez de «notifications», «Published cuts» (como la pantalla) en vez de «snapshots», sin «Tick»',()=>{
  assert.equal(ING['nav.item.settings-notifications'],'Alerts');assert.equal(ING['nav.item.economics'],'Published cuts');assert.equal(ING['econ.titulo'],ING['nav.item.economics'],'menú y título de la pantalla dicen lo mismo');assert.equal(ING['meta.titulo.economics'],ING['nav.item.economics']);
  const onb=Object.entries(ING).filter(([k])=>/^onb\./.test(k)).map(([,v])=>v).join('\n');
  assert.doesNotMatch(onb,/notification|\bTick\b|snapshot/i);
  assert.doesNotMatch(onb,/(?<![A-Za-z])'(?![A-Za-z])|n't/,'comillas y apóstrofos curvos en el inglés del onboarding');
});
test('verbos para descartar unificados: Omitir en la tarjeta, la invitación y el menú',()=>{
  for(const k of ['onb.ui.omitir','onb.ui.saltar','onb.ui.noVolver'])assert.match(ESP[k],/^Omitir/,k);
  for(const k of ['onb.ui.omitir','onb.ui.saltar','onb.ui.noVolver'])assert.match(ING[k],/^Skip/,k);
});

const palabras=(t:string)=>t.trim().split(/\s+/).length;
test('T37: la tarjeta del lector en Hoy es corta (25 palabras o menos) y no repite lo que ya dice la pantalla',()=>{
  for(const [dic,idioma] of [[ESP,'es'],[ING,'en']] as const)assert.ok(palabras(dic['onb.lector.hoy.cuerpo'])<=25,idioma+' '+palabras(dic['onb.lector.hoy.cuerpo'])+' palabras');
  assert.doesNotMatch(ESP['onb.lector.hoy.cuerpo'],/dinero/i);
});
test('T37: el anuncio de la cuenta regresiva dice algo cierto de Escape (solo cancela el viaje) y el recorrido no promete lo que Configuración no hace',()=>{
  assert.match(ESP['onb.tour.ir.anuncio'],/«Quedarme aquí» o Escape para quedarte aquí/);assert.doesNotMatch(ESP['onb.tour.ir.anuncio'],/para cancelar/);
  assert.match(ING['onb.tour.ir.anuncio'],/“Stay here” or Escape to stay on this screen/);assert.doesNotMatch(ING['onb.tour.ir.anuncio'],/to cancel/);
  assert.doesNotMatch(ESP['onb.pant.connections.accionC'],/Pídelo/);assert.match(ESP['onb.pant.connections.accionC'],/hoja para soporte/);
  assert.match(ESP['onb.pant.pain-points.claveC'],/devuelto, pendiente o cancelado/);
  assert.equal(ESP['onb.propietario.datos.titulo'],ESP['nav.item.connections'],'el paso de /connections se titula como el menú');
  assert.equal(ING['onb.propietario.datos.titulo'],ING['nav.item.connections']);
  assert.doesNotMatch(ING['onb.tour.ir.titulo'],/^Next/,'el título del salto no se confunde con el botón «Next»');
});
test('T37: la tarjeta del recorrido sobre CCO refleja el estado real (seis preguntas, datos parciales, E y F con salvedad por casos, sin prometer recomendaciones)',()=>{
  for(const [dic,idioma] of [[ESP,'es'],[ING,'en']] as const){
    const v=dic['onb.pant.cco.desc']+' '+dic['onb.pant.cco.claveC'];
    assert.doesNotMatch(v,/recomienda (qué|cuál)|te dice qué conviene|tells you which|will recommend/i,idioma);
  }
  assert.match(ESP['onb.pant.cco.desc'],/preguntas del director de cliente, de la A a la F.*parciales/);assert.match(ING['onb.pant.cco.desc'],/questions, A to F.*partial/);
  assert.match(ESP['onb.pant.cco.claveC'],/E y F.*con salvedad.*casos por modalidad, no ventas.*no dicen qué conviene/);
  assert.match(ING['onb.pant.cco.claveC'],/E and F.*caveats.*cases by mode, not sales.*do not say which is better/);
  // Lo que dice la tarjeta es lo que dice la pantalla: misma salvedad (casos, no ventas) y misma lista de faltantes.
  assert.match(ESP['cco.E.hoy'],/son casos, no ventas/);assert.match(ESP['cco.F.hoy'],/No se puede decir desde dónde conviene enviar/);
  assert.match(ESP['cco.estado.salvedad'],/salvedad/i);assert.ok(ESP['cco.faltaTitulo']);
});
