// Contrato del sistema único de overlays: todo panel flotante (Drawer, Modal, Popover, confirmaciones, navegación móvil, copiloto, historial)
// se construye con components/ui/overlay.tsx; sus estilos viven en components/ui/overlay.css con las medidas de ESTILO-ELEGIDO.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
const src=join(import.meta.dirname,'../src');
const walk=(d,ext,acc=[])=>{for(const n of readdirSync(d)){const p=join(d,n);if(statSync(p).isDirectory())walk(p,ext,acc);else if(ext.some(e=>n.endsWith(e)))acc.push(p);}return acc;};
const TSX=walk(src,['.tsx']),CSS=walk(src,['.css']);
const OVERLAY=join(src,'components/ui/overlay.tsx'),OVCSS=join(src,'components/ui/overlay.css');
const rel=f=>relative(src,f);
const leer=f=>readFileSync(f,'utf8');
const reglas=t=>[...t.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)].map(m=>({sel:m[1].trim(),body:m[2]}));

test('ningún role="dialog", aria-modal, <dialog> ni showModal fuera de components/ui/overlay.tsx', () => {
  for(const f of TSX){if(f===OVERLAY)continue;
    const t=leer(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
    assert.doesNotMatch(t,/role=\{?["'](alert)?dialog["']/,rel(f)+': role=dialog fuera del sistema de overlays');
    assert.doesNotMatch(t,/aria-modal/,rel(f)+': aria-modal fuera del sistema');
    assert.doesNotMatch(t,/<dialog[\s>]/,rel(f)+': <dialog> fuera del sistema');
    assert.doesNotMatch(t,/\.showModal\(/,rel(f)+': showModal fuera del sistema');
  }
});
test('Drawer, Modal y Popover solo se importan del sistema', () => {
  for(const f of TSX){if(f===OVERLAY)continue;const t=leer(f);
    if(/<(Drawer|Modal|Popover)[\s>]/.test(t))assert.match(t,/from '[./]*(components\/)?(ui\/)?overlay'/,rel(f)+': usa un overlay sin importarlo de ui/overlay');}
});
test('anatomía única: cabecera con título enlazado, cerrar de 28 px, cuerpo con scroll y pie fijo', () => {
  const t=leer(OVERLAY),c=leer(OVCSS);
  assert.match(t,/aria-labelledby/);assert.match(t,/onCancel/);assert.match(t,/showModal/);assert.match(t,/\.focus\?\.\(\)/);
  assert.match(t,/aria-label=\{t\('comun\.cerrar'\)\}/);// «Cerrar» vive en el diccionario (es: Cerrar / en: Close)
  const sizes=/DRAWER_SIZES=\{sm:420,md:480,lg:640\}/.test(t)&&/MODAL_SIZES=\{sm:440,md:560\}/.test(t);assert.ok(sizes,'anchos 420/480/640 y 440/560');
  const close=reglas(c).find(r=>/overlay-close/.test(r.sel)&&/width:28px/.test(r.body));assert.ok(close&&/height:28px/.test(close.body));
  assert.ok(reglas(c).some(r=>/\.overlay-body\{/.test(r.sel+'{')&&/overflow:auto/.test(r.body)&&/padding:var\(--ov-pad\)/.test(r.body)));
  assert.match(c,/--ov-pad:16px/);
  assert.ok(reglas(c).some(r=>/\.overlay-foot/.test(r.sel)&&/justify-content:flex-end/.test(r.body)&&/border-top:1px solid/.test(r.body)));
});
test('medidas: fuente ≥ 12 px, controles de 32 px, radios {8,12,999}, sin inputs ovalados', () => {
  const c=leer(OVCSS);
  assert.match(c,/--ov-ctl:32px/);
  for(const r of reglas(c)){
    for(const m of r.body.matchAll(/font(?:-size)?:\s*(?:[a-z0-9 ]*?\s)?(\d+(?:\.\d+)?)px/g))assert.ok(+m[1]>=12,`${r.sel}: ${m[0]} < 12 px`);
    for(const m of r.body.matchAll(/border-radius:\s*([^;}]+)/g))for(const tk of m[1].trim().split(/\s+/))assert.ok(/^(0|8px|12px|999px|50%)$/.test(tk)||(tk==='16px'&&/dialog\.drawer/.test(r.sel)),`${r.sel}: radio ${tk}`);
    if(/(^|[\s,])(input|select|textarea)\b/.test(r.sel)&&!/checkbox|radio/.test(r.sel)){const m=/border-radius:\s*(\d+)px/.exec(r.body);if(m)assert.ok(+m[1]<=12,`${r.sel}: input ovalado ${m[1]}px`);}
  }
  const inputs=reglas(c).filter(r=>/:is\(input:not\(/.test(r.sel)&&/min-height:var\(--ov-ctl\)/.test(r.body));assert.ok(inputs.length>0);
  for(const r of inputs)assert.match(r.body,/border-radius:8px/);
  assert.ok(reglas(c).some(r=>/textarea/.test(r.sel)&&/border-radius:8px/.test(r.body)),'textarea con radio 8');
  assert.ok(reglas(c).some(r=>/\.btn\b/.test(r.sel)&&/min-height:var\(--ov-ctl\)/.test(r.body)),'botones de 32 px');
});
test('animación ≤ 200 ms y solo con prefers-reduced-motion: no-preference; el botón primario es suave (no negro)', () => {
  const c=leer(OVCSS);
  assert.match(c,/@media\(prefers-reduced-motion:no-preference\)/);
  for(const m of c.matchAll(/animation:[^;}]*?\b(\d+)ms/g))assert.ok(+m[1]<=200,'animación > 200 ms: '+m[0]);
  assert.match(c,/--ov-in:180ms/);
  assert.match(c,/btn-soft-bg/);assert.doesNotMatch(c,/ui-action\b/);
});
test('sin estilos de overlays duplicados fuera de overlay.css', () => {
  for(const f of CSS){if(f===OVCSS)continue;const t=leer(f).replace(/\/\*[\s\S]*?\*\//g,'');
    assert.doesNotMatch(t,/dialog\.drawer|dialog\.modal|\.drawer-panel|\.modal-panel|\.overlay-(head|body|foot)\b|\.popover-panel|\.confirmation-dialog|\.workspace-mobile-dialog\s*\{|\.pf-copilot-layer|\.agente-history\s*\{/,rel(f)+': estilos de overlay fuera de overlay.css');}
});
test('todas las superficies se migraron al sistema', () => {
  const usa=(f,rx)=>assert.match(leer(join(src,f)),rx,f);
  usa('components/confirmation-dialog.tsx',/<Modal[\s\S]*alert/);
  usa('components/workspace/shell.tsx',/<Drawer side="bottom"/);
  usa('components/platform/copilot-panel.tsx',/<Drawer/);
  usa('components/platform/platform-views.tsx',/<Modal open alert/);
  usa('components/agente/historial.tsx',/<Drawer/);
  usa('components/ui/filter-drawer.tsx',/<Drawer/);
  usa('components/workspace/current-problems.tsx',/<Drawer/);
});
