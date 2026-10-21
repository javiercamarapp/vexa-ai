import {NextRequest, NextResponse} from 'next/server';
import {CFO_TOOLS, createBudget, createCopilot, createSimulatedModel} from '../../../../../../../../packages/cfo-copilot/src/index.mjs';
import {copilotError, copilotTurn, HEADERS} from '../../../../../components/platform/server/copilot-http';
import {cfoAccessForRequest, cfoAudit, loadReport, principalOf} from '../../_lib/access';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
// Presupuesto en memoria de la instancia (por organización). El tope real y su persistencia: ver NOTAS.md.
const budgets = new Map<string, ReturnType<typeof createBudget>>();
const CAP = BigInt(process.env.VEXA_COPILOT_MONTHLY_CAP_MICRO ?? '25000000');
const budgetFor = (tenant: string) => { let b = budgets.get(tenant); if (!b) { b = createBudget({monthlyCapMicro: CAP}); budgets.set(tenant, b); } return b; };
// El límite de turnos por minuto se comparte entre solicitudes de la instancia; el copiloto (y su bitácora, ligada a la sesión) se crea en cada solicitud.
const hits = new Map<string, number[]>();
function copilotFor(access: Awaited<ReturnType<typeof cfoAccessForRequest>>['access']) {
  return createCopilot({scope: 'tenant', tools: CFO_TOOLS, model: createSimulatedModel({scope: 'tenant'}), audit: cfoAudit(access), budget: budgetFor(access.tenantId), hits});
}
export async function GET(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  try {
    const r = await cfoAccessForRequest(request); finish = r.finish;
    const copilot = copilotFor(r.access), principal = principalOf(r.access);
    if (!copilot.status(principal).tools.length) return finish(copilotError({status: 403}));
    return finish(NextResponse.json({data: copilot.status(principal)}, {headers: HEADERS}));
  } catch (e) { return finish(copilotError(e)); }
}
export async function POST(request: NextRequest) {
  let finish = (r: NextResponse) => r;
  try {
    const r = await cfoAccessForRequest(request); finish = r.finish;
    const access = r.access; let memo: ReturnType<typeof loadReport> | null = null;
    // el informe se calcula una vez por turno; la organización sale SIEMPRE de la sesión, nunca del cuerpo
    const data = {async report(tenantId: string) { if (tenantId !== access.tenantId) throw new Error('tenant_mismatch'); const res = await (memo ??= loadReport(access)); return res.status === 'ok' ? {status: 'ok', report: res.report} : {status: res.status}; }};
    return finish(await copilotTurn(copilotFor(access), principalOf(access), request, {data}));
  } catch (e) { return finish(copilotError(e)); }
}
