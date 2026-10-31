// T47: una sola palabra por concepto en menú, título de pantalla, migas (título de pestaña) y onboarding.
//  - Avisos / Notifications: campana, bandeja y preferencias. «Alertas / Alerts» queda para umbrales y plataforma.
//  - Acciones / Actions: el área (menú, título, onboarding); «intervención / intervention» es el registro individual dentro del área.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';
import {MENU,tituloDePantalla} from '../src/lib/workspace/menu.mjs';
import {claveItem,claveTitulo,claveGrupo} from '../src/lib/i18n/menu';

const D={es,en} as Record<'es'|'en',Record<string,string>>;
const TERM={es:{avisos:/\bavisos?\b/i,mal:/\bnotificaci[oó]n(es)?\b|\balertas?\b/i,acciones:/\bacciones\b/i,malAcc:/\bintervenci[oó]n(es)?\b/i},
 en:{avisos:/\bnotifications?\b/i,mal:/\balerts?\b|\bnotices?\b/i,acciones:/\bactions\b/i,malAcc:/\binterventions?\b/i}};
const LENGUAS=['es','en'] as const;

// Claves del concepto «avisos»: menú, campana, bandeja (título y pestaña), preferencias, entrega y onboarding.
const AVISOS=['nav.item.settings-notifications','nav.item.settings-notification-delivery','nav.titulo.settings-notifications','nav.titulo.notifications','shell.notificaciones',
 'meta.titulo.settings-notifications','meta.titulo.settings-notification-delivery','meta.titulo.notifications','meta.titulo.notifications-push','meta.titulo.notifications-push-device',
 'conx.a.hNotifs','conx.a.hPrefs','conx.a.tituloAvisos','conx.p.eyebrow','tr.push.titulo','tr.push.activar',
 'onb.operador.avisos.titulo','onb.lector.avisos.titulo','onb.propietario.avisos.titulo','onb.analista.avisos.titulo','onb.pant.settings-notifications.claveT','onb.pant.settings-notifications.accionT'];
test('avisos: menú, campana, bandeja, preferencias y onboarding usan la misma palabra en cada idioma, y «alerta» no se cuela',()=>{
 for(const l of LENGUAS)for(const k of AVISOS){
  const v=D[l][k];assert.ok(v,`${l} ${k}`);
  assert.match(v,TERM[l].avisos,`${l} ${k}: «${v}» debe decir ${l==='es'?'aviso':'notification'}`);
  assert.doesNotMatch(v,TERM[l].mal,`${l} ${k}: «${v}» mezcla otra palabra del concepto`);
 }
});
test('avisos: el rótulo canónico del menú (menu.mjs) y el título de la bandeja coinciden con el diccionario español',()=>{
 const item=MENU.find(e=>e.tipo==='item'&&e.href==='/settings/notifications') as {etiqueta:string};
 assert.equal(item.etiqueta,es[claveItem('/settings/notifications')]);
 assert.equal(tituloDePantalla('/notifications'),es['nav.titulo.notifications']);
 assert.equal(tituloDePantalla('/notifications'),es['shell.notificaciones'],'campana = bandeja');
 assert.equal(en['shell.notificaciones'],en['nav.titulo.notifications']);
 assert.equal(en['nav.item.settings-notifications'],en['nav.titulo.notifications'],'menú EN = título EN de la bandeja');
});
test('avisos: ninguna clave en inglés dice «alert» donde el español dice «aviso» (alerta queda para umbrales y plataforma)',()=>{
 const permitidas=new Set(['landing.cuentas.1.d','landing.val.c2.d']); // texto del sitio público: no se toca aquí; ver notas T47
 const malas:string[]=[];
 for(const k of Object.keys(es)){
  if(permitidas.has(k))continue;
  if(/\bavis[oa]s?\b/i.test(es[k])&&!/\balertas?\b/i.test(es[k])&&/\balerts?\b/i.test(en[k]))malas.push(`${k}: ${en[k].slice(0,80)}`);
 }
 assert.deepEqual(malas,[]);
});

// Concepto «acciones»: el área se llama igual en el menú, el título, la pestaña, la guía y el onboarding.
const AREA=['nav.grupo.acciones','nav.titulo.interventions','meta.titulo.interventions','tr.gu.intervenciones.titulo','acc.titulo','acc.eyebrow','movil.acciones','onb.operador.acciones.titulo'];
test('acciones: grupo del menú, título de pantalla, pestaña, guía y onboarding llaman «Acciones/Actions» al área',()=>{
 for(const l of LENGUAS)for(const k of AREA){
  const v=D[l][k];assert.ok(v,`${l} ${k}`);
  assert.match(v,TERM[l].acciones,`${l} ${k}: «${v}»`);
  assert.doesNotMatch(v,TERM[l].malAcc,`${l} ${k}: «${v}» usa «intervención» como nombre del área`);
 }
 const g=MENU.find(e=>e.tipo==='grupo'&&e.clave==='acciones') as {etiqueta:string;items:{href:string;titulo?:string}[]};
 assert.equal(g.etiqueta,es[claveGrupo('acciones')]);
 assert.equal(tituloDePantalla('/interventions'),es[claveTitulo('/interventions')]);
 assert.equal(tituloDePantalla('/interventions'),g.etiqueta);
 assert.equal(en[claveGrupo('acciones')],en[claveTitulo('/interventions')],'EN: grupo = título');
 assert.equal(es['meta.titulo.interventions'],es['nav.titulo.interventions']);assert.equal(en['meta.titulo.interventions'],en['nav.titulo.interventions']);
});
test('acciones: «intervención» solo es el registro individual y se traduce igual en los dos idiomas; ningún rótulo de menú la usa',()=>{
 const rotulos=MENU.flatMap(e=>e.tipo==='grupo'?[e.etiqueta,...e.items.map(i=>i.etiqueta)]:[e.etiqueta]);
 assert.ok(!rotulos.some(r=>/interven/i.test(r)));
 for(const k of Object.keys(es)){
  const ai=/\bintervenci[oó]n(es)?\b/i.test(es[k]),bi=/\binterventions?\b/i.test(en[k]);
  assert.equal(ai,bi,`${k}: es «${es[k].slice(0,60)}» / en «${en[k].slice(0,60)}»`);
  const aa=/\bacci[oó]n(es)?\b/i.test(es[k]),ba=/\bactions?\b/i.test(en[k]);
  assert.equal(aa,ba,`${k}: acción/action diverge: «${es[k].slice(0,60)}» / «${en[k].slice(0,60)}»`);
 }
});
