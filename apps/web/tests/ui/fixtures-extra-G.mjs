// Fixtures de «Mapa de problemas» (/map) y «Carga y SLA» (/workload). Solo auditoría visual. MAPA_VARIANT / CARGA_VARIANT = vacio | pocos | error.
import {vistaMapa, vistaCarga} from './mapa-sintetico.mjs';
const cache = new Map();
export async function respondExtra(url, method) {
  const p = new URL(url, 'http://x').pathname;
  if (method !== 'GET' || !['/api/map', '/api/workload'].includes(p)) return null;
  const variante = (p === '/api/map' ? process.env.MAPA_VARIANT : process.env.CARGA_VARIANT) ?? '';
  if (variante === 'error') return [503, {error: {code: 'unavailable'}}];
  const k = p + variante;
  if (!cache.has(k)) cache.set(k, await (p === '/api/map' ? vistaMapa({vacio: variante === 'vacio', pocos: variante === 'pocos'}) : vistaCarga({error: variante === 'sinsql'})));
  return [200, {data: cache.get(k)}];
}
