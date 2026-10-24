// Datos 100 % sintéticos de «Puntos de dolor» (/pain-points) para la auditoría visual y las pruebas: usa el MISMO armarPuntos del servicio.
import {armarPuntos, TEMAS, CLASES} from '../../../../packages/workspace-service/pain-points-catalogo.mjs';
const SKUS = ['SYN-M10', 'SYN-L1', 'SYN-L4', 'SYN-X2', 'SYN-H5', 'SYN-H4', 'SYN-L6', 'SYN-E14', 'SYN-B1', 'SYN-C2'];
const refunds = [];
SKUS.forEach((sku, i) => ['walmart', 'amazon', 'shopify'].forEach((channel, j) => {
  const base = Math.round(6200000 / (i + 1.5) / (j + 1));
  refunds.push({month: '2026-09', channel, sku, currency: 'USD', exponent: 2, n: 200 - i * 12, nKnown: 190 - i * 12 - (channel === 'amazon' ? 40 : 0), nCancelled: channel === 'walmart' ? 20 : 0, amountMinor: String(base + 80000), activeMinor: String(base), }, {month: '2026-10', channel, sku, currency: 'USD', exponent: 2, n: 30, nKnown: 30, nCancelled: 0, amountMinor: '100000', activeMinor: '100000'});
}));
const orders = [];
for (const [channel, n, a, c] of [['amazon', 56000, 896277489, 27252217], ['walmart', 17700, 212116107, 3900835], ['shopify', 857, 14026811, 343694], ['bestbuy', 2384, 35569468, 114600]]) orders.push({month: '2026-09', channel, sku: SKUS[0], currency: 'USD', exponent: 2, n, nCancelled: Math.round(n * .02), amountMinor: String(a), cancelledMinor: String(c)});
orders.push({month: '2026-09', channel: 'amazon', sku: SKUS[0], currency: 'CAD', exponent: 2, n: 300, nCancelled: 48, amountMinor: '9055912', cancelledMinor: '1579590'});
const meta = {refreshedAt: '2026-10-23T17:20:00Z', sourceWatermark: '2026-10-19T06:32:00Z'};
export function vistaPain({vacio = false, parcial = false} = {}) {
  const f = vacio ? {tracker: null, walmart: null, reembolsos: null, ordenes: null, hilos: null, repetido: null, garantia: null} : {
    tracker: parcial ? null : {data: {total: 276, byStatus: {vencido: {n: 46, nAmount: 46, amountMinor: '999053'}, no_reembolsable: {n: 33, nAmount: 30, amountMinor: '526017'}, rechazado: {n: 19, nAmount: 15, amountMinor: '320342'}, reembolsado: {n: 160, nAmount: 140, amountMinor: '3400000'}}}, meta},
    walmart: {n: 637, known: 637, minor: '13756830', desde: '2026-07', hasta: '2026-09', refreshedAt: meta.refreshedAt, watermark: meta.sourceWatermark},
    reembolsos: {rows: refunds, meta}, ordenes: {rows: orders, meta},
    hilos: {threads: 3005, closed: 2500, reopenedThreads: 148, reopenedPercent: 5.9, closeP50Hours: 44.8, closeP90Hours: 1001, closedOver7d: 710, periodo: {desde: '2026-07', hasta: '2026-10'}}, hilosMeta: meta,
    repetido: {contactos: 8067 * 5, contactosDosOMas: 8067, pct: 20, pctSinVincular: 28.4, corte: meta.sourceWatermark, refreshedAt: meta.refreshedAt}, garantia: {total: 3748, hojas: {'Warranty Tools': 1788, 'Warranty Parts': 1960}},
  };
  const puntos = armarPuntos(f);
  return {version: 'pain-points-v1', generatedAt: '2026-10-24T12:00:00.000Z', currency: 'USD', exponent: 2, tipoDinero: 'bruto', temas: TEMAS, clases: CLASES, puntos,
    partes: {tracker: f.tracker ? 'ok' : 'unavailable', reembolsos: f.reembolsos ? 'ok' : 'unavailable'}, nota: 'Ingreso bruto, nunca margen. Los puntos que comparten dinero son cortes distintos del mismo reembolso: no se suman entre sí.'};
}
export function evidenciaPain(id, cursor) {
  const v = vistaPain(), p = v.puntos.find(x => x.id === id);
  if (!p) return null;
  const base = {id, nombre: p.nombre, tema: p.tema, clase: p.clase, fuente: p.fuente, periodo: p.periodo, corte: p.corte, columnas: [], sinPII: true, generatedAt: v.generatedAt, proxy: p.proxy};
  if (!p.evidencia.disponible) return {...base, estado: p.dinero.sinDato && p.volumen.sinDato ? 'sin_dato' : 'sin_filas', motivo: p.evidencia.motivo, filas: [], nextCursor: null, total: null, verificacion: {cifraMinor: null, sumaMinor: null, coincide: null, marca: '—', diferenciaMinor: null}, cruce: []};
  const pagina = cursor ? 1 : 0, n = p.volumen.sinDato ? 60 : Math.min(60, p.volumen.n);
  const filas = Array.from({length: pagina ? Math.max(0, n - 50) : Math.min(50, n)}, (_, i) => ({fecha: `2026-09-${String(28 - ((i + pagina * 50) % 28)).padStart(2, '0')}`, canal: p.id.includes('amazon') ? 'Amazon' : 'Walmart', sku: SKUS[(i + pagina) % SKUS.length], estado: i % 5 ? 'Pendiente' : 'Rechazado', motivo: null, moneda: 'USD', importeMinor: String(12000 + i * 37), ref: (0xabcd1234 + i * 7919 + pagina * 50).toString(16).slice(0, 8), origen: 'Libro · reembolsos'}));
  const minor = p.dinero.sinDato ? '0' : p.dinero.minor;
  return {...base, estado: 'ok', filas, nextCursor: !pagina && n > 50 ? 'c1' : null, total: pagina ? null : {n, conMonto: n, sinMonto: 0, minor, currency: 'USD', exponent: 2}, verificacion: {cifraMinor: minor, sumaMinor: minor, coincide: true, marca: '✓', diferenciaMinor: '0'},
    cruce: pagina ? [] : [{sku: SKUS[0], mes: '2026-09', libro: {n: 40, minor: '1668324'}, tracker: {n: 3, minor: '52126', negados: 2}}]};
}
