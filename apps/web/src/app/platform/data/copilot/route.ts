import {NextRequest, NextResponse} from 'next/server';
import {PLATFORM_TOOLS, createBudget, createCopilot, createSimulatedModel} from '../../../../../../../packages/cfo-copilot/src/index.mjs';
import {copilotError, copilotTurn, HEADERS} from '../../../../components/platform/server/copilot-http';
import {loadPlatform, platformAccessForRequest, platformAudit, principalOf, type Access} from '../../_lib/access';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
// Tope mensual propio del copiloto de plataforma (US$ 25 por defecto; el real lo fija Javier). En memoria de la instancia: ver NOTAS.md.
const budget = createBudget({monthlyCapMicro: BigInt(process.env.VEXA_PLATFORM_COPILOT_CAP_MICRO ?? '25000000')});
const hits = new Map<string, number[]>();
const copilotFor = (access: Access) => createCopilot({scope: 'platform', tools: PLATFORM_TOOLS, model: createSimulatedModel({scope: 'platform'}), audit: platformAudit(access), budget, hits});
export async function GET(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  try {
    const r = await platformAccessForRequest(request); finish = r.finish;
    return finish(NextResponse.json({data: copilotFor(r.access).status(principalOf(r.access))}, {headers: HEADERS}));
  } catch (e) { return finish(copilotError(e)); }
}
export async function POST(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  try {
    const r = await platformAccessForRequest(request); finish = r.finish;
    let memo: ReturnType<typeof loadPlatform> | null = null;
    const data = {async view() { const s = await (memo ??= loadPlatform(r.access)); return s.status === 'ok' ? {status: 'ok', view: s.view} : {status: s.status}; }};
    return finish(await copilotTurn(copilotFor(r.access), principalOf(r.access), request, {data}));
  } catch (e) { return finish(copilotError(e)); }
}
