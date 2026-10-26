/** Real production Next HTTP responses with synthetic, loopback-only Auth.
 * Run after a fresh build. This verifies rendered forms, not real Supabase sessions. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, session_id: 'synthetic-session' })}.synthetic-signature`;
  return `sb-127-auth-token=base64-${encode({ access_token, refresh_token: 'synthetic-refresh', expires_at: exp, expires_in: 3600, token_type: 'bearer', user })}`;
}
function privateHeaders(response) {
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  assert.match(response.headers.get('cache-control'), /no-store/);
}
async function startNext(extra = {}) {
  // Do not pass provider credentials, preload hooks or proxies into the child.
  const env = { NEXT_TELEMETRY_DISABLED: '1' };
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'WINDIR', 'LANG', 'LC_ALL', 'TZ']) if (process.env[key] !== undefined) env[key] = process.env[key];
  Object.assign(env, extra);
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '0'], { cwd: new URL('..', import.meta.url), env, stdio: ['ignore', 'pipe', 'pipe'] });
  const ended = new Promise(resolve => server.once('close', resolve));
  const close = async () => {
    if (server.exitCode !== null || server.signalCode !== null) { await ended; return; }
    server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 4000);
    try { await ended; } finally { clearTimeout(timer); }
  };
  try {
    const base = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Next startup timeout')), 20000);
      const read = chunk => { output += chunk.toString(); const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match && /Ready in/.test(output)) { clearTimeout(timer); resolve(match[0]); } };
      server.stdout.on('data', read); server.stderr.on('data', read);
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Next exited ${code} before startup`)); });
    });
    return { base, close };
  } catch (error) { await close(); throw error; }
}

test('unconfigured access pages are private and expose no authentication forms', { timeout: 30000 }, async () => {
  const server = await startNext();
  try {
    for (const path of ['/login', '/']) {
      const response = await fetch(server.base + path);
      assert.equal(response.status, 200); privateHeaders(response);
      const html = await response.text();
      assert.doesNotMatch(html, /action="\/auth\/(?:google|logout)"/);
    }
  } finally { await server.close(); }
});

test('served login follows verified identity, including revoked sessions', { timeout: 30000 }, async t => {
  let authStatus = 200;
  const requests = [];
  const auth = createServer((request, response) => {
    requests.push(request.url);
    if (request.url !== '/auth/v1/user' || !request.headers.authorization?.startsWith('Bearer ')) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(authStatus, { 'content-type': 'application/json' });
    response.end(JSON.stringify(authStatus === 200 ? user : { msg: 'Synthetic Auth rejection' }));
  });
  auth.listen(0, '127.0.0.1'); await once(auth, 'listening');
  let server;
  try {
    server = await startNext({ NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${auth.address().port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-key', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000', VEXA_GOOGLE_AUTH_ENABLED: 'true' });
    await t.test('anonymous visitor sees POST Google login, never logout', async () => {
      const response = await fetch(server.base + '/login');
      assert.equal(response.status, 200); privateHeaders(response);
      const html = await response.text();
      assert.match(html, /<form[^>]*action="\/auth\/google"[^>]*method="post"/);
      assert.doesNotMatch(html, /action="\/auth\/logout"/);
      assert.equal(requests.length, 0);
    });
    await t.test('verified visitor goes to the workspace', async () => {
      const response = await fetch(server.base + '/login', { headers: { cookie: sessionCookie() }, redirect: 'manual' });
      privateHeaders(response);
      // Next emits a meta redirect after a streaming boundary has sent headers.
      // Both paths must name the workspace; a plain 200 login page is not success.
      if (response.status === 307) {
        assert.equal(new URL(response.headers.get('location'), server.base).pathname, '/overview');
      } else {
        assert.equal(response.status, 200);
        assert.match(await response.text(), /<meta id="__next-page-redirect" http-equiv="refresh" content="[01];url=\/overview"\/>/);
      }
      assert.ok(requests.includes('/auth/v1/user'));
    });
    await t.test('verified visitor with an access error can sign out with POST', async () => {
      const response = await fetch(server.base + '/login?error=access_denied', { headers: { cookie: sessionCookie() }, redirect: 'manual' });
      assert.equal(response.status, 200); privateHeaders(response);
      assert.match(await response.text(), /<form[^>]*action="\/auth\/logout"[^>]*method="post"/);
    });
    await t.test('revoked cookie does not expose logout or redirect into the workspace', async () => {
      authStatus = 401; const before = requests.length;
      const response = await fetch(server.base + '/login', { headers: { cookie: sessionCookie() }, redirect: 'manual' });
      assert.equal(response.status, 200); privateHeaders(response);
      assert.doesNotMatch(await response.text(), /action="\/auth\/logout"/);
      assert.ok(requests.length > before);
    });
  } finally {
    if (server) await server.close();
    await new Promise((resolve, reject) => { auth.close(error => error ? reject(error) : resolve()); auth.closeAllConnections(); });
  }
});
