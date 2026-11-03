// Normalizador de Order ID y de retailer. La llave de unión es (order_key, retailer), nunca el ID solo.
// Debe mantenerse en paridad con public.order_id_normalize / public.order_retailer_normalize (migración 20261210000000).
const DASHES = /[‐-―−﹣－]/g;
const INVISIBLE = /[​-‍﻿]/g;
const PLACEHOLDERS = new Set(['NONE', 'NULL', 'NAN', 'TBD', 'UNKNOWN', 'NOORDER', 'NOTAPPLICABLE']);

export const ORDER_FORMATS = Object.freeze({
  amazon: /^\d{3}-\d{7}-\d{7}$/,
  bestbuy: /^\d{9,10}-[A-Z]$/,
  walmart: /^(?:1090|1290)\d{11}$/,
  prefijo2_digitos8: /^[A-Z]{2}\d{8}$/,
});

/** Devuelve la llave normalizada o null (sin ID válido: «sin ID», nunca cero ni cadena vacía). */
export function normalizeOrderId(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).normalize('NFKC').replace(INVISIBLE, '').replace(/ /g, ' ').replace(DASHES, '-').trim();
  if (!s) return null;
  s = s.replace(/^(?:reference|ref)\s*\d*\s*[-:=]\s*/i, '');
  s = s.replace(/^(?:order\s*(?:id|number|no|num)?|pedido)\s*[:#]\s*/i, '');
  s = s.toUpperCase().replace(/\s+/g, '');
  if (/^\d(?:\.\d+)?E\+\d+$/.test(s)) { const n = Number(s); if (Number.isSafeInteger(n)) s = String(n); }
  s = s.replace(/^(\d+)\.0+$/, '$1');
  s = s.replace(/-{2,}/g, '-').replace(/^[-#.,:;'"`]+|[-#.,:;'"`]+$/g, '');
  if (/^\d{17}$/.test(s)) s = `${s.slice(0, 3)}-${s.slice(3, 10)}-${s.slice(10)}`;
  if (s.length < 4 || s.length > 40 || !/^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/.test(s)) return null;
  if (PLACEHOLDERS.has(s) || /^0+$/.test(s.replace(/-/g, ''))) return null;
  return s;
}

/** Formato reconocido de una llave ya normalizada ('otro' si no coincide con ninguno). */
export function orderFormat(key) {
  if (!key) return null;
  for (const [name, re] of Object.entries(ORDER_FORMATS)) if (re.test(key)) return name;
  return 'otro';
}

/** Retailer canónico. Distintos nombres desconocidos NO se colapsan en «otro» (evita uniones falsas entre retailers). */
export function normalizeRetailer(raw) {
  if (raw === null || raw === undefined) return null;
  const k = String(raw).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!k) return null;
  if (k.startsWith('amazon') || k.startsWith('amz')) return 'amazon';
  if (k.startsWith('walmart')) return 'walmart';
  if (k.startsWith('bestbuy')) return 'bestbuy';
  if (k.startsWith('homedepot')) return 'homedepot';
  if (k.startsWith('lowes') || k === 'lowe') return 'lowes';
  return k.slice(0, 40);
}

/** Retailer inferido SOLO por formato inequívoco (para envíos, que no traen retailer). Ambiguo => null. */
export function retailerFromFormat(key) {
  const f = orderFormat(key);
  return f === 'amazon' || f === 'bestbuy' || f === 'walmart' ? f.replace('walmart', 'walmart') : null;
}
