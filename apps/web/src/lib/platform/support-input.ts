/** Validación pura de la entrada de «ver como» (sin servidor): la misma regla que la base, para fallar antes con un mensaje claro. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SUPPORT_MIN_REASON = 10, SUPPORT_MAX_REASON = 500, SUPPORT_MAX_MINUTES = 60, SUPPORT_MIN_MINUTES = 5, SUPPORT_DEFAULT_MINUTES = 30;
export type SupportStart = {operation: 'start'; tenant: string; reason: string; minutes: number; requestId: string};
export type SupportInput = SupportStart | {operation: 'end'};
export function parseSupportInput(body: Record<string, unknown>): SupportInput | null {
  if (body.operation === 'end') return Object.keys(body).length === 1 ? {operation: 'end'} : null;
  if (body.operation !== 'start' || Object.keys(body).some(k => !['operation', 'tenant', 'reason', 'minutes', 'requestId'].includes(k))) return null;
  const {tenant, reason, requestId} = body, minutes = body.minutes === undefined ? SUPPORT_DEFAULT_MINUTES : body.minutes;
  if (typeof tenant !== 'string' || !UUID.test(tenant) || typeof requestId !== 'string' || !UUID.test(requestId) || typeof reason !== 'string') return null;
  const motivo = reason.trim();
  if (motivo.length < SUPPORT_MIN_REASON || motivo.length > SUPPORT_MAX_REASON) return null;
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < SUPPORT_MIN_MINUTES || minutes > SUPPORT_MAX_MINUTES) return null;
  return {operation: 'start', tenant, reason: motivo, minutes, requestId};
}
