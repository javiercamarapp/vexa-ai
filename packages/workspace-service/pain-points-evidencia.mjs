// «Puntos de dolor» (L3): EVIDENCIA hasta la fila + exportación CSV. Solo lectura bajo la RLS del usuario, SIN PII: cada fila sale por una LISTA BLANCA de columnas
// (fecha, canal, SKU base, estado, motivo/submotivo de catálogo cerrado, moneda, importe, referencia corta con hash, origen). Jamás salen nombres, correos, teléfonos, direcciones,
// números de orden/tracking/serie ni texto libre. Una fila del libro y una del Tracker se unen SOLO por SKU y mes en `cruce`, rotulado «no es la misma orden».
// Total verificable: la suma de TODAS las filas del filtro se compara con la cifra del punto de dolor (✓ coincide · ✗ difiere con la diferencia · — no se pudo comprobar).
import {WorkspaceError} from './contracts.mjs';
import {guarded} from './catalog-overview.mjs';
import {ESTADOS_NEGADOS, filaDeTracker, NOMBRE_CANAL} from './fuga-reembolsos.mjs';
import {createPainPointsRepository} from './pain-points.mjs';

export const EVIDENCIA_BUDGETS_MS = Object.freeze({pagina: 3000, total: 3000, tracker: 3000, cruce: 2500});
export const PAGINA = 50;
export const TOPE_CSV = 5000;
/** Lista blanca: lo que no está aquí no sale (ni en pantalla ni en CSV). */
export const COLUMNAS = Object.freeze([
  {key: 'fecha', label: 'Fecha'}, {key: 'canal', label: 'Canal'}, {key: 'sku', label: 'SKU'}, {key: 'estado', label: 'Estado'}, {key: 'motivo', label: 'Motivo'},
  {key: 'moneda', label: 'Moneda'}, {key: 'importeMinor', label: 'Importe (unidades menores)'}, {key: 'ref', label: 'Referencia'}, {key: 'origen', label: 'Origen'},
]);
export const COLUMNAS_PERMITIDAS = Object.freeze(COLUMNAS.map(c => c.key));
const ID = /^P(\d{1,2})(~[A-Za-z0-9._-]{1,60})?$/;
const SKU_RE = "(-WM[0-9]+|-[0-9]{3}A-[0-9]{3}|-NEW)$";
const CANAL_SQL = "CASE WHEN e.external_id LIKE 'amazon|%' THEN 'amazon' WHEN e.external_id LIKE 'walmart|%' THEN 'walmart' WHEN e.external_id LIKE 'gid://shopify/%' THEN 'shopify' WHEN e.external_id LIKE 'mirakl_bestbuy%' THEN 'bestbuy' ELSE 'otro' END";
const LIKE_CANAL = {amazon: 'amazon|%', walmart: 'walmart|%', shopify: 'gid://shopify/%', bestbuy: 'mirakl_bestbuy%'};
const ESTADO_LIBRO = {pending: 'Pendiente', settled: 'Liquidado', cancelled: 'Cancelado', unknown: 'Sin estado', recorded: 'Registrado'};
const NOMBRES_ESTADO_TRACKER = {reembolsado: 'Reembolsado', vencido: 'Vencido', no_reembolsable: 'No reembolsable', rechazado: 'Rechazado', enviado: 'Enviado', otro: 'Otro', sin_estado: 'Sin estado'};

/** Define qué filas sustentan cada punto. Los ids sin definición no tienen filas (agregados internos, sin fuente o sin dato). */
export function definicionDe(id) {
  const m = ID.exec(String(id ?? ''));
  if (!m) throw new WorkspaceError('pain_point_invalid', 400);
  const base = 'P' + m[1], sub = m[2] ? m[2].slice(1) : null;
  if (base === 'P1' && !sub) return {origen: 'tracker', hojas: ['Refunds'], solo: 'negados'};
  if (base === 'P2' && !sub) return {origen: 'libro', kind: 'refund', canal: 'walmart', status: 'pending'};
  if (base === 'P4') return {origen: 'libro', kind: 'refund', sinCancelados: true, sku: sub};
  if (base === 'P5' && !sub) return {origen: 'libro', kind: 'order', status: 'cancelled'};
  if (base === 'P10' && sub && LIKE_CANAL[sub]) return {origen: 'libro', kind: 'refund', sinCancelados: true, canal: sub};
  return null;
}

/** Pasa por la lista blanca: devuelve solo columnas permitidas (aunque la consulta trajera más). */
export function soloPermitidas(fila) {
  const out = {};
  for (const k of COLUMNAS_PERMITIDAS) out[k] = fila?.[k] ?? null;
  return out;
}
const big = v => BigInt(String(v ?? '0').split('.')[0] || '0');
const hoyIso = d => d.toISOString();

// ---------------------------------------------------------------- libro
/** WHERE + parámetros del libro para una definición (sin cursor). $1 = tenant. */
export function condicionesLibro(def) {
  const p = [null], w = ['e.tenant_id=$1', 'e.kind=$2', "e.currency='USD'", 'e.exponent=2']; p.push(def.kind);
  if (def.status) { p.push(def.status); w.push('e.status=$' + p.length); }
  if (def.sinCancelados) w.push("e.status<>'cancelled'");
  if (def.canal) { p.push(LIKE_CANAL[def.canal]); w.push('e.external_id LIKE $' + p.length); }
  if (def.sku) { p.push(def.sku.toUpperCase()); w.push(`regexp_replace(upper(split_part(e.external_id,'|',${def.kind === 'order' ? 3 : 4})),'${SKU_RE}','')=$` + p.length); }
  w.push('NOT EXISTS (SELECT 1 FROM public.economic_ledger_entries l2 WHERE l2.tenant_id=e.tenant_id AND l2.entity_id=e.entity_id AND l2.revision>e.revision)');
  return {w, p};
}
export function sqlPaginaLibro(def, {cursor, limite}) {
  const {w, p} = condicionesLibro(def);
  const cur = cursor ? (p.push(cursor.t), p.push(cursor.e), ' AND (e.effective_at, e.entity_id) < ($' + (p.length - 1) + '::timestamptz, $' + p.length + '::uuid)') : '';
  const skuCol = `nullif(regexp_replace(upper(split_part(e.external_id,'|',${def.kind === 'order' ? 3 : 4})),'${SKU_RE}',''),'')`;
  return {p, sql: `SELECT to_char(e.effective_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS eff, e.entity_id::text AS entity, to_char(e.effective_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS fecha,
    ${CANAL_SQL} AS canal, ${skuCol} AS sku, e.status, e.currency AS moneda, e.amount_minor::text AS importe, (e.basis LIKE '%a_revisar%') AS a_revisar, left(md5(e.external_id),8) AS ref
    FROM public.economic_ledger_entries e WHERE ${w.join(' AND ')}${cur} ORDER BY e.effective_at DESC, e.entity_id DESC LIMIT ${limite}`};
}
export function sqlTotalLibro(def) {
  const {w, p} = condicionesLibro(def);
  return {p, sql: `SELECT count(*)::int AS n, count(e.amount_minor)::int AS conmonto, coalesce(sum(e.amount_minor),0)::text AS total FROM public.economic_ledger_entries e WHERE ${w.join(' AND ')}`};
}
export function filaLibro(r, def) {
  return soloPermitidas({
    fecha: r.fecha, canal: NOMBRE_CANAL[r.canal] ?? 'Otro', sku: r.sku ?? null, estado: ESTADO_LIBRO[r.status] ?? 'Otro', motivo: null, moneda: r.moneda,
    importeMinor: r.importe == null ? null : String(r.importe).split('.')[0], ref: r.ref ?? null, origen: 'Libro · ' + (def.kind === 'order' ? 'pedidos' : 'reembolsos'),
  });
}

// ---------------------------------------------------------------- Tracker
/** Filas del Tracker de las hojas dadas (última revisión de cada fila): mismo SQL de Fuga de reembolsos, acotado a las hojas pedidas. */
export async function leerTracker(s, hojas, hoy = new Date()) {
  const rows = (await s.query(
    `WITH hdr AS (SELECT DISTINCT r.sheet_name AS sh, (c->>'col')::int AS col, c->>'v' AS name FROM public.tracker_row_revisions r, jsonb_array_elements(r.cells) c
        WHERE r.tenant_id=$1 AND r.ticket_state='header' AND r.sheet_name = ANY($2::text[])
          AND c->>'v' IN ('SKU','Tool SKU','Part SKU','P_SKU','Contact_reason','Contact Reason','Subreason','Retailer','Status','Amount','Request_date','Request Date')),
      latest AS (SELECT DISTINCT ON (sheet_name,row_number) sheet_name,row_number,cells FROM public.tracker_row_revisions
        WHERE tenant_id=$1 AND ticket_state<>'header' AND sheet_name = ANY($2::text[]) ORDER BY sheet_name,row_number,created_at DESC)
     SELECT l.sheet_name AS sheet, l.row_number AS fila, jsonb_object_agg(h.name, btrim(c->>'v')) FILTER (WHERE btrim(coalesce(c->>'v',''))<>'') AS o
     FROM latest l CROSS JOIN LATERAL jsonb_array_elements(l.cells) c JOIN hdr h ON h.sh=l.sheet_name AND h.col=(c->>'col')::int GROUP BY 1,2 LIMIT 20000`, [s.tenantId, hojas])).rows;
  return rows.map(r => filaDeTracker(r.sheet, r.fila, r.o ?? {}, hoy)).filter(f => f.hoja);
}
const RETAILER_NOMBRE = {amazon: 'Amazon', walmart: 'Walmart', bestbuy: 'Best Buy', tienda: 'Tienda propia', lowes: "Lowe's", homedepot: 'Home Depot', otro: 'Otro'};
export function filaTracker(f) {
  return soloPermitidas({
    fecha: f.fecha, canal: RETAILER_NOMBRE[f.retailer] ?? null, sku: f.sku, estado: NOMBRES_ESTADO_TRACKER[f.estado] ?? 'Otro',
    motivo: [f.motivo, f.submotivo].filter(Boolean).join(' · ') || null, moneda: f.montoMinor == null ? null : 'USD', importeMinor: f.montoMinor == null ? null : String(f.montoMinor),
    ref: 'Fila ' + f.fila, origen: 'Tracker · ' + (f.hoja === 'reembolsos' ? 'Reembolsos' : f.hoja),
  });
}
/** Orden estable de las filas del Tracker: fecha descendente (sin fecha al final) y número de fila descendente. Clave de cursor = posición en esa lista. */
export const ordenTracker = (a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')) || b.fila - a.fila;

// ---------------------------------------------------------------- cursor
export const codificarCursor = (id, c) => Buffer.from(JSON.stringify({id, ...c})).toString('base64url');
export function decodificarCursor(id, raw) {
  if (raw == null || raw === '') return null;
  let c;
  try { if (typeof raw !== 'string' || raw.length > 600) throw 0; c = JSON.parse(Buffer.from(raw, 'base64url').toString()); } catch { throw new WorkspaceError('cursor_invalid', 400); }
  if (!c || c.id !== id) throw new WorkspaceError('cursor_scope_conflict', 400);
  if ('t' in c) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(String(c.t)) || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(c.e))) throw new WorkspaceError('cursor_invalid', 400);
    return {t: c.t, e: c.e};
  }
  if (!Number.isInteger(c.i) || c.i < 0 || c.i > 100000) throw new WorkspaceError('cursor_invalid', 400);
  return {i: c.i};
}

// ---------------------------------------------------------------- CSV (sin PII, a prueba de fórmulas)
const csvCelda = v => {
  if (v == null) return '';
  let t = String(v);
  if (/^[=+@\t\r]/.test(t) || (/^-/.test(t) && !/^-\d+(\.\d+)?$/.test(t))) t = "'" + t; // inyección de fórmulas en hojas de cálculo
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
export function aCsv(filas, meta = {}) {
  const cols = [...COLUMNAS, {key: 'clase', label: 'Clase'}, {key: 'fuente', label: 'Fuente'}, {key: 'corte', label: 'Corte'}];
  const extra = {clase: meta.clase ?? '', fuente: meta.fuente ?? '', corte: meta.corte ?? ''};
  return '﻿' + [cols.map(c => c.label).join(','), ...filas.map(f => cols.map(c => csvCelda(c.key in extra ? extra[c.key] : f[c.key])).join(','))].join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- cruce Tracker ↔ libro (por SKU y mes; no es la misma orden)
export function armarCruce({skus, libro, tracker, canal = null}) {
  const out = [];
  for (const sku of skus) {
    const meses = new Map();
    for (const l of libro) if (l.sku === sku && (!canal || l.channel === canal)) { const o = meses.get(l.month) ?? {libro: {n: 0, minor: 0n}, tracker: {n: 0, minor: 0n, negados: 0}}; o.libro.n += Number(l.n) - Number(l.nCancelled); o.libro.minor += big(l.activeMinor); meses.set(l.month, o); }
    for (const f of tracker) if (f.sku === sku && f.fecha && (!canal || f.retailer === canal)) {
      const mes = f.fecha.slice(0, 7), o = meses.get(mes) ?? {libro: {n: 0, minor: 0n}, tracker: {n: 0, minor: 0n, negados: 0}};
      o.tracker.n++; if (f.montoMinor != null) o.tracker.minor += BigInt(f.montoMinor); if (ESTADOS_NEGADOS.includes(f.estado)) o.tracker.negados++; meses.set(mes, o);
    }
    for (const [mes, o] of [...meses].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)) if (o.libro.n || o.tracker.n)
      out.push({sku, mes, libro: {n: o.libro.n, minor: String(o.libro.minor)}, tracker: {n: o.tracker.n, minor: String(o.tracker.minor), negados: o.tracker.negados}});
  }
  return out;
}
const VERIF = {ok: '✓', no: '✗', na: '—'};
export function verificar(cifraMinor, sumaMinor) {
  if (cifraMinor == null || sumaMinor == null) return {cifraMinor: cifraMinor ?? null, sumaMinor: sumaMinor ?? null, coincide: null, marca: VERIF.na, diferenciaMinor: null};
  const d = big(sumaMinor) - big(cifraMinor);
  return {cifraMinor: String(cifraMinor), sumaMinor: String(sumaMinor), coincide: d === 0n, marca: d === 0n ? VERIF.ok : VERIF.no, diferenciaMinor: String(d)};
}

export function createPainEvidenceRepository({database, now = () => new Date(), budgets = EVIDENCIA_BUDGETS_MS, resumen = null}) {
  const vista = resumen ?? (() => createPainPointsRepository({database, now}).get());
  async function ficha(id) {
    const def = definicionDe(id);
    const v = await vista();
    const punto = v.puntos.find(p => p.id === id);
    if (!punto) throw new WorkspaceError('pain_point_not_found', 404);
    return {def, punto};
  }
  return {
    /** Una página (50) de evidencia, o hasta 5 000 filas con `todo` (CSV). Siempre con total y verificación. */
    async get({id, cursor = null, todo = false}) {
      const {def, punto} = await ficha(id);
      const hoy = now();
      const base = {id, nombre: punto.nombre, tema: punto.tema, clase: punto.clase, fuente: punto.fuente, periodo: punto.periodo ?? null, corte: punto.corte ?? null, columnas: COLUMNAS, sinPII: true, generatedAt: hoyIso(hoy), proxy: punto.proxy ?? null};
      if (!def || !punto.evidencia?.disponible) return {...base, estado: punto.dinero.sinDato && punto.volumen.sinDato ? 'sin_dato' : 'sin_filas', motivo: punto.evidencia?.motivo ?? 'Este punto de dolor no tiene filas que mostrar.', filas: [], nextCursor: null, total: null, verificacion: verificar(null, null), cruce: []};
      const cifra = punto.dinero.sinDato ? null : punto.dinero.minor;
      const cur = todo ? null : decodificarCursor(id, cursor);
      return database.transaction('read', async s => {
        const dl = k => Date.now() + budgets[k];
        if (def.origen === 'libro') {
          const limite = todo ? TOPE_CSV + 1 : PAGINA + 1;
          const pag = sqlPaginaLibro(def, {cursor: cur, limite}); pag.p[0] = s.tenantId;
          const filas = await guarded(s, dl('pagina'), 'pp_ev_page', async () => (await s.query(pag.sql, pag.p)).rows);
          const tot = cur ? null : await (async () => { const t = sqlTotalLibro(def); t.p[0] = s.tenantId; return guarded(s, dl('total'), 'pp_ev_total', async () => (await s.query(t.sql, t.p)).rows[0]); })();
          if (filas === null) return {...base, estado: 'unavailable', motivo: 'No disponible ahora. No significa que no haya filas: reintenta en un momento.', filas: [], nextCursor: null, total: null, verificacion: verificar(null, null), cruce: []};
          const hayMas = filas.length === limite, visibles = filas.slice(0, limite - 1);
          const ultimo = visibles.at(-1);
          const total = tot ? {n: Number(tot.n), conMonto: Number(tot.conmonto), sinMonto: Number(tot.n) - Number(tot.conmonto), minor: String(tot.total).split('.')[0], currency: 'USD', exponent: 2} : null;
          const salida = visibles.map(r => filaLibro(r, def));
          const cruce = cur ? [] : await cruceDe(s, salida, def, dl('cruce'), hoy);
          return {...base, estado: salida.length ? 'ok' : 'empty', filas: salida, nextCursor: hayMas && !todo && ultimo ? codificarCursor(id, {t: ultimo.eff, e: ultimo.entity}) : null, truncado: todo && hayMas,
            total, verificacion: verificar(cifra, total?.minor ?? null), cruce};
        }
        // Tracker
        const lista = await guarded(s, dl('tracker'), 'pp_ev_tracker', () => leerTracker(s, def.hojas, hoy));
        if (lista === null) return {...base, estado: 'unavailable', motivo: 'No disponible ahora. No significa que no haya filas: reintenta en un momento.', filas: [], nextCursor: null, total: null, verificacion: verificar(null, null), cruce: []};
        const sel = lista.filter(f => (def.solo === 'negados' ? ESTADOS_NEGADOS.includes(f.estado) : true)).sort(ordenTracker);
        const conMonto = sel.filter(f => f.montoMinor != null);
        const total = {n: sel.length, conMonto: conMonto.length, sinMonto: sel.length - conMonto.length, minor: String(conMonto.reduce((a, f) => a + BigInt(f.montoMinor), 0n)), currency: 'USD', exponent: 2, supuesta: true};
        const ini = todo ? 0 : cur?.i ?? 0, fin = todo ? TOPE_CSV : ini + PAGINA;
        const pagina = sel.slice(ini, fin);
        const cruce = ini ? [] : await cruceDe(s, pagina.map(filaTracker), def, dl('cruce'), hoy, lista);
        return {...base, estado: pagina.length ? 'ok' : 'empty', filas: pagina.map(filaTracker), nextCursor: !todo && fin < sel.length ? codificarCursor(id, {i: fin}) : null, truncado: todo && sel.length > TOPE_CSV,
          total, verificacion: verificar(cifra, total.minor), cruce, nota: 'Monto sin moneda declarada en el Tracker: se supone USD.'};
      });
    },
    /** CSV de las mismas filas y columnas (tope 5 000), sin PII. */
    async csv({id}) {
      const r = await this.get({id, todo: true});
      return {estado: r.estado, nombre: `puntos-de-dolor-${id.replace('~', '-')}-${hoyIso(now()).slice(0, 10)}.csv`, filas: r.filas.length, truncado: Boolean(r.truncado), total: r.total, verificacion: r.verificacion,
        contenido: aCsv(r.filas, {clase: r.clase === 'O' ? 'Observado' : r.clase, fuente: r.fuente?.etiqueta, corte: r.corte ?? ''})};
    },
  };
  async function cruceDe(s, filas, def, deadline, hoy, trackerYa = null) {
    const skus = [...new Set(filas.map(f => f.sku).filter(Boolean))].slice(0, 8);
    if (!skus.length) return [];
    const libro = await guarded(s, deadline, 'pp_ev_cruce_l', async () => (await s.query(
      `SELECT to_char(month,'YYYY-MM') AS month, channel, sku_base AS sku, n, n_cancelled AS "nCancelled", amount_active_minor::text AS "activeMinor" FROM public.insight_refund_by_sku_month
       WHERE tenant_id=$1 AND currency='USD' AND exponent=2 AND sku_base = ANY($2::text[]) ORDER BY month DESC LIMIT 2000`, [s.tenantId, skus])).rows);
    const tracker = trackerYa ?? await guarded(s, deadline, 'pp_ev_cruce_t', () => leerTracker(s, ['Refunds'], hoy));
    if (!libro && !tracker) return [];
    return armarCruce({skus, libro: libro ?? [], tracker: tracker ?? [], canal: def.canal ?? null});
  }
}
