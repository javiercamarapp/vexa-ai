import {test} from 'node:test';
import assert from 'node:assert/strict';
import {errorDeCarga, reintentable, hayErroresParaDescargar} from '../src/lib/jobs/progreso.mjs';
test('carga inexistente: mensaje humano, sin código HTTP ni JOB_NOT_FOUND, y no se reintenta', () => {
  for (const [st, code] of [[404, 'JOB_NOT_FOUND'], [404, undefined], [200, 'JOB_NOT_FOUND']]) {
    const e = errorDeCarga(st, code);
    assert.equal(e.tipo, 'inexistente'); assert.equal(e.mensaje, 'Esta carga no existe o ya no está disponible.');
    assert.ok(!/404|JOB_NOT_FOUND/.test(e.mensaje)); assert.equal(reintentable(e.tipo), false);
  }
});
test('sin acceso no se reintenta; servicio sin configurar y fallos de red sí, con texto en español', () => {
  assert.equal(errorDeCarga(403).tipo, 'sin-acceso'); assert.equal(reintentable('sin-acceso'), false);
  assert.equal(errorDeCarga(503).tipo, 'no-configurado'); assert.equal(reintentable('no-configurado'), true);
  const r = errorDeCarga(500, 'X'); assert.equal(r.tipo, 'reintentar'); assert.ok(!/500|\bX\b/.test(r.mensaje)); assert.equal(reintentable('reintentar'), true);
  assert.equal(errorDeCarga(undefined).tipo, 'reintentar');
});
test('un 503 pasajero no se presenta como «configura la base de datos»; y el CSV de errores solo aparece con filas rechazadas', () => {
  const e = errorDeCarga(503);
  assert.ok(/no respondió/.test(e.mensaje) && /reintentará solo/.test(e.mensaje) && !/Configura la conexión a la base de datos/.test(e.mensaje));
  assert.equal(hayErroresParaDescargar(0), false); assert.equal(hayErroresParaDescargar(undefined), false);
  assert.equal(hayErroresParaDescargar(3), true); assert.equal(hayErroresParaDescargar('12'), true);
});
