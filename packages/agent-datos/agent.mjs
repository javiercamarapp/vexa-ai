// Orquestador de un turno: validar -> límites y presupuesto -> planear (catálogo cerrado) -> ejecutar herramientas -> redactar -> verificar contrato.
// El texto que redacta un modelo solo se muestra si TODOS sus números salen de los resultados y no contiene enlaces ni citas; si no,
// se muestra el resumen determinista de las herramientas. Una respuesta que incumple el contrato (cifra sin clase o cobertura) no sale.
import { AgentError, CONTRACT_VERSION, LIMITS, ROLES, contractViolations, numbersGrounded, numbersIn } from './contract.mjs';
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
    // `trace`: pasos REALES del turno (plan, herramientas, redacción, verificación), con tiempos medidos. Nunca texto del modelo.
    const trace = [];
    const base = (status, text, extra = {}) => ({ contractVersion: CONTRACT_VERSION, status, text, figures: [], blocks: [], citations: [], sources: [], calc: [], missing: [], suggestions: [], trace: trace.slice(), usage: { ...usage, durationMs: Date.now() - started }, ...extra });
    const note = (s) => { trace.push(s); onEvent({ t: 'traza', paso: s }); };
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
      let planned; const planStart = Date.now();
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
      if (!directa) note({ id: 'plan', kind: 'plan', label: 'Elegí qué consultar', estado: planned?.calls?.length ? 'ok' : 'sin_consulta', ms: Date.now() - planStart, detail: (usage.fallback ? 'El modelo no respondió: usé reglas deterministas. ' : usage.mode === 'deterministic' ? 'Reglas deterministas, sin modelo de lenguaje. ' : 'Un modelo eligió entre las consultas del catálogo cerrado. ') + (planned?.calls?.length ? `Consultas: ${planned.calls.slice(0, maxToolCalls).map((c) => c.tool).join(', ')}.` : 'Ninguna consulta del catálogo aplica.') });
      else note({ id: 'plan', kind: 'plan', label: 'Consulta directa del catálogo', estado: 'ok', ms: 0, detail: `Sin modelo: ejecuté ${directa.tool}.` });
      if (planned?.clarify) return base('clarify', clean(planned.clarify, 300), { suggestions: defaultSuggestions(ctx.role) });
      if (planned?.outOfCatalog || !Array.isArray(planned?.calls) || !planned.calls.length) return base('out_of_catalog', REFUSAL[planned?.outOfCatalog] ?? REFUSAL.unknown, { suggestions: defaultSuggestions(ctx.role) });
      const seen = new Set();
      for (const c of planned.calls) { const key = JSON.stringify([c?.tool, c?.args ?? {}]); if (!seen.has(key) && typeof c?.tool === 'string') { seen.add(key); calls.push({ tool: c.tool, args: c.args ?? {} }); } }
      const overflow = calls.length > maxToolCalls; calls = calls.slice(0, maxToolCalls);

      const results = [];
      for (const c of calls) {
        check(); onEvent({ t: 'paso', fase: 'inicio', herramienta: c.tool });
        usage.toolCalls += 1;
        const r = await executeTool({ name: c.tool, args: c.args, port, ctx });
        results.push(r);
        const step = { id: `tool:${results.length}`, kind: 'tool', tool: c.tool, label: r.label, estado: r.status, ms: r.durationMs ?? null, cifras: (r.figures ?? []).length, fuentes: (r.sources ?? []).map((x) => x.label), args: r.args ?? {} };
        trace.push(step); onEvent({ t: 'paso', fase: 'fin', herramienta: c.tool, estado: step.estado, ms: step.ms, cifras: step.cifras, fuentes: step.fuentes });
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
      let composeNote = { id: 'compose', kind: 'compose', label: 'Redacté la respuesta', estado: 'ok', ms: 0, detail: 'Resumen determinista de lo que devolvieron las consultas.' };
      if (model.kind !== 'deterministic' && model.compose && !usage.fallback && ok.length) {
        const hold2 = budget ? budget.reserve({ tenantId: ctx.tenantId, amountMinor: estimates.composeMinor }) : { ok: true, id: null };
        if (hold2.ok) {
          let before = usage.costMinor; const composeStart = Date.now();
          try {
            check(); usage.modelCalls += 1;
            const out = await withTimeout(model.compose({ question: q, results: results.map(modelViewOf), ctx: { role: ctx.role } }), Math.max(1000, deadline - Date.now()), 'compose_timeout');
            track(out?.usage);
            const allowed = numbersIn(results.map((r) => ({ f: r.figures, b: r.blocks, s: r.summary, a: r.args, m: r.missing, n: r.notes })), numbersIn(q));
            const t = typeof out?.text === 'string' ? clean(out.text, 1200) : '';
            const leaks = sourceCitations.some((c) => c.quote.length >= 12 && t.includes(c.quote.slice(0, 40)));
            if (t && numbersGrounded(t, allowed) && !/https?:\/\/|www\.|\]\(|<\/?[a-z]/i.test(t) && !leaks) { text = t; composeNote = { ...composeNote, ms: Date.now() - composeStart, detail: 'Un modelo redactó el texto; cada número coincide con las consultas.' }; } else { usage.guardRejected = true; composeNote = { ...composeNote, estado: 'descartado', ms: Date.now() - composeStart, detail: 'La redacción del modelo se descartó (números o enlaces no respaldados): mostré el resumen determinista.' }; }
          } catch (e) { if (e?.name === 'AbortError') throw e; usage.guardRejected = true; usage.costMinor = before; composeNote = { ...composeNote, estado: 'descartado', ms: Date.now() - composeStart, detail: 'El modelo no respondió: mostré el resumen determinista.' }; }
          finally { budget?.settle(hold2.id, String(BigInt(usage.costMinor) - BigInt(before))); }
        }
      }

      note(composeNote);
      if (overflow) text += ` Respondí solo las primeras ${maxToolCalls} consultas.`;
      const answerObj = base(ok.length ? 'ok' : 'no_data', text, {
        figures: ok.flatMap((r) => r.figures), blocks: ok.flatMap((r) => r.blocks), citations: ok.flatMap((r) => r.citations ?? []),
        sources: [...new Map(results.flatMap((r) => r.sources ?? []).map((s) => [s.ref, s])).values()],
        calc: results.filter((r) => r.status === 'ok' || r.status === 'no_data').map((r) => ({ tool: r.tool, label: r.label, status: r.status, args: r.args, method: r.method, reads: r.reads, sources: r.sources, figures: (r.figures ?? []).length, durationMs: r.durationMs })),
        missing, notes: [...new Set(results.flatMap((r) => r.notes ?? []))],
      });
      answerObj.trace = trace;
      if (!ok.length) answerObj.sources = [];
      if (ok.length) {
        const bad = contractViolations(answerObj);
        if (bad.length) return base('unavailable', 'No pude verificar la clase y la cobertura de las cifras, así que no las muestro. Reintenta o revisa la cobertura de tus datos.', { violations: bad });
      } else if (!answerObj.calc.length) return base('unavailable', text);
      note({ id: 'verify', kind: 'verify', label: 'Verifiqué clase y cobertura', estado: 'ok', ms: 0, detail: `${answerObj.figures.length} cifras y ${answerObj.blocks.length} bloques con clase y cobertura; las cifras salen de las consultas, no del modelo.` });
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
