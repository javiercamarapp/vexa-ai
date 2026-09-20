"""Reproducible SYNTHETIC openpyxl fixtures; never customer files."""
from pathlib import Path
import hashlib,io,json,zipfile
import openpyxl
from datetime import datetime
out=Path(__file__).parent/'writer-edge';out.mkdir(exist_ok=True)

def encode(data,change=None):
    dest=io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as src,zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
        for name in src.namelist():
            content=src.read(name)
            if name=='docProps/core.xml':
                import re
                content=re.sub(rb'(<dcterms:modified[^>]*>)[^<]*(</dcterms:modified>)',rb'\g<1>2020-01-01T00:00:00Z\2',content)
            if change and name=='xl/worksheets/sheet1.xml':content=change(content.decode()).encode()
            info=zipfile.ZipInfo(name,(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,content)
    return dest.getvalue()

def book(protected=False):
    w=openpyxl.Workbook();w.properties.created=w.properties.modified=datetime(2020,1,1)
    s=w.active;s.title='SYNTHETIC';s.append(['id','amount','message','customer']);s.append(['row-1','12.34','SYNTHETIC',''])
    if protected:s.protection.sheet=True;s.protection.set_password('synthetic')
    b=io.BytesIO();w.save(b);return encode(b.getvalue())

base=book();protection=book(True)
fixtures={'empty.xlsx':base,'protected.xlsx':protection}
fixtures['inline-value.xlsx']=encode(base,lambda s:s.replace('<c r="D2" t="inlineStr"></c>','<c r="D2" t="inlineStr"><v>12.34</v></c>').replace('<c r="D2" t="inlineStr"/>','<c r="D2" t="inlineStr"><v>12.34</v></c>').replace('<c r="D2" t="inlineStr" />','<c r="D2" t="inlineStr"><v>12.34</v></c>'))
import re
p=re.search(r'<sheetProtection\b[^>]*/>',zipfile.ZipFile(io.BytesIO(protection)).read('xl/worksheets/sheet1.xml').decode()).group(0)
changes={
 'protection-duplicate.xlsx':lambda s:s.replace(p,p+p),
 'protection-nested-cell.xlsx':lambda s:s.replace(p,p[:-2]+'><c r="A3"><v>99</v></c></sheetProtection>'),
 'protection-foreign.xlsx':lambda s:s.replace(p,p.replace('<sheetProtection','<q:sheetProtection xmlns:q="urn:foreign"')),
 'protection-bool.xlsx':lambda s:s.replace('sheet="1"','sheet="maybe"'),
 'protection-hash-group.xlsx':lambda s:s.replace(p,p[:-2]+' algorithmName="SHA-512"/>'),
 'protection-password.xlsx':lambda s:s.replace(p,re.sub(r'password="[^"]*"','password="not-hex"',p)),
}
for name,change in changes.items():fixtures[name]=encode(protection,change)
assert len(set(fixtures.values()))==len(fixtures),'Mutants must change bytes'
for name,data in fixtures.items():(out/name).write_bytes(data)
(out/'manifest.json').write_text(json.dumps({'data':'SYNTHETIC','writer':'openpyxl '+openpyxl.__version__,'sha256':{n:hashlib.sha256(d).hexdigest() for n,d in fixtures.items()}},indent=2)+'\n')
print('generated',len(fixtures),'SYNTHETIC writer edge fixtures')
