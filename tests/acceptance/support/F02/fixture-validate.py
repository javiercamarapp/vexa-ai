"""Independent structural fixture validator; does NOT apply ingestion security policy."""
import sys,json,zipfile,xml.etree.ElementTree as E,hashlib,posixpath
S='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R='{http://schemas.openxmlformats.org/package/2006/relationships}'
O='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
p=sys.argv[1]
with zipfile.ZipFile(p) as z:
    assert z.testzip() is None, 'CRC'
    names=z.namelist(); assert len(names)==len(set(names)), 'UNIQUE_MEMBERS'
    for name in names:
        if name.endswith(('.xml','.rels')): E.fromstring(z.read(name))
    roots=E.fromstring(z.read('_rels/.rels')).findall(R+'Relationship')
    assert any(r.get('Target')=='xl/workbook.xml' for r in roots), 'PACKAGE_ROOT'
    rels=E.fromstring(z.read('xl/_rels/workbook.xml.rels')).findall(R+'Relationship')
    targets={r.get('Id'):r.get('Target') for r in rels}
    for rel in rels:
        if rel.get('TargetMode')!='External': assert posixpath.normpath('xl/'+rel.get('Target')) in names, 'REL_TARGET'
    sheets=E.fromstring(z.read('xl/workbook.xml')).findall(S+'sheets/'+S+'sheet')
    cells=[]
    for sheet in sheets:
        root=E.fromstring(z.read('xl/'+targets[sheet.get(O+'id')]))
        rows=root.findall(S+'sheetData/'+S+'row'); assert len(rows)==1 and rows[0].get('r')=='1'
        a=rows[0].find(S+'c[@r="A1"]/'+S+'is/'+S+'t'); b=rows[0].find(S+'c[@r="B1"]/'+S+'v')
        assert a is not None and b is not None, 'CELL_XPATH'
        cells.append([a.text,b.text])
    print(json.dumps({'sha256':hashlib.sha256(open(p,'rb').read()).hexdigest(),'sheets':len(sheets),'cells':cells,'expanded':sum(i.file_size for i in z.infolist()),'crc':'verified','relationships':'verified','xpath':'verified'}))
