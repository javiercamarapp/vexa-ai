"""Registro de blobs y vinculos contra el esquema REAL (0001..0053) en Postgres local. Uso: python3 test_registro_pg.py <socket> <port> <db>
Datos 100% sinteticos."""
import contextlib, hashlib, importlib.util, io, json, os, subprocess, sys, tempfile, unittest, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
SOCK, PORT, DB = sys.argv[1:4]; sys.argv = sys.argv[:1]


def load(n, f):
    s = importlib.util.spec_from_file_location(n, os.path.join(HERE, f)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m


lote = load('lote', 'adjuntos_lote.py'); reg = load('reg', 'adjuntos_registro.py')
PSQL = ['psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', SOCK, '-p', PORT, '-d', DB]


def sql(q):
    r = subprocess.run(PSQL + ['-c', q], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()


def sha(b): return hashlib.sha256(b).hexdigest()


class RegistroTests(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.d = self.t.name
        self.T = str(uuid.uuid4()); T = self.T
        sql("insert into public.organizations(id,name) values ('%s','sint')" % T)
        conn, c1, c2, c3 = (str(uuid.uuid4()) for _ in range(4))
        sql("insert into public.connections(id,tenant_id,source,account_id) values ('%s','%s','hubspot','p1')" % (conn, T))
        sql("insert into public.conversations(id,tenant_id,source,external_id,connection_id) values ('%s','%s','hubspot','t1','%s'),('%s','%s','hubspot','t2','%s'),('%s','%s','hubspot','t3','%s')"
            % (c1, T, conn, c2, T, conn, c3, T, conn))
        sql("insert into public.messages(tenant_id,external_id,role,occurred_at,conversation_id) values "
            "('%s','mid-1','customer',now(),'%s'),('%s','hubspot:mid-2','agent',now(),'%s'),('%s','mid-amb','customer',now(),'%s'),('%s','mid-amb','customer',now(),'%s')"
            % (T, c1, T, c2, T, c1, T, c3))
        self.c1, self.c2 = c1, c2
        self.blobs = {k: os.urandom(20) for k in 'ABCDE'}
        self.plan = {'batches': [{'batch': 1, 'objects': 3, 'items': [
            self.item('A', '.pdf', [('conversation', 'f-A1'), ('conversation', 'f-A2')]),
            self.item('B', '.jpg', [('conversation', 'f-B')]),
            self.item('C', '.zip', [('note', 'n-C')])]}],
            'oversize': [self.item('D', '.mp4', [('conversation', 'f-D')])]}
        self.plan['batches'][0]['items'].append(self.item('E', '.txt', [('conversation', 'f-E')]))   # sin recibo: no se registra
        self.rec = os.path.join(self.d, 'rec'); os.makedirs(self.rec)
        self.write_receipts({'A': ('uploaded', True), 'B': ('uploaded', False), 'C': ('exists', True)}, big={'D': 'metadata_only'})
        self.csv = os.path.join(self.d, 'inv.csv')
        open(self.csv, 'w', encoding='utf-8-sig').write(
            'file_id,nombre_original,bytes,estado,archivo,sha256_al_descargar,iCloud_sin_copia_local_completa,thread_id,message_id\n'
            'f-A1,x,1,guardado,,,False,th1,mid-1\nf-A2,x,1,guardado,,,False,th1,mid-1\nf-B,x,1,guardado,,,False,th2,mid-amb\n'
            'f-D,x,1,guardado,,,False,th3,mid-nada\nf-E,x,1,guardado,,,False,th9,mid-1\n')
        self.ref = os.path.join(self.d, 'ref'); open(self.ref, 'w').write(lote.PROJECT_REF)
        self.base = ['--plan', self.pp(), '--receipts', self.rec, '--links-csv', self.csv, '--tenant', T, '--project-ref-file', self.ref,
                     '--sql-cmd', ' '.join(PSQL + ['-f']), '--reg-receipts', os.path.join(self.d, 'regrec')]

    def item(self, k, ext, srcs):
        b = self.blobs[k]
        return {'sha256': sha(b), 'bytes': len(b), 'ext': ext, 'object_key': 'attachments/%s/%s' % (sha(b)[:2], sha(b)),
                'canonical': {'family': srcs[0][0], 'fileId': srcs[0][1], 'localPath': '/x/' + k}, 'sources': [{'family': f, 'fileId': i} for f, i in srcs]}

    def pp(self):
        p = os.path.join(self.d, 'plan.json'); json.dump(self.plan, open(p, 'w')); return p

    def write_receipts(self, normal, big=None, mode='w'):
        with open(os.path.join(self.rec, 'lote-01.jsonl'), mode) as f:
            for k, (st, ver) in normal.items():
                r = {'batch': 1, 'sha256': sha(self.blobs[k]), 'bytes': 20, 'ts': 1, 'status': st}
                if ver: r['verified'] = True
                f.write(json.dumps(r) + '\n')
        with open(os.path.join(self.rec, 'lote-big.jsonl'), mode) as f:
            for k, st in (big or {}).items():
                f.write(json.dumps({'batch': 'big', 'sha256': sha(self.blobs[k]), 'bytes': 20, 'ts': 1, 'status': st, 'via': 'tus', 'reason': 'storage_limit_413'}) + '\n')

    def run_reg(self, *extra):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            rc = reg.main(self.base + list(extra))
        return rc, out.getvalue(), err.getvalue()

    def counts(self):
        T = self.T
        return sql("select (select count(*) from public.attachment_blobs where tenant_id='%s')||'/'||(select count(*) from public.attachment_links where tenant_id='%s')" % (T, T))

    def test_dry_run_writes_nothing(self):
        rc, out, _ = self.run_reg()
        self.assertEqual(rc, 0); s = json.loads(out.splitlines()[0])
        self.assertEqual((s['blobs'], s['links'], s['not_uploaded'], s['by_state']), (4, 5, 1, {'verified': 2, 'uploaded': 1, 'metadata_only': 1}))
        self.assertEqual(self.counts(), '0/0'); self.assertFalse(os.path.exists(os.path.join(self.d, 'regrec')))

    def test_execute_registers_and_resolves(self):
        rc, out, err = self.run_reg('--execute')
        self.assertEqual(rc, 0, err)
        v = json.loads(out.strip().splitlines()[-1])['verificacion']
        self.assertEqual(v, {'blobs': 4, 'verified': 2, 'uploaded': 1, 'metadata_only': 1, 'links': 5, 'with_message': 2, 'with_conversation': 2, 'ambiguous': 1})
        T = self.T
        # A1 y A2 (duplicado) -> mismo blob; ambos al mensaje mid-1 de la conversacion 1
        self.assertEqual(sql("select count(distinct blob_id)||':'||count(*) from public.attachment_links where tenant_id='%s' and source_file_id in ('f-A1','f-A2')" % T), '1:2')
        self.assertEqual(sql("select conversation_id from public.attachment_links where tenant_id='%s' and source_file_id='f-A2'" % T), self.c1)
        self.assertEqual(sql("select provenance->>'duplicate_of' from public.attachment_links where tenant_id='%s' and source_file_id='f-A2'" % T), 'f-A1')
        # el id con prefijo hubspot: no estaba en el CSV de este caso; el ambiguo (en 2 conversaciones) NO se adivina
        self.assertEqual(sql("select coalesce(conversation_id::text,'nulo')||':'||(provenance->>'resolution') from public.attachment_links where tenant_id='%s' and source_file_id='f-B'" % T), 'nulo:message_ambiguous')
        self.assertEqual(sql("select coalesce(conversation_id::text,'nulo') from public.attachment_links where tenant_id='%s' and source_file_id='f-D'" % T), 'nulo')
        # metadata_only no tiene ruta; los subidos si, con el formato exigido por el check
        self.assertEqual(sql("select count(*) from public.attachment_blobs where tenant_id='%s' and state='metadata_only' and object_path is null" % T), '1')
        self.assertEqual(sql("select count(*) from public.attachment_blobs where tenant_id='%s' and object_path like '%s/attachments/%%'" % (T, T)), '3')
        # nota sin mapeo: link sin conversacion
        self.assertEqual(sql("select count(*) from public.attachment_links where tenant_id='%s' and source_family='note' and conversation_id is null" % T), '1')

    def test_idempotent_never_downgrades_and_upgrades(self):
        self.assertEqual(self.run_reg('--execute')[0], 0); first = self.counts()
        rc, _, err = self.run_reg('--execute'); self.assertEqual(rc, 0, err); self.assertEqual(self.counts(), first)
        # B pasa de uploaded a verified (nuevo recibo); C, ya verified, no baja aunque un recibo posterior diga uploaded sin verificar
        self.write_receipts({'B': ('exists', True), 'C': ('uploaded', False)}, mode='a')
        rc, _, err = self.run_reg('--execute'); self.assertEqual(rc, 0, err)
        T = self.T
        self.assertEqual(sql("select state from public.attachment_blobs where tenant_id='%s' and sha256='%s'" % (T, sha(self.blobs['B']))), 'verified')
        self.assertEqual(sql("select state from public.attachment_blobs where tenant_id='%s' and sha256='%s'" % (T, sha(self.blobs['C']))), 'verified')
        self.assertEqual(self.counts(), first)

    def test_late_messages_are_resolved_by_rerun(self):
        self.assertEqual(self.run_reg('--execute')[0], 0)
        sql("insert into public.messages(tenant_id,external_id,role,occurred_at,conversation_id) values ('%s','mid-nada','customer',now(),'%s')" % (self.T, self.c2))
        rc, out, err = self.run_reg('--execute'); self.assertEqual(rc, 0, err)
        self.assertEqual(sql("select conversation_id from public.attachment_links where tenant_id='%s' and source_file_id='f-D'" % self.T), self.c2)

    def test_dry_run_receipts_are_not_uploads(self):
        self.write_receipts({'A': ('dry_ok', False)}); os.remove(os.path.join(self.rec, 'lote-big.jsonl'))
        rc, out, _ = self.run_reg(); s = json.loads(out.splitlines()[0]); self.assertEqual((s['blobs'], s['links']), (0, 0))

    def test_guards(self):
        open(self.ref, 'w').write('otro'); rc, _, err = self.run_reg('--execute'); self.assertEqual(rc, 3); self.assertIn('PROJECT_MISMATCH', err)
        open(self.ref, 'w').write(lote.PROJECT_REF)
        orig = reg.lote.is_dataless; reg.lote.is_dataless = lambda p: True
        try:
            rc, _, err = self.run_reg(); self.assertEqual(rc, 3); self.assertIn('placeholder iCloud', err)
        finally:
            reg.lote.is_dataless = orig
        self.assertEqual(self.counts(), '0/0')
        # tenant inexistente -> guarda de base
        self.base[self.base.index('--tenant') + 1] = str(uuid.uuid4())
        rc, _, err = self.run_reg('--execute'); self.assertEqual(rc, 3); self.assertIn('TENANT_NO_ENCONTRADO', err)

    def test_emit_files_are_private_and_hold_no_secrets(self):
        out = os.path.join(self.d, 'sql'); rc, _, _ = self.run_reg('--emit', out)
        self.assertEqual(rc, 0)
        names = sorted(os.listdir(out)); self.assertEqual(names, ['00-guarda.sql', '10-blobs-001.sql', '20-links-001.sql', '90-resolver.sql', '99-verificar.sql'])
        self.assertTrue(all(oct(os.stat(os.path.join(out, n)).st_mode & 0o777) == '0o600' for n in names))
        self.assertEqual(oct(os.stat(out).st_mode & 0o777), '0o700')


if __name__ == '__main__':
    unittest.main()
