// T42: la capa de presentación (títulos automáticos, evolución mensual, línea de caché, fechas, hallazgos, errores) con el TRADUCTOR REAL en inglés:
// sin español, con las mismas cifras que en español, y sin traductor sigue en español (lo fijan las pruebas existentes).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {traductor} from '../src/lib/i18n';
import {tituloDescriptivo, rotuloAuto, avisoAuto} from '../src/lib/legibilidad/titulo-descriptivo.mjs';
import {insightsProblemaSerie} from '../src/lib/legibilidad/insights.mjs';

const en = traductor('en'), es = traductor('es');
const ACENTOS = /[áéíóúñ¿¡«»]/i;
const PAL = /\b(de|del|la|las|los|el|para|por|sin|con|una?|que|se|su|más|hay|datos|todavía|estado|aún|incidencias?|meses|mes|ventana|conv|descripción|automática)\b/gi;
const espanol = (t: string) => ACENTOS.test(t) || (t.match(PAL) ?? []).length >= 2;
const textos = (xs: Array<Record<string, unknown>>) => xs.flatMap((i) => [i.texto, i.razon, i.fuente, i.cobertura].filter((x): x is string => typeof x === 'string'));

test('título automático: en inglés usa el vocabulario de producto y conserva el formato; en español no cambia', () => {
  const args = {label: 'Order: Spare Parts', temas: [{category: 'Delivery: Late', count: 4}], conversaciones: 12};
  assert.equal(tituloDescriptivo(args)!.texto, 'Pedido · refacciones (delivery: late 4) · 12 conv.');
  assert.equal(tituloDescriptivo({...args, t: es})!.texto, 'Pedido · refacciones (delivery: late 4) · 12 conv.');
  const x = tituloDescriptivo({...args, t: en})!;
  assert.equal(x.texto, 'Order · spare parts (delivery: late 4) · 12 conversations');
  assert.equal(tituloDescriptivo({...args, conversaciones: 1, t: en})!.texto, 'Order · spare parts (delivery: late 4) · 1 conversation');
  assert.equal(rotuloAuto(en), 'Automatic description'); assert.equal(rotuloAuto(es), 'Descripción automática'); assert.equal(rotuloAuto(), 'Descripción automática');
  assert.ok(!espanol(avisoAuto(en)) && !espanol(x.texto), avisoAuto(en));
  // Un dato guardado que no está en la taxonomía no se traduce ni se inventa.
  assert.equal(tituloDescriptivo({label: 'Marketing: Algo nuevo', t: en})!.principal, 'Marketing · algo nuevo');
});

const serie = (cuentas: number[], extra = {}): never => ({status: 'ok', total: cuentas.reduce((a, b) => a + b, 0), outsideWindow: 3, undated: 2, linkedRuns: 2, window: {months: cuentas.length}, completeness: null,
  series: cuentas.map((count, i) => ({month: `2026-${String(i + 1).padStart(2, '0')}`, count, conversations: count})), ...extra}) as never;

test('evolución mensual: lecturas en inglés sin español, mismas cifras; sin traductor, español', () => {
  const ahora = new Date('2026-09-15T00:00:00Z'), v = serie([2, 10, 4, 6, 8, 3, 0, 0, 0]);
  const ing = insightsProblemaSerie(v, ahora, en) as Array<Record<string, unknown>>, esp = insightsProblemaSerie(v, ahora, es) as Array<Record<string, unknown>>, sin = insightsProblemaSerie(v, ahora) as Array<Record<string, unknown>>;
  for (const t of textos(ing)) assert.ok(!espanol(t), 'español bajo en: ' + t);
  assert.match(String(ing[0].texto), /In the last 9 months there are \*\*33\*\* incidents linked to this problem; the busiest month was \*\*Feb 2026\*\* with \*\*10\*\*/);
  assert.match(String(esp[0].texto), /En los últimos 9 meses hay \*\*33\*\* incidencias/);
  assert.deepEqual(sin.map((i) => i.texto), esp.map((i) => i.texto), 'es explícito = sin traductor');
  const cifras = (xs: Array<Record<string, unknown>>) => textos(xs).join(' ').match(/\*\*[\d,.]+\*\*/g)?.join('|');
  assert.equal(cifras(ing), cifras(esp));
  assert.match(String(ing.find((i) => i.id === 'corridas')!.texto), /groups \*\*2\*\* extraction runs/);
  assert.match(String(ing.find((i) => i.id === 'pico')!.cobertura), /9-month window\. 3 incidents fall outside the window\. 2 without a conversation date\./);
  for (const caso of [null, {status: 'timeout'}, {status: 'empty', total: 0}, serie([0, 0, 0, 0, 0, 0, 4, 6, 1]), serie([0, 0, 0, 0, 0, 0, 0, 6, 1]), serie([1, 2], {total: 16})]) {
    for (const t of textos(insightsProblemaSerie(caso as never, ahora, en) as Array<Record<string, unknown>>)) assert.ok(!espanol(t), 'español bajo en: ' + t);
  }
});
