import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {brand} from '../../apps/web/src/lib/brand.mjs';
import {catalog,render,managementPatch,localConfig} from './templates.mjs';
for(const item of catalog)test(`consistent accessible template: ${item.id}`,()=>{
 const html=render(item);assert.equal(fs.readFileSync(new URL('../../supabase/templates/auth/'+item.id+'.html',import.meta.url),'utf8'),html);
 assert.match(html,/<html lang="es" dir="ltr">/);assert.match(html,/<title>[^<]+ · VEXA<\/title>/);assert.equal((html.match(/<h1 /g)??[]).length,1);
 for(const tag of html.match(/<table\b[^>]*>/g))assert.match(tag,/role="presentation"/);
 assert.ok(html.indexOf('VEXA<span')<html.indexOf('<h1'));
 assert.doesNotMatch(html,/<script|<iframe|<form|javascript:|\.Data\b|\.RedirectTo|tracking|https?:\/\//i);
 assert.equal((html.match(/\{\{ \.ConfirmationURL \}\}/g)??[]).length,item.action?1:0);
 assert.equal((html.match(/\{\{ \.Token \}\}/g)??[]).length,item.code?1:0);
 assert.equal(managementPatch()['mailer_templates_'+item.id+'_content'],html);
 const config=fs.readFileSync(new URL('../../supabase/config.toml',import.meta.url),'utf8');assert.ok(config.includes(localConfig()));
});
test('config patch contains only Auth templates, subjects and explicit security toggles',()=>{const patch=managementPatch();assert.equal(Object.keys(patch).length,33);for(const key of Object.keys(patch))assert.match(key,/^mailer_(subjects_\w+|templates_\w+_content|notifications_\w+_enabled)$/);assert.equal(catalog.filter(x=>x.notice).length,7);assert.equal(catalog.filter(x=>!x.notice).length,6);});

test('one asset configuration, safe same-origin email logo and invalid paths rejected',()=>{
 const settings={logoPath:'/brand/vexa-logo.png',width:160,height:48};
 assert.deepEqual(brand(settings),settings);
 const html=render(catalog[2],settings);assert.match(html,/<img src="\{\{ \.SiteURL \}\}\/brand\/vexa-logo.png" width="160" height="48" alt="VEXA AI"/);
 for(const logoPath of ['https://foreign.test/logo.png','//foreign.test/a.png','/brand/../logo.png','/brand/logo.svg','/brand/logo.png?x=1','/brand/logo.png" onerror="alert(1)'])assert.throws(()=>brand({...settings,logoPath}));
 for(const width of [0,601,1.5,'160'])assert.throws(()=>brand({...settings,width}));
});
