#!/usr/bin/env python3
"""Registro en base (0053) de lo subido: attachment_blobs + attachment_links (blob <-> conversacion/mensaje).

Dry-run por defecto: solo cuenta. --emit DIR escribe los SQL (0700, contienen ids de archivos, no contenido).
--execute los corre con el ejecutor SQL (guardas: proyecto, 0053 aplicada, tenant, rol con bypassrls) y deja recibo local.
Todo es idempotente (upsert por (tenant, sha256) y (tenant, familia, id de archivo)); un blob 'verified' no baja de estado.

Vinculo a conversacion/mensaje: el inventario (INVENTARIO-ADJUNTOS.csv) da file_id -> thread_id, message_id de HubSpot.
El mensaje se resuelve por messages.external_id = message_id (o 'hubspot:'||message_id); la conversacion es la del mensaje.
Si el id de mensaje aparece en varias conversaciones (multiticket) NO se adivina: queda sin vincular y marcado 'message_ambiguous'.
Lo que no se pueda resolver queda con conversation_id/message_id nulos y los ids de HubSpot en provenance; el paso 90 es repetible.
"""
import argparse, csv, hashlib, importlib.util, json, os, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('adjuntos_lote', os.path.join(HERE, 'adjuntos_lote.py'))
lote = importlib.util.module_from_spec(spec); spec.loader.exec_module(lote)

STATE_RANK = ['failed', 'planned', 'metadata_only', 'uploaded', 'verified']
BLOB_ROWS = 500
LINK_ROWS = 1000


def q(v):
    return 'null' if v is None else "'" + str(v).replace("'", "''") + "'"


def jlit(obj):
    text = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    seed = hashlib.sha256(text.encode()).hexdigest()   # etiqueta determinista: el mismo contenido da el mismo SQL (recibo estable)
    for n in range(64):
        tag = 'j' + seed[n:n + 8]
        if ('$' + tag + '$') not in text:
            return '$%s$%s$%s$::jsonb' % (tag, text, tag)
    raise ValueError('sin etiqueta libre')


def tx(tenant, body):
    return "begin;\nselect set_config('vexa.tenant_id',%s,true);\nset local statement_timeout='120000ms';\n%s\ncommit;\n" % (q(tenant), body)


def read_receipts(rdir):
    """Ultimo recibo real por sha256 (ignora dry_ok: eso no es una subida)."""
    best = {}
    if not os.path.isdir(rdir):
        return best
    for fn in sorted(os.listdir(rdir)):
        if not (fn.startswith('lote-') and fn.endswith('.jsonl')):
            continue
        for ln in open(os.path.join(rdir, fn)):
            try:
                r = json.loads(ln)
            except ValueError:
                continue
            if 'sha256' in r and r.get('status') in ('uploaded', 'exists', 'metadata_only'):
                prev = best.get(r['sha256'])
                if not prev or r.get('ts', 0) >= prev.get('ts', 0):
                    best[r['sha256']] = r
    return best


def read_links_csv(path, allow_hydrate):
    """file_id -> (thread_id, message_id). Aborta si el archivo es un placeholder iCloud (dataless)."""
    if lote.is_dataless(path) and not allow_hydrate:
        raise lote.Abort('BLOQUEO: %s es un placeholder iCloud (dataless); materializarlo o usar --allow-hydrate' % os.path.basename(path))
    out, conflicts = {}, 0
    with open(path, newline='', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            fid = (row.get('file_id') or '').strip()
            if not fid:
                continue
            ref = ((row.get('thread_id') or '').strip() or None, (row.get('message_id') or '').strip() or None)
            if fid in out and out[fid] != ref:
                conflicts += 1
                continue
            out[fid] = ref
    return out, conflicts


def build(plan, receipts, refs):
    """Devuelve (blobs, links, resumen). Solo se registra lo que tiene recibo real de subida/metadata_only."""
    items = [i for b in plan['batches'] for i in b['items']] + list(plan.get('oversize') or [])
    blobs, links, s = [], [], {'items': len(items), 'not_uploaded': 0, 'by_state': {}, 'links_by_family': {}, 'links_with_message_ref': 0,
                              'links_without_ref': 0}
    for it in items:
        r = receipts.get(it['sha256'])
        if not r:
            s['not_uploaded'] += 1; continue
        if r['status'] == 'metadata_only':
            state, path = 'metadata_only', None
        else:
            state = 'verified' if r.get('verified') else 'uploaded'
            path = None  # se completa con el tenant al emitir
        ext = it['ext'] if lote.re.match(r'^\.?[a-z0-9]{1,16}$', it['ext'] or '') else None
        mime = lote.MIME.get(it['ext'])
        blobs.append({'sha': it['sha256'], 'bytes': it['bytes'], 'mime': mime, 'ext': ext, 'state': state,
                      'key': it['object_key'] if state != 'metadata_only' else None, 'via': r.get('via', 'post'),
                      'reason': r.get('reason')})
        s['by_state'][state] = s['by_state'].get(state, 0) + 1
        canon = it['canonical']['fileId']
        for src in it['sources']:
            tid, mid = refs.get(src['fileId'], (None, None)) if src['family'] == 'conversation' else (None, None)
            links.append({'family': src['family'], 'file_id': src['fileId'], 'sha': it['sha256'],
                          'canon': src['fileId'] == canon and src['family'] == it['canonical']['family'],
                          'dup_of': None if (src['fileId'] == canon and src['family'] == it['canonical']['family']) else canon,
                          'thread_id': tid, 'message_id': mid})
            s['links_by_family'][src['family']] = s['links_by_family'].get(src['family'], 0) + 1
            if mid:
                s['links_with_message_ref'] += 1
            else:
                s['links_without_ref'] += 1
    s['blobs'] = len(blobs); s['links'] = len(links)
    return blobs, links, s


def blob_sql(tenant, rows):
    data = [{'sha': b['sha'], 'bytes': b['bytes'], 'mime': b['mime'], 'ext': b['ext'], 'state': b['state'],
             'path': ('%s/%s' % (tenant, b['key'])) if b['key'] else None, 'via': b['via'], 'reason': b['reason']} for b in rows]
    rank = "array[%s]" % ','.join(q(x) for x in STATE_RANK)
    body = (
        "insert into public.attachment_blobs(tenant_id,sha256,bytes,mime_type,extension,object_path,state,verified_at,provenance)\n"
        "select %s,v.sha,v.bytes,v.mime,v.ext,v.path,v.state,case when v.state='verified' then now() end,\n"
        " jsonb_strip_nulls(jsonb_build_object('source','attachments-ingest-v1','via',v.via,'reason',v.reason))\n"
        "from jsonb_to_recordset(%s) as v(sha text,bytes bigint,mime text,ext text,path text,state text,via text,reason text)\n"
        "on conflict (tenant_id,sha256) do update set\n"
        " state=(%s)[greatest(array_position(%s,public.attachment_blobs.state),array_position(%s,excluded.state))],\n"
        " verified_at=coalesce(public.attachment_blobs.verified_at,excluded.verified_at),\n"
        " object_path=coalesce(public.attachment_blobs.object_path,excluded.object_path),\n"
        " mime_type=coalesce(public.attachment_blobs.mime_type,excluded.mime_type);\n") % (q(tenant), jlit(data), rank, rank, rank)
    return tx(tenant, body)


def link_sql(tenant, rows):
    data = [{'family': l['family'], 'file_id': l['file_id'], 'sha': l['sha'], 'canon': l['canon'], 'dup_of': l['dup_of'],
             'thread_id': l['thread_id'], 'message_id': l['message_id']} for l in rows]
    body = (
        "insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,provenance)\n"
        "select %s,b.id,v.family,v.file_id,jsonb_strip_nulls(jsonb_build_object('source','attachments-ingest-v1','canonical',v.canon,\n"
        " 'duplicate_of',v.dup_of,'thread_id',v.thread_id,'message_id',v.message_id))\n"
        "from jsonb_to_recordset(%s) as v(family text,file_id text,sha text,canon boolean,dup_of text,thread_id text,message_id text)\n"
        "join public.attachment_blobs b on b.tenant_id=%s and b.sha256=v.sha\n"
        "on conflict (tenant_id,source_family,source_file_id) do nothing;\n") % (q(tenant), jlit(data), q(tenant))
    return tx(tenant, body)


def resolve_sql(tenant):
    """Repetible: vincula mensaje/conversacion de los links pendientes con message_id en provenance."""
    t = q(tenant)
    body = (
        "with pend as (select id,provenance->>'message_id' mid from public.attachment_links\n"
        "  where tenant_id=%s and message_id is null and provenance ? 'message_id'),\n"
        "cand as (select p.id,m.id msg,m.conversation_id conv from pend p join public.messages m on m.tenant_id=%s and m.deleted_at is null and m.external_id=p.mid\n"
        "  union all select p.id,m.id,m.conversation_id from pend p join public.messages m on m.tenant_id=%s and m.deleted_at is null and m.external_id='hubspot:'||p.mid),\n"
        "agg as (select id,count(distinct conv) n,(array_agg(msg order by msg))[1] msg,(array_agg(conv order by conv))[1] conv from cand group by id)\n"
        "update public.attachment_links l set\n"
        " message_id=case when agg.n=1 then agg.msg end, conversation_id=case when agg.n=1 then agg.conv end,\n"
        " provenance=l.provenance||jsonb_build_object('resolution',case when agg.n=1 then 'message_external_id' else 'message_ambiguous' end)\n"
        "from agg where l.tenant_id=%s and l.id=agg.id;\n") % (t, t, t, t)
    return tx(tenant, body)


def verify_sql(tenant):
    t = q(tenant)
    return ("select 'ATVERIFY blobs='||(select count(*) from public.attachment_blobs where tenant_id=%s)"
            "||' verified='||(select count(*) from public.attachment_blobs where tenant_id=%s and state='verified')"
            "||' uploaded='||(select count(*) from public.attachment_blobs where tenant_id=%s and state='uploaded')"
            "||' metadata_only='||(select count(*) from public.attachment_blobs where tenant_id=%s and state='metadata_only')"
            "||' links='||(select count(*) from public.attachment_links where tenant_id=%s)"
            "||' with_message='||(select count(*) from public.attachment_links where tenant_id=%s and message_id is not null)"
            "||' with_conversation='||(select count(*) from public.attachment_links where tenant_id=%s and conversation_id is not null)"
            "||' ambiguous='||(select count(*) from public.attachment_links where tenant_id=%s and provenance->>'resolution'='message_ambiguous')"
            "||' END';\n") % ((t,) * 8)


def parse_verify(out):
    m = lote.re.search(r'ATVERIFY blobs=(\d+) verified=(\d+) uploaded=(\d+) metadata_only=(\d+) links=(\d+) with_message=(\d+) with_conversation=(\d+) ambiguous=(\d+) END', out or '')
    return dict(zip(('blobs', 'verified', 'uploaded', 'metadata_only', 'links', 'with_message', 'with_conversation', 'ambiguous'),
                    map(int, m.groups()))) if m else None


def files_for(tenant, blobs, links, resolve=True):
    out = []
    for i in range(0, len(blobs), BLOB_ROWS):
        out.append(('10-blobs-%03d.sql' % (i // BLOB_ROWS + 1), blob_sql(tenant, blobs[i:i + BLOB_ROWS])))
    for i in range(0, len(links), LINK_ROWS):
        out.append(('20-links-%03d.sql' % (i // LINK_ROWS + 1), link_sql(tenant, links[i:i + LINK_ROWS])))
    if resolve:
        out.append(('90-resolver.sql', resolve_sql(tenant)))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--plan', required=True)
    ap.add_argument('--receipts', required=True, help='carpeta de recibos REALES de adjuntos_lote (lote-*.jsonl)')
    ap.add_argument('--links-csv', help='INVENTARIO-ADJUNTOS.csv (file_id,thread_id,message_id)')
    ap.add_argument('--allow-hydrate', action='store_true', help='permitir leer el CSV si es un placeholder iCloud')
    ap.add_argument('--tenant', required=True)
    ap.add_argument('--emit', help='carpeta donde escribir los SQL (0700); sin esto y sin --execute no se escribe nada')
    ap.add_argument('--execute', action='store_true')
    ap.add_argument('--no-resolve', action='store_true', help='no resolver mensaje/conversacion (solo blobs y links)')
    ap.add_argument('--reg-receipts', help='carpeta del recibo del registro (obligatoria con --execute)')
    ap.add_argument('--project-ref-file', default=os.path.join(HERE, '..', '..', 'supabase', '.temp', 'project-ref'))
    ap.add_argument('--sql-cmd', default=' '.join(lote.DEFAULT_SQL_CMD))
    a = ap.parse_args(argv)
    if not lote.UUID_RE.match(a.tenant):
        print('--tenant debe ser uuid', file=sys.stderr); return 2
    plan = json.load(open(a.plan))
    refs, conflicts = {}, 0
    if a.links_csv:
        try:
            refs, conflicts = read_links_csv(a.links_csv, a.allow_hydrate)
        except lote.Abort as e:
            print(e, file=sys.stderr); return 3
    receipts = read_receipts(a.receipts)
    blobs, links, s = build(plan, receipts, refs)
    s['csv_rows'] = len(refs); s['csv_conflicts'] = conflicts
    print(json.dumps({'modo': 'EJECUCION' if a.execute else ('EMIT' if a.emit else 'DRY-RUN (sin escritura)'), **s}, sort_keys=True))
    if not (a.emit or a.execute):
        return 0
    files = files_for(a.tenant, blobs, links, resolve=not a.no_resolve)
    if a.emit:
        os.makedirs(a.emit, mode=0o700, exist_ok=True)
        for name, sql in files:
            fd = os.open(os.path.join(a.emit, name), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as fh:
                fh.write(sql)
        for name, sql in (('00-guarda.sql', lote.guard_sql(a.tenant)), ('99-verificar.sql', verify_sql(a.tenant))):
            fd = os.open(os.path.join(a.emit, name), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as fh:
                fh.write(sql)
        print('SQL escritos en', a.emit, '(%d archivos)' % (len(files) + 2))
    if not a.execute:
        return 0
    if not a.reg_receipts:
        print('--execute requiere --reg-receipts', file=sys.stderr); return 2
    if not lote.project_ok(a.project_ref_file):
        print('GUARDA: PROJECT_MISMATCH', file=sys.stderr); return 3
    cmd = a.sql_cmd.split()
    ok, out = lote.run_sql_text(cmd, lote.guard_sql(a.tenant))
    why = lote.parse_guard(out) if ok else 'GUARD_CONSULTA_FALLO'
    if why:
        print('GUARDA:', why, file=sys.stderr); return 3
    os.makedirs(a.reg_receipts, mode=0o700, exist_ok=True)
    rpath = os.path.join(a.reg_receipts, 'registro.jsonl')
    done = set()
    if os.path.exists(rpath):
        for ln in open(rpath):
            try:
                r = json.loads(ln)
            except ValueError:
                continue
            if r.get('status') == 'ok':
                done.add(r['step'])
    for name, sql in files:
        step = '%s@%s' % (name, hashlib.sha256(sql.encode()).hexdigest()[:16])   # un cambio de contenido vuelve a ejecutar el paso
        if step in done and not name.startswith('90-'):
            continue
        ok, out = lote.run_sql_text(cmd, sql)
        lote.append_receipt(rpath, {'step': step, 'status': 'ok' if ok else 'error', 'ts': int(time.time())})
        if not ok:
            codes = [c for c in ('statement timeout', 'violates', 'row-level security') if c in out]
            print('ERROR en %s %s' % (name, codes), file=sys.stderr); return 1
    ok, out = lote.run_sql_text(cmd, verify_sql(a.tenant))
    v = parse_verify(out) if ok else None
    print(json.dumps({'verificacion': v}, sort_keys=True))
    if not v or v['blobs'] < len(blobs) or v['links'] < len(links):
        print('VERIFICACION_FALLIDA', file=sys.stderr); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
