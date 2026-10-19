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
import argparse, base64, hashlib, http.client, json, os, re, shutil, stat, subprocess, sys, time, urllib.parse

CHUNK = 1024 * 1024
TUS_CHUNK = 6 * 1024 * 1024        # Storage reanudable (TUS) exige trozos de 6 MiB (el ultimo puede ser menor)
SF_DATALESS = 0x40000000
GIB = 1024 ** 3
MIB = 1024 ** 2
OBJECT_LIMIT = 50 * MIB            # limite global por defecto de Storage; lo que pasa de aqui va en trozos (TUS)
PROJECT_REF = 'proyecto-ejemplo'
DONE = {'dry_ok', 'uploaded', 'exists'}
DEFAULT_SQL_CMD = ['supabase', 'db', 'query', '--linked', '-f']
UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


class Abort(Exception):
    pass


class TooLarge(Exception):
    """Storage rechazo el objeto por limite de tamano (bucket o global). NUNCA se sube el limite desde aqui."""


class Transient(Exception):
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

    # ---- Subida reanudable TUS (objetos > 50 MiB). Nunca cambia limites del bucket. ----
    def bucket_limit(self):
        """file_size_limit del bucket (None = usa el global). Solo lectura."""
        c = self._conn()
        try:
            c.request('GET', '%s/storage/v1/bucket/%s' % (self.base, urllib.parse.quote(self.bucket)), headers=self._hdr())
            r = c.getresponse(); body = r.read()
            if r.status != 200:
                raise RuntimeError('bucket http %d' % r.status)
            lim = json.loads(body).get('file_size_limit')
            return int(lim) if lim else None
        finally:
            c.close()

    def _tus_target(self, loc):
        """Location puede ser relativo o absoluto; solo se acepta el mismo host (o *.supabase.co): la llave no sale de ahi."""
        u = urllib.parse.urlparse(loc)
        if not u.scheme:
            return self.cls, self.host, self.port, loc
        same = (u.hostname == self.host and (u.port or None) == (self.port or None))
        if not (same or (u.hostname or '').endswith('.supabase.co')):
            raise RuntimeError('tus location en host no permitido')
        cls = http.client.HTTPSConnection if u.scheme == 'https' else http.client.HTTPConnection
        return cls, u.hostname, u.port, u.path + (('?' + u.query) if u.query else '')

    def _tus(self, method, loc_or_path, headers, body=b'', absolute=False):
        cls, host, port, path = (self.cls, self.host, self.port, loc_or_path) if absolute else self._tus_target(loc_or_path)
        c = cls(host, port, timeout=self.timeout)
        try:
            h = self._hdr({'Tus-Resumable': '1.0.0'}); h.update(headers)
            h['Content-Length'] = str(len(body))
            c.request(method, path, body=body or None, headers=h)
            r = c.getresponse(); data = r.read()
            return r.status, {k.lower(): v for k, v in r.getheaders()}, data
        finally:
            c.close()

    def tus_create(self, obj, size, mime):
        meta = ','.join('%s %s' % (k, base64.b64encode(v.encode()).decode()) for k, v in
                        (('bucketName', self.bucket), ('objectName', obj), ('contentType', mime),
                         ('cacheControl', '31536000')))
        st, hd, _ = self._tus('POST', self.base + '/storage/v1/upload/resumable',
                              {'Upload-Length': str(size), 'Upload-Metadata': meta, 'x-upsert': 'false'}, absolute=True)
        if st == 201 and hd.get('location'):
            return hd['location']
        if st == 413:
            raise TooLarge('413')
        if st == 409:
            return None   # ya existe el objeto
        if st >= 500 or st == 429:
            raise Transient('create http %d' % st)
        raise RuntimeError('tus create http %d' % st)

    def tus_offset(self, loc):
        st, hd, _ = self._tus('HEAD', loc, {})
        if st in (404, 410):
            return None
        if st != 200:
            raise Transient('head http %d' % st)
        return int(hd['upload-offset'])

    def tus_patch(self, loc, offset, data):
        st, hd, _ = self._tus('PATCH', loc, {'Content-Type': 'application/offset+octet-stream',
                                             'Upload-Offset': str(offset)}, body=data)
        if st == 204:
            return int(hd['upload-offset'])
        if st in (409, 423, 429) or st >= 500:
            raise Transient('patch http %d' % st)
        if st == 413:
            raise TooLarge('413')
        raise RuntimeError('tus patch http %d' % st)

    def tus_upload(self, obj, path, size, mime, resume_location=None, on_location=None, retries=6,
                   backoff=1.0, chunk=TUS_CHUNK, on_chunk=None):
        """Sube por trozos. Devuelve 'uploaded' o 'exists'. Reanuda con HEAD (Upload-Offset) tras cortes o 5xx."""
        loc, offset = resume_location, 0
        if loc:
            off = self.tus_offset(loc)
            if off is None:
                loc = None
            else:
                offset = off
        if not loc:
            for attempt in range(retries):
                try:
                    loc = self.tus_create(obj, size, mime); break
                except (Transient, OSError, http.client.HTTPException):
                    time.sleep(min(2 ** attempt, 8) * backoff)
            else:
                raise RuntimeError('tus create agotado')
            if loc is None:
                return 'exists'
            if on_location:
                on_location(loc)
        failures = 0
        with open(path, 'rb') as f:
            while offset < size:
                f.seek(offset); data = f.read(min(chunk, size - offset))
                try:
                    offset = self.tus_patch(loc, offset, data)
                    failures = 0
                    if on_chunk:
                        on_chunk(offset)
                except (Transient, OSError, http.client.HTTPException):
                    failures += 1
                    if failures > retries:
                        raise RuntimeError('tus patch agotado')
                    time.sleep(min(2 ** failures, 8) * backoff)
                    off = self.tus_offset(loc)      # re-sincroniza con lo que el servidor SI recibio
                    if off is None:
                        raise RuntimeError('tus upload perdido')
                    offset = off
        return 'uploaded'


MIME ={'.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.heic': 'image/heic', '.mov': 'video/quicktime', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
        '.eml': 'message/rfc822', '.txt': 'text/plain', '.htm': 'text/html', '.html': 'text/html'}


def evict(path):
    try:
        subprocess.run(['brctl', 'evict', path], check=False, timeout=60,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def opt(args, name, default=None):
    return getattr(args, name, default)


def store_object(it, path, want, rec, args, storage, tenant, rpath, last):
    """Sube un objeto ya verificado en origen. <= limite: POST simple. > limite: TUS (trozos de 6 MiB) si el bucket lo admite;
    si no, 'metadata_only' (se avisa; NUNCA se sube el limite del bucket)."""
    obj = '%s/%s' % (tenant, it['object_key'])
    mime = MIME.get(it['ext'], 'application/octet-stream')
    big = want > opt(args, 'object_limit', OBJECT_LIMIT)
    have = storage.info_bytes(obj)
    if have == want:
        rec['status'] = 'exists'
    elif not big:
        rec['status'] = storage.upload(obj, path, want, mime)
    else:
        rec['via'] = 'tus'
        if opt(args, 'big_mode', 'tus') == 'metadata_only':
            rec['status'] = 'metadata_only'; rec['reason'] = 'forced'; return
        lim = storage.bucket_limit()
        if lim is not None and want > lim:
            rec['status'] = 'metadata_only'; rec['reason'] = 'bucket_limit'; rec['bucket_limit'] = lim; return
        prev = last.get(it['sha256'], {})
        resume = prev.get('tus_location') if prev.get('status') in ('tus_partial', 'error') else None
        def remember(loc):
            rec['tus_location'] = loc
            append_receipt(rpath, {'batch': rec['batch'], 'sha256': it['sha256'], 'bytes': want, 'ts': int(time.time()),
                                   'status': 'tus_partial', 'tus_location': loc})
        if resume:
            rec['tus_location'] = resume
        try:
            rec['status'] = storage.tus_upload(obj, path, want, mime, resume_location=resume, on_location=remember,
                                               backoff=opt(args, 'tus_backoff', 1.0),
                                               chunk=opt(args, 'tus_chunk', TUS_CHUNK))
            rec.pop('tus_location', None)
        except TooLarge:
            rec.pop('tus_location', None)
            rec['status'] = 'metadata_only'; rec['reason'] = 'storage_limit_413'; return
    if not opt(args, 'no_verify_download', False):
        dh, dn = storage.download_hash(obj)
        if dh != it['sha256'] or dn != want:
            rec['status'] = 'dest_mismatch'
        else:
            rec['verified'] = True


def process_batch(batch, args, receipts_dir, storage=None, tenant=None):
    rpath = os.path.join(receipts_dir, 'lote-%s.jsonl' % (('%02d' % batch['batch']) if isinstance(batch['batch'], int) else batch['batch']))
    done, last = load_receipts(rpath)
    stats = {'ok': 0, 'skipped_resume': 0, 'missing': 0, 'size_mismatch': 0, 'hash_mismatch': 0,
             'dataless_skipped': 0, 'error': 0, 'bytes_ok': 0, 'metadata_only': 0}
    for it in batch['items']:
        if free_bytes(receipts_dir, args.simulate_free_bytes) < args.min_free_gib * GIB:
            raise Abort('espacio libre < %d GiB: aborto antes del objeto siguiente (lote %s)'
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
                            store_object(it, path, want, rec, args, storage, tenant, rpath, last)
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


def guard_sql(tenant):
    if not UUID_RE.match(tenant or ''):
        raise Abort('tenant invalido')
    return ("select 'ATGUARD tables='||((to_regclass('public.attachment_blobs') is not null and to_regclass('public.attachment_links') is not null))::text"
            "||' tenant='||(exists(select 1 from public.organizations where id='%s'))::text"
            "||' bypass='||coalesce((select (rolsuper or rolbypassrls) from pg_roles where rolname=current_user),false)::text||' END';\n" % tenant)


def parse_guard(out):
    m = re.search(r'ATGUARD tables=(true|false) tenant=(true|false) bypass=(true|false) END', out or '')
    if not m:
        return 'GUARD_ILEGIBLE'
    t, n, b = (x == 'true' for x in m.groups())
    return None if (t and n and b) else ('MIGRACION_0053_NO_APLICADA' if not t else 'ROL_SIN_BYPASSRLS' if not b else 'TENANT_NO_ENCONTRADO')


def run_sql_text(sql_cmd, sql, timeout=300):
    import tempfile
    d = tempfile.mkdtemp(prefix='adj-sql-'); f = os.path.join(d, 'q.sql')
    try:
        fd = os.open(f, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as fh:
            fh.write(sql)
        r = subprocess.run(list(sql_cmd) + [f], capture_output=True, text=True, timeout=timeout)
        out = (r.stdout or '') + (r.stderr or '')
        return (r.returncode == 0 and 'ERROR:' not in out and 'SQLSTATE' not in out), out
    finally:
        shutil.rmtree(d, ignore_errors=True)


def project_ok(ref_file):
    try:
        return open(ref_file).read().strip() == PROJECT_REF
    except OSError:
        return False


def creds_state(path):
    """Solo existencia y permisos (NUNCA lee el contenido)."""
    try:
        st = os.stat(path)
    except OSError:
        return 'AUSENTE'
    return 'PERMISOS_NO_600' if st.st_mode & 0o077 else 'OK'


def execute_guards(a):
    """Guardas de la carga real: proyecto, credenciales, host de la URL, 0053 aplicada, tenant, rol, bucket, disco."""
    if not UUID_RE.match(a.tenant or ''):
        raise Abort('--tenant debe ser un uuid')
    if not project_ok(a.project_ref_file):
        raise Abort('PROJECT_MISMATCH: supabase/.temp/project-ref no es %s' % PROJECT_REF)
    cs = creds_state(a.creds)
    if cs != 'OK':
        raise Abort('credenciales %s (se esperaba un archivo chmod 600)' % cs)
    c = read_creds(a.creds)
    host = urllib.parse.urlparse(c['SUPABASE_URL']).hostname or ''
    if not (host == PROJECT_REF + '.supabase.co' or (a.allow_url_host and host == a.allow_url_host)):
        raise Abort('SUPABASE_URL no apunta al proyecto %s' % PROJECT_REF)
    ok, out = run_sql_text(a.sql_cmd, guard_sql(a.tenant))
    why = parse_guard(out) if ok else 'GUARD_CONSULTA_FALLO'
    if why:
        raise Abort('guarda de base: %s' % why)
    storage = Storage(c['SUPABASE_URL'], c['SUPABASE_SERVICE_KEY'], a.bucket)
    try:
        lim = storage.bucket_limit()
    except Exception as e:
        raise Abort('bucket %s no accesible (%s)' % (a.bucket, type(e).__name__))
    return storage, lim


def preflight(plan, batches, a):
    """Solo stat (no lee ni hidrata nada): existencia, iCloud dataless, tamano. Informe de agregados."""
    items = [i for b in batches for i in b['items']] + (plan.get('oversize') or [] if a.batch == 'all' else [])
    tot = {'objects': 0, 'bytes': 0, 'missing': 0, 'dataless': 0, 'dataless_bytes': 0, 'size_mismatch': 0, 'local_ready': 0}
    for it in items:
        tot['objects'] += 1; tot['bytes'] += it['bytes']
        p = it['canonical']['localPath']
        try:
            st = os.stat(p)
        except OSError:
            tot['missing'] += 1; continue
        if st.st_size != it['bytes']:
            tot['size_mismatch'] += 1
        if is_dataless(p):
            tot['dataless'] += 1; tot['dataless_bytes'] += it['bytes']
        else:
            tot['local_ready'] += 1
    tot['free_gib'] = round(free_bytes(a.receipts if os.path.isdir(a.receipts) else '.', None) / GIB, 1)
    tot['creds'] = creds_state(a.creds) if a.creds else 'NO_INDICADO'
    tot['project_ref_ok'] = project_ok(a.project_ref_file)
    return tot


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument('--plan', required=True)
    ap.add_argument('--receipts', required=True)
    ap.add_argument('--batch', default='all', help='numero de lote, big (objetos > 50 MiB, en trozos TUS) o all (lotes normales)')
    ap.add_argument('--min-free-gib', type=int, default=6)
    ap.add_argument('--simulate-free-bytes', type=int, default=None, help='solo pruebas; prohibido con --execute')
    ap.add_argument('--allow-hydrate', action='store_true', help='dry-run: permitir leer archivos dataless (descarga)')
    ap.add_argument('--execute', action='store_true', help='carga real (por defecto dry-run)')
    ap.add_argument('--preflight', action='store_true', help='solo stat: cuenta ausentes/dataless/tamano; no lee, no escribe')
    ap.add_argument('--creds', help='archivo 0600 con SUPABASE_URL y SUPABASE_SERVICE_KEY')
    ap.add_argument('--tenant', help='uuid del tenant (prefijo de la ruta del objeto)')
    ap.add_argument('--bucket', default='vexa-private')
    ap.add_argument('--no-verify-download', action='store_true')
    ap.add_argument('--big-mode', choices=['tus', 'metadata_only'], default='tus',
                    help='objetos > 50 MiB: tus (si el bucket lo admite; si no metadata_only y aviso) o metadata_only forzado')
    ap.add_argument('--object-limit', type=int, default=OBJECT_LIMIT)
    ap.add_argument('--project-ref-file', default=os.path.join(here, '..', '..', 'supabase', '.temp', 'project-ref'))
    ap.add_argument('--sql-cmd', default=' '.join(DEFAULT_SQL_CMD), help='ejecutor de archivos SQL (guardas de base)')
    ap.add_argument('--allow-url-host', default=None, help='solo pruebas (servidor falso)')
    ap.add_argument('--tus-backoff', type=float, default=1.0)
    a = ap.parse_args(argv)
    a.sql_cmd = a.sql_cmd.split()
    plan = json.load(open(a.plan))
    batches = [b for b in plan['batches'] if a.batch == 'all' or (a.batch != 'big' and int(a.batch) == b['batch'])]
    if a.batch == 'big':
        batches = [{'batch': 'big', 'objects': len(plan.get('oversize') or []), 'items': plan.get('oversize') or []}]
    if not batches:
        print('lote inexistente', file=sys.stderr); return 2
    if a.preflight:
        print(json.dumps(preflight(plan, batches, a), sort_keys=True)); return 0
    os.makedirs(a.receipts, mode=0o700, exist_ok=True)
    storage = tenant = None
    if a.execute:
        if a.simulate_free_bytes is not None:
            print('--simulate-free-bytes no se permite con --execute', file=sys.stderr); return 2
        if not (a.creds and a.tenant):
            print('--execute requiere --creds y --tenant', file=sys.stderr); return 2
        try:
            storage, lim = execute_guards(a)
        except Abort as e:
            print('GUARDA:', e, file=sys.stderr); return 3
        tenant = a.tenant
        print('guardas OK | bucket file_size_limit:', lim if lim else 'global (sin limite propio)')
    print('modo:', 'REAL' if a.execute else 'dry-run', '| lotes:', len(batches))
    rc = 0; warn = 0
    for b in batches:
        try:
            st = process_batch(b, a, a.receipts, storage, tenant)
        except Abort as e:
            print('ABORTO:', e, file=sys.stderr); return 3
        print('lote %s: objetos=%d %s' % (b['batch'], b['objects'], json.dumps(st, sort_keys=True)))
        if any(st[k] for k in ('missing', 'size_mismatch', 'hash_mismatch', 'error')):
            rc = 1
        warn += st['metadata_only']
    if warn and not rc:
        print('AVISO: %d objeto(s) grande(s) quedaron en metadata_only (Storage no admite su tamano). '
              'NO se subio el limite del bucket: avisar a Javier para decidir.' % warn, file=sys.stderr)
        rc = 4
    return rc


if __name__ == '__main__':
    sys.exit(main())
