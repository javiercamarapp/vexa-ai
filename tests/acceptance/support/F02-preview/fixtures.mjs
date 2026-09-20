// Independently authored SYNTHETIC fixtures, CC0. No customer payloads.
import {zip} from '../F02/xlsx.mjs';
export const context={tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222',source:'csv',source_account_id:'SYNTHETIC-PREVIEW'};
export const mapping={columns:{id:'id',text:'text',date:'date',amount:'amount',currency:'currency',customer:null,order:null,sku:null},timezone:'UTC',dateFormat:'iso',currency:null};
export const options={context,observedAt:'2026-09-20T10:29:00-06:00',contentType:'text/csv',mapping,sampleLimit:20};
export const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
export function csv(rows=[['SYN-1','SYNTHETIC <img src=x onerror=alert(1)>','2026-02-01T12:34:56Z','10.01','USD']],headers=['id','text','date','amount','currency']){return Buffer.from([headers,...rows].map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n');}
export function row(overrides={}){return Object.values({id:'SYN-1',text:'SYNTHETIC',date:'2026-02-01T00:00:00Z',amount:'10.01',currency:'USD',...overrides});}
export function xlsx(sheets=[{name:'SYN_A',rows:[['id','text','date','amount','currency'],row()]}]){
 const xml=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const main='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/package/2006/relationships',office='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 return zip([
 ['[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/s${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
 ['_rels/.rels',`<Relationships xmlns="${rel}"><Relationship Id="root" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
 ['xl/workbook.xml',`<workbook xmlns="${main}" xmlns:r="${office}"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="r${i}"/>`).join('')}</sheets></workbook>`],
 ['xl/_rels/workbook.xml.rels',`<Relationships xmlns="${rel}">${sheets.map((_,i)=>`<Relationship Id="r${i}" Type="${office}/worksheet" Target="worksheets/s${i}.xml"/>`).join('')}</Relationships>`],
 ...sheets.map((s,i)=>[`xl/worksheets/s${i}.xml`,`<worksheet xmlns="${main}"><sheetData>${s.rows.map((r,n)=>`<row r="${n+1}">${r.map((v,c)=>`<c r="${String.fromCharCode(65+c)}${n+1}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`])]);
}
