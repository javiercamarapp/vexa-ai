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
