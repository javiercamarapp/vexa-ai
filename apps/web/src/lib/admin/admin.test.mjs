// Pruebas de las correcciones QA3 (vistas de administración): contraste de Conexiones, estados, Histórico, Equipo, login.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const leer=(rel)=>readFileSync(new URL(rel,import.meta.url),'utf8');
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),lin=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;},L=c=>0.2126*lin(c[0])+0.7152*lin(c[1])+0.0722*lin(c[2]);
const ratio=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
const tokens=(glob)=>({claro:/(?:^|\n):root \{([^}]*)\}/.exec(glob)[1],oscuro:/:root\[data-theme=dark\] \{([^}]*)\}/.exec(glob)[1]});
const tok=(b,n)=>{const m=new RegExp('--'+n+':\\s*(#[0-9a-fA-F]{6})').exec(b);assert.ok(m,'token '+n);return rgb(m[1]);};
test('QA3-001: la lista de Conexiones fija color y fondo con tokens en una regla que gana a los botones globales',()=>{
 const css=leer('../../components/connections.module.css');
 assert.doesNotMatch(css,/(?<!\.list )\.item[{:\[]/,'.item suelto (0,1,0) pierde contra `.workspace-shell :where(button)` y deja texto claro sobre fondo claro');
 const base=/\.list \.item\{([^}]*)\}/.exec(css)?.[1];assert.ok(base,'regla .list .item');
 assert.match(base,/color:var\(--ink\)/);assert.match(base,/background:var\(--ui-surface\)/);
 const marcada=/\.list \.item\[aria-pressed=true\][^{]*\{([^}]*)\}/.exec(css)?.[1];assert.ok(marcada,'estado seleccionado');
 assert.match(marcada,/color:var\(--ink\)/);assert.match(marcada,/background:var\(--ui-soft\)/);
 assert.match(css,/\.name small\{[^}]*color:var\(--muted\)/);
});
test('QA3-001: tinta y subtítulo de la lista cumplen 4.5:1 sobre superficie y fondo suave, y el borde activo 3:1, en claro y oscuro',()=>{
 for(const [tema,b] of Object.entries(tokens(leer('../../app/globals.css')))){
  for(const fondo of ['ui-surface','ui-soft'])for(const t of ['ink','muted']){const r=ratio(tok(b,t),tok(b,fondo));assert.ok(r>=4.5,`${tema}: ${t} sobre ${fondo} ${r.toFixed(2)}:1`);}
  const r=ratio(tok(b,'ui-focus'),tok(b,'ui-surface'));assert.ok(r>=3,`${tema}: borde activo ${r.toFixed(2)}:1`);
 }
});
