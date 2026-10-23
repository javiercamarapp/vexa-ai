// Lectura humana de los análisis de conversaciones: qué hallazgo dejó cada uno, su severidad y cuánto del total de conversaciones cubren.
import {etiquetaCategoria} from './categorias.mjs';
export const SEVERIDAD = Object.freeze({low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica', unknown: 'Sin determinar'});
const ORDEN = ['critical', 'high', 'medium', 'low', 'unknown'];
export const tonoSeveridad = (s) => (s === 'critical' || s === 'high' ? 'bad' : s === 'medium' ? 'warn' : s === 'low' ? 'ok' : 'neutral');
/** Evidencia de una ejecución (`/api/extraction/:id/evidence`) -> título del hallazgo principal, severidad máxima y nº de citas. null = aún no consultada. */
export function resumenEvidencia(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const issues = Array.isArray(ev.issues) ? ev.issues : [];
  if (issues.length === 0) return {titulo: null, otros: 0, severidad: null, citas: 0, sinConclusion: true};
  const ordenados = [...issues].sort((a, b) => ORDEN.indexOf(a.severity ?? 'unknown') - ORDEN.indexOf(b.severity ?? 'unknown') || (b.evidence?.length ?? 0) - (a.evidence?.length ?? 0));
  const top = ordenados[0];
  return {titulo: etiquetaCategoria(top.category), otros: issues.length - 1, severidad: ORDEN.includes(top.severity) ? top.severity : 'unknown', citas: issues.reduce((n, i) => n + (i.evidence?.length ?? 0), 0), sinConclusion: false};
}
/** «6 de ≈41,200 conversaciones cargadas». `total` viene de una muestra (Estimado) o es null (No disponible): nunca se inventa. */
export function coberturaAnalisis({analizadas, total, estimado = true}) {
  const n = Number(analizadas) || 0, f = (v) => Number(v).toLocaleString('es-MX');
  if (total === null || total === undefined || !Number.isFinite(Number(total)) || Number(total) <= 0) return {texto: `${f(n)} conversaciones analizadas`, nota: 'El total de conversaciones cargadas no está disponible ahora.', bps: null};
  return {texto: `${f(n)} de ${estimado ? '≈' : ''}${f(total)} conversaciones cargadas`, nota: estimado ? 'El total sale de una muestra rotulada como Estimado.' : '', bps: Math.round((n * 10000) / Number(total))};
}
