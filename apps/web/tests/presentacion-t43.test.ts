// T43: notas que llegan de los paquetes con clave estable (`noteKey`), errores de rutas por código, motivos EN->ES y calcos del inglés, con el TRADUCTOR REAL.
// Las aserciones fijan texto exacto o cableado: si se rompe el cambio, fallan.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {traductor} from '../src/lib/i18n';
import {notaDe} from '../src/lib/legibilidad/trad.mjs';

const en = traductor('en'), es = traductor('es');
const ACENTOS = /[áéíóúñ¿¡«»]/i;
const leer = (rel: string) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

test('notas de tendencias e incidencias: la clave decide el idioma; sin clave o sin traductor, el español del paquete', () => {
  const vista = {note: 'Cuenta incidencias (filas de issues), no problemas agrupados.', noteKey: 'tr.nt.incCategorias'};
  assert.match(notaDe(en, vista), /^Counts incidents \(issue rows\), not grouped problems\./);
  assert.equal(notaDe(es, vista), es('tr.nt.incCategorias' as never));
  assert.match(notaDe(es, vista), /^Cuenta incidencias \(filas de issues\), no problemas agrupados\./);
  assert.equal(notaDe(null, vista), vista.note, 'sin traductor, el español que mandó el paquete');
  assert.equal(notaDe(en, {note: 'Texto viejo'}), 'Texto viejo', 'una vista sin clave (otro consumidor) no se toca');
  assert.equal(notaDe(en, null), '');
  for (const k of ['tr.nt.tendencias', 'tr.nt.incCategorias', 'tr.nt.incProblema', 'tr.nt.incTotal']) {
    const txt = en(k as never);
    assert.ok(!ACENTOS.test(txt.replace(/«|»/g, '')), 'español bajo en: ' + k);
    assert.notEqual(txt, es(k as never));
  }
  assert.equal(en('tr.nt.tendenciasMuestra' as never, {p: 3}), 'Estimated from a 3 % sample of the conversations: dating all of them (by their first message) does not fit in the allowed time.');
  assert.match(es('tr.nt.tendenciasMuestra' as never, {p: 3}), /^Estimado con una muestra del 3 % de las conversaciones/);
});

test('las tres pantallas pintan la nota con notaDe y no el texto crudo del paquete', () => {
  assert.match(leer('src/components/ui/trend-chart.tsx'), /\{notaDe\(t,view\)\}/);
  assert.doesNotMatch(leer('src/components/ui/trend-chart.tsx'), /\{view\.note\}/);
  assert.match(leer('src/components/ui/trend-chart.tsx'), /t\('tr\.nt\.tendenciasMuestra'/);
  assert.match(leer('src/components/ui/incidence-evolution.tsx'), /\{notaDe\(t,v\)\}/);
  assert.doesNotMatch(leer('src/components/ui/incidence-evolution.tsx'), /\{v!\.note\}/);
  assert.match(leer('src/components/workspace/overview-dashboard.tsx'), /\{notaDe\(t,cats\.data\)\}/);
  assert.doesNotMatch(leer('src/components/workspace/overview-dashboard.tsx'), /\{cats\.data\.note\}/);
});
