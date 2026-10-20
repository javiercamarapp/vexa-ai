import { createAgent, createSyntheticStore, createSyntheticPort, SYNTHETIC_TENANTS, SYNTHETIC_NOW } from '../index.mjs';
export const store = createSyntheticStore();
export const ctxFor = (role = 'owner', tenantId = SYNTHETIC_TENANTS.A) => ({ tenantId, userId: 'user-1', role, now: new Date(SYNTHETIC_NOW) });
export const portFor = (tenantId = SYNTHETIC_TENANTS.A, opts = {}) => createSyntheticPort(store, { tenantId, ...opts });
export async function ask(question, { role = 'owner', tenantId = SYNTHETIC_TENANTS.A, model, budget, limiter, directa, history, conversationTurns, portOpts, estimates } = {}) {
  const agent = createAgent({ ...(model ? { model } : {}), ...(budget ? { budget } : {}), ...(limiter ? { limiter } : {}), ...(estimates ? { estimates } : {}) });
  return agent.answer({ ctx: ctxFor(role, tenantId), port: portFor(tenantId, portOpts), question, directa, history, conversationTurns });
}
export const ALL_TEXT = (a) => JSON.stringify({ t: a.text, f: a.figures, b: a.blocks, s: a.sources, c: a.calc, m: a.missing });
