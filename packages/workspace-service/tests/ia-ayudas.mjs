// Ayudas de prueba de la lectura de IA: almacén en memoria con la MISMA semántica que las funciones SQL (tope, en_curso, idempotencia, lectura ok inmutable) y proveedores simulados.
import {armarPuntos, ordenPuntos} from '../pain-points-catalogo.mjs';
export const CAP = 5_000_000;
export function almacenMemoria({usado = 0, cap = CAP} = {}) {
  const gasto = new Map(), runs = new Map(); const eventos = [];
  const key = (p, c, v) => `${p}|${c}|${v}`;
  const total = (excepto) => usado + [...gasto].filter(([k]) => k !== excepto).reduce((a, [, g]) => a + (g.actual ?? g.estimado), 0);
  return {
    eventos, gasto, runs,
    async presupuesto() { const u = total(); return {weekStart: '2026-10-19', capMicro: cap, usedMicro: u, remainingMicro: Math.max(cap - u, 0), exhausted: u >= cap}; },
    async reservar(k, est) {
      eventos.push(['reservar', k, est]);
      const ex = gasto.get(k);
      if (ex && ex.estado !== 'reservado') return {allowed: false, reason: 'ya_registrada'};
      if (ex) return {allowed: false, reason: 'en_curso'};
      const u = total(k);
      if (u + est > cap) return {allowed: false, reason: 'tope', usedMicro: u};
      gasto.set(k, {estado: 'reservado', estimado: est, actual: null}); return {allowed: true, usedMicro: u + est};
    },
    async liquidar(k, costo) { eventos.push(['liquidar', k, costo]); const g = gasto.get(k); if (!g || g.estado !== 'reservado') throw Error('reserva desconocida'); g.estado = costo == null ? 'incierto' : 'liquidado'; g.actual = costo; return {}; },
    async buscarRun(p, c, v) { return structuredClone(runs.get(key(p, c, v)) ?? null); },
    async ultimoRun(p) { return structuredClone([...runs.values()].filter(r => r.puntoId === p && r.lecturas.some(l => l.estado === 'ok')).at(-1) ?? null); },
    async guardar(pl) {
      eventos.push(['guardar', pl.puntoId]);
      const k = key(pl.puntoId, pl.corte, pl.version);
      const r = runs.get(k) ?? {id: 'run-' + (runs.size + 1), puntoId: pl.puntoId, corte: pl.corte, version: pl.version, estado: 'parcial', consenso: {}, confianza: null, creadoEn: 'x', actualizadoEn: 'x', lecturas: []};
      for (const l of pl.lecturas) { const i = r.lecturas.findIndex(x => x.rol === l.rol); const nueva = {...l, clase: 'inferred'}; if (i < 0) r.lecturas.push(nueva); else if (r.lecturas[i].estado !== 'ok') r.lecturas[i] = nueva; }
      const oks = r.lecturas.filter(l => l.estado === 'ok').length;
      r.estado = oks >= 3 ? 'completo' : 'parcial'; r.consenso = pl.consenso; r.confianza = pl.confianza; runs.set(k, r); return structuredClone(r);
    },
  };
}
/** Lectura válida con la forma que pide cada rol. `sev` = severidad; `monto` = texto de monto citado (debe venir de la entrada). */
export function jsonLectura(rol, {sev = 'alta', conf = 0.7, texto = 'Lectura de prueba.', categoria = 'proceso', monto = null} = {}) {
  const o = {severidad: sev, confianza: conf, lectura: texto + (monto ? ` Cifra ${monto}.` : ''), puntos: ['Punto uno'], supuestos: ['Supuesto uno']};
  if (rol === 'causa_raiz') o.categoria = categoria;
  if (rol === 'accion') o.propuesta = {titulo: 'Revisar el flujo de devoluciones', pasos: ['Revisar casos recientes', 'Decidir con el responsable'], evidencia: 'Filas de la evidencia del punto'};
  return JSON.stringify(o);
}
/** Proveedor simulado: `respuestas[rol]` = texto (o función) y `costo` por llamada. Registra las llamadas para inspeccionarlas. */
export function proveedorSimulado({respuestas = {}, costo = 100_000, lanzar = {}} = {}) {
  const llamadas = [];
  return {llamadas, async completar(i) {
    llamadas.push(i);
    if (lanzar[i.rol]) throw Error('timeout');
    const r = respuestas[i.rol] ?? jsonLectura(i.rol);
    return {texto: typeof r === 'function' ? r(i) : r, tokensIn: 1000, tokensOut: 200, costoMicro: typeof costo === 'function' ? costo(i) : costo, modelo: 'simulado-1', proveedor: 'simulado'};
  }};
}
export const ctrl = (usd) => ({sinDato: false, tipo: 'bruto', currency: 'USD', exponent: 2, minor: String(usd), supuesta: false});
/** Vista de puntos real (armarPuntos) con datos mínimos para que haya P1, P2, P5... */
export function vistaSimulada() {
  const puntos = armarPuntos({
    tracker: {data: {byStatus: {vencido: {n: 10, nAmount: 8, amountMinor: '120000'}, rechazado: {n: 5, nAmount: 5, amountMinor: '30000'}}, total: 300}, meta: {sourceWatermark: '2026-10-20T00:00:00.000Z', refreshedAt: '2026-10-21T00:00:00.000Z'}},
    walmart: {n: 12, known: 12, minor: '456700', desde: '2026-08', hasta: '2026-10', refreshedAt: '2026-10-21T00:00:00.000Z', watermark: '2026-10-20T00:00:00.000Z'},
    reembolsos: null, ordenes: null, hilos: null, repetido: false, garantia: null, hilosMeta: null,
  });
  return {version: 'pain-points-v1', generatedAt: '2026-10-24T12:00:00.000Z', currency: 'USD', exponent: 2, tipoDinero: 'bruto', temas: [], clases: {}, puntos: [...puntos].sort(ordenPuntos), partes: {}, nota: ''};
}
