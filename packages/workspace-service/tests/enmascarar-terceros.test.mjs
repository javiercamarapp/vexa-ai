// Enmascarado de presentación de nombres/direcciones (R2-2-004). Solo ejemplos sintéticos.
//   node --test packages/workspace-service/tests/enmascarar-terceros.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {enmascararTerceros as m, enmascararConConteo, AVISO_ENMASCARADO} from '../enmascarar-terceros.mjs';

test('encabezado de correo citado: oculta el nombre y conserva fecha, marcador y «wrote:»', () => {
  assert.equal(m('On Wed, Jul 15, 2026 at 11:53 AM Maria Lopezano <[PII]> wrote:'), 'On Wed, Jul 15, 2026 at 11:53 AM [nombre] <[PII]> wrote:');
  assert.equal(m('> On Mon, Jan 5, 2026 at 9:00 PM, Jon Smythe wrote:\n> hola'), '> On Mon, Jan 5, 2026 at 9:00 PM, [nombre] wrote:\n> hola');
  assert.equal(m('El 15 jul 2026, 11:53, Ana Pérez García <[PII]> escribió:'), 'El 15 jul 2026, 11:53, [nombre] <[PII]> escribió:');
  assert.equal(m('On Jul 15, 2026 "Pat Quill" <[PII]> wrote:'), 'On Jul 15, 2026 "[nombre]" <[PII]> wrote:');
});
test('From/To/Cc/De/Para: nombre antes de <correo> o [PII]', () => {
  assert.equal(m('From: Rosa Almeda <[PII]>\nTo: Luis Vega <[PII]>, Eva Rios <[PII]>\nSubject: Pedido'), 'From: [nombre] <[PII]>\nTo: [nombre] <[PII]>, [nombre] <[PII]>\nSubject: Pedido');
  assert.equal(m('De: Ana Ruiz [PII]'), 'De: [nombre] [PII]');
  assert.equal(m('Cc: Mario Soto'), 'Cc: [nombre]');
});
test('saludos al inicio de línea', () => {
  assert.equal(m('Hello Frank,\nmy order is late'), 'Hello [nombre],\nmy order is late');
  assert.equal(m('Hi Andrew, thanks'), 'Hi [nombre], thanks');
  assert.equal(m('Dear Mr. Rivers,'), 'Dear Mr. [nombre],');
  assert.equal(m('Hola Marta, necesito ayuda'), 'Hola [nombre], necesito ayuda');
  assert.equal(m('Estimada Sofía Núñez:'), 'Estimada [nombre]:');
  assert.equal(m('Hello Frank'), 'Hello [nombre]');
});
test('cierres simples', () => {
  assert.equal(m('Thanks, Eli Brook'), 'Thanks, [nombre]');
  assert.equal(m('Saludos,\nJavier Ortega\n'), 'Saludos,\n[nombre]\n');
  assert.equal(m('Regards,\nPat'), 'Regards,\n[nombre]', 'nombre de pila solo tras cierre con coma');
});
test('direcciones postales de EE. UU. y México', () => {
  assert.equal(m('Ship to 123 Maple Ave, Lakewood, NJ 08701 please'), 'Ship to [dirección] please');
  assert.equal(m('1450 North Oak Street Apt 4B, Springfield IL 62704'), '[dirección]');
  assert.equal(m('Envíen a Calle Reforma 123, Col. Centro, Mérida, Yuc. C.P. 97000 por favor'), 'Envíen a [dirección] por favor');
});
test('FALSOS POSITIVOS: no enmascara saludos sin nombre ni texto ordinario', () => {
  for (const t of ['Hola, necesito ayuda', 'Hello world', 'Hello World', 'Hi team,', 'Hola equipo,', 'Dear Customer,', 'Estimados todos,', 'Thanks, again', 'Gracias, saludos',
    'On Monday I wrote to you', 'We shipped on Tuesday and it wrote an error', 'Mi pedido 12345 llegó roto', 'Thanks, Support', 'Saludos,\nSoporte', 'Hello Frank is late'.replace('Frank','frank'), 'Calle principal sin número', 'Sent 42 packages to Austin, TX'])
    assert.equal(m(t), t, t);
});
test('FALSOS NEGATIVOS documentados: lo que NO se oculta (no hay NER)', () => {
  assert.equal(m('Mi jefe Carlos Ruiz dijo que sí'), 'Mi jefe Carlos Ruiz dijo que sí');
  assert.equal(m('Soy eli blumenthal'), 'Soy eli blumenthal');
  assert.equal(m('Vivo en Lakewood NJ'), 'Vivo en Lakewood NJ', 'ciudad/estado sin calle ni CP');
  assert.equal(m('Mi casa es la 123 de Main Street'), 'Mi casa es la 123 de Main Street', 'sin ciudad/estado/CP');
  assert.equal(m('Hello, this is Frank from the store'), 'Hello, this is Frank from the store', 'nombre a mitad de frase');
  assert.equal(m('Hey frank,'), 'Hey frank,', 'nombre en minúsculas');
});
test('idempotente, cuenta cambios y tolera entradas no cadena', () => {
  const t = 'Hello Frank,\nOn Wed, Jul 15, 2026 at 11:53 AM Maria Lopezano <[PII]> wrote:\nThanks, Eli Brook';
  const una = m(t);
  assert.equal(m(una), una);
  assert.equal(enmascararConConteo(t).cambios, 3);
  assert.equal(m(''), ''); assert.equal(m(null), ''); assert.equal(m(undefined), '');
  assert.match(AVISO_ENMASCARADO, /patrones frecuentes de nombres y direcciones/);
});
test('rendimiento: texto largo sin coincidencias no se cuelga', () => {
  const largo = ('palabra otra Mayuscula Otra '.repeat(4000) + '\n').repeat(5);
  const t0 = Date.now(); m(largo); assert.ok(Date.now() - t0 < 2000);
  const patologico = 'On ' + 'Aa '.repeat(3000) + 'x';
  const t1 = Date.now(); m(patologico); assert.ok(Date.now() - t1 < 2000);
});
