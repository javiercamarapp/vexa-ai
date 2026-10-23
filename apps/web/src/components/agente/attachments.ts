// Adjuntos del chat: análisis 100 % LOCAL (en el navegador). El archivo nunca sale de la página: no se envía al servidor, al modelo ni a ningún
// servicio, no se guarda en el historial y no se mezcla con las cifras del corte publicado. Todo lo que de aquí sale se rotula
// «Dato aportado por el usuario» (no verificado). Solo CSV, TXT y JSON de hasta 1 MB.
export const ADJUNTO_MAX_BYTES = 1_000_000;
export const ADJUNTO_ACCEPT = '.csv,.txt,.json,text/csv,text/plain,application/json';
export const ADJUNTO_ROTULO = 'Dato aportado por el usuario';
const MAX_FILAS = 20_000, MAX_COLUMNAS = 40, MAX_PREVIEW = 5, MAX_TOP = 8;

export type ColumnaResumen = { identificador?: boolean; name: string; filled: number; missing: number; distinct: number; numeric: { n: number; min: number; max: number; sum: number; mean: number } | null; top: { value: string; count: number }[] };
export type AdjuntoResumen = {
 id: string; name: string; bytes: number; kind: 'csv' | 'json' | 'txt'; label: typeof ADJUNTO_ROTULO;
 rows: number | null; truncated: boolean; columns: ColumnaResumen[]; preview: string[][]; text: { lines: number; words: number; chars: number } | null;
 /** Columna de texto con pocos valores distintos, para una gráfica de frecuencias de LO QUE EL USUARIO APORTÓ. */
 freq: { column: string; rows: { value: string; count: number }[] } | null; notes: string[];
};
export type AdjuntoResultado = { ok: true; resumen: AdjuntoResumen } | { ok: false; error: string };

export function extensionOf(name: string): 'csv' | 'json' | 'txt' | null {
 const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
 return m && (m[1] === 'csv' || m[1] === 'json' || m[1] === 'txt') ? m[1] : null;
}
/** Validación previa a leer el archivo (extensión y tamaño). */
export function validarArchivo(name: string, size: number): string | null {
 if (!extensionOf(name)) return 'Solo puedo leer archivos CSV, TXT o JSON.';
 if (size === 0) return 'El archivo está vacío.';
 if (size > ADJUNTO_MAX_BYTES) return 'El archivo supera 1 MB.';
 return null;
}

/** Separador más probable según la primera línea (coma, punto y coma o tabulador), ignorando comillas. */
function detectDelimiter(head: string): string {
 const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }; let q = false;
 for (const ch of head) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
 return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [','])[0];
}
/** Parser CSV (RFC 4180): comillas dobles, saltos de línea dentro de comillas y BOM. */
export function parseCsv(input: string): { rows: string[][]; truncated: boolean } {
 const text = input.replace(/^﻿/, ''); const delim = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? '');
 const rows: string[][] = []; let row: string[] = [], cell = '', q = false, truncated = false;
 const endRow = () => { row.push(cell); cell = ''; if (row.length > 1 || row[0] !== '') rows.push(row.slice(0, MAX_COLUMNAS + 1)); row = []; };
 for (let i = 0; i < text.length; i++) {
  const ch = text[i];
  if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
  else if (ch === '"' && cell === '') q = true;
  else if (ch === delim) { row.push(cell); cell = ''; }
  else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); if (rows.length > MAX_FILAS) { truncated = true; break; } }
  else cell += ch;
 }
 if (!truncated && (cell !== '' || row.length)) endRow();
 return { rows: rows.slice(0, MAX_FILAS + 1), truncated };
}
/** Solo números sin símbolos de moneda: «$1,200» o «1.200,5» NO se interpretan (no se sabe la moneda ni la convención). */
export function toNumber(raw: string): number | null {
 const s = raw.trim(); if (!s) return null;
 if (/^-?\d+(\.\d+)?$/.test(s) || /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) { const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) ? n : null; }
 return null;
}
/** Columna identificadora: el nombre termina en id/_id (o es folio/uuid/identificador), o son enteros únicos y consecutivos. Sumarla o promediarla no significa nada. */
const NOMBRE_ID = /(^|[^a-z0-9])id([^a-z0-9]|$)|[a-z]id$|^(folio|uuid|guid|identificador|clave)$|(^|[_\s])(folio|uuid|identificador)([_\s]|$)/i;
export function esColumnaIdentificadora(name: string, values: number[], filled: number, distinct: number): boolean {
 if (NOMBRE_ID.test(name.trim())) return true;
 if (values.length < 5 || values.length !== filled || distinct !== filled || !values.every(Number.isInteger)) return false;
 const lo = Math.min(...values), hi = Math.max(...values);
 return hi - lo + 1 === values.length; // enteros únicos y consecutivos: un contador de filas, no una medida
}
function summarizeTable(header: string[], body: string[][]): { columns: ColumnaResumen[]; freq: AdjuntoResumen['freq'] } {
 const columns = header.slice(0, MAX_COLUMNAS).map((h, i) => {
  const name = (h.trim() || `Columna ${i + 1}`).slice(0, 60); let filled = 0, numericN = 0, sum = 0, min = Infinity, max = -Infinity;
  const counts = new Map<string, number>(); const nums: number[] = [];
  for (const r of body) {
   const v = (r[i] ?? '').trim(); if (!v) continue; filled++;
   const n = toNumber(v); if (n !== null) { numericN++; nums.push(n); sum += n; if (n < min) min = n; if (n > max) max = n; }
   if (counts.size < 5000 || counts.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const identificador = filled > 0 && numericN === filled && esColumnaIdentificadora(name, nums, filled, counts.size);
  const allNumeric = filled > 0 && numericN === filled && !identificador;
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, MAX_TOP).map(([value, count]) => ({ value: value.slice(0, 60), count }));
  return { ...(identificador ? { identificador: true } : {}), name, filled, missing: body.length - filled, distinct: counts.size, numeric: allNumeric ? { n: numericN, min, max, sum, mean: sum / numericN } : null, top } satisfies ColumnaResumen;
 });
 const cat = columns.find((c) => !c.numeric && c.filled >= 3 && c.distinct >= 2 && c.distinct <= 12);
 return { columns, freq: cat ? { column: cat.name, rows: cat.top } : null };
}
function fromRecords(records: Record<string, unknown>[]): { header: string[]; body: string[][] } {
 const header: string[] = [];
 for (const r of records.slice(0, 500)) for (const k of Object.keys(r)) if (!header.includes(k) && header.length < MAX_COLUMNAS) header.push(k);
 const cell = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v));
 return { header, body: records.map((r) => header.map((k) => cell(r[k]))) };
}

/** Lee y resume el texto de un adjunto. Sin red, sin modelo, determinista. */
export function analizarAdjunto(name: string, text: string, bytes: number, id = 'adj'): AdjuntoResultado {
 const kind = extensionOf(name); const bad = validarArchivo(name, bytes);
 if (bad || !kind) return { ok: false, error: bad ?? 'Formato no soportado.' };
 const base = { id, name: name.slice(0, 120), bytes, kind, label: ADJUNTO_ROTULO } as const;
 const notes = ['Analizado en tu navegador: el archivo no se envió a ningún servicio ni se guarda en el historial.'];
 if (kind === 'txt') {
  const lines = text.split(/\r?\n/); const nonEmpty = lines.filter((l) => l.trim());
  return { ok: true, resumen: { ...base, rows: null, truncated: false, columns: [], preview: nonEmpty.slice(0, MAX_PREVIEW).map((l) => [l.slice(0, 160)]), text: { lines: nonEmpty.length, words: (text.match(/\S+/g) ?? []).length, chars: text.length }, freq: null, notes } };
 }
 let header: string[], body: string[][], truncated = false;
 if (kind === 'csv') {
  const parsed = parseCsv(text); truncated = parsed.truncated;
  if (parsed.rows.length < 2) return { ok: false, error: 'El CSV necesita una fila de encabezados y al menos una fila de datos.' };
  [header, ...body] = parsed.rows;
 } else {
  let data: unknown; try { data = JSON.parse(text); } catch { return { ok: false, error: 'El JSON no es válido.' }; }
  const list = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : null;
  if (!list || !list.length || !list.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return { ok: false, error: 'Solo leo JSON con un objeto o una lista de objetos.' };
  if (list.length > MAX_FILAS) { truncated = true; }
  ({ header, body } = fromRecords((list as Record<string, unknown>[]).slice(0, MAX_FILAS)));
 }
 const { columns, freq } = summarizeTable(header, body);
 if (truncated) notes.push(`Solo se analizaron las primeras ${MAX_FILAS.toLocaleString('es-MX')} filas.`);
 if (header.length > MAX_COLUMNAS) notes.push(`Solo se analizaron las primeras ${MAX_COLUMNAS} columnas.`);
 notes.push('Las columnas con símbolos de moneda o separadores ambiguos se tratan como texto: no se suman ni se interpretan.');
 return { ok: true, resumen: { ...base, rows: body.length, truncated, columns, preview: [header.slice(0, 8).map((h) => h.slice(0, 40)), ...body.slice(0, MAX_PREVIEW).map((r) => r.slice(0, 8).map((c) => c.slice(0, 40)))], text: null, freq, notes } };
}

/** Lo único que se guarda del adjunto en el historial del navegador: que existió, sin su contenido. */
export const adjuntoSinContenido = (a: AdjuntoResumen): AdjuntoResumen => ({ ...a, columns: [], preview: [], freq: null, text: null, notes: ['El contenido del adjunto no se guarda en el historial; vuelve a cargarlo para analizarlo.'] });
