import {NextRequest, NextResponse} from 'next/server';
import {HEADERS} from '../../../../../components/platform/server/copilot-http';
import {loadPlatform, platformAccessForRequest} from '../../_lib/access';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  try {
    if (request.nextUrl.search) return NextResponse.json({error: {code: 'unsupported_filter'}}, {status: 400, headers: HEADERS});
    const r = await platformAccessForRequest(request); finish = r.finish;
    return finish(NextResponse.json({data: await loadPlatform(r.access)}, {headers: HEADERS}));
  } catch (error) {
    const e = error as {status?: number}; const status = [401, 403].includes(e.status ?? 0) ? e.status! : 503;
    return finish(NextResponse.json({error: {code: status === 403 ? 'platform_access_denied' : status === 401 ? 'platform_authentication_required' : 'platform_unavailable'}}, {status, headers: HEADERS}));
  }
}
