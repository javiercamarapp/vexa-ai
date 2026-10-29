'use client';
import {ConMarca} from '../ui/brand-mark';
import {useId, useState, type ReactNode} from 'react';
import {KindBadge} from '../ui/kind-badge';
import {PfIcon} from './icons';
import {useIdioma, useT} from '../i18n/proveedor';
import {numero} from '../../lib/i18n/formato';
import type {EpistemicKind} from '../../lib/epistemic.mjs';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';
const TONE_ICON: Record<Tone, string> = {ok: 'check', warn: 'alert', bad: 'alert', info: 'info', muted: 'flat'};
/** Estado: icono + texto + color (nunca solo color). */
export function Pill({tone, children, title}: {tone: Tone; children: ReactNode; title?: string}) {
  return <span className="pf-pill" data-tone={tone} title={title}><PfIcon name={TONE_ICON[tone]} size={12} />{children}</span>;
}
export const healthTone = (level: string): Tone => (level === 'healthy' ? 'ok' : level === 'attention' ? 'warn' : 'bad');
export const severityTone = (s: string): Tone => (s === 'alta' ? 'bad' : s === 'media' ? 'warn' : s === 'baja' ? 'muted' : 'info');

/** Tarjeta de cifra: etiqueta + clase epistémica, valor, nota y cobertura. */
export function Tile({label, value, kind, foot, delta, coverage, children, how}: {label: string; value: ReactNode; kind?: EpistemicKind; foot?: ReactNode; delta?: {display: string; bps: number | null; vs: string; pp?: boolean} | null; coverage?: string | null; children?: ReactNode; how?: string}) {
  const dir = delta?.bps == null ? 'flat' : delta.bps > 0 ? 'up' : delta.bps < 0 ? 'down' : 'flat';
  return <article className="pf-tile">
    <header><span className="pf-tile-label">{label}</span>{kind && <KindBadge kind={kind} />}</header>
    <strong className="pf-tile-value">{value}</strong>
    {delta && <span className="pf-delta" data-dir={dir}><PfIcon name={dir} size={12} />{delta.display}<small> vs {delta.vs}</small></span>}
    {foot && <span className="pf-tile-foot">{foot}</span>}
    {children}
    {coverage && <span className="pf-tile-cov">{coverage}</span>}
    {how && <HowTo text={how} />}
  </article>;
}
/** «Cómo se calculó»: expansor en píldora, mismo estilo que el resto de las vistas. */
export function HowTo({text, label}: {text: string; label?: string}) {
  const t = useT();
  const id = useId(), [open, setOpen] = useState(false);
  return <div className="pf-how"><button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}><PfIcon name="info" size={14} /><span className="btn-label">{label ?? t('tr.pl.comoSeCalculo')}</span></button><p id={id} hidden={!open}>{text}</p></div>;
}
export function Panel({eyebrow, title, marca, actions, children, id, lead, className}: {eyebrow?: string; title: string; /** integración cuyo logo precede al título */marca?: string; actions?: ReactNode; children: ReactNode; id?: string; lead?: ReactNode; className?: string}) {
  const hid = useId();
  return <section className={'card pf-panel' + (className ? ' ' + className : '')} id={id} aria-labelledby={hid}>
    <div className="card-head"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={hid}><ConMarca marca={marca}>{title}</ConMarca></h2></div>{actions && <div className="btn-group">{actions}</div>}</div>
    {lead && <p className="card-lead">{lead}</p>}
    {children}
  </section>;
}
export function Empty({title, children, action, tone = 'muted'}: {title: string; children?: ReactNode; action?: ReactNode; tone?: 'muted' | 'bad'}) {
  return <div className={'pf-empty' + (tone === 'bad' ? ' state-error' : '')} role={tone === 'bad' ? 'alert' : 'status'}><strong>{title}</strong>{children && <p>{children}</p>}{action}</div>;
}
/** Control segmentado accesible (aria-pressed). */
export function Seg<T extends string>({label, value, options, onChange}: {label: string; value: T; options: ReadonlyArray<{value: T; label: string}>; onChange: (v: T) => void}) {
  return <div className="pf-seg" role="group" aria-label={label}>{options.map(o => <button key={o.value} type="button" className="btn btn-sm" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>;
}
export function Skeleton({lines = 3}: {lines?: number}) {
  const t = useT();
  return <div className="skeleton-stack" role="status" aria-label={t('tr.pl.cargando')}>{Array.from({length: lines}, (_, i) => <span key={i} className="skeleton skeleton-line" style={{width: 90 - i * 18 + '%'}} />)}</div>;
}
export function Meter({bps, tone}: {bps: number | null; tone?: Tone}) {
  const t = useT(), idioma = useIdioma();
  return bps === null ? <span className="muted">{t('tr.pl.sinTope')}</span> : <span className="pf-meter" role="img" aria-label={t('tr.pl.delTope', {pct: numero(idioma, bps / 100, {minimumFractionDigits: 1, maximumFractionDigits: 1})})} data-tone={tone ?? (bps >= 10000 ? 'bad' : bps >= 8000 ? 'warn' : 'ok')}><span style={{width: Math.min(100, bps / 100) + '%'}} /></span>;
}
