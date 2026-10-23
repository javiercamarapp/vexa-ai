// Enmascarado de presentación de nombres/direcciones (R2-2-004). Solo ejemplos sintéticos.
//   node --test packages/workspace-service/tests/enmascarar-terceros.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {enmascararTerceros as m, enmascararConConteo, AVISO_ENMASCARADO} from '../enmascarar-terceros.mjs';

test('encabezado de correo citado: oculta el nombre y conserva fecha, marcador y «wrote:»', () => {
  assert.equal(m('On Wed, Jul 15, 2026 at 11:53 AM Maria Lopezano <[PII]> wrote:'), 'On Wed, Jul 15, 2026 at 11:53 AM [nombre] <[dato personal oculto]> wrote:');
  assert.equal(m('> On Mon, Jan 5, 2026 at 9:00 PM, Jon Smythe wrote:\n> hola'), '> On Mon, Jan 5, 2026 at 9:00 PM, [nombre] wrote:\n> hola');
  assert.equal(m('El 15 jul 2026, 11:53, Ana Pérez García <[PII]> escribió:'), 'El 15 jul 2026, 11:53, [nombre] <[dato personal oculto]> escribió:');
  assert.equal(m('On Jul 15, 2026 "Pat Quill" <[PII]> wrote:'), 'On Jul 15, 2026 "[nombre]" <[dato personal oculto]> wrote:');
});
test('From/To/Cc/De/Para: nombre antes de <correo> o [PII]', () => {
  assert.equal(m('From: Rosa Almeda <[PII]>\nTo: Luis Vega <[PII]>, Eva Rios <[PII]>\nSubject: Pedido'), 'From: [nombre] <[dato personal oculto]>\nTo: [nombre] <[dato personal oculto]>, [nombre] <[dato personal oculto]>\nSubject: Pedido');
  assert.equal(m('De: Ana Ruiz [PII]'), 'De: [nombre] [dato personal oculto]');
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

// ---- A8 (23-oct): citas con nombres de clientes, ciudad y correos crudos con «[PII]» ----
test('saludo a mitad de línea o de frase y tras comillas de cita', () => {
  assert.equal(m('Thank you for writing. Hello Bob, your order shipped'), 'Thank you for writing. Hello [nombre], your order shipped');
  assert.equal(m('"Hello George, we received it"'), '"Hello [nombre], we received it"');
  assert.equal(m('> Hello Bob,\n> thanks'), '> Hello [nombre],\n> thanks');
  assert.equal(m('Good morning Frank,'), 'Good morning [nombre],');
  assert.equal(m('Hi Bob.'), 'Hi [nombre].');
});
test('saludos y cierres en francés, portugués, alemán, italiano y español', () => {
  assert.equal(m('Bonjour Marie,'), 'Bonjour [nombre],');
  assert.equal(m('Olá João,'), 'Olá [nombre],');
  assert.equal(m('Prezado Carlos,'), 'Prezado [nombre],');
  assert.equal(m('Hallo Hans,'), 'Hallo [nombre],');
  assert.equal(m('Caro Luca,'), 'Caro [nombre],');
  assert.equal(m('Cordialement,\nPierre Dupont'), 'Cordialement,\n[nombre]');
  assert.equal(m('Obrigado, João Silva'), 'Obrigado, [nombre]');
  assert.equal(m('Mit freundlichen Grüßen,\nHans Meyer'), 'Mit freundlichen Grüßen,\n[nombre]');
  assert.equal(m('Grazie, Luca Rossi'), 'Grazie, [nombre]');
});
test('nombre tras Thanks/Regards/Sincerely, con o sin coma, y firma en la línea siguiente sin coma', () => {
  assert.equal(m('Thanks Bob'), 'Thanks [nombre]');
  assert.equal(m('Thank you,\nBob Resciniti'), 'Thank you,\n[nombre]');
  assert.equal(m('Best regards Maria Lopez'), 'Best regards [nombre]');
  assert.equal(m('Sincerely\nGeorge Hart'), 'Sincerely\n[nombre]');
  assert.equal(m('It broke again. Thanks, Bob'), 'It broke again. Thanks, [nombre]');
});
test('cabeceras de correo citado en otros idiomas y líneas Reply-To/Von', () => {
  assert.equal(m('Le 15 juil. 2026 à 11:53, Marie Dupont <[PII]> a écrit :'), 'Le 15 juil. 2026 à 11:53, [nombre] <[dato personal oculto]> a écrit :');
  assert.equal(m('Am 15.07.2026 um 11:53 schrieb Hans Meyer <[PII]>:'), 'Am 15.07.2026 um 11:53 schrieb [nombre] <[dato personal oculto]>:');
  assert.equal(m('Em qua., 15 de jul. de 2026 11:53, João Silva <[PII]> escreveu:'), 'Em qua., 15 de jul. de 2026 11:53, [nombre] <[dato personal oculto]> escreveu:');
  assert.equal(m('Reply-To: Rosa Almeda <[PII]>'), 'Reply-To: [nombre] <[dato personal oculto]>');
  assert.equal(m('Von: Hans Meyer <[PII]>'), 'Von: [nombre] <[dato personal oculto]>');
});
test('ciudad, estado y CP sin calle', () => {
  assert.equal(m('Ship to Lakewood, NJ 08701 please'), 'Ship to [dirección] please');
  assert.equal(m('Located in Fort Worth, TX 76102-1234.'), 'Located in [dirección].');
});
test('los marcadores [PII] y [REDACTED] se muestran como «dato personal oculto» (idempotente)', () => {
  assert.equal(m('Contact me at [PII] or [REDACTED]'), 'Contact me at [dato personal oculto] or [dato personal oculto]');
  const t = 'On Wed, Jul 15, 2026 at 11:53 AM Maria Lopezano <[PII]> wrote:\nHello Bob,\n[PII]';
  assert.equal(m(m(t)), m(t));
  assert.ok(!m(t).includes('[PII]'));
});
test('FALSOS POSITIVOS (lote ampliado): texto ordinario y marcas comerciales no se tocan', () => {
  for (const t of ['Thanks Amazon', 'Thanks again', 'Thank you so much', 'Thanks Support', 'Hello. Order 4521 arrived late. Hi there,', 'Good morning team,', 'Bonjour à tous,',
    'Sent 42 packages to Austin, TX', 'Austin, TX', 'We ship from Dallas, TX on Mondays', 'Call 555-0100, ext 4', 'Best Buy sent it late', 'Dear Customer,', 'Hello Walmart,',
    'The tool broke. Regards the warranty claim', 'Cheers!', 'Gracias por su ayuda', 'Hallo zusammen', 'Ciao a tutti', 'On the 5th, we wrote back', 'Am Montag kam das Paket'])
    assert.equal(m(t), t, t);
});
