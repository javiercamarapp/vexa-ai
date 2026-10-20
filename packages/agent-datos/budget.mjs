// Presupuesto y límites por tenant. Mismas unidades que el gateway: USD en micro-USD (exponente 6), cadenas enteras sin signo.
// Reserva ANTES de llamar al modelo y liquida con el costo real (nunca se recorta un sobregiro conocido). El modo determinista cuesta 0.
import { LIMITS } from './contract.mjs';
const big = (v) => { if (typeof v !== 'string' || !/^\d{1,20}$/.test(v)) throw new Error('minor_units_invalid'); return BigInt(v); };

export function createAgentBudget({ limits = {}, defaultLimitMinor = '0', window = 'mes' } = {}) {
  const spent = new Map(), held = new Map(), open = new Map(); let n = 0;
  const limitOf = (t) => big(Object.hasOwn(limits, t) ? limits[t] : defaultLimitMinor);
  return {
    window,
    reserve({ tenantId, amountMinor }) {
      const amount = big(amountMinor);
      if (amount === 0n) return { ok: true, id: null };
      const total = (spent.get(tenantId) ?? 0n) + (held.get(tenantId) ?? 0n) + amount;
      if (total > limitOf(tenantId)) return { ok: false, reason: 'budget_exceeded' };
      held.set(tenantId, (held.get(tenantId) ?? 0n) + amount);
      const id = `r${++n}`; open.set(id, { tenantId, amount }); return { ok: true, id };
    },
    settle(id, actualMinor) {
      if (!id) return; const r = open.get(id); if (!r) return; open.delete(id);
      held.set(r.tenantId, (held.get(r.tenantId) ?? 0n) - r.amount);
      spent.set(r.tenantId, (spent.get(r.tenantId) ?? 0n) + big(actualMinor));
    },
    usage(tenantId) {
      const s = spent.get(tenantId) ?? 0n, h = held.get(tenantId) ?? 0n, l = limitOf(tenantId);
      return { spentMinor: String(s), reservedMinor: String(h), limitMinor: String(l), pct: l === 0n ? 100 : Math.min(100, Number((s + h) * 1000n / l) / 10), window, currency: 'USD', exponent: 6 };
    },
  };
}

/** Límite de turnos por conversación y de preguntas por usuario y día (en memoria; en producción vive en la base). */
export function createTurnLimiter({ maxTurnsPerConversation = LIMITS.maxTurnsPerConversation, perUserPerDay = 100 } = {}) {
  const day = new Map();
  return {
    check({ tenantId, userId, conversationTurns = 0, now = new Date() }) {
      if (conversationTurns >= maxTurnsPerConversation) return { ok: false, reason: 'turn_limit', limit: maxTurnsPerConversation };
      const key = `${tenantId}:${userId}:${now.toISOString().slice(0, 10)}`; const used = day.get(key) ?? 0;
      if (used >= perUserPerDay) return { ok: false, reason: 'daily_limit', limit: perUserPerDay };
      day.set(key, used + 1); return { ok: true };
    },
  };
}
