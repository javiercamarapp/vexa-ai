import {NextRequest, NextResponse} from 'next/server';
import {AccessError} from '../../../../../../lib/auth';
import {HEADERS} from '../../../../../../components/platform/server/copilot-http';
import {allowed, cfoAccessForRequest, loadReport, publicReport} from '../../_lib/access';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
/** Informe CFO de la organización de la sesión. Solo owner y analyst. Nunca acepta tenant en la URL. */
export async function GET(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  try {
    if (request.nextUrl.search.replace(/[?&](as|demo)=[a-z]+/g, '')) throw new AccessError(400, 'unsupported_filter');
    const r = await cfoAccessForRequest(request); finish = r.finish;
    if (!allowed(r.access.role)) throw new AccessError(403, 'cfo_role_required');
    return finish(NextResponse.json({data: publicReport(await loadReport(r.access))}, {headers: HEADERS}));
  } catch (error) {
    const e = error as {status?: number; message?: string}; const status = [400, 401, 403, 503].includes(e.status ?? 0) ? e.status! : 503;
    return finish(NextResponse.json({error: {code: status === 403 ? 'cfo_role_required' : status === 401 ? 'authentication_required' : status === 400 ? 'unsupported_filter' : 'cfo_unavailable'}}, {status, headers: HEADERS}));
  }
}
