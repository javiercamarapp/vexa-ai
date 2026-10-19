// CSV mínimo RFC 4180 (comillas dobles, saltos de línea dentro de campos, BOM). Sin dependencias. Solo lectura de texto.
// Devuelve { header, rows } donde cada fila es un objeto { columna: valor }. Falla si una fila no tiene exactamente las columnas del encabezado.
export class CsvError extends Error { constructor(code, detail) { super(code + (detail ? ': ' + detail : '')); this.name = 'CsvError'; this.code = code; } }
export function parseCsv(text) {
  if (typeof text !== 'string') throw new CsvError('CSV_NOT_TEXT');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const records = []; let field = '', record = [], i = 0, inQuotes = false, any = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { inQuotes = true; any = true; i++; continue; }
    if (c === ',') { record.push(field); field = ''; any = true; i++; continue; }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      i++;
      if (any || field !== '' || record.length) { record.push(field); records.push(record); }
      record = []; field = ''; any = false; continue;
    }
    field += c; any = true; i++;
  }
  if (inQuotes) throw new CsvError('CSV_UNTERMINATED_QUOTE');
  if (any || field !== '' || record.length) { record.push(field); records.push(record); }
  if (!records.length) throw new CsvError('CSV_EMPTY');
  const header = records[0];
  if (new Set(header).size !== header.length) throw new CsvError('CSV_DUPLICATE_HEADER');
  const rows = [];
  for (let r = 1; r < records.length; r++) {
    if (records[r].length !== header.length) throw new CsvError('CSV_BAD_COLUMN_COUNT', 'record ' + (r + 1));
    const o = {}; for (let k = 0; k < header.length; k++) o[header[k]] = records[r][k];
    rows.push(o);
  }
  return { header, rows };
}
