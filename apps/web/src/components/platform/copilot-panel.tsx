'use client';
import {useCallback, useEffect, useId, useRef, useState, type FormEvent} from 'react';
import {Button, LinkButton} from '../ui/button';
import {KindBadge} from '../ui/kind-badge';
import {PfIcon} from './icons';
import {downloadCsv} from './data-table';
import {Meter} from './primitives';
import './platform-ui.css';

export type Shortcuts = {suggestions: readonly string[]; categories: ReadonlyArray<{title: string; questions: readonly string[]}>; direct: Readonly<Record<string, {tool: string; args: Record<string, unknown>}>>};
type Figure = {id: string; label: string; display: string; kind: 'observed' | 'estimated' | 'inferred' | 'unclassified'; coverage: string | null; scope: string | null};
type Reply = {mode: 'directa' | 'ia' | 'rechazada' | 'sin_ia'; answer: string; steps: {tool: string; label: string; status: string; error?: string}[]; citations: {label: string; href: string}[]; figures: Figure[]; guard: {ok: boolean; violations: string[]}; budget?: {spent: string; cap: string; pctBps: number | null; exhausted: boolean}};
type Msg = {role: 'user'; content: string} | {role: 'assistant'; reply: Reply} | {role: 'error'; content: string};
const MODE: Record<Reply['mode'], string> = {directa: 'Consulta directa · sin IA', ia: 'Respuesta con modelo simulado', rechazada: 'Solicitud rechazada', sin_ia: 'Modo sin IA'};
const STEP: Record<string, string> = {ok: 'Listo', no_data: 'Sin dato', rejected: 'Argumentos rechazados', denied: 'No permitido', error: 'Error'};
const usd = (micro: string) => 'US$ ' + new Intl.NumberFormat('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(BigInt(micro) / 10000n) / 100);

export function CopilotPanel({endpoint, title, subtitle, placeholder, shortcuts, openLabel = 'Copiloto', context}: {endpoint: string; title: string; subtitle: string; placeholder: string; shortcuts: Shortcuts; openLabel?: string; context?: string}) {
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState<Msg[]>([]), [busy, setBusy] = useState(false), [text, setText] = useState('');
  const [status, setStatus] = useState<{budget: Reply['budget']; mode: string} | 'error' | null>(null);
  const area = useRef<HTMLTextAreaElement>(null), end = useRef<HTMLDivElement>(null), opener = useRef<HTMLButtonElement>(null), titleId = useId();
  useEffect(() => {
    if (!open || status) return;
    const c = new AbortController();
    fetch(endpoint, {cache: 'no-store', signal: c.signal}).then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))).then(j => setStatus({budget: j.data.budget, mode: j.data.mode})).catch(() => { if (!c.signal.aborted) setStatus('error'); });
    return () => c.abort();
  }, [open, status, endpoint]);
  useEffect(() => { if (open) area.current?.focus(); }, [open]);
  useEffect(() => { end.current?.scrollIntoView?.({block: 'end'}); }, [msgs, busy]);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); opener.current?.focus(); } }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [open]);
  const send = useCallback(async (question: string, direct?: {tool: string; args: Record<string, unknown>}) => {
    const q = question.trim(); if (!q || busy) return;
    const history: {role: 'user' | 'assistant'; content: string}[] = msgs.flatMap(m => m.role === 'user' ? [{role: 'user' as const, content: m.content}] : m.role === 'assistant' ? [{role: 'assistant' as const, content: m.reply.answer.slice(0, 1000)}] : [] as {role: 'user' | 'assistant'; content: string}[]).slice(-6);
    setMsgs(m => [...m, {role: 'user', content: q}]); setText(''); setBusy(true);
    try {
      const r = await fetch(endpoint, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(direct ? {tool: direct.tool, args: direct.args} : {question: q, history}), signal: AbortSignal.timeout(30000)});
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.code ?? 'copilot_unavailable');
      setMsgs(m => [...m, {role: 'assistant', reply: j.data}]);
      if (j.data.budget) setStatus({budget: j.data.budget, mode: j.data.budget.exhausted ? 'sin_ia' : 'ia'});
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setMsgs(m => [...m, {role: 'error', content: code === 'rate_limited' ? 'Demasiadas preguntas seguidas. Espera un minuto.' : code === 'forbidden' ? 'Tu rol no tiene acceso a este Copiloto.' : 'No se pudo consultar. Reintenta en unos segundos.'}]);
    } finally { setBusy(false); }
  }, [busy, endpoint, msgs]);
  const submit = (e: FormEvent) => { e.preventDefault(); void send(text, shortcuts.direct[text.trim()]); };
  const budget = status && status !== 'error' ? status.budget : null;
  return <>
    <button ref={opener} type="button" className="btn btn-primary" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><PfIcon name="sparkles" /><span className="btn-label">{openLabel}</span></button>
    {open && <div className="pf-copilot-layer">
      <button type="button" className="pf-copilot-backdrop" aria-label="Cerrar el Copiloto" tabIndex={-1} onClick={() => { setOpen(false); opener.current?.focus(); }} />
      <aside className="pf-copilot" role="dialog" aria-modal="false" aria-labelledby={titleId} data-testid="copilot">
        <header className="pf-copilot-head">
          <div><p className="eyebrow">{context ?? 'Copiloto'}</p><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div>
          <div className="btn-group">{msgs.length > 0 && <button type="button" className="btn btn-sm" onClick={() => setMsgs([])}>Nueva conversación</button>}<button type="button" className="btn btn-sm" aria-label="Cerrar el Copiloto" onClick={() => { setOpen(false); opener.current?.focus(); }}><PfIcon name="close" size={14} /><span className="btn-label">Cerrar</span></button></div>
        </header>
        <div className="pf-copilot-use">
          {status === null && <span className="muted">Verificando disponibilidad…</span>}
          {status === 'error' && <span role="alert">No pude verificar el presupuesto de IA. Las consultas directas siguen disponibles.</span>}
          {budget && <><span>Uso del mes: <strong>{usd(budget.spent)}</strong> de {usd(budget.cap)}</span><Meter bps={budget.pctBps} />{budget.exhausted && <span role="status">Presupuesto agotado: solo consultas directas.</span>}</>}
        </div>
        <div className="pf-copilot-body" aria-live="polite">
          {msgs.length === 0 && <div className="pf-copilot-start">
            <p className="pf-copilot-note">Responde solo con cifras ya calculadas y te dice de dónde salen; si no hay dato, te lo dice. No inventa números ni muestra texto de clientes.</p>
            <ul className="pf-chips" aria-label="Preguntas sugeridas">{shortcuts.suggestions.map(q => <li key={q}><button type="button" className="btn btn-sm" onClick={() => void send(q, shortcuts.direct[q])}><span className="btn-label">{q}</span></button></li>)}</ul>
            <div className="pf-cats">{shortcuts.categories.map(c => <section key={c.title} className="pf-cat"><h3>{c.title}</h3><ul>{c.questions.map(q => <li key={q}><button type="button" className="btn btn-sm btn-ghost" onClick={() => void send(q, shortcuts.direct[q])}><span className="btn-label">{q}</span></button></li>)}</ul></section>)}</div>
          </div>}
          {msgs.map((m, i) => m.role === 'user' ? <div key={i} className="pf-msg pf-msg-user"><p>{m.content}</p></div> : m.role === 'error' ? <p key={i} className="state state-error" role="alert">{m.content}</p> : <ReplyView key={i} reply={m.reply} />)}
          {busy && <div className="pf-msg pf-msg-wait" role="status"><span className="btn-spinner" aria-hidden="true" /> Consultando las cifras calculadas…</div>}
          <div ref={end} />
        </div>
        <form className="pf-copilot-form" onSubmit={submit}>
          <label className="sr-only" htmlFor={titleId + '-q'}>Pregunta</label>
          <textarea id={titleId + '-q'} ref={area} rows={2} maxLength={600} placeholder={placeholder} value={text} disabled={busy} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text, shortcuts.direct[text.trim()]); } }} />
          <Button type="submit" variant="primary" icon={<PfIcon name="send" />} loading={busy} disabled={!text.trim()} aria-label="Consultar datos">Preguntar</Button>
        </form>
      </aside>
    </div>}
  </>;
}
function ReplyView({reply}: {reply: Reply}) {
  const csv = () => downloadCsv('copiloto-cifras.csv', ['Cifra', 'Valor', 'Clase', 'Alcance', 'Cobertura'], reply.figures.map(f => [f.label, f.display, f.kind, f.scope, f.coverage]));
  return <div className="pf-msg pf-msg-bot">
    <p className="pf-mode"><span className="chip">{MODE[reply.mode]}</span></p>
    <div className="pf-answer">{reply.answer.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
    {!reply.guard.ok && <p className="state" role="status">Se descartó el texto redactado por el modelo porque incluía cifras que ninguna herramienta devolvió. Esta respuesta usa solo lo calculado.</p>}
    {reply.steps.length > 0 && <ul className="pf-steps" aria-label="Pasos">{reply.steps.map((s, i) => <li key={i}><span className="chip" data-status={s.status}>{s.label} · {STEP[s.status] ?? s.status}</span></li>)}</ul>}
    {reply.figures.length > 0 && <details className="pf-figs"><summary className="btn btn-sm">Ver las {reply.figures.length} cifras citadas</summary>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Cifras citadas"><table><thead><tr><th scope="col">Cifra</th><th scope="col">Valor</th><th scope="col">Clase</th></tr></thead><tbody>{reply.figures.slice(0, 40).map(f => <tr key={f.id}><td>{f.label}{f.scope ? <small className="pf-sub">{f.scope}</small> : null}</td><td>{f.display}{f.coverage ? <small className="pf-sub">{f.coverage}</small> : null}</td><td><KindBadge kind={f.kind} /></td></tr>)}</tbody></table></div>
      <div className="btn-group"><button type="button" className="btn btn-sm" onClick={csv}><PfIcon name="download" size={14} /><span className="btn-label">Descargar CSV</span></button></div></details>}
    {reply.citations.length > 0 && <div className="pf-cites"><span className="eyebrow">Fuentes</span><div className="btn-group">{reply.citations.map(c => <LinkButton key={c.href + c.label} href={c.href} size="sm" icon={<PfIcon name="link" size={14} />}>{c.label}</LinkButton>)}</div></div>}
  </div>;
}
