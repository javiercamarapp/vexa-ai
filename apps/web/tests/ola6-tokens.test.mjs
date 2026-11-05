// Ola 6 (UI fina): los tokens de diseño viven en UN solo archivo y los controles los consumen. Alturas 28/32/36, radios cerrados, peso medio, un solo acento.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const src=join(import.meta.dirname,'../src');
const leer=f=>readFileSync(join(src,f),'utf8');
const T=leer('components/ui/tokens-ui.css'),UI=leer('components/ui/ui.css'),OV=leer('components/ui/overlay.css'),LAYOUT=leer('app/(app)/layout.tsx');
const tok=(css,n)=>new RegExp('--'+n+':\\s*([^;}]+)').exec(css)?.[1].trim();
test('el archivo de tokens se importa antes que globals.css', () => {
  const a=LAYOUT.indexOf('tokens-ui.css'),b=LAYOUT.indexOf('./globals.css');
  assert.ok(a>0&&b>a,'tokens-ui.css debe importarse antes que globals.css');
});
test('alturas de control 28 / 32 / 36 y zona táctil 44 solo para celular', () => {
  assert.equal(tok(T,'ux-h-sm'),'28px');assert.equal(tok(T,'ux-h-md'),'32px');assert.equal(tok(T,'ux-h-lg'),'36px');assert.equal(tok(T,'ux-hit'),'44px');
});
test('radios cerrados {8, 12, 999} y borde de 1 px', () => {
  assert.equal(tok(T,'ux-r-ctl'),'8px');assert.equal(tok(T,'ux-r-card'),'12px');assert.equal(tok(T,'ux-r-pill'),'999px');assert.equal(tok(T,'ux-bd-w'),'1px');
});
test('tipografía de control 12–13 px, peso 500; icono de trazo 1.5', () => {
  assert.equal(tok(T,'ux-fs'),'13px');assert.equal(tok(T,'ux-fs-sm'),'12px');assert.equal(tok(T,'ux-fw'),'500');assert.equal(tok(T,'ux-icon-stroke'),'1.5');
});
test('sin sombra en reposo; una sola sombra flotante', () => {
  assert.equal(tok(T,'ux-shadow-rest'),'none');assert.match(tok(T,'ux-shadow-float'),/--sh-pop/);
});
test('espejos heredados iguales a los tokens', () => {
  assert.equal(tok(UI,'ui-ctl-h'),tok(T,'ux-h-md'));assert.equal(tok(OV,'ov-ctl'),tok(T,'ux-h-md'));
  for(const [alias,tk] of [['btn-h','ux-h-md'],['btn-h-m','ux-h-lg'],['btn-radius','ux-r-ctl'],['btn-gap','ux-gap'],['btn-px','ux-px']])assert.equal(tok(UI,alias),`var(--${tk})`,'--'+alias);
});
test('un solo acento interactivo: el primario suave y el recorrido lo toman de --ux-accent', () => {
  assert.equal(tok(UI,'btn-soft-ink'),'var(--ux-accent)');
  const onb=leer('components/onboarding/onboarding.css');
  assert.doesNotMatch(onb,/#0b57d0|#8ab4f8/i,'el recorrido ya no define su propio azul');
  assert.match(onb,/--onb-resalte:\s*#1f4fb0/);assert.match(onb,/data-theme=dark\]\s*\{\s*--onb-resalte:\s*#a9c1f2/);
  assert.equal(tok(T,'ux-accent'),'#1f4fb0');
});
test('iconos de trazo lineal: 1.5 en todos los juegos de la app', () => {
  for(const f of ['components/ui/icons.tsx','components/ui/button.tsx','components/platform/icons.tsx','components/workspace/icon.tsx','components/agente/icons.tsx'])assert.doesNotMatch(leer(f),/strokeWidth="1\.75"/,f);
});
test('guía y recorrido: botones de 32 px y flotante con la sombra única (el botón «Guía» de 28 px lo fija onboarding-tour.test)', () => {
  const c=leer('components/onboarding/onboarding.css');
  assert.match(c,/:root \.onb-btn, :root \.onb-btn-sec \{ min-height:var\(--ux-h-md\)/);
  assert.match(c,/box-shadow:var\(--ux-shadow-float\)/);assert.doesNotMatch(c,/\.onb-btn \{[^}]*background:var\(--ink\)/);assert.match(leer('app/(app)/globals.css'),/\.workspace button \{ min-width:0; min-height:var\(--ux-h-md\)/);
});
test('filtros, chips y pestañas usan los tokens de altura (28 y 32), sin 34, 36 ni 40 sueltos', () => {
  assert.match(leer('app/(app)/ui.css'),/\.tab-link \{[^}]*min-height:var\(--ux-h-md\)/);
  assert.match(leer('app/(app)/ui.css'),/\.fchip\{[^}]*height:var\(--ux-h-sm\)/);
  assert.match(leer('components/panel-comun/panel-comun.css'),/\.pc-tabs a\{[^}]*height:var\(--ux-h-md\)/);
  assert.doesNotMatch(leer('components/map/mapa.css'),/mp-seg button\{[^}]*min-height:34px/);
});
test('campos de texto y selects: 32 px (altura por token, interlineado 1.25 para que el relleno no los estire)', () => {
  const g=leer('app/(app)/globals.css');
  assert.match(g,/\.workspace-content :where\(input:not\(\[type=checkbox\]\):not\(\[type=radio\]\),select,textarea\) \{ line-height:1\.25; box-shadow:none; min-height:var\(--ux-h-md\); padding:6px 10px/);
  assert.match(leer('components/ops-panels.module.css'),/\.form :is\(input[^{]*\{[^}]*border-radius:var\(--ux-r-ctl\)[^}]*\/1\.25/);
});
test('ningún control del espacio de trabajo declara peso 600 en la capa base de botones y chips', () => {
  assert.doesNotMatch(leer('components/ui/ui.css'),/\.btn,button\.btn,a\.btn\)\{[^}]*font:600/);
  assert.match(leer('components/agente/una-pagina.css'),/font:var\(--ux-fw\) var\(--ctl-fs\)/);
});
