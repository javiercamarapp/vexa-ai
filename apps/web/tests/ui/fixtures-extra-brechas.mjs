// Fixtures de «Brechas de ingreso» (/gaps). Solo auditoría visual. GAPS_VARIANT = pendiente | sinordenes | sintracker | vacio | error para ver los estados degradados.
import {vistaSintetica} from './brechas-sintetico.mjs';
const cache = new Map();
export async function respondExtra(url, method) {
  const p = new URL(url, 'http://x').pathname;
  if (p !== '/api/gaps' || method !== 'GET') return null;
  const variante = process.env.GAPS_VARIANT ?? '';
  if (variante === 'error') return [503, {error: {code: 'gaps_unavailable'}}];
  if (!cache.has(variante)) cache.set(variante, vistaSintetica({variante}));
  return [200, {data: cache.get(variante)}];
}
