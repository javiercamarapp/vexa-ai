"""Exhaustive local reconciliation against the original CSV population.

Receives the exact package-manifest bytes consumed by the Node validator on stdin.
Only aggregate results or fixed error codes leave this process.
"""
import collections,csv,hashlib,io,json,re,sys
from pathlib import Path
from prepare_history import HEAD,REQUIRED,classify,identity,missing,row_hash


def ensure(ok,code):
    if not ok: raise ValueError(code)


def sha(data):return hashlib.sha256(data).hexdigest()


def package_path(root,name,kind):
    pattern=r'originals/[0-9]+\.csv' if kind=='original' else r'candidates/(?:gorgias|hubspot)-[0-9]+\.csv'
    ensure(isinstance(name,str) and re.fullmatch(pattern,name),'ARTIFACT_PATH')
    path=root/name
    ensure(path.resolve().is_relative_to(root.resolve()),'ARTIFACT_PATH')
    return path


def parsed_original(root,original,profile=None):
    # Hash and parse the SAME bytes on each pass, not another read of the path.
    data=package_path(root,original['path'],'original').read_bytes()
    ensure(sha(data)==original['sha256'] and len(data)==original['bytes'],'ORIGINAL_HASH')
    reader=csv.DictReader(io.StringIO(data.decode('utf-8-sig'),newline=''),strict=True)
    ensure(reader.fieldnames and len(set(reader.fieldnames))==len(reader.fieldnames) and REQUIRED<=set(reader.fieldnames),'ORIGINAL_SCHEMA')
    count=0
    for number,row in enumerate(reader,2):
        ensure(None not in row and None not in row.values(),'ORIGINAL_COLUMNS');count+=1
        yield number,row
    ensure(count==original['rows'],'ORIGINAL_ROWS')


def _validate(root,manifest):
    root=Path(root);ensure(manifest['version']=='history-csv-bridge-v1','VERSION')
    originals=manifest['originals']; ensure(originals and len({o['path'] for o in originals})==len(originals),'ORIGINAL_INVENTORY')
    identities=collections.Counter()
    for original in originals:
        for _,row in parsed_original(root,original):
            if not missing(row['message_id']):identities[identity(row)]+=1
    ledger_bytes=(root/'rows.jsonl').read_bytes();ensure(sha(ledger_bytes)==manifest['rows_sha256'],'LEDGER_HASH')
    ledger={}
    for line in ledger_bytes.decode('utf-8').splitlines():
        entry=json.loads(line);key=(entry['original'],entry['record_number'])
        ensure(key not in ledger,'LEDGER_DUPLICATE');ledger[key]=entry
    projected={};batch_paths=set()
    for batch in manifest['batches']:
        name=batch['path'];ensure(name not in batch_paths,'BATCH_DUPLICATE');batch_paths.add(name)
        ensure(batch['source'] in {'gorgias','hubspot'},'BATCH_SOURCE')
        data=package_path(root,name,'candidate').read_bytes()
        ensure(sha(data)==batch['sha256'] and len(data)==batch['bytes'] and len(data)<=20*1024*1024,'BATCH_HASH')
        reader=csv.reader(io.StringIO(data.decode('utf-8'),newline=''),strict=True)
        ensure(next(reader,None)==HEAD and reader.line_num==1,'BATCH_HEADER')
        count=0;physical_line=2
        for number,values in enumerate(reader,2):
            count+=1;ensure(len(values)==len(HEAD),'BATCH_COLUMNS')
            projected[(name,number)]={'values':values,'physical_line':physical_line,'source':batch['source']}
            physical_line=reader.line_num+1
        ensure(count==batch['rows'] and 0<count<=50000,'BATCH_ROWS')
    summary={'total':0,'candidate':0,'review':0,'by_source':{},'reasons':{}}
    reasons_count=collections.Counter();used=set()
    for original in originals:
        for number,row in parsed_original(root,original):
            entry=ledger.pop((original['path'],number),None);ensure(entry is not None,'LEDGER_COVERAGE')
            repeated=not missing(row['message_id']) and identities[identity(row)]>1
            reasons,role,ticket=classify(row,repeated,manifest.get('ingestion_profile'));route='review' if reasons else 'candidate';rh=row_hash(row);source=row['source']
            expected={'original':original['path'],'file_sha256':original['sha256'],'record_number':number,'row_sha256':rh,'body_sha256':sha(row['body_text'].encode()),'source':source,'route':route,'reasons':reasons}
            if route=='candidate':
                ref=entry.get('candidate');ensure(isinstance(ref,dict) and set(ref)=={'path','record_number','physical_line'},'PROJECTION_REF')
                key=(ref['path'],ref['record_number']);actual=projected.get(key)
                ensure(actual is not None and key not in used,'PROJECTION_REF');used.add(key)
                ensure(actual['physical_line']==ref['physical_line'] and actual['source']==source,'PROJECTION_POSITION')
                values=[row['message_id'],'sha256:'+rh,row['message_created_at'],row['body_text'],role,ticket,'' if missing(row['sku']) else row['sku'],'' if missing(row['order_id']) else row['order_id'],source,original['sha256'],str(number),rh,row['message_created_at'],row['direction'],row['author_role'],row['is_automation']]
                ensure(actual['values']==values,'PROJECTION_TRANSFORMATION')
                expected['candidate']=ref
            ensure(entry==expected,'LEDGER_ORIGINAL_MISMATCH')
            summary['total']+=1;summary[route]+=1;reasons_count.update(reasons)
            public_source=source if source in {'hubspot','gorgias'} else 'unknown'
            group=summary['by_source'].setdefault(public_source,{'total':0,'candidate':0,'review':0,'reasons':{}})
            group['total']+=1;group[route]+=1
            for reason in reasons:group['reasons'][reason]=group['reasons'].get(reason,0)+1
    summary['reasons']=dict(sorted(reasons_count.items()))
    ensure(not ledger,'LEDGER_EXTRA');ensure(len(used)==len(projected),'PROJECTION_COVERAGE');ensure(summary==manifest['summary'],'SUMMARY_ORIGINAL_MISMATCH')
    return {'status':'original-population-and-projection-reconciled','originals':len(originals),'summary':summary}


def validate(root,manifest):
    previous_limit=csv.field_size_limit()
    if manifest.get('ingestion_profile'):csv.field_size_limit(20*1024*1024)
    try:return _validate(root,manifest)
    finally:csv.field_size_limit(previous_limit)


if __name__=='__main__':
    try:
        manifest=json.loads(sys.stdin.buffer.read());result=validate(sys.argv[1],manifest);print(json.dumps(result))
    except Exception as error:
        code=str(error) if isinstance(error,ValueError) and re.fullmatch('[A-Z_]+',str(error)) else 'PROVENANCE_VALIDATION_FAILED'
        print(json.dumps({'status':'failed','code':code}));raise SystemExit(1)
