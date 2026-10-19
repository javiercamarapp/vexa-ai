"""Pruebas de la subida en trozos (TUS) y de las guardas de la carga real, contra un servidor falso en 127.0.0.1 (sin red).
El servidor falso imita las reglas de Supabase Storage que importan: Tus-Resumable, metadatos en base64, trozos de tamano fijo
(salvo el ultimo), Upload-Offset estricto (409 si no coincide), 413 por limite de tamano, 409 si el objeto ya existe."""
import base64, hashlib, http.server, json, os, socket, tempfile, threading, unittest, importlib.util, io, contextlib

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('lote', os.path.join(HERE, 'adjuntos_lote.py'))
lote = importlib.util.module_from_spec(spec); spec.loader.exec_module(lote)

CHUNK = 1024 * 1024        # trozo del servidor falso (en produccion son 6 MiB)
LIMIT = 8 * 1024 * 1024    # limite del almacen falso


class FakeTus(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    store, uploads, faults, violations, patched = {}, {}, [], [], {'bytes': 0, 'n': 0}
    limit, bucket_limit = LIMIT, None
    seq = [0]

    def log_message(self, *a): pass

    def _send(self, code, headers=None, body=b''):
        self.send_response(code)
        for k, v in (headers or {}).items(): self.send_header(k, v)
        self.send_header('Content-Length', str(len(body))); self.end_headers()
        if body: self.wfile.write(body)

    def _check_auth(self):
        if not self.headers.get('Authorization', '').startswith('Bearer '):
            self.violations.append('sin Authorization')

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(n); self._check_auth()
        if self.path.endswith('/upload/resumable'):
            if self.headers.get('Tus-Resumable') != '1.0.0': self.violations.append('sin Tus-Resumable')
            meta = dict(kv.split(' ', 1) for kv in self.headers.get('Upload-Metadata', '').split(','))
            meta = {k: base64.b64decode(v).decode() for k, v in meta.items()}
            if meta.get('bucketName') != 'vexa-private' or not meta.get('objectName'): self.violations.append('metadatos')
            size = int(self.headers['Upload-Length'])
            if size > (self.bucket_limit or self.limit): return self._send(413)
            if meta['objectName'] in self.store: return self._send(409)
            self.seq[0] += 1; uid = 'u%d' % self.seq[0]
            self.uploads[uid] = {'len': size, 'obj': meta['objectName'], 'data': bytearray()}
            return self._send(201, {'Location': '/storage/v1/upload/resumable/' + uid, 'Tus-Resumable': '1.0.0'})
        k = self.path.split('/vexa-private/', 1)[1]
        if k in self.store: return self._send(409)
        self.store[k] = body; self._send(200)

    def _upload(self):
        return self.uploads.get(self.path.rsplit('/', 1)[1])

    def do_HEAD(self):
        u = self._upload()
        if not u: return self._send(404)
        self._send(200, {'Upload-Offset': str(len(u['data'])), 'Upload-Length': str(u['len']), 'Tus-Resumable': '1.0.0'})

    def do_PATCH(self):
        n = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(n); self._check_auth()
        u = self._upload()
        if not u: return self._send(404)
        if self.headers.get('Content-Type') != 'application/offset+octet-stream': self.violations.append('content-type')
        if int(self.headers['Upload-Offset']) != len(u['data']): return self._send(409)
        last = len(u['data']) + n == u['len']
        if n > CHUNK or (n < CHUNK and not last): self.violations.append('trozo %d' % n)
        if self.faults:
            f = self.faults.pop(0)
            if f == 'drop':
                self.close_connection = True; self.connection.shutdown(socket.SHUT_RDWR); return
            if f == '503': return self._send(503)
            if f == 'partial':
                u['data'] += body[:n // 2]; return self._send(503)
        self.patched['bytes'] += n; self.patched['n'] += 1
        u['data'] += body
        if len(u['data']) == u['len']: self.store[u['obj']] = bytes(u['data'])
        self._send(204, {'Upload-Offset': str(len(u['data'])), 'Tus-Resumable': '1.0.0'})

    def do_GET(self):
        if self.path.endswith('/bucket/vexa-private'):
            return self._send(200, body=json.dumps({'id': 'vexa-private', 'file_size_limit': self.bucket_limit}).encode())
        k = self.path.split('/vexa-private/', 1)[1]
        if k not in self.store: return self._send(404)
        b = json.dumps({'size': len(self.store[k])}).encode() if '/object/info/' in self.path else self.store[k]
        self._send(200, body=b)


def sha(b): return hashlib.sha256(b).hexdigest()


class TusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), FakeTus)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.url = 'http://127.0.0.1:%d' % cls.srv.server_port
        lote.evict = lambda p: None

    @classmethod
    def tearDownClass(cls): cls.srv.shutdown()

    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.d = self.t.name
        FakeTus.store, FakeTus.uploads, FakeTus.faults, FakeTus.violations = {}, {}, [], []
        FakeTus.patched.update(bytes=0, n=0); FakeTus.limit, FakeTus.bucket_limit = LIMIT, None
        self.data = os.urandom(5 * CHUNK + 12345)           # 5 trozos + cola
        self.path = os.path.join(self.d, 'big.zip'); open(self.path, 'wb').write(self.data)
        self.item = {'sha256': sha(self.data), 'bytes': len(self.data), 'ext': '.zip',
                     'object_key': 'attachments/%s/%s' % (sha(self.data)[:2], sha(self.data)),
                     'canonical': {'family': 'note', 'fileId': '1', 'localPath': self.path}, 'sources': [{'family': 'note', 'fileId': '1'}]}
        self.st = lote.Storage(self.url, 'k', 'vexa-private')
        self.rd = os.path.join(self.d, 'rec'); os.makedirs(self.rd)

    def args(self, **kw):
        a = lote.argparse.Namespace(execute=True, allow_hydrate=False, min_free_gib=0, simulate_free_bytes=None, no_verify_download=False,
                                    object_limit=2 * CHUNK, tus_chunk=CHUNK, tus_backoff=0.0, big_mode='tus')
        for k, v in kw.items(): setattr(a, k, v)
        return a

    def run_big(self, **kw):
        batch = {'batch': 'big', 'objects': 1, 'items': [self.item]}
        return lote.process_batch(batch, self.args(**kw), self.rd, self.st, 'T1')

    def receipts(self):
        return [json.loads(l) for l in open(os.path.join(self.rd, 'lote-big.jsonl'))]

    def key(self): return 'T1/' + self.item['object_key']

    def test_tus_uploads_in_chunks_and_verifies(self):
        r = self.run_big()
        self.assertEqual((r['ok'], r['error'], r['metadata_only']), (1, 0, 0))
        self.assertEqual(FakeTus.store[self.key()], self.data)
        self.assertEqual(FakeTus.patched['n'], 6); self.assertEqual(FakeTus.violations, [])
        rec = self.receipts()[-1]
        self.assertEqual((rec['status'], rec['via'], rec['verified']), ('uploaded', 'tus', True))
        self.assertNotIn('tus_location', rec)

    def test_small_objects_do_not_use_tus(self):
        r = self.run_big(object_limit=len(self.data))      # justo en el limite: POST simple
        self.assertEqual(r['ok'], 1); self.assertEqual(FakeTus.patched['n'], 0)

    def test_recovers_from_503_dropped_connection_and_partial_commit(self):
        FakeTus.faults[:] = ['503', 'drop', 'partial']
        r = self.run_big()
        self.assertEqual((r['ok'], r['error']), (1, 0))
        self.assertEqual(FakeTus.store[self.key()], self.data)
        self.assertEqual(FakeTus.violations, [])

    def test_resume_across_runs_does_not_resend_chunks(self):
        orig = lote.Storage.tus_patch; calls = {'n': 0}

        def dying(self_, loc, off, data):
            calls['n'] += 1
            if calls['n'] == 3: raise lote.Abort('corte simulado')
            return orig(self_, loc, off, data)
        lote.Storage.tus_patch = dying
        try:
            with self.assertRaises(lote.Abort): self.run_big()
        finally:
            lote.Storage.tus_patch = orig
        self.assertEqual(self.receipts()[-1]['status'], 'tus_partial')
        self.assertEqual(FakeTus.patched['bytes'], 2 * CHUNK)
        r = self.run_big()
        self.assertEqual(r['ok'], 1); self.assertEqual(FakeTus.store[self.key()], self.data)
        self.assertEqual(FakeTus.patched['bytes'], len(self.data))     # total = tamano: lo ya subido no se reenvio
        self.assertEqual(len(FakeTus.uploads), 1)                       # reutilizo la misma subida

    def test_resume_after_error_receipt_keeps_location(self):
        FakeTus.faults[:] = ['503'] * 20
        r = self.run_big()
        self.assertEqual(r['error'], 1)
        self.assertEqual(self.receipts()[-1]['status'], 'error'); self.assertIn('tus_location', self.receipts()[-1])
        FakeTus.faults[:] = []
        r = self.run_big(); self.assertEqual(r['ok'], 1); self.assertEqual(len(FakeTus.uploads), 1)

    def test_413_becomes_metadata_only_and_never_touches_limits(self):
        FakeTus.limit = CHUNK                                           # almacen que no admite el tamano
        r = self.run_big()
        self.assertEqual((r['metadata_only'], r['ok'], r['error']), (1, 0, 0))
        rec = self.receipts()[-1]; self.assertEqual((rec['status'], rec['reason']), ('metadata_only', 'storage_limit_413'))
        self.assertEqual(FakeTus.store, {}); self.assertEqual(FakeTus.limit, CHUNK)

    def test_bucket_limit_below_size_is_metadata_only_without_trying(self):
        FakeTus.bucket_limit = CHUNK
        r = self.run_big()
        self.assertEqual(r['metadata_only'], 1); self.assertEqual(len(FakeTus.uploads), 0)
        self.assertEqual(self.receipts()[-1]['reason'], 'bucket_limit')

    def test_forced_metadata_only(self):
        r = self.run_big(big_mode='metadata_only'); self.assertEqual(r['metadata_only'], 1); self.assertEqual(len(FakeTus.uploads), 0)

    def test_existing_object_is_not_uploaded_again(self):
        FakeTus.store[self.key()] = self.data
        r = self.run_big(); self.assertEqual(r['ok'], 1); self.assertEqual(len(FakeTus.uploads), 0)
        self.assertEqual(self.receipts()[-1]['status'], 'exists')

    def test_corrupt_destination_is_detected(self):
        orig = lote.Storage.download_hash
        lote.Storage.download_hash = lambda s, o: ('0' * 64, len(self.data))
        try:
            r = self.run_big()
        finally:
            lote.Storage.download_hash = orig
        self.assertEqual(r['error'], 1); self.assertEqual(self.receipts()[-1]['status'], 'dest_mismatch')

    def test_location_to_foreign_host_is_refused(self):
        with self.assertRaises(RuntimeError): self.st._tus_target('https://evil.example.com/x')
        self.assertEqual(self.st._tus_target('/storage/v1/upload/resumable/u1')[3], '/storage/v1/upload/resumable/u1')
        self.assertEqual(self.st._tus_target('https://abc.storage.supabase.co/x')[1], 'abc.storage.supabase.co')

    def test_cli_big_batch_exit_codes_and_guards(self):
        plan = {'batches': [], 'oversize': [self.item]}; pp = os.path.join(self.d, 'plan.json'); json.dump(plan, open(pp, 'w'))
        creds = os.path.join(self.d, 'c.env'); open(creds, 'w').write('SUPABASE_URL=%s\nSUPABASE_SERVICE_KEY=k\n' % self.url); os.chmod(creds, 0o600)
        ref = os.path.join(self.d, 'ref'); open(ref, 'w').write(lote.PROJECT_REF)
        sqlok = os.path.join(self.d, 'sqlok.sh'); open(sqlok, 'w').write("#!/bin/bash\necho 'ATGUARD tables=true tenant=true bypass=true END'\n"); os.chmod(sqlok, 0o755)
        T = '11111111-2222-3333-4444-555555555555'
        base = ['--plan', pp, '--receipts', self.rd, '--batch', 'big', '--execute', '--creds', creds, '--tenant', T, '--min-free-gib', '0',
                '--project-ref-file', ref, '--sql-cmd', sqlok, '--allow-url-host', '127.0.0.1', '--object-limit', str(2 * CHUNK), '--tus-backoff', '0']
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            FakeTus.limit = CHUNK                                       # Storage no admite el tamano -> metadata_only + aviso (rc 4)
            self.assertEqual(lote.main(base), 4)
            open(ref, 'w').write('otroproyecto0000000000'); self.assertEqual(lote.main(base), 3); open(ref, 'w').write(lote.PROJECT_REF)
            os.chmod(creds, 0o644); self.assertEqual(lote.main(base), 3); os.chmod(creds, 0o600)
            nohost = [x for x in base if x not in ('--allow-url-host', '127.0.0.1')]
            self.assertEqual(lote.main(nohost), 3)                       # la URL no es la del proyecto Vexa
            open(sqlok, 'w').write("#!/bin/bash\necho 'ATGUARD tables=false tenant=true bypass=true END'\n")
            self.assertEqual(lote.main(base), 3)                         # 0053 no aplicada
            open(sqlok, 'w').write("#!/bin/bash\necho 'ATGUARD tables=true tenant=true bypass=false END'\n")
            self.assertEqual(lote.main(base), 3)                         # rol sin bypassrls
            os.remove(creds); self.assertEqual(lote.main(base), 3)       # credenciales ausentes
        self.assertEqual(FakeTus.store, {})

    def test_preflight_reads_nothing(self):
        plan = {'batches': [], 'oversize': [self.item]}; pp = os.path.join(self.d, 'plan.json'); json.dump(plan, open(pp, 'w'))
        orig = lote.sha256_stream; lote.sha256_stream = lambda *a: self.fail('preflight no debe leer contenido')
        try:
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                rc = lote.main(['--plan', pp, '--receipts', self.rd, '--preflight', '--batch', 'big', '--creds', os.path.join(self.d, 'nada')])
        finally:
            lote.sha256_stream = orig
        out = json.loads(buf.getvalue())
        self.assertEqual((rc, out['objects'], out['missing'], out['size_mismatch'], out['creds']), (0, 1, 0, 0, 'AUSENTE'))


if __name__ == '__main__':
    unittest.main()
