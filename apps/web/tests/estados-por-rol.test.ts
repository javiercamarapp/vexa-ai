// F3e: estados vacíos y pantallas según lo que el rol puede hacer (importar, preparar cortes) y Zendesk fuera del alcance por ahora.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rolTieneCapacidad} from '../src/lib/onboarding/catalogo.mjs';
import {es} from '../src/lib/i18n/es';
import {en} from '../src/lib/i18n/en';

const leer=(rel:string)=>fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8');
const ESP=es as Record<string,string>,ING=en as Record<string,string>;

test('Importaciones: el bloque de carga solo lo pinta quien tiene la capacidad import (propietario y analista); operador y lector ven un aviso y su vacío dice a quién pedirlo',()=>{
  assert.deepEqual(['owner','analyst','operator','viewer'].filter(r=>rolTieneCapacidad(r as never,'import')),['owner','analyst']);
  const src=leer('src/components/import-preview.tsx');
  assert.match(src,/puedeImportar=rolSesion===undefined\|\|rolTieneCapacidad\(rolSesion as Role,'import'\)/);
  assert.match(src,/\{puedeImportar&&<div className="pc-card"><fieldset className=\{'import-upload '\+styles\.upload\}/,'«Nueva carga» solo con la capacidad');
  assert.match(src,/\{!puedeImportar&&<p className="ac-nota" role="note">\{t\('rol\.imp\.soloLectura'\)\}<\/p>\}/);
  assert.match(src,/!hasWork&&!puedeImportar&&<EmptyState[^>]*rol\.imp\.vacioTituloSinCarga/);
  for(const d of [ESP,ING]){for(const k of ['rol.imp.soloLectura','rol.imp.vacioSinCarga'])assert.match(d[k],/administrador del espacio|workspace administrator/i,k);}
});
test('el vacío de Importaciones del analista (no puede crear la conexión) lo dice; el propietario conserva sus tres pasos',()=>{
  assert.match(leer('src/components/import-preview.tsx'),/body=\{canConfigure\?t\('conx\.i\.vacioBody'\):t\('rol\.imp\.vacioAnalista'\)\}/);
  assert.match(ESP['rol.imp.vacioAnalista'],/administrador del espacio/);assert.match(ING['rol.imp.vacioAnalista'],/workspace administrator/);
});
test('textos de vacío: ninguno ordena «Carga/Importa/Sube» a un rol sin permiso; dicen que lo hace el propietario (o un analista)',()=>{
  const claves=['estado.vacioCuerpo','ag.sinInfoCuerpo','brechas.sinPedidos','cfo.vacioCuerpo','econ.libroVacioB','cop.vacioCuerpo','fuga.sinLibro','fuga.sinFilasTracker'];
  for(const k of claves){
    assert.doesNotMatch(ESP[k],/(^|[.:] )(Carga|Importa|Sube)\b/,'es:'+k);assert.doesNotMatch(ESP[k],/\b(carga|importa|sube) (tus|una|el|los)\b/i,'es:'+k);
    assert.doesNotMatch(ING[k],/(^|[.:] )(Load|Upload|Import)\b/,'en:'+k);assert.match(ESP[k],/administrador del espacio/,'es:'+k);assert.match(ING[k],/workspace administrator/,'en:'+k);
  }
});
test('Cortes publicados: preparar, cargar pedidos, clasificar y asociar es del propietario (el servidor exige snapshot_owner_required); el analista ve un aviso en vez de la sección',()=>{
  const pagina=leer('src/app/(app)/(workspace)/economics/page.tsx');
  assert.match(pagina,/puedePreparar=active\.role==='owner',soloPropietario=active\.role==='analyst'/);
  assert.match(pagina,/<EconomiaResumen[^>]*soloPropietario=\{soloPropietario\}/);
  const vista=leer('src/components/datos/economia-resumen.tsx');
  assert.match(vista,/\{puedePreparar&&<Preparar>/);assert.match(vista,/!puedePreparar&&soloPropietario&&<p className="ac-nota"[^>]*>\{tr\('rol\.econ\.soloProp'\)\}/);
  assert.match(leer('../../packages/metrics/snapshots.mjs'),/check\(s\.role==='owner','snapshot_owner_required',403\)/,'el servidor sigue exigiendo propietario');
  assert.match(ESP['rol.econ.soloProp'],/lo hace el administrador del espacio/);assert.match(ING['rol.econ.soloProp'],/done by the workspace administrator/);
});
test('Zendesk ya no es el valor por defecto: HubSpot lo es, y Zendesk se ofrece como fuera de alcance por ahora, sin prometer fechas',()=>{
  const src=leer('src/components/connection-settings.tsx');
  assert.doesNotMatch(src,/useState<'hubspot'\|'zendesk'>\('zendesk'\)/);assert.match(src,/useState<'hubspot'\|'zendesk'>\('hubspot'\)/);
  assert.doesNotMatch(src,/setSource\('zendesk'\)/);assert.doesNotMatch(src,/\?\?'zendesk'/);
  assert.match(src,/<option value="zendesk" disabled=\{selected\?\.source!=='zendesk'\}>\{t\('conx\.s\.zendeskFuera'\)\}/,'solo se puede ver si ya existía una fila de Zendesk');
  assert.match(ESP['conx.s.zendeskFuera'],/fuera de alcance por ahora/);assert.match(ING['conx.s.zendeskFuera'],/out of scope for now/);
  for(const d of [ESP,ING])assert.doesNotMatch(d['conx.s.zendeskFuera'],/pr[oó]xim|coming|soon|\d/i);
});
test('textos de roles: mismas claves en es y en y las mismas {variables}',()=>{
  for(const k of Object.keys(ESP).filter(x=>/^(rol\.|hoy\.rol\.|soporte\.banner\.|sinacceso\.)/.test(x))){assert.ok(k in ING,k);assert.equal([...ING[k].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(),[...ESP[k].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(),k);}
});
