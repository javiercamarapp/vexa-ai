import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {mfaDecision, mfaRequired, parseMfaInput, enrollDecision, ENROLL_RECENT_MS, parseOrgSecurityInput} from '../src/lib/platform/mfa';
import {mfaVerdictFor} from '../src/lib/platform/mfa-server';
const saved = process.env.VEXA_PLATFORM_MFA;
afterEach(() => { if (saved === undefined) delete process.env.VEXA_PLATFORM_MFA; else process.env.VEXA_PLATFORM_MFA = saved; });
const client = (impl: () => Promise<unknown>, calls = {n: 0}) => ({auth: {mfa: {getAuthenticatorAssuranceLevel: async () => { calls.n++; return impl(); }}}}) as never;
test('la exigencia está ENCENDIDA por defecto y solo 0/off/false la apagan', () => {
  assert.equal(mfaRequired({}), true); assert.equal(mfaRequired({VEXA_PLATFORM_MFA: '1'}), true); assert.equal(mfaRequired({VEXA_PLATFORM_MFA: 'true'}), true); assert.equal(mfaRequired({VEXA_PLATFORM_MFA: ''}), true);
  for (const off of ['0', 'off', 'OFF', 'false', ' 0 ']) assert.equal(mfaRequired({VEXA_PLATFORM_MFA: off}), false, off);
});
test('decisión: apagado siempre ok (nadie se bloquea); encendido exige AAL2, distingue inscribir y retar, y falla cerrado', () => {
  for (const aal of [null, {currentLevel: 'aal1', nextLevel: 'aal1'}, {currentLevel: null, nextLevel: null}]) assert.equal(mfaDecision(false, aal), 'ok');
  assert.equal(mfaDecision(true, {currentLevel: 'aal2', nextLevel: 'aal2'}), 'ok');
  assert.equal(mfaDecision(true, {currentLevel: 'aal1', nextLevel: 'aal2'}), 'challenge');
  assert.equal(mfaDecision(true, {currentLevel: 'aal1', nextLevel: 'aal1'}), 'enroll');
  assert.equal(mfaDecision(true, null), 'unverifiable');
});
test('con la bandera de apagado (VEXA_PLATFORM_MFA=0) no hay NINGUNA llamada de red a Auth', async () => {
  process.env.VEXA_PLATFORM_MFA = '0'; const calls = {n: 0};
  assert.equal(await mfaVerdictFor(client(async () => ({data: null, error: new Error('x')}), calls)), 'ok'); assert.equal(calls.n, 0);
});
test('sin variable (producción por defecto) y Auth caído: falla cerrado, no se entra', async () => {
  delete process.env.VEXA_PLATFORM_MFA;
  assert.equal(await mfaVerdictFor(client(async () => ({data: null, error: new Error('down')}))), 'unverifiable');
  assert.equal(await mfaVerdictFor(client(async () => ({data: {currentLevel: 'aal1', nextLevel: 'aal1'}, error: null}))), 'enroll');
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

test('R2-01: agregar un segundo factor exige AAL2; el primero exige haber iniciado sesión hace poco', () => {
  const now = Date.parse('2026-10-29T12:00:00Z'), hace = (ms: number) => new Date(now - ms).toISOString();
  assert.equal(enrollDecision({hasVerifiedFactor: true, level: 'aal1', lastSignInAt: hace(1000), now}), 'aal2_required');
  assert.equal(enrollDecision({hasVerifiedFactor: true, level: 'aal2', lastSignInAt: hace(99 * ENROLL_RECENT_MS), now}), 'ok');
  assert.equal(enrollDecision({hasVerifiedFactor: false, level: 'aal1', lastSignInAt: hace(60_000), now}), 'ok');
  assert.equal(enrollDecision({hasVerifiedFactor: false, level: 'aal1', lastSignInAt: hace(ENROLL_RECENT_MS + 1), now}), 'reauth_required');
  for (const raro of [null, undefined, 'no-es-fecha', new Date(now + 3_600_000).toISOString()]) assert.equal(enrollDecision({hasVerifiedFactor: false, level: 'aal1', lastSignInAt: raro, now}), 'reauth_required', String(raro));
});
test('opción de MFA de propietarios: entrada estricta (org_get / org_set con tenantId UUID y enabled booleano)', () => {
  const T = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.deepEqual(parseOrgSecurityInput({operation: 'org_get', tenantId: T}), {operation: 'org_get', tenantId: T});
  assert.deepEqual(parseOrgSecurityInput({operation: 'org_set', tenantId: T, enabled: true}), {operation: 'org_set', tenantId: T, enabled: true});
  for (const malo of [{operation: 'org_set', tenantId: T}, {operation: 'org_set', tenantId: T, enabled: 'true'}, {operation: 'org_get', tenantId: 'x'}, {operation: 'org_get', tenantId: T, extra: 1}, {operation: 'otro', tenantId: T}, {}]) assert.equal(parseOrgSecurityInput(malo as never), null);
});
