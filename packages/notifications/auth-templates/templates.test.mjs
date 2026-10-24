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
