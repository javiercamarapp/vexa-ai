import hashlib, importlib.util, json, os, subprocess, sys, tempfile, threading, unittest, http.server

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name, fn):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, fn))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


lote = load('lote', 'adjuntos_lote.py')
plan_mod = load('plan', 'adjuntos-plan.py')


def sha(b): return hashlib.sha256(b).hexdigest()


class Base(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.d = self.t.name
        self.files = {}
        # a.txt y a2.txt duplicados (mismo contenido), b.jpg, c.mov
        self.mk('a.txt', b'hello world'); self.mk('a2.txt', b'hello world')
        self.mk('b.jpg', os.urandom(3000)); self.mk('c.mov', os.urandom(5000))
        srcs = {}
        for fid, (p, data) in self.files.items():
            srcs.setdefault(sha(data), []).append({'family': 'conversation', 'fileId': fid, 'localPath': p,
                                                   'bytes': len(data), 'sha256': sha(data)})
        self.manifest = {'sourceFileCount': 4, 'logicalBytes': sum(len(v[1]) for v in self.files.values()),
                         'uniqueContentCount': 3,
                         'uniqueContentBytes': sum(len(s[0] and self.files[s[0]['fileId']][1]) for s in srcs.values()),
                         'blobs': [{'sha256': h, 'bytes': s[0]['bytes'], 'sources': s} for h, s in srcs.items()]}

    def mk(self, name, data):
        p = os.path.join(self.d, name); open(p, 'wb').write(data); self.files[name] = (p, data)

    def plan(self, batch_bytes=4000, limit=10**9):
        b, dup, big, items = plan_mod.build(self.manifest, batch_bytes, limit)
        return {'batches': b}, dup, big, items

    def run_lote(self, plan, **kw):
        a = lote.argparse.Namespace(execute=False, allow_hydrate=False, min_free_gib=6, simulate_free_bytes=10**13,
                                    no_verify_download=False)
        for k, v in kw.items(): setattr(a, k, v)
        rd = os.path.join(self.d, 'rec'); os.makedirs(rd, exist_ok=True)
        return [lote.process_batch(b, a, rd) for b in plan['batches']], rd


class PlanTests(Base):
    def test_dedup_and_totals(self):
        plan, dup, big, items = self.plan()
        self.assertEqual(len(items), 3); self.assertEqual(len(dup), 1)
        self.assertEqual(dup[0]['object_key'], items[[i['sha256'] for i in items].index(dup[0]['sha256'])]['object_key'])
        self.assertEqual(sum(b['objects'] for b in plan['batches']), 3)
        self.assertTrue(all(b['bytes'] <= 4000 or b['objects'] == 1 for b in plan['batches']))

    def test_order_docs_images_video(self):
        _, _, _, items = self.plan()
        self.assertEqual([i['ext'] for i in items], ['.txt', '.jpg', '.mov'])

    def test_oversize_excluded(self):
        plan, _, big, _ = self.plan(limit=4000)
        self.assertEqual([i['ext'] for i in big], ['.mov'])
        self.assertEqual(sum(b['objects'] for b in plan['batches']), 2)

    def test_cli_invariants(self):
        mp = os.path.join(self.d, 'm.json'); json.dump(self.manifest, open(mp, 'w'))
        out = os.path.join(self.d, 'p.json')
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'adjuntos-plan.py'), '--manifest', mp, '--out', out],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(oct(os.stat(out).st_mode & 0o777), '0o600')
        self.assertEqual(json.load(open(out))['totals']['duplicate_files'], 1)


class LoteTests(Base):
    def test_all_ok(self):
        plan, *_ = self.plan()
        res, rd = self.run_lote(plan)
        self.assertEqual(sum(r['ok'] for r in res), 3)

    def test_truncated_and_hash_mismatch(self):
        plan, *_ = self.plan()
        open(self.files['b.jpg'][0], 'wb').write(self.files['b.jpg'][1][:1000])      # truncado
        flipped = bytearray(self.files['c.mov'][1]); flipped[0] ^= 1                  # mismo tamano, otro hash
        open(self.files['c.mov'][0], 'wb').write(bytes(flipped))
        res, rd = self.run_lote(plan)
        tot = {k: sum(r[k] for r in res) for k in res[0]}
        self.assertEqual((tot['size_mismatch'], tot['hash_mismatch'], tot['ok']), (1, 1, 1))

    def test_missing(self):
        plan, *_ = self.plan(); os.remove(self.files['b.jpg'][0])
        res, _ = self.run_lote(plan)
        self.assertEqual(sum(r['missing'] for r in res), 1)

    def test_low_disk_aborts_before_reading(self):
        plan, *_ = self.plan()
        with self.assertRaises(lote.Abort):
            self.run_lote(plan, simulate_free_bytes=5 * 1024 ** 3)
        rd = os.path.join(self.d, 'rec')
        self.assertEqual(os.listdir(rd), [])  # no se leyo ni registro nada

    def test_resume_mid_batch(self):
        plan, *_ = self.plan(batch_bytes=10**6)   # un solo lote de 3 objetos
        calls = {'n': 0}; orig = lote.free_bytes

        def flaky(p, s=None):
            calls['n'] += 1
            return 10**13 if calls['n'] <= 2 else 0  # corta en el tercer objeto
        lote.free_bytes = flaky
        try:
            with self.assertRaises(lote.Abort):
                self.run_lote(plan, simulate_free_bytes=None)
        finally:
            lote.free_bytes = orig
        rd = os.path.join(self.d, 'rec'); rp = os.path.join(rd, 'lote-01.jsonl')
        self.assertEqual(len(open(rp).read().splitlines()), 2)
        open(rp, 'a').write('{"batch":1,"sha256":"abc')                              # linea truncada por el corte
        hashed = []; osh = lote.sha256_stream
        lote.sha256_stream = lambda p, e=None: (hashed.append(p), osh(p))[1]
        try:
            res, _ = self.run_lote(plan)
        finally:
            lote.sha256_stream = osh
        self.assertEqual(res[0]['skipped_resume'], 2); self.assertEqual(len(hashed), 1)
        res2, _ = self.run_lote(plan)                                                 # idempotente
        self.assertEqual((res2[0]['skipped_resume'], res2[0]['ok']), (3, 0))

    def test_dataless_skipped_in_dryrun(self):
        plan, *_ = self.plan(); orig = lote.is_dataless
        lote.is_dataless = lambda p: True
        try:
            res, _ = self.run_lote(plan)
        finally:
            lote.is_dataless = orig
        self.assertEqual(sum(r['dataless_skipped'] for r in res), 3)

    def test_receipts_have_no_paths(self):
        plan, *_ = self.plan(); _, rd = self.run_lote(plan)
        txt = open(os.path.join(rd, 'lote-01.jsonl')).read()
        self.assertNotIn(self.d, txt)

    def test_execute_requires_creds_and_forbids_simulation(self):
        pp = os.path.join(self.d, 'p.json'); json.dump(self.plan()[0], open(pp, 'w'))
        self.assertEqual(lote.main(['--plan', pp, '--receipts', self.d + '/r', '--execute']), 2)
        self.assertEqual(lote.main(['--plan', pp, '--receipts', self.d + '/r', '--execute', '--creds', 'x',
                                    '--tenant', 't', '--simulate-free-bytes', '1']), 2)

    def test_creds_mode_enforced(self):
        c = os.path.join(self.d, 'c.env'); open(c, 'w').write('SUPABASE_URL=http://x\nSUPABASE_SERVICE_KEY=k\n')
        os.chmod(c, 0o644)
        with self.assertRaises(lote.Abort): lote.read_creds(c)
        os.chmod(c, 0o600); self.assertEqual(lote.read_creds(c)['SUPABASE_URL'], 'http://x')


class FakeStore(http.server.BaseHTTPRequestHandler):
    store = {}
    def log_message(self, *a): pass
    def key(self): return self.path.split('/vexa-private/', 1)[1]
    def do_POST(self):
        n = int(self.headers['Content-Length']); body = self.rfile.read(n); k = self.key()
        if k in self.store: self.send_response(409)
        else: self.store[k] = body; self.send_response(200)
        self.send_header('Content-Length', '0'); self.end_headers()
    def do_GET(self):
        k = self.key()
        if k not in self.store: self.send_response(404); self.send_header('Content-Length', '0'); self.end_headers(); return
        if '/object/info/' in self.path: b = json.dumps({'size': len(self.store[k])}).encode()
        else: b = self.store[k]
        self.send_response(200); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)


class LoopbackUpload(Base):
    """Prueba del camino real contra un servidor falso en 127.0.0.1 (sin red externa)."""
    def test_upload_idempotent_and_verify(self):
        FakeStore.store = {}
        srv = http.server.HTTPServer(('127.0.0.1', 0), FakeStore); threading.Thread(target=srv.serve_forever, daemon=True).start()
        st = lote.Storage('http://127.0.0.1:%d' % srv.server_port, 'k', 'vexa-private')
        plan, *_ = self.plan()
        a = lote.argparse.Namespace(execute=True, allow_hydrate=False, min_free_gib=0, simulate_free_bytes=None,
                                    no_verify_download=False)
        rd = os.path.join(self.d, 'rec'); os.makedirs(rd)
        lote.evict = lambda p: None
        r1 = lote.process_batch(plan['batches'][0], a, rd, st, 'T1')
        self.assertEqual(r1['ok'], len(plan['batches'][0]['items']))
        self.assertTrue(all(k.startswith('T1/attachments/') for k in FakeStore.store))
        os.remove(os.path.join(rd, 'lote-01.jsonl'))       # pierde recibos: la reanudacion se apoya en el destino
        r2 = lote.process_batch(plan['batches'][0], a, rd, st, 'T1')
        self.assertEqual(r2['ok'], r1['ok'])
        recs = [json.loads(l)['status'] for l in open(os.path.join(rd, 'lote-01.jsonl'))]
        self.assertTrue(all(s == 'exists' for s in recs))
        srv.shutdown()


if __name__ == '__main__':
    unittest.main()
