// Fixtures de «Fuga de reembolsos» (/refunds). Solo auditoría visual. FUGA_VARIANT = sinrep | sintracker | vacio | error para ver los estados degradados.
import {vistaSintetica} from './fuga-sintetico.mjs';
const cache = new Map();
export async function respondExtra(url, method) {
  const p = new URL(url, 'http://x').pathname;
  if (p !== '/api/refunds' || method !== 'GET') return null;
  const variante = process.env.FUGA_VARIANT ?? '';
  if (variante === 'error') return [503, {error: {code: 'refunds_unavailable'}}];
  if (!cache.has(variante)) cache.set(variante, await vistaSintetica({sinRepetido: variante === 'sinrep', sinTracker: variante === 'sintracker', vacio: variante === 'vacio'}));
  return [200, {data: cache.get(variante)}];
}
