// «Datos y fuentes»: una tarjeta por fuente con su estado, sus cifras exactas, hasta cuándo llegan sus datos y el rango que cubre.
// Reglas: una fuente nunca cargada es «Sin cargar» (no 0); un rango o una fecha que no existen se dicen «Sin …», jamás se inventan.
import {diaCorte} from '../../../../../packages/workspace-service/datos-hasta.mjs';
import {mesCorto} from '../formato/idioma.mjs';
import {X, idiomaDe} from './trad.mjs';
export const NOMBRES = Object.freeze({hubspot: 'HubSpot', associations: 'Asociaciones ticket–contacto', csv: 'Archivos CSV', ledger: 'Libro de pedidos y reembolsos', excel: 'Tracker (Excel)', attachments: 'Adjuntos', zendesk: 'Zendesk'});
export const UNIDADES = Object.freeze({hubspot: 'filas leídas', associations: 'relaciones', csv: 'filas', ledger: 'registros', excel: 'filas vigentes', attachments: 'archivos', zendesk: 'conversaciones'});
const mesLegible = (m, idioma) => mesCorto(m, idioma, {anio: true});
/** Primer y último mes con registros de una serie mensual -> «nov 2025 – oct 2026». Sin registros: null. */
export function rangoDeSerie(serie, tieneDatos, t = null) {
  const meses = (Array.isArray(serie) ? serie : []).filter((p) => p && tieneDatos(p)).map((p) => p.month).sort();
  if (!meses.length) return null;
  const a = mesLegible(meses[0], idiomaDe(t)), b = mesLegible(meses.at(-1), idiomaDe(t));
  return a && b ? (a === b ? a : `${a} – ${b}`) : null;
}
/** Identidad de las relaciones ticket–contacto desde `coverage.sources[associations].counts`. Sin esos conteos: null (no se adivina). */
export function identidad(fuente) {
  const c = fuente?.counts;
  if (!c || !(c.facts > 0)) return null;
  return {total: c.facts, vinculadas: c.resolved, sinIdentificar: c.pending, porRevisar: c.blocked, retenidas: c.retained, vinculosActivos: c.links, bps: Math.round((c.resolved * 10000) / c.facts), estimado: fuente.class === 'estimated'};
}
/** Tarjetas por fuente. `trends` aporta «datos hasta» y el rango de meses del libro y de las conversaciones (por mes de fecha, no por fuente de conversación). */
export function tarjetasFuentes(cobertura, trends, t = null) {
  const idioma = idiomaDe(t);
  const fuentes = Array.isArray(cobertura?.sources) ? cobertura.sources : [];
  const led = trends?.ledger, conv = trends?.conversations;
  const rangoLibro = led?.status === 'ok' ? rangoDeSerie(led.series, (p) => (p.orders?.count ?? 0) + (p.refunds?.count ?? 0) > 0, t) : null;
  const rangoConv = conv?.status === 'ok' ? rangoDeSerie(conv.series, (p) => p.count > 0, t) : null;
  return fuentes.map((s) => {
    const cargada = s.loaded === true, caida = s.status === 'timeout';
    let datosHasta = null, rango = null, rangoNota = null;
    if (s.key === 'ledger') { datosHasta = diaCorte(led?.completeness?.dataThrough, idioma) ?? null; rango = rangoLibro; }
    if (s.key === 'hubspot' || s.key === 'zendesk') { if (cargada && rangoConv) { rango = rangoConv; rangoNota = X(t, 'tr.lg.fu.rangoNota', 'Conversaciones por mes, todas las fuentes juntas.'); } if (s.key === 'hubspot') datosHasta = diaCorte(conv?.completeness?.dataThrough, idioma) ?? null; }
    return {
      clave: s.key, nombre: NOMBRES[s.key] ? X(t, 'tr.lg.fu.nom.' + s.key, NOMBRES[s.key]) : s.label, unidad: X(t, 'tr.lg.fu.uni.' + (UNIDADES[s.key] ? s.key : 'otro'), UNIDADES[s.key] ?? 'filas'),
      estado: caida ? 'no_disponible' : cargada ? 'cargada' : 'sin_cargar',
      clase: s.class, importaciones: s.imports, abiertas: s.openImports,
      leidas: s.total, incorporadas: s.incorporated, rechazadas: s.rejected, pendientes: s.pending,
      detalle: Array.isArray(s.detail) ? s.detail : [], nota: s.rejectionNote ?? null,
      ultimaCarga: diaCorte(s.lastUpdate, idioma) ?? null, datosHasta, rango, rangoNota,
      bps: s.total > 0 ? Math.round((s.incorporated * 10000) / s.total) : null,
    };
  });
}
