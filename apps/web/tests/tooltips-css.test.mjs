import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {colocarTooltip} from '../src/lib/charts/escala.mjs';
/** Causa raíz del tooltip de 1 carácter (24-oct): `overflow-wrap:anywhere` heredado + `min-width:0` + ancho por espacio libre. Estas pruebas lo impiden por estructura. */
const raiz=join(import.meta.dirname,'../src');
const css=d=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?css(p):/\.css$/.test(n)?[p]:[];});
const reglas=src=>{const out=[];const s=src.replace(/\/\*[\s\S]*?\*\//g,'');const re=/([^{}]+)\{([^{}]*)\}/g;let m;while((m=re.exec(s)))out.push({sel:m[1].trim(),cuerpo:m[2]});return out;};
const TOOLTIP=/(^|[\s,>(])\.(chart-tip|mp-tip|pp-tip|tip-bubble|vx-tip)(?![\w-])/;

test('ninguna regla de tooltip usa overflow-wrap:anywhere ni word-break:break-all', () => {
  const malas=[];
  for (const f of css(raiz)) for (const r of reglas(readFileSync(f,'utf8'))) {
    if (TOOLTIP.test(r.sel)&&/overflow-wrap\s*:\s*anywhere|word-break\s*:\s*break-all/.test(r.cuerpo)) malas.push(f.replace(raiz+'/','')+' → '+r.sel);
  }
  assert.deepEqual(malas,[],'tooltip con corte por letra: '+malas.join(' | '));
});

test('el tooltip fija su ancho por contenido (max-content) con piso 160 px, tope 280 px y salto por palabras', () => {
  const todas=css(raiz).flatMap(f=>reglas(readFileSync(f,'utf8')));
  const base=todas.find(r=>/\.chart-tip/.test(r.sel)&&/\.mp-tip/.test(r.sel)&&/\.pp-tip/.test(r.sel)&&/\.tip-bubble/.test(r.sel)&&/width\s*:\s*max-content/.test(r.cuerpo));
  assert.ok(base,'falta la regla compartida de tooltips');
  assert.match(base.cuerpo,/min-width\s*:\s*160px/);
  assert.match(base.cuerpo,/max-width\s*:\s*min\(280px,\s*calc\(100vw - 32px\)\)/);
  assert.match(base.cuerpo,/overflow-wrap\s*:\s*break-word/);
  assert.match(base.cuerpo,/white-space\s*:\s*normal/);
  assert.match(base.cuerpo,/pointer-events\s*:\s*none/);
  // Los hijos del tooltip también anulan el `anywhere` que `.workspace-content span` les da por herencia.
  assert.ok(todas.some(r=>/\.chart-tip/.test(r.sel)&&/span/.test(r.sel)&&/overflow-wrap\s*:\s*break-word/.test(r.cuerpo)),'los hijos del tooltip deben fijar overflow-wrap:break-word');
});

test('colocarTooltip: junto al punto, volteado y siempre dentro del viewport con 8 px', () => {
  const dentro=(p,w,h,vw,vh)=>p.x>=8-1e-9&&p.y>=8-1e-9&&p.x+w<=vw-8+1e-9&&p.y+h<=vh-8+1e-9;
  const w=200,h=110,vw=1440,vh=900;
  const centro=colocarTooltip({ax:600,ay:300,w,h,vw,vh});
  assert.equal(centro.lado,'derecha'); assert.equal(centro.x,614);
  const der=colocarTooltip({ax:1400,ay:300,w,h,vw,vh});
  assert.equal(der.lado,'izquierda'); assert.equal(der.x,1400-14-w);
  for (const ax of [0,3,100,700,1300,1436,1440]) for (const ay of [0,5,450,880,900]) for (const modo of ['lado','arriba']) {
    const p=colocarTooltip({ax,ay,w,h,vw,vh,modo,sep:12});
    assert.ok(dentro(p,w,h,vw,vh),`${modo} ${ax},${ay} → ${JSON.stringify(p)}`);
  }
  // Celular: tooltip más ancho que la mitad del viewport, aún dentro.
  for (const ax of [0,60,195,330,390]) assert.ok(dentro(colocarTooltip({ax,ay:200,w:240,h:90,vw:390,vh:812}),240,90,390,812));
  // «arriba» cae debajo del punto cuando arriba no cabe; centrado y volteado.
  const bajo=colocarTooltip({ax:200,ay:30,w,h,vw,vh,modo:'arriba',sep:20});
  assert.equal(bajo.vertical,'abajo'); assert.equal(bajo.y,50);
  const alto=colocarTooltip({ax:200,ay:500,w,h,vw,vh,modo:'arriba',sep:20});
  assert.equal(alto.vertical,'arriba'); assert.equal(alto.y,500-20-h);
});
