import test from 'node:test';
import assert from 'node:assert/strict';
import {conRedireccionDeAcceso} from '../src/lib/workspace/acceso-pagina';
import {AccessError} from '../src/lib/auth';

const destino = async (leer: () => Promise<unknown>) => {
  try { await leer(); } catch (e) { return String((e as {digest?: string}).digest ?? ''); }
  return null;
};

test('sin sesión (401) redirige a /login en vez de lanzar el error al registro del servidor', async () => {
  const d = await destino(() => conRedireccionDeAcceso(async () => { throw new AccessError(401, 'authentication_required'); }));
  assert.ok(d?.startsWith('NEXT_REDIRECT') && d.includes('/login'), String(d));
});

test('sin permiso (403) redirige a /sin-acceso', async () => {
  const d = await destino(() => conRedireccionDeAcceso(async () => { throw new AccessError(403, 'forbidden'); }));
  assert.ok(d?.startsWith('NEXT_REDIRECT') && d.includes('/sin-acceso'), String(d));
});

test('un error de acceso distinto (503) se propaga: no se disfraza de redirección', async () => {
  await assert.rejects(conRedireccionDeAcceso(async () => { throw new AccessError(503, 'workspace_resource_unavailable'); }), (e: unknown) => e instanceof AccessError && e.status === 503);
});

test('un error que no es de acceso se propaga tal cual', async () => {
  await assert.rejects(conRedireccionDeAcceso(async () => { throw new TypeError('boom'); }), TypeError);
});

test('con sesión devuelve el resultado intacto', async () => {
  assert.deepEqual(await conRedireccionDeAcceso(async () => ({session: {ok: true}})), {session: {ok: true}});
});
