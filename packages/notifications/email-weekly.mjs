import {TOKENS, renderLayout, safeText, truncate, fmtMonto, fmtPct, fmtDelta} from './email-system.mjs';
import {appURL, baseHeaders, unsubscribeHeaders, ROLES} from './email-template.mjs';

// Reporte semanal (CORREOS-DISENO.md, E1). Función pura: no envía, no programa, no lee datos. Recibe cifras ya
// calculadas por el producto y devuelve asunto, HTML, texto plano y cabeceras. Solo ingreso bruto, nunca margen;
// lo que no tiene dato se muestra «—» con su motivo, jamás 0.
const ANTI = 'Rovaq nunca te pedirá tu contraseña por correo.';
const SUBJECT_MAX = 55;

const num = (v, name) => { if (!Number.isFinite(v)) throw Error('invalid_' + name); return v; };
const metric = (m, name) => {
  if (m === undefined || m === null) return {valor: null, delta: null, fuente: undefined};
  return {valor: m.valor === null || m.valor === undefined ? null : num(m.valor, name), delta: m.delta === null || m.delta === undefined ? null : num(m.delta, name + '_delta'), fuente: m.fuente === undefined ? undefined : safeText(m.fuente, 30, name + '_source')};
};
/** Variación con signo y tono: sube = bueno solo si `upIsGood`. Menos de 0.5 % se lee como atención. */
function chip(delta, upIsGood) {
  if (delta === null) return {};
  const tone = Math.abs(delta) < 0.5 ? 'warn' : (delta > 0) === upIsGood ? 'ok' : 'bad';
  return {chip: fmtDelta(delta), tone};
}

/**
 * @param {object} input
 * @param {string} input.appOrigin origen HTTPS de la app
 * @param {string} input.espacio nombre del espacio
 * @param {string} input.rol Propietario | Analista | Operador | Lector
 * @param {string} input.rango «14 al 20 de octubre de 2026»
 * @param {string} input.rangoCorto «14–20 oct» (va en el asunto)
 * @param {string} input.corte «20 oct»
 * @param {{valor:number|null,delta:number|null,fuente?:string}} input.ingreso
 * @param {{valor:number|null,delta:number|null,fuente?:string}} input.reembolsos
 * @param {{valor:number|null,delta:number|null,fuente?:string}} input.atorado
 * @param {{valor:number|null,antes:number|null,fuente?:string}} input.vencidas
 * @param {{nSku:number,pctSku:number}} [input.hallazgo]
 * @param {string} [input.fraseClave]
 * @param {Array<{label:string,monto:number}>} [input.dolores] hasta 3, ordenados por monto
 * @param {{titulo:string,impacto:string}} [input.accion]
 * @param {Array<{label:string,valor:string}>} [input.puntosNuevos] hasta 4 puntos de dolor nuevos o en aumento («Nuevo · $4.6k», «+23 % · $12.3k»); ya redactados
 * @param {{titulo:string,resumen:string}} [input.lecturaIA] lectura de IA YA GUARDADA (este reporte NO dispara IA); siempre rotulada «Inferido»
 * @param {'estimado'|'inferido'} [input.accionClase] clase de la acción (por defecto «estimado»; la que sale de IA es «inferido»)
 * @param {string[]} input.fuentes
 * @param {{informe:string,metodo:string,preferencias:string,baja:string}} input.urls
 * @param {boolean} [input.sinCambios]
 */
export function renderWeeklyReport(input) {
  const {appOrigin} = input;
  const rango = safeText(input.rango, 50, 'range');
  const rangoCorto = safeText(input.rangoCorto, 14, 'short_range');
  const corte = safeText(input.corte, 20, 'cutoff');
  const espacio = safeText(input.espacio, 40, 'space');
  if (!ROLES[input.rol]) throw Error('invalid_role');
  const rol = input.rol;
  if (!Array.isArray(input.fuentes) || !input.fuentes.length || input.fuentes.length > 4) throw Error('invalid_sources');
  const fuentes = input.fuentes.map(f => safeText(f, 30, 'source'));
  const urls = Object.fromEntries(['informe', 'metodo', 'preferencias', 'baja'].map(k => [k, appURL(input.urls?.[k], appOrigin)]));

  const ingreso = metric(input.ingreso, 'income'), reemb = metric(input.reembolsos, 'refunds'), atorado = metric(input.atorado, 'stuck');
  const v = input.vencidas ?? {};
  const vencidas = {valor: v.valor === null || v.valor === undefined ? null : num(v.valor, 'overdue'), antes: v.antes === null || v.antes === undefined ? null : num(v.antes, 'overdue_before'), fuente: v.fuente === undefined ? undefined : safeText(v.fuente, 30, 'overdue_source')};

  const money = m => (m.valor === null ? '—' : fmtMonto(m.valor));
  const note = m => (m.valor === null ? `sin dato de ${m.fuente ?? 'la fuente'}` : undefined);

  // Titular: el hallazgo con cifra.
  const sinCambios = input.sinCambios === true;
  let h1;
  if (sinCambios) h1 = 'Semana sin cambios relevantes';
  else if (reemb.valor !== null && input.hallazgo) h1 = `Se devolvieron ${money(reemb)}; ${num(input.hallazgo.nSku, 'sku')} SKUs explican el ${fmtPct(num(input.hallazgo.pctSku, 'sku_pct'), 0)}`;
  else if (reemb.valor !== null) h1 = `Se devolvieron ${money(reemb)} en la semana`;
  else h1 = 'Resumen de la semana';

  // Contexto: dos oraciones como máximo.
  const frase = input.fraseClave === undefined ? '' : safeText(input.fraseClave, 140, 'key_phrase');
  const trend = ingreso.delta === null ? 'No hay dato de ingreso bruto para comparar con la semana anterior.' : `El ingreso bruto ${ingreso.delta >= 0 ? 'subió' : 'bajó'} ${fmtPct(Math.abs(ingreso.delta))} contra la semana anterior.`;
  const context = `${sinCambios ? 'Las cifras casi no se movieron contra la semana anterior.' : trend}${frase ? ' ' + frase : ''} Todas las cifras son ingreso bruto, no margen.`;

  const kpis = [
    {label: 'Ingreso bruto', value: money(ingreso), color: TOKENS.kpi.ingreso, note: note(ingreso), ...chip(ingreso.delta, true)},
    {label: 'Reembolsos', value: money(reemb), color: TOKENS.kpi.reembolsos, note: note(reemb), ...chip(reemb.delta, false)},
    {label: 'Dinero atorado', value: money(atorado), color: TOKENS.kpi.atorado, note: note(atorado), ...chip(atorado.delta, false)},
    {label: 'Sin respuesta', value: vencidas.valor === null ? '—' : String(vencidas.valor), color: TOKENS.kpi.respuesta, note: vencidas.valor === null ? `sin dato de ${vencidas.fuente ?? 'la fuente'}` : undefined,
      ...(vencidas.valor !== null && vencidas.antes !== null ? {chip: `antes ${vencidas.antes}`, tone: vencidas.valor > vencidas.antes ? 'bad' : vencidas.valor < vencidas.antes ? 'ok' : 'warn'} : {})},
  ];

  const blocks = [{type: 'p', text: context}, {type: 'kpis', items: kpis}];
  const dolores = (input.dolores ?? []).slice(0, 3).map(d => ({label: safeText(d.label, 40, 'pain'), monto: num(d.monto, 'pain_amount')}));
  const detail = [];
  if (dolores.length) {
    const max = Math.max(...dolores.map(d => d.monto)) || 1;
    detail.push({type: 'h2', text: 'Principales puntos de dolor', sub: `Por monto de reembolsos asociados. Corte ${corte}.`});
    detail.push({type: 'rows', items: dolores.map(d => ({label: d.label, pct: (d.monto / max) * 100, value: fmtMonto(d.monto)}))});
  }
  const nuevos = (input.puntosNuevos ?? []).slice(0, 4).map(p => ({label: safeText(p.label, 40, 'new_point'), value: safeText(p.valor, 40, 'new_point_value')}));
  if (nuevos.length) {
    detail.push({type: 'h2', text: 'Puntos de dolor nuevos o en aumento', sub: `Frente al reporte anterior. Cifras acumuladas, ingreso bruto. Corte ${corte}.`});
    detail.push({type: 'list', rows: nuevos});
  }
  if (input.lecturaIA) {
    detail.push({type: 'h2', text: 'Lectura de IA', sub: 'Inferido por IA a partir de evidencia redactada; no es un dato observado.'});
    detail.push({type: 'callout', title: safeText(input.lecturaIA.titulo, 120, 'ai_title'), body: safeText(input.lecturaIA.resumen, 160, 'ai_summary'), bar: TOKENS.kpi.respuesta});
  }
  if (input.accion) {
    detail.push({type: 'h2', text: 'Acción recomendada'});
    detail.push({type: 'callout', title: safeText(input.accion.titulo, 120, 'action'), body: safeText(input.accion.impacto, 160, 'impact'), bar: TOKENS.kpi.accion});
  }
  detail.push({type: 'button', label: 'Abrir el informe completo', href: urls.informe});
  const inferido = Boolean(input.lecturaIA) || input.accionClase === 'inferido';
  detail.push({type: 'help', text: `Fuentes: ${fuentes.join(' y ')} · observado${inferido ? ', salvo la lectura de IA y la acción recomendada (inferidas)' : input.accion ? ', salvo la acción recomendada (estimado)' : ''}. Ver [cómo se calculó](${urls.metodo}).`});

  const footer = {strong: ANTI, motive: `Recibes este reporte cada lunes porque eres ${rol} en ${espacio}. [Elegir qué reportes recibir](${urls.preferencias}) · [Darme de baja de este reporte](${urls.baja})`};

  // Asunto: «Reporte semanal · 14–20 oct: reembolsos $123.4k», recortado a 55.
  const lead = `Reporte semanal · ${rangoCorto}: `;
  const wanted = sinCambios ? 'sin cambios' : input.titularCorto === undefined ? (reemb.valor === null ? 'resumen' : `reembolsos ${money(reemb)}`) : safeText(input.titularCorto, 80, 'short_title');
  const subject = (lead + truncate(wanted, Math.max(8, SUBJECT_MAX - lead.length))).slice(0, SUBJECT_MAX);

  const pre = sinCambios ? 'Las cuatro cifras de la semana, sin variaciones relevantes.' : `${reemb.valor === null ? 'Resumen de la semana' : `Reembolsos ${money(reemb)}`}${input.hallazgo ? `, ${input.hallazgo.nSku} SKUs explican el ${fmtPct(input.hallazgo.pctSku, 0)}` : ''}. ${input.accion ? 'Una acción por decidir.' : 'Sin acciones por decidir.'}`;

  const layout = renderLayout({go: false, assetOrigin: new URL(appOrigin).origin, subject, preheader: pre, eyebrow: `Reporte semanal · ${rango}`, h1, blocks: [...blocks, ...detail], footer});
  // `fmtPct` usa espacio sin separación en el HTML; en texto plano va un espacio normal.
  const text = layout.text.replace(/ /g, ' ');
  return {subject, preheader: pre, html: layout.html, text, headers: {...baseHeaders, Precedence: 'bulk', ...unsubscribeHeaders(urls.baja, appOrigin)}};
}
