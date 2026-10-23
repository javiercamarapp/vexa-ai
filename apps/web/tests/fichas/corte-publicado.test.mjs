import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {URL_CORTE_PUBLICADO,resumenCorte} from '../../src/lib/legibilidad/dinero.mjs';
test('Preparar lee el corte activo sin filtros de la URL (un enlace viejo no lo rompe)', () => {
  const u=new URL(URL_CORTE_PUBLICADO,'http://x');
  assert.equal(u.searchParams.get('resource'),'problems');assert.equal(u.searchParams.get('meta_only'),'1');
  for(const k of ['snapshot_id','scope_hash','date_start','date_end','currency'])assert.equal(u.searchParams.has(k),false,k);
});
test('el componente usa esa lectura y ya no la consulta completa de metricas con alcance de la URL', () => {
  const src=readFileSync(new URL('../../src/components/datos/economia-resumen.tsx',import.meta.url),'utf8');
  assert.ok(src.includes('URL_CORTE_PUBLICADO'));
  assert.ok(!src.includes("resource=metrics'+(query"));
});
test('con la meta del corte f3937770 muestra rango y estado', () => {
  const c=resumenCorte({snapshot_id:'f3937770-c59a-5e77-a4c6-92680914b8ba',state:'ready',coverage:'x',watermark:'2026-10-22T06:15:26.435Z',scope:{date_start:'2025-10-01T00:00:00.000Z',date_end:'2026-10-01T00:00:00.000Z',basis:'net',currency:'USD'}});
  assert.equal(c.disponible,true);assert.equal(c.snapshot,'f3937770');assert.ok(c.rango);
});
test('la lectura meta_only no trae cifras: su leyenda tecnica de anclaje no se muestra como cobertura', () => {
  const c=resumenCorte({snapshot_id:'f3937770-c59a-5e77-a4c6-92680914b8ba',state:'ready',coverage:'Anclaje de alcance: sin cifras.',watermark:null,scope:{date_start:'2025-10-01T00:00:00.000Z',date_end:'2026-10-01T00:00:00.000Z',basis:'net',currency:'USD'}});
  assert.equal(c.cobertura,null);
});
