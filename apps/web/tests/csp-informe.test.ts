import test from 'node:test';
import assert from 'node:assert/strict';
import {extraerInformes} from '../src/lib/sitio/csp-informe';
import {POST} from '../src/app/api/csp-informe/route';

test('csp-informe: los dos formatos se reducen a directiva, origen bloqueado y ruta, sin consulta ni PII', () => {
  const a = extraerInformes({'csp-report': {'document-uri': 'https://rovaq.ai/producto/hoy?token=secreto&correo=a@b.c', 'blocked-uri': 'https://evil.example/x.js?id=7', 'effective-directive': 'script-src-elem', 'original-policy': 'default-src …', 'source-file': 'https://rovaq.ai/s/a.js', 'client-ip': '1.2.3.4'}});
  assert.deepEqual(a, [{directiva: 'script-src-elem', bloqueado: 'https://evil.example', documento: '/producto/hoy'}]);
  const b = extraerInformes([{type: 'csp-violation', body: {documentURL: 'https://rovaq.ai/?q=1', blockedURL: 'inline', effectiveDirective: 'style-src-attr'}}]);
  assert.deepEqual(b, [{directiva: 'style-src-attr', bloqueado: 'inline', documento: '/'}]);
  assert.deepEqual(extraerInformes('basura'), []);
  assert.equal(extraerInformes(Array.from({length: 50}, () => ({'csp-report': {}}))).length, 5, 'tope de informes por petición');
});

test('csp-informe: responde 204 siempre, no registra el cuerpo crudo y rechaza cuerpos enormes sin error', async () => {
  const lineas: string[] = [];
  const antes = console.info; console.info = (...x: unknown[]) => { lineas.push(x.join(' ')); };
  try {
    const ok = await POST(new Request('https://app.rovaq.ai/api/csp-informe', {method: 'POST', headers: {'content-type': 'application/csp-report'}, body: JSON.stringify({'csp-report': {'document-uri': 'https://rovaq.ai/?correo=a@b.c', 'blocked-uri': 'https://evil.example/p?x=1', 'effective-directive': 'img-src'}})}));
    assert.equal(ok.status, 204);
    const grande = await POST(new Request('https://app.rovaq.ai/api/csp-informe', {method: 'POST', headers: {'content-type': 'application/csp-report'}, body: 'x'.repeat(50_000)}));
    assert.equal(grande.status, 204);
    const otro = await POST(new Request('https://app.rovaq.ai/api/csp-informe', {method: 'POST', headers: {'content-type': 'text/plain'}, body: '{}'}));
    assert.equal(otro.status, 204);
  } finally { console.info = antes; }
  assert.equal(lineas.length, 1);
  assert.doesNotMatch(lineas[0], /a@b\.c|x=1/);
  assert.match(lineas[0], /img-src/);
});
