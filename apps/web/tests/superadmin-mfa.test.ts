import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {mfaDecision, mfaRequired, parseMfaInput} from '../src/lib/platform/mfa';
import {mfaVerdictFor} from '../src/lib/platform/mfa-server';
const saved = process.env.VEXA_PLATFORM_MFA;
afterEach(() => { if (saved === undefined) delete process.env.VEXA_PLATFORM_MFA; else process.env.VEXA_PLATFORM_MFA = saved; });
const client = (impl: () => Promise<unknown>, calls = {n: 0}) => ({auth: {mfa: {getAuthenticatorAssuranceLevel: async () => { calls.n++; return impl(); }}}}) as never;
test('la exigencia está APAGADA por defecto y solo "1" la enciende', () => {
  assert.equal(mfaRequired({}), false); assert.equal(mfaRequired({VEXA_PLATFORM_MFA: '0'}), false); assert.equal(mfaRequired({VEXA_PLATFORM_MFA: 'true'}), false); assert.equal(mfaRequired({VEXA_PLATFORM_MFA: '1'}), true);
});
test('decisión: apagado siempre ok (nadie se bloquea); encendido exige AAL2, distingue inscribir y retar, y falla cerrado', () => {
  for (const aal of [null, {currentLevel: 'aal1', nextLevel: 'aal1'}, {currentLevel: null, nextLevel: null}]) assert.equal(mfaDecision(false, aal), 'ok');
  assert.equal(mfaDecision(true, {currentLevel: 'aal2', nextLevel: 'aal2'}), 'ok');
  assert.equal(mfaDecision(true, {currentLevel: 'aal1', nextLevel: 'aal2'}), 'challenge');
  assert.equal(mfaDecision(true, {currentLevel: 'aal1', nextLevel: 'aal1'}), 'enroll');
  assert.equal(mfaDecision(true, null), 'unverifiable');
});
test('con la exigencia apagada no hay NINGUNA llamada de red a Auth', async () => {
  delete process.env.VEXA_PLATFORM_MFA; const calls = {n: 0};
  assert.equal(await mfaVerdictFor(client(async () => ({data: null, error: new Error('x')}), calls)), 'ok'); assert.equal(calls.n, 0);
});
test('encendida: AAL2 pasa, AAL1 con factor pide retar, error o excepción de Auth falla cerrado', async () => {
  process.env.VEXA_PLATFORM_MFA = '1';
  assert.equal(await mfaVerdictFor(client(async () => ({data: {currentLevel: 'aal2', nextLevel: 'aal2'}, error: null}))), 'ok');
  assert.equal(await mfaVerdictFor(client(async () => ({data: {currentLevel: 'aal1', nextLevel: 'aal2'}, error: null}))), 'challenge');
  assert.equal(await mfaVerdictFor(client(async () => ({data: null, error: new Error('down')}))), 'unverifiable');
  assert.equal(await mfaVerdictFor(client(async () => { throw new Error('red'); })), 'unverifiable');
});
test('entradas de MFA: solo enroll / verify con UUID y 6 dígitos / cancel con UUID; sin campos extra', () => {
  const F = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(parseMfaInput({operation: 'enroll'}), {operation: 'enroll'}); assert.equal(parseMfaInput({operation: 'enroll', x: 1}), null);
  assert.deepEqual(parseMfaInput({operation: 'verify', factorId: F, code: '123 456'}), {operation: 'verify', factorId: F, code: '123456'});
  for (const bad of [{operation: 'verify', factorId: F, code: '12345'}, {operation: 'verify', factorId: F, code: 'abcdef'}, {operation: 'verify', factorId: 'x', code: '123456'}, {operation: 'verify', factorId: F}, {operation: 'verify', factorId: F, code: '123456', extra: 1}, {operation: 'otra'}])
    assert.equal(parseMfaInput(bad as never), null, JSON.stringify(bad));
  assert.deepEqual(parseMfaInput({operation: 'cancel', factorId: F}), {operation: 'cancel', factorId: F});
});
