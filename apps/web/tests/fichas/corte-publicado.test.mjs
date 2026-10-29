import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {URL_CORTE_PUBLICADO,urlCortePublicado,resumenCorte} from '../../src/lib/legibilidad/dinero.mjs';
test('Preparar lee el corte con el periodo, la moneda, la base y el exponente del alcance, pero sin snapshot_id ni scope_hash (A3, QA-2)', () => {
  const u=new URL(urlCortePublicado('date_start=2025-10-01&date_end=2026-10-01&currency=USD&basis=marketplace_line_price&exponent=2&snapshot_id=f3937770-c59a-5e77-a4c6-92680914b8ba&scope_hash='+'a'.repeat(64)+'&q=algo&cursor=zz'),'http://x');
  assert.equal(u.searchParams.get('resource'),'problems');assert.equal(u.searchParams.get('meta_only'),'1');
  for(const [k,v] of [['date_start','2025-10-01'],['date_end','2026-10-01'],['currency','USD'],['basis','marketplace_line_price'],['exponent','2']])assert.equal(u.searchParams.get(k),v,k);
  for(const k of ['snapshot_id','scope_hash','q','cursor'])assert.equal(u.searchParams.has(k),false,k);
});
test('sin base en la lectura el servidor asume «net» y mes en curso: la lectura SIEMPRE lleva la base cuando la URL la trae', () => {
  assert.equal(new URL(urlCortePublicado('date_start=2025-10-01&date_end=2026-10-01&basis=marketplace_line_price'),'http://x').searchParams.get('basis'),'marketplace_line_price');
  assert.equal(urlCortePublicado(''),URL_CORTE_PUBLICADO);
  const u=new URL(urlCortePublicado('sku=A&sku=B&source=csv'),'http://x');assert.deepEqual(u.searchParams.getAll('sku'),['A','B']);assert.deepEqual(u.searchParams.getAll('source'),['csv']);
});
test('el componente y la página usan esa lectura con el alcance de la URL', () => {
  const src=readFileSync(new URL('../../src/components/datos/economia-resumen.tsx',import.meta.url),'utf8');
  assert.ok(src.includes('urlCortePublicado(query)'));
  assert.ok(!src.includes("resource=metrics'+(query"));
  const page=readFileSync(new URL('../../src/app/(app)/(workspace)/economics/page.tsx',import.meta.url),'utf8');
  assert.ok(/ALCANCE=\[[^\]]*'basis'[^\]]*'exponent'/.test(page),'la página reenvía la base y el exponente');
  assert.ok(!/ALCANCE=\[[^\]]*snapshot_id/.test(page),'la página no reenvía snapshot_id');
});
test('con la meta del corte f3937770 muestra rango y estado', () => {
  const c=resumenCorte({snapshot_id:'f3937770-c59a-5e77-a4c6-92680914b8ba',state:'ready',coverage:'x',watermark:'2026-10-22T06:15:26.435Z',scope:{date_start:'2025-10-01T00:00:00.000Z',date_end:'2026-10-01T00:00:00.000Z',basis:'net',currency:'USD'}});
  assert.equal(c.disponible,true);assert.equal(c.snapshot,'f3937770');assert.ok(c.rango);
});
test('la lectura meta_only no trae cifras: su leyenda tecnica de anclaje no se muestra como cobertura', () => {
  const c=resumenCorte({snapshot_id:'f3937770-c59a-5e77-a4c6-92680914b8ba',state:'ready',coverage:'Anclaje de alcance: sin cifras.',watermark:null,scope:{date_start:'2025-10-01T00:00:00.000Z',date_end:'2026-10-01T00:00:00.000Z',basis:'net',currency:'USD'}});
  assert.equal(c.cobertura,null);
});
