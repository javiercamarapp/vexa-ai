// Modelo de «Hoy» (primer pliegue del Resumen): titular narrativo, 4 KPI, «Requiere tu atención», barra observado vs recuperable y siguiente mejor acción.
// PURO y probado. Entra lo que ya calcularon /api/refunds (Fuga), /api/workload (HubSpot) y /cfo/data/report (libro): aquí no se consulta nada ni se inventa una cifra.
// Reglas: ingreso BRUTO (nunca margen), HubSpot manda (nada de SLA de Zendesk), desconocido != 0, cada cifra con clase + fuente + hasta + actualizado.
import {sello} from '../../lib/confianza/sello.mjs';
import {briefingCfo} from '../copiloto/briefing-cfo.mjs';
import {NOMBRE, usd, num, pct, dia, horaTxtSeguro} from './hoy-formato.mjs';

const NEGADOS = ['vencido', 'no_reembolsable', 'rechazado']; // = ESTADOS_NEGADOS del servidor (se repite aquí: ese módulo no se puede importar en el navegador)
const ok = p => p && p.status === 'ok';
/** Estado de una fuente de datos para el cliente: 'ok' | 'cargando' | 'sin_acceso' | 'error' | 'vacio'. */
export const estadoDe = (data, {busy = false, error = '', status = 0} = {}) => data ? 'ok' : busy ? 'cargando' : status === 403 || status === 401 ? 'sin_acceso' : error ? 'error' : 'vacio';

function rangoTxt(r) { return r?.desde && r?.hasta ? `${dia(r.desde)} al ${dia(r.hasta)}` : null; }

/** Entradas del panel «Cómo se calculó»: una por cifra de Hoy. Texto por plantilla; lo que no se sabe va aparte. */
export function comoSeCalculo(id, ctx = {}) {
  const f = ctx.fuga, c = ctx.carga, rep = ctx.cfo;
  switch (id) {
    case 'ingreso': return {id, titulo: 'Ingreso bruto', clase: 'observed', fuente: 'Libro económico de tu organización', periodo: rep?.mes ?? null,
      formula: rep?.how ?? 'Suma de los pedidos registrados del último mes completo con importe conocido, en una sola moneda y una sola base. No resta reembolsos ni costos.',
      cobertura: rep?.cobertura ?? null, noSabemos: ['Es ingreso bruto: no es margen ni utilidad. Nada de lo que ves aquí lo calcula.', 'Los meses incompletos no se comparan con meses completos.']};
    case 'reembolsos': return {id, titulo: 'Reembolsos e intensidad', clase: 'observed', fuente: 'Libro de reembolsos (Amazon, Walmart, Shopify)', periodo: rangoTxt(f?.titular?.rango) ? `del ${rangoTxt(f.titular.rango)}` : null,
      formula: 'Dinero devuelto bruto = suma de los reembolsos del libro con monto conocido, en USD. Intensidad = reembolsos del mes ÷ líneas vendidas del mes (no es una tasa por cohorte).',
      cobertura: f?.titular?.sinMonto ? `${num(f.titular.sinMonto)} reembolsos sin monto: el dinero devuelto es un piso.` : null,
      noSabemos: ['El libro no trae cantidad por línea: la tasa real de devolución no se puede calcular.', 'Las ventanas de exportación son parciales; no todo el libro cubre el mismo periodo.', 'CAD y MXN no se suman a USD: no hay tipo de cambio aprobado.']};
    case 'atorado': return {id, titulo: 'Dinero atorado', clase: 'observed', fuente: 'Tracker de Excel (carga manual)', periodo: null,
      formula: 'Casos del Tracker en estado vencido (más de 180 días), no reembolsable o rechazado. El monto es la suma de los casos que traen monto; los demás se cuentan aparte.',
      cobertura: ok(f?.tracker) ? `${num(f.tracker.conMonto)} de ${num(f.tracker.filasReembolsos)} solicitudes traen monto.` : null,
      noSabemos: ['Es una muestra del Tracker, no el total de reembolsos.', 'El monto del Tracker no declara moneda: se supone USD.', 'El Tracker no trae fecha de corte: no sabemos hasta cuándo está al día.']};
    case 'respuestas24': return {id, titulo: 'Respuestas de más de 24 h', clase: 'observed', fuente: 'HubSpot API', periodo: 'hoy, al corte de HubSpot',
      formula: 'Hilos de HubSpot abiertos cuyo primer mensaje del cliente tiene más de 24 h y no tienen respuesta de un agente registrada. Solo conteo.',
      cobertura: ok(c?.sla) ? `${num(c.sla.medibles)} de ${num(c.sla.hilos)} hilos tienen un mensaje del cliente medible.` : null,
      noSabemos: ['Zendesk no se usa mientras su configuración esté en transición: la fuente es HubSpot.', 'Un hilo sin respuesta registrada puede haberse atendido por otro canal.', 'El desglose por canal llega cuando las conversaciones traigan marca de canal.']};
    case 'recuperable': return {id, titulo: 'Observado vs recuperable', clase: 'estimated', fuente: 'Estimador con candado (tus supuestos)', periodo: null,
      formula: 'Recuperable = base observada × % atribuible a proveedor × % recuperable. Los porcentajes los tecleas tú; Rovaq no propone valores.',
      cobertura: null, noSabemos: ['Sin tus supuestos no hay cifra: ni siquiera un rango.', 'Es una estimación, nunca un ahorro garantizado.']};
    default: return null;
  }
}

const dirDe = n => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');
/** Variación para el chip: texto + dirección + qué dirección es buena (ingreso sube = bueno; reembolsos suben = malo). */
const variacion = (texto, n, bueno) => (texto ? {texto, dir: dirDe(n), bueno} : null);
/** KPI de ingreso bruto desde el informe del libro (misma fuente que «Dinero»). */
function kpiIngreso({cfo, estado, ahora}) {
  const base = {id: 'ingreso', etiqueta: 'Ingreso bruto', como: 'ingreso'};
  if (estado.cfo === 'sin_acceso') return {...base, estado: 'sin_acceso', valor: null, nota: 'Lo ven propietarios y analistas.'};
  if (estado.cfo === 'cargando') return {...base, estado: 'cargando'};
  const b = cfo?.status === 'ok' ? briefingCfo(cfo.report, 'USD') : null;
  const rev = b?.kpis.find(k => k.id.startsWith('rev:'));
  if (!b || !rev) return {...base, estado: 'no_disponible', valor: null, nota: estado.cfo === 'error' ? 'No disponible ahora. No significa que sea cero.' : 'Todavía no hay un mes completo con importes.'};
  return {...base, estado: 'ok', valor: rev.display, periodo: b.mesDelResumen, nota: `${b.titular.periodo ?? ''} · ${b.moneda}${rev.cobertura ? ' · ' + rev.cobertura : ''}`.replace(/^ · /, ''),
    delta: rev.delta ? `${rev.delta.display} vs ${rev.delta.vs}` : null,
    variacion: rev.delta ? variacion(rev.delta.display, rev.delta.bps ?? (String(rev.delta.display).trim().startsWith('-') ? -1 : 1), 'up') : null,
    serie: (b.serie?.principal ?? []).filter(p => !p.partial && p.value != null).slice(-8).map(p => p.value), serieEtiqueta: 'Ingreso bruto por mes completo', clase: rev.kind === 'estimated' || rev.kind === 'inferred' ? rev.kind : 'observed',
    sello: sello({clase: rev.kind, fuente: 'Libro económico', hasta: cfo.report.watermark, actualizado: cfo.report.generatedAt, ahora}), cfoInfo: {mes: b.mesDelResumen, how: rev.how, cobertura: rev.cobertura}};
}
function kpiReembolsos({fuga, estado, ahora}) {
  const base = {id: 'reembolsos', etiqueta: 'Reembolsos', como: 'reembolsos'};
  if (estado.fuga === 'sin_acceso') return {...base, estado: 'sin_acceso', valor: null, nota: 'Lo ven propietarios y analistas.'};
  if (estado.fuga === 'cargando') return {...base, estado: 'cargando'};
  if (!ok(fuga?.titular)) return {...base, estado: 'no_disponible', valor: null, nota: fuga?.titular?.status === 'empty' ? 'No hay reembolsos cargados en este periodo.' : 'No disponible ahora. No significa que no haya reembolsos.'};
  const t = fuga.titular, inten = (fuga.cambios?.reembolsos ?? []).filter(x => x.intensidadPct != null).map(x => `${NOMBRE[x.canal] ?? x.canal} ${pct(x.intensidadPct)}`);
  const cambio = (fuga.cambios?.reembolsos ?? []).find(x => x.reembolsosPrevio > 0), canales = Object.values(fuga.intensidad?.canales ?? {});
  const mejor = canales.map(c => (c.meses ?? []).filter(m => m.calidad === 'completo')).sort((a, b) => b.reduce((s, m) => s + m.reembolsos, 0) - a.reduce((s, m) => s + m.reembolsos, 0))[0] ?? [];
  const pc = cambio ? ((cambio.reembolsos - cambio.reembolsosPrevio) / cambio.reembolsosPrevio) * 100 : null;
  return {...base, estado: 'ok', valor: usd(t.usdBrutoMinor), periodo: rangoTxt(t.rango), clase: 'observed',
    variacion: pc == null ? null : variacion(`${pc > 0 ? '+' : ''}${pc.toFixed(1)} %`, pc, 'down'), serie: mejor.slice(-8).map(m => m.reembolsos), serieEtiqueta: 'Reembolsos por mes completo',
    nota: `${num(t.n)} reembolsos${inten.length ? ' · intensidad ' + inten.join(' · ') : ''}`,
    sello: sello({clase: 'observed', fuente: 'Libro de reembolsos', hasta: t.rango?.hasta ?? null, actualizado: fuga.generatedAt, ahora})};
}
function kpiAtorado({fuga, estado, ahora}) {
  const base = {id: 'atorado', etiqueta: 'Dinero atorado', como: 'atorado'};
  if (estado.fuga === 'sin_acceso') return {...base, estado: 'sin_acceso', valor: null, nota: 'Lo ven propietarios y analistas.'};
  if (estado.fuga === 'cargando') return {...base, estado: 'cargando'};
  const t = fuga?.tracker;
  if (!ok(t)) return {...base, estado: 'no_disponible', valor: null, nota: t?.status === 'empty' ? 'Aún no hay filas del Tracker cargadas.' : 'No disponible ahora. No significa que no haya casos.'};
  const monto = NEGADOS.reduce((a, k) => a + (t.montoPorEstado?.[k] ?? 0), 0);
  const estados = NEGADOS.map(k => ({id: k, valor: t.estados?.[k] ?? 0})).filter(e => e.valor > 0);
  return {...base, estado: 'ok', valor: `${num(t.negados)} casos`, clase: 'observed', estados,
    nota: monto > 0 ? `${usd(String(Math.round(monto)))} con monto (USD supuesto) · vencidos, rechazados o no reembolsables` : 'Vencidos, rechazados o no reembolsables · sin monto registrado',
    sello: sello({clase: 'observed', fuente: 'Tracker de Excel', hasta: null, actualizado: fuga.generatedAt, ahora})};
}
function kpiRespuestas({carga, estado, ahora}) {
  const base = {id: 'respuestas24', etiqueta: 'Respuestas >24 h', como: 'respuestas24'};
  if (estado.carga === 'sin_acceso') return {...base, estado: 'sin_acceso', valor: null, nota: 'Lo ven propietarios y analistas.'};
  if (estado.carga === 'cargando') return {...base, estado: 'cargando'};
  const s = carga?.sla;
  if (!ok(s)) return {...base, estado: 'no_disponible', valor: null, nota: s?.status === 'empty' ? 'Aún no hay hilos de HubSpot cargados.' : 'No disponible ahora. No significa que no haya hilos pendientes.'};
  const porDia = ok(carga?.carga) ? (carga.carga.porDia ?? []).map(d => d.promedioPorDia) : [];
  return {...base, estado: 'ok', valor: `${num(s.abiertosSinRespuesta24h)} hilos`, clase: 'observed', serie: porDia.length > 1 ? porDia : undefined, serieEtiqueta: 'Conversaciones por día de la semana (promedio)', nota: 'Abiertos sin respuesta de agente registrada · solo conteo · HubSpot',
    sello: sello({clase: 'observed', fuente: 'HubSpot API', hasta: s.corte, actualizado: s.generatedAt ?? carga.generatedAt, ahora})};
}

/** Titular narrativo con periodo: una frase con una cifra de dinero y lo que significa. */
function titularDe({fuga, kpis}) {
  const t = fuga?.titular;
  if (ok(t)) {
    const top10 = t.top10?.pct != null && fuga.skus?.top?.length ? ` ${fuga.skus.top.length} SKUs explican el ${pct(t.top10.pct)}.` : '';
    const r = rangoTxt(t.rango);
    return {texto: `Se devolvieron ${usd(t.usdBrutoMinor)} brutos${r ? ' del ' + r : ''}.${top10}`, periodo: r, clase: 'observed'};
  }
  const rev = kpis.find(k => k.id === 'ingreso' && k.estado === 'ok');
  if (rev) return {texto: `En ${rev.periodo}: ${rev.valor} de ingreso bruto.`, periodo: rev.periodo, clase: 'observed'};
  return {texto: 'Todavía no hay datos suficientes para resumir tu dinero de este periodo.', periodo: null, clase: null};
}

/** «Requiere tu atención (3)»: candidatos con su dinero en juego; el mayor primero, los que no tienen monto al final. */
export function atencionDe({fuga, carga}) {
  const c = [];
  const top = fuga?.skus?.status === 'ok' ? fuga.skus.top[0] : null;
  if (top) c.push({id: 'fuga-sku', titulo: `Fuga en el SKU ${top.sku}`, detalle: `${num(top.n)} reembolsos · ${NOMBRE[top.canales?.[0]?.canal] ?? 'varios canales'} · es el #1 del periodo`, dineroMinor: Number(BigInt(String(top.usdBrutoMinor).split('.')[0])), dinero: usd(top.usdBrutoMinor), href: '/refunds#fg-skus', clase: 'observed'});
  const t = fuga?.tracker;
  if (ok(t) && (t.estados?.vencido ?? 0) > 0) c.push({id: 'vencidos', titulo: `${num(t.estados.vencido)} solicitudes vencidas (más de 180 días)`, detalle: 'Ya no se pueden reclamar a la plataforma si no se atienden', dineroMinor: t.montoPorEstado?.vencido ?? 0, dinero: t.montoPorEstado?.vencido > 0 ? usd(String(Math.round(t.montoPorEstado.vencido))) : null, href: '/refunds#fg-tracker', clase: 'observed'});
  if (ok(carga?.sla) && carga.sla.abiertosSinRespuesta24h > 0) c.push({id: 'sin-respuesta', titulo: `${num(carga.sla.abiertosSinRespuesta24h)} hilos sin respuesta de más de 24 h`, detalle: 'Riesgo de reclamo en la plataforma · conteo de HubSpot', dineroMinor: 0, dinero: null, href: '/workload', clase: 'observed'});
  const pico = ok(carga?.carga) ? carga.carga.horasPico?.[0] : null;
  if (pico) c.push({id: 'pico', titulo: `Pico de carga: ${horaTxtSeguro(pico.hora)}`, detalle: `${pico.promedioPorDia} conversaciones por día en promedio a esa hora`, dineroMinor: 0, dinero: null, href: '/workload', clase: 'observed'});
  return c.sort((a, b) => b.dineroMinor - a.dineroMinor).slice(0, 3).map(({id, titulo, detalle, dinero, href, clase}) => ({id, titulo, detalle, dinero, href, clase}));
}

/** Barra «observado vs recuperable»: lo observado es sólido; lo recuperable es [E], rayado y NO tiene cifra hasta que la persona teclee sus supuestos. */
export function barraDe({fuga}) {
  const t = fuga?.titular;
  if (!ok(t)) return null;
  return {observado: usd(t.usdBrutoMinor), observadoEtiqueta: 'Devuelto observado', recuperable: null, recuperableEtiqueta: 'Recuperable', recuperableNota: 'Sin tus supuestos no hay cifra. Teclea el % atribuible a proveedor y el % recuperable.', href: '/refunds#fg-estimador'};
}

/** Siguiente mejor acción: preparar el paquete de reclamo del SKU con más dinero devuelto. Es un borrador local; un humano lo envía. */
export function siguienteDe({fuga}) {
  const top = fuga?.skus?.status === 'ok' ? fuga.skus.top[0] : null;
  if (!top) return null;
  return {titulo: `Preparar el paquete de reclamo de ${top.sku}`, detalle: `${usd(top.usdBrutoMinor)} devueltos en ${num(top.n)} reembolsos. Se arma un borrador en tu navegador; no se envía nada.`, cta: 'Preparar paquete', href: '/refunds#fg-acciones', secundaria: {texto: 'Preguntar a Rovaq', href: '/preguntale'}};
}

/** @param {{fuga?, carga?, cfo?, estado:{fuga,carga,cfo}, ahora?:number}} a */
export function armarHoy({fuga = null, carga = null, cfo = null, estado, ahora = Date.now()}) {
  const kpis = [kpiIngreso({cfo, estado, ahora}), kpiReembolsos({fuga, estado, ahora}), kpiAtorado({fuga, estado, ahora}), kpiRespuestas({carga, estado, ahora})];
  const titular = titularDe({fuga, kpis});
  const cargando = Object.values(estado).every(e => e === 'cargando');
  const sinNada = !cargando && kpis.every(k => k.estado !== 'ok' && k.estado !== 'cargando');
  return {titular, kpis, atencion: atencionDe({fuga, carga}), barra: barraDe({fuga}), siguiente: siguienteDe({fuga}), cargando, vacio: sinNada,
    ctxComo: {fuga, carga, cfo: kpis[0].cfoInfo ?? null}};
}
