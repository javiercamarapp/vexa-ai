import {periodoLegible} from '../workspace/alcance.mjs';
import {LOCALE_INTL, type Idioma} from './idioma';
/** Rango [inicio, fin) con fin exclusivo, legible en el idioma activo: «1 oct – 31 oct 2026» / «Oct 1 – Oct 31, 2026». Fechas inválidas: null (la validez la decide periodoLegible). */
export function periodoDelAlcance(inicio: string, fin: string, idioma: Idioma): string | null {
  const es = periodoLegible(inicio, fin);
  if (idioma === 'es' || es === null) return es;
  const a = new Date(inicio.slice(0, 10) + 'T00:00:00Z'), ultimo = new Date(new Date(fin.slice(0, 10) + 'T00:00:00Z').getTime() - 86400000);
  const f = (d: Date, anio: boolean) => new Intl.DateTimeFormat(LOCALE_INTL[idioma], {day: 'numeric', month: 'short', ...(anio ? {year: 'numeric'} : {}), timeZone: 'UTC'}).format(d);
  if (a.getTime() === ultimo.getTime()) return f(a, true);
  return a.getUTCFullYear() === ultimo.getUTCFullYear() ? `${f(a, false)} – ${f(ultimo, true)}` : `${f(a, true)} – ${f(ultimo, true)}`;
}
