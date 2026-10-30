// Fixtures SINTETICAS del cargador de archivos de miembros (F4). Ningun dato real: SKU/pedidos/seguimientos son inventados (prefijo SYN).
import {crc32} from 'node:zlib';
export const NOW = '2026-10-29T12:00:00.000Z';
const csv = rows => rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? `"${String(c).replaceAll('"', '""')}"` : String(c)).join(',')).join('\n') + '\n';
export const toBytes = text => new TextEncoder().encode(text);
export const salesCsv = (rows = [['SYN-A', '2026-09-01', '3', '45.50'], ['SYN-B', '2026-09-02', '1', '10.00'], ['SYN-A', '2026-10-05', '2', '30.25']], head = ['SKU', 'Date', 'Units Sold', 'Gross Sales']) => toBytes(csv([head, ...rows]));
export const salesCsvEs = () => toBytes(csv([['SKU del producto', 'Fecha de venta', 'Unidades vendidas', 'Ventas brutas', 'Moneda', 'Canal'], ['SYN-A', '2026-09-01', '3', '45.50', 'USD', 'amazon'], ['SYN-C', '2026-09-03', '4', '99.99', 'USD', 'walmart']]));
export const ordersCsv = rows => toBytes(csv([['Order ID', 'Order Date', 'SKU', 'Quantity', 'Unit Price', 'Currency', 'Marketplace'], ...(rows ?? [['SYN-O-1', '2026-09-10', 'SYN-A', '3', '12.50', 'USD', 'amazon'], ['SYN-O-2', '2026-09-11', 'SYN-B', '1', '7.00', 'USD', 'walmart']])]));
export const returnsCsv = rows => toBytes(csv([['Order ID', 'Return request date', 'Merchant SKU', 'Return quantity', 'Return Reason', 'Refunded Amount', 'Amazon RMA ID', 'Return request status'], ...(rows ?? [['SYN-O-1', '2026-09-20', 'SYN-A', '1', 'CR-DEFECTIVE', '12.50', 'SYN-R1', 'Approved'], ['SYN-O-2', '2026-09-21', 'SYN-B', '1', 'CR-UNWANTED_ITEM', '', '', 'PendingApproval']])]));
export const reviewsCsv = rows => toBytes(csv([['Review ID', 'Review Date', 'Rating', 'ASIN', 'Review Text'], ...(rows ?? [['SYN-V1', '2026-09-15', '5', 'SYN-A', 'SYN texto de resena uno'], ['SYN-V2', '2026-09-16', '2', 'SYN-A', 'SYN texto de resena dos'], ['SYN-V3', '2026-09-17', '4', 'SYN-B', '']])]));
export const speedshipCsv = rows => toBytes(csv([['Destination Company Name', 'Carrier', 'Created Date', 'PRO/Tracking#', 'Service Level', 'Quoted Amount', 'Ship Date', 'Reference 1', 'Reference 2', 'Receiver Zip', 'Receiver Address Line1'], ...(rows ?? [['SYN-DEST-1', 'UNITED PARCEL SERVICE', '2026-09-01', 'SYN-TRK-1', 'UPS Ground', '19.00', '2026-09-01', 'SYN-O-1', 'SO100001', '12345', 'SYN CALLE 1'], ['SYN-DEST-2', 'UNITED PARCEL SERVICE', '2026-09-02', 'SYN-TRK-2', 'UPS Ground', '', '2026-09-02', 'SYN-O-2', 'SO100002', '12345', 'SYN CALLE 2'], ['SYN-DEST-3', 'UNITED PARCEL SERVICE', '2026-09-02', 'SYN-TRK-2', 'UPS Ground', '4.00', '2026-09-02', 'SYN-O-2', 'SO100003', '12345', 'SYN CALLE 2']])]));

// XLSX minimo (ZIP "stored", sin compresion) con una hoja; `rows` = arreglo de arreglos de string|number|null.
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const colName = i => String.fromCharCode(65 + i);
function zip(parts) {
  let offset = 0; const local = [], central = [];
  for (const [name, text] of parts) {
    const n = Buffer.from(name), b = Buffer.from(text), c = crc32(b);
    const h = Buffer.alloc(30), d = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt32LE(c, 14); h.writeUInt32LE(b.length, 18); h.writeUInt32LE(b.length, 22); h.writeUInt16LE(n.length, 26);
    d.writeUInt32LE(0x02014b50); d.writeUInt16LE(20, 4); d.writeUInt16LE(20, 6); d.writeUInt32LE(c, 16); d.writeUInt32LE(b.length, 20); d.writeUInt32LE(b.length, 24); d.writeUInt16LE(n.length, 28); d.writeUInt32LE(offset, 42);
    local.push(h, n, b); central.push(d, n); offset += 30 + n.length + b.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(parts.length, 8); end.writeUInt16LE(parts.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, cd, end]));
}
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
export function xlsx(rows, sheetName = 'Hoja1') {
  const sheet = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === null ? '' : typeof v === 'number' ? `<c r="${colName(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${colName(ci)}${ri + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`).join('');
  return zip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/s.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="book" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="s"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/s.xml"/></Relationships>'],
    ['xl/worksheets/s.xml', `<worksheet xmlns="${ns}"><sheetData>${sheet}</sheetData></worksheet>`],
  ]);
}
