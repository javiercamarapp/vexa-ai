"""CONTROL ONLY: independent stdlib ZIP/XML reader, never a product fallback.
Reads real bytes, CRC and namespace XPath. Restricted synthetic OOXML corpus.
Not a general Excel implementation: no styles/shared strings/ZIP64 promise.
"""
import sys, json, zipfile, io, xml.etree.ElementTree as ET
S = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/package/2006/relationships}'
O = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
class Rejection(Exception): pass

def read(data, cfg):
    reads=[]
    def reject(code): raise Rejection(code)
    try:
        if len(data)>cfg.get('maxBytes',20971520): reject('XLSX_LIMIT_BYTES')
        try: z=zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile: reject('XLSX_TRUNCATED')
        with z:
            infos=z.infolist()
            if sum(i.file_size for i in infos)>cfg.get('maxExpandedBytes',104857600): reject('XLSX_LIMIT_EXPANDED')
            def extract(name):
                reads.append(name)
                return z.read(name) # zipfile verifies actual deflate, size and CRC
            if any(i.filename.endswith('vbaProject.bin') for i in infos): reject('XLSX_MACROS')
            for i in infos:
                if i.filename.endswith('.rels'):
                    rel=ET.fromstring(extract(i.filename))
                    if any(r.get('TargetMode')=='External' for r in rel.findall(R+'Relationship')): reject('XLSX_EXTERNAL_LINK')
            root=ET.fromstring(extract('xl/workbook.xml'))
            sheets=root.findall(S+'sheets/'+S+'sheet')
            if len(sheets)>cfg.get('maxSheets',10): reject('XLSX_LIMIT_SHEETS')
            rels=ET.fromstring(extract('xl/_rels/workbook.xml.rels'))
            targets={r.get('Id'):r.get('Target') for r in rels.findall(R+'Relationship')}
            out=[]
            for sheet in sheets:
                xml=ET.fromstring(extract('xl/'+targets[sheet.get(O+'id')]))
                rows=[];errors=[]
                for row in xml.findall(S+'sheetData/'+S+'row'):
                    values=[];line=int(row.get('r'))
                    for cell in row.findall(S+'c'):
                        formula=cell.find(S+'f')
                        if formula is not None:
                            values.append(None);errors.append({'code':'XLSX_FORMULA','line':line,'field':cell.get('r')})
                        elif cell.get('t')=='inlineStr': values.append(''.join(t.text or '' for t in cell.findall(S+'is/'+S+'t')))
                        else: values.append(cell.findtext(S+'v'))
                    rows.append({'values':values,'line':line})
                out.append({'name':sheet.get('name'),'rows':rows,'errors':errors})
            # Validate CRC of every member, including unreferenced padding.
            for i in infos:
                if i.filename not in reads: extract(i.filename)
            return {'value':{'sheets':out},'reads':reads}
    except Rejection as error: return {'error':str(error),'reads':reads}

if __name__=='__main__':
    config=json.loads(sys.argv[2]) if len(sys.argv)>2 else {}
    print(json.dumps(read(open(sys.argv[1],'rb').read(),config)))
