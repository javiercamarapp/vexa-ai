#!/usr/bin/env python3
"""Genera el plan de lotes de adjuntos a partir del manifiesto privado.

Solo lee el manifiesto JSON (contentReads:0). No toca los archivos de adjuntos,
no usa red. Salida: plan JSON (0600) con rutas locales (necesarias para el lote)
y un resumen con solo conteos/bytes/extensiones.
"""
import argparse, json, os, sys, collections

GIB = 1024 ** 3
MIB = 1024 ** 2
DOC = {'.pdf','.eml','.xlsx','.xls','.docx','.doc','.txt','.csv','.pptx','.ppt','.rtf','.html','.htm','.json','.xml','.md','.msg','.ics','.vcf'}
IMG = {'.jpg','.jpeg','.png','.heic','.gif','.webp','.tif','.tiff','.bmp'}
VID = {'.mov','.mp4','.m4v','.avi','.mkv','.webm','.mp3','.m4a','.wav','.aac','.3gp'}


def categoria(ext):
    return 0 if ext in DOC else 1 if ext in IMG else 2 if ext in VID else 0


def ext_of(path):
    return os.path.splitext(path)[1].lower() or '(sin)'


def build(manifest, batch_bytes, object_limit):
    blobs = manifest['blobs']
    canon, dupmap, oversize, items = [], [], [], []
    for b in blobs:
        srcs = sorted(b['sources'], key=lambda s: (s['family'], s['fileId']))
        c = srcs[0]
        for s in srcs:
            if s['sha256'] != b['sha256'] or s['bytes'] != b['bytes']:
                raise SystemExit('manifiesto inconsistente en un blob (hash/bytes de origen distinto)')
        ext = ext_of(c['localPath'])
        it = {'sha256': b['sha256'], 'bytes': b['bytes'], 'ext': ext, 'cat': categoria(ext),
              'object_key': 'attachments/%s/%s' % (b['sha256'][:2], b['sha256']),
              'canonical': {'family': c['family'], 'fileId': c['fileId'], 'localPath': c['localPath']},
              'sources': [{'family': s['family'], 'fileId': s['fileId']} for s in srcs]}
        for s in srcs[1:]:
            dupmap.append({'family': s['family'], 'fileId': s['fileId'], 'bytes': s['bytes'],
                           'sha256': b['sha256'], 'canonical_fileId': c['fileId'],
                           'canonical_family': c['family'], 'object_key': it['object_key']})
        items.append(it)
    items.sort(key=lambda i: (i['cat'], i['bytes'], i['sha256']))
    big = [i for i in items if i['bytes'] > object_limit]
    ok = [i for i in items if i['bytes'] <= object_limit]
    batches, cur, curb = [], [], 0
    for i in ok:
        if cur and curb + i['bytes'] > batch_bytes:
            batches.append(cur); cur, curb = [], 0
        cur.append(i); curb += i['bytes']
    if cur:
        batches.append(cur)
    out_batches = []
    for n, bl in enumerate(batches, 1):
        out_batches.append({'batch': n, 'objects': len(bl), 'bytes': sum(i['bytes'] for i in bl), 'items': bl})
    return out_batches, dupmap, big, items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--out', required=True, help='plan JSON de salida (0600)')
    ap.add_argument('--batch-bytes', type=int, default=2 * GIB)
    ap.add_argument('--object-limit', type=int, default=50 * MIB,
                    help='limite por objeto de Storage (defecto 50 MiB = global Free; subir si el plan lo permite)')
    a = ap.parse_args()
    m = json.load(open(a.manifest))
    batches, dupmap, big, items = build(m, a.batch_bytes, a.object_limit)
    nb = sum(b['objects'] for b in batches); bb = sum(b['bytes'] for b in batches)
    totals = {
        'source_files': m['sourceFileCount'], 'logical_bytes': m['logicalBytes'],
        'unique_objects': len(items), 'unique_bytes': sum(i['bytes'] for i in items),
        'duplicate_files': len(dupmap), 'duplicate_bytes': sum(d['bytes'] for d in dupmap),
        'batches': len(batches), 'batched_objects': nb, 'batched_bytes': bb,
        'oversize_objects': len(big), 'oversize_bytes': sum(i['bytes'] for i in big),
        'batch_bytes_limit': a.batch_bytes, 'object_limit': a.object_limit,
    }
    # invariantes exactas
    assert totals['unique_objects'] == m['uniqueContentCount'], 'unicos != manifiesto'
    assert totals['unique_bytes'] == m['uniqueContentBytes'], 'bytes unicos != manifiesto'
    assert totals['unique_objects'] + totals['duplicate_files'] == totals['source_files'], 'cuenta de origenes'
    assert totals['unique_bytes'] + totals['duplicate_bytes'] == totals['logical_bytes'], 'bytes logicos'
    assert nb + totals['oversize_objects'] == totals['unique_objects']
    assert bb + totals['oversize_bytes'] == totals['unique_bytes']
    assert all(b['bytes'] <= a.batch_bytes or b['objects'] == 1 for b in batches)
    by_ext = collections.Counter(); by_ext_b = collections.Counter()
    for i in items:
        by_ext[i['ext']] += 1; by_ext_b[i['ext']] += i['bytes']
    plan = {
        'schema': 'vexa-attachment-ingest-plan-v1', 'totals': totals,
        'decisions': {'oversize': {
            'status': 'PENDIENTE (Javier)',
            'options': ['A: subir en trozos (resumable TUS / multipart) tras subir el limite del bucket',
                        'B: registrar sin subir (estado metadata_only, ruta original conservada)',
                        'C: subir el limite de objeto del bucket al maximo del plan (recomendado si el plan Pro lo permite) y tratarlos como objetos normales'],
            'default_applied': 'ninguna: los objetos grandes quedan FUERA de los lotes hasta decidir'}},
        'oversize': [{k: i[k] for k in ('sha256', 'bytes', 'ext', 'object_key', 'canonical')} | {'sources': i['sources']} for i in big],
        'duplicates': dupmap, 'batches': batches}
    fd = os.open(a.out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(plan, f)
    os.chmod(a.out, 0o600)
    print(json.dumps({'totals': totals,
                      'por_extension': {k: [by_ext[k], by_ext_b[k]] for k, _ in by_ext.most_common(12)},
                      'lotes': [[b['batch'], b['objects'], b['bytes']] for b in batches]}, indent=1))


if __name__ == '__main__':
    main()
