import 'server-only';
import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {CopilotError, type Copilot, type Principal} from '../../../../../../packages/cfo-copilot/src/index.mjs';
import {PRIVATE_HEADERS} from '../../../lib/auth';

export const HEADERS = {...PRIVATE_HEADERS, Vary: 'Cookie'};
export const MAX_BODY = 8192;
const stable = (v: unknown): string => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v as object).sort().map(k => JSON.stringify(k) + ':' + stable((v as Record<string, unknown>)[k])).join(',') + '}' : JSON.stringify(v ?? null);
/** Huella SHA-256 de los argumentos: la bitácora conserva qué se consultó sin guardar la pregunta ni los datos. */
export const argsHash = (args: unknown) => createHash('sha256').update(stable(args)).digest('hex');
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new CopilotError('input_invalid', 400);
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY) throw new CopilotError('input_limit', 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new CopilotError('input_invalid', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CopilotError('input_invalid', 400);
  return body as Record<string, unknown>;
}
/** POST /copilot: {question, history} o {tool, args}. Cualquier otro campo es 400 (nada de tenantId ni rol en el cuerpo). */
export async function copilotTurn(copilot: Copilot, principal: Principal, request: Request, ctx: unknown) {
  const body = await readJson(request);
  const allowed = new Set(['question', 'history', 'tool', 'args']);
  if (Object.keys(body).some(k => !allowed.has(k))) throw new CopilotError('input_invalid', 400);
  if (body.tool !== undefined && typeof body.tool !== 'string') throw new CopilotError('input_invalid', 400);
  if (body.history !== undefined && !Array.isArray(body.history)) throw new CopilotError('input_invalid', 400);
  const reply = await copilot.ask({principal, question: body.question as string | undefined, history: (body.history as unknown[]) ?? [], tool: (body.tool as string) ?? null, args: body.args ?? {}, ctx});
  return NextResponse.json({data: reply}, {headers: HEADERS});
}
export function copilotError(error: unknown) {
  const e = error as {status?: number; code?: string};
  const known = error instanceof CopilotError;
  const status = known ? e.status! : [401, 403, 429, 503].includes(e.status ?? 0) ? e.status! : 503;
  return NextResponse.json({error: {code: known ? e.code : status === 403 ? 'forbidden' : status === 401 ? 'unauthenticated' : 'copilot_unavailable'}}, {status, headers: HEADERS});
}
