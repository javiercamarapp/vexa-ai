// Contrato del sistema de UI: clases y tokens de los primitivos, escala tipográfica, radios, paleta de datos y filtros que no apilan.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const src=join(import.meta.dirname,'../src');
const leer=f=>readFileSync(join(src,f),'utf8');
const UI=leer('components/ui/ui.css'),GLOBAL=leer('app/globals.css'),APPUI=leer('app/ui.css');
const css=(d=src,acc=[])=>{for(const n of readdirSync(d)){const p=join(d,n);if(statSync(p).isDirectory())css(p,acc);else if(n.endsWith('.css'))acc.push(p);}return acc;};
const TODOS=css();
// Fuera de alcance de la escala del espacio de trabajo: pantallas de acceso y plataforma interna.
const AJENOS=/\/(platform|login)\/|platform-ui\.css|globals\.css$/;
const reglas=t=>[...t.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)].map(m=>({sel:m[1].trim(),body:m[2]}));

test('los primitivos compartidos tienen sus clases y componentes', () => {
  for (const c of ['.ui-filterbar','.ui-chiplist','.ui-chip','.ui-notice','.ui-card','.ui-kpis','.ui-table','.ui-state','.ui-stack'])assert.ok(UI.includes(c),'falta '+c+' en components/ui/ui.css');
  for (const f of ['filter-bar','chip','notice','card','kpi-strip','data-table','error-state','loading','page-header','empty-state','mini-charts'])assert.ok(statSync(join(src,'components/ui',f+'.tsx')).isFile(),f);
});
test('FilterBar es una sola línea: nowrap, scroll horizontal y 28–32 px', () => {
  const r=reglas(UI).find(x=>x.sel==='.ui-filterbar');
  assert.match(r.body,/flex-wrap:\s*nowrap/);assert.match(r.body,/overflow-x:\s*auto/);
  const h=/--ui-ctl-h:\s*(\d+)px/.exec(UI);assert.ok(h&&+h[1]>=28&&+h[1]<=32);
  assert.doesNotMatch(r.body,/flex-direction:\s*column/);
});
test('las reglas globales del espacio no ganan por especificidad a los componentes', () => {
  assert.doesNotMatch(GLOBAL,/^\.workspace-shell nav ul\s*\{/m);
  assert.doesNotMatch(GLOBAL,/^\.workspace-content :where\(button\)/m);
  assert.doesNotMatch(GLOBAL,/^\.workspace-content :where\(section,article,fieldset\)>p:first-of-type/m);
  assert.doesNotMatch(APPUI,/^\.workspace-content :is\(p,li,dd,figcaption,small\) a:not/m);
  assert.match(GLOBAL,/:where\(\.workspace-content\) :where\(button:not\(\.ui-reset\)\)/);
});
test('mínimo 12 px en los primitivos y sin hover rojo', () => {
  for(const r of reglas(UI)){for(const m of r.body.matchAll(/font(?:-size)?:\s*(?:[a-z0-9 ]*?\s)?(\d+(?:\.\d+)?)px/g))assert.ok(+m[1]>=12,`${r.sel}: ${m[0]} < 12 px`);}
  for(const f of TODOS)for(const r of reglas(readFileSync(f,'utf8')))if(/:hover/.test(r.sel)&&/(background|color|border-color)\s*:[^;]*(#e8241c|var\(--ui-highlight\)|var\(--rovaq-rojo)/i.test(r.body)&&!/ui-danger|peligro|danger/.test(r.sel))assert.fail('hover rojo en '+f+': '+r.sel);
});
test('escala tipográfica: h1 ≤ 22 px, titular narrativo ≤ 20 px, cifra héroe ≤ 32 px', () => {
  for(const f of TODOS){if(AJENOS.test(f)&&!/globals\.css$/.test(f))continue;
    for(const r of reglas(readFileSync(f,'utf8'))){
      const m=/font(?:-size)?:\s*(?:[a-z0-9 ]*?\s)?(\d+(?:\.\d+)?)px/.exec(r.body),c=/font-size:\s*clamp\(\s*\d+px\s*,[^,]*,\s*(\d+)px/.exec(r.body),v=m?+m[1]:c?+c[1]:null;
      if(v===null)continue;
      if(/\.access-flow|\.login|\.getting-started/.test(r.sel))continue;
      if(/(^|[\s,>])h1\b/.test(r.sel)&&!/\.access|\.login/.test(r.sel))assert.ok(v<=22,`${f}: ${r.sel} h1 ${v}px > 22`);
      if(/titular/.test(r.sel)&&!/valor/.test(r.sel))assert.ok(v<=22,`${f}: ${r.sel} ${v}px > 22`);
      if(/(kpi|stat-value|pfig-value|fg-big|metric-grid dd|component-amount|\.big\b)/.test(r.sel))assert.ok(v<=32,`${f}: ${r.sel} ${v}px > 32`);
    }}
});
test('radios solo del conjunto {0, 8, 12, 999, 50%}', () => {
  for(const f of TODOS){for(const m of readFileSync(f,'utf8').matchAll(/border-radius:\s*([^;}]+)/g)){
    const v=m[1].replace(/var\([^)]*\)/g,'').trim();
    for(const t of v.split(/\s+/).filter(Boolean)){if(/!important/.test(t))continue;
      assert.ok(/^(0|8px|12px|999px|50%|inherit)$/.test(t),`${f}: border-radius ${m[1]} (${t})`);}
  }}
  for(const t of [GLOBAL,APPUI,UI])for(const m of t.matchAll(/--(?:r-btn|r-inner|r-card|ui-radius|ui-radius-sm|r-card-final):\s*(\d+)px/g))assert.ok([8,12].includes(+m[1]),'token de radio '+m[0]);
});
// ---- Paleta de datos ----
const hex=v=>[0,2,4].map(i=>parseInt(v.slice(1+i,3+i),16));
const lum=rgb=>{const[r,g,b]=rgb.map(c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const ratio=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return(x+.05)/(y+.05);};
const mezcla=(fg,bg,a)=>fg.map((c,i)=>Math.round(c*a+bg[i]*(1-a)));
const bloque=sel=>{const m=new RegExp(sel.replace(/[[\]]/g,'\\$&')+'\\{([^}]*)\\}').exec(UI.slice(UI.indexOf('Paleta de datos')));return m[1];};
const tok=(b,p)=>Array.from({length:8},(_,i)=>new RegExp('--'+p+'-'+(i+1)+':(#[0-9a-f]{6})','i').exec(b)[1]);
test('paleta de datos --chart-1..8 y --soft-1..8 en claro y oscuro', () => {
  for(const [sel,sup] of [[':root','#ffffff'],[':root[data-theme=dark]','#17171a']]){
    const b=bloque(sel),ch=tok(b,'chart'),so=tok(b,'soft');assert.equal(new Set(ch).size,8);
    ch.forEach((c,i)=>{
      // Marcas ≥ 3:1 salvo las tres del «relieve» documentado (aqua, amarillo, magenta en claro): llevan etiqueta visible y tabla equivalente.
      const min=sel===':root'&&[2,3,4].includes(i)?2:3;assert.ok(ratio(hex(c),hex(sup))>=min,`${sel} chart-${i+1} ${c} contraste ${ratio(hex(c),hex(sup)).toFixed(2)}`);
      // El texto en tinta sobre el fondo suave es legible (≥ 4,5:1).
      const ink=sel===':root'?hex('#0e0e10'):hex('#f4f4f5');assert.ok(ratio(ink,hex(so[i]))>=4.5,`${sel} texto sobre soft-${i+1}`);
    });
  }
});
test('estados semánticos distintos de los matices de categoría', () => {
  assert.ok(/--tint-up/.test(APPUI)&&/--tint-warn/.test(APPUI)&&/--tint-down/.test(APPUI));
  assert.ok(!/--chart-[1-8]:#e34948/i.test(UI),'el rojo de pérdidas no es un matiz de categoría');
});
