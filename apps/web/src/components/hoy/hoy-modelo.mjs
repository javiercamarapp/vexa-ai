// Modelo de «Hoy» (primer pliegue del Resumen): titular narrativo, 4 KPI, «Requiere tu atención», barra observado vs recuperable y siguiente mejor acción.
// PURO y probado. Entra lo que ya calcularon /api/refunds (Fuga), /api/workload (HubSpot) y /cfo/data/report (libro): aquí no se consulta nada ni se inventa una cifra.
// Reglas: ingreso BRUTO (nunca margen), HubSpot manda (nada de SLA de Zendesk), desconocido != 0, cada cifra con clase + fuente + hasta + actualizado.
import {sello} from '../../lib/confianza/sello.mjs';
import {briefingCfo} from '../copiloto/briefing-cfo.mjs';
import {NOMBRE, usd, num, pct, dia, horaTxtSeguro} from './hoy-formato.mjs';
import {textos} from './hoy-textos.mjs';

const NEGADOS = ['vencido', 'no_reembolsable', 'rechazado']; // = ESTADOS_NEGADOS del servidor (se repite aquí: ese módulo no se puede importar en el navegador)
const ok = p => p && p.status === 'ok';
/** Estado de una fuente de datos para el cliente: 'ok' | 'cargando' | 'sin_acceso' | 'error' | 'vacio'. */
export const estadoDe = (data, {busy = false, error = '', status = 0} = {}) => data ? 'ok' : busy ? 'cargando' : status === 403 || status === 401 ? 'sin_acceso' : error ? 'error' : 'vacio';

function rangoTxt(r, idioma) { return r?.desde && r?.hasta ? `${dia(r.desde, idioma)}${idioma === 'en' ? ' to ' : ' al '}${dia(r.hasta, idioma)}` : null; }
/** «1 ago 2026 al 20 sep 2026» -> «1 ago–20 sep 2026» (mismo año); con años distintos conserva ambos. En inglés: «Aug 1–Sep 20, 2026». */
function rangoCorto(r, idioma) {
  if (!(r?.desde && r?.hasta)) return null;
  const a = dia(r.desde, idioma), b = dia(r.hasta, idioma);
  if (idioma === 'en') { const ya = /,\s(\d{4})$/.exec(a)?.[1], yb = /,\s(\d{4})$/.exec(b)?.[1]; return ya && ya === yb ? `${a.replace(/,\s\d{4}$/, '')}–${b}` : `${a}–${b}`; }
  const ya = /\s(\d{4})$/.exec(a)?.[1], yb = /\s(\d{4})$/.exec(b)?.[1];
  return ya && ya === yb ? `${a.replace(/\s\d{4}$/, '')}–${b}` : `${a}–${b}`;
}
const conUS = s => String(s).replace(/^-?\$/, m => m.replace('$', 'US$'));

/** Entradas del panel «Cómo se calculó»: una por cifra de Hoy. Texto por plantilla; lo que no se sabe va aparte. `ctx.idioma` ('es' por omisión) elige el idioma del texto. */
export function comoSeCalculo(id, ctx = {}) {
  const f = ctx.fuga, c = ctx.carga, rep = ctx.cfo, I = ctx.idioma, X = textos(I);
  switch (id) {
    case 'ingreso': return {id, titulo: X.ingreso.titulo, clase: 'observed', fuente: X.ingreso.fuente, periodo: rep?.mes ?? null,
      formula: rep?.how ?? X.ingreso.formula,
      cobertura: rep?.cobertura ?? null, noSabemos: X.ingreso.noSabemos};
    case 'reembolsos': return {id, titulo: X.reembolsos.titulo, clase: 'observed', fuente: X.reembolsos.fuente, periodo: rangoTxt(f?.titular?.rango, I) ? X.reembolsos.del(rangoTxt(f.titular.rango, I)) : null,
      formula: X.reembolsos.formula,
      cobertura: f?.titular?.sinMonto ? X.reembolsos.cobertura(num(f.titular.sinMonto, I)) : null,
      noSabemos: X.reembolsos.noSabemos};
    case 'atorado': return {id, titulo: X.atorado.titulo, clase: 'observed', fuente: X.atorado.fuente, periodo: null,
      formula: X.atorado.formula,
      cobertura: ok(f?.tracker) ? X.atorado.cobertura(num(f.tracker.conMonto, I), num(f.tracker.filasReembolsos, I)) : null,
      noSabemos: X.atorado.noSabemos};
    case 'respuestas24': return {id, titulo: X.respuestas24.titulo, clase: 'observed', fuente: X.respuestas24.fuente, periodo: X.respuestas24.periodo,
      formula: X.respuestas24.formula,
      cobertura: ok(c?.sla) ? X.respuestas24.cobertura(num(c.sla.medibles, I), num(c.sla.hilos, I)) : null,
      noSabemos: X.respuestas24.noSabemos};
    case 'recuperable': return {id, titulo: X.recuperable.titulo, clase: 'estimated', fuente: X.recuperable.fuente, periodo: null,
      formula: X.recuperable.formula,
      cobertura: null, noSabemos: X.recuperable.noSabemos};
    default: return null;
  }
}

const dirDe = n => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');
/** Variación para el chip: texto + dirección + qué dirección es buena (ingreso sube = bueno; reembolsos suben = malo). */
const variacion = (texto, n, bueno) => (texto ? {texto, dir: dirDe(n), bueno} : null);
/** KPI de ingreso bruto desde el informe del libro (misma fuente que «Dinero»). */
function kpiIngreso({cfo, estado, ahora, idioma}) {
  const X = textos(idioma), base = {id: 'ingreso', etiqueta: X.etiquetas.ingreso, como: 'ingreso'};
  if (estado.cfo === 'sin_acceso') return {...base, estado: 'sin_acceso', valor: null, nota: X.propietariosAnalistas};
  if (estado.cfo === 'cargando') return {...base, estado: 'cargando'};
  const b = cfo?.status === 'ok' ? briefingCfo(cfo.report, 'USD', idioma) : null;
  const rev = b?.kpis.find(k => k.id.startsWith('rev:'));
  if (!b || !rev) return {...base, estado: 'no_disponible', valor: null, nota: estado.cfo === 'error' ? X.ingresoNoDisp : X.ingresoSinMes};
  return {...base, estado: 'ok', valor: rev.display, periodo: b.mesDelResumen, nota: `${b.titular.periodo ?? ''} · ${b.moneda}`.replace(/^ · /, ''), notaLarga: `${b.titular.periodo ?? ''} · ${b.moneda}${rev.cobertura ? ' · ' + rev.cobertura : ''}`.replace(/^ · /, ''),
    delta: rev.delta ? `${rev.delta.display} vs ${rev.delta.vs}` : null,
    variacion: rev.delta ? variacion(rev.delta.display, rev.delta.bps ?? (String(rev.delta.display).trim().startsWith('-') ? -1 : 1), 'up') : null,
    serie: (b.serie?.principal ?? []).filter(p => !p.partial && p.value != null).slice(-8).map(p => p.value), serieEtiqueta: X.ingresoSerie, clase: rev.kind === 'estimated' || rev.kind === 'inferred' ? rev.kind : 'observed',
    sello: sello({clase: rev.kind, fuente: X.ingresoLibro, hasta: cfo.report.watermark, actualizado: cfo.report.generatedAt, ahora}), cfoInfo: {mes: b.mesDelResumen, how: rev.how, cobertura: rev.cobertura}};
}
function kpiReembolsos({fuga, estado, ahora, idioma}) {
  const X = textos(idioma), base = {id: 'reembolsos', etiqueta: X.etiquetas.reembolsos, como: 'reembolsos'};
  if (estado.fuga === 'sin_acceso') return {...base, estado: 'sin_acceso', valor: null, nota: X.propietariosAnalistas};
  if (estado.fuga === 'cargando') return {...base, estado: 'cargando'};
  if (!ok(fuga?.titular)) return {...base, estado: 'no_disponible', valor: null, nota: fuga?.titular?.status === 'empty' ? X.reembNoCargados : X.reembNoDisp};
  const t = fuga.titular, inten = (fuga.cambios?.reembolsos ?? []).filter(x => x.intensidadPct != null).map(x => `${NOMBRE[x.canal] ?? x.canal} ${pct(x.intensidadPct, idioma)}`);
  const cambio = (fuga.cambios?.reembolsos ?? []).find(x => x.reembolsosPrevio > 0), canales = Object.values(fuga.intensidad?.canales ?? {});
  const mejor = canales.map(c => (c.meses ?? []).filter(m => m.calidad === 'completo')).sort((a, b) => b.reduce((s, m) => s + m.reembolsos, 0) - a.reduce((s, m) => s + m.reembolsos, 0))[0] ?? [];
  const pc = cambio ? ((cambio.reembolsos - cambio.reembolsosPrevio) / cambio.reembolsosPrevio) * 100 : null;
  return {...base, estado: 'ok', valor: usd(t.usdBrutoMinor, {idioma}), periodo: rangoTxt(t.rango, idioma), clase: 'observed',
    variacion: pc == null ? null : variacion(`${pc > 0 ? '+' : ''}${pc.toFixed(1)}${idioma === 'en' ? '%' : ' %'}`, pc, 'down'), serie: mejor.slice(-8).map(m => m.reembolsos), serieEtiqueta: X.reembSerie,
    nota: X.nReembolsos(num(t.n, idioma)), notaLarga: `${X.nReembolsos(num(t.n, idioma))}${inten.length ? X.intensidad(inten.join(' · ')) : ''}`,
    sello: sello({clase: 'observed', fuente: X.libroReemb, hasta: t.rango?.hasta ?? null, actualizado: fuga.generatedAt, ahora})};
}
function kpiAtorado({fuga, estado, ahora, idioma}) {
  const X = textos(idioma), base = {id: 'atorado', etiqueta: X.etiquetas.atorado, como: 'atorado'};
  if (estado.fuga === 'sin_acceso') return {...base, estado: 'sin_acceso', valor: null, nota: X.propietariosAnalistas};
  if (estado.fuga === 'cargando') return {...base, estado: 'cargando'};
  const t = fuga?.tracker;
  if (!ok(t)) return {...base, estado: 'no_disponible', valor: null, nota: t?.status === 'empty' ? X.atoradoSinFilas : X.atoradoNoDisp};
  const monto = NEGADOS.reduce((a, k) => a + (t.montoPorEstado?.[k] ?? 0), 0);
  const estados = NEGADOS.map(k => ({id: k, valor: t.estados?.[k] ?? 0})).filter(e => e.valor > 0);
  return {...base, estado: 'ok', valor: X.casos(num(t.negados, idioma)), clase: 'observed', estados,
    nota: monto > 0 ? X.conMontoUsd(usd(String(Math.round(monto)), {idioma})) : X.sinMonto, notaLarga: monto > 0 ? X.conMontoLarga(usd(String(Math.round(monto)), {idioma})) : X.sinMontoLarga,
    sello: sello({clase: 'observed', fuente: X.trackerExcel, hasta: null, actualizado: fuga.generatedAt, ahora})};
}
function kpiRespuestas({carga, estado, ahora, idioma}) {
  const X = textos(idioma), base = {id: 'respuestas24', etiqueta: X.respEtiqueta, como: 'respuestas24'};
  if (estado.carga === 'sin_acceso') return {...base, estado: 'sin_acceso', valor: null, nota: X.propietariosAnalistas};
  if (estado.carga === 'cargando') return {...base, estado: 'cargando'};
  const s = carga?.sla;
  if (!ok(s)) return {...base, estado: 'no_disponible', valor: null, nota: s?.status === 'empty' ? X.respSinHilos : X.respNoDisp};
  const porDia = ok(carga?.carga) ? (carga.carga.porDia ?? []).map(d => d.promedioPorDia) : [];
  return {...base, estado: 'ok', valor: X.hilos(num(s.abiertosSinRespuesta24h, idioma)), clase: 'observed', serie: porDia.length > 1 ? porDia : undefined, serieEtiqueta: X.respSerie, nota: X.respNota, notaLarga: X.respNotaLarga,
    sello: sello({clase: 'observed', fuente: 'HubSpot API', hasta: s.corte, actualizado: s.generatedAt ?? carga.generatedAt, ahora})};
}

/** Titular narrativo con periodo: una frase con una cifra de dinero y lo que significa. */
function titularDe({fuga, kpis, estado, idioma}) {
  const t = fuga?.titular, T = textos(idioma).tit;
  if (ok(t)) {
    const top10 = t.top10?.pct != null && fuga.skus?.top?.length;
    const r = rangoCorto(t.rango, idioma), n = fuga.skus?.top?.length, p = t.top10?.pct;
    // `partes` marca en negrita las cifras clave (la vista las pinta con <strong>); `texto` es la misma frase en plano.
    const partes = [{t: T.devolvieron}, {t: conUS(usd(t.usdBrutoMinor, {idioma})), f: true}, {t: T.brutos}, ...(r ? [{t: T.del}, {t: r, f: true}] : []), {t: '.'}];
    if (top10) partes.push({t: ' '}, {t: T.skus(n), f: true}, {t: T.explican}, {t: pct(p, idioma), f: true}, {t: '.'});
    return {texto: partes.map(x => x.t).join(''), partes, periodo: r, clase: 'observed'};
  }
  // M3 (auditoría 24-oct): mientras Fuga sigue cargando NO se publica el titular de respaldo (ingreso): cambiaría de frase cuando Fuga llegue. Titular estable = vacío hasta decidir.
  if (estado?.fuga === 'cargando') return {texto: '', partes: [], periodo: null, clase: null};
  const rev = kpis.find(k => k.id === 'ingreso' && k.estado === 'ok');
  if (rev) {
    const partes = [{t: T.en}, {t: rev.periodo, f: true}, {t: ': '}, {t: conUS(rev.valor), f: true}, {t: T.deIngreso}];
    return {texto: partes.map(x => x.t).join(''), partes, periodo: rev.periodo, clase: 'observed'};
  }
  return {texto: T.sinDatos, partes: [{t: T.sinDatos}], periodo: null, clase: null};
}

/** «Requiere tu atención (3)»: candidatos con su dinero en juego; el mayor primero, los que no tienen monto al final. */
export function atencionDe({fuga, carga, idioma}) {
  const c = [], A = textos(idioma).aten;
  const top = fuga?.skus?.status === 'ok' ? fuga.skus.top[0] : null;
  if (top) c.push({id: 'fuga-sku', titulo: A.fugaSku(top.sku), detalle: A.fugaDet(num(top.n, idioma), NOMBRE[top.canales?.[0]?.canal] ?? A.varios), dineroMinor: Number(BigInt(String(top.usdBrutoMinor).split('.')[0])), dinero: usd(top.usdBrutoMinor, {idioma}), href: '/refunds#fg-skus', clase: 'observed'});
  const t = fuga?.tracker;
  if (ok(t) && (t.estados?.vencido ?? 0) > 0) c.push({id: 'vencidos', titulo: A.vencidos(num(t.estados.vencido, idioma)), detalle: A.vencidosDet, dineroMinor: t.montoPorEstado?.vencido ?? 0, dinero: t.montoPorEstado?.vencido > 0 ? usd(String(Math.round(t.montoPorEstado.vencido)), {idioma}) : null, href: '/refunds#fg-tracker', clase: 'observed'});
  if (ok(carga?.sla) && carga.sla.abiertosSinRespuesta24h > 0) c.push({id: 'sin-respuesta', titulo: A.sinResp(num(carga.sla.abiertosSinRespuesta24h, idioma)), detalle: A.sinRespDet, dineroMinor: 0, dinero: null, href: '/workload', clase: 'observed'});
  const pico = ok(carga?.carga) ? carga.carga.horasPico?.[0] : null;
  if (pico) c.push({id: 'pico', titulo: A.pico(horaTxtSeguro(pico.hora)), detalle: A.picoDet(pico.promedioPorDia), dineroMinor: 0, dinero: null, href: '/workload', clase: 'observed'});
  return c.sort((a, b) => b.dineroMinor - a.dineroMinor).slice(0, 3).map(({id, titulo, detalle, dinero, href, clase}) => ({id, titulo, detalle, dinero, href, clase}));
}

/** Barra «observado vs recuperable»: lo observado es sólido; lo recuperable es [E], rayado y NO tiene cifra hasta que la persona teclee sus supuestos. */
export function barraDe({fuga, idioma}) {
  const t = fuga?.titular, B = textos(idioma).barra;
  if (!ok(t)) return null;
  return {observado: usd(t.usdBrutoMinor, {idioma}), observadoEtiqueta: B.observado, recuperable: null, recuperableEtiqueta: B.recuperable, recuperableNota: B.nota, href: '/refunds#fg-estimador'};
}

/** Siguiente mejor acción: preparar el paquete de reclamo del SKU con más dinero devuelto. Es un borrador local; un humano lo envía. */
export function siguienteDe({fuga, idioma}) {
  const top = fuga?.skus?.status === 'ok' ? fuga.skus.top[0] : null;
  if (!top) return null;
  const S = textos(idioma).sig;
  return {titulo: S.titulo(top.sku), detalle: S.detalle(usd(top.usdBrutoMinor, {idioma}), num(top.n, idioma)), cta: S.cta, accion: 'paquete', sku: top.sku, href: '/refunds#fg-acciones', secundaria: {texto: S.secundaria, pregunta: S.pregunta, href: '/preguntale?enviar=1&q=' + encodeURIComponent(S.pregunta)}};
}

/** @param {{fuga?, carga?, cfo?, estado:{fuga,carga,cfo}, ahora?:number, idioma?:'es'|'en'}} a */
export function armarHoy({fuga = null, carga = null, cfo = null, estado, ahora = Date.now(), idioma = 'es'}) {
  const kpis = [kpiIngreso({cfo, estado, ahora, idioma}), kpiReembolsos({fuga, estado, ahora, idioma}), kpiAtorado({fuga, estado, ahora, idioma}), kpiRespuestas({carga, estado, ahora, idioma})];
  const titular = titularDe({fuga, kpis, estado, idioma});
  const cargando = Object.values(estado).some(e => e === 'cargando'); // regla del dueño: logo solo hasta que TODOS los bloques críticos estén listos
  const sinNada = !cargando && kpis.every(k => k.estado !== 'ok' && k.estado !== 'cargando');
  return {titular, kpis, atencion: atencionDe({fuga, carga, idioma}), barra: barraDe({fuga, idioma}), siguiente: siguienteDe({fuga, idioma}), cargando, vacio: sinNada,
    ctxComo: {fuga, carga, cfo: kpis[0].cfoInfo ?? null, idioma}};
}
