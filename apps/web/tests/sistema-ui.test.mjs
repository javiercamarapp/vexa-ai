// Contrato del sistema de UI: clases y tokens de los primitivos, escala tipográfica, radios, paleta de datos y filtros que no apilan.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const src=join(import.meta.dirname,'../src');
const leer=f=>readFileSync(join(src,f),'utf8');
const UI=leer('components/ui/ui.css'),GLOBAL=leer('app/(app)/globals.css'),APPUI=leer('app/(app)/ui.css');
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
test('escala tipográfica: h1 ≤ 20 px, titular narrativo ≤ 18 px, cifra KPI ≤ 30 px', () => {
  for(const f of TODOS){if(AJENOS.test(f)&&!/globals\.css$/.test(f))continue;
    for(const r of reglas(readFileSync(f,'utf8'))){
      const m=/font(?:-size)?:\s*(?:[a-z0-9 ]*?\s)?(\d+(?:\.\d+)?)px/.exec(r.body),c=/font-size:\s*clamp\(\s*\d+px\s*,[^,]*,\s*(\d+)px/.exec(r.body),v=m?+m[1]:c?+c[1]:null;
      if(v===null)continue;
      if(/\.access-flow|\.login/.test(r.sel))continue;
      if(/(^|[\s,>])h1\b/.test(r.sel)&&!/\.access|\.login/.test(r.sel))assert.ok(v<=20,`${f}: ${r.sel} h1 ${v}px > 20`);
      if(/titular/.test(r.sel)&&!/valor/.test(r.sel))assert.ok(v<=18,`${f}: ${r.sel} ${v}px > 18`);
      if(/(kpi|stat-value|pfig-value|fg-big|metric-grid dd|component-amount|\.big\b)/.test(r.sel))assert.ok(v<=30,`${f}: ${r.sel} ${v}px > 30`);
    }}
});
test('tokens de escala: --t-page 20, --t-section 14, --t-kpi ≤ 30', () => {
  const g=n=>+new RegExp('--'+n+':(\\d+)px').exec(APPUI)[1];
  assert.equal(g('t-page'),20);assert.equal(g('t-section'),14);assert.ok(g('t-kpi')<=30);
});
test('radios solo del conjunto {0, 8, 12, 999, 50%}', () => {
  // Fuera de la escala de radios, igual que en tokens-nucleo.test.mjs (que ya exime las reglas .login): el acceso editorial (/login) y la página pública (components/landing, burbujas con cola de 2 px, la construye otro equipo).
  for(const f of TODOS.filter(x=>!/\/components\/landing\/|\/app\/login\//.test(x))){for(const m of readFileSync(f,'utf8').matchAll(/border-radius:\s*([^;}]+)/g)){
    const v=m[1].replace(/var\([^)]*\)/g,'').trim();
    if(v==='16px 16px 0 0')continue; // hoja inferior del celular
    for(const t of v.split(/\s+/).filter(Boolean)){if(/!important/.test(t))continue;
      assert.ok(/^(0|8px|12px|999px|50%|inherit)$/.test(t),`${f}: border-radius ${m[1]} (${t})`);}
  }}
  for(const t of [GLOBAL,APPUI,UI])for(const m of t.matchAll(/--(?:r-btn|r-inner|r-card|ui-radius|ui-radius-sm|r-card-final):\s*(\d+)px/g))assert.ok([8,12].includes(+m[1]),'token de radio '+m[0]);
});
// ---- Paleta de datos ----
const hex=v=>[0,2,4].map(i=>parseInt(v.slice(1+i,3+i),16));
const lum=rgb=>{const[r,g,b]=rgb.map(c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const ratio=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return(x+.05)/(y+.05);};
const bloque=sel=>{const m=new RegExp(sel.replace(/[[\]]/g,'\\$&')+'\\{([^}]*)\\}').exec(UI.slice(UI.indexOf('Paleta de datos')));return m[1];};
const tok=(b,p)=>Array.from({length:8},(_,i)=>new RegExp('--'+p+'-'+(i+1)+':(#[0-9a-f]{6})','i').exec(b)[1]);
test('paleta de datos --chart-1..8 y --soft-1..8 en claro y oscuro', () => {
  for(const [sel,sup] of [[':root','#ffffff'],[':root[data-theme=dark]','#17171a']]){
    const b=bloque(sel),ch=tok(b,'chart'),so=tok(b,'soft'),tx=tok(b,'ink');assert.equal(new Set(ch).size,8);
    ch.forEach((c,i)=>{
      // Marcas ≥ 3:1 salvo las tres del «relieve» documentado (ocre en claro): llevan etiqueta visible y tabla equivalente.
      const min=sel===':root'&&[3].includes(i)?2:3;if(i===7)return; // 8 = tinta (neutro estructural, no es un matiz de categoría)
      assert.ok(ratio(hex(c),hex(sup))>=min,`${sel} chart-${i+1} ${c} contraste ${ratio(hex(c),hex(sup)).toFixed(2)}`);
      // El texto en tinta sobre el fondo suave es legible (≥ 4,5:1).
      const ink=sel===':root'?hex('#0e0e10'):hex('#f4f4f5');assert.ok(ratio(ink,hex(so[i]))>=4.5,`${sel} texto sobre soft-${i+1}`);
      assert.ok(ratio(hex(tx[i]),hex(so[i]))>=4.5,`${sel} --ink-${i+1} sobre soft-${i+1}`);
    });
  }
});
test('estados semánticos distintos de los matices de categoría', () => {
  assert.ok(/--tint-up/.test(APPUI)&&/--tint-warn/.test(APPUI)&&/--tint-down/.test(APPUI));
  assert.ok(!/--chart-[1-8]:#e34948/i.test(UI),'el rojo de pérdidas no es un matiz de categoría');
});
test('Hoy: una sola barra de acciones, KPI sin dato compacto con reintento y filas al 100 %', () => {
  const hoy=leer('components/hoy/hoy-pantalla.tsx'),panel=leer('components/workspace/shared-panel.tsx'),c=leer('components/confianza/confianza.css');
  assert.equal((hoy.match(/aria-label="Actualizar"/g)||[]).length,0,'Hoy no lleva botón Actualizar: se actualiza solo');
  assert.match(panel,/\{!isOverview&&<PageHeader/,'el Resumen ya no tiene encabezado ni botones propios');
  assert.match(hoy,/hoy-reintentar/);assert.match(c,/\.hoy-cols>:only-child\{grid-column:1\/-1\}/);
  assert.match(c,/\.hoy-cols\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(c,/\.hoy-kpi \.sello\{[^}]*white-space:nowrap/);
});
test('Hoy: sin bloques duplicados, los datos nuevos recargan el panel compartido y la tira lleva datos reales', () => {
  const ov=leer('components/workspace/overview-dashboard.tsx'),panel=leer('components/workspace/shared-panel.tsx'),hoy=leer('components/hoy/hoy-pantalla.tsx'),mod=leer('components/hoy/hoy-modelo.mjs');
  for(const dup of ['<FugaTarjeta','<ExecKpis','<Attention'])assert.ok(!ov.includes(dup),'duplicado en el Resumen: '+dup);
  assert.match(ov,/<TopProblems[^>]*criticos=/);
  assert.match(panel,/addEventListener\('vexa:refresh',refrescar\)/);
  assert.match(hoy,/dispatchEvent\(new Event\('vexa:refresh'\)\)/);
  assert.match(hoy,/<Sparkline[^>]*color=\{COLOR\[k\.id\]\}/);assert.match(hoy,/<DeltaChip/);
  assert.match(mod,/variacion:/);assert.match(mod,/serie:/);
});
