import {NextRequest, NextResponse} from 'next/server';
import {HEADERS, readJson} from '../../../../../components/platform/server/copilot-http';
import {FIXTURES, platformAccessForRequest} from '../../_lib/access';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Acciones seguras (confirmación + motivo + auditoría). `job.retry` NO está conectada a la base: en demostración se simula; en vivo responde 501. */
export async function POST(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  const fail = (status: number, code: string) => finish(NextResponse.json({error: {code}}, {status, headers: HEADERS}));
  try {
    const r = await platformAccessForRequest(request); finish = r.finish;
    const body = await readJson(request);
    if (Object.keys(body).some(k => !['action', 'ids', 'reason', 'requestId'].includes(k)) || body.action !== 'job.retry') return fail(400, 'input_invalid');
    const ids = body.ids, reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 25 || !ids.every(i => typeof i === 'string' && UUID.test(i)) || reason.length < 10 || reason.length > 300 || typeof body.requestId !== 'string' || !UUID.test(body.requestId)) return fail(400, 'input_invalid');
    if (!FIXTURES) return fail(501, 'action_not_connected');
    return finish(NextResponse.json({data: {accepted: ids.length, simulated: true}}, {headers: HEADERS}));
  } catch (error) {
    const e = error as {status?: number}; return fail([400, 401, 403, 413].includes(e.status ?? 0) ? e.status! : 503, e.status === 403 ? 'platform_access_denied' : 'platform_unavailable');
  }
}
