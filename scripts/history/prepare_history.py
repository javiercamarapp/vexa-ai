"""Offline, conservative historical package. No database/network/tenant assignment."""
import argparse, collections, csv, datetime, hashlib, io, json, os, re, shutil, unicodedata
from pathlib import Path

VERSION = 'history-csv-bridge-v1'
MISSING = {'', 'pending', 'not applicable', 'n/a', 'na', 'null', 'none', 'unknown'}
HEAD = ['external_id','source_revision','occurred_at','text','role','conversation_id','sku','order_id','origin_source','origin_file_sha256','origin_record_number','origin_row_sha256','origin_timestamp','origin_direction','origin_author_role','origin_is_automation']
REQUIRED = {'source','gorgias_ticket_id','hubspot_ticket_id','message_id','message_created_at','body_text','direction','author_role','is_automation','sku','order_id'}

def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024), b''): h.update(b)
    return h.hexdigest()

def row_hash(row):
    return hashlib.sha256(json.dumps(row,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def missing(value): return value.strip().lower() in MISSING

def valid_id(value): return not missing(value) and len(value)<=4096 and not re.search(r'[\x00-\x1f]',value)

def rows(path,profile=None):
    previous_limit=csv.field_size_limit()
    if profile:csv.field_size_limit(20*1024*1024)
    try:
        with Path(path).open(encoding='utf-8-sig',newline='') as f:
            reader=csv.DictReader(f,strict=True)
            if not reader.fieldnames or len(set(reader.fieldnames))!=len(reader.fieldnames) or not REQUIRED<=set(reader.fieldnames): raise ValueError('SOURCE_SCHEMA')
            for number,row in enumerate(reader,2):
                if None in row or None in row.values(): raise ValueError('SOURCE_COLUMNS')
                yield number,row
    finally:
        csv.field_size_limit(previous_limit)

def identity(row): return row['source'],row['message_id']

def classify(row, repeated=False, profile=None):
    if profile not in {None,'history-message-v1'}:raise ValueError('INVALID_INGESTION_PROFILE')
    reasons=[]; source=row['source']; stamp=row['message_created_at']; text=row['body_text']; role=None
    ticket=row.get(source+'_ticket_id','') if source in {'hubspot','gorgias'} else ''
    if source not in {'hubspot','gorgias'}: reasons.append('SOURCE_UNKNOWN')
    if not valid_id(row['message_id']): reasons.append('MESSAGE_ID_MISSING_OR_INVALID')
    if not valid_id(ticket): reasons.append('TICKET_ID_MISSING_OR_INVALID')
    if repeated: reasons.append('REPEATED_SOURCE_MESSAGE_ID')
    if not text.strip(): reasons.append('EMPTY_BODY')
    if profile:
        if max(len(text.encode('utf-16-le')),len(unicodedata.normalize('NFC',text).encode('utf-16-le')))>200000:reasons.append('BODY_ANALYSIS_LIMIT')
    elif len(unicodedata.normalize('NFC',text))>2000: reasons.append('BODY_OVER_2000')
    if '\x00' in text or '\r' in text: reasons.append('BODY_CONTROL_REQUIRES_REVIEW')
    if row['is_automation']!='false': reasons.append('AUTOMATION_REQUIRES_METADATA_CONTRACT')
    direction=row['direction']; author=row['author_role']
    if direction=='internal_note': role='internal'
    elif direction in {'agent','customer'} and author==direction: role=direction
    else: reasons.append('DIRECTION_AUTHOR_REQUIRES_REVIEW')
    match=re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d+))?(?:Z|[+-]\d{2}:\d{2})',stamp)
    if not match: reasons.append('TIMESTAMP_INVALID')
    elif len(match[1] or '')>(6 if profile else 3): reasons.append('TIMESTAMP_PRECISION_CONTRACT')
    else:
        try:
            dt=datetime.datetime.fromisoformat(stamp.replace('Z','+00:00'))
            if dt.year<1000: raise ValueError()
            offset=re.search(r'[+-](\d{2}):(\d{2})$',stamp)
            if profile and offset and (int(offset[1])>23 or int(offset[2])>59):raise ValueError()
            if profile and dt.astimezone(datetime.timezone.utc).year<1000:raise ValueError()
        except (ValueError,OverflowError): reasons.append('TIMESTAMP_INVALID')
    return reasons,role,ticket

def csv_bytes(values):
    stream=io.StringIO(newline=''); csv.writer(stream,lineterminator='\n').writerow(values); return stream.getvalue().encode()

class Batches:
    def __init__(self,dest,max_bytes,max_rows): self.dest=dest; self.max_bytes=max_bytes; self.max_rows=max_rows; self.active={}; self.finished=[]
    def add(self,source,values):
        data=csv_bytes(values); header=csv_bytes(HEAD)
        if len(header)+len(data)>self.max_bytes: raise ValueError('PROJECTION_ROW_EXCEEDS_BATCH')
        state=self.active.get(source)
        if state and (state['rows']>=self.max_rows or state['bytes']+len(data)>self.max_bytes): self.close(source); state=None
        if state is None:
            name=f'{source}-{sum(x["source"]==source for x in self.finished)+1:04}.csv'; p=self.dest/name
            state={'path':f'candidates/{name}','source':source,'rows':0,'bytes':len(header),'physical_line':2,'handle':p.open('xb')};state['handle'].write(header);self.active[source]=state
        ref={'path':state['path'],'record_number':state['rows']+2,'physical_line':state['physical_line']}
        state['handle'].write(data); state['bytes']+=len(data);state['rows']+=1;state['physical_line']+=data.count(b'\n')
        return ref
    def close(self,source):
        state=self.active.pop(source);state.pop('handle').close();state.pop('physical_line');state['sha256']=digest(self.dest/Path(state['path']).name);self.finished.append(state)
    def finish(self):
        for source in list(self.active): self.close(source)
        return self.finished

def prepare(manifest_path,output,max_bytes=20*1024*1024,max_rows=50000,profile=None):
    if profile not in {None,'history-message-v1'}:raise ValueError('INVALID_INGESTION_PROFILE')
    if not 1<=max_rows<=50000 or not 1<=max_bytes<=20*1024*1024: raise ValueError('LIMIT_RANGE')
    manifest_bytes=Path(manifest_path).read_bytes(); manifest=json.loads(manifest_bytes); manifest_hash=hashlib.sha256(manifest_bytes).hexdigest(); sources=[s for s in manifest['sources'] if s['category']=='conversations']
    if not sources: raise ValueError('NO_HISTORY_SOURCES')
    dest=Path(output); dest.mkdir(mode=0o700,parents=True,exist_ok=False)
    (dest/'originals').mkdir();(dest/'candidates').mkdir(); counts=collections.Counter(); files=[]
    # Read only explicit conversation CSV allowlist; never walk Downloads or credentials.
    for i,source in enumerate(sources,1):
        path=Path(source['source'])
        if path.suffix.lower()!='.csv' or not path.is_file() or path.stat().st_size==0: raise ValueError('SOURCE_NOT_MATERIALIZED_CSV')
        if digest(path)!=source['sha256'] or path.stat().st_size!=source['bytes']: raise ValueError('SOURCE_HASH_MISMATCH')
        copy=dest/'originals'/f'{i:02}.csv';shutil.copyfile(path,copy)
        if digest(copy)!=source['sha256'] or digest(path)!=source['sha256']: raise ValueError('SOURCE_CHANGED')
        copy.chmod(0o400); n=0
        for _,row in rows(copy,profile):
            n+=1
            if not missing(row['message_id']): counts[identity(row)]+=1
        if n!=source['rows']: raise ValueError('SOURCE_ROW_COUNT_MISMATCH')
        files.append({'path':f'originals/{copy.name}','source_path':str(path),'sha256':source['sha256'],'bytes':source['bytes'],'rows':n})
    batches=Batches(dest/'candidates',max_bytes,max_rows); summary={'total':0,'candidate':0,'review':0,'by_source':{},'reasons':{}}; reasons_count=collections.Counter()
    with (dest/'rows.jsonl').open('x',encoding='utf-8') as ledger:
        for file in files:
            for number,row in rows(dest/file['path'],profile):
                repeated=not missing(row['message_id']) and counts[identity(row)]>1
                reasons,role,ticket=classify(row,repeated,profile); rh=row_hash(row); source=row['source']; route='review' if reasons else 'candidate'
                item={'original':file['path'],'file_sha256':file['sha256'],'record_number':number,'row_sha256':rh,'body_sha256':hashlib.sha256(row['body_text'].encode()).hexdigest(),'source':source,'route':route,'reasons':reasons}
                if not reasons:
                    # This digest is a local source-row revision, never a provider revision or ID.
                    values=[row['message_id'],'sha256:'+rh,row['message_created_at'],row['body_text'],role,ticket,'' if missing(row['sku']) else row['sku'],'' if missing(row['order_id']) else row['order_id'],source,file['sha256'],str(number),rh,row['message_created_at'],row['direction'],row['author_role'],row['is_automation']]
                    item['candidate']=batches.add(source,values)
                ledger.write(json.dumps(item,separators=(',',':'))+'\n');summary['total']+=1;summary[route]+=1;reasons_count.update(reasons)
                public_source=source if source in {'hubspot','gorgias'} else 'unknown'
                group=summary['by_source'].setdefault(public_source,{'total':0,'candidate':0,'review':0,'reasons':{}});group['total']+=1;group[route]+=1
                for reason in reasons:group['reasons'][reason]=group['reasons'].get(reason,0)+1
    summary['reasons']=dict(sorted(reasons_count.items())); artifacts=batches.finish()
    result={'version':VERSION,'status':'prepared-local-not-imported','input_manifest_sha256':manifest_hash,'originals':files,'batches':artifacts,'rows_sha256':digest(dest/'rows.jsonl'),'summary':summary,'projection':{'identity':'original message_id; separate authorized CSV connection/account per origin source required','source_revision':'sha256 of original row, not provider revision','timestamps':'unchanged; >3 fractional digits review','text':'original CSV field; canonical product NFC; full original bytes retained','finance':'no amount or currency columns; no economic events','scope':'no tenant/connection/account assignment; synthetic context only for validation'}}
    if profile:
        result['ingestion_profile']=profile
        result['projection']['timestamps']='original lexeme retained; opted-in runtime derives floor-ms with exact microsecond metadata'
        result['projection']['text']='intact; raw and NFC <=100000 UTF16; larger remains review BODY_ANALYSIS_LIMIT; no analysis-readiness claim'
    (dest/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n'); return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--manifest',required=True);parser.add_argument('--output',required=True);parser.add_argument('--profile',choices=['history-message-v1']);args=parser.parse_args()
    try:
        result=prepare(args.manifest,args.output,profile=args.profile);print(json.dumps({'status':result['status'],'summary':result['summary'],'batches':len(result['batches'])}))
    except Exception as exc:
        # No source contents or paths in stdout/stderr. Incomplete output is never a ready manifest.
        print(json.dumps({'status':'failed','code':str(exc) if isinstance(exc,ValueError) and re.fullmatch('[A-Z_]+',str(exc)) else type(exc).__name__}));raise SystemExit(1)
