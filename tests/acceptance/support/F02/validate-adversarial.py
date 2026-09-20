"""Independent fixture proof. No extraction, URL access or external entity resolution."""
import sys, json, struct, zlib, binascii, hashlib, io, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
root=Path(sys.argv[1]); manifest=json.loads((root/'fixtures.json').read_text()); results=[]
S='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def inspect(b):
    end=len(b)-22; assert struct.unpack_from('<I',b,end)[0]==0x06054b50
    count=struct.unpack_from('<H',b,end+10)[0]; offset=struct.unpack_from('<I',b,end+16)[0]
    if count==65535:
        locator=end-20; assert struct.unpack_from('<I',b,locator)[0]==0x07064b50
        p=struct.unpack_from('<Q',b,locator+8)[0]; assert struct.unpack_from('<I',b,p)[0]==0x06064b50
        count=struct.unpack_from('<Q',b,p+32)[0]; offset=struct.unpack_from('<Q',b,p+48)[0]
    entries=[];p=offset
    for _ in range(count):
        assert struct.unpack_from('<I',b,p)[0]==0x02014b50
        method=struct.unpack_from('<H',b,p+10)[0]; crc,size,declared=struct.unpack_from('<III',b,p+16)
        nl,el,cl=struct.unpack_from('<HHH',b,p+28);local=struct.unpack_from('<I',b,p+42)[0]
        name=b[p+46:p+46+nl].decode();assert struct.unpack_from('<I',b,local)[0]==0x04034b50
        ln,le=struct.unpack_from('<HH',b,local+26);assert b[local+30:local+30+ln].decode()==name
        assert struct.unpack_from('<H',b,local+8)[0]==method
        assert struct.unpack_from('<III',b,local+14)==(crc,size,declared), 'UNINTENDED_HEADER_MISMATCH'
        start=local+30+ln+le;packed=b[start:start+size]
        if method==8:
            d=zlib.decompressobj(-15);raw=d.decompress(packed)+d.flush();assert d.eof and not d.unused_data
        else:assert method==0;raw=packed
        entries.append(dict(name=name,raw=raw,declared=declared,actual=len(raw),crc=crc,actual_crc=binascii.crc32(raw),method=method))
        p+=46+nl+el+cl
    return entries
for f in manifest:
    id=f['id'];good=(root/(id+'-good.xlsx')).read_bytes();bad=(root/(id+'-bad.xlsx')).read_bytes()
    assert hashlib.sha256(good).hexdigest()==f['goodHash'];assert hashlib.sha256(bad).hexdigest()==f['badHash']
    with zipfile.ZipFile(io.BytesIO(good)) as z:
        assert z.testzip() is None
        for n in z.namelist(): ET.fromstring(z.read(n))
        sheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml'));assert sheet.find('.//'+S+'c[@r="A1"]/'+S+'is/'+S+'t').text=='SYNTHETIC';assert sheet.find('.//'+S+'c[@r="B1"]/'+S+'v').text=='1001'
    gs=inspect(good);bs=inspect(bad);gd={e['name']:e for e in gs}
    size_case=id in ['declared-small','declared-large','actual-deflate-budget','actual-store-budget']
    for e in bs:
        if id=='crc' and e['name']=='xl/worksheets/sheet1.xml':assert e['crc']^e['actual_crc']==1
        else:assert e['crc']==e['actual_crc'], 'UNINTENDED_CRC_FAILURE'
        if size_case and e['name']=='padding.xml':assert e['declared']!=e['actual']
        else:assert e['declared']==e['actual'], 'UNINTENDED_SIZE_FAILURE'
    if id=='crc' or size_case:
        assert len(gs)==len(bs)
        for e in bs:assert e['raw']==gd[e['name']]['raw'], 'UNINTENDED_CONTENT_MUTATION'
    elif id=='duplicate' or id.startswith(('alias-','escape-')):
        assert len(bs)==len(gs)+1
        for a,b in zip(gs,bs):assert a==b, 'ORIGINAL_MEMBER_ALTERED'
        if id=='duplicate':assert bs[-1]['name']=='xl/worksheets/sheet1.xml' and b'OTHER' in bs[-1]['raw']
        else:assert bs[-1]['raw']==b'<synthetic/>' and bs[-1]['name'] not in gd
    elif id.startswith(('xml-','relationship-')):
        target='xl/worksheets/sheet1.xml' if id.startswith('xml-') else 'xl/_rels/workbook.xml.rels'
        assert len(gs)==len(bs)
        for e in bs:
            if e['name']!=target:assert e==gd[e['name']], 'UNRELATED_PART_ALTERED'
        changed=next(e['raw'].decode() for e in bs if e['name']==target)
        original=gd[target]['raw'].decode()
        if id.startswith('xml-dtd-'):
            assert changed.startswith('<!DOCTYPE worksheet [<!ENTITY synthetic ')
            repaired=changed.split(']>',1)[1].replace('&synthetic;','SYNTHETIC')
            assert repaired==original;ET.fromstring(repaired)
            if id=='xml-dtd-internal':assert ET.fromstring(changed).find('.//'+S+'c[@r="A1"]/'+S+'is/'+S+'t').text=='SYNTHETIC'
            elif id=='xml-dtd-external':assert 'https://example.invalid/never' in changed
            else:assert 'file:///__vexa_synthetic_never_exists__/fixture' in changed
        elif id=='xml-unknown-entity':assert changed.replace('&undefinedSynthetic;','SYNTHETIC')==original
        else:
            target_value='../../escape.xml' if id=='relationship-escape' else '%2e%2e/escape.xml'
            assert changed.replace(target_value,'worksheets/sheet1.xml')==original;ET.fromstring(changed)
    elif id=='zip64':
        assert gs==bs
        with zipfile.ZipFile(io.BytesIO(bad)) as z:assert z.testzip() is None and z.read('xl/worksheets/sheet1.xml')==gd['xl/worksheets/sheet1.xml']['raw']
    else:raise AssertionError('UNKNOWN_FIXTURE')
    actual=sum(e['actual'] for e in bs);declared=sum(e['declared'] for e in bs)
    if id.startswith('actual-'):assert declared<=f['limits']['maxExpandedBytes']<actual
    if id=='declared-small':assert declared<actual
    if id=='declared-large':assert declared>actual
    results.append(dict(id=id,goodHash=f['goodHash'],badHash=f['badHash'],actualExpanded=actual,declaredExpanded=declared,onlyTargetInvariantChanged=True,externalEntitiesResolved=False))
positive=(root/'positive-entities.xlsx').read_bytes()
with zipfile.ZipFile(io.BytesIO(positive)) as z:
    assert z.testzip() is None
    for name in z.namelist(): ET.fromstring(z.read(name))
    cell=ET.fromstring(z.read('xl/worksheets/sheet1.xml')).find('.//'+S+'c[@r="A1"]/'+S+'is/'+S+'t')
    assert cell.text=="A&B<C>\"'😀é"
print(json.dumps({'positiveEntitiesHash':hashlib.sha256(positive).hexdigest(),'controlOnly':True,'purpose':'independent fixture validation; not product','results':results},indent=2))
