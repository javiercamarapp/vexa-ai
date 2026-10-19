#!/usr/bin/env python3
"""Ejecutor de lotes de adjuntos: dry-run (defecto) o carga real por la API de Storage.

- Hash SHA-256 en streaming (bloques de 1 MiB), nunca archivos enteros en memoria.
- Compara tamano y hash con el plan/manifiesto; recibos JSONL solo con hash/tamano/estado.
- Reanudable: lee los recibos previos y omite lo ya terminado (idempotente por hash).
- Aborta si el espacio libre es < --min-free-gib (defecto 6).
- Archivos iCloud 'dataless': en dry-run se OMITEN (no se fuerza descarga) salvo --allow-hydrate;
  en modo real se leen y se evictan despues (brctl evict) para acotar el disco.
- Modo real (--execute): credenciales de un archivo 0600 (SUPABASE_URL, SUPABASE_SERVICE_KEY);
  nunca se imprimen. Los originales no se modifican jamas (solo lectura).
"""
import argparse, hashlib, http.client, json, os, shutil, stat, subprocess, sys, time, urllib.parse

CHUNK = 1024 * 1024
SF_DATALESS = 0x40000000
GIB = 1024 ** 3
DONE = {'dry_ok', 'uploaded', 'exists'}


class Abort(Exception):
    pass


def free_bytes(path, simulate=None):
    return simulate if simulate is not None else shutil.disk_usage(path).free


def is_dataless(path):
    try:
        return bool(os.stat(path).st_flags & SF_DATALESS)
    except (AttributeError, OSError):
        return False


def sha256_stream(path, expect_bytes=None):
    h = hashlib.sha256(); n = 0
    with open(path, 'rb') as f:
        while True:
            b = f.read(CHUNK)
            if not b:
                break
            h.update(b); n += len(b)
    return h.hexdigest(), n


def load_receipts(path):
    done, last = {}, {}
    if os.path.exists(path):
        for ln in open(path):
            ln = ln.strip()
            if not ln:
                continue
            try:
                r = json.loads(ln)
            except ValueError:
                continue  # linea truncada por un corte: se reintenta ese objeto
            if 'sha256' in r:
                last[r['sha256']] = r
                if r.get('status') in DONE:
                    done[r['sha256']] = r
    return done, last


def append_receipt(path, rec):
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, 'a+') as f:
        sz = os.fstat(f.fileno()).st_size
        pre = ''
        if sz:  # una linea truncada por un corte no debe pegarse al recibo nuevo
            with open(path, 'rb') as g:
                g.seek(sz - 1); pre = '' if g.read(1) == b'\n' else '\n'
        f.write(pre + json.dumps(rec, sort_keys=True) + '\n'); f.flush(); os.fsync(f.fileno())


def read_creds(path):
    st = os.stat(path)
    if st.st_mode & 0o077:
        raise Abort('archivo de credenciales debe ser chmod 600')
    c = {}
    for ln in open(path):
        if '=' in ln and not ln.lstrip().startswith('#'):
            k, v = ln.strip().split('=', 1); c[k.strip()] = v.strip().strip('"\'')
    for k in ('SUPABASE_URL', 'SUPABASE_SERVICE_KEY'):
        if not c.get(k):
            raise Abort('falta %s en el archivo de credenciales' % k)
    return c


class Storage:
    """Cliente minimo de Storage (API REST). La llave solo vive en memoria."""
    def __init__(self, url, key, bucket, timeout=600):
        u = urllib.parse.urlparse(url)
        self.cls = http.client.HTTPSConnection if u.scheme == 'https' else http.client.HTTPConnection
        self.host, self.port, self.base = u.hostname, u.port, u.path.rstrip('/')
        self.key, self.bucket, self.timeout = key, bucket, timeout

    def _conn(self):
        return self.cls(self.host, self.port, timeout=self.timeout)

    def _path(self, op, obj):
        return '%s/storage/v1/%s/%s/%s' % (self.base, op, self.bucket, urllib.parse.quote(obj))

    def _hdr(self, extra=None):
        h = {'Authorization': 'Bearer ' + self.key, 'apikey': self.key}
        h.update(extra or {}); return h

    def info_bytes(self, obj):
        c = self._conn()
        try:
            c.request('GET', self._path('object/info', obj), headers=self._hdr())
            r = c.getresponse(); body = r.read()
            if r.status == 404 or r.status == 400:
                return None
            if r.status != 200:
                raise RuntimeError('info http %d' % r.status)
            d = json.loads(body)
            return int(d.get('size') or (d.get('metadata') or {}).get('size'))
        finally:
            c.close()

    def upload(self, obj, path, size, mime):
        c = self._conn()
        try:
            c.putrequest('POST', self._path('object', obj))
            for k, v in self._hdr({'Content-Type': mime, 'Content-Length': str(size),
                                   'x-upsert': 'false', 'Cache-Control': 'max-age=31536000'}).items():
                c.putheader(k, v)
            c.endheaders()
            with open(path, 'rb') as f:
                while True:
                    b = f.read(CHUNK)
                    if not b:
                        break
                    c.send(b)
            r = c.getresponse(); r.read()
            if r.status in (200, 201):
                return 'uploaded'
            if r.status in (400, 409):  # ya existe (idempotencia por hash)
                return 'exists'
            raise RuntimeError('upload http %d' % r.status)
        finally:
            c.close()

    def download_hash(self, obj):
        c = self._conn(); h = hashlib.sha256(); n = 0
        try:
            c.request('GET', self._path('object/authenticated', obj), headers=self._hdr())
            r = c.getresponse()
            if r.status != 200:
                r.read(); raise RuntimeError('download http %d' % r.status)
            while True:
                b = r.read(CHUNK)
                if not b:
                    break
                h.update(b); n += len(b)
        finally:
            c.close()
        return h.hexdigest(), n


MIME = {'.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.heic': 'image/heic', '.mov': 'video/quicktime', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
        '.eml': 'message/rfc822', '.txt': 'text/plain', '.htm': 'text/html', '.html': 'text/html'}


def evict(path):
    try:
        subprocess.run(['brctl', 'evict', path], check=False, timeout=60,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def process_batch(batch, args, receipts_dir, storage=None, tenant=None):
    rpath = os.path.join(receipts_dir, 'lote-%02d.jsonl' % batch['batch'])
    done, _ = load_receipts(rpath)
    stats = {'ok': 0, 'skipped_resume': 0, 'missing': 0, 'size_mismatch': 0, 'hash_mismatch': 0,
             'dataless_skipped': 0, 'error': 0, 'bytes_ok': 0}
    for it in batch['items']:
        if free_bytes(receipts_dir, args.simulate_free_bytes) < args.min_free_gib * GIB:
            raise Abort('espacio libre < %d GiB: aborto antes del objeto siguiente (lote %d)'
                        % (args.min_free_gib, batch['batch']))
        sha, want = it['sha256'], it['bytes']
        if sha in done:
            stats['skipped_resume'] += 1; continue
        path = it['canonical']['localPath']
        rec = {'batch': batch['batch'], 'sha256': sha, 'bytes': want, 'ts': int(time.time())}
        try:
            if not os.path.exists(path):
                rec['status'] = 'missing'
            else:
                dl = is_dataless(path)
                if dl and not args.execute and not args.allow_hydrate:
                    rec['status'] = 'dataless_skipped'
                else:
                    sz = os.stat(path).st_size
                    if sz != want:
                        rec['status'] = 'size_mismatch'; rec['seen_bytes'] = sz
                    else:
                        got, n = sha256_stream(path)
                        if n != want:
                            rec['status'] = 'size_mismatch'; rec['seen_bytes'] = n
                        elif got != sha:
                            rec['status'] = 'hash_mismatch'; rec['seen_sha256'] = got
                        elif not args.execute:
                            rec['status'] = 'dry_ok'
                        else:
                            obj = '%s/%s' % (tenant, it['object_key'])
                            have = storage.info_bytes(obj)
                            if have == want:
                                rec['status'] = 'exists'
                            else:
                                st = storage.upload(obj, path, want, MIME.get(it['ext'], 'application/octet-stream'))
                                rec['status'] = st
                            if not args.no_verify_download:
                                dh, dn = storage.download_hash(obj)
                                if dh != sha or dn != want:
                                    rec['status'] = 'dest_mismatch'
                    if dl and (args.execute or args.allow_hydrate):
                        evict(path)  # solo cierra el ciclo de lo que estaba evictado
        except Abort:
            raise
        except Exception as e:  # red/HTTP: se registra el tipo, nunca contenido ni llaves
            rec['status'] = 'error'; rec['error'] = type(e).__name__
        append_receipt(rpath, rec)
        s = rec['status']
        if s in DONE:
            stats['ok'] += 1; stats['bytes_ok'] += want
        else:
            stats[s if s in stats else 'error'] += 1
    return stats


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--plan', required=True)
    ap.add_argument('--receipts', required=True)
    ap.add_argument('--batch', default='all', help='numero de lote o all')
    ap.add_argument('--min-free-gib', type=int, default=6)
    ap.add_argument('--simulate-free-bytes', type=int, default=None, help='solo pruebas; prohibido con --execute')
    ap.add_argument('--allow-hydrate', action='store_true', help='dry-run: permitir leer archivos dataless (descarga)')
    ap.add_argument('--execute', action='store_true', help='carga real (por defecto dry-run)')
    ap.add_argument('--creds', help='archivo 0600 con SUPABASE_URL y SUPABASE_SERVICE_KEY')
    ap.add_argument('--tenant', help='uuid del tenant (prefijo de la ruta del objeto)')
    ap.add_argument('--bucket', default='vexa-private')
    ap.add_argument('--no-verify-download', action='store_true')
    a = ap.parse_args(argv)
    os.makedirs(a.receipts, mode=0o700, exist_ok=True)
    plan = json.load(open(a.plan))
    storage = tenant = None
    if a.execute:
        if a.simulate_free_bytes is not None:
            print('--simulate-free-bytes no se permite con --execute', file=sys.stderr); return 2
        if not (a.creds and a.tenant):
            print('--execute requiere --creds y --tenant', file=sys.stderr); return 2
        c = read_creds(a.creds); tenant = a.tenant
        storage = Storage(c['SUPABASE_URL'], c['SUPABASE_SERVICE_KEY'], a.bucket)
    batches = [b for b in plan['batches'] if a.batch == 'all' or int(a.batch) == b['batch']]
    if not batches:
        print('lote inexistente', file=sys.stderr); return 2
    print('modo:', 'REAL' if a.execute else 'dry-run', '| lotes:', len(batches))
    rc = 0
    for b in batches:
        try:
            st = process_batch(b, a, a.receipts, storage, tenant)
        except Abort as e:
            print('ABORTO:', e, file=sys.stderr); return 3
        print('lote %d: objetos=%d %s' % (b['batch'], b['objects'], json.dumps(st, sort_keys=True)))
        if any(st[k] for k in ('missing', 'size_mismatch', 'hash_mismatch', 'error')):
            rc = 1
    return rc


if __name__ == '__main__':
    sys.exit(main())
