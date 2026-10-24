// «Carga y SLA»: lo que SÍ se puede medir con HubSpot como fuente de verdad (Zendesk NO se usa mientras su configuración esté en transición).
//  1. Mapa de carga: conversaciones entrantes (primer mensaje del cliente) por hora del día y día de la semana, en America/Mexico_City, solo meses completos.
//  2. Riesgo de SLA de 24 h: primera respuesta de agente en los hilos de HubSpot API (con su base y su cobertura) + hilos abiertos sin respuesta >24 h (solo conteos).
//  3. Cierre y reaperturas: se leen de insight_thread_resolution (precalculado).
// Solo lectura, acotada al tenant, bajo la RLS del usuario, cada parte en su SAVEPOINT con tope de tiempo: si no responde -> {status:'unavailable'} (jamás 0). Sin PII: solo conteos y horas.
import {guarded} from './catalog-overview.mjs';
import {conversacionesPorMes} from './fuga-reembolsos.mjs';
import {readThreadResolution} from '../insights/reader.mjs';
import {leerSlaPrecalculado} from './precalculado-frio.mjs';

export const TZ = 'America/Mexico_City';
export const CARGA_BUDGETS_MS = Object.freeze({meses: 2500, precalc: 1500, matriz: 9000, canal: 3000, sla: 20000, slaPre: 2500, cierre: 2500});
export const MESES_CARGA = 6;
export const DIAS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
const addMes = (m, d) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + d, 1)).toISOString().slice(0, 7); };

/** Meses completos y comparables: se descarta el último mes con datos (puede estar cortado) y los que caen bajo la mitad del mes previo (suele ser hueco de exportación). */
export function mesesParaCarga(meses, max = MESES_CARGA) {
  const orden = [...meses].filter(m => /^\d{4}-\d{2}$/.test(m.mes)).sort((a, b) => a.mes.localeCompare(b.mes));
  const excluidos = [], buenos = [];
  orden.forEach((m, i) => {
    if (i === orden.length - 1) { excluidos.push({mes: m.mes, motivo: 'mes_parcial'}); return; }
    const prev = orden[i - 1];
    if (prev && prev.mes === addMes(m.mes, -1) && m.n < prev.n / 2) { excluidos.push({mes: m.mes, motivo: 'posible_hueco'}); return; }
    if (m.n < 50) { excluidos.push({mes: m.mes, motivo: 'muy_pocos_datos'}); return; }
    buenos.push(m.mes);
  });
  return {usados: buenos.slice(-max), excluidos: excluidos.filter(e => e.mes >= (buenos.slice(-max)[0] ?? '9999')).slice(-6)};
}
/** Cuántas veces cae cada día de la semana (Lunes=0) en los meses dados. */
export function diasPorSemana(meses) {
  const n = Array(7).fill(0);
  for (const m of meses) {
    const ini = Date.parse(m + '-01T00:00:00Z'), fin = Date.parse(addMes(m, 1) + '-01T00:00:00Z');
    for (let t = ini; t < fin; t += 86400000) n[(new Date(t).getUTCDay() + 6) % 7]++;
  }
  return n;
}
/** rows = {dow:1..7 (ISO, lunes=1), hour:0..23, n}. Devuelve promedio de conversaciones por hora y día de la semana, y las tarjetas de planeación de turnos. */
export function armarCarga(rows, meses) {
  const dias = diasPorSemana(meses), total = rows.reduce((a, r) => a + Number(r.n), 0);
  const cuenta = Array.from({length: 7}, () => Array(24).fill(0));
  for (const r of rows) { const d = Number(r.dow) - 1, h = Number(r.hour); if (d >= 0 && d < 7 && h >= 0 && h < 24) cuenta[d][h] += Number(r.n); }
  const r1 = x => Math.round(x * 10) / 10;
  const matriz = cuenta.map((fila, d) => fila.map(n => (dias[d] ? r1(n / dias[d]) : 0)));
  const porDia = cuenta.map((fila, d) => ({dia: DIAS[d], total: fila.reduce((a, b) => a + b, 0), promedioPorDia: dias[d] ? r1(fila.reduce((a, b) => a + b, 0) / dias[d]) : 0, dias: dias[d]}));
  const diasTot = dias.reduce((a, b) => a + b, 0);
  const porHora = Array.from({length: 24}, (_, h) => ({hora: h, total: cuenta.reduce((a, f) => a + f[h], 0)})).map(x => ({...x, promedioPorDia: diasTot ? r1(x.total / diasTot) : 0, pct: total ? r1((x.total * 100) / total) : 0}));
  const horasPico = [...porHora].sort((a, b) => b.total - a.total || a.hora - b.hora).slice(0, 3);
  const horasValle = [...porHora].sort((a, b) => a.total - b.total || a.hora - b.hora).slice(0, 3);
  let celdaPico = null;
  cuenta.forEach((f, d) => f.forEach((n, h) => { if (!celdaPico || matriz[d][h] > celdaPico.promedio) celdaPico = {dia: DIAS[d], hora: h, promedio: matriz[d][h]}; }));
  const diasMenorCarga = [...porDia].sort((a, b) => a.promedioPorDia - b.promedioPorDia || a.dia.localeCompare(b.dia)).slice(0, 2);
  const max = Math.max(0, ...matriz.flat());
  return {total, matriz, porDia, porHora, horasPico, horasValle, celdaPico, diasMenorCarga, max};
}
const redond = x => (x == null ? null : Number(x) < 1 ? Math.round(Number(x) * 1000) / 1000 : Math.round(Number(x) * 10) / 10);
/** Una fila agregada de SQL -> cifras de SLA con su base. Primera respuesta = primer mensaje de agente posterior al primer mensaje del cliente. */
export function armarSla(r, {hoy = new Date(), umbralH = 24} = {}) {
  const n = k => Number(r?.[k] ?? 0);
  const hilos = n('hilos'), medibles = n('medibles'), conResp = n('con_resp'), dentro = n('dentro'), fuera = conResp - dentro;
  const pct = (a, b) => (b > 0 ? Math.round((a * 1000) / b) / 10 : null);
  const sinResp = medibles - conResp;
  const edad = {d1_7: n('abiertos_1_7'), d7_30: n('abiertos_7_30'), d30: n('abiertos_30')};
  const corte = r?.corte ? new Date(r.corte).toISOString() : null;
  return {
    umbralH, rango: r?.min_creado ? {desde: String(r.min_creado).slice(0, 10), hasta: String(r.max_creado).slice(0, 10)} : null, corte,
    hilos, medibles, sinMensajeCliente: hilos - medibles,
    conRespuestaRegistrada: conResp, dentro, fuera, sinRespuestaRegistrada: sinResp,
    pctDentroDeConRespuesta: pct(dentro, conResp), pctDentroDeMedibles: pct(dentro, medibles), pctConRespuesta: pct(conResp, medibles),
    primeraRespuestaP50h: redond(r?.p50_h), primeraRespuestaP90h: redond(r?.p90_h),
    abiertosSinRespuesta24h: n('abiertos_sin_resp_24'), edadAbiertos: edad, cerradosSinRespuestaRegistrada: n('cerrados_sin_resp'),
    generatedAt: hoy.toISOString(),
  };
}

export const NOTA_FUENTE = 'HubSpot es la fuente. Zendesk no se usa mientras su configuración esté en transición.';

export function createWorkloadRepository({database, now = () => new Date(), budgets = CARGA_BUDGETS_MS}) {
  return {
    async get() {
      const hoy = now();
      return database.transaction('read', async s => {
        const dl = k => Date.now() + budgets[k];
        // ---- carga ----
        const convs = await conversacionesPorMes(s, dl('meses'));
        let carga = {status: 'unavailable'};
        if (convs && convs.meses?.length) {
          const {usados, excluidos} = mesesParaCarga(convs.meses);
          if (usados.length) {
            const desde = usados[0] + '-01T00:00:00Z', hasta = addMes(usados.at(-1), 1) + '-01T00:00:00Z';
            // 1) tabla precalculada (propuesta 20261112000000; si no existe o no cubre todos los meses, falla en silencio) 2) cálculo en vivo con tope.
            let origen = 'precalculado';
            let rows = await guarded(s, dl('precalc'), 'carga_precalc', async () => {
              const r = (await s.query(`WITH b AS (SELECT dow, hour, month, n FROM public.insight_inbound_load WHERE tenant_id=$1 AND month = ANY($2::date[])) SELECT dow::int AS dow, hour::int AS hour, sum(n)::int AS n, (SELECT count(DISTINCT month) FROM b)::int AS meses FROM b GROUP BY 1,2 LIMIT 400`, [s.tenantId, usados.map(m => m + '-01')])).rows;
              return r.length && r.every(x => Number(x.meses) === usados.length) ? r : null;
            });
            if (!rows) { origen = 'en_vivo'; rows = await guarded(s, dl('matriz'), 'carga_matriz', async () => (await s.query(
              `WITH f AS (SELECT conversation_id, min(occurred_at) AS c1 FROM public.messages WHERE tenant_id=$1 AND deleted_at IS NULL AND role='customer' AND occurred_at >= ($2::timestamptz - interval '2 months') AND occurred_at < $3::timestamptz GROUP BY 1)
               SELECT extract(isodow FROM c1 AT TIME ZONE '${TZ}')::int AS dow, extract(hour FROM c1 AT TIME ZONE '${TZ}')::int AS hour, count(*)::int AS n
               FROM f WHERE c1 >= $2::timestamptz AND c1 < $3::timestamptz GROUP BY 1,2 LIMIT 400`, [s.tenantId, desde, hasta])).rows); }
            if (rows) carga = {status: rows.length ? 'ok' : 'empty', class: 'observed', zona: TZ, origen, meses: usados, excluidos, fuenteMeses: convs.fuente ?? null, ...armarCarga(rows, usados)};
          } else carga = {status: 'empty', note: 'No hay meses completos y comparables.', excluidos};
        }
        // ---- canal ----
        const can = await guarded(s, dl('canal'), 'carga_canal', async () => (await s.query(
          `SELECT count(*)::int AS total, count(*) FILTER (WHERE channel IS NOT NULL AND btrim(channel)<>'')::int AS con_canal FROM public.conversations WHERE tenant_id=$1 AND deleted_at IS NULL`, [s.tenantId])).rows[0]);
        const canal = can ? {status: 'ok', total: Number(can.total), conCanal: Number(can.con_canal), derivable: Number(can.total) > 0 && Number(can.con_canal) / Number(can.total) >= 0.9} : {status: 'unavailable'};
        // ---- SLA ----
        // 1) tabla precalculada (insight_thread_sla, 20261125000000; si no existe o está vacía, null) 2) cálculo en vivo con tope, partiendo de los hilos y buscando sus conversaciones/mensajes por índice.
        let slaOrigen = 'precalculado';
        let slaRow = await leerSlaPrecalculado(s, dl('slaPre'), hoy);
        if (!slaRow) { slaOrigen = 'en_vivo'; slaRow = await guarded(s, dl('sla'), 'carga_sla', async () => (await s.query(
          `WITH t AS (SELECT DISTINCT ON (original->'payload'->>'id') original->'payload'->>'id' AS tid, (original->'payload'->>'createdAt')::timestamptz AS creado, original->'payload'->>'status' AS estado, created_at AS visto
               FROM public.sync_raw_objects WHERE tenant_id=$1 AND original->'payload'->>'type' IS NULL AND original->'payload' ? 'createdAt' AND original->'payload' ? 'status' AND original->'payload'->>'createdAt' ~ '^\\d{4}-\\d\\d-\\d\\dT'
               ORDER BY original->'payload'->>'id', created_at DESC),
             j AS (SELECT t.tid, t.creado, t.estado, t.visto, f.c1, f.a1, extract(epoch FROM f.a1-f.c1)/3600 AS h
               FROM t LEFT JOIN public.conversations cv ON cv.tenant_id=$1 AND cv.external_id=t.tid AND cv.source='hubspot' AND cv.deleted_at IS NULL
               LEFT JOIN LATERAL (SELECT x.c1, (SELECT min(m.occurred_at) FROM public.messages m WHERE m.tenant_id=$1 AND m.conversation_id=cv.id AND m.deleted_at IS NULL AND m.role='agent' AND m.occurred_at>=x.c1) AS a1
                 FROM (SELECT min(occurred_at) AS c1 FROM public.messages WHERE tenant_id=$1 AND conversation_id=cv.id AND deleted_at IS NULL AND role='customer') x WHERE x.c1 IS NOT NULL) f ON true)
           SELECT count(*)::int AS hilos, count(c1)::int AS medibles, count(a1)::int AS con_resp, count(*) FILTER (WHERE a1 IS NOT NULL AND h<=24)::int AS dentro,
             (percentile_cont(0.5) WITHIN GROUP (ORDER BY h) FILTER (WHERE a1 IS NOT NULL))::numeric AS p50_h, (percentile_cont(0.9) WITHIN GROUP (ORDER BY h) FILTER (WHERE a1 IS NOT NULL))::numeric AS p90_h,
             count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='OPEN' AND c1 < $2::timestamptz - interval '24 hours')::int AS abiertos_sin_resp_24,
             count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='OPEN' AND c1 < $2::timestamptz - interval '24 hours' AND c1 >= $2::timestamptz - interval '7 days')::int AS abiertos_1_7,
             count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='OPEN' AND c1 < $2::timestamptz - interval '7 days' AND c1 >= $2::timestamptz - interval '30 days')::int AS abiertos_7_30,
             count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='OPEN' AND c1 < $2::timestamptz - interval '30 days')::int AS abiertos_30,
             count(*) FILTER (WHERE c1 IS NOT NULL AND a1 IS NULL AND estado='CLOSED')::int AS cerrados_sin_resp,
             to_char(min(creado) AT TIME ZONE '${TZ}','YYYY-MM-DD') AS min_creado, to_char(max(creado) AT TIME ZONE '${TZ}','YYYY-MM-DD') AS max_creado, max(visto) AS corte
           FROM j`, [s.tenantId, hoy.toISOString()])).rows[0]); }
        const sla = slaRow ? (Number(slaRow.hilos) > 0 ? {status: 'ok', class: 'observed', fuente: 'HubSpot API', nota: NOTA_FUENTE, origen: slaOrigen, ...(slaRow.refrescado ? {precalculadoAt: new Date(slaRow.refrescado).toISOString()} : {}), ...armarSla(slaRow, {hoy})} : {status: 'empty'}) : {status: 'unavailable'};
        // ---- cierre y reaperturas (precalculado) ----
        const cierre = await guarded(s, dl('cierre'), 'carga_cierre', async () => {
          const r = await readThreadResolution(s);
          if (r.availability !== 'ready' && r.availability !== 'partial') return {status: r.availability === 'absent' ? 'not_computed' : 'unavailable'};
          return r.overall ? {status: 'ok', class: 'observed', refreshedAt: r.meta?.refreshedAt ?? null, ...r.overall} : {status: 'empty'};
        }) ?? {status: 'unavailable'};
        return {generatedAt: hoy.toISOString(), class: 'observed', zona: TZ, nota: NOTA_FUENTE, carga, canal, sla, cierre,
          parts: {carga: carga.status, canal: canal.status, sla: sla.status, cierre: cierre.status}};
      });
    },
  };
}
