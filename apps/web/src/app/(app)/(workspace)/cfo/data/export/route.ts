import {NextRequest, NextResponse} from 'next/server';
import {AccessError} from '../../../../../../lib/auth';
import {HEADERS} from '../../../../../../components/platform/server/copilot-http';
import {toCsv, toPdf} from '../../../../../../../../../packages/cfo-copilot/src/index.mjs';
import {allowed, cfoAccessForRequest, loadReport} from '../../_lib/access';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
/** CSV / PDF con EXACTAMENTE las filas y cifras de la pantalla (reportRows). */
export async function GET(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  try {
    const format = request.nextUrl.searchParams.get('format');
    if (format !== 'csv' && format !== 'pdf') throw new AccessError(400, 'unsupported_format');
    const r = await cfoAccessForRequest(request, {download: true}); finish = r.finish;
    if (!allowed(r.access.role)) throw new AccessError(403, 'cfo_role_required');
    const result = await loadReport(r.access);
    if (result.status !== 'ok') return finish(NextResponse.json({error: {code: 'cfo_no_data', status: result.status}}, {status: 409, headers: HEADERS}));
    const stamp = result.report.generatedAt.slice(0, 10), name = `informe-cfo-${stamp}.${format}`;
    const body = format === 'csv' ? toCsv(result.report, {synthetic: result.synthetic}) : new Uint8Array(toPdf(result.report, {synthetic: result.synthetic}));
    return finish(new NextResponse(body, {headers: {...HEADERS, 'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'X-Content-Type-Options': 'nosniff'}}));
  } catch (error) {
    const e = error as {status?: number; code?: string}; const status = [400, 401, 403, 503].includes(e.status ?? 0) ? e.status! : 503;
    return finish(NextResponse.json({error: {code: status === 400 ? 'unsupported_format' : status === 403 ? (e.code === 'support_export_blocked' ? 'support_export_blocked' : 'cfo_role_required') : status === 401 ? 'authentication_required' : 'cfo_unavailable'}}, {status, headers: HEADERS}));
  }
}
