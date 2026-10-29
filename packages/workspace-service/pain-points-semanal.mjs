// «Puntos de dolor» (L5): REPORTE SEMANAL por organización. Arma el informe con los puntos de dolor NUEVOS o CRECIENTES frente al reporte anterior, su evidencia, la lectura de IA YA GUARDADA
// (este reporte NO dispara IA ni gasta) y la acción recomendada (solo propuesta). Reutiliza renderWeeklyReport. El ENVÍO REAL está detrás de un flag APAGADO: por defecto solo genera la vista previa
// y la registra en weekly_report_outbox. Cada correo lleva su enlace de baja de un clic (token HMAC por destinatario) y la baja se respeta al registrar y al enviar.
// Reglas: ingreso bruto (jamás margen), unknown ≠ 0 («—» con su motivo), sin PII (la lectura de IA se limpia y se descarta si parece traer datos personales), la IA es Inferido.
import {createHash} from 'node:crypto';
import {WorkspaceError} from './contracts.mjs';
import {corteDe, PROMPT_VERSION, pareceTenerPII} from './pain-points-ia.mjs';
import {idiomaDe} from '../notifications/idioma.mjs';
import {renderWeeklyReport} from '../notifications/email-weekly.mjs';
import {unsubscribeHeaders} from '../notifications/email-template.mjs';
import {firmarBaja, urlBaja} from '../notifications/baja-semanal.mjs';

export const UMBRAL_CRECE = 0.10;
const big = v => BigInt(String(v ?? '0').split('.')[0] || '0');
const dolares = minor => Number(big(minor)) / 100;
const fmt1 = n => n.toFixed(1).replace(/\.0$/, '');
/** «$4.6k» / «$1.23 M» / «$812»: igual que el correo. */
export const montoCorto = (n, idioma = 'es') => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}${idiomaDe(idioma) === 'en' ? 'M' : ' M'}` : n >= 1e3 ? `$${fmt1(n / 1e3)}k` : `$${Math.round(n)}`);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const abr = m => MESES[m].slice(0, 3);
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const abrEn = m => MESES_EN[m].slice(0, 3);
const iso = d => d.toISOString().slice(0, 10);
/** Lunes (UTC) de la semana de `hoy`. Es la clave de idempotencia del reporte. */
export function lunesDe(hoy) { const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; }
/** Semana que cubre el reporte: la anterior completa (lunes a domingo) a la semana de `hoy`. */
export function semanaCubierta(hoy, idioma = 'es') {
  const fin = lunesDe(hoy); fin.setUTCDate(fin.getUTCDate() - 1); const ini = new Date(fin); ini.setUTCDate(ini.getUTCDate() - 6);
  const mismo = ini.getUTCMonth() === fin.getUTCMonth();
  if (idiomaDe(idioma) === 'en') {
    return {desde: iso(ini), hasta: iso(fin), rango: mismo ? `${MESES_EN[fin.getUTCMonth()]} ${ini.getUTCDate()} to ${fin.getUTCDate()}, ${fin.getUTCFullYear()}` : `${MESES_EN[ini.getUTCMonth()]} ${ini.getUTCDate()} to ${MESES_EN[fin.getUTCMonth()]} ${fin.getUTCDate()}, ${fin.getUTCFullYear()}`,
      rangoCorto: mismo ? `${abrEn(fin.getUTCMonth())} ${ini.getUTCDate()}–${fin.getUTCDate()}` : `${abrEn(ini.getUTCMonth())} ${ini.getUTCDate()}–${abrEn(fin.getUTCMonth())} ${fin.getUTCDate()}`};
  }
  return {desde: iso(ini), hasta: iso(fin), rango: mismo ? `${ini.getUTCDate()} al ${fin.getUTCDate()} de ${MESES[fin.getUTCMonth()]} de ${fin.getUTCFullYear()}` : `${ini.getUTCDate()} de ${MESES[ini.getUTCMonth()]} al ${fin.getUTCDate()} de ${MESES[fin.getUTCMonth()]} de ${fin.getUTCFullYear()}`,
    rangoCorto: mismo ? `${ini.getUTCDate()}–${fin.getUTCDate()} ${abr(fin.getUTCMonth())}` : `${ini.getUTCDate()} ${abr(ini.getUTCMonth())}–${fin.getUTCDate()} ${abr(fin.getUTCMonth())}`};
}

/** Foto compacta de la vista (para comparar la semana siguiente): solo id, dinero bruto en unidades menores y volumen. Lo desconocido queda null con su causa (nunca 0). */
export const foto = vista => vista.puntos.filter(p => !p.agregado || p.id === 'P4').map(p => ({id: p.id, minor: p.dinero.sinDato ? null : String(p.dinero.minor), causa: p.dinero.sinDato ? p.dinero.causa : null, n: p.volumen.sinDato ? null : p.volumen.n}));

/**
 * Compara la vista actual con la foto del reporte anterior. Nuevo = ahora tiene dinero y antes no tenía punto o NO había fuente (un «no disponible ahora» de antes NO cuenta como nuevo: era desconocido).
 * Creciente = el acumulado subió ≥ 10 %. Sin foto anterior (primer reporte) no hay comparación: nada se declara nuevo.
 */
export function comparar(vista, anterior) {
  if (!Array.isArray(anterior)) return {primera: true, items: []};
  const items = [];
  for (const p of vista.puntos) {
    if (p.agregado || p.dinero.sinDato || big(p.dinero.minor) <= 0n) continue;
    const prev = anterior.find(x => x.id === p.id), ahora = big(p.dinero.minor);
    if (!prev || (prev.minor == null && prev.causa !== 'no_disponible')) { items.push({id: p.id, nombre: p.nombre, estado: 'nuevo', minor: String(ahora), deltaPct: null}); continue; }
    if (prev.minor == null || big(prev.minor) <= 0n) continue;
    const d = Number((ahora - big(prev.minor)) * 10000n / big(prev.minor)) / 10000;
    if (d >= UMBRAL_CRECE) items.push({id: p.id, nombre: p.nombre, estado: 'crece', minor: String(ahora), deltaPct: Math.round(d * 1000) / 10});
  }
  items.sort((a, b) => (big(b.minor) > big(a.minor) ? 1 : big(b.minor) < big(a.minor) ? -1 : a.id.localeCompare(b.id)));
  return {primera: false, items};
}

/** Texto de IA apto para el correo: sin marcado, sin direcciones, sin cifras tipo teléfono; null si parece PII o queda vacío. */
export function limpiarTexto(t, max) {
  if (typeof t !== 'string') return null;
  if (pareceTenerPII(t)) return null; // se revisa el texto ORIGINAL: limpiar antes escondería un correo o un enlace
  let v = t.replace(/[\x00-\x1f\x7f*[\]`\\{}]/g, ' ').replace(/@|:\/\/|www\./gi, ' ').replace(/\s+/g, ' ').trim();
  if (!v || /(?:\d[\s().-]?){7,}/.test(v)) return null;
  if (v.length > max) v = v.slice(0, max - 1).trimEnd() + '…';
  return v;
}
const ESTADO_IA = {acuerdo: 'las tres lecturas coinciden', acuerdo_parcial: 'acuerdo parcial entre las lecturas', desacuerdo: 'las lecturas se contradicen', incompleto: 'consenso incompleto', sin_lecturas: 'sin lecturas válidas'};
const ESTADO_IA_EN = {acuerdo: 'all three readings agree', acuerdo_parcial: 'partial agreement between the readings', desacuerdo: 'the readings contradict each other', incompleto: 'incomplete consensus', sin_lecturas: 'no valid readings'};
const primeraFrase = t => (t.match(/^.*?[.!?](?:\s|$)/)?.[0] ?? t).trim();

/**
 * Arma la entrada de renderWeeklyReport. Honestidad: el ingreso del periodo no existe en esta vista (— con motivo); «Reembolsos» es el CAMBIO del acumulado del libro frente al reporte anterior (se dice en el texto)
 * y es — en el primer reporte; «Dinero atorado» es el pendiente de Walmart (P2) con su variación; «Sin respuesta» no se mide aquí (—).
 */
export function construirInformeSemanal({vista, anterior, corridas = new Map(), espacio, rol, hoy, appOrigin, urls, idioma}) {
  const lang = idiomaDe(idioma), en = lang === 'en';
  const sem = semanaCubierta(hoy, lang), cmp = comparar(vista, anterior);
  const P = id => vista.puntos.find(p => p.id === id), prev = id => (anterior ?? []).find(x => x.id === id);
  const p4 = P('P4'), p2 = P('P2'), p4prev = prev('P4'), p2prev = prev('P2');
  const dReemb = p4 && !p4.dinero.sinDato && p4prev?.minor != null ? dolares(big(p4.dinero.minor) - big(p4prev.minor)) : null;
  const atorado = p2 && !p2.dinero.sinDato ? dolares(p2.dinero.minor) : null;
  const dAtorado = atorado !== null && p2prev?.minor != null && big(p2prev.minor) > 0n ? Math.round(Number((big(p2.dinero.minor) - big(p2prev.minor)) * 10000n / big(p2prev.minor))) / 100 : null;
  const conDinero = vista.puntos.filter(p => !p.agregado && !p.dinero.sinDato && big(p.dinero.minor) > 0n).sort((a, b) => (big(b.dinero.minor) > big(a.dinero.minor) ? 1 : -1));
  const dolores = conDinero.slice(0, 3).map(p => ({label: limpiarTexto(p.nombre, 40) ?? p.id, monto: dolares(p.dinero.minor)}));
  const puntosNuevos = cmp.items.slice(0, 4).map(i => ({label: limpiarTexto(i.nombre, 40) ?? i.id, valor: i.estado === 'nuevo' ? `${en ? 'New' : 'Nuevo'} · ${montoCorto(dolares(i.minor), lang)}` : `+${fmt1(i.deltaPct)}${en ? '%' : ' %'} · ${montoCorto(dolares(i.minor), lang)}`}));
  // IA ya guardada: el punto de mayor dinero que tenga una acción válida.
  let accion, lecturaIA, accionClase;
  for (const p of conDinero) {
    const run = corridas.get(p.id); const ok = (run?.lecturas ?? []).filter(l => l.estado === 'ok');
    const a = ok.find(l => l.rol === 'accion')?.contenido?.propuesta;
    if (!a) continue;
    const titulo = limpiarTexto(a.titulo, 120);
    if (!titulo) continue;
    accion = {titulo, impacto: en ? (limpiarTexto(`Proposal about "${p.nombre}" with the evidence for this point. A person decides; it does not run on its own.`, 160) ?? 'Proposal with the evidence for this point. A person decides; it does not run on its own.') : (limpiarTexto(`Propuesta sobre «${p.nombre}» con la evidencia del punto. Una persona decide; no se ejecuta sola.`, 160) ?? 'Propuesta con evidencia del punto. Una persona decide; no se ejecuta sola.')}; accionClase = 'inferido';
    const base = ok.find(l => l.rol === 'causa_raiz') ?? ok[0];
    const resumen = limpiarTexto(primeraFrase(base?.contenido?.lectura ?? ''), 160);
    if (resumen) lecturaIA = {titulo: limpiarTexto(`${p.nombre}: ${(en ? ESTADO_IA_EN : ESTADO_IA)[run.consenso?.estado] ?? (en ? 'consensus' : 'consenso')}`, 120) ?? (en ? 'AI reading' : 'Lectura de IA'), resumen};
    break;
  }
  const sinCambios = !cmp.primera && cmp.items.length === 0;
  const frase = cmp.primera ? (en ? 'First report: there is no previous week to compare against yet, so nothing is declared new.' : 'Primer reporte: aún no hay una semana anterior para comparar, así que nada se declara nuevo.') : dReemb === null ? undefined : (en ? 'Refunds is the change in the ledger running total versus the previous report, a derived figure.' : 'Reembolsos es el cambio del acumulado del libro frente al reporte anterior (cifra derivada).');
  const corte = (vista.puntos.map(p => p.corte).filter(Boolean).sort().at(-1) ?? vista.generatedAt).slice(0, 10).split('-');
  const corteTxt = en ? `${abrEn(Number(corte[1]) - 1)} ${Number(corte[2])}` : `${Number(corte[2])} ${abr(Number(corte[1]) - 1)}`;
  const top = p4?.detalle && !p4.dinero.sinDato ? p4.detalle : null;
  const input = {
    appOrigin, espacio, rol, ...(en ? {idioma: 'en'} : {}), rango: sem.rango, rangoCorto: sem.rangoCorto, corte: corteTxt,
    ingreso: {valor: null, delta: null, fuente: en ? 'revenue' : 'ingresos'},
    reembolsos: {valor: dReemb !== null && dReemb >= 0 ? dReemb : null, delta: null, fuente: en ? 'the ledger' : 'el libro'},
    atorado: {valor: atorado, delta: dAtorado, fuente: en ? 'the ledger' : 'el libro'},
    vencidas: {valor: null, antes: null, fuente: 'HubSpot'},
    ...(top && dReemb !== null && dReemb >= 0 ? {hallazgo: {nSku: Number(top.topSku), pctSku: Number(top.topPct)}} : {}),
    ...(frase ? {fraseClave: frase} : {}),
    ...(dolores.length ? {dolores} : {}), ...(puntosNuevos.length ? {puntosNuevos} : {}), ...(lecturaIA ? {lecturaIA} : {}), ...(accion ? {accion, accionClase} : {}),
    fuentes: en ? ['the economic ledger', 'the Tracker'] : ['el libro económico', 'el Tracker'], urls, ...(sinCambios ? {sinCambios: true} : {}),
  };
  return {input, foto: foto(vista), resumen: {nuevos: cmp.items.filter(i => i.estado === 'nuevo').length, crecen: cmp.items.filter(i => i.estado === 'crece').length, primera: cmp.primera, conIA: Boolean(lecturaIA)}};
}

const ROL_TXT = {owner: 'Propietario', analyst: 'Analista'};
const fn = async (s, nombre, args = [], casts = []) => (await s.query(`SELECT public.${nombre}(${args.map((_, i) => '$' + (i + 1) + (casts[i] ? '::' + casts[i] : '')).join(',')}) AS r`, args)).rows[0]?.r ?? null;
const clave = (tenant, semana, user) => createHash('sha256').update(`weekly|${tenant}|${semana}|${user}`).digest('hex');

/**
 * Servicio del reporte semanal de UNA organización. `database` es el del ACTOR DE SISTEMA (usuario del worker, miembro del tenant; acciones read e import). `entregar` solo se usa si `enviarActivo`.
 * @param {object} o
 * @param {string} o.tenantId organización del reporte (la misma de la sesión del actor de sistema)
 * @param {() => Promise<object>} o.vista lectura de los puntos (PainVista)
 * @param {object} o.store almacén de corridas de IA (solo buscarRun/ultimoRun: NUNCA dispara IA)
 * @param {Function|null} [o.entregar] ({tenantId,userId,subject,html,text,headers,idempotencyKey}) => {ok,providerId?,motivo?}
 */
export function createWeeklyService({database, tenantId, vista, store, entregar = null, enviarActivo = false, secret, appOrigin, nombreEspacio = 'tu espacio', now = () => new Date(), idioma = 'es'}) {
  async function corridasDe(v) {
    const mapa = new Map();
    const top = v.puntos.filter(p => !p.agregado && !p.dinero.sinDato && big(p.dinero.minor) > 0n).sort((a, b) => (big(b.dinero.minor) > big(a.dinero.minor) ? 1 : -1)).slice(0, 4);
    for (const p of top) { const run = (await store.buscarRun(p.id, corteDe(p, now()), PROMPT_VERSION)) ?? (await store.ultimoRun(p.id)); if (run) mapa.set(p.id, run); }
    return mapa;
  }
  return {
    async ejecutar() {
      const hoy = now(), semana = iso(lunesDe(hoy));
      if (typeof secret !== 'string' || secret.length < 32) throw new WorkspaceError('weekly_unsubscribe_unconfigured', 503);
      const v = await vista();
      const anterior = await database.transaction('read', async s => (await s.query('SELECT snapshot FROM public.weekly_report_outbox WHERE tenant_id=$1 AND week_start<$2::date ORDER BY week_start DESC, created_at DESC LIMIT 1', [s.tenantId, semana])).rows[0]?.snapshot ?? null);
      const corridas = await corridasDe(v);
      const destinatarios = await database.transaction('import', s => fn(s, 'weekly_recipients', [s.tenantId], ['uuid']));
      const r = {semana, destinatarios: destinatarios.length, registrados: 0, yaExistian: 0, bajas: 0, enviados: 0, suprimidos: 0, fallidos: 0, enviarActivo: Boolean(enviarActivo && entregar), primera: false, nuevos: 0, crecen: 0};
      for (const d of destinatarios) {
        const token = firmarBaja({secret, tenantId, userId: d.userId, now: hoy});
        const urls = {informe: new URL('/pain-points', appOrigin).href, metodo: new URL('/confianza', appOrigin).href, preferencias: new URL('/settings/notifications', appOrigin).href, baja: urlBaja(appOrigin, token, idiomaDe(d.idioma ?? idioma) === 'en' ? 'en' : undefined)};
        // Idioma: el de la persona si algún día el destinatario lo trae (`d.idioma`), si no el del servicio; por omisión «es».
        const b = construirInformeSemanal({vista: v, anterior, corridas, espacio: nombreEspacio, rol: ROL_TXT[d.role] ?? 'Analista', hoy, appOrigin, urls, idioma: d.idioma ?? idioma});
        const mail = renderWeeklyReport(b.input);
        r.primera = b.resumen.primera; r.nuevos = b.resumen.nuevos; r.crecen = b.resumen.crecen;
        const rec = await database.transaction('import', s => fn(s, 'weekly_report_record', [s.tenantId, JSON.stringify({weekStart: semana, userId: d.userId, subject: mail.subject, html: mail.html, text: mail.text, snapshot: b.foto})], ['uuid', 'jsonb']));
        if (rec.reason === 'baja') { r.bajas++; continue; }
        if (rec.inserted) r.registrados++; else r.yaExistian++;
        if (!enviarActivo || !entregar || !rec.id) continue;
        const claim = await database.transaction('import', s => fn(s, 'weekly_report_claim', [s.tenantId, rec.id], ['uuid', 'uuid']));
        if (!claim.send) { if (claim.reason === 'baja') r.suprimidos++; continue; }
        const guardado = await database.transaction('read', async s => (await s.query('SELECT subject,html,body_text FROM public.weekly_report_outbox WHERE tenant_id=$1 AND id=$2', [s.tenantId, rec.id])).rows[0]);
        let ok = false;
        try { const e = await entregar({tenantId, userId: d.userId, subject: guardado.subject, html: guardado.html, text: guardado.body_text, headers: {...mail.headers, ...unsubscribeHeaders(urls.baja, appOrigin)}, idempotencyKey: clave(tenantId, semana, d.userId)}); ok = e?.ok === true; } catch { ok = false; }
        await database.transaction('import', s => fn(s, 'weekly_report_mark', [s.tenantId, rec.id, ok ? 'sent' : 'failed'], ['uuid', 'uuid', 'text']));
        if (ok) r.enviados++; else r.fallidos++;
      }
      return r;
    },
  };
}
