// Orquestador de un turno: validar -> límites y presupuesto -> planear (catálogo cerrado) -> ejecutar herramientas -> redactar -> verificar contrato.
// El texto que redacta un modelo solo se muestra si TODOS sus números salen de los resultados y no contiene enlaces ni citas; si no,
// se muestra el resumen determinista de las herramientas. Una respuesta que incumple el contrato (cifra sin clase o cobertura) no sale.
import { AgentError, LIMITS, ROLES, contractViolations, numbersGrounded, numbersIn } from './contract.mjs';
import { executeTool, catalogForModel, modelViewOf, monthLabel } from './tools.mjs';
import { createRuleModel } from './model.mjs';
import { defaultSuggestions } from './suggestions.mjs';

const CONTROL = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u2028\\u2029]', 'g');
const clean = (s, max) => String(s).replace(CONTROL, ' ').normalize('NFC').trim().slice(0, max);
const withTimeout = (p, ms, code) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new AgentError(code)), ms); })]).finally(() => clearTimeout(t)); };
const monthOf = (d) => d.toISOString().slice(0, 7);
const REFUSAL = { forecast: 'No hago proyecciones ni pronósticos: no tengo un modelo validado de ventas futuras y no voy a inventar una cifra.', causal: 'No afirmo causas: los datos muestran qué cambió y con qué evidencia, pero no demuestran por qué. Puedo comparar periodos o mostrar las citas de un problema.', unknown: 'Eso todavía no lo puedo consultar con las herramientas que tengo.' };

export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string').slice(-LIMITS.maxHistory).map((h) => ({ role: h.role, text: clean(h.text, LIMITS.maxHistoryTextChars) }));
}

export function createAgent({ model = createRuleModel(), budget, limiter, estimates = { planMinor: '4000', composeMinor: '6000' }, maxToolCalls = LIMITS.maxToolCallsPerTurn } = {}) {
  async function answer({ ctx: raw, port, question, history = [], directa, conversationTurns = 0, onEvent = () => {}, signal }) {
    const started = Date.now();
    const usage = { modelCalls: 0, toolCalls: 0, costMinor: '0', mode: model.kind === 'deterministic' ? 'deterministic' : 'model', fallback: false, guardRejected: false };
    const base = (status, text, extra = {}) => ({ status, text, figures: [], blocks: [], citations: [], sources: [], calc: [], missing: [], suggestions: [], usage: { ...usage, durationMs: Date.now() - started }, ...extra });
    const ctx = { tenantId: raw?.tenantId, userId: raw?.userId, role: raw?.role, now: raw?.now ?? new Date() };
    ctx.month = monthOf(ctx.now);
    if (!ctx.tenantId || !ctx.userId || !ROLES.includes(ctx.role)) return base('forbidden', 'Tu rol no tiene acceso a estas consultas.');
    if (port?.tenantId !== undefined && port.tenantId !== ctx.tenantId) throw new AgentError('port_tenant_mismatch');
    const q = typeof question === 'string' ? clean(question, LIMITS.maxQuestionChars + 1) : '';
    if (!q || q.length > LIMITS.maxQuestionChars) return base('invalid_input', `Escribe una pregunta de hasta ${LIMITS.maxQuestionChars} caracteres.`);
    const lim = limiter?.check({ tenantId: ctx.tenantId, userId: ctx.userId, conversationTurns, now: ctx.now });
    if (lim && !lim.ok) return base('rate_limited', lim.reason === 'turn_limit' ? `Esta conversación llegó a ${lim.limit} turnos; empieza un chat nuevo.` : `Llegaste a tus ${lim.limit} preguntas de hoy.`, { limit: lim });
    const hist = sanitizeHistory(history); let costMinor = 0n;
    const track = (u) => { if (u?.costMinor) costMinor += BigInt(u.costMinor); usage.costMinor = String(costMinor); };
    const check = () => { if (signal?.aborted) throw Object.assign(new Error('abort'), { name: 'AbortError' }); };
    const deadline = Date.now() + LIMITS.turnTimeoutMs;
    try {
      let calls = [];
      let planned;
      if (directa) {
        planned = { calls: [{ tool: directa.tool, args: directa.args ?? {} }] };
      } else {
        let hold = null;
        if (model.kind !== 'deterministic' && budget) {
          hold = budget.reserve({ tenantId: ctx.tenantId, amountMinor: estimates.planMinor });
          if (!hold.ok) return base('budget_exceeded', 'Se alcanzó el tope de IA de tu organización este mes; lo amplía tu administrador. Las preguntas sugeridas siguen funcionando.', { suggestions: defaultSuggestions(ctx.role) });
        }
        const vocabulary = { problems: ctx.role === 'analyst' || ctx.role === 'owner' ? ((await port.problems()).rows ?? []).map((p) => p.title) : [] };
        try {
          check(); usage.modelCalls += 1;
          planned = await withTimeout(model.plan({ question: q, history: hist, tools: catalogForModel(ctx.role), vocabulary, ctx: { month: ctx.month, now: ctx.now.toISOString(), role: ctx.role } }), Math.max(1000, deadline - Date.now()), 'plan_timeout');
          track(planned?.usage);
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
          // El modelo falló: modo determinista (sin LLM) en lugar de inventar. Se declara en `usage.fallback`.
          usage.fallback = true; usage.mode = 'deterministic';
          planned = await createRuleModel().plan({ question: q, history: hist, ctx, vocabulary });
        } finally { budget?.settle(hold?.id ?? null, usage.costMinor); }
      }
      if (planned?.clarify) return base('clarify', clean(planned.clarify, 300), { suggestions: defaultSuggestions(ctx.role) });
      if (planned?.outOfCatalog || !Array.isArray(planned?.calls) || !planned.calls.length) return base('out_of_catalog', REFUSAL[planned?.outOfCatalog] ?? REFUSAL.unknown, { suggestions: defaultSuggestions(ctx.role) });
      const seen = new Set();
      for (const c of planned.calls) { const key = JSON.stringify([c?.tool, c?.args ?? {}]); if (!seen.has(key) && typeof c?.tool === 'string') { seen.add(key); calls.push({ tool: c.tool, args: c.args ?? {} }); } }
      const overflow = calls.length > maxToolCalls; calls = calls.slice(0, maxToolCalls);

      const results = [];
      for (const c of calls) {
        check(); onEvent({ t: 'paso', fase: 'inicio', herramienta: c.tool });
        usage.toolCalls += 1;
        results.push(await executeTool({ name: c.tool, args: c.args, port, ctx }));
        onEvent({ t: 'paso', fase: 'fin', herramienta: c.tool });
      }
      const ok = results.filter((r) => r.status === 'ok'), nodata = results.filter((r) => r.status === 'no_data');
      if (!ok.length && !nodata.length) {
        const f = results.find((r) => r.status === 'forbidden') ?? results.find((r) => r.status === 'invalid_input') ?? results.find((r) => r.status === 'clarify') ?? results[0];
        const status = f.status === 'unavailable' ? 'unavailable' : f.status;
        return base(status, f.summary, { calc: [], suggestions: f.options ? f.options.map((o) => `¿Qué dicen los clientes sobre ${o}?`) : defaultSuggestions(ctx.role), missing: f.missing ?? [] });
      }

      // Texto determinista (siempre disponible) y, si hay modelo, su redacción verificada.
      const lines = results.filter((r) => r.status === 'ok' || r.status === 'no_data' || r.status === 'unavailable').map((r) => r.summary);
      const missing = [...new Set(results.flatMap((r) => r.missing ?? []))];
      let text = (ok.length ? '' : 'No tengo ese dato. ') + lines.join(' ') + (nodata.length && ok.length ? ' Para lo que no tengo: ' + missing.join('; ') + '.' : '') + (!ok.length && missing.length ? ` Qué falta cargar: ${missing.join('; ')}.` : '')
      usage.mode = usage.mode === 'deterministic' ? 'deterministic' : 'determinista+modelo';
      const sourceCitations = results.flatMap((r) => r.citations ?? []);
      if (model.kind !== 'deterministic' && model.compose && !usage.fallback && ok.length) {
        const hold2 = budget ? budget.reserve({ tenantId: ctx.tenantId, amountMinor: estimates.composeMinor }) : { ok: true, id: null };
        if (hold2.ok) {
          let before = usage.costMinor;
          try {
            check(); usage.modelCalls += 1;
            const out = await withTimeout(model.compose({ question: q, results: results.map(modelViewOf), ctx: { role: ctx.role } }), Math.max(1000, deadline - Date.now()), 'compose_timeout');
            track(out?.usage);
            const allowed = numbersIn(results.map((r) => ({ f: r.figures, b: r.blocks, s: r.summary, a: r.args, m: r.missing, n: r.notes })), numbersIn(q));
            const t = typeof out?.text === 'string' ? clean(out.text, 1200) : '';
            const leaks = sourceCitations.some((c) => c.quote.length >= 12 && t.includes(c.quote.slice(0, 40)));
            if (t && numbersGrounded(t, allowed) && !/https?:\/\/|www\.|\]\(|<\/?[a-z]/i.test(t) && !leaks) text = t; else usage.guardRejected = true;
          } catch (e) { if (e?.name === 'AbortError') throw e; usage.guardRejected = true; usage.costMinor = before; }
          finally { budget?.settle(hold2.id, String(BigInt(usage.costMinor) - BigInt(before))); }
        }
      }

      if (overflow) text += ` Respondí solo las primeras ${maxToolCalls} consultas.`;
      const answerObj = base(ok.length ? 'ok' : 'no_data', text, {
        figures: ok.flatMap((r) => r.figures), blocks: ok.flatMap((r) => r.blocks), citations: ok.flatMap((r) => r.citations ?? []),
        sources: [...new Map(results.flatMap((r) => r.sources ?? []).map((s) => [s.ref, s])).values()],
        calc: results.filter((r) => r.status === 'ok' || r.status === 'no_data').map((r) => ({ tool: r.tool, label: r.label, status: r.status, args: r.args, method: r.method, reads: r.reads, sources: r.sources, figures: (r.figures ?? []).length, durationMs: r.durationMs })),
        missing, notes: [...new Set(results.flatMap((r) => r.notes ?? []))],
      });
      if (!ok.length) answerObj.sources = [];
      if (ok.length) {
        const bad = contractViolations(answerObj);
        if (bad.length) return base('unavailable', 'No pude verificar la clase y la cobertura de las cifras, así que no las muestro. Reintenta o revisa la cobertura de tus datos.', { violations: bad });
      } else if (!answerObj.calc.length) return base('unavailable', text);
      answerObj.usage = { ...usage, durationMs: Date.now() - started };
      return answerObj;
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      if (e instanceof AgentError && /timeout/.test(e.code)) return base('unavailable', 'La consulta tardó demasiado; reintenta en un momento.');
      return base('unavailable', 'No disponible por ahora; reintenta en un momento.');
    }
  }
  return { answer, model };
}
export { monthLabel };
