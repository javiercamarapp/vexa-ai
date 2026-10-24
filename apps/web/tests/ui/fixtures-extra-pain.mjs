// Fixtures de «Puntos de dolor» (/pain-points): lista y evidencia sintéticas. PAIN_VARIANT = vacio | parcial | error. Solo auditoría visual.
import {vistaPain, evidenciaPain} from './pain-sintetico.mjs';
export async function respondExtra(url, method) {
  const u = new URL(url, 'http://x'), p = u.pathname;
  if (method !== 'GET' || !p.startsWith('/api/pain-points')) return null;
  const v = process.env.PAIN_VARIANT ?? '';
  if (v === 'error') return [503, {error: {code: 'pain_points_unavailable'}}];
  if (p === '/api/pain-points') return [200, {data: vistaPain({vacio: v === 'vacio', parcial: v === 'parcial'})}];
  const m = /^\/api\/pain-points\/([^/]+)\/evidence$/.exec(p);
  if (m) { const e = evidenciaPain(decodeURIComponent(m[1]), u.searchParams.get('cursor')); return e ? [200, {data: e}] : [404, {error: {code: 'resource_not_found'}}]; }
  return null;
}
