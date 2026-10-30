import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalog,render,renderText,managementPatch,localConfig} from './templates.mjs';
// Las pruebas completas del sistema de correo (contraste, enlaces, variables, snapshots) viven en
// packages/notifications/tests/correos.test.mjs. Aquí queda la coherencia generador <-> archivos <-> config.
for(const item of catalog)test(`plantilla generada y accesible: ${item.id}`,()=>{
 const html=render(item);assert.equal(fs.readFileSync(new URL('../../supabase/templates/auth/'+item.id+'.html',import.meta.url),'utf8'),html);
 assert.equal(fs.readFileSync(new URL('../../supabase/templates/auth/texto/'+item.id+'.txt',import.meta.url),'utf8'),renderText(item));
 assert.match(html,/<html lang="es-MX" dir="ltr"/);assert.match(html,new RegExp('<title>'+item.subject.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</title>'));assert.equal((html.match(/<h1 /g)??[]).length,1);
 for(const tag of html.match(/<table\b[^>]*>/g))assert.match(tag,/role="presentation"/);
 assert.doesNotMatch(html,/<script|<iframe|<form|javascript:|\.RedirectTo|tracking/i);
 assert.equal((html.match(/\{\{ \.Token \}\}/g)??[]).length,item.id==='reauthentication'?1:0);
 assert.equal(managementPatch()['mailer_templates_'+item.id+'_content'],html);
 const config=fs.readFileSync(new URL('../../supabase/config.toml',import.meta.url),'utf8');assert.ok(config.includes(localConfig()));
});
test('config patch contains only Auth templates, subjects and explicit security toggles',()=>{const patch=managementPatch();assert.equal(Object.keys(patch).length,33);for(const key of Object.keys(patch))assert.match(key,/^mailer_(subjects_\w+|templates_\w+_content|notifications_\w+_enabled)$/);assert.equal(catalog.filter(x=>x.notice).length,7);assert.equal(catalog.filter(x=>!x.notice).length,6);});

// ---- Juego en ingles: misma estructura, mismas variables, sin espanol, sincronizado con los archivos ----
import {catalogEn,renderEn,renderTextEn,managementPatchEn} from './templates-en.mjs';
const goVars=html=>[...new Set((html.match(/\{\{[^}]*\}\}/g)??[]).map(x=>x.replace(/"[^"]*"/g,'""')))].sort();
test('hay trece plantillas en ingles con los mismos ids, variables y avisos que el juego en espanol',()=>{
 assert.deepEqual(catalogEn.map(x=>x.id),catalog.map(x=>x.id));
 assert.deepEqual(catalogEn.map(x=>x.vars),catalog.map(x=>x.vars));
 assert.deepEqual(catalogEn.map(x=>!!x.notice),catalog.map(x=>!!x.notice));
});
for(const item of catalogEn)test(`plantilla en ingles generada, accesible y paralela: ${item.id}`,()=>{
 const html=renderEn(item),text=renderTextEn(item),es=catalog.find(x=>x.id===item.id);
 assert.equal(fs.readFileSync(new URL('../../supabase/templates/auth/en/'+item.id+'.html',import.meta.url),'utf8'),html);
 assert.equal(fs.readFileSync(new URL('../../supabase/templates/auth/en/texto/'+item.id+'.txt',import.meta.url),'utf8'),text);
 assert.match(html,/<html lang="en-US" dir="ltr"/);assert.match(html,/<div role="article" aria-roledescription="email" lang="en-US"/);
 assert.equal((html.match(/<h1 /g)??[]).length,1);
 for(const tag of html.match(/<table\b[^>]*>/g))assert.match(tag,/role="presentation"/);
 assert.doesNotMatch(html,/<script|<iframe|<form|javascript:|\.RedirectTo|tracking/i);
 // Mismas variables Go (las cadenas de respaldo entre comillas son texto, no variable).
 assert.deepEqual(goVars(html).map(x=>x.replace(/\s+/g,' ')),goVars(render(es)).map(x=>x.replace(/\s+/g,' ')));
 assert.equal((html.match(/\{\{ \.Token \}\}/g)??[]).length,item.id==='reauthentication'?1:0);
 // Sin restos de espanol en lo visible (se ignoran los valores de variables Go y las cadenas de respaldo de .Data).
 const visible=(html.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ')+' '+text).replace(/\{\{[^}]*\}\}/g,' ');
 assert.doesNotMatch(visible,/\b(contraseña|correo|enlace|Entra|Confirma|Aviso de|Rovaq nunca|Escríbenos|cuenta de|hora\b)/i,item.id);
 assert.equal(managementPatchEn()['mailer_templates_'+item.id+'_content'],html);
});
test('el juego en ingles no cambia la configuracion de produccion: config.toml sigue apuntando solo al espanol',()=>{
 const config=fs.readFileSync(new URL('../../supabase/config.toml',import.meta.url),'utf8');
 assert.doesNotMatch(config,/templates\/auth\/en\//);
 const patch=managementPatchEn();assert.equal(Object.keys(patch).length,33);for(const key of Object.keys(patch))assert.match(key,/^mailer_(subjects_\w+|templates_\w+_content|notifications_\w+_enabled)$/);
});
