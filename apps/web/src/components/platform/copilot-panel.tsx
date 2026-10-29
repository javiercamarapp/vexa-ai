'use client';
import {RovaqCargando} from '../rovaq-cargando';
import {useCallback, useEffect, useId, useRef, useState, type FormEvent} from 'react';
import {Button, LinkButton} from '../ui/button';
import {Drawer} from '../ui/overlay';
import {KindBadge} from '../ui/kind-badge';
import {PfIcon} from './icons';
import {downloadCsv} from './data-table';
import {Meter} from './primitives';
import {useIdioma, useT} from '../i18n/proveedor';
import {numero} from '../../lib/i18n/formato';
import type {Clave, Idioma} from '../../lib/i18n';
import './platform-ui.css';

export type Shortcuts = {suggestions: readonly string[]; categories: ReadonlyArray<{title: string; questions: readonly string[]}>; direct: Readonly<Record<string, {tool: string; args: Record<string, unknown>}>>};
type Figure = {id: string; label: string; display: string; kind: 'observed' | 'estimated' | 'inferred' | 'unclassified'; coverage: string | null; scope: string | null};
type Reply = {mode: 'directa' | 'ia' | 'rechazada' | 'sin_ia'; answer: string; steps: {tool: string; label: string; status: string; error?: string}[]; citations: {label: string; href: string}[]; figures: Figure[]; guard: {ok: boolean; violations: string[]}; budget?: {spent: string; cap: string; pctBps: number | null; exhausted: boolean}};
type Msg = {role: 'user'; content: string} | {role: 'assistant'; reply: Reply} | {role: 'error'; content: string};
const MODE: Record<Reply['mode'], Clave> = {directa: 'tr.pl.modoDirecta', ia: 'tr.pl.modoIa', rechazada: 'tr.pl.modoRechazada', sin_ia: 'tr.pl.modoSinIa'};
const STEP: Record<string, Clave> = {ok: 'tr.pl.stListo', no_data: 'tr.pl.stSinDato', rejected: 'tr.pl.stRechazado', denied: 'tr.pl.stNoPermitido', error: 'tr.pl.stError'};
const usd = (idioma: Idioma, micro: string) => 'US$ ' + numero(idioma, Number(BigInt(micro) / 10000n) / 100, {minimumFractionDigits: 2, maximumFractionDigits: 2});

export function CopilotPanel({endpoint, title, subtitle, placeholder, shortcuts, openLabel, context}: {endpoint: string; title: string; subtitle: string; placeholder: string; shortcuts: Shortcuts; openLabel?: string; context?: string}) {
  const t = useT(), idioma = useIdioma();
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState<Msg[]>([]), [busy, setBusy] = useState(false), [text, setText] = useState('');
  const [status, setStatus] = useState<{budget: Reply['budget']; mode: string} | 'error' | null>(null);
  const area = useRef<HTMLTextAreaElement>(null), end = useRef<HTMLDivElement>(null), opener = useRef<HTMLButtonElement>(null), titleId = useId();
  useEffect(() => {
    if (!open || status) return;
    const c = new AbortController();
    fetch(endpoint, {cache: 'no-store', signal: c.signal}).then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))).then(j => setStatus({budget: j.data.budget, mode: j.data.mode})).catch(() => { if (!c.signal.aborted) setStatus('error'); });
    return () => c.abort();
  }, [open, status, endpoint]);
  useEffect(() => { end.current?.scrollIntoView?.({block: 'end'}); }, [msgs, busy]);
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
      setMsgs(m => [...m, {role: 'error', content: code === 'rate_limited' ? t('tr.pl.cpLimite') : code === 'forbidden' ? t('tr.pl.cpSinAcceso') : t('tr.pl.cpFallo')}]);
    } finally { setBusy(false); }
  }, [busy, endpoint, msgs, t]);
  const submit = (e: FormEvent) => { e.preventDefault(); void send(text, shortcuts.direct[text.trim()]); };
  const budget = status && status !== 'error' ? status.budget : null;
  return <>
    <button ref={opener} type="button" className="btn btn-primary" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><PfIcon name="sparkles" /><span className="btn-label">{openLabel ?? t('tr.pl.copiloto')}</span></button>
    <Drawer open={open} onClose={() => setOpen(false)} size="sm" id="copilot" title={title} subtitle={context ? context + ' · ' + subtitle : subtitle}
      footer={<div className="pf-copilot-foot"><form className="pf-copilot-form" onSubmit={submit}>
          <label className="sr-only" htmlFor={titleId + '-q'}>{t('tr.pl.pregunta')}</label>
          <textarea data-autofocus id={titleId + '-q'} ref={area} rows={2} maxLength={600} placeholder={placeholder} value={text} disabled={busy} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text, shortcuts.direct[text.trim()]); } }} />
          <Button type="submit" variant="primary" icon={<PfIcon name="send" />} loading={busy} disabled={!text.trim()} aria-label={t('tr.pl.consultarDatos')}>{t('tr.pl.preguntar')}</Button>
        </form></div>}>
      <div data-testid="copilot" className="pf-copilot-wrap">
        <div className="pf-copilot-use">
          {status === null && <span className="sr-only">{t('tr.pl.verificando')}</span>}
          {status === 'error' && <span role="alert">{t('tr.pl.cpPresupuestoFallo')}</span>}
          {budget && <><span>{t('tr.pl.usoMes')} <strong>{usd(idioma, budget.spent)}</strong> {t('tr.pl.deCap', {cap: usd(idioma, budget.cap)})}</span><Meter bps={budget.pctBps} />{budget.exhausted && <span role="status">{t('tr.pl.presupuestoAgotado')}</span>}</>}
        </div>
        <div className="pf-copilot-body" aria-live="polite">
          {msgs.length === 0 && <div className="pf-copilot-start">
            <p className="pf-copilot-note">{t('tr.pl.cpNota')}</p>
            <ul className="pf-chips" aria-label={t('tr.pl.preguntasSugeridas')}>{shortcuts.suggestions.map(q => <li key={q}><button type="button" className="btn btn-sm" onClick={() => void send(q, shortcuts.direct[q])}><span className="btn-label">{q}</span></button></li>)}</ul>
            <div className="pf-cats">{shortcuts.categories.map(c => <section key={c.title} className="pf-cat"><h3>{c.title}</h3><ul>{c.questions.map(q => <li key={q}><button type="button" className="btn btn-sm btn-ghost" onClick={() => void send(q, shortcuts.direct[q])}><span className="btn-label">{q}</span></button></li>)}</ul></section>)}</div>
          </div>}
          {msgs.map((m, i) => m.role === 'user' ? <div key={i} className="pf-msg pf-msg-user"><p>{m.content}</p></div> : m.role === 'error' ? <p key={i} className="state state-error" role="alert">{m.content}</p> : <ReplyView key={i} reply={m.reply} />)}
          {busy && <RovaqCargando compacto mensaje={t('tr.pl.consultando')} />}
          <div ref={end} />
        </div>
        {msgs.length > 0 && <div className="pf-copilot-new"><button type="button" className="btn btn-sm btn-ghost" onClick={() => setMsgs([])}>{t('tr.pl.nuevaConv')}</button></div>}
      </div>
    </Drawer>
  </>;
}
function ReplyView({reply}: {reply: Reply}) {
  const t = useT();
  const csv = () => downloadCsv('copiloto-cifras.csv', [t('tr.pl.cifra'), t('tr.pl.valor'), t('tr.pl.clase'), t('tr.pl.alcance'), t('tr.pl.cobertura')], reply.figures.map(f => [f.label, f.display, f.kind, f.scope, f.coverage]));
  return <div className="pf-msg pf-msg-bot">
    <p className="pf-mode"><span className="chip">{t(MODE[reply.mode])}</span></p>
    <div className="pf-answer">{reply.answer.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
    {!reply.guard.ok && <p className="state" role="status">{t('tr.pl.cpDescartado')}</p>}
    {reply.steps.length > 0 && <ul className="pf-steps" aria-label={t('tr.pl.pasos')}>{reply.steps.map((s, i) => <li key={i}><span className="chip" data-status={s.status}>{s.label} · {STEP[s.status] ? t(STEP[s.status]) : s.status}</span></li>)}</ul>}
    {reply.figures.length > 0 && <details className="pf-figs"><summary className="btn btn-sm">{t('tr.pl.verCifras', {n: reply.figures.length})}</summary>
      <div className="table-wrap" tabIndex={0} role="region" aria-label={t('tr.pl.cifrasCitadas')}><table><thead><tr><th scope="col">{t('tr.pl.cifra')}</th><th scope="col">{t('tr.pl.valor')}</th><th scope="col">{t('tr.pl.clase')}</th></tr></thead><tbody>{reply.figures.slice(0, 40).map(f => <tr key={f.id}><td>{f.label}{f.scope ? <small className="pf-sub">{f.scope}</small> : null}</td><td>{f.display}{f.coverage ? <small className="pf-sub">{f.coverage}</small> : null}</td><td><KindBadge kind={f.kind} /></td></tr>)}</tbody></table></div>
      <div className="btn-group"><button type="button" className="btn btn-sm" onClick={csv}><PfIcon name="download" size={14} /><span className="btn-label">{t('tr.pl.descargarCsv')}</span></button></div></details>}
    {reply.citations.length > 0 && <div className="pf-cites"><span className="eyebrow">{t('tr.pl.fuentes')}</span><div className="btn-group">{reply.citations.map(c => <LinkButton key={c.href + c.label} href={c.href} size="sm" icon={<PfIcon name="link" size={14} />}>{c.label}</LinkButton>)}</div></div>}
  </div>;
}
