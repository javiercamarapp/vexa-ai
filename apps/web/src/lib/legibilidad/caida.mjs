// Explica una caída mes contra mes SOLO con lo que los datos permiten verificar (aritmética sobre cifras observadas), sin atribuir causas.
// Si la causa no se puede verificar, lo dice: «Causa no determinada» / "Cause not determined". Texto en el idioma activo (pares L(es, en)): `idioma` o el traductor `t`.
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {dinero, porcentaje, variacionDecimas} from '../formato/es-mx.mjs';
import {localeDe} from '../formato/idioma.mjs';
import {idiomaDe} from './trad.mjs';
const mesDe = (m, loc) => new Intl.DateTimeFormat(loc, {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(m + '-01T00:00:00Z'));
const cambioBps = (antes, despues) => { const d = variacionDecimas(despues, antes); return d === null ? null : d * 10; };
/** Causa en español (la que fijan las pruebas); en inglés ver `causaDe`. */
export const CAUSA = 'Causa no determinada: los datos no traen campañas, precios, inventario ni cambios de catálogo, así que no se puede atribuir la caída a un motivo.';
export const CAUSA_EN = 'Cause not determined: the data has no campaigns, prices, inventory or catalog changes, so the drop cannot be attributed to a cause.';
/** Causa en el idioma pedido. */
export const causaDe = (idioma) => (idioma === 'en' ? CAUSA_EN : CAUSA);
/**
 * @param report CfoReport (con `channelSeries` en cada base)
 * @param moneda código de moneda del bloque
 * @param opciones {umbralBps, idioma ('es'|'en'), t (traductor: si no hay idioma se toma de él)}
 * @returns null si no hay caída de al menos `umbralBps` entre los dos últimos meses completos; si no, {titulo, lineas[], causa}
 */
export function explicarVariacion(report, moneda, {umbralBps = 1000, idioma, t} = {}) {
  const id = idioma ?? idiomaDe(t), en = id === 'en', loc = localeDe(id);
  const L = (es, ing) => (en ? ing : es);
  const mes = (m) => mesDe(m, loc);
  const nf = (n) => Number(n).toLocaleString(loc);
  // Variación en décimas de punto porcentual (definición única: lib/formato/es-mx.mjs); 1000 pb = 10 % = 100 décimas.
  const pct = (decimas) => porcentaje(decimas / 10, {conSigno: true, idioma: id});
  const pc = report?.perCurrency?.find((c) => c.currency === moneda), base = pc?.orderBases?.[0];
  const prev = report?.prevComplete, last = report?.lastComplete;
  if (!pc || !base || !prev || !last) return null;
  const a = base.series.find((s) => s.month === prev), z = base.series.find((s) => s.month === last);
  if (!a || !z) return null;
  const bpsPed = cambioBps(a.n, z.n);
  const importeOk = a.known > 0 && z.known > 0, antesImp = importeOk ? BigInt(a.amount) : null, despuesImp = importeOk ? BigInt(z.amount) : null;
  const bpsImp = importeOk && antesImp > 0n ? variacionDecimas(despuesImp, antesImp) * 10 : null;
  if (!((bpsPed !== null && bpsPed <= -umbralBps) || (bpsImp !== null && bpsImp <= -umbralBps))) return null;
  const m$ = (v) => dinero(String(v), moneda, pc.exponent, {idioma: id});
  const lineas = [];
  const corte = diaCorte(report.watermark, id);
  lineas.push(L(`${mes(prev)} y ${mes(last)} son meses completos${corte ? ` (los datos llegan hasta el ${corte})` : ''}: la caída no viene de un mes a medias.`, `${mes(prev)} and ${mes(last)} are complete months${corte ? ` (data runs through ${corte})` : ''}: the drop does not come from a partial month.`));
  if (Array.isArray(report.partialMonths) && report.partialMonths.length) lineas.push(L(`${report.partialMonths.map(mes).join(', ')} está incompleto y no entra en la comparación.`, `${report.partialMonths.map(mes).join(', ')} ${report.partialMonths.length === 1 ? 'is' : 'are'} incomplete and not part of the comparison.`));
  lineas.push(L(`Pedidos: ${nf(a.n)} → ${nf(z.n)}${bpsPed === null ? '' : ' (' + pct(bpsPed / 10) + ')'}.${importeOk && bpsImp !== null ? ` Subtotal conocido: ${m$(antesImp)} → ${m$(despuesImp)} (${pct(bpsImp / 10)}).` : ' El subtotal de uno de los meses no tiene importes conocidos: no se compara.'}`,
    `Orders: ${nf(a.n)} → ${nf(z.n)}${bpsPed === null ? '' : ' (' + pct(bpsPed / 10) + ')'}.${importeOk && bpsImp !== null ? ` Known subtotal: ${m$(antesImp)} → ${m$(despuesImp)} (${pct(bpsImp / 10)}).` : ' The subtotal of one of the months has no known amounts: it is not compared.'}`));
  // Por canal (misma moneda y base): quién aporta la caída de pedidos y quién dejó de registrar.
  const canales = (base.channelSeries ?? []).map((c) => ({label: c.label, antes: c.series.find((s) => s.month === prev)?.n ?? 0, despues: c.series.find((s) => s.month === last)?.n ?? 0}));
  const caida = a.n - z.n, bajan = canales.filter((c) => c.despues < c.antes).sort((x, y) => (y.antes - y.despues) - (x.antes - x.despues));
  if (caida > 0 && bajan.length) lineas.push(L('Por canal: ', 'By channel: ') + bajan.slice(0, 3).map((c) => L(`${c.label} −${nf(c.antes - c.despues)} pedidos (${Math.round(((c.antes - c.despues) * 100) / caida)} % de la caída)`, `${c.label} −${nf(c.antes - c.despues)} orders (${Math.round(((c.antes - c.despues) * 100) / caida)}% of the drop)`)).join('; ') + '.');
  for (const c of canales.filter((x) => x.despues === 0 && x.antes > 0)) lineas.push(L(`${c.label} no tiene registros en ${mes(last)} y tenía ${nf(c.antes)} en ${mes(prev)}: puede ser una carga pendiente o una baja real, con estos datos no se distingue.`, `${c.label} has no records in ${mes(last)} and had ${nf(c.antes)} in ${mes(prev)}: it may be a pending upload or a real decline, and this data cannot tell them apart.`));
  const tA = a.known > 0 ? BigInt(a.amount) / BigInt(a.known) : null, tZ = z.known > 0 ? BigInt(z.amount) / BigInt(z.known) : null;
  if (tA !== null && tZ !== null && tA > 0n) { const bt = variacionDecimas(tZ, tA) * 10; lineas.push(L(`Ticket promedio conocido: ${m$(tA)} → ${m$(tZ)} (${pct(bt / 10)}): ${Math.abs(bt) < 500 ? 'casi no cambió, la caída es de volumen.' : bt > 0 ? 'subió, la caída de volumen es mayor que la de ingresos.' : 'también bajó.'}`, `Known average ticket: ${m$(tA)} → ${m$(tZ)} (${pct(bt / 10)}): ${Math.abs(bt) < 500 ? 'it barely changed, so the drop is in volume.' : bt > 0 ? 'it went up, so the drop in volume is larger than the drop in revenue.' : 'it also went down.'}`)); }
  return {titulo: L(`Qué dicen los datos sobre la caída (${moneda})`, `What the data says about the drop (${moneda})`), lineas, causa: causaDe(id)};
}
